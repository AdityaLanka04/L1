"""
AI Chat Agent Integration
Integrates the advanced AI Chat Agent with the existing FastAPI backend
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Form, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ai_chat_agent import (
    AIChatAgent, 
    ConversationMode, 
    DifficultyLevel
)
import models

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/ai-chat-agent", tags=["AI Chat Agent"])

# Store active agents (in production, use Redis or database)
active_agents: Dict[str, AIChatAgent] = {}


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ChatAgentMessage(BaseModel):
    user_id: str
    message: str
    chat_id: Optional[int] = None
    mode: Optional[str] = "tutoring"
    context: Optional[Dict[str, Any]] = None


class ConceptMasteryUpdate(BaseModel):
    user_id: str
    concept: str
    is_correct: bool
    time_taken: int


class StudyPlanRequest(BaseModel):
    user_id: str
    available_time: int = 60


class ModeSwitchRequest(BaseModel):
    user_id: str
    mode: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_or_create_agent(user_id: str) -> AIChatAgent:
    """Get existing agent or create new one"""
    if user_id not in active_agents:
        active_agents[user_id] = AIChatAgent(student_id=user_id)
        logger.info(f"Created new AI Chat Agent for user {user_id}")
    return active_agents[user_id]


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/message")
async def process_chat_message(payload: ChatAgentMessage):
    """
    Process a chat message with advanced AI agent
    Returns comprehensive analysis, insights, and recommendations
    """
    try:
        agent = get_or_create_agent(payload.user_id)
        
        # Set conversation mode if specified
        if payload.mode:
            try:
                mode = ConversationMode(payload.mode)
                agent.switch_mode(mode)
            except ValueError:
                logger.warning(f"Invalid mode: {payload.mode}, using current mode")
        
        # Process message
        result = agent.process_message(
            payload.message,
            context=payload.context or {}
        )
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error processing chat message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-mastery")
async def update_concept_mastery(payload: ConceptMasteryUpdate):
    """Update mastery for a specific concept"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        agent.update_mastery(
            concept=payload.concept,
            is_correct=payload.is_correct,
            time_taken=payload.time_taken
        )
        
        return {
            "success": True,
            "message": f"Updated mastery for {payload.concept}",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error updating mastery: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress-report")
async def get_progress_report(user_id: str = Query(...)):
    """Get comprehensive progress report"""
    try:
        agent = get_or_create_agent(user_id)
        report = agent.get_progress_report()
        
        return {
            "success": True,
            "data": report,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting progress report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study-plan")
async def generate_study_plan(payload: StudyPlanRequest):
    """Generate personalized study plan"""
    try:
        agent = get_or_create_agent(payload.user_id)
        plan = agent.get_study_plan(available_time=payload.available_time)
        
        return {
            "success": True,
            "data": plan,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error generating study plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/switch-mode")
async def switch_conversation_mode(payload: ModeSwitchRequest):
    """Switch conversation mode"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        try:
            mode = ConversationMode(payload.mode)
            agent.switch_mode(mode)
            
            return {
                "success": True,
                "message": f"Switched to {mode.name} mode",
                "current_mode": mode.value,
                "timestamp": datetime.now().isoformat()
            }
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid mode. Valid modes: {[m.value for m in ConversationMode]}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error switching mode: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weaknesses")
async def get_weaknesses(user_id: str = Query(...)):
    """Get detected weaknesses"""
    try:
        agent = get_or_create_agent(user_id)
        
        # Get weaknesses from the agent
        weaknesses = agent.weakness_detector.detect_weaknesses(
            agent.context_manager.context_window,
            agent.concept_mastery
        )
        
        return {
            "success": True,
            "data": {
                "weaknesses": [
                    {
                        "category": w.category,
                        "subcategory": w.subcategory,
                        "severity": w.severity,
                        "frequency": w.frequency,
                        "suggested_resources": w.suggested_resources
                    }
                    for w in weaknesses
                ],
                "count": len(weaknesses)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting weaknesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations")
async def get_recommendations(user_id: str = Query(...)):
    """Get learning recommendations"""
    try:
        agent = get_or_create_agent(user_id)
        
        weaknesses = agent.weakness_detector.detect_weaknesses(
            agent.context_manager.context_window,
            agent.concept_mastery
        )
        
        recommendations = agent.path_recommender.recommend_next_topics(
            agent.concept_mastery,
            weaknesses,
            agent.student_profile.get("goals", [])
        )
        
        return {
            "success": True,
            "data": {
                "recommendations": recommendations,
                "count": len(recommendations)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset")
async def reset_agent(user_id: str = Query(...)):
    """Reset agent for a user (clear conversation history)"""
    try:
        if user_id in active_agents:
            del active_agents[user_id]
            logger.info(f"Reset agent for user {user_id}")
        
        return {
            "success": True,
            "message": "Agent reset successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error resetting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def register_ai_chat_agent(app):
    """Register AI Chat Agent routes with the FastAPI app"""
    app.include_router(router)
    logger.info(" AI Chat Agent API registered successfully")

