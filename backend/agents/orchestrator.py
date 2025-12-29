"""
Orchestrator Agent
Routes user requests to appropriate specialized agents based on intent classification
"""

import logging
import json
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import (
    BaseAgent, AgentState, AgentResponse, AgentType, agent_registry
)

logger = logging.getLogger(__name__)


class Intent(str, Enum):
    """Classified user intents"""
    FLASHCARD_CREATE = "flashcard_create"
    FLASHCARD_REVIEW = "flashcard_review"
    FLASHCARD_MANAGE = "flashcard_manage"
    
    CHAT_TUTOR = "chat_tutor"
    CHAT_EXPLAIN = "chat_explain"
    CHAT_QUESTION = "chat_question"
    
    NOTES_CREATE = "notes_create"
    NOTES_SUMMARIZE = "notes_summarize"
    NOTES_SEARCH = "notes_search"
    
    QUIZ_GENERATE = "quiz_generate"
    QUIZ_TAKE = "quiz_take"
    QUIZ_REVIEW = "quiz_review"
    
    CONVERT_PDF = "convert_pdf"
    CONVERT_MEDIA = "convert_media"
    CONVERT_URL = "convert_url"
    
    SEARCH_CONTENT = "search_content"
    SEARCH_WEB = "search_web"
    SEARCH_SEMANTIC = "search_semantic"
    
    GENERAL = "general"
    UNKNOWN = "unknown"


# Intent to Agent mapping
INTENT_AGENT_MAP: Dict[Intent, AgentType] = {
    Intent.FLASHCARD_CREATE: AgentType.FLASHCARD,
    Intent.FLASHCARD_REVIEW: AgentType.FLASHCARD,
    Intent.FLASHCARD_MANAGE: AgentType.FLASHCARD,
    
    Intent.CHAT_TUTOR: AgentType.CHAT,
    Intent.CHAT_EXPLAIN: AgentType.CHAT,
    Intent.CHAT_QUESTION: AgentType.CHAT,
    
    Intent.NOTES_CREATE: AgentType.NOTES,
    Intent.NOTES_SUMMARIZE: AgentType.NOTES,
    Intent.NOTES_SEARCH: AgentType.NOTES,
    
    Intent.QUIZ_GENERATE: AgentType.QUIZ,
    Intent.QUIZ_TAKE: AgentType.QUIZ,
    Intent.QUIZ_REVIEW: AgentType.QUIZ,
    
    Intent.CONVERT_PDF: AgentType.CONVERSION,
    Intent.CONVERT_MEDIA: AgentType.CONVERSION,
    Intent.CONVERT_URL: AgentType.CONVERSION,
    
    Intent.SEARCH_CONTENT: AgentType.SEARCH,
    Intent.SEARCH_WEB: AgentType.SEARCHHUB,
    Intent.SEARCH_SEMANTIC: AgentType.SEARCH,
    
    Intent.GENERAL: AgentType.CHAT,
    Intent.UNKNOWN: AgentType.CHAT,
}


class IntentClassifier:
    """
    Classifies user intent using LLM with fallback to rule-based classification
    """
    
    INTENT_KEYWORDS = {
        Intent.FLASHCARD_CREATE: [
            "create flashcard", "make flashcard", "generate flashcard", 
            "new flashcard", "flashcard from", "cards from"
        ],
        Intent.FLASHCARD_REVIEW: [
            "review flashcard", "study flashcard", "practice flashcard",
            "quiz me", "test me on flashcard"
        ],
        Intent.QUIZ_GENERATE: [
            "create quiz", "make quiz", "generate quiz", "quiz on",
            "test on", "questions about", "practice questions"
        ],
        Intent.NOTES_CREATE: [
            "create note", "make note", "new note", "write note",
            "take notes", "note this"
        ],
        Intent.NOTES_SUMMARIZE: [
            "summarize", "summary", "key points", "main ideas",
            "tldr", "brief overview"
        ],
        Intent.CONVERT_PDF: [
            "convert pdf", "from pdf", "pdf to", "extract from pdf",
            "read pdf", "analyze pdf"
        ],
        Intent.CONVERT_MEDIA: [
            "from video", "from youtube", "transcribe", "from audio",
            "convert video", "extract from video"
        ],
        Intent.SEARCH_CONTENT: [
            "search", "find", "look for", "where is", "show me"
        ],
        Intent.CHAT_EXPLAIN: [
            "explain", "what is", "how does", "why does", "tell me about",
            "describe", "define", "meaning of"
        ],
        Intent.CHAT_QUESTION: [
            "solve", "calculate", "help me with", "how to", "can you"
        ],
    }
    
    def __init__(self, ai_client: Any):
        self.ai_client = ai_client
    
    async def classify(self, user_input: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Classify user intent"""
        # Try rule-based first for speed
        rule_result = self._rule_based_classify(user_input)
        if rule_result["confidence"] > 0.8:
            return rule_result
        
        # Use LLM for complex cases
        llm_result = await self._llm_classify(user_input, context)
        
        # Combine results
        if llm_result["confidence"] > rule_result["confidence"]:
            return llm_result
        return rule_result

    def _rule_based_classify(self, user_input: str) -> Dict[str, Any]:
        """Fast rule-based intent classification"""
        input_lower = user_input.lower()
        
        best_intent = Intent.GENERAL
        best_score = 0.0
        matched_keywords = []
        
        for intent, keywords in self.INTENT_KEYWORDS.items():
            score = 0
            matches = []
            for keyword in keywords:
                if keyword in input_lower:
                    score += len(keyword.split())  # Weight by phrase length
                    matches.append(keyword)
            
            if score > best_score:
                best_score = score
                best_intent = intent
                matched_keywords = matches
        
        # Normalize confidence
        confidence = min(1.0, best_score / 5.0) if best_score > 0 else 0.3
        
        return {
            "intent": best_intent,
            "confidence": confidence,
            "method": "rule_based",
            "matched_keywords": matched_keywords,
            "sub_intents": []
        }
    
    async def _llm_classify(self, user_input: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """LLM-based intent classification for complex queries"""
        intent_list = [i.value for i in Intent]
        
        prompt = f"""Classify the user's intent into one of these categories:
{json.dumps(intent_list, indent=2)}

User input: "{user_input}"

Context: {json.dumps(context or {}, indent=2)}

Respond with JSON only:
{{"intent": "<intent>", "confidence": <0.0-1.0>, "sub_intents": ["<optional secondary intents>"], "reasoning": "<brief explanation>"}}
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=200, temperature=0.1)
            
            # Parse JSON from response
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            result = json.loads(json_str)
            
            # Validate intent
            intent_str = result.get("intent", "general")
            try:
                intent = Intent(intent_str)
            except ValueError:
                intent = Intent.GENERAL
            
            return {
                "intent": intent,
                "confidence": float(result.get("confidence", 0.5)),
                "method": "llm",
                "sub_intents": [Intent(i) for i in result.get("sub_intents", []) if i in intent_list],
                "reasoning": result.get("reasoning", "")
            }
            
        except Exception as e:
            logger.error(f"LLM classification failed: {e}")
            return {
                "intent": Intent.GENERAL,
                "confidence": 0.3,
                "method": "llm_fallback",
                "sub_intents": [],
                "error": str(e)
            }


class OrchestratorAgent(BaseAgent):
    """
    Main orchestrator that routes requests to specialized agents
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.intent_classifier = IntentClassifier(ai_client)
        super().__init__(
            agent_type=AgentType.ORCHESTRATOR,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer
        )
    
    def _build_graph(self) -> None:
        """Build the orchestrator graph"""
        graph = StateGraph(AgentState)
        
        # Add nodes
        graph.add_node("validate", self._validate_input)
        graph.add_node("classify_intent", self._classify_intent)
        graph.add_node("enrich_context", self.enrich_with_knowledge)
        graph.add_node("select_agents", self._select_agents)
        graph.add_node("execute_agents", self._execute_agents)
        graph.add_node("aggregate_results", self._aggregate_results)
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("validate")
        
        # Add edges
        graph.add_conditional_edges(
            "validate",
            self._should_handle_error,
            {"handle_error": "handle_error", "continue": "classify_intent"}
        )
        graph.add_edge("classify_intent", "enrich_context")
        graph.add_edge("enrich_context", "select_agents")
        graph.add_edge("select_agents", "execute_agents")
        graph.add_edge("execute_agents", "aggregate_results")
        graph.add_edge("aggregate_results", "format_response")
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        logger.info("Orchestrator graph compiled successfully")
    
    async def _classify_intent(self, state: AgentState) -> AgentState:
        """Classify user intent"""
        user_input = state.get("user_input", "")
        context = {
            "user_profile": state.get("user_profile", {}),
            "attachments": state.get("attachments", [])
        }
        
        classification = await self.intent_classifier.classify(user_input, context)
        
        state["intent"] = classification["intent"].value
        state["sub_intents"] = [i.value for i in classification.get("sub_intents", [])]
        state["confidence"] = classification["confidence"]
        state["execution_path"] = state.get("execution_path", []) + ["orchestrator:classify"]
        
        logger.info(f"Classified intent: {state['intent']} (confidence: {state['confidence']:.2f})")
        
        return state

    async def _select_agents(self, state: AgentState) -> AgentState:
        """Select which agents to invoke based on intent"""
        intent_str = state.get("intent", "general")
        sub_intents = state.get("sub_intents", [])
        
        try:
            intent = Intent(intent_str)
        except ValueError:
            intent = Intent.GENERAL
        
        # Primary agent
        primary_agent = INTENT_AGENT_MAP.get(intent, AgentType.CHAT)
        selected = [primary_agent.value]
        
        # Add agents for sub-intents
        for sub_intent_str in sub_intents:
            try:
                sub_intent = Intent(sub_intent_str)
                sub_agent = INTENT_AGENT_MAP.get(sub_intent)
                if sub_agent and sub_agent.value not in selected:
                    selected.append(sub_agent.value)
            except ValueError:
                continue
        
        state["selected_agents"] = selected
        state["current_agent"] = selected[0] if selected else AgentType.CHAT.value
        state["execution_path"] = state.get("execution_path", []) + [f"orchestrator:select:{','.join(selected)}"]
        
        logger.info(f"Selected agents: {selected}")
        
        return state
    
    async def _execute_agents(self, state: AgentState) -> AgentState:
        """Execute selected agents"""
        selected_agents = state.get("selected_agents", [])
        results = {}
        agent_chain = []
        
        for agent_name in selected_agents:
            try:
                agent_type = AgentType(agent_name)
                agent = agent_registry.get(agent_type)
                
                if agent:
                    logger.info(f"Executing agent: {agent_name}")
                    response = await agent.invoke(state)
                    results[agent_name] = response.to_dict()
                    agent_chain.append(agent_name)
                else:
                    logger.warning(f"Agent not registered: {agent_name}")
                    # Fallback to chat agent for unregistered agents
                    results[agent_name] = {
                        "success": False,
                        "response": "",
                        "error": f"Agent {agent_name} not available"
                    }
                    
            except Exception as e:
                logger.error(f"Error executing agent {agent_name}: {e}")
                results[agent_name] = {
                    "success": False,
                    "response": "",
                    "error": str(e)
                }
        
        state["intermediate_results"] = results
        state["agent_chain"] = agent_chain
        state["execution_path"] = state.get("execution_path", []) + ["orchestrator:execute"]
        
        return state
    
    async def _aggregate_results(self, state: AgentState) -> AgentState:
        """Aggregate results from multiple agents"""
        results = state.get("intermediate_results", {})
        
        # Find the best successful response
        best_response = None
        best_confidence = 0.0
        all_suggestions = []
        all_knowledge_updates = []
        
        for agent_name, result in results.items():
            if result.get("success"):
                confidence = result.get("confidence", 0.5)
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_response = result.get("response", "")
                
                all_suggestions.extend(result.get("suggested_followups", []))
                all_knowledge_updates.extend(result.get("knowledge_updates", []))
        
        # If no successful response, create a fallback
        if not best_response:
            best_response = await self._generate_fallback_response(state)
        
        state["final_response"] = best_response
        state["suggested_followups"] = list(set(all_suggestions))[:5]
        state["knowledge_updates"] = all_knowledge_updates
        state["confidence"] = best_confidence
        
        return state

    async def _generate_fallback_response(self, state: AgentState) -> str:
        """Generate a fallback response when agents fail"""
        user_input = state.get("user_input", "")
        user_profile = state.get("user_profile", {})
        
        prompt = f"""You are a helpful AI tutor. The user asked: "{user_input}"

User profile: {json.dumps(user_profile, indent=2)}

Provide a helpful, educational response. If you can't fully answer, suggest what the user could do instead.
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
            return response
        except Exception as e:
            logger.error(f"Fallback generation failed: {e}")
            return "I apologize, but I'm having trouble processing your request. Please try rephrasing or try again later."
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process input - delegated to specialized agents"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Core logic - handled by _execute_agents"""
        return state
    
    async def _format_response(self, state: AgentState) -> AgentState:
        """Format the final response"""
        response = state.get("final_response", "")
        
        state["response_metadata"] = {
            "success": bool(response),
            "intent": state.get("intent"),
            "confidence": state.get("confidence", 0.0),
            "agents_used": state.get("agent_chain", []),
            "execution_path": state.get("execution_path", []),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return state


def create_orchestrator(
    ai_client: Any,
    knowledge_graph: Optional[Any] = None
) -> OrchestratorAgent:
    """Factory function to create and register the orchestrator"""
    orchestrator = OrchestratorAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph
    )
    agent_registry.register(orchestrator)
    return orchestrator
