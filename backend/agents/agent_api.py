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
from .chat_agent import ChatAgent, create_chat_agent, ChatMode, ResponseStyle
from .flashcard_agent import FlashcardAgent, create_flashcard_agent, FlashcardAction

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


class ChatAgentRequest(BaseModel):
    """Request for the advanced chat agent"""
    user_id: str
    message: str
    session_id: Optional[str] = None
    chat_mode: Optional[str] = None  # tutoring, socratic, explanation, etc.
    response_style: Optional[str] = None  # concise, detailed, step_by_step, etc.
    context: Optional[Dict[str, Any]] = {}


class ChatAgentResponse(BaseModel):
    """Response from the chat agent"""
    success: bool
    response: str
    chat_mode: str
    response_style: str
    emotional_state: str
    quality_score: float
    concepts_discussed: List[str] = []
    suggested_questions: List[str] = []
    learning_actions: List[Dict[str, Any]] = []
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}


class FlashcardAgentRequest(BaseModel):
    """Request for the flashcard agent"""
    user_id: str
    action: str  # generate, review, analyze, recommend, explain
    topic: Optional[str] = None
    content: Optional[str] = None
    card_count: int = 10
    difficulty: str = "medium"
    review_results: Optional[List[Dict[str, Any]]] = None
    session_id: Optional[str] = None


class FlashcardAgentResponse(BaseModel):
    """Response from the flashcard agent"""
    success: bool
    action: str
    response: str
    cards: Optional[List[Dict[str, str]]] = None
    session_stats: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[Dict[str, Any]]] = None
    analysis: Optional[Dict[str, Any]] = None
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}


# ==================== Global State ====================

_orchestrator: Optional[IntelligentOrchestrator] = None
_chat_agent: Optional[ChatAgent] = None
_flashcard_agent: Optional[FlashcardAgent] = None
_knowledge_graph = None
_db_session_factory = None
_memory_manager = None


def get_orchestrator() -> IntelligentOrchestrator:
    """Get the orchestrator instance"""
    if _orchestrator is None:
        raise HTTPException(status_code=503, detail="Agent system not initialized")
    return _orchestrator


def get_chat_agent() -> ChatAgent:
    """Get the chat agent instance"""
    if _chat_agent is None:
        raise HTTPException(status_code=503, detail="Chat agent not initialized")
    return _chat_agent


def get_flashcard_agent() -> FlashcardAgent:
    """Get the flashcard agent instance"""
    if _flashcard_agent is None:
        raise HTTPException(status_code=503, detail="Flashcard agent not initialized")
    return _flashcard_agent


def get_memory():
    """Get the memory manager instance"""
    from .memory import get_memory_manager
    return get_memory_manager()


# ==================== Initialization ====================

async def initialize_agent_system(ai_client: Any, knowledge_graph: Any = None, db_session_factory: Any = None):
    """Initialize the intelligent agent system with unified memory"""
    global _orchestrator, _chat_agent, _flashcard_agent, _knowledge_graph, _db_session_factory, _memory_manager
    
    logger.info("Initializing intelligent agent system with unified memory...")
    
    _knowledge_graph = knowledge_graph
    _db_session_factory = db_session_factory
    
    # Initialize Memory Manager first (the brain above all agents)
    from .memory import initialize_memory_manager
    _memory_manager = await initialize_memory_manager(
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory
    )
    logger.info("✅ Unified Memory Manager initialized")
    
    # Initialize the Advanced Chat Agent
    _chat_agent = create_chat_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager
    )
    logger.info("✅ Advanced Chat Agent initialized")
    
    # Initialize the Flashcard Agent
    _flashcard_agent = create_flashcard_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    logger.info("✅ Flashcard Agent initialized")
    
    # Initialize orchestrator with memory manager
    _orchestrator = create_intelligent_orchestrator(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory,
        memory_manager=_memory_manager
    )
    
    logger.info("✅ Intelligent agent system initialized with unified memory")
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


# ==================== Chat Agent API Endpoints ====================

@router.post("/chat", response_model=ChatAgentResponse)
async def chat_with_agent(request: ChatAgentRequest):
    """
    Main endpoint for the advanced AI chat agent.
    Provides intelligent tutoring with:
    - Emotional intelligence
    - Adaptive response styles
    - Memory-aware context
    - Self-reflection and improvement
    """
    import time
    start_time = time.time()
    
    chat_agent = get_chat_agent()
    
    # Build initial state
    state = {
        "user_id": request.user_id,
        "user_input": request.message,
        "session_id": request.session_id or f"chat_{request.user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Add optional mode/style if specified
    if request.chat_mode:
        state["chat_mode"] = request.chat_mode
    if request.response_style:
        state["response_style"] = request.response_style
    
    # Add any additional context
    if request.context:
        state["user_preferences"] = request.context.get("user_preferences", {})
    
    try:
        # Invoke the chat agent
        result = await chat_agent.invoke(state)
        
        execution_time = (time.time() - start_time) * 1000
        
        return ChatAgentResponse(
            success=result.success,
            response=result.response,
            chat_mode=result.metadata.get("chat_mode", "tutoring"),
            response_style=result.metadata.get("response_style", "conversational"),
            emotional_state=result.metadata.get("emotional_state", "neutral"),
            quality_score=result.metadata.get("quality_score", 0.7),
            concepts_discussed=result.metadata.get("concepts_discussed", []),
            suggested_questions=result.metadata.get("suggested_questions", []),
            learning_actions=result.metadata.get("learning_actions", []),
            execution_time_ms=execution_time,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Chat agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/modes")
async def list_chat_modes():
    """List available chat modes"""
    return {
        "modes": [
            {"name": "tutoring", "description": "Standard tutoring - clear, educational responses"},
            {"name": "socratic", "description": "Socratic method - guide through questions"},
            {"name": "explanation", "description": "Deep explanations - thorough breakdowns"},
            {"name": "practice", "description": "Practice mode - problems and exercises"},
            {"name": "review", "description": "Review mode - reinforce learning"},
            {"name": "exploration", "description": "Exploration - encourage curiosity"},
            {"name": "debugging", "description": "Debugging - systematic troubleshooting"},
            {"name": "brainstorm", "description": "Brainstorm - creative thinking"}
        ]
    }


@router.get("/chat/styles")
async def list_response_styles():
    """List available response styles"""
    return {
        "styles": [
            {"name": "concise", "description": "Brief and to the point"},
            {"name": "detailed", "description": "Comprehensive explanations"},
            {"name": "step_by_step", "description": "Numbered steps, methodical"},
            {"name": "visual", "description": "Structured with formatting"},
            {"name": "conversational", "description": "Warm and natural"}
        ]
    }


@router.post("/chat/analyze")
async def analyze_message(
    message: str = Body(..., embed=True),
    context: Optional[Dict[str, Any]] = Body(None)
):
    """
    Analyze a message without generating a response.
    Useful for UI hints and pre-processing.
    """
    chat_agent = get_chat_agent()
    
    analysis = chat_agent.analyzer.analyze(message, context or {})
    
    return {
        "intent": analysis.intent,
        "concepts": analysis.concepts,
        "question_type": analysis.question_type,
        "emotional_state": analysis.emotional_state.value,
        "confusion_level": analysis.confusion_level,
        "engagement_level": analysis.engagement_level,
        "complexity_level": analysis.complexity_level,
        "requires_clarification": analysis.requires_clarification,
        "suggested_mode": analysis.suggested_mode.value
    }


# ==================== Memory API Endpoints ====================

@router.get("/memory/context/{user_id}")
async def get_user_context(user_id: str, query: str = "", session_id: str = None):
    """
    Get unified context for a user.
    This is what agents use to understand the user.
    """
    memory = get_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Memory system not initialized")
    
    context = await memory.get_context_for_agent(
        user_id=user_id,
        agent_type="api",
        query=query,
        session_id=session_id
    )
    
    return context


@router.get("/memory/summary/{user_id}")
async def get_learning_summary(user_id: str):
    """Get a summary of user's learning journey"""
    memory = get_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Memory system not initialized")
    
    return await memory.get_learning_summary(user_id)


@router.get("/memory/stats/{user_id}")
async def get_memory_stats(user_id: str):
    """Get memory statistics for a user"""
    memory = get_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Memory system not initialized")
    
    return memory.get_memory_stats(user_id)


@router.post("/memory/remember")
async def remember_interaction(
    user_id: str = Body(...),
    interaction_type: str = Body(...),  # conversation, flashcard, quiz, note
    data: Dict[str, Any] = Body(...)
):
    """
    Store an interaction in memory.
    Used by other parts of the app to feed the memory system.
    """
    memory = get_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Memory system not initialized")
    
    if interaction_type == "conversation":
        await memory.remember_conversation(
            user_id=user_id,
            user_message=data.get("user_message", ""),
            ai_response=data.get("ai_response", ""),
            session_id=data.get("session_id", "default"),
            topics=data.get("topics", [])
        )
    elif interaction_type == "flashcard":
        await memory.remember_flashcard_interaction(
            user_id=user_id,
            flashcard_id=data.get("flashcard_id", 0),
            front=data.get("front", ""),
            back=data.get("back", ""),
            correct=data.get("correct", False)
        )
    elif interaction_type == "quiz":
        await memory.remember_quiz_attempt(
            user_id=user_id,
            quiz_topic=data.get("topic", ""),
            score=data.get("score", 0.0),
            questions_count=data.get("questions_count", 0),
            wrong_concepts=data.get("wrong_concepts", [])
        )
    elif interaction_type == "note":
        await memory.remember_note_interaction(
            user_id=user_id,
            note_id=data.get("note_id", 0),
            title=data.get("title", ""),
            action=data.get("action", "viewed"),
            content_preview=data.get("content_preview", "")
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown interaction type: {interaction_type}")
    
    return {"status": "remembered", "type": interaction_type}


# ==================== Flashcard Agent API Endpoints ====================

@router.post("/flashcards", response_model=FlashcardAgentResponse)
async def flashcard_agent_invoke(request: FlashcardAgentRequest):
    """
    Main endpoint for the flashcard agent.
    Supports actions: generate, review, analyze, recommend, explain
    """
    import time
    start_time = time.time()
    
    flashcard_agent = get_flashcard_agent()
    
    # Build initial state
    state = {
        "user_id": request.user_id,
        "action": request.action,
        "session_id": request.session_id or f"flashcard_{request.user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "action_params": {
            "topic": request.topic,
            "card_count": request.card_count,
            "difficulty": request.difficulty
        }
    }
    
    # Add topic/content based on action
    if request.topic:
        state["topic"] = request.topic
        state["user_input"] = f"Generate flashcards about {request.topic}"
    if request.content:
        state["source_content"] = request.content
    if request.review_results:
        state["review_results"] = request.review_results
    
    try:
        # Invoke the flashcard agent
        result = await flashcard_agent.invoke(state)
        
        execution_time = (time.time() - start_time) * 1000
        
        # Extract response data
        response_data = result.metadata.get("response_data", {})
        
        return FlashcardAgentResponse(
            success=result.success,
            action=request.action,
            response=result.response,
            cards=response_data.get("cards"),
            session_stats=response_data.get("session_stats"),
            recommendations=response_data.get("recommendations"),
            analysis=response_data.get("analysis"),
            execution_time_ms=execution_time,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Flashcard agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/flashcards/generate", response_model=FlashcardAgentResponse)
async def flashcard_generate(
    user_id: str = Body(...),
    topic: str = Body(None),
    content: str = Body(None),
    card_count: int = Body(10),
    difficulty: str = Body("medium"),
    session_id: str = Body(None)
):
    """Generate flashcards from topic or content using the agent"""
    request = FlashcardAgentRequest(
        user_id=user_id,
        action="generate",
        topic=topic,
        content=content,
        card_count=card_count,
        difficulty=difficulty,
        session_id=session_id
    )
    return await flashcard_agent_invoke(request)


@router.post("/flashcards/review", response_model=FlashcardAgentResponse)
async def flashcard_review(
    user_id: str = Body(...),
    review_results: List[Dict[str, Any]] = Body(...),
    session_id: str = Body(None)
):
    """Process a review session and get spaced repetition updates"""
    request = FlashcardAgentRequest(
        user_id=user_id,
        action="review",
        review_results=review_results,
        session_id=session_id
    )
    return await flashcard_agent_invoke(request)


@router.get("/flashcards/analyze")
async def flashcard_analyze(user_id: str = Query(...)):
    """Analyze flashcard performance for a user"""
    import time
    start_time = time.time()
    
    flashcard_agent = get_flashcard_agent()
    
    state = {
        "user_id": user_id,
        "action": "analyze",
        "user_input": "Analyze my flashcard performance",
        "session_id": f"analyze_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        result = await flashcard_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "analyze",
            "response": result.response,
            "analysis": response_data.get("analysis", {}),
            "insights": response_data.get("insights", []),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Flashcard analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/flashcards/recommendations")
async def flashcard_recommendations(user_id: str = Query(...)):
    """Get study recommendations for a user"""
    import time
    start_time = time.time()
    
    flashcard_agent = get_flashcard_agent()
    
    state = {
        "user_id": user_id,
        "action": "recommend",
        "user_input": "What should I study next?",
        "session_id": f"recommend_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        result = await flashcard_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "recommend",
            "response": result.response,
            "recommendations": response_data.get("recommendations", []),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Flashcard recommendations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/flashcards/explain")
async def flashcard_explain(
    user_id: str = Body(...),
    concept: str = Body(...),
    session_id: str = Body(None)
):
    """Get an explanation for a flashcard concept"""
    import time
    start_time = time.time()
    
    flashcard_agent = get_flashcard_agent()
    
    state = {
        "user_id": user_id,
        "action": "explain",
        "topic": concept,
        "user_input": f"Explain: {concept}",
        "session_id": session_id or f"explain_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        result = await flashcard_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "explain",
            "concept": concept,
            "explanation": response_data.get("explanation", result.response),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Flashcard explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
