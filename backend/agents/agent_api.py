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
from .intelligent_orchestrator import IntelligentOrchestrator, create_intelligent_orchestrator

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

_orchestrator: Optional[IntelligentOrchestrator] = None
_knowledge_graph = None
_db_session_factory = None


def get_orchestrator() -> IntelligentOrchestrator:
    """Get the orchestrator instance"""
    if _orchestrator is None:
        raise HTTPException(status_code=503, detail="Agent system not initialized")
    return _orchestrator


# ==================== Initialization ====================

async def initialize_agent_system(ai_client: Any, knowledge_graph: Any = None, db_session_factory: Any = None):
    """Initialize the intelligent agent system"""
    global _orchestrator, _knowledge_graph, _db_session_factory
    
    logger.info("Initializing intelligent agent system...")
    
    _knowledge_graph = knowledge_graph
    _db_session_factory = db_session_factory
    
    _orchestrator = create_intelligent_orchestrator(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory
    )
    
    logger.info("Intelligent agent system initialized successfully")
    return _orchestrator


# ==================== API Endpoints ====================

@router.post("/invoke", response_model=AgentResponse)
async def invoke_agent(request: AgentRequest):
    """
    Main endpoint to invoke the intelligent agent system.
    Uses ReAct reasoning, tool calling, and self-reflection.
    """
    orchestrator = get_orchestrator()
    
    # Build initial state
    state = {
        "user_id": request.user_id,
        "user_input": request.user_input,
        "session_id": request.session_id or f"session_{request.user_id}_{datetime.utcnow().timestamp()}",
        "attachments": request.attachments or [],
        "user_profile": request.context.get("user_profile", {}),
        "learning_style": request.context.get("learning_style", "mixed"),
        "difficulty_level": request.context.get("difficulty_level", "intermediate"),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Invoke intelligent orchestrator
    result = await orchestrator.invoke(state)
    
    return AgentResponse(
        success=result.success,
        response=result.response,
        intent=result.metadata.get("intent"),
        confidence=result.confidence,
        agents_used=result.metadata.get("tools_used", []),
        suggested_followups=result.suggested_followups,
        execution_time_ms=result.execution_time_ms,
        metadata=result.metadata
    )


@router.post("/classify", response_model=IntentClassifyResponse)
async def classify_intent(request: IntentClassifyRequest):
    """
    Classify user intent and decompose into tasks.
    Useful for UI hints and pre-processing.
    """
    orchestrator = get_orchestrator()
    
    # Use the AI client directly for classification
    prompt = f"""Classify this user request into one of these intents:
- flashcard_create, flashcard_review
- chat_explain, chat_question
- notes_create, notes_summarize
- quiz_generate, quiz_take
- search_content
- general

User input: "{request.user_input}"

Return JSON: {{"intent": "...", "confidence": 0.0-1.0, "sub_intents": []}}
"""
    
    try:
        import json
        response = orchestrator.ai_client.generate(prompt, max_tokens=100, temperature=0.1)
        
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        result = json.loads(json_str)
        
        return IntentClassifyResponse(
            intent=result.get("intent", "general"),
            confidence=result.get("confidence", 0.5),
            sub_intents=result.get("sub_intents", []),
            method="llm"
        )
    except Exception as e:
        return IntentClassifyResponse(
            intent="general",
            confidence=0.3,
            sub_intents=[],
            method="fallback"
        )


@router.get("/status")
async def get_agent_status():
    """Get status of the intelligent agent system"""
    return {
        "status": "healthy" if _orchestrator else "not_initialized",
        "type": "intelligent_orchestrator",
        "capabilities": [
            "react_reasoning",
            "tool_calling", 
            "self_reflection",
            "task_decomposition",
            "knowledge_graph_integration"
        ],
        "tools_available": len(_orchestrator.all_tools) if _orchestrator else 0,
        "knowledge_graph_connected": _knowledge_graph is not None,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/intents")
async def list_intents():
    """List all available intents"""
    intents = [
        {"name": "flashcard_create", "description": "Create flashcards from content"},
        {"name": "flashcard_review", "description": "Review existing flashcards"},
        {"name": "chat_explain", "description": "Explain a concept"},
        {"name": "chat_question", "description": "Answer a question"},
        {"name": "notes_create", "description": "Create notes"},
        {"name": "notes_summarize", "description": "Summarize content"},
        {"name": "quiz_generate", "description": "Generate quiz questions"},
        {"name": "quiz_take", "description": "Take a quiz"},
        {"name": "search_content", "description": "Search user content"},
        {"name": "general", "description": "General assistance"}
    ]
    return {"intents": intents}


@router.get("/tools")
async def list_tools():
    """List all available tools"""
    if not _orchestrator:
        return {"tools": []}
    
    return {
        "tools": [
            {"name": tool.name, "description": tool.description}
            for tool in _orchestrator.all_tools
        ]
    }
