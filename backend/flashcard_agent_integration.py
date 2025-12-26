"""
Flashcard Agent Integration
Integrates the advanced Flashcard Agent with the existing FastAPI backend
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Form, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from flashcard_agent import (
    FlashcardAgent,
    ReviewQuality,
    CardDifficulty,
    LearningPhase
)
import models

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/flashcard-agent", tags=["Flashcard Agent"])

# Store active agents (in production, use Redis or database)
active_agents: Dict[str, FlashcardAgent] = {}


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CardAddRequest(BaseModel):
    user_id: str
    card_id: str
    content: Dict[str, Any]
    tags: Optional[List[str]] = None


class CardReviewRequest(BaseModel):
    user_id: str
    card_id: str
    quality: int  # 0-5 (ReviewQuality enum value)
    response_time: float
    user_answer: Optional[str] = None


class StudySessionStart(BaseModel):
    user_id: str
    session_type: str = "review"


class StudySessionEnd(BaseModel):
    user_id: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_or_create_agent(user_id: str) -> FlashcardAgent:
    """Get existing agent or create new one"""
    if user_id not in active_agents:
        active_agents[user_id] = FlashcardAgent(student_id=user_id)
        logger.info(f"Created new Flashcard Agent for user {user_id}")
    return active_agents[user_id]


def quality_from_int(value: int) -> ReviewQuality:
    """Convert integer to ReviewQuality enum"""
    quality_map = {
        0: ReviewQuality.COMPLETE_BLACKOUT,
        1: ReviewQuality.INCORRECT,
        2: ReviewQuality.INCORRECT_BUT_REMEMBERED,
        3: ReviewQuality.CORRECT_WITH_DIFFICULTY,
        4: ReviewQuality.CORRECT_WITH_HESITATION,
        5: ReviewQuality.PERFECT
    }
    return quality_map.get(value, ReviewQuality.CORRECT_WITH_DIFFICULTY)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/add-card")
async def add_flashcard(payload: CardAddRequest):
    """Add a new flashcard to the agent"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        agent.add_card(
            card_id=payload.card_id,
            content=payload.content,
            tags=payload.tags
        )
        
        return {
            "success": True,
            "message": f"Card {payload.card_id} added successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error adding card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start-session")
async def start_study_session(payload: StudySessionStart):
    """Start a new study session"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        session_data = agent.start_study_session(session_type=payload.session_type)
        
        return {
            "success": True,
            "data": session_data,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review-card")
async def review_flashcard(payload: CardReviewRequest):
    """Review a flashcard and update metrics"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        quality = quality_from_int(payload.quality)
        
        result = agent.review_card(
            card_id=payload.card_id,
            quality=quality,
            response_time=payload.response_time,
            user_answer=payload.user_answer
        )
        
        return {
            "success": True,
            "data": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error reviewing card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/end-session")
async def end_study_session(payload: StudySessionEnd):
    """End the current study session"""
    try:
        agent = get_or_create_agent(payload.user_id)
        
        summary = agent.end_study_session()
        
        return {
            "success": True,
            "data": summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/comprehensive-report")
async def get_comprehensive_report(user_id: str = Query(...)):
    """Get comprehensive learning report"""
    try:
        agent = get_or_create_agent(user_id)
        
        report = agent.get_comprehensive_report()
        
        return {
            "success": True,
            "data": report,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/due-cards")
async def get_due_cards(user_id: str = Query(...)):
    """Get cards that are due for review"""
    try:
        agent = get_or_create_agent(user_id)
        
        due_cards = agent._get_due_cards()
        
        # Get detailed info for each card
        cards_info = []
        for card_id in due_cards:
            metrics = agent.card_metrics.get(card_id)
            if metrics:
                cards_info.append({
                    "card_id": card_id,
                    "learning_phase": metrics.learning_phase.value,
                    "retention_rate": metrics.retention_rate,
                    "next_review": metrics.next_review_date.isoformat() if metrics.next_review_date else None,
                    "difficulty": metrics.difficulty_rating.value
                })
        
        return {
            "success": True,
            "data": {
                "due_cards": cards_info,
                "count": len(cards_info)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting due cards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/card-metrics")
async def get_card_metrics(user_id: str = Query(...), card_id: str = Query(...)):
    """Get detailed metrics for a specific card"""
    try:
        agent = get_or_create_agent(user_id)
        
        if card_id not in agent.card_metrics:
            raise HTTPException(status_code=404, detail="Card not found")
        
        metrics = agent.card_metrics[card_id]
        
        return {
            "success": True,
            "data": {
                "card_id": metrics.card_id,
                "total_reviews": metrics.total_reviews,
                "correct_reviews": metrics.correct_reviews,
                "incorrect_reviews": metrics.incorrect_reviews,
                "retention_rate": metrics.retention_rate,
                "confidence_score": metrics.confidence_score,
                "average_response_time": metrics.average_response_time,
                "streak_correct": metrics.streak_correct,
                "learning_phase": metrics.learning_phase.value,
                "difficulty_rating": metrics.difficulty_rating.value,
                "next_review_date": metrics.next_review_date.isoformat() if metrics.next_review_date else None,
                "interval_days": metrics.interval_days,
                "lapses": metrics.lapses,
                "mastery_progress": agent._calculate_mastery_progress(metrics)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting card metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weaknesses")
async def get_weaknesses(user_id: str = Query(...)):
    """Get identified weaknesses"""
    try:
        agent = get_or_create_agent(user_id)
        
        all_weaknesses = []
        for card_id, metrics in agent.card_metrics.items():
            weaknesses = agent.weakness_analyzer.analyze_card_performance(
                metrics,
                agent.card_content.get(card_id, {})
            )
            all_weaknesses.extend(weaknesses)
        
        # Sort by severity
        all_weaknesses.sort(key=lambda w: w.severity, reverse=True)
        
        return {
            "success": True,
            "data": {
                "weaknesses": [
                    {
                        "card_id": w.card_id,
                        "type": w.weakness_type,
                        "severity": w.severity,
                        "description": w.description,
                        "occurrence_count": w.occurrence_count,
                        "suggested_actions": w.suggested_actions
                    }
                    for w in all_weaknesses[:10]  # Top 10
                ],
                "total_count": len(all_weaknesses)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting weaknesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommendations")
async def get_study_recommendations(user_id: str = Query(...)):
    """Get personalized study recommendations"""
    try:
        agent = get_or_create_agent(user_id)
        
        # Get weaknesses
        all_weaknesses = []
        for card_id, metrics in agent.card_metrics.items():
            weaknesses = agent.weakness_analyzer.analyze_card_performance(
                metrics,
                agent.card_content.get(card_id, {})
            )
            all_weaknesses.extend(weaknesses)
        
        # Generate recommendations
        recommendations = agent.recommendation_engine.generate_recommendations(
            agent.card_metrics,
            all_weaknesses
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


@router.get("/next-study")
async def get_next_study_recommendation(user_id: str = Query(...)):
    """Get recommendation for next study session"""
    try:
        agent = get_or_create_agent(user_id)
        
        recommendation = agent.get_next_study_recommendation()
        
        return {
            "success": True,
            "data": recommendation,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting next study recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics(user_id: str = Query(...)):
    """Get overall statistics"""
    try:
        agent = get_or_create_agent(user_id)
        
        total_cards = len(agent.card_metrics)
        if total_cards == 0:
            return {
                "success": True,
                "data": {
                    "message": "No cards yet",
                    "total_cards": 0
                },
                "timestamp": datetime.now().isoformat()
            }
        
        # Calculate statistics
        total_reviews = sum(m.total_reviews for m in agent.card_metrics.values())
        avg_retention = sum(m.retention_rate for m in agent.card_metrics.values()) / total_cards
        avg_confidence = sum(m.confidence_score for m in agent.card_metrics.values()) / total_cards
        
        # Phase distribution
        phase_counts = {}
        for metrics in agent.card_metrics.values():
            phase = metrics.learning_phase.value
            phase_counts[phase] = phase_counts.get(phase, 0) + 1
        
        return {
            "success": True,
            "data": {
                "total_cards": total_cards,
                "total_reviews": total_reviews,
                "average_retention": avg_retention,
                "average_confidence": avg_confidence,
                "phase_distribution": phase_counts,
                "study_streak": agent._calculate_study_streak(),
                "cards_due_today": len(agent._get_due_cards())
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset")
async def reset_agent(user_id: str = Query(...)):
    """Reset agent for a user"""
    try:
        if user_id in active_agents:
            del active_agents[user_id]
            logger.info(f"Reset flashcard agent for user {user_id}")
        
        return {
            "success": True,
            "message": "Agent reset successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error resetting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def register_flashcard_agent(app):
    """Register Flashcard Agent routes with the FastAPI app"""
    app.include_router(router)
    logger.info("✅ Flashcard Agent API registered successfully")
