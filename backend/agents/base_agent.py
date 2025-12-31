"""
Base Agent Class for LangGraph-based Agent System
Provides common functionality for all specialized agents
"""

import logging
from abc import ABC, abstractmethod
from typing import TypedDict, Dict, Any, List, Optional, Literal
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    """Types of agents in the system"""
    ORCHESTRATOR = "orchestrator"
    FLASHCARD = "flashcard"
    CHAT = "chat"
    NOTES = "notes"
    QUIZ = "quiz"
    SEARCH = "search"
    CONVERSION = "conversion"
    SEARCHHUB = "searchhub"
    MEDIA = "media"
    STUDY_PLAN = "study_plan"
    GAMIFICATION = "gamification"


class AgentState(TypedDict, total=False):
    """Base state shared across all agents"""
    # Request context
    user_id: str
    session_id: str
    request_id: str
    timestamp: str
    
    # Input
    user_input: str
    input_type: str  # text, file, url, etc.
    attachments: List[Dict[str, Any]]
    
    # Knowledge graph context
    knowledge_context: Dict[str, Any]
    related_concepts: List[str]
    user_mastery: Dict[str, float]
    
    # User profile
    user_profile: Dict[str, Any]
    learning_style: str
    difficulty_level: str
    
    # Processing state
    intent: str
    sub_intents: List[str]
    confidence: float
    
    # Agent routing
    selected_agents: List[str]
    current_agent: str
    agent_chain: List[str]
    
    # Results
    intermediate_results: Dict[str, Any]
    final_response: str
    response_metadata: Dict[str, Any]
    
    # Error handling
    errors: List[str]
    warnings: List[str]
    
    # Tracing
    trace_id: str
    execution_path: List[str]


@dataclass
class AgentResponse:
    """Standardized response from any agent"""
    success: bool
    response: str
    agent_type: AgentType
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    knowledge_updates: List[Dict[str, Any]] = field(default_factory=list)
    suggested_followups: List[str] = field(default_factory=list)
    execution_time_ms: float = 0.0
    tokens_used: int = 0
    errors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "response": self.response,
            "agent_type": self.agent_type.value,
            "confidence": self.confidence,
            "metadata": self.metadata,
            "knowledge_updates": self.knowledge_updates,
            "suggested_followups": self.suggested_followups,
            "execution_time_ms": self.execution_time_ms,
            "tokens_used": self.tokens_used,
            "errors": self.errors
        }


class BaseAgent(ABC):
    """
    Abstract base class for all LangGraph agents.
    Provides common functionality and enforces consistent interface.
    """
    
    def __init__(
        self,
        agent_type: AgentType,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.agent_type = agent_type
        self.ai_client = ai_client
        self.knowledge_graph = knowledge_graph
        self.checkpointer = checkpointer or MemorySaver()
        self.graph: Optional[StateGraph] = None
        self.compiled_graph = None
        
        logger.info(f"Initializing {agent_type.value} agent")
        self._build_graph()
    
    @abstractmethod
    def _build_graph(self) -> None:
        """Build the LangGraph state machine for this agent"""
        pass
    
    @abstractmethod
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process and validate input"""
        pass
    
    @abstractmethod
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute the main agent logic"""
        pass
    
    @abstractmethod
    async def _format_response(self, state: AgentState) -> AgentState:
        """Format the final response"""
        pass
    
    async def enrich_with_knowledge(self, state: AgentState) -> AgentState:
        """Enrich state with knowledge graph context"""
        if not self.knowledge_graph:
            return state
        
        try:
            user_id = state.get("user_id")
            user_input = state.get("user_input", "")
            
            # Get related concepts from knowledge graph
            concepts = await self.knowledge_graph.get_related_concepts(user_input)
            state["related_concepts"] = concepts
            
            # Get user's mastery levels for these concepts
            if user_id:
                mastery = await self.knowledge_graph.get_user_mastery(user_id, concepts)
                state["user_mastery"] = mastery
            
            # Get broader knowledge context
            context = await self.knowledge_graph.get_context(user_input, user_id)
            state["knowledge_context"] = context
            
            logger.debug(f"Enriched state with {len(concepts)} related concepts")
            
        except Exception as e:
            logger.error(f"Error enriching with knowledge graph: {e}")
            state["warnings"] = state.get("warnings", []) + [f"Knowledge enrichment failed: {str(e)}"]
        
        return state
    
    async def update_knowledge_graph(self, state: AgentState, updates: List[Dict[str, Any]]) -> None:
        """Update knowledge graph with new information"""
        if not self.knowledge_graph:
            return
        
        try:
            for update in updates:
                await self.knowledge_graph.add_or_update(update)
            logger.debug(f"Applied {len(updates)} knowledge graph updates")
        except Exception as e:
            logger.error(f"Error updating knowledge graph: {e}")
    
    def _create_base_graph(self) -> StateGraph:
        """Create base graph structure common to all agents"""
        graph = StateGraph(AgentState)
        
        # Common nodes
        graph.add_node("validate_input", self._validate_input)
        graph.add_node("enrich_knowledge", self.enrich_with_knowledge)
        graph.add_node("process_input", self._process_input)
        graph.add_node("execute", self._execute_core_logic)
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        return graph
    
    async def _validate_input(self, state: AgentState) -> AgentState:
        """Validate input state"""
        errors = []
        
        if not state.get("user_input") and not state.get("attachments"):
            errors.append("No input provided")
        
        if not state.get("user_id"):
            errors.append("User ID is required")
        
        if errors:
            state["errors"] = state.get("errors", []) + errors
        
        # Add execution tracking
        state["execution_path"] = state.get("execution_path", []) + [f"{self.agent_type.value}:validate"]
        state["timestamp"] = datetime.utcnow().isoformat()
        
        return state
    
    async def _handle_error(self, state: AgentState) -> AgentState:
        """Handle errors gracefully"""
        errors = state.get("errors", [])
        
        error_response = f"I encountered some issues: {'; '.join(errors)}. Please try again or rephrase your request."
        
        state["final_response"] = error_response
        state["response_metadata"] = {
            "success": False,
            "errors": errors,
            "agent": self.agent_type.value
        }
        
        return state
    
    def _should_handle_error(self, state: AgentState) -> Literal["handle_error", "continue"]:
        """Conditional edge to check for errors"""
        if state.get("errors"):
            return "handle_error"
        return "continue"
    
    async def invoke(self, state: AgentState, config: Optional[Dict] = None) -> AgentResponse:
        """Execute the agent graph"""
        import time
        start_time = time.time()
        
        try:
            if not self.compiled_graph:
                raise RuntimeError(f"{self.agent_type.value} agent graph not compiled")
            
            # Run the graph
            config = config or {}
            if self.checkpointer:
                config["configurable"] = config.get("configurable", {})
                config["configurable"]["thread_id"] = state.get("session_id", "default")
            
            result = await self.compiled_graph.ainvoke(state, config)
            
            execution_time = (time.time() - start_time) * 1000
            
            # Include response_data in metadata for downstream use
            metadata = result.get("response_metadata", {})
            if result.get("response_data"):
                metadata["response_data"] = result.get("response_data")
            
            return AgentResponse(
                success=not result.get("errors"),
                response=result.get("final_response", ""),
                agent_type=self.agent_type,
                confidence=result.get("confidence", 0.0),
                metadata=metadata,
                knowledge_updates=result.get("knowledge_updates", []),
                suggested_followups=result.get("suggested_followups", []),
                execution_time_ms=execution_time,
                errors=result.get("errors", [])
            )
            
        except Exception as e:
            logger.error(f"Agent {self.agent_type.value} execution failed: {e}")
            return AgentResponse(
                success=False,
                response=f"An error occurred: {str(e)}",
                agent_type=self.agent_type,
                errors=[str(e)],
                execution_time_ms=(time.time() - start_time) * 1000
            )
    
    def get_graph_visualization(self) -> str:
        """Get Mermaid diagram of the agent graph"""
        if self.compiled_graph:
            return self.compiled_graph.get_graph().draw_mermaid()
        return ""


class AgentRegistry:
    """Registry for managing agent instances"""
    
    _instance = None
    _agents: Dict[AgentType, BaseAgent] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def register(self, agent: BaseAgent) -> None:
        """Register an agent"""
        self._agents[agent.agent_type] = agent
        logger.info(f"Registered agent: {agent.agent_type.value}")
    
    def get(self, agent_type: AgentType) -> Optional[BaseAgent]:
        """Get an agent by type"""
        return self._agents.get(agent_type)
    
    def get_all(self) -> Dict[AgentType, BaseAgent]:
        """Get all registered agents"""
        return self._agents.copy()
    
    def unregister(self, agent_type: AgentType) -> None:
        """Unregister an agent"""
        if agent_type in self._agents:
            del self._agents[agent_type]
            logger.info(f"Unregistered agent: {agent_type.value}")


# Global registry instance
agent_registry = AgentRegistry()



