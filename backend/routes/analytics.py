import ast
import json
import logging
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, Form, Header, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

import models
from database import get_db
from deps import (
    call_ai,
    calculate_day_streak,
    get_comprehensive_profile_safe,
    get_current_user,
    get_user_by_email,
    get_user_by_username,
    unified_ai,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/get_enhanced_user_stats")
def get_enhanced_user_stats(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        from gamification_system import get_user_stats as get_gamification_stats
        gamification_stats = get_gamification_stats(db, user.id)

        total_questions = gamification_stats.get("total_questions_answered", 0)
        total_notes = gamification_stats.get("total_notes_created", 0)
        total_flashcards = gamification_stats.get("total_flashcards_created", 0)
        total_quizzes = gamification_stats.get("total_quizzes_completed", 0)
        total_study_minutes = gamification_stats.get("total_study_minutes", 0)

        total_chat_sessions = db.query(func.count(func.distinct(models.ChatSession.id))).join(
            models.ChatMessage, models.ChatMessage.chat_session_id == models.ChatSession.id
        ).filter(
            models.ChatSession.user_id == user.id
        ).scalar() or 0

        streak = gamification_stats.get("current_streak", 0)

        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()

        if user_stats:
            user_stats.day_streak = streak
            user_stats.total_hours = total_study_minutes / 60
            db.commit()

        return {
            "streak": streak,
            "lessons": total_quizzes,
            "hours": round(total_study_minutes / 60, 1),
            "minutes": total_study_minutes,
            "accuracy": user_stats.accuracy_percentage if user_stats else 0,
            "totalQuestions": total_questions,
            "totalFlashcards": total_flashcards,
            "totalNotes": total_notes,
            "totalChatSessions": total_chat_sessions,
            "total_time_today": 0
        }

    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return {
            "streak": 0, "lessons": 0, "hours": 0, "minutes": 0, "accuracy": 0,
            "totalQuestions": 0, "totalFlashcards": 0, "totalNotes": 0, "totalChatSessions": 0
        }


@router.get("/get_activity_heatmap")
def get_activity_heatmap(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=365)

        transactions = db.query(models.PointTransaction).filter(
            models.PointTransaction.user_id == user.id,
            models.PointTransaction.created_at >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).all()

        logger.info(f"Found {len(transactions)} point transactions for user {user.id}")

        activity_dict = {}
        for tx in transactions:
            date_str = tx.created_at.date().isoformat()
            activity_dict[date_str] = activity_dict.get(date_str, 0) + 1

        current_date = start_date
        heatmap_data = []

        while current_date <= end_date:
            date_str = current_date.isoformat()
            count = activity_dict.get(date_str, 0)

            if count == 0:
                level = 0
            elif count == 1:
                level = 1
            elif count <= 3:
                level = 2
            elif count <= 5:
                level = 3
            elif count <= 8:
                level = 4
            else:
                level = 5

            heatmap_data.append({
                "date": date_str,
                "count": count,
                "level": level
            })
            current_date += timedelta(days=1)

        total_count = sum(activity_dict.values())

        return {
            "heatmap_data": heatmap_data,
            "total_count": total_count,
            "date_range": {
                "start": start_date.isoformat() + 'Z',
                "end": end_date.isoformat() + 'Z'
            }
        }
    except Exception as e:
        logger.error(f"Error getting heatmap: {str(e)}")
        return {"heatmap_data": [], "total_count": 0, "date_range": {"start": "", "end": ""}}


@router.get("/get_recent_activities")
def get_recent_activities(user_id: str = Query(...), limit: int = Query(5), db: Session = Depends(get_db)):
    return []


@router.get("/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=6)

        daily_data = {}
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            daily_data[current_date] = {
                "date": current_date.isoformat(),
                "day": ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][current_date.weekday()],
                "points": 0,
                "ai_chats": 0,
                "notes": 0,
                "flashcards": 0,
                "quizzes": 0,
                "solo_quizzes": 0,
                "battles": 0,
                "study_minutes": 0
            }

        transactions = db.query(models.PointTransaction).filter(
            models.PointTransaction.user_id == user.id,
            models.PointTransaction.created_at >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).all()

        for t in transactions:
            date_key = t.created_at.date()
            if date_key in daily_data:
                daily_data[date_key]["points"] += t.points_earned

                if t.activity_type == "ai_chat":
                    daily_data[date_key]["ai_chats"] += 1
                elif t.activity_type == "note_created":
                    daily_data[date_key]["notes"] += 1
                elif t.activity_type in ["flashcard_set", "flashcard_reviewed", "flashcard_mastered"]:
                    daily_data[date_key]["flashcards"] += 1
                elif t.activity_type == "quiz_completed":
                    daily_data[date_key]["quizzes"] += 1
                elif t.activity_type == "solo_quiz":
                    daily_data[date_key]["solo_quizzes"] += 1
                elif t.activity_type in ["battle_win", "battle_draw", "battle_loss"]:
                    daily_data[date_key]["battles"] += 1
                elif t.activity_type == "study_time":
                    try:
                        if t.activity_metadata:
                            meta = ast.literal_eval(t.activity_metadata)
                            daily_data[date_key]["study_minutes"] += meta.get("minutes", 0)
                    except Exception:
                        pass

        weekly_data = []
        daily_breakdown = []
        total_points = 0

        for i in range(7):
            current_date = start_date + timedelta(days=i)
            day_data = daily_data[current_date]
            weekly_data.append(day_data["points"])
            daily_breakdown.append(day_data)
            total_points += day_data["points"]

        average_per_day = total_points / 7 if total_points > 0 else 0

        stats = db.query(models.UserGamificationStats).filter(
            models.UserGamificationStats.user_id == user.id
        ).first()

        return {
            "weekly_data": weekly_data,
            "daily_breakdown": daily_breakdown,
            "total_points": total_points,
            "average_per_day": round(average_per_day, 1),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "weekly_stats": {
                "ai_chats": stats.weekly_ai_chats if stats else 0,
                "notes_created": stats.weekly_notes_created if stats else 0,
                "flashcards_created": stats.weekly_flashcards_created if stats else 0,
                "quizzes_completed": stats.weekly_quizzes_completed if stats else 0,
                "solo_quizzes": getattr(stats, 'weekly_solo_quizzes', 0) if stats else 0,
                "battles_won": stats.weekly_battles_won if stats else 0,
                "study_minutes": stats.weekly_study_minutes if stats else 0
            }
        }

    except Exception as e:
        logger.error(f"Error getting weekly progress: {str(e)}")
        return {
            "weekly_data": [0, 0, 0, 0, 0, 0, 0],
            "total_sessions": 0,
            "average_per_day": 0
        }


@router.get("/get_analytics_history")
def get_analytics_history(
    user_id: str = Query(...),
    period: str = Query("week"),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        end_date = datetime.now(timezone.utc).date()
        if period == "week":
            start_date = end_date - timedelta(days=6)
            group_by = "day"
        elif period == "month":
            start_date = end_date - timedelta(days=29)
            group_by = "day"
        elif period == "year":
            start_date = end_date - timedelta(days=364)
            group_by = "week"
        else:
            earliest = db.query(func.min(models.PointTransaction.created_at)).filter(
                models.PointTransaction.user_id == user.id
            ).scalar()
            start_date = earliest.date() if earliest else end_date - timedelta(days=364)
            group_by = "month"

        transactions = db.query(models.PointTransaction).filter(
            models.PointTransaction.user_id == user.id,
            models.PointTransaction.created_at >= datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).order_by(models.PointTransaction.created_at.asc()).all()

        data_points = {}

        if group_by == "day":
            current = start_date
            while current <= end_date:
                key = current.isoformat()
                day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                data_points[key] = {
                    "date": key,
                    "day": day_names[current.weekday()],
                    "label": current.strftime("%b %d") if period == "month" else day_names[current.weekday()],
                    "points": 0,
                    "ai_chats": 0,
                    "notes": 0,
                    "flashcards": 0,
                    "quizzes": 0,
                    "solo_quizzes": 0,
                    "battles": 0,
                    "study_minutes": 0
                }
                current += timedelta(days=1)
        elif group_by == "week":
            current = start_date
            week_num = 0
            while current <= end_date:
                week_start = current
                week_end = min(current + timedelta(days=6), end_date)
                key = f"W{week_num}"
                data_points[key] = {
                    "date": week_start.isoformat(),
                    "day": key,
                    "label": week_start.strftime("%b %d"),
                    "points": 0,
                    "ai_chats": 0,
                    "notes": 0,
                    "flashcards": 0,
                    "quizzes": 0,
                    "solo_quizzes": 0,
                    "battles": 0,
                    "study_minutes": 0,
                    "_start": week_start,
                    "_end": week_end
                }
                current += timedelta(days=7)
                week_num += 1
        else:
            current = start_date.replace(day=1)
            while current <= end_date:
                key = current.strftime("%Y-%m")
                data_points[key] = {
                    "date": current.isoformat(),
                    "day": current.strftime("%b"),
                    "label": current.strftime("%b %Y"),
                    "points": 0,
                    "ai_chats": 0,
                    "notes": 0,
                    "flashcards": 0,
                    "quizzes": 0,
                    "solo_quizzes": 0,
                    "battles": 0,
                    "study_minutes": 0,
                    "_month": current.month,
                    "_year": current.year
                }
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

        for t in transactions:
            t_date = t.created_at.date()

            if group_by == "day":
                key = t_date.isoformat()
            elif group_by == "week":
                key = None
                for k, v in data_points.items():
                    if "_start" in v and v["_start"] <= t_date <= v["_end"]:
                        key = k
                        break
                if not key:
                    continue
            else:
                key = t_date.strftime("%Y-%m")

            if key not in data_points:
                continue

            data_points[key]["points"] += t.points_earned

            if t.activity_type == "ai_chat":
                data_points[key]["ai_chats"] += 1
            elif t.activity_type == "note_created":
                data_points[key]["notes"] += 1
            elif t.activity_type in ["flashcard_set", "flashcard_reviewed", "flashcard_mastered"]:
                data_points[key]["flashcards"] += 1
            elif t.activity_type == "quiz_completed":
                data_points[key]["quizzes"] += 1
            elif t.activity_type == "solo_quiz":
                data_points[key]["solo_quizzes"] += 1
            elif t.activity_type in ["battle_win", "battle_draw", "battle_loss"]:
                data_points[key]["battles"] += 1
            elif t.activity_type == "study_time":
                try:
                    if t.activity_metadata:
                        meta = ast.literal_eval(t.activity_metadata)
                        data_points[key]["study_minutes"] += meta.get("minutes", 0)
                except Exception:
                    pass

        history = []
        for key in sorted(data_points.keys()):
            item = {k: v for k, v in data_points[key].items() if not k.startswith("_")}
            history.append(item)

        total_points = sum(h["points"] for h in history)
        total_activities = sum(
            h["ai_chats"] + h["notes"] + h["flashcards"] + h["quizzes"] + h["solo_quizzes"] + h["battles"]
            for h in history
        )

        return {
            "history": history,
            "period": period,
            "group_by": group_by,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_points": total_points,
            "total_activities": total_activities,
            "data_points_count": len(history)
        }

    except Exception as e:
        logger.error(f"Error getting analytics history: {str(e)}")
        traceback.print_exc()
        return {"history": [], "period": period, "error": str(e)}


@router.get("/get_global_leaderboard")
def get_global_leaderboard(limit: int = Query(10), db: Session = Depends(get_db)):
    try:
        top_users = db.query(models.UserGamificationStats).order_by(
            models.UserGamificationStats.total_points.desc()
        ).limit(limit).all()

        leaderboard = []
        for stats in top_users:
            user = db.query(models.User).filter(models.User.id == stats.user_id).first()
            if user:
                leaderboard.append({
                    "user_id": user.id,
                    "username": user.username,
                    "total_points": stats.total_points,
                    "level": stats.level
                })

        return {"leaderboard": leaderboard}
    except Exception as e:
        logger.error(f"Error getting leaderboard: {str(e)}")
        return {"leaderboard": []}


@router.get("/get_learning_analytics")
def get_learning_analytics(user_id: str = Query(...), period: str = Query("week"), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=7)

    daily_metrics = db.query(models.DailyLearningMetrics).filter(
        models.DailyLearningMetrics.user_id == user.id,
        models.DailyLearningMetrics.date >= start_date,
        models.DailyLearningMetrics.date <= end_date
    ).all()

    total_sessions = len([m for m in daily_metrics if m.questions_answered > 0 or m.time_spent_minutes > 0])
    total_time_minutes = sum(m.time_spent_minutes for m in daily_metrics)
    total_questions = sum(m.questions_answered for m in daily_metrics)

    return {
        "period": "week",
        "start_date": start_date.isoformat() + 'Z',
        "end_date": end_date.isoformat() + 'Z',
        "total_sessions": total_sessions,
        "total_time_minutes": total_time_minutes,
        "total_questions": total_questions,
        "accuracy_percentage": 100,
        "average_per_day": 0,
        "days_active": total_sessions,
        "daily_data": []
    }


@router.get("/check_profile_quiz")
async def check_profile_quiz(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        has_completed_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.primary_archetype is not None and
            comprehensive_profile.primary_archetype != ""
        )

        has_skipped_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.quiz_skipped == True
        )

        quiz_flow_completed = has_completed_quiz or has_skipped_quiz

        logger.info(f"check_profile_quiz for {user_id}: completed={has_completed_quiz}, skipped={has_skipped_quiz}, flow_completed={quiz_flow_completed}")

        return {
            "completed": quiz_flow_completed,
            "quiz_completed": has_completed_quiz,
            "quiz_skipped": has_skipped_quiz,
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking quiz: {str(e)}")
        return {"completed": False}


@router.get("/is_first_time_user")
async def is_first_time_user(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc)

        user_created = user.created_at
        if user_created.tzinfo is None:
            user_created = user_created.replace(tzinfo=timezone.utc)

        user_last_login = user.last_login
        if user_last_login and user_last_login.tzinfo is None:
            user_last_login = user_last_login.replace(tzinfo=timezone.utc)

        if user_last_login:
            time_between_creation_and_login = abs((user_last_login - user_created).total_seconds())
            is_first_login = time_between_creation_and_login < 120
        else:
            is_first_login = True

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        has_completed_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.primary_archetype is not None and
            comprehensive_profile.primary_archetype != ""
        )

        has_skipped_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.quiz_skipped == True
        )

        quiz_flow_done = has_completed_quiz or has_skipped_quiz
        is_first_time = is_first_login and not quiz_flow_done
        time_since_creation = now - user_created

        logger.info(f"is_first_time_user for {user_id}: is_first_time={is_first_time}, is_first_login={is_first_login}, quiz_completed={has_completed_quiz}, quiz_skipped={has_skipped_quiz}, account_age_minutes={time_since_creation.total_seconds() / 60:.2f}")

        return {
            "is_first_time": is_first_time,
            "is_first_login": is_first_login,
            "account_age_minutes": time_since_creation.total_seconds() / 60,
            "quiz_completed": has_completed_quiz,
            "quiz_skipped": has_skipped_quiz,
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking first-time user: {str(e)}")
        return {"is_first_time": False}


@router.post("/start_session")
def start_session(
    user_id: str = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        session_id = f"{user.id}_{session_type}_{int(datetime.now(timezone.utc).timestamp())}"

        return {
            "status": "success",
            "session_id": session_id,
            "start_time": datetime.now(timezone.utc).isoformat() + 'Z',
            "message": f"Started {session_type} session"
        }

    except Exception as e:
        logger.error(f"Error starting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start session")


@router.post("/end_session")
def end_session(
    user_id: str = Form(...),
    session_id: str = Form(...),
    time_spent_minutes: float = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today = datetime.now(timezone.utc).date()
        daily_metric = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date == today
            )
        ).first()

        if not daily_metric:
            daily_metric = models.DailyLearningMetrics(
                user_id=user.id,
                date=today,
                sessions_completed=1,
                time_spent_minutes=time_spent_minutes,
                questions_answered=0,
                correct_answers=0,
                topics_studied="[]"
            )
            db.add(daily_metric)
        else:
            daily_metric.time_spent_minutes += time_spent_minutes
            daily_metric.sessions_completed = (daily_metric.sessions_completed or 0) + 1

        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()

        if not user_stats:
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)

        user_stats.total_hours += (time_spent_minutes / 60)
        user_stats.last_activity = datetime.now(timezone.utc)

        db.commit()

        logger.info(f"Session ended: user={user.email}, sessions_today={daily_metric.sessions_completed}, time={daily_metric.time_spent_minutes}")

        return {
            "status": "success",
            "message": f"Ended {session_type} session",
            "time_recorded": time_spent_minutes,
            "total_time_today": daily_metric.time_spent_minutes,
            "sessions_today": daily_metric.sessions_completed
        }

    except Exception as e:
        logger.error(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end session")


@router.get("/get_daily_goal_progress")
def get_daily_goal_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        today = datetime.now(timezone.utc).date()

        questions_today = db.query(models.Activity).filter(
            models.Activity.user_id == user.id,
            func.date(models.Activity.timestamp) == today
        ).count()

        daily_goal = 20

        activities = db.query(func.date(models.Activity.timestamp)).filter(
            models.Activity.user_id == user.id
        ).distinct().order_by(func.date(models.Activity.timestamp).desc()).all()

        streak = 0
        if activities:
            check_date = datetime.now(timezone.utc).date()
            for activity_date in [a[0] for a in activities]:
                if activity_date == check_date or activity_date == check_date - timedelta(days=1):
                    streak += 1
                    check_date = activity_date - timedelta(days=1)
                else:
                    break

        return {
            "questions_today": questions_today,
            "daily_goal": daily_goal,
            "percentage": min(int((questions_today / daily_goal) * 100), 100),
            "streak": streak
        }
    except Exception as e:
        logger.error(f"Error getting daily goal: {str(e)}")
        return {"questions_today": 0, "daily_goal": 20, "percentage": 0, "streak": 0}


@router.get("/admin/analytics/overview")
async def admin_analytics_overview(days: int = Query(30), x_user_id: str = Header(None, alias="X-User-Id")):
    from admin_analytics import get_analytics_overview
    return await get_analytics_overview(days, x_user_id)


@router.get("/admin/analytics/users")
async def admin_analytics_users(days: int = Query(30), x_user_id: str = Header(None, alias="X-User-Id")):
    from admin_analytics import get_user_analytics
    return await get_user_analytics(days, x_user_id)


@router.get("/admin/analytics/user/{target_user_id}")
async def admin_analytics_user_detail(target_user_id: int, x_user_id: str = Header(None, alias="X-User-Id")):
    from admin_analytics import get_user_detail
    return await get_user_detail(target_user_id, x_user_id)


@router.get("/admin/analytics/export/csv")
async def admin_analytics_export_csv(days: int = Query(30), x_user_id: str = Header(None, alias="X-User-Id")):
    from admin_analytics import export_analytics_csv
    return await export_analytics_csv(days, x_user_id)


@router.get("/admin/analytics/export/user/{target_user_id}/csv")
async def admin_analytics_export_user_csv(target_user_id: int, x_user_id: str = Header(None, alias="X-User-Id")):
    from admin_analytics import export_user_csv
    return await export_user_csv(target_user_id, x_user_id)


@router.get("/study_insights/comprehensive")
async def get_comprehensive_insights(
    user_id: str = Query(...),
    time_range: str = Query("overall", pattern="^(session|overall)$"),
    db: Session = Depends(get_db)
):
    try:
        from study_session_analyzer import get_study_session_analyzer

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        if time_range == "session":
            max_session_window = now - timedelta(hours=4)
            if user.last_login:
                login_time = user.last_login
                if hasattr(login_time, 'tzinfo') and login_time.tzinfo is None:
                    login_time = login_time.replace(tzinfo=timezone.utc)
                if hasattr(max_session_window, 'tzinfo') and max_session_window.tzinfo is None:
                    max_session_window = max_session_window.replace(tzinfo=timezone.utc)
                time_filter = max(login_time, max_session_window)
            else:
                time_filter = max_session_window
        else:
            time_filter = None

        analyzer = get_study_session_analyzer(db, user.id, unified_ai)
        session_summary = analyzer.generate_session_summary()
        ai_summary = await analyzer.generate_ai_summary()

        flashcard_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).all()

        total_flashcards = 0
        reviewed_flashcards = 0
        mastered_flashcards = 0
        struggling_flashcards = []

        for fset in flashcard_sets:
            cards = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == fset.id
            ).all()
            total_flashcards += len(cards)

            for card in cards:
                if card.times_reviewed and card.times_reviewed > 0:
                    reviewed_flashcards += 1
                    accuracy = (card.correct_count / card.times_reviewed * 100) if card.times_reviewed > 0 else 0

                    if accuracy >= 80 and card.times_reviewed >= 3:
                        mastered_flashcards += 1
                    elif accuracy < 50 and card.times_reviewed >= 2:
                        struggling_flashcards.append({
                            "question": card.question[:100],
                            "set_name": fset.title,
                            "accuracy": round(accuracy, 1),
                            "times_reviewed": card.times_reviewed
                        })

        quiz_query = db.query(models.SoloQuiz).filter(
            models.SoloQuiz.user_id == user.id,
            models.SoloQuiz.completed == True
        )

        if time_filter:
            quiz_query = quiz_query.filter(models.SoloQuiz.completed_at >= time_filter)

        solo_quizzes = quiz_query.order_by(models.SoloQuiz.completed_at.desc()).limit(20).all()

        quiz_stats = {
            "total_quizzes": len(solo_quizzes),
            "average_score": 0,
            "recent_quizzes": [],
            "by_difficulty": {"easy": [], "intermediate": [], "hard": []}
        }

        if solo_quizzes:
            scores = [q.score for q in solo_quizzes if q.score is not None]
            quiz_stats["average_score"] = round(sum(scores) / len(scores), 1) if scores else 0

            for quiz in solo_quizzes[:10]:
                quiz_data = {
                    "title": quiz.title,
                    "score": quiz.score,
                    "difficulty": quiz.difficulty,
                    "question_count": quiz.question_count,
                    "completed_at": quiz.completed_at.isoformat() if quiz.completed_at else None
                }
                quiz_stats["recent_quizzes"].append(quiz_data)

                if quiz.difficulty in quiz_stats["by_difficulty"]:
                    quiz_stats["by_difficulty"][quiz.difficulty].append(quiz.score)

        for diff in quiz_stats["by_difficulty"]:
            scores = quiz_stats["by_difficulty"][diff]
            quiz_stats["by_difficulty"][diff] = {
                "count": len(scores),
                "average": round(sum(scores) / len(scores), 1) if scores else 0
            }

        weak_areas = db.query(models.UserWeakArea).filter(
            models.UserWeakArea.user_id == user.id,
            models.UserWeakArea.status != "mastered"
        ).order_by(
            models.UserWeakArea.priority.desc(),
            models.UserWeakArea.weakness_score.desc()
        ).limit(10).all()

        weak_areas_data = [{
            "topic": wa.topic,
            "subtopic": wa.subtopic,
            "accuracy": round(wa.accuracy, 1),
            "weakness_score": round(wa.weakness_score, 1),
            "total_questions": wa.total_questions,
            "incorrect_count": wa.incorrect_count,
            "priority": wa.priority,
            "status": wa.status,
            "last_practiced": wa.last_practiced.isoformat() if wa.last_practiced else None
        } for wa in weak_areas]

        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user.id
        ).all()

        question_bank_stats = {
            "total_sets": len(question_sets),
            "total_questions": 0,
            "completed_questions": 0,
            "average_accuracy": 0
        }

        all_accuracies = []
        for qset in question_sets:
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == qset.id
            ).all()
            question_bank_stats["total_questions"] += len(questions)

            for q in questions:
                if hasattr(q, 'times_attempted') and q.times_attempted and q.times_attempted > 0:
                    question_bank_stats["completed_questions"] += 1
                    if hasattr(q, 'times_correct'):
                        accuracy = (q.times_correct / q.times_attempted * 100) if q.times_attempted > 0 else 0
                        all_accuracies.append(accuracy)

        if all_accuracies:
            question_bank_stats["average_accuracy"] = round(sum(all_accuracies) / len(all_accuracies), 1)

        notes_count = db.query(func.count(models.Note.id)).filter(
            models.Note.user_id == user.id
        ).scalar() or 0

        recent_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id
        ).order_by(models.Note.updated_at.desc()).limit(5).all()

        notes_data = {
            "total_notes": notes_count,
            "recent_notes": [{
                "id": note.id,
                "title": note.title,
                "updated_at": note.updated_at.isoformat() if note.updated_at else None
            } for note in recent_notes]
        }

        stats = db.query(models.UserGamificationStats).filter(
            models.UserGamificationStats.user_id == user.id
        ).first()

        time_stats = {
            "total_study_minutes": getattr(stats, 'total_study_minutes', 0) if stats else 0,
            "weekly_study_minutes": getattr(stats, 'weekly_study_minutes', 0) if stats else 0,
            "day_streak": calculate_day_streak(db, user.id),
            "total_points": getattr(stats, 'total_points', 0) if stats else 0
        }

        activity_query = db.query(models.PointTransaction).filter(
            models.PointTransaction.user_id == user.id
        )

        if time_filter:
            activity_query = activity_query.filter(models.PointTransaction.created_at >= time_filter)
        else:
            activity_query = activity_query.filter(models.PointTransaction.created_at >= week_ago)

        recent_activities = activity_query.order_by(
            models.PointTransaction.created_at.desc()
        ).limit(100).all()

        activity_breakdown = {
            "ai_chats": 0,
            "flashcards_reviewed": 0,
            "quizzes_completed": 0,
            "notes_created": 0,
            "questions_answered": 0
        }

        for activity in recent_activities:
            if activity.activity_type == "ai_chat":
                activity_breakdown["ai_chats"] += 1
            elif activity.activity_type in ["flashcard_reviewed", "flashcard_mastered"]:
                activity_breakdown["flashcards_reviewed"] += 1
            elif activity.activity_type in ["quiz_completed", "solo_quiz"]:
                activity_breakdown["quizzes_completed"] += 1
            elif activity.activity_type == "note_created":
                activity_breakdown["notes_created"] += 1
            elif activity.activity_type == "question_answered":
                activity_breakdown["questions_answered"] += 1

        return {
            "status": "success",
            "time_range": time_range,
            "time_filter_start": time_filter.isoformat() if time_filter else None,
            "user_name": user.first_name or user.username,
            "ai_summary": ai_summary,
            "session_data": session_summary,
            "flashcards": {
                "total": total_flashcards,
                "reviewed": reviewed_flashcards,
                "mastered": mastered_flashcards,
                "mastery_rate": round((mastered_flashcards / total_flashcards * 100), 1) if total_flashcards > 0 else 0,
                "struggling": struggling_flashcards[:5]
            },
            "quizzes": quiz_stats,
            "weak_areas": weak_areas_data,
            "question_bank": question_bank_stats,
            "notes": notes_data,
            "time_stats": time_stats,
            "activity_breakdown": activity_breakdown
        }

    except Exception as e:
        logger.error(f"Comprehensive insights error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/session_summary")
async def get_study_session_summary(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from study_session_analyzer import get_study_session_analyzer

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        analyzer = get_study_session_analyzer(db, user.id, unified_ai)
        summary = analyzer.generate_session_summary()

        return {
            "status": "success",
            "summary": summary
        }
    except Exception as e:
        logger.error(f"Error getting study session summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/ai_summary")
async def get_ai_study_summary(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from study_session_analyzer import get_study_session_analyzer

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        analyzer = get_study_session_analyzer(db, user.id, unified_ai)
        ai_summary = await analyzer.generate_ai_summary()

        return {
            "status": "success",
            "summary": ai_summary
        }
    except Exception as e:
        logger.error(f"Error getting AI study summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/strengths_weaknesses")
async def get_strengths_weaknesses(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from comprehensive_weakness_analyzer import get_comprehensive_weakness_analysis

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        result = get_comprehensive_weakness_analysis(db, user.id, models)
        return result

    except Exception as e:
        logger.error(f"Error getting comprehensive strengths/weaknesses: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/topic_suggestions")
async def get_topic_suggestions(
    user_id: str = Query(...),
    topic: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from comprehensive_weakness_analyzer import generate_topic_suggestions

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        result = generate_topic_suggestions(db, user.id, topic, models, unified_ai)
        return result

    except Exception as e:
        logger.error(f"Error generating topic suggestions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/similar_questions")
async def get_similar_questions(
    user_id: str = Query(...),
    topic: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from comprehensive_weakness_analyzer import find_similar_questions

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        result = find_similar_questions(db, user.id, topic, models)
        return result

    except Exception as e:
        logger.error(f"Error finding similar questions: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/recommendations")
async def get_study_recommendations(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from study_session_analyzer import get_study_session_analyzer

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        analyzer = get_study_session_analyzer(db, user.id, unified_ai)
        summary = analyzer.generate_session_summary()

        return {
            "status": "success",
            "recommendations": summary.get("recommendations", [])
        }
    except Exception as e:
        logger.error(f"Error getting study recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/debug_session")
async def debug_session_tracking(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.utcnow()

        last_login = user.last_login
        session_start = last_login if last_login else (now - timedelta(hours=4))

        messages_count = db.query(models.ChatMessage).join(
            models.ChatSession
        ).filter(
            models.ChatSession.user_id == user.id,
            models.ChatMessage.timestamp >= session_start
        ).count()

        total_messages = db.query(models.ChatMessage).join(
            models.ChatSession
        ).filter(
            models.ChatSession.user_id == user.id
        ).count()

        recent_messages = db.query(models.ChatMessage).join(
            models.ChatSession
        ).filter(
            models.ChatSession.user_id == user.id
        ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()

        recent_list = []
        for msg in recent_messages:
            recent_list.append({
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "user_message": msg.user_message[:100] if msg.user_message else None,
                "in_session": msg.timestamp >= session_start if msg.timestamp else False
            })

        return {
            "status": "success",
            "debug_info": {
                "user_id": user.id,
                "username": user.username,
                "last_login": last_login.isoformat() if last_login else None,
                "session_start": session_start.isoformat(),
                "current_time": now.isoformat(),
                "messages_in_session": messages_count,
                "total_messages": total_messages,
                "recent_messages": recent_list
            }
        }
    except Exception as e:
        logger.error(f"Error in debug session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study_insights/reset_stats")
async def reset_user_stats(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        sessions = db.query(models.ChatSession).filter(models.ChatSession.user_id == user.id).all()
        for session in sessions:
            db.query(models.ChatMessage).filter(models.ChatMessage.chat_session_id == session.id).delete()
        db.query(models.ChatSession).filter(models.ChatSession.user_id == user.id).delete()

        db.query(models.TopicMastery).filter(models.TopicMastery.user_id == user.id).delete()

        db.query(models.FlashcardStudySession).filter(models.FlashcardStudySession.user_id == user.id).delete()

        user.last_login = None

        db.commit()

        return {
            "status": "success",
            "message": "All stats reset. Please log out and log back in."
        }
    except Exception as e:
        logger.error(f"Error resetting stats: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study_insights/generate_content")
async def generate_study_content(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        content_type = payload.get("content_type")
        topic = payload.get("topic")
        count = payload.get("count", 5)
        context = payload.get("context", "")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        context_str = ""
        if context:
            context_str = f"\n\nThe student was working on problems like: {context}\nGenerate similar problems at the same level."

        if content_type == "flashcards":
            prompt = f"""Generate {count} flashcards for studying "{topic}".{context_str}

Return as JSON array with this format:
[
  {{"question": "...", "answer": "...", "difficulty": "easy|medium|hard"}},
  ...
]

Make the flashcards:
- SPECIFIC to {topic} (not generic)
- Include actual formulas, equations, or specific examples
- Progressive in difficulty
- Test understanding, not just memorization
Return ONLY the JSON array, no other text."""

            response = call_ai(prompt, max_tokens=1500, temperature=0.7)

            try:
                response = response.strip()
                if response.startswith("```"):
                    response = response.split("```")[1]
                    if response.startswith("json"):
                        response = response[4:]
                flashcards = json.loads(response)
            except Exception:
                flashcards = []

            return {
                "status": "success",
                "content_type": "flashcards",
                "topic": topic,
                "content": flashcards
            }

        elif content_type == "quiz":
            prompt = f"""Generate {count} multiple choice quiz questions about "{topic}".{context_str}

Return as JSON array with this format:
[
  {{
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "..."
  }},
  ...
]

Make questions:
- SPECIFIC to {topic} (include actual problems/calculations if math-related)
- Test understanding, not just memorization
- Include step-by-step explanations
Return ONLY the JSON array, no other text."""

            response = call_ai(prompt, max_tokens=2000, temperature=0.7)

            try:
                response = response.strip()
                if response.startswith("```"):
                    response = response.split("```")[1]
                    if response.startswith("json"):
                        response = response[4:]
                questions = json.loads(response)
            except Exception:
                questions = []

            return {
                "status": "success",
                "content_type": "quiz",
                "topic": topic,
                "content": questions
            }

        elif content_type == "notes":
            prompt = f"""Create comprehensive study notes about "{topic}".

Include:
1. Key concepts and definitions
2. Important formulas or rules (if applicable)
3. Examples
4. Common mistakes to avoid
5. Summary points

Format with clear headings and bullet points.
Make it suitable for exam preparation."""

            response = call_ai(prompt, max_tokens=2000, temperature=0.7)

            return {
                "status": "success",
                "content_type": "notes",
                "topic": topic,
                "content": response
            }

        else:
            raise HTTPException(status_code=400, detail="Invalid content_type")

    except Exception as e:
        logger.error(f"Error generating study content: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/study_insights/welcome_notification")
async def get_welcome_notification(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        from study_session_analyzer import get_study_session_analyzer

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        analyzer = get_study_session_analyzer(db, user.id, unified_ai)

        ai_summary = await analyzer.generate_ai_summary()

        summary = analyzer.generate_session_summary()

        has_recent_activity = summary.get("summary", {}).get("total_activities", 0) > 0

        user_name = user.first_name or user.username.split('@')[0]

        return {
            "status": "success",
            "notification": {
                "title": "Welcome Back!" if has_recent_activity else "Welcome!",
                "message": ai_summary,
                "has_insights": has_recent_activity,
                "user_name": user_name,
                "quick_stats": {
                    "chat_messages": summary.get("summary", {}).get("chat_messages", 0),
                    "flashcards_studied": summary.get("summary", {}).get("flashcards_studied", 0),
                    "quiz_questions": summary.get("summary", {}).get("quiz_questions", 0),
                    "overall_accuracy": summary.get("summary", {}).get("overall_accuracy", 0)
                },
                "top_weakness": summary.get("weaknesses", [{}])[0] if summary.get("weaknesses") else None,
                "top_recommendation": summary.get("recommendations", [{}])[0] if summary.get("recommendations") else None
            }
        }
    except Exception as e:
        logger.error(f"Error getting welcome notification: {str(e)}")
        return {
            "status": "success",
            "notification": {
                "title": "Welcome Back!",
                "message": "Ready to continue learning?",
                "has_insights": False
            }
        }
