"""
ReAct Agent Implementation
Implements Reason-Act-Observe loop for intelligent decision making
"""

import logging
import json
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from dataclasses import dataclass

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import AgentState, AgentType

logger = logging.getLogger(__name__)


@dataclass
class ThoughtStep:
    """A single step in the reasoning process"""
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict] = None
    observation: Optional[str] = None
    

class ReActState(AgentState):
    """Extended state for ReAct agents"""
    # Reasoning chain
    thoughts: List[Dict[str, Any]]
    current_step: int
    max_steps: int
    
    # Tool execution
    tool_calls: List[Dict[str, Any]]
    tool_results: List[Dict[str, Any]]
    
    # Planning
    plan: List[str]
    completed_steps: List[str]
    
    # Self-reflection
    self_critique: str
    should_revise: bool
    revision_count: int


class ReActAgent:
    """
    ReAct (Reason + Act) Agent
    Implements intelligent reasoning with tool use
    """
    
    REACT_PROMPT = """You are an intelligent AI tutor assistant. You help students learn by:
1. Understanding their question deeply
2. Breaking down complex problems
3. Using available tools to gather information
4. Providing personalized, educational responses

You have access to these tools:
{tools}

Current user context:
- User ID: {user_id}
- Learning style: {learning_style}
- Difficulty level: {difficulty_level}

Previous thoughts and observations:
{scratchpad}

User's question: {user_input}

Think step by step. For each step:
1. THOUGHT: Analyze what you need to do
2. ACTION: Choose a tool to use (or "final_answer" if ready to respond)
3. ACTION_INPUT: The input for the tool

Respond in this exact format:
THOUGHT: [your reasoning]
ACTION: [tool_name or "final_answer"]
ACTION_INPUT: [json input for tool, or your final response]
"""

    PLANNING_PROMPT = """Break down this learning request into steps:

User request: {user_input}
User level: {difficulty_level}

Create a plan with 2-5 steps. Each step should be actionable.

Return JSON:
{{"plan": ["step 1", "step 2", ...], "reasoning": "why this plan"}}
"""

    CRITIQUE_PROMPT = """Evaluate this response for a student:

Question: {user_input}
Response: {response}
User level: {difficulty_level}

Critique the response:
1. Is it accurate?
2. Is it appropriate for the user's level?
3. Is it complete?
4. What could be improved?

Return JSON:
{{"score": 0-10, "issues": ["issue1"], "suggestions": ["suggestion1"], "should_revise": true/false}}
"""

    def __init__(
        self,
        ai_client: Any,
        tools: List,
        knowledge_graph: Optional[Any] = None,
        max_steps: int = 5
    ):
        self.ai_client = ai_client
        self.tools = tools
        self.knowledge_graph = knowledge_graph
        self.max_steps = max_steps
        self.tool_map = {tool.name: tool for tool in tools}
        
        self.graph = self._build_graph()
        self.compiled = self.graph.compile(checkpointer=MemorySaver())
    
    def _build_graph(self) -> StateGraph:
        """Build the ReAct graph"""
        graph = StateGraph(ReActState)
        
        # Nodes
        graph.add_node("plan", self._plan)
        graph.add_node("think", self._think)
        graph.add_node("act", self._act)
        graph.add_node("observe", self._observe)
        graph.add_node("critique", self._critique)
        graph.add_node("revise", self._revise)
        graph.add_node("respond", self._respond)
        
        # Entry
        graph.set_entry_point("plan")
        
        # Edges
        graph.add_edge("plan", "think")
        graph.add_conditional_edges(
            "think",
            self._should_act_or_respond,
            {"act": "act", "respond": "critique"}
        )
        graph.add_edge("act", "observe")
        graph.add_conditional_edges(
            "observe",
            self._should_continue,
            {"continue": "think", "respond": "critique"}
        )
        graph.add_conditional_edges(
            "critique",
            self._should_revise,
            {"revise": "revise", "done": "respond"}
        )
        graph.add_edge("revise", "critique")
        graph.add_edge("respond", END)
        
        return graph

    async def _plan(self, state: ReActState) -> ReActState:
        """Create a plan for handling the request"""
        prompt = self.PLANNING_PROMPT.format(
            user_input=state.get("user_input", ""),
            difficulty_level=state.get("difficulty_level", "intermediate")
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=300, temperature=0.3)
            
            # Parse plan
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            plan_data = json.loads(json_str)
            state["plan"] = plan_data.get("plan", [])
            
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            state["plan"] = ["Understand the question", "Provide a helpful response"]
        
        state["completed_steps"] = []
        state["thoughts"] = []
        state["current_step"] = 0
        state["tool_calls"] = []
        state["tool_results"] = []
        state["revision_count"] = 0
        
        logger.info(f"Plan created: {state['plan']}")
        return state
    
    async def _think(self, state: ReActState) -> ReActState:
        """Reason about the next action"""
        # Build scratchpad from previous thoughts
        scratchpad = ""
        for thought in state.get("thoughts", []):
            scratchpad += f"\nTHOUGHT: {thought.get('thought', '')}"
            if thought.get("action"):
                scratchpad += f"\nACTION: {thought['action']}"
                scratchpad += f"\nACTION_INPUT: {thought.get('action_input', '')}"
            if thought.get("observation"):
                scratchpad += f"\nOBSERVATION: {thought['observation']}"
        
        # Build tools description
        tools_desc = "\n".join([
            f"- {tool.name}: {tool.description}"
            for tool in self.tools
        ])
        
        prompt = self.REACT_PROMPT.format(
            tools=tools_desc,
            user_id=state.get("user_id", "unknown"),
            learning_style=state.get("learning_style", "mixed"),
            difficulty_level=state.get("difficulty_level", "intermediate"),
            scratchpad=scratchpad or "No previous steps",
            user_input=state.get("user_input", "")
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.7)
            
            # Parse response
            thought_data = self._parse_react_response(response)
            state["thoughts"] = state.get("thoughts", []) + [thought_data]
            state["current_step"] = state.get("current_step", 0) + 1
            
            logger.info(f"Step {state['current_step']}: {thought_data.get('action', 'thinking')}")
            
        except Exception as e:
            logger.error(f"Thinking failed: {e}")
            state["thoughts"] = state.get("thoughts", []) + [{
                "thought": "I should provide a direct response",
                "action": "final_answer",
                "action_input": "I'll help you with that."
            }]
        
        return state
    
    def _parse_react_response(self, response: str) -> Dict[str, Any]:
        """Parse ReAct format response"""
        result = {"thought": "", "action": None, "action_input": None}
        
        lines = response.strip().split("\n")
        current_key = None
        current_value = []
        
        for line in lines:
            line_upper = line.upper()
            if line_upper.startswith("THOUGHT:"):
                if current_key:
                    result[current_key] = " ".join(current_value).strip()
                current_key = "thought"
                current_value = [line.split(":", 1)[1].strip() if ":" in line else ""]
            elif line_upper.startswith("ACTION:"):
                if current_key:
                    result[current_key] = " ".join(current_value).strip()
                current_key = "action"
                current_value = [line.split(":", 1)[1].strip() if ":" in line else ""]
            elif line_upper.startswith("ACTION_INPUT:"):
                if current_key:
                    result[current_key] = " ".join(current_value).strip()
                current_key = "action_input"
                current_value = [line.split(":", 1)[1].strip() if ":" in line else ""]
            elif line_upper.startswith("OBSERVATION:"):
                if current_key:
                    result[current_key] = " ".join(current_value).strip()
                current_key = "observation"
                current_value = [line.split(":", 1)[1].strip() if ":" in line else ""]
            else:
                current_value.append(line)
        
        if current_key:
            result[current_key] = " ".join(current_value).strip()
        
        # Try to parse action_input as JSON
        if result.get("action_input"):
            try:
                result["action_input"] = json.loads(result["action_input"])
            except:
                pass  # Keep as string
        
        return result

    async def _act(self, state: ReActState) -> ReActState:
        """Execute the chosen action/tool"""
        thoughts = state.get("thoughts", [])
        if not thoughts:
            return state
        
        last_thought = thoughts[-1]
        action = last_thought.get("action")
        action_input = last_thought.get("action_input", {})
        
        if action == "final_answer" or action not in self.tool_map:
            return state
        
        tool = self.tool_map[action]
        
        try:
            # Execute tool
            if isinstance(action_input, dict):
                result = await tool.ainvoke(action_input)
            else:
                result = await tool.ainvoke({"input": action_input})
            
            state["tool_calls"] = state.get("tool_calls", []) + [{
                "tool": action,
                "input": action_input,
                "timestamp": datetime.utcnow().isoformat()
            }]
            state["tool_results"] = state.get("tool_results", []) + [result]
            
            logger.info(f"Tool {action} executed successfully")
            
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            state["tool_results"] = state.get("tool_results", []) + [f"Error: {str(e)}"]
        
        return state
    
    async def _observe(self, state: ReActState) -> ReActState:
        """Process tool results"""
        tool_results = state.get("tool_results", [])
        thoughts = state.get("thoughts", [])
        
        if tool_results and thoughts:
            # Add observation to last thought
            last_result = tool_results[-1]
            if isinstance(last_result, (dict, list)):
                observation = json.dumps(last_result, indent=2)[:500]
            else:
                observation = str(last_result)[:500]
            
            thoughts[-1]["observation"] = observation
            state["thoughts"] = thoughts
        
        return state
    
    async def _critique(self, state: ReActState) -> ReActState:
        """Self-critique the response"""
        thoughts = state.get("thoughts", [])
        if not thoughts:
            state["should_revise"] = False
            return state
        
        # Get the final answer
        final_response = ""
        for thought in reversed(thoughts):
            if thought.get("action") == "final_answer":
                final_response = thought.get("action_input", "")
                break
        
        if not final_response:
            final_response = state.get("final_response", "")
        
        prompt = self.CRITIQUE_PROMPT.format(
            user_input=state.get("user_input", ""),
            response=str(final_response)[:1000],
            difficulty_level=state.get("difficulty_level", "intermediate")
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=300, temperature=0.3)
            
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            critique = json.loads(json_str)
            state["self_critique"] = json.dumps(critique)
            state["should_revise"] = critique.get("should_revise", False) and state.get("revision_count", 0) < 2
            
            logger.info(f"Critique score: {critique.get('score', 'N/A')}, revise: {state['should_revise']}")
            
        except Exception as e:
            logger.error(f"Critique failed: {e}")
            state["should_revise"] = False
        
        return state
    
    async def _revise(self, state: ReActState) -> ReActState:
        """Revise the response based on critique"""
        state["revision_count"] = state.get("revision_count", 0) + 1
        
        critique = state.get("self_critique", "{}")
        try:
            critique_data = json.loads(critique)
            suggestions = critique_data.get("suggestions", [])
        except:
            suggestions = []
        
        # Add revision thought
        revision_thought = {
            "thought": f"I need to revise my response. Suggestions: {suggestions}",
            "action": "final_answer",
            "action_input": None  # Will be filled by next think cycle
        }
        
        state["thoughts"] = state.get("thoughts", []) + [revision_thought]
        
        return state
    
    async def _respond(self, state: ReActState) -> ReActState:
        """Generate final response"""
        thoughts = state.get("thoughts", [])
        
        # Find final answer
        final_response = ""
        for thought in reversed(thoughts):
            if thought.get("action") == "final_answer":
                final_response = thought.get("action_input", "")
                if isinstance(final_response, dict):
                    final_response = final_response.get("response", str(final_response))
                break
        
        if not final_response:
            # Generate response from thoughts
            context = "\n".join([
                f"- {t.get('thought', '')}" 
                for t in thoughts if t.get('thought')
            ])
            
            prompt = f"""Based on this reasoning, provide a helpful response:

{context}

User question: {state.get('user_input', '')}

Response:"""
            
            final_response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
        
        state["final_response"] = final_response
        state["response_metadata"] = {
            "steps": len(thoughts),
            "tools_used": [t["tool"] for t in state.get("tool_calls", [])],
            "revised": state.get("revision_count", 0) > 0
        }
        
        return state

    def _should_act_or_respond(self, state: ReActState) -> Literal["act", "respond"]:
        """Decide whether to act or respond"""
        thoughts = state.get("thoughts", [])
        if not thoughts:
            return "respond"
        
        last_thought = thoughts[-1]
        action = last_thought.get("action", "")
        
        if action == "final_answer" or action not in self.tool_map:
            return "respond"
        return "act"
    
    def _should_continue(self, state: ReActState) -> Literal["continue", "respond"]:
        """Decide whether to continue reasoning or respond"""
        current_step = state.get("current_step", 0)
        max_steps = state.get("max_steps", self.max_steps)
        
        if current_step >= max_steps:
            return "respond"
        
        thoughts = state.get("thoughts", [])
        if thoughts:
            last_thought = thoughts[-1]
            if last_thought.get("action") == "final_answer":
                return "respond"
        
        return "continue"
    
    def _should_revise(self, state: ReActState) -> Literal["revise", "done"]:
        """Decide whether to revise the response"""
        if state.get("should_revise", False):
            return "revise"
        return "done"
    
    async def invoke(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the ReAct agent"""
        # Initialize state
        react_state: ReActState = {
            **state,
            "thoughts": [],
            "current_step": 0,
            "max_steps": self.max_steps,
            "tool_calls": [],
            "tool_results": [],
            "plan": [],
            "completed_steps": [],
            "self_critique": "",
            "should_revise": False,
            "revision_count": 0
        }
        
        config = {
            "configurable": {
                "thread_id": state.get("session_id", "default")
            }
        }
        
        result = await self.compiled.ainvoke(react_state, config)
        return result


def create_react_agent(
    ai_client,
    tools: List,
    knowledge_graph=None,
    max_steps: int = 5
) -> ReActAgent:
    """Factory function to create a ReAct agent"""
    return ReActAgent(
        ai_client=ai_client,
        tools=tools,
        knowledge_graph=knowledge_graph,
        max_steps=max_steps
    )
