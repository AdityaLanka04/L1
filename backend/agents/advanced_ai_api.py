"""
Advanced AI Features API
Exposes endpoints for the advanced AI capabilities:
- Reasoning models
- Emotional state tracking
- Learning style detection
- Proactive interventions
- Long-term student modeling
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel

from .advanced_ai_features import (
    get_advanced_ai_system,
    AdvancedAISystem,
    EmotionalState,
    LearningStyle,
    InterventionType
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/advanced-ai", tags=["advanced-ai"])


# ==================== Request/Response Models ====================

class EmotionalAnalysisRequest(BaseModel):
    """Request for emotional analysis"""
    user_id: str
    message: str


class EmotionalAnalysisResponse(BaseModel):
    """Response from emotional analysis"""
    emotional_state: str
    confidence: float
    frustration_level: float
    engagement_level: float
    anxiety_level: float
    tone_adaptation: Dict[str, Any]


class LearningStyleRequest(BaseModel):
    """Request for learning style analysis"""
    user_id: str
    message: str


class LearningStyleResponse(BaseModel):
    """Response from learning style analysis"""
    primary_style: str
    style_scores: Dict[str, float]
    confidence: float
    content_adaptation: Dict[str, str]


class ReasoningRequest(BaseModel):
    """Request for reasoning-based response"""
    query: str
    context: Optional[Dict[str, Any]] = {}
    show_thinking: bool = True


class ReasoningResponse(BaseModel):
    """Response with reasoning trace"""
    answer: str
    reasoning_steps: List[Dict[str, str]]
    confidence: float
    reasoning_time_ms: float


class StudentModelRequest(BaseModel):
    """Request for student model"""
    user_id: str


class StudentModelResponse(BaseModel):
    """Response with student model data"""
    user_id: str
    emotional_profile: Dict[str, Any]
    learning_style: Dict[str, Any]
    mastery_levels: Dict[str, float]
    knowledge_gaps: List[str]
    strengths: List[str]
    behavioral_patterns: Dict[str, Any]
    personalization_context: Dict[str, Any]


class InterventionCheckRequest(BaseModel):
    """Request to check for proactive intervention"""
    user_id: str
    message: str
    response_time_seconds: Optional[float] = None
    topic: Optional[str] = None
    was_correct: Optional[bool] = None


class InterventionCheckResponse(BaseModel):
    """Response with intervention if triggered"""
    intervention_triggered: bool
    intervention_type: Optional[str] = None
    message: Optional[str] = None
    priority: Optional[float] = None
    trigger_reason: Optional[str] = None
    suggested_actions: List[str] = []


# ==================== API Endpoints ====================

@router.post("/analyze-emotion", response_model=EmotionalAnalysisResponse)
async def analyze_emotion(request: EmotionalAnalysisRequest):
    """
    Analyze emotional state from a message.
    Returns detected emotion, confidence, and tone adaptation guidelines.
    """
    advanced_ai = get_advanced_ai_system()
    if not advanced_ai:
        raise HTTPException(status_code=503, detail="Advanced AI system not initialized")
    
    # Detect emotion
    emotion, confidence = advanced_ai.emotional_engine.detect_emotion(
        request.message, 
        request.user_id
    )
    
    # Get profile
    profile = advanced_ai.emotional_engine.get_profile(request.user_id)
    
    # Get tone adaptation
    tone = advanced_ai.emotional_engine.get_tone_adaptation(emotion)
    
    return EmotionalAnalysisResponse(
        emotional_state=emotion.value,
        confidence=confidence,
        frustration_level=profile.frustration_level,
        engagement_level=profile.engagement_level,
        anxiety_level=profile.anxiety_level,
        tone_adaptation=tone
    )


@router.post("/analyze-learning-style", response_model=LearningStyleResponse)
async def analyze_learning_style(request: LearningStyleRequest):
    """
    Analyze and update learning style from interaction.
    Returns detected style, scores, and content adaptation guidelines.
    """
    advanced_ai = get_advanced_ai_system()
    if not advanced_ai:
        raise HTTPException(status_code=503, detail="Advanced AI system not initialized")
    
    # Analyze interaction
    profile = advanced_ai.style_detector.analyze_interaction(
        request.message,
        request.user_id
    )
    
    # Get adaptation
    adaptation = advanced_ai.style_detector.get_adaptation(request.user_id)
    
    return LearningStyleResponse(
        primary_style=profile.primary_style.value,
        style_scores=profile.style_scores,
        confidence=profile.confidence,
        content_adaptation=adaptation
    )


@router.post("/generate-with-reasoning", response_model=ReasoningResponse)
async def generate_with_reasoning(request: ReasoningRequest):
    """
    Generate a response using step-by-step reasoning.
    Shows the AI's thinking process for complex problems.
    """
    advanced_ai = get_advanced_ai_system()
    if not advanced_ai:
        raise HTTPException(status_code=503, detail="Advanced AI system not initialized")
    
    # Generate with reasoning
    trace = advanced_ai.reasoning_engine.generate_with_reasoning(
        request.query,
        request.context,
        request.show_thinking
    )
    
    return ReasoningResponse(
        answer=trace.final_answer,
        reasoning_steps=[
            {
                "step": step.step_number,
                "thought": step.thought,
                "action": step.action
            }
            for step in trace.steps
        ],
        confidence=trace.total_confidence,
        reasoning_time_ms=trace.reasoning_time_ms
    )


@router.post("/student-model", response_model=StudentModelResponse)
async def get_student_model(request: StudentModelRequest):
    """
    Get comprehensive student model.
    Includes emotional profile, learning style, mastery levels, and personalization context.
    """
    advanced_ai = get_advanced_ai_system()
    if not advanced_ai:
        raise HTTPException(status_code=503, detail="Advanced AI system not initialized")
    
    # Get model
    model = advanced_ai.student_modeler.get_model(request.user_id)
    
    # Get personalization context
    personalization = advanced_ai.student_modeler.get_personalization_context(request.user_id)
    
    return StudentModelResponse(
        user_id=model.user_id,
        emotional_profile={
            "current_state": model.emotional_profile.current_state.value,
            "confidence": model.emotional_profile.confidence,
            "frustration_level": model.emotional_profile.frustration_level,
            "engagement_level": model.emotional_profile.engagement_level,
            "anxiety_level": model.emotional_profile.anxiety_level,
            "history_count": len(model.emotional_profile.history)
        },
        learning_style={
            "primary_style": model.learning_style.primary_style.value,
            "style_scores": model.learning_style.style_scores,
            "confidence": model.learning_style.confidence,
            "interaction_count": model.learning_style.interaction_count
        },
        mastery_levels=model.mastery_levels,
        knowledge_gaps=model.knowledge_gaps,
        strengths=model.strengths,
        behavioral_patterns={
            "avg_session_duration": model.avg_session_duration,
            "response_time_avg": model.response_time_avg,
            "total_sessions": model.total_sessions,
            "total_interactions": model.total_interactions,
            "streak_days": model.streak_days
        },
        personalization_context=personalization
    )


@router.post("/check-intervention", response_model=InterventionCheckResponse)
async def check_intervention(request: InterventionCheckRequest):
    """
    Check if a proactive intervention should be triggered.
    Analyzes the interaction and returns intervention if needed.
    """
    advanced_ai = get_advanced_ai_system()
    if not advanced_ai:
        raise HTTPException(status_code=503, detail="Advanced AI system not initialized")
    
    # Track interaction and check for intervention
    intervention = advanced_ai.intervention_engine.track_interaction(
        user_id=request.user_id,
        message=request.message,
        response_time_seconds=request.response_time_seconds,
        was_correct=request.was_correct,
        topic=request.topic
    )
    
    if intervention:
        return InterventionCheckResponse(
            intervention_triggered=True,
            intervention_type=intervention.intervention_type.value,
            message=intervention.message,
            priority=intervention.priority,
            trigger_reason=intervention.trigger_reason,
            suggested_actions=intervention.suggested_actions
        )
    
    return InterventionCheckResponse(
        intervention_triggered=False
    )


@router.get("/status")
async def get_advanced_ai_status():
    """Get status of the advanced AI system"""
    advanced_ai = get_advanced_ai_system()
    
    return {
        "status": "healthy" if advanced_ai else "not_initialized",
        "components": {
            "reasoning_engine": advanced_ai is not None,
            "emotional_engine": advanced_ai is not None,
            "style_detector": advanced_ai is not None,
            "intervention_engine": advanced_ai is not None,
            "student_modeler": advanced_ai is not None
        },
        "capabilities": [
            "step_by_step_reasoning",
            "emotional_state_detection",
            "frustration_tracking",
            "engagement_monitoring",
            "learning_style_detection",
            "real_time_style_adaptation",
            "proactive_interventions",
            "confusion_detection",
            "break_suggestions",
            "long_term_student_modeling",
            "personalized_tone_adaptation",
            "content_format_adaptation"
        ],
        "emotional_states": [e.value for e in EmotionalState],
        "learning_styles": [s.value for s in LearningStyle],
        "intervention_types": [i.value for i in InterventionType],
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/emotional-states")
async def list_emotional_states():
    """List all detectable emotional states"""
    return {
        "states": [
            {"name": e.value, "description": _get_emotion_description(e)}
            for e in EmotionalState
        ]
    }


@router.get("/learning-styles")
async def list_learning_styles():
    """List all learning styles"""
    return {
        "styles": [
            {"name": s.value, "description": _get_style_description(s)}
            for s in LearningStyle
        ]
    }


@router.get("/intervention-types")
async def list_intervention_types():
    """List all intervention types"""
    return {
        "types": [
            {"name": i.value, "description": _get_intervention_description(i)}
            for i in InterventionType
        ]
    }


# ==================== Helper Functions ====================

def _get_emotion_description(emotion: EmotionalState) -> str:
    descriptions = {
        EmotionalState.CONFIDENT: "Student feels confident and understands the material",
        EmotionalState.CONFUSED: "Student is confused and needs clarification",
        EmotionalState.FRUSTRATED: "Student is frustrated and may need encouragement",
        EmotionalState.CURIOUS: "Student is curious and engaged in learning",
        EmotionalState.ENGAGED: "Student is actively engaged with the content",
        EmotionalState.ANXIOUS: "Student is anxious, possibly about exams or deadlines",
        EmotionalState.BORED: "Student seems bored and may need more engaging content",
        EmotionalState.OVERWHELMED: "Student is overwhelmed with information",
        EmotionalState.NEUTRAL: "Neutral emotional state"
    }
    return descriptions.get(emotion, "Unknown state")


def _get_style_description(style: LearningStyle) -> str:
    descriptions = {
        LearningStyle.VISUAL: "Learns best through diagrams, charts, and visual representations",
        LearningStyle.AUDITORY: "Learns best through verbal explanations and discussions",
        LearningStyle.KINESTHETIC: "Learns best through hands-on practice and exercises",
        LearningStyle.READING_WRITING: "Learns best through reading and writing notes",
        LearningStyle.MULTIMODAL: "Benefits from a mix of learning approaches"
    }
    return descriptions.get(style, "Unknown style")


def _get_intervention_description(intervention: InterventionType) -> str:
    descriptions = {
        InterventionType.CONFUSION_HELP: "Help when student shows signs of confusion",
        InterventionType.FRUSTRATION_SUPPORT: "Support when student is frustrated",
        InterventionType.ENGAGEMENT_BOOST: "Boost engagement when student seems disengaged",
        InterventionType.KNOWLEDGE_GAP: "Address detected knowledge gaps",
        InterventionType.REVIEW_REMINDER: "Remind to review topics for retention",
        InterventionType.ENCOURAGEMENT: "Provide encouragement for good progress",
        InterventionType.BREAK_SUGGESTION: "Suggest a break after long study sessions",
        InterventionType.DIFFICULTY_ADJUSTMENT: "Adjust difficulty based on performance"
    }
    return descriptions.get(intervention, "Unknown intervention")
