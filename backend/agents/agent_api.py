"""
Agent System API Endpoints
FastAPI routes for the LangGraph agent system
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel

from .base_agent import AgentState, AgentType, agent_registry
from .orchestrator import OrchestratorAgent, create_orchestrator, Intent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ==================== Request/Response Models ====================

class AgentRequest(BaseModel):
    """Request to invoke an agent"""
    user_id: str
    user_input: str
    session_id: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = []
    context: Optional[Dict[str, Any]] = {}


class AgentResponse(BaseModel):
    """Response from agent invocation"""
    success: bool
    response: str
    intent: Optional[str] = None
    confidence: float = 0.0
    agents_used: List[str] = []
    suggested_followups: List[str] = []
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}


class IntentClassifyRequest(BaseModel):
    """Request to classify intent only"""
    user_input: str
    context: Optional[Dict[str, Any]] = {}


class IntentClassifyResponse(BaseModel):
    """Response from intent classification"""
    intent: str
    confidence: float
    sub_intents: List[str] = []
    method: str = ""


# ==================== Global State ====================

_orchestrator: Optional[OrchestratorAgent] = None
_knowledge_graph = None


def get_orchestrator() -> OrchestratorAgent:
    """Get the orchestrator instance"""
    if _orchestrator is None:
        raise HTTPException(status_code=503, detail="Agent system not initialized")
    return _orchestrator


# ==================== Initialization ====================

async def initialize_agent_system(ai_client: Any, knowledge_graph: Any = None):
    """Initialize the agent system"""
    global _orchestrator, _knowledge_graph
    
    logger.info("Initializing agent system...")
    
    _knowledge_graph = knowledge_graph
    _orchestrator = create_orchestrator(ai_client, knowledge_graph)
    
    logger.info("Agent system initialized successfully")
    return _orchestrator


# ==================== API Endpoints ====================

@router.post("/invoke", response_model=AgentResponse)
async def invoke_agent(request: AgentRequest):
    """
    Main endpoint to invoke the agent system.
    The orchestrator will classify intent and route to appropriate agents.
    """
    orchestrator = get_orchestrator()
    
    # Build initial state
    state: AgentState = {
        "user_id": request.user_id,
        "user_input": request.user_input,
        "session_id": request.session_id or f"session_{request.user_id}_{datetime.utcnow().timestamp()}",
        "attachments": request.attachments or [],
        "user_profile": request.context.get("user_profile", {}),
        "timestamp": datetime.utcnow().isoformat(),
        "errors": [],
        "warnings": [],
        "execution_path": []
    }
    
    # Invoke orchestrator
    result = await orchestrator.invoke(state)
    
    return AgentResponse(
        success=result.success,
        response=result.response,
        intent=result.metadata.get("intent"),
        confidence=result.confidence,
        agents_used=result.metadata.get("agents_used", []),
        suggested_followups=result.suggested_followups,
        execution_time_ms=result.execution_time_ms,
        metadata=result.metadata
    )


@router.post("/classify", response_model=IntentClassifyResponse)
async def classify_intent(request: IntentClassifyRequest):
    """
    Classify user intent without executing agents.
    Useful for UI hints and pre-processing.
    """
    orchestrator = get_orchestrator()
    
    result = await orchestrator.intent_classifier.classify(
        request.user_input,
        request.context
    )
    
    return IntentClassifyResponse(
        intent=result["intent"].value,
        confidence=result["confidence"],
        sub_intents=[i.value for i in result.get("sub_intents", [])],
        method=result.get("method", "")
    )


@router.get("/status")
async def get_agent_status():
    """Get status of the agent system"""
    registered = agent_registry.get_all()
    
    return {
        "status": "healthy" if _orchestrator else "not_initialized",
        "registered_agents": [a.value for a in registered.keys()],
        "knowledge_graph_connected": _knowledge_graph is not None,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/intents")
async def list_intents():
    """List all available intents"""
    return {
        "intents": [
            {
                "name": intent.value,
                "agent": INTENT_AGENT_MAP.get(intent, AgentType.CHAT).value
            }
            for intent in Intent
        ]
    }


# Import for the intents endpoint
from .orchestrator import INTENT_AGENT_MAP
