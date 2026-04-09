"""
Cerbyl Intelligence API Routes

All user_id params are USERNAME strings (same pattern as all other routes).
The route resolves them to integer IDs internally via get_user_by_username/email.

GET  /api/intelligence/weakness/profile     ?user_id=username
GET  /api/intelligence/weakness/recommendations ?user_id=username
POST /api/intelligence/events/record
GET  /api/intelligence/session/brief        ?user_id=username
GET  /api/intelligence/memory               ?user_id=username
POST /api/intelligence/memory/write
GET  /api/intelligence/status
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from deps import get_user_by_email, get_user_by_username, verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


def _resolve_user(db: Session, user_id: str) -> models.User:
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _safe_isoformat(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.get("/status")
def intelligence_status():
    """Check which intelligence services are online."""
    from services.memory_service import get_memory_service
    from services.context_agent import get_context_agent
    from services.ml_pipeline import ModelRegistry

    reg = ModelRegistry.get()
    return {
        "memory_service": get_memory_service() is not None,
        "context_agent": get_context_agent() is not None,
        "embedding_model": reg._embed_model is not None,
        "cross_encoder": reg._cross_encoder is not None,
    }


@router.get("/weakness/profile")
async def get_weakness_profile(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """
    Full WeaknessProfile for the dashboard.
    user_id = username or email (same as all other routes).
    """
    try:
        user = _resolve_user(db, user_id)
        student_id = user.id

        from services.context_agent import get_context_agent

        agent = get_context_agent()
        profile = agent.get_student_profile(db, student_id) if agent else None

        gstats = db.query(models.UserGamificationStats).filter_by(user_id=student_id).first()
        achievements = (
            db.query(models.UserAchievement, models.Achievement)
            .join(models.Achievement, models.UserAchievement.achievement_id == models.Achievement.id)
            .filter(models.UserAchievement.user_id == student_id)
            .all()
        )

        topic_masteries = (
            db.query(models.TopicMastery)
            .filter_by(user_id=student_id)
            .order_by(models.TopicMastery.mastery_level.asc())
            .all()
        )

        bkt_states = (
            db.query(models.StudentKnowledgeState)
            .filter_by(user_id=student_id)
            .order_by(models.StudentKnowledgeState.p_mastery.asc())
            .all()
        )

        today = date.today()
        daily_metrics = (
            db.query(models.DailyLearningMetrics)
            .filter(
                models.DailyLearningMetrics.user_id == student_id,
                models.DailyLearningMetrics.date >= today - timedelta(days=30),
            )
            .order_by(models.DailyLearningMetrics.date.asc())
            .all()
        )

        weekly_activity = []
        for i in range(7):
            day = today - timedelta(days=6 - i)
            m = next((x for x in daily_metrics if x.date == day), None)
            weekly_activity.append({
                "date": day.isoformat(),
                "interactions": m.questions_answered if m else 0,
                "chat": m.sessions_completed if m else 0,
                "quiz": 0,
                "flashcard": 0,
                "roadmap": 0,
            })

        mastery_over_time = [
            {
                "date": m.date.isoformat() if hasattr(m.date, "isoformat") else str(m.date),
                "avg_p_mastery": round(m.accuracy_rate, 3),
            }
            for m in daily_metrics
        ]

        weak_out = []
        if profile:
            for wc in (profile.weak_concepts or [])[:10]:
                weak_out.append({
                    "concept_id": wc.concept_id,
                    "concept_name": wc.concept_name,
                    "p_mastery": round(wc.p_mastery, 3),
                    "mastery_trend": round(wc.trend, 3),
                    "mastery_trend_label": wc.trend_label,
                    "struggle_sources": wc.struggle_sources,
                    "interaction_count": wc.interaction_count,
                    "last_seen": _safe_isoformat(wc.last_seen),
                    "recommended_action": wc.recommended_action,
                })
        else:
            for s in bkt_states[:10]:
                hist = s.mastery_history or []
                trend = (hist[-1] - hist[-2]) if len(hist) >= 2 else 0.0
                trend_label = "improving" if trend > 0.02 else ("declining" if trend < -0.02 else "stable")
                weak_out.append({
                    "concept_id": s.concept_id,
                    "concept_name": s.concept_name,
                    "p_mastery": round(s.p_mastery, 3),
                    "mastery_trend": round(trend, 3),
                    "mastery_trend_label": trend_label,
                    "struggle_sources": [],
                    "interaction_count": s.interaction_count,
                    "last_seen": _safe_isoformat(s.last_updated),
                    "recommended_action": "review_flashcards" if s.p_mastery < 0.4 else "try_a_quiz",
                })

        total_pts = gstats.total_points if gstats else 0
        weekly_pts = gstats.weekly_points if gstats else 0
        streak = gstats.current_streak if gstats else 0
        mastered_count = len([s for s in bkt_states if s.p_mastery > 0.85])
        in_progress = len([s for s in bkt_states if 0.3 < s.p_mastery <= 0.85])

        total_mins = sum(m.time_spent_minutes for m in daily_metrics)
        total_study_hours = round(total_mins / 60.0, 1)
        sessions_total = sum(m.sessions_completed for m in daily_metrics)
        avg_session_min = round(total_mins / sessions_total, 1) if sessions_total > 0 else 0.0

        topic_sorted = sorted(topic_masteries, key=lambda t: t.mastery_level)
        weakest_subject = topic_sorted[0].topic_name if topic_sorted else "N/A"
        strongest_subject = topic_sorted[-1].topic_name if topic_sorted else "N/A"

        improvement_rate = 0.0
        if bkt_states:
            deltas = []
            for s in bkt_states:
                h = s.mastery_history or []
                if len(h) >= 2:
                    deltas.append(h[-1] - h[0])
            if deltas:
                improvement_rate = round(sum(deltas) / len(deltas), 3)

        badges_out = []
        earned_ids = {ua.achievement_id for ua, _ in achievements}
        for ua, ach in achievements:
            badges_out.append({
                "badge_id": ach.name,
                "name": ach.name,
                "description": ach.description,
                "icon": ach.icon or "🏅",
                "earned": True,
                "earned_at": _safe_isoformat(ua.earned_at),
            })
        all_achs = db.query(models.Achievement).all()
        for ach in all_achs:
            if ach.id not in earned_ids:
                badges_out.append({
                    "badge_id": ach.name,
                    "name": ach.name,
                    "description": ach.description,
                    "icon": ach.icon or "🏅",
                    "earned": False,
                    "earned_at": None,
                })

        heatmap = [
            {
                "concept_id": s.concept_id,
                "concept_name": s.concept_name,
                "p_mastery": round(s.p_mastery, 3),
                "color": _mastery_color(s.p_mastery),
            }
            for s in bkt_states
        ]

        return JSONResponse(content={
            "status": "success",
            "student_id": student_id,
            "weak_concepts": weak_out,
            "heatmap": heatmap,
            "stats": {
                "total_points": total_pts,
                "weekly_points": weekly_pts,
                "daily_streak": streak,
                "concepts_mastered": mastered_count,
                "concepts_in_progress": in_progress,
                "concepts_not_started": 0,
                "strongest_subject": strongest_subject,
                "weakest_subject": weakest_subject,
                "avg_session_length_min": avg_session_min,
                "total_study_time_hours": total_study_hours,
                "improvement_rate": improvement_rate,
            },
            "badges": badges_out,
            "weekly_activity": weekly_activity,
            "mastery_over_time": mastery_over_time,
            "session_brief": profile.session_brief if profile else "",
            "struggling_today": profile.struggling_today if profile else [],
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intelligence] weakness profile failed: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@router.get("/weakness/recommendations")
async def get_weakness_recommendations(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """Top 3 prioritized study recommendations."""
    try:
        user = _resolve_user(db, user_id)

        bkt_states = (
            db.query(models.StudentKnowledgeState)
            .filter_by(user_id=user.id)
            .order_by(models.StudentKnowledgeState.p_mastery.asc())
            .limit(10)
            .all()
        )

        recommendations = []
        for s in bkt_states[:3]:
            hist = s.mastery_history or []
            trend = (hist[-1] - hist[-2]) if len(hist) >= 2 else 0.0
            p = s.p_mastery
            resource = "ask_tutor" if p < 0.3 else ("review_flashcards" if p < 0.6 else "try_a_quiz")
            recommendations.append({
                "concept_id": s.concept_id,
                "concept_name": s.concept_name,
                "p_mastery": round(p, 3),
                "priority_score": round((1 - p) * (1 + abs(trend)), 3),
                "estimated_time_minutes": int((1 - p) * 30),
                "recommended_resource": resource,
                "trend_label": "improving" if trend > 0.02 else ("declining" if trend < -0.02 else "stable"),
            })

        recommendations.sort(key=lambda x: x["priority_score"], reverse=True)

        return JSONResponse(content={
            "status": "success",
            "student_id": user.id,
            "recommendations": recommendations,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intelligence] recommendations failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


class RecordEventRequest(BaseModel):
    student_id: str
    source: str
    event_type: str = "interaction"
    concept_id: str = ""
    concept_name: str = ""
    session_id: Optional[int] = None
    correct: Optional[bool] = None
    score: float = 0.0
    wrong_questions: int = 0
    time_seconds: int = 0
    frustration: float = 0.0
    intent: str = ""
    message: str = ""


@router.post("/events/record")
async def record_event(
    request: RecordEventRequest,
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """Record a learning event and get cross-feature decisions."""
    try:
        from services.context_agent import get_context_agent, LearningEvent

        agent = get_context_agent()
        if not agent:
            return JSONResponse(content={"status": "ok", "message": "agent not ready"})

        event = LearningEvent(
            student_id=request.student_id,
            source=request.source,
            event_type=request.event_type,
            concept_id=request.concept_id,
            concept_name=request.concept_name,
            session_id=request.session_id,
            correct=request.correct,
            score=request.score,
            wrong_questions=request.wrong_questions,
            time_seconds=request.time_seconds,
            frustration=request.frustration,
            intent=request.intent,
            message=request.message,
        )

        decision = agent.record_event(db, event)

        return JSONResponse(content={
            "status": "success",
            "triggers_fired": decision.triggers_fired,
            "inject_concept_to_chat": decision.inject_concept_to_chat,
            "add_flashcard_reps": decision.add_flashcard_reps,
            "flashcard_reps_count": decision.flashcard_reps_count,
            "dim_roadmap_concept": decision.dim_roadmap_concept,
            "milestone_notification": decision.milestone_notification,
        })

    except Exception as e:
        logger.error(f"[Intelligence] record event failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@router.get("/session/brief")
async def get_session_brief(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """Session start: apply forgetting curve, return session brief."""
    try:
        user = _resolve_user(db, user_id)
        from services.context_agent import get_context_agent

        agent = get_context_agent()
        if agent:
            agent.apply_forgetting_curve(db, user.id)
            profile = agent.get_student_profile(db, user.id)
            return JSONResponse(content={
                "status": "success",
                "session_brief": profile.session_brief,
                "weak_concepts": [
                    {"concept_id": w.concept_id, "concept_name": w.concept_name, "p_mastery": w.p_mastery}
                    for w in (profile.weak_concepts or [])[:3]
                ],
                "struggling_today": profile.struggling_today,
            })
        return JSONResponse(content={"status": "ok", "session_brief": ""})

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intelligence] session brief failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@router.get("/memory")
async def get_student_memories(
    user_id: str = Query(...),
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """Recent memories for a student (debug/demo)."""
    try:
        user = _resolve_user(db, user_id)
        rows = (
            db.query(models.StudentMemory)
            .filter_by(user_id=user.id)
            .order_by(models.StudentMemory.created_at.desc())
            .limit(limit)
            .all()
        )
        return JSONResponse(content={
            "status": "success",
            "memories": [
                {
                    "memory_hash": r.memory_hash,
                    "memory_type": r.memory_type,
                    "concept_name": r.concept_name,
                    "source": r.source,
                    "content": r.content,
                    "importance_score": r.importance_score,
                    "access_count": r.access_count,
                    "created_at": _safe_isoformat(r.created_at),
                }
                for r in rows
            ],
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Intelligence] memory list failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


class WriteMemoryRequest(BaseModel):
    student_id: str
    source: str
    concept_id: str = ""
    concept_name: str = ""
    correct: Optional[bool] = None
    score: float = 0.0
    frustration: float = 0.0
    intent: str = ""
    message: str = ""
    time_seconds: int = 0
    p_mastery: float = 0.0


@router.post("/memory/write")
async def write_memory(
    request: WriteMemoryRequest,
    db: Session = Depends(get_db),
    token: str = Depends(verify_token),
):
    """Manually write a memory entry."""
    try:
        from services.memory_service import get_memory_service, MemoryEvent

        svc = get_memory_service()
        if not svc:
            return JSONResponse(content={"status": "ok", "message": "memory service not ready"})

        event = MemoryEvent(
            source=request.source,
            concept_id=request.concept_id,
            concept_name=request.concept_name,
            correct=request.correct,
            score=request.score,
            frustration=request.frustration,
            intent=request.intent,
            message=request.message,
            time_seconds=request.time_seconds,
            p_mastery=request.p_mastery,
        )
        mem = svc.write_memory(db, request.student_id, event)

        if mem:
            return JSONResponse(content={
                "status": "success",
                "memory_hash": mem.memory_hash,
                "memory_type": mem.memory_type,
                "importance_score": mem.importance_score,
            })
        return JSONResponse(content={"status": "ok", "message": "write skipped"})

    except Exception as e:
        logger.error(f"[Intelligence] memory write failed: {e}")
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


def _mastery_color(p: float) -> str:
    if p < 0.3:
        return "deep_red"
    if p < 0.5:
        return "orange"
    if p < 0.7:
        return "yellow"
    if p < 0.85:
        return "light_green"
    return "bright_green"
