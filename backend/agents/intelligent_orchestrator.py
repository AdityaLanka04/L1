"""
Intelligent Orchestrator
Advanced orchestrator with planning, multi-agent collaboration, and self-reflection
"""

import logging
import json
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import AgentState, AgentType, AgentResponse, agent_registry
from .react_agent import ReActAgent, create_react_agent
from .tools.knowledge_tools import KnowledgeGraphTools
from .tools.search_tools import SearchTools
from .tools.content_tools import ContentTools
from .memory import MemoryManager, get_memory_manager, initialize_memory_manager

logger = logging.getLogger(__name__)


class IntelligentOrchestratorState(AgentState):
    """Extended state for intelligent orchestrator"""
    # Planning
    task_plan: List[Dict[str, Any]]
    current_task_index: int
    
    # Multi-agent
    agent_results: Dict[str, Any]
    collaboration_notes: List[str]
    
    # Memory
    conversation_history: List[Dict[str, str]]
    learned_preferences: Dict[str, Any]
    
    # Reflection
    quality_score: float
    improvement_suggestions: List[str]


class IntelligentOrchestrator:
    """
    Intelligent orchestrator with:
    - Task planning and decomposition
    - ReAct-based reasoning
    - Multi-agent collaboration
    - Self-reflection and improvement
    - Persistent memory
    """
    
    TASK_DECOMPOSITION_PROMPT = """Analyze this user request and break it into tasks.

User request: {user_input}
User context:
- Learning style: {learning_style}
- Level: {difficulty_level}
- Recent topics: {recent_topics}

Available capabilities:
1. explain - Explain concepts clearly
2. generate_flashcards - Create flashcards from content
3. generate_quiz - Create quiz questions
4. search_knowledge - Search user's notes and flashcards
5. analyze_progress - Check learning progress
6. create_study_plan - Generate study schedules

Decompose into 1-5 tasks. Return JSON:
{{
    "understanding": "what the user wants",
    "tasks": [
        {{"type": "capability", "description": "what to do", "priority": 1-5}}
    ],
    "requires_tools": true/false
}}
"""

    SYNTHESIS_PROMPT = """Synthesize these results into a cohesive response for the student.

User question: {user_input}
User level: {difficulty_level}

Task results:
{task_results}

Create a helpful, educational response that:
1. Directly addresses the user's question
2. Is appropriate for their level
3. Encourages further learning

Response:"""

    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        db_session_factory: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None
    ):
        self.ai_client = ai_client
        self.knowledge_graph = knowledge_graph
        self.db_session_factory = db_session_factory
        self.memory_manager = memory_manager or get_memory_manager()
        
        # Initialize tools
        self._init_tools()
        
        # Create ReAct agent with tools
        self.react_agent = create_react_agent(
            ai_client=ai_client,
            tools=self.all_tools,
            knowledge_graph=knowledge_graph,
            max_steps=5
        )
        
        # Build graph
        self.graph = self._build_graph()
        self.compiled = self.graph.compile(checkpointer=MemorySaver())
        
        logger.info("Intelligent Orchestrator initialized with Memory Manager")
    
    def _init_tools(self):
        """Initialize all tools"""
        # Knowledge graph tools
        if self.knowledge_graph:
            kg_tools = KnowledgeGraphTools(self.knowledge_graph)
            self.kg_tools = kg_tools.get_tools()
        else:
            self.kg_tools = []
        
        # Search tools
        if self.db_session_factory:
            search_tools = SearchTools(self.db_session_factory)
            self.search_tools = search_tools.get_tools()
        else:
            self.search_tools = []
        
        # Content tools
        content_tools = ContentTools(self.db_session_factory, self.ai_client)
        self.content_tools = content_tools.get_tools()
        
        # Combine all tools
        self.all_tools = self.kg_tools + self.search_tools + self.content_tools
        
        logger.info(f"Initialized {len(self.all_tools)} tools")

    def _build_graph(self) -> StateGraph:
        """Build the intelligent orchestrator graph"""
        graph = StateGraph(IntelligentOrchestratorState)
        
        # Nodes
        graph.add_node("load_context", self._load_context)
        graph.add_node("decompose_task", self._decompose_task)
        graph.add_node("execute_react", self._execute_react)
        graph.add_node("synthesize", self._synthesize)
        graph.add_node("reflect", self._reflect)
        graph.add_node("improve", self._improve)
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("respond", self._respond)
        
        # Entry
        graph.set_entry_point("load_context")
        
        # Edges
        graph.add_edge("load_context", "decompose_task")
        graph.add_edge("decompose_task", "execute_react")
        graph.add_edge("execute_react", "synthesize")
        graph.add_edge("synthesize", "reflect")
        graph.add_conditional_edges(
            "reflect",
            self._should_improve,
            {"improve": "improve", "done": "update_memory"}
        )
        graph.add_edge("improve", "reflect")
        graph.add_edge("update_memory", "respond")
        graph.add_edge("respond", END)
        
        return graph
    
    async def _load_context(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Load user context from Memory Manager and knowledge graph"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        query = state.get("user_input", "")
        
        # Load context from Memory Manager (the unified brain)
        if self.memory_manager:
            try:
                memory_context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="orchestrator",
                    query=query,
                    session_id=session_id
                )
                
                state["knowledge_context"] = memory_context
                state["related_concepts"] = memory_context.get("topics_of_interest", [])
                state["user_mastery"] = {}  # Will be populated from memory
                
                # Extract user preferences
                prefs = memory_context.get("user_preferences", {})
                state["learning_style"] = prefs.get("learning_style", state.get("learning_style", "mixed"))
                state["difficulty_level"] = prefs.get("difficulty_level", state.get("difficulty_level", "intermediate"))
                
                # Get recent conversation context
                state["conversation_history"] = memory_context.get("recent_conversations", [])
                
                logger.info(f"Loaded memory context with {len(memory_context.get('relevant_memories', []))} relevant memories")
                
            except Exception as e:
                logger.error(f"Error loading memory context: {e}")
        
        # Also load from knowledge graph for concept relationships
        if self.knowledge_graph and user_id:
            try:
                kg_context = await self.knowledge_graph.get_context(query, int(user_id) if str(user_id).isdigit() else None)
                
                # Merge with memory context
                if "knowledge_context" not in state:
                    state["knowledge_context"] = {}
                state["knowledge_context"]["kg_concepts"] = kg_context.get("related_concepts", [])
                state["knowledge_context"]["kg_mastery"] = kg_context.get("user_mastery", {})
                
            except Exception as e:
                logger.error(f"Error loading KG context: {e}")
        
        # Initialize state fields
        state["task_plan"] = []
        state["current_task_index"] = 0
        state["agent_results"] = {}
        state["collaboration_notes"] = []
        state["learned_preferences"] = state.get("learned_preferences", {})
        state["quality_score"] = 0.0
        state["improvement_suggestions"] = []
        state["execution_path"] = ["orchestrator:load_context"]
        
        logger.info(f"Context loaded for user {user_id}")
        return state
    
    async def _decompose_task(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Decompose user request into tasks"""
        recent_topics = state.get("related_concepts", [])[:5]
        
        prompt = self.TASK_DECOMPOSITION_PROMPT.format(
            user_input=state.get("user_input", ""),
            learning_style=state.get("learning_style", "mixed"),
            difficulty_level=state.get("difficulty_level", "intermediate"),
            recent_topics=", ".join(recent_topics) if recent_topics else "none"
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.3)
            
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            decomposition = json.loads(json_str)
            state["task_plan"] = decomposition.get("tasks", [])
            state["collaboration_notes"].append(f"Understanding: {decomposition.get('understanding', '')}")
            
            logger.info(f"Decomposed into {len(state['task_plan'])} tasks")
            
        except Exception as e:
            logger.error(f"Task decomposition failed: {e}")
            state["task_plan"] = [{"type": "explain", "description": "Provide helpful response", "priority": 1}]
        
        state["execution_path"].append("orchestrator:decompose")
        return state

    async def _execute_react(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Execute ReAct agent for intelligent reasoning"""
        # Prepare context for ReAct agent
        react_state = {
            "user_id": state.get("user_id"),
            "user_input": state.get("user_input"),
            "session_id": state.get("session_id"),
            "learning_style": state.get("learning_style", "mixed"),
            "difficulty_level": state.get("difficulty_level", "intermediate"),
            "knowledge_context": state.get("knowledge_context", {}),
            "task_plan": state.get("task_plan", [])
        }
        
        try:
            result = await self.react_agent.invoke(react_state)
            
            state["agent_results"]["react"] = {
                "response": result.get("final_response", ""),
                "thoughts": result.get("thoughts", []),
                "tools_used": [t["tool"] for t in result.get("tool_calls", [])],
                "metadata": result.get("response_metadata", {})
            }
            
            logger.info(f"ReAct completed with {len(result.get('thoughts', []))} reasoning steps")
            
        except Exception as e:
            logger.error(f"ReAct execution failed: {e}")
            # Fallback to direct response
            state["agent_results"]["react"] = {
                "response": await self._generate_fallback(state),
                "thoughts": [],
                "tools_used": [],
                "error": str(e)
            }
        
        state["execution_path"].append("orchestrator:react")
        return state
    
    async def _generate_fallback(self, state: IntelligentOrchestratorState) -> str:
        """Generate fallback response when ReAct fails"""
        prompt = f"""You are a helpful AI tutor. Answer this question:

Question: {state.get('user_input', '')}
User level: {state.get('difficulty_level', 'intermediate')}

Provide a clear, educational response:"""
        
        return self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
    
    async def _synthesize(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Synthesize results from all agents"""
        react_result = state.get("agent_results", {}).get("react", {})
        
        # If we have a good ReAct response, use it
        if react_result.get("response"):
            state["final_response"] = react_result["response"]
        else:
            # Synthesize from multiple sources
            task_results = json.dumps(state.get("agent_results", {}), indent=2)
            
            prompt = self.SYNTHESIS_PROMPT.format(
                user_input=state.get("user_input", ""),
                difficulty_level=state.get("difficulty_level", "intermediate"),
                task_results=task_results[:2000]
            )
            
            state["final_response"] = self.ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
        
        state["execution_path"].append("orchestrator:synthesize")
        return state
    
    async def _reflect(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Self-reflect on response quality"""
        response = state.get("final_response", "")
        
        prompt = f"""Rate this educational response (1-10) and suggest improvements:

Question: {state.get('user_input', '')}
Response: {response[:1000]}
User level: {state.get('difficulty_level', 'intermediate')}

Return JSON:
{{"score": 1-10, "suggestions": ["improvement1"], "is_good_enough": true/false}}
"""
        
        try:
            result = self.ai_client.generate(prompt, max_tokens=200, temperature=0.3)
            
            json_str = result.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            reflection = json.loads(json_str)
            state["quality_score"] = reflection.get("score", 7) / 10.0
            state["improvement_suggestions"] = reflection.get("suggestions", [])
            
            logger.info(f"Quality score: {state['quality_score']:.1%}")
            
        except Exception as e:
            logger.error(f"Reflection failed: {e}")
            state["quality_score"] = 0.7
            state["improvement_suggestions"] = []
        
        state["execution_path"].append("orchestrator:reflect")
        return state

    async def _improve(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Improve response based on reflection"""
        suggestions = state.get("improvement_suggestions", [])
        current_response = state.get("final_response", "")
        
        prompt = f"""Improve this response based on these suggestions:

Original response: {current_response[:1500]}

Suggestions:
{chr(10).join(f'- {s}' for s in suggestions)}

Improved response:"""
        
        try:
            improved = self.ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
            state["final_response"] = improved
            state["collaboration_notes"].append("Response improved based on self-reflection")
        except Exception as e:
            logger.error(f"Improvement failed: {e}")
        
        state["execution_path"].append("orchestrator:improve")
        return state
    
    async def _update_memory(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Update Memory Manager with interaction data"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        
        # Store conversation in Memory Manager
        if self.memory_manager:
            try:
                # Extract topics from the interaction
                topics = state.get("related_concepts", [])[:5]
                
                # Store the conversation
                await self.memory_manager.remember_conversation(
                    user_id=user_id,
                    user_message=state.get("user_input", ""),
                    ai_response=state.get("final_response", ""),
                    session_id=session_id,
                    agent_type="orchestrator",
                    topics=topics
                )
                
                # Learn from interaction
                await self.memory_manager.learn_from_interaction(
                    user_id=user_id,
                    interaction_data={
                        "response_length": len(state.get("final_response", "")),
                        "topics": topics,
                        "quality_score": state.get("quality_score", 0.5)
                    }
                )
                
                # Update session context
                self.memory_manager.set_session_context(session_id, "last_query", state.get("user_input", ""))
                self.memory_manager.set_session_context(session_id, "last_topics", topics)
                
                logger.info(f"Updated memory for user {user_id}")
                
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        # Also update knowledge graph
        if self.knowledge_graph and user_id:
            try:
                concepts = state.get("related_concepts", [])
                for concept in concepts[:3]:
                    await self.knowledge_graph.update_user_mastery(
                        int(user_id) if str(user_id).isdigit() else 0,
                        concept,
                        0.05,
                        True
                    )
            except Exception as e:
                logger.error(f"KG update failed: {e}")
        
        state["execution_path"].append("orchestrator:memory")
        return state
    
    async def _respond(self, state: IntelligentOrchestratorState) -> IntelligentOrchestratorState:
        """Prepare final response"""
        react_result = state.get("agent_results", {}).get("react", {})
        
        state["response_metadata"] = {
            "success": True,
            "quality_score": state.get("quality_score", 0.0),
            "reasoning_steps": len(react_result.get("thoughts", [])),
            "tools_used": react_result.get("tools_used", []),
            "tasks_completed": len(state.get("task_plan", [])),
            "improved": "orchestrator:improve" in state.get("execution_path", []),
            "execution_path": state.get("execution_path", []),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return state
    
    def _should_improve(self, state: IntelligentOrchestratorState) -> Literal["improve", "done"]:
        """Decide if response needs improvement"""
        quality_score = state.get("quality_score", 0.7)
        already_improved = "orchestrator:improve" in state.get("execution_path", [])
        
        if quality_score < 0.6 and not already_improved:
            return "improve"
        return "done"
    
    async def invoke(self, state: Dict[str, Any]) -> AgentResponse:
        """Execute the intelligent orchestrator"""
        import time
        start_time = time.time()
        
        # Initialize state
        full_state: IntelligentOrchestratorState = {
            **state,
            "task_plan": [],
            "current_task_index": 0,
            "agent_results": {},
            "collaboration_notes": [],
            "conversation_history": [],
            "learned_preferences": {},
            "quality_score": 0.0,
            "improvement_suggestions": [],
            "errors": [],
            "warnings": []
        }
        
        config = {
            "configurable": {
                "thread_id": state.get("session_id", "default")
            }
        }
        
        try:
            result = await self.compiled.ainvoke(full_state, config)
            
            return AgentResponse(
                success=True,
                response=result.get("final_response", ""),
                agent_type=AgentType.ORCHESTRATOR,
                confidence=result.get("quality_score", 0.0),
                metadata=result.get("response_metadata", {}),
                suggested_followups=[],
                execution_time_ms=(time.time() - start_time) * 1000,
                errors=result.get("errors", [])
            )
            
        except Exception as e:
            logger.error(f"Intelligent orchestrator failed: {e}")
            return AgentResponse(
                success=False,
                response=f"I encountered an error: {str(e)}",
                agent_type=AgentType.ORCHESTRATOR,
                errors=[str(e)],
                execution_time_ms=(time.time() - start_time) * 1000
            )


def create_intelligent_orchestrator(
    ai_client,
    knowledge_graph=None,
    db_session_factory=None,
    memory_manager=None
) -> IntelligentOrchestrator:
    """Factory function to create intelligent orchestrator"""
    return IntelligentOrchestrator(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory,
        memory_manager=memory_manager
    )
