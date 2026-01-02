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
from .note_agent import NoteAgent, create_note_agent, NoteAction, WritingTone, ContentDepth

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


class NoteAgentRequest(BaseModel):
    """Request for the note agent"""
    user_id: str
    action: str  # generate, improve, expand, simplify, summarize, continue, explain, key_points, grammar, tone_change, outline, organize, analyze, suggest, code_explain
    content: Optional[str] = None
    topic: Optional[str] = None
    tone: str = "professional"
    depth: str = "standard"
    context: Optional[str] = None
    session_id: Optional[str] = None


class NoteAgentResponse(BaseModel):
    """Response from the note agent"""
    success: bool
    action: str
    response: str
    content: Optional[str] = None
    analysis: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[Dict[str, Any]]] = None
    concepts: Optional[List[str]] = None
    word_count: int = 0
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}


# ==================== Global State ====================

_orchestrator: Optional[IntelligentOrchestrator] = None
_chat_agent: Optional[ChatAgent] = None
_flashcard_agent: Optional[FlashcardAgent] = None
_note_agent: Optional[NoteAgent] = None
_quiz_agent: Optional[Any] = None
_question_bank_agent: Optional[Any] = None
_slide_explorer_agent: Optional[Any] = None
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


def get_note_agent() -> NoteAgent:
    """Get the note agent instance"""
    if _note_agent is None:
        raise HTTPException(status_code=503, detail="Note agent not initialized")
    return _note_agent


def get_quiz_agent():
    """Get the quiz agent instance"""
    if _quiz_agent is None:
        raise HTTPException(status_code=503, detail="Quiz agent not initialized")
    return _quiz_agent


def get_question_bank_agent():
    """Get the question bank agent instance"""
    if _question_bank_agent is None:
        raise HTTPException(status_code=503, detail="Question bank agent not initialized")
    return _question_bank_agent


def get_slide_explorer_agent():
    """Get the slide explorer agent instance"""
    if _slide_explorer_agent is None:
        raise HTTPException(status_code=503, detail="Slide explorer agent not initialized")
    return _slide_explorer_agent


def get_memory():
    """Get the memory manager instance"""
    from .memory import get_memory_manager
    return get_memory_manager()


# ==================== Initialization ====================

async def initialize_agent_system(ai_client: Any, knowledge_graph: Any = None, db_session_factory: Any = None):
    """Initialize the intelligent agent system with unified memory"""
    global _orchestrator, _chat_agent, _flashcard_agent, _note_agent, _quiz_agent, _question_bank_agent, _slide_explorer_agent, _knowledge_graph, _db_session_factory, _memory_manager
    
    
    
    _knowledge_graph = knowledge_graph
    _db_session_factory = db_session_factory
    
    # Initialize Memory Manager first (the brain above all agents)
    from .memory import initialize_memory_manager
    _memory_manager = await initialize_memory_manager(
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory
    )
    
    # Initialize the Advanced Chat Agent
    _chat_agent = create_chat_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager
    )
    
    # Initialize the Flashcard Agent
    _flashcard_agent = create_flashcard_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    
    # Initialize the Note Agent
    _note_agent = create_note_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    
    # Initialize the Quiz Agent
    _quiz_agent = create_quiz_agent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    
    # Initialize the Question Bank Agent
    from .question_bank_agent import create_question_bank_agent
    _question_bank_agent = create_question_bank_agent(
        ai_client=ai_client,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    
    # Initialize the Slide Explorer Agent
    from .slide_explorer_agent import create_slide_explorer_agent
    _slide_explorer_agent = create_slide_explorer_agent(
        ai_client=ai_client,
        memory_manager=_memory_manager,
        db_session_factory=db_session_factory
    )
    
    # Initialize orchestrator with memory manager
    _orchestrator = create_intelligent_orchestrator(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory,
        memory_manager=_memory_manager
    )
    
    logger.info("✅ Question Bank Agent initialized")
    logger.info("✅ Slide Explorer Agent initialized")
    logger.info("Agent system initialized")
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
        "agents": {
            "orchestrator": _orchestrator is not None,
            "chat": _chat_agent is not None,
            "flashcard": _flashcard_agent is not None,
            "note": _note_agent is not None,
            "quiz": _quiz_agent is not None
        },
        "capabilities": [
            "react_reasoning",
            "tool_calling", 
            "self_reflection",
            "task_decomposition",
            "knowledge_graph_integration",
            "quiz_generation",
            "adaptive_testing"
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
        {"name": "quiz_grade", "description": "Grade quiz answers"},
        {"name": "quiz_analyze", "description": "Analyze quiz performance"},
        {"name": "quiz_adaptive", "description": "Generate adaptive quiz"},
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


# ==================== Note Agent API Endpoints ====================

@router.post("/notes", response_model=NoteAgentResponse)
async def note_agent_invoke(request: NoteAgentRequest):
    """
    Main endpoint for the note agent.
    Supports actions: generate, improve, expand, simplify, summarize, continue, 
    explain, key_points, grammar, tone_change, outline, organize, analyze, suggest, code_explain
    """
    import time
    start_time = time.time()
    
    note_agent = get_note_agent()
    
    # Build initial state
    state = {
        "user_id": request.user_id,
        "action": request.action,
        "session_id": request.session_id or f"note_{request.user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "tone": request.tone,
        "depth": request.depth,
        "action_params": {
            "tone": request.tone,
            "depth": request.depth,
            "content": request.content,
            "topic": request.topic,
            "context": request.context
        }
    }
    
    # Add topic/content based on action
    if request.topic:
        state["topic"] = request.topic
        state["user_input"] = f"{request.action} about {request.topic}"
    if request.content:
        state["source_content"] = request.content
    if request.context:
        state["context"] = request.context
    
    try:
        # Invoke the note agent
        result = await note_agent.invoke(state)
        
        execution_time = (time.time() - start_time) * 1000
        
        # Extract response data
        response_data = result.metadata.get("response_data", {})
        
        return NoteAgentResponse(
            success=result.success,
            action=request.action,
            response=result.response,
            content=response_data.get("content"),
            analysis=response_data.get("analysis"),
            suggestions=response_data.get("suggestions"),
            concepts=response_data.get("concepts"),
            word_count=response_data.get("word_count", 0),
            execution_time_ms=execution_time,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Note agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notes/generate", response_model=NoteAgentResponse)
async def note_generate(
    user_id: str = Body(...),
    topic: str = Body(...),
    tone: str = Body("professional"),
    depth: str = Body("standard"),
    context: str = Body(None),
    session_id: str = Body(None)
):
    """Generate note content from a topic using the agent"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="generate",
        topic=topic,
        tone=tone,
        depth=depth,
        context=context,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/improve", response_model=NoteAgentResponse)
async def note_improve(
    user_id: str = Body(...),
    content: str = Body(...),
    tone: str = Body("professional"),
    session_id: str = Body(None)
):
    """Improve existing note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="improve",
        content=content,
        tone=tone,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/expand", response_model=NoteAgentResponse)
async def note_expand(
    user_id: str = Body(...),
    content: str = Body(...),
    depth: str = Body("standard"),
    tone: str = Body("professional"),
    session_id: str = Body(None)
):
    """Expand note content with more details"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="expand",
        content=content,
        depth=depth,
        tone=tone,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/simplify", response_model=NoteAgentResponse)
async def note_simplify(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Simplify complex note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="simplify",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/summarize", response_model=NoteAgentResponse)
async def note_summarize(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Summarize note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="summarize",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/continue", response_model=NoteAgentResponse)
async def note_continue(
    user_id: str = Body(...),
    content: str = Body(...),
    tone: str = Body("professional"),
    session_id: str = Body(None)
):
    """Continue writing note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="continue",
        content=content,
        tone=tone,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/explain", response_model=NoteAgentResponse)
async def note_explain(
    user_id: str = Body(...),
    topic: str = Body(...),
    depth: str = Body("standard"),
    tone: str = Body("professional"),
    context: str = Body(None),
    session_id: str = Body(None)
):
    """Generate an explanation for a topic"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="explain",
        topic=topic,
        depth=depth,
        tone=tone,
        context=context,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/key_points", response_model=NoteAgentResponse)
async def note_key_points(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Extract key points from note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="key_points",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/grammar", response_model=NoteAgentResponse)
async def note_grammar(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Fix grammar and spelling in note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="grammar",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/tone_change", response_model=NoteAgentResponse)
async def note_tone_change(
    user_id: str = Body(...),
    content: str = Body(...),
    tone: str = Body(...),
    session_id: str = Body(None)
):
    """Change the tone of note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="tone_change",
        content=content,
        tone=tone,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/outline", response_model=NoteAgentResponse)
async def note_outline(
    user_id: str = Body(...),
    topic: str = Body(...),
    depth: str = Body("standard"),
    context: str = Body(None),
    session_id: str = Body(None)
):
    """Create an outline for a topic"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="outline",
        topic=topic,
        depth=depth,
        context=context,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/organize", response_model=NoteAgentResponse)
async def note_organize(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Organize and restructure note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="organize",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/analyze", response_model=NoteAgentResponse)
async def note_analyze(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Analyze note content for insights"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="analyze",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/suggest", response_model=NoteAgentResponse)
async def note_suggest(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Get improvement suggestions for note content"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="suggest",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.post("/notes/code_explain", response_model=NoteAgentResponse)
async def note_code_explain(
    user_id: str = Body(...),
    content: str = Body(...),
    session_id: str = Body(None)
):
    """Explain code snippets in notes"""
    request = NoteAgentRequest(
        user_id=user_id,
        action="code_explain",
        content=content,
        session_id=session_id
    )
    return await note_agent_invoke(request)


@router.get("/notes/actions")
async def list_note_actions():
    """List all available note agent actions"""
    return {
        "actions": [
            {"name": "generate", "description": "Generate new content from a topic", "requires_topic": True},
            {"name": "improve", "description": "Improve and enhance existing text", "requires_content": True},
            {"name": "expand", "description": "Expand text with more details and examples", "requires_content": True},
            {"name": "simplify", "description": "Simplify complex text for easier understanding", "requires_content": True},
            {"name": "summarize", "description": "Create a concise summary", "requires_content": True},
            {"name": "continue", "description": "Continue writing from where text ends", "requires_content": True},
            {"name": "explain", "description": "Explain a concept clearly", "requires_topic": True},
            {"name": "key_points", "description": "Extract key points from content", "requires_content": True},
            {"name": "grammar", "description": "Fix grammar and spelling errors", "requires_content": True},
            {"name": "tone_change", "description": "Change the writing tone", "requires_content": True},
            {"name": "outline", "description": "Create a structured outline", "requires_topic": True},
            {"name": "organize", "description": "Reorganize content for better structure", "requires_content": True},
            {"name": "analyze", "description": "Analyze content for insights", "requires_content": True},
            {"name": "suggest", "description": "Get improvement suggestions", "requires_content": True},
            {"name": "code_explain", "description": "Explain code snippets", "requires_content": True}
        ]
    }


@router.get("/notes/tones")
async def list_note_tones():
    """List available writing tones"""
    return {
        "tones": [
            {"name": "professional", "description": "Clear, business-appropriate language"},
            {"name": "casual", "description": "Relaxed, conversational style"},
            {"name": "academic", "description": "Formal, scholarly tone"},
            {"name": "friendly", "description": "Warm and approachable"},
            {"name": "formal", "description": "Strict, official language"},
            {"name": "creative", "description": "Imaginative and expressive"},
            {"name": "technical", "description": "Precise, specialized terminology"},
            {"name": "simple", "description": "Easy to understand, plain language"}
        ]
    }


@router.get("/notes/depths")
async def list_note_depths():
    """List available content depth levels"""
    return {
        "depths": [
            {"name": "surface", "description": "Brief overview with key facts"},
            {"name": "standard", "description": "Balanced explanation with examples"},
            {"name": "deep", "description": "Comprehensive coverage with details"},
            {"name": "expert", "description": "Advanced technical depth"}
        ]
    }


# ==================== Quiz Agent API Endpoints ====================

from .quiz_agent import QuizAgent, create_quiz_agent, QuizAction

_quiz_agent: Optional[QuizAgent] = None


def get_quiz_agent() -> QuizAgent:
    """Get the quiz agent instance"""
    if _quiz_agent is None:
        raise HTTPException(status_code=503, detail="Quiz agent not initialized")
    return _quiz_agent


class QuizAgentRequest(BaseModel):
    """Request for the quiz agent"""
    user_id: str
    action: str  # generate, grade, analyze, recommend, explain, adaptive, similar, review
    topic: Optional[str] = None
    content: Optional[str] = None
    question_count: int = 10
    difficulty: str = "medium"
    difficulty_mix: Optional[Dict[str, int]] = None
    question_types: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    questions: Optional[List[Dict[str, Any]]] = None
    answers: Optional[Dict[str, str]] = None
    results: Optional[List[Dict[str, Any]]] = None
    question: Optional[Dict[str, Any]] = None
    user_answer: Optional[str] = None
    time_taken_seconds: Optional[int] = None
    session_id: Optional[str] = None


class QuizAgentResponse(BaseModel):
    """Response from the quiz agent"""
    success: bool
    action: str
    response: str
    questions: Optional[List[Dict[str, Any]]] = None
    results: Optional[List[Dict[str, Any]]] = None
    analysis: Optional[Dict[str, Any]] = None
    recommendations: Optional[List[Dict[str, Any]]] = None
    score: Optional[float] = None
    accuracy: Optional[float] = None
    percentage: Optional[float] = None
    explanation: Optional[str] = None
    adaptive_config: Optional[Dict[str, Any]] = None
    execution_time_ms: float = 0.0
    metadata: Dict[str, Any] = {}


@router.post("/quiz", response_model=QuizAgentResponse)
async def quiz_agent_invoke(request: QuizAgentRequest):
    """
    Main endpoint for the quiz agent.
    Supports actions: generate, grade, analyze, recommend, explain, adaptive, similar, review
    """
    import time
    start_time = time.time()
    
    quiz_agent = get_quiz_agent()
    
    # Build initial state with direct field assignment
    difficulty_mix = request.difficulty_mix or {"easy": 3, "medium": 5, "hard": 2}
    logger.info(f"Quiz request - action: {request.action}, topic: {request.topic}, count: {request.question_count}, difficulty_mix: {difficulty_mix}")
    
    state = {
        "user_id": request.user_id,
        "action": request.action,
        "session_id": request.session_id or f"quiz_{request.user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        # Set fields directly at top level
        "topic": request.topic or "",
        "source_content": request.content or "",
        "question_count": request.question_count or 10,
        "difficulty": request.difficulty or "medium",
        "difficulty_mix": difficulty_mix,
        "question_types": ["multiple_choice"],  # Force MCQ only
        "topics": request.topics or [],
        "user_input": f"Generate quiz about {request.topic}" if request.topic else "",
        # Also keep action_params for backward compatibility
        "action_params": {
            "topic": request.topic,
            "content": request.content,
            "question_count": request.question_count or 10,
            "difficulty": request.difficulty,
            "difficulty_mix": difficulty_mix,
            "question_types": ["multiple_choice"],
            "topics": request.topics,
            "questions": request.questions,
            "answers": request.answers,
            "results": request.results,
            "question": request.question,
            "user_answer": request.user_answer,
            "time_taken_seconds": request.time_taken_seconds
        }
    }
    
    # Add questions/answers/results if provided
    if request.questions:
        state["generated_questions"] = request.questions
    if request.answers:
        state["user_answers"] = request.answers
    if request.results:
        state["grading_results"] = request.results
    
    logger.info(f"Quiz agent invoke: action={request.action}, topic={request.topic}, count={request.question_count}")
    
    try:
        # Invoke the quiz agent
        result = await quiz_agent.invoke(state)
        
        execution_time = (time.time() - start_time) * 1000
        
        # Extract response data
        response_data = result.metadata.get("response_data", {})
        
        return QuizAgentResponse(
            success=result.success,
            action=request.action,
            response=result.response,
            questions=response_data.get("questions"),
            results=response_data.get("results"),
            analysis=response_data.get("analysis"),
            recommendations=response_data.get("recommendations"),
            score=response_data.get("score"),
            accuracy=response_data.get("accuracy"),
            percentage=response_data.get("percentage"),
            explanation=response_data.get("explanation"),
            adaptive_config=response_data.get("adaptive_config"),
            execution_time_ms=execution_time,
            metadata=result.metadata
        )
        
    except Exception as e:
        logger.error(f"Quiz agent error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/generate", response_model=QuizAgentResponse)
async def quiz_generate(
    user_id: str = Body(...),
    topic: str = Body(...),
    content: str = Body(None),
    question_count: int = Body(10),
    difficulty_mix: Dict[str, int] = Body(None),
    question_types: List[str] = Body(None),
    topics: List[str] = Body(None),
    session_id: str = Body(None)
):
    """Generate quiz questions from topic or content"""
    request = QuizAgentRequest(
        user_id=user_id,
        action="generate",
        topic=topic,
        content=content,
        question_count=question_count,
        difficulty_mix=difficulty_mix,
        question_types=question_types,
        topics=topics,
        session_id=session_id
    )
    return await quiz_agent_invoke(request)


@router.post("/quiz/adaptive", response_model=QuizAgentResponse)
async def quiz_adaptive(
    user_id: str = Body(...),
    topic: str = Body(...),
    content: str = Body(None),
    question_count: int = Body(10),
    session_id: str = Body(None)
):
    """Generate adaptive quiz questions based on user performance"""
    request = QuizAgentRequest(
        user_id=user_id,
        action="adaptive",
        topic=topic,
        content=content,
        question_count=question_count,
        session_id=session_id
    )
    return await quiz_agent_invoke(request)


@router.post("/quiz/grade", response_model=QuizAgentResponse)
async def quiz_grade(
    user_id: str = Body(...),
    questions: List[Dict[str, Any]] = Body(...),
    answers: Dict[str, str] = Body(...),
    time_taken_seconds: int = Body(None),
    session_id: str = Body(None)
):
    """Grade quiz answers and return results"""
    request = QuizAgentRequest(
        user_id=user_id,
        action="grade",
        questions=questions,
        answers=answers,
        time_taken_seconds=time_taken_seconds,
        session_id=session_id
    )
    return await quiz_agent_invoke(request)


@router.post("/quiz/analyze", response_model=QuizAgentResponse)
async def quiz_analyze(
    user_id: str = Body(...),
    results: List[Dict[str, Any]] = Body(...),
    time_taken_seconds: int = Body(None),
    session_id: str = Body(None)
):
    """Analyze quiz performance and provide insights"""
    request = QuizAgentRequest(
        user_id=user_id,
        action="analyze",
        results=results,
        time_taken_seconds=time_taken_seconds,
        session_id=session_id
    )
    return await quiz_agent_invoke(request)


@router.get("/quiz/recommendations")
async def quiz_recommendations(
    user_id: str = Query(...),
    session_id: str = Query(None)
):
    """Get study recommendations based on quiz performance"""
    import time
    start_time = time.time()
    
    quiz_agent = get_quiz_agent()
    
    state = {
        "user_id": user_id,
        "action": "recommend",
        "user_input": "What should I study based on my quiz performance?",
        "session_id": session_id or f"recommend_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "action_params": {}
    }
    
    try:
        result = await quiz_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "recommend",
            "response": result.response,
            "recommendations": response_data.get("recommendations", []),
            "next_quiz_config": response_data.get("next_quiz_config", {}),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Quiz recommendations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/explain")
async def quiz_explain(
    user_id: str = Body(...),
    question: Dict[str, Any] = Body(...),
    user_answer: str = Body(""),
    session_id: str = Body(None)
):
    """Get detailed explanation for a quiz question"""
    import time
    start_time = time.time()
    
    quiz_agent = get_quiz_agent()
    
    state = {
        "user_id": user_id,
        "action": "explain",
        "user_input": f"Explain this question: {question.get('question_text', '')}",
        "session_id": session_id or f"explain_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "action_params": {
            "question": question,
            "user_answer": user_answer
        }
    }
    
    try:
        result = await quiz_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "explain",
            "question": response_data.get("question"),
            "explanation": response_data.get("explanation", result.response),
            "correct_answer": response_data.get("correct_answer"),
            "user_answer": response_data.get("user_answer"),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Quiz explanation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/similar")
async def quiz_similar(
    user_id: str = Body(...),
    question: Dict[str, Any] = Body(...),
    difficulty: str = Body(None),
    count: int = Body(1),
    session_id: str = Body(None)
):
    """Generate similar questions to a given question"""
    import time
    start_time = time.time()
    
    quiz_agent = get_quiz_agent()
    
    state = {
        "user_id": user_id,
        "action": "similar",
        "user_input": "Generate similar questions",
        "session_id": session_id or f"similar_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "action_params": {
            "question": question,
            "difficulty": difficulty,
            "count": count
        }
    }
    
    try:
        result = await quiz_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "similar",
            "questions": response_data.get("questions", []),
            "original_question": response_data.get("original_question"),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Similar question generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/review")
async def quiz_review(
    user_id: str = Body(...),
    results: List[Dict[str, Any]] = Body(...),
    session_id: str = Body(None)
):
    """Review wrong answers from a quiz session"""
    import time
    start_time = time.time()
    
    quiz_agent = get_quiz_agent()
    
    state = {
        "user_id": user_id,
        "action": "review",
        "user_input": "Review my wrong answers",
        "session_id": session_id or f"review_{user_id}_{datetime.utcnow().timestamp()}",
        "timestamp": datetime.utcnow().isoformat(),
        "action_params": {
            "results": results
        },
        "grading_results": results
    }
    
    try:
        result = await quiz_agent.invoke(state)
        execution_time = (time.time() - start_time) * 1000
        
        response_data = result.metadata.get("response_data", {})
        
        return {
            "success": result.success,
            "action": "review",
            "response": result.response,
            "wrong_count": response_data.get("wrong_count", 0),
            "total_questions": response_data.get("total_questions", 0),
            "review_items": response_data.get("review_items", []),
            "topics_to_review": response_data.get("topics_to_review", []),
            "execution_time_ms": execution_time
        }
    except Exception as e:
        logger.error(f"Quiz review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quiz/actions")
async def list_quiz_actions():
    """List all available quiz agent actions"""
    return {
        "actions": [
            {"name": "generate", "description": "Generate quiz questions from topic or content"},
            {"name": "adaptive", "description": "Generate adaptive questions based on user performance"},
            {"name": "grade", "description": "Grade quiz answers and calculate score"},
            {"name": "analyze", "description": "Analyze quiz performance and identify weak areas"},
            {"name": "recommend", "description": "Get study recommendations based on performance"},
            {"name": "explain", "description": "Get detailed explanation for a question"},
            {"name": "similar", "description": "Generate similar questions for practice"},
            {"name": "review", "description": "Review wrong answers from a quiz"}
        ]
    }


@router.get("/quiz/question_types")
async def list_question_types():
    """List available question types"""
    return {
        "question_types": [
            {"name": "multiple_choice", "description": "4 options with one correct answer"},
            {"name": "true_false", "description": "True or false statement"},
            {"name": "short_answer", "description": "Brief text answer (1-3 words)"},
            {"name": "fill_blank", "description": "Fill in the blank in a sentence"}
        ]
    }


@router.get("/quiz/difficulties")
async def list_difficulties():
    """List available difficulty levels"""
    return {
        "difficulties": [
            {"name": "easy", "description": "Basic recall and simple definitions"},
            {"name": "medium", "description": "Understanding concepts and making connections"},
            {"name": "hard", "description": "Analysis, synthesis, and complex problem-solving"}
        ],
        "default_mix": {"easy": 3, "medium": 5, "hard": 2}
    }



# ==================== QUESTION BANK AGENT ====================

class QuestionBankGenerateRequest(BaseModel):
    """Request to generate questions"""
    user_id: str
    action: str = "generate"
    source_type: str
    source_id: Optional[Any] = None
    sources: Optional[List[Dict[str, Any]]] = None
    content: Optional[str] = None
    title: Optional[str] = None
    question_count: int = 10
    difficulty_mix: Optional[Dict[str, int]] = None
    session_id: Optional[str] = None


@router.post("/question-bank/generate")
async def question_bank_generate(request: QuestionBankGenerateRequest):
    """Generate questions using Question Bank Agent"""
    logger.info(f"🚀 Question Bank Generate endpoint called: source_type={request.source_type}, question_count={request.question_count}")
    
    state = {
        "user_id": request.user_id,
        "action": request.action,
        "source_type": request.source_type,
        "source_id": request.source_id,
        "sources": request.sources or [],
        "content": request.content,
        "title": request.title,
        "question_count": request.question_count,
        "difficulty_mix": request.difficulty_mix or {"easy": 3, "medium": 5, "hard": 2},
        "session_id": request.session_id or f"qb_{request.user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        logger.info(f"✅ Got agent: {agent}")
        
        result = await agent.invoke(state)
        logger.info(f"✅ Agent invoke result: {result}")
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        logger.info(f"✅ Result dict: {result_dict}")
        
        # Extract response_data from metadata
        response_data = result_dict.get("metadata", {}).get("response_data", {})
        questions = response_data.get("questions", [])
        question_count_result = response_data.get("question_count", 0)
        
        logger.info(f"✅ Extracted response_data: {response_data}")
        logger.info(f"✅ Extracted {question_count_result} questions from response")
        logger.info(f"✅ Questions: {questions}")
        
        response_data_final = {
            "success": True,
            "action": "generate",
            "questions": questions,
            "question_count": question_count_result,
            "metadata": result_dict.get("metadata", {})
        }
        
        logger.info(f"✅ Returning response: {response_data_final}")
        return response_data_final
        
    except Exception as e:
        logger.error(f"Question bank generate error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/search")
async def question_bank_search(
    user_id: str = Body(...),
    search_query: str = Body(...),
    filters: Dict[str, Any] = Body(None),
    session_id: str = Body(None)
):
    """Search questions in the question bank"""
    request = {
        "user_id": user_id,
        "action": "search",
        "search_query": search_query,
        "filters": filters or {},
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "search",
            "search_results": result_dict.get("metadata", {}).get("response_data", {}).get("search_results"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/organize")
async def question_bank_organize(
    user_id: str = Body(...),
    questions: List[Dict[str, Any]] = Body(...),
    session_id: str = Body(None)
):
    """Organize questions into logical groups"""
    request = {
        "user_id": user_id,
        "action": "organize",
        "questions": questions,
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "organize",
            "organization_plan": result_dict.get("metadata", {}).get("response_data", {}).get("organization_plan"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank organize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/analyze")
async def question_bank_analyze(
    user_id: str = Body(...),
    performance_data: Dict[str, Any] = Body(...),
    session_id: str = Body(None)
):
    """Analyze performance on questions"""
    request = {
        "user_id": user_id,
        "action": "analyze",
        "performance_data": performance_data,
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "analyze",
            "analysis": result_dict.get("metadata", {}).get("response_data", {}).get("analysis"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/recommend")
async def question_bank_recommend(
    user_id: str = Body(...),
    performance_data: Dict[str, Any] = Body(...),
    session_id: str = Body(None)
):
    """Get recommendations for question review"""
    request = {
        "user_id": user_id,
        "action": "recommend",
        "performance_data": performance_data,
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "recommend",
            "recommendations": result_dict.get("metadata", {}).get("response_data", {}).get("recommendations"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank recommend error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/categorize")
async def question_bank_categorize(
    user_id: str = Body(...),
    questions: List[Dict[str, Any]] = Body(...),
    session_id: str = Body(None)
):
    """Categorize questions by topic and concept"""
    request = {
        "user_id": user_id,
        "action": "categorize",
        "questions": questions,
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "categorize",
            "categories": result_dict.get("metadata", {}).get("response_data", {}).get("categories"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank categorize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/question-bank/assess")
async def question_bank_assess(
    user_id: str = Body(...),
    questions: List[Dict[str, Any]] = Body(...),
    session_id: str = Body(None)
):
    """Assess and validate question difficulty levels"""
    request = {
        "user_id": user_id,
        "action": "assess",
        "questions": questions,
        "session_id": session_id or f"qb_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_question_bank_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "assess",
            "difficulty_assessment": result_dict.get("metadata", {}).get("response_data", {}).get("difficulty_assessment"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Question bank assess error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SLIDE EXPLORER AGENT ====================

@router.post("/slide-explorer/extract")
async def slide_explorer_extract(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    extraction_type: str = Body("full"),
    session_id: str = Body(None)
):
    """Extract structured content from slides"""
    request = {
        "user_id": user_id,
        "action": "extract",
        "slide_content": slide_content,
        "extraction_type": extraction_type,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "extract",
            "extracted_data": result_dict.get("metadata", {}).get("response_data", {}).get("extracted_data"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer extract error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/summarize")
async def slide_explorer_summarize(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    session_id: str = Body(None)
):
    """Summarize slide content"""
    request = {
        "user_id": user_id,
        "action": "summarize",
        "slide_content": slide_content,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "summarize",
            "summary": result_dict.get("metadata", {}).get("response_data", {}).get("summary"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer summarize error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/key-points")
async def slide_explorer_key_points(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    session_id: str = Body(None)
):
    """Extract key points from slides"""
    request = {
        "user_id": user_id,
        "action": "key_points",
        "slide_content": slide_content,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "key_points",
            "key_points": result_dict.get("metadata", {}).get("response_data", {}).get("key_points"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer key points error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/questions")
async def slide_explorer_questions(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    session_id: str = Body(None)
):
    """Generate questions from slide content"""
    request = {
        "user_id": user_id,
        "action": "questions",
        "slide_content": slide_content,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "questions",
            "questions": result_dict.get("metadata", {}).get("response_data", {}).get("questions"),
            "count": len(result_dict.get("metadata", {}).get("response_data", {}).get("questions", [])),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer questions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/concepts")
async def slide_explorer_concepts(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    session_id: str = Body(None)
):
    """Extract and map concepts from slides"""
    request = {
        "user_id": user_id,
        "action": "concepts",
        "slide_content": slide_content,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "concepts",
            "concepts": result_dict.get("metadata", {}).get("response_data", {}).get("concepts"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer concepts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/analyze")
async def slide_explorer_analyze(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    analysis_depth: str = Body("standard"),
    session_id: str = Body(None)
):
    """Deep analysis of slide content"""
    logger.info(f"🔍 Slide Explorer /analyze endpoint called: user_id={user_id}, depth={analysis_depth}")
    
    request = {
        "user_id": user_id,
        "action": "analyze",
        "slide_content": slide_content,
        "analysis_depth": analysis_depth,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        logger.info(f"✅ Got slide explorer agent: {agent}")
        result = await agent.invoke(request)
        logger.info(f"✅ Agent invoke result: {result}")
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "analyze",
            "analysis": result_dict.get("metadata", {}).get("response_data", {}).get("analysis"),
            "depth": analysis_depth,
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer analyze error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/slide-explorer/link")
async def slide_explorer_link(
    user_id: str = Body(...),
    slide_content: str = Body(...),
    session_id: str = Body(None)
):
    """Link slide content to other learning materials"""
    request = {
        "user_id": user_id,
        "action": "link",
        "slide_content": slide_content,
        "session_id": session_id or f"se_{user_id}_{datetime.utcnow().timestamp()}"
    }
    
    try:
        agent = get_slide_explorer_agent()
        result = await agent.invoke(request)
        
        # Convert AgentResponse to dict if needed
        result_dict = result.to_dict() if hasattr(result, 'to_dict') else result
        
        return {
            "success": result_dict.get("success", True),
            "action": "link",
            "linking_suggestions": result_dict.get("metadata", {}).get("response_data", {}).get("linking_suggestions"),
            "metadata": result_dict.get("metadata", {})
        }
    except Exception as e:
        logger.error(f"Slide explorer link error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TEST ENDPOINTS ====================

@router.get("/test/question-bank")
async def test_question_bank():
    """Test Question Bank Agent"""
    try:
        agent = get_question_bank_agent()
        logger.info(f"✅ Question Bank Agent exists: {agent}")
        
        state = {
            "user_id": "test_user",
            "action": "search",
            "search_query": "test",
            "filters": {},
            "session_id": "test_session"
        }
        
        result = await agent.invoke(state)
        logger.info(f"✅ Question Bank Agent invoke result: {result}")
        
        return {
            "success": True,
            "message": "Question Bank Agent is working",
            "agent": str(agent),
            "result": result
        }
    except Exception as e:
        logger.error(f"❌ Question Bank Agent test failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/test/slide-explorer")
async def test_slide_explorer():
    """Test Slide Explorer Agent"""
    try:
        agent = get_slide_explorer_agent()
        logger.info(f"✅ Slide Explorer Agent exists: {agent}")
        
        state = {
            "user_id": "test_user",
            "action": "summarize",
            "slide_content": "This is a test slide about machine learning",
            "session_id": "test_session"
        }
        
        result = await agent.invoke(state)
        logger.info(f"✅ Slide Explorer Agent invoke result: {result}")
        
        return {
            "success": True,
            "message": "Slide Explorer Agent is working",
            "agent": str(agent),
            "result": result
        }
    except Exception as e:
        logger.error(f"❌ Slide Explorer Agent test failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
