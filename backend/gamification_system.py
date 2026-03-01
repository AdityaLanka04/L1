"""
Centralized Gamification System
Handles all point calculations, level progression, and activity tracking
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)
import models
from models import PointTransaction

POINT_VALUES = {
    "ai_chat": 1,
    "note_created": 20,
    "flashcard_set": 10,
    "flashcard_created": 10,
    "quiz_high_score": 30,
    "quiz_completed": 15,
    "study_hour": 50,
    "question_answered": 2,
    "battle_win": 10,
    "battle_draw": 5,
    "battle_loss": 2,
    "flashcard_reviewed": 1,
    "flashcard_mastered": 5,
    "learning_path_node": 0,
}

MILESTONE_COUNTS = {
    "ai_chat": [10, 50, 100, 250, 500],
    "note_created": [1, 5, 10, 25, 50, 100],
    "flashcard_created": [1, 5, 10, 25, 50, 100],
    "question_answered": [10, 50, 100, 250, 500, 1000],
    "quiz_completed": [1, 5, 10, 25, 50],
    "solo_quiz": [1, 5, 10, 25],
    "flashcard_reviewed": [25, 50, 100, 250, 500],
    "flashcard_mastered": [5, 10, 25, 50, 100],
}

STUDY_TIME_MILESTONES_MINUTES = [30, 60, 120, 300, 600, 1200]

def _add_notification(db: Session, user_id: int, title: str, message: str, notification_type: str):
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type
    )
    db.add(notification)

def _format_minutes(total_minutes: int) -> str:
    if total_minutes < 60:
        return f"{total_minutes} minutes"
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if minutes == 0:
        return f"{hours} hour{'s' if hours != 1 else ''}"
    return f"{hours}h {minutes}m"

DIFFICULTY_MULTIPLIERS = {
    "easy": 0.5,
    "intermediate": 0.75,
    "hard": 1.0
}

QUESTION_COUNT_MULTIPLIERS = {
    5: 0.5,
    10: 0.75,
    15: 0.9,
    20: 1.0
}

def calculate_solo_quiz_points(difficulty: str, question_count: int, score_percentage: float) -> dict:
    """
    Calculate points for solo quiz completion.
    
    Formula: base_points * difficulty_mult * question_mult * score_mult
    Max possible: 40 points (hard, 20 questions, 100% score)
    
    Args:
        difficulty: easy, intermediate, hard
        question_count: 5, 10, 15, or 20
        score_percentage: 0-100
    
    Returns:
        dict with points_earned, breakdown, bonus info
    """
    base_points = 40
    
    diff_mult = DIFFICULTY_MULTIPLIERS.get(difficulty.lower(), 0.75)
    
    q_mult = 0.5
    for q_count, mult in sorted(QUESTION_COUNT_MULTIPLIERS.items()):
        if question_count >= q_count:
            q_mult = mult
    
    score_mult = score_percentage / 100.0
    
    points = int(base_points * diff_mult * q_mult * score_mult)
    
    bonus = 0
    bonus_reasons = []
    
    if score_percentage == 100:
        bonus += 5
        bonus_reasons.append("Perfect Score (+5)")
    
    elif score_percentage >= 90:
        bonus += 3
        bonus_reasons.append("Excellent Score (+3)")
    
    if difficulty.lower() == "hard" and score_percentage >= 70:
        bonus += 2
        bonus_reasons.append("Hard Mode Bonus (+2)")
    
    total_points = points + bonus
    
    return {
        "points_earned": total_points,
        "base_points": points,
        "bonus_points": bonus,
        "bonus_reasons": bonus_reasons,
        "breakdown": {
            "difficulty": difficulty,
            "difficulty_multiplier": diff_mult,
            "question_count": question_count,
            "question_multiplier": q_mult,
            "score_percentage": score_percentage,
            "score_multiplier": score_mult
        }
    }

LEVEL_THRESHOLDS = [0, 100, 282, 500, 800, 1200, 1700, 2300, 3000]

def get_week_start():
    """Get the start of the current week (Monday)"""
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())

def calculate_level_from_xp(xp: int) -> int:
    """Calculate level based on XP"""
    for level, threshold in enumerate(LEVEL_THRESHOLDS):
        if xp < threshold:
            return max(1, level)
    return len(LEVEL_THRESHOLDS) + int((xp - LEVEL_THRESHOLDS[-1]) / 1000)

def get_xp_for_level(level: int) -> int:
    """Get XP required to reach a specific level"""
    if level < len(LEVEL_THRESHOLDS):
        return LEVEL_THRESHOLDS[level]
    else:
        return LEVEL_THRESHOLDS[-1] + ((level - len(LEVEL_THRESHOLDS) + 1) * 1000)

def get_or_create_stats(db: Session, user_id: int):
    """Get or create gamification stats for a user"""
    stats = db.query(models.UserGamificationStats).filter(
        models.UserGamificationStats.user_id == user_id
    ).first()
    
    if not stats:
        stats = models.UserGamificationStats(
            user_id=user_id,
            week_start_date=datetime.combine(get_week_start(), datetime.min.time()).replace(tzinfo=timezone.utc)
        )
        db.add(stats)
        db.flush()
    
    return stats

def check_and_reset_weekly_stats(stats):
    """Check if weekly stats need to be reset"""
    week_start = get_week_start()
    if stats.week_start_date is None:
        needs_reset = True
    elif hasattr(stats.week_start_date, 'date'):
        needs_reset = stats.week_start_date.date() < week_start
    else:
        needs_reset = stats.week_start_date < week_start
    
    if needs_reset:
        logger.info(f" WEEKLY RESET: Resetting weekly stats for user {stats.user_id}")
        logger.info(f"   Previous week start: {stats.week_start_date}")
        logger.info(f"   New week start: {week_start}")
        logger.info(f"   Previous weekly_points: {stats.weekly_points}")
        stats.weekly_points = 0
        stats.weekly_ai_chats = 0
        stats.weekly_notes_created = 0
        stats.weekly_questions_answered = 0
        stats.weekly_quizzes_completed = 0
        stats.weekly_flashcards_created = 0
        stats.weekly_study_minutes = 0
        stats.weekly_battles_won = 0
        if hasattr(stats, 'weekly_solo_quizzes'):
            stats.weekly_solo_quizzes = 0
        if hasattr(stats, 'weekly_flashcards_reviewed'):
            stats.weekly_flashcards_reviewed = 0
        if hasattr(stats, 'weekly_flashcards_mastered'):
            stats.weekly_flashcards_mastered = 0
        stats.week_start_date = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc)
        logger.info(f"    Weekly stats reset complete")
    else:
        logger.info(f" Weekly stats current for user {stats.user_id} (week_start: {stats.week_start_date}, current_week: {week_start})")

def award_points(db: Session, user_id: int, activity_type: str, metadata: dict = None):
    """
    Award points for an activity
    
    Args:
        db: Database session
        user_id: User ID
        activity_type: Type of activity (ai_chat, note_created, etc.)
        metadata: Additional data (e.g., minutes for study_time)
    
    Returns:
        dict with points_earned, total_points, level
    """
    if metadata is None:
        metadata = {}
    
    stats = get_or_create_stats(db, user_id)
    check_and_reset_weekly_stats(stats)
    
    from datetime import datetime, timedelta, timezone
    duplicate_types = [activity_type]
    if activity_type in ("flashcard_set", "flashcard_created"):
        duplicate_types = ["flashcard_set", "flashcard_created"]
    recent_transaction = db.query(PointTransaction).filter(
        PointTransaction.user_id == user_id,
        PointTransaction.activity_type.in_(duplicate_types),
        PointTransaction.created_at >= datetime.now(timezone.utc) - timedelta(seconds=2)
    ).first()
    
    if recent_transaction:
        logger.info(f"  Duplicate {activity_type} detected within 2 seconds - skipping")
        return {
            "points_earned": 0,
            "total_points": stats.total_points,
            "level": stats.level,
            "experience": stats.experience,
            "description": f"Duplicate {activity_type} (skipped)"
        }
    
    points_earned = 0
    description = ""
    
    if activity_type == "ai_chat":
        points_earned = POINT_VALUES["ai_chat"]
        stats.total_ai_chats += 1
        stats.weekly_ai_chats += 1
        description = "AI Chat Message"
        if stats.total_ai_chats in MILESTONE_COUNTS["ai_chat"]:
            _add_notification(
                db,
                user_id,
                "AI Chat Milestone",
                f"You've sent {stats.total_ai_chats} messages to your AI tutor. Keep the conversation going!",
                "ai_chat_milestone"
            )
        
    elif activity_type == "note_created":
        points_earned = POINT_VALUES["note_created"]
        stats.total_notes_created += 1
        stats.weekly_notes_created += 1
        description = "Created Note"
        if stats.total_notes_created in MILESTONE_COUNTS["note_created"]:
            _add_notification(
                db,
                user_id,
                "Notes Milestone",
                f"You've created {stats.total_notes_created} notes. Great job capturing insights!",
                "notes_milestone"
            )
        
    elif activity_type == "question_answered":
        points_earned = POINT_VALUES["question_answered"]
        stats.total_questions_answered += 1
        stats.weekly_questions_answered += 1
        description = "Answered Question"
        if stats.total_questions_answered in MILESTONE_COUNTS["question_answered"]:
            _add_notification(
                db,
                user_id,
                "Practice Milestone",
                f"You've answered {stats.total_questions_answered} questions. Keep sharpening your skills!",
                "questions_milestone"
            )
        
    elif activity_type in ("flashcard_set", "flashcard_created"):
        points_earned = POINT_VALUES["flashcard_set"]
        stats.total_flashcards_created += 1
        stats.weekly_flashcards_created += 1
        description = "Created Flashcard Set"
        if stats.total_flashcards_created in MILESTONE_COUNTS["flashcard_created"]:
            _add_notification(
                db,
                user_id,
                "Flashcards Milestone",
                f"You've created {stats.total_flashcards_created} flashcard sets. Keep building your memory bank!",
                "flashcards_milestone"
            )
        
    elif activity_type == "quiz_completed":
        raw_score = metadata.get("score_percentage")
        has_score = raw_score is not None
        try:
            score_percentage = float(raw_score) if has_score else 0
        except (TypeError, ValueError):
            score_percentage = 0
            has_score = False
        if score_percentage >= 80:
            points_earned = POINT_VALUES["quiz_high_score"]
            description = f"Completed Quiz with {score_percentage}% (High Score Bonus!)"
        else:
            points_earned = POINT_VALUES["quiz_completed"]
            description = f"Completed Quiz with {score_percentage}%" if has_score else "Completed Quiz"
        stats.total_quizzes_completed += 1
        stats.weekly_quizzes_completed += 1

        if has_score:
            if score_percentage >= 90:
                _add_notification(
                    db,
                    user_id,
                    "Excellent Work!",
                    f"Amazing! You scored {score_percentage}% on a quiz. Keep it up!",
                    "quiz_excellent"
                )
            elif score_percentage < 50:
                _add_notification(
                    db,
                    user_id,
                    "Quiz Performance Alert",
                    f"Your recent quiz score was {score_percentage}%. Review the material and try again to improve!",
                    "quiz_poor_performance"
                )
            else:
                _add_notification(
                    db,
                    user_id,
                    "Quiz Completed",
                    f"You completed a quiz with {score_percentage}%. Nice work!",
                    "quiz_completed"
                )

        if stats.total_quizzes_completed in MILESTONE_COUNTS["quiz_completed"]:
            _add_notification(
                db,
                user_id,
                "Quiz Milestone",
                f"You've completed {stats.total_quizzes_completed} quizzes. Keep testing your knowledge!",
                "quiz_milestone"
            )
        
    elif activity_type == "study_time":
        minutes = metadata.get("minutes", 0)
        hours = minutes / 60
        points_earned = int(hours * POINT_VALUES["study_hour"])
        prev_minutes = stats.total_study_minutes
        stats.total_study_minutes += minutes
        stats.weekly_study_minutes += minutes
        if minutes >= 60:
            description = f"Studied {int(hours)}h {minutes % 60}m (+{points_earned} pts)"
        else:
            description = f"Studied {minutes} minutes"

        for threshold in STUDY_TIME_MILESTONES_MINUTES:
            if prev_minutes < threshold <= stats.total_study_minutes:
                formatted = _format_minutes(threshold)
                _add_notification(
                    db,
                    user_id,
                    "Study Time Milestone",
                    f"You've studied for {formatted} in total. Keep it up!",
                    "study_time_milestone"
                )
        
    elif activity_type == "battle_win":
        points_earned = POINT_VALUES["battle_win"]
        stats.total_battles_won += 1
        stats.weekly_battles_won += 1
        description = "Won Battle"
        
    elif activity_type == "battle_draw":
        points_earned = POINT_VALUES["battle_draw"]
        description = "Drew Battle"
        
    elif activity_type == "battle_loss":
        points_earned = POINT_VALUES["battle_loss"]
        description = "Participated in Battle"
    
    elif activity_type == "learning_path_node":
        xp = metadata.get("xp", 50)
        points_earned = xp
        node_id = metadata.get("node_id", "unknown")
        description = f"Completed Learning Path Node (+{xp} XP)"
    
    elif activity_type == "solo_quiz":
        difficulty = metadata.get("difficulty", "intermediate")
        question_count = metadata.get("question_count", 10)
        try:
            score_percentage = float(metadata.get("score_percentage", 0))
        except (TypeError, ValueError):
            score_percentage = 0
        
        quiz_result = calculate_solo_quiz_points(difficulty, question_count, score_percentage)
        points_earned = quiz_result["points_earned"]
        
        if hasattr(stats, 'total_solo_quizzes'):
            stats.total_solo_quizzes += 1
        if hasattr(stats, 'weekly_solo_quizzes'):
            stats.weekly_solo_quizzes += 1
        
        stats.total_quizzes_completed += 1
        stats.weekly_quizzes_completed += 1
        
        bonus_str = f" ({', '.join(quiz_result['bonus_reasons'])})" if quiz_result['bonus_reasons'] else ""
        description = f"Solo Quiz: {difficulty.title()} {question_count}Q - {score_percentage}%{bonus_str}"

        if 50 <= score_percentage < 90:
            _add_notification(
                db,
                user_id,
                "Quiz Completed",
                f"You completed a solo quiz with {score_percentage}%. Keep practicing!",
                "quiz_completed"
            )

        if hasattr(stats, 'total_solo_quizzes') and stats.total_solo_quizzes in MILESTONE_COUNTS["solo_quiz"]:
            _add_notification(
                db,
                user_id,
                "Solo Quiz Milestone",
                f"You've completed {stats.total_solo_quizzes} solo quizzes. Nice work!",
                "quiz_milestone"
            )
    
    elif activity_type == "flashcard_reviewed":
        points_earned = POINT_VALUES["flashcard_reviewed"]
        if hasattr(stats, 'total_flashcards_reviewed'):
            stats.total_flashcards_reviewed += 1
        if hasattr(stats, 'weekly_flashcards_reviewed'):
            stats.weekly_flashcards_reviewed += 1
        description = "Reviewed Flashcard"
        if hasattr(stats, 'total_flashcards_reviewed') and stats.total_flashcards_reviewed in MILESTONE_COUNTS["flashcard_reviewed"]:
            _add_notification(
                db,
                user_id,
                "Flashcards Milestone",
                f"You've reviewed {stats.total_flashcards_reviewed} flashcards. Great consistency!",
                "flashcards_milestone"
            )
    
    elif activity_type == "flashcard_mastered":
        points_earned = POINT_VALUES["flashcard_mastered"]
        if hasattr(stats, 'total_flashcards_mastered'):
            stats.total_flashcards_mastered += 1
        if hasattr(stats, 'weekly_flashcards_mastered'):
            stats.weekly_flashcards_mastered += 1
        description = "Mastered Flashcard"
        if hasattr(stats, 'total_flashcards_mastered') and stats.total_flashcards_mastered in MILESTONE_COUNTS["flashcard_mastered"]:
            _add_notification(
                db,
                user_id,
                "Flashcard Mastery",
                f"You've mastered {stats.total_flashcards_mastered} flashcards. Impressive!",
                "flashcard_mastered"
            )
    
    old_level = stats.level
    stats.total_points += points_earned
    stats.weekly_points += points_earned
    stats.experience = stats.total_points
    stats.level = calculate_level_from_xp(stats.experience)
    
    logger.info(f" POINTS AWARDED: {points_earned} pts for {activity_type}")
    logger.info(f"   User: {user_id}")
    logger.info(f"   Total Points: {stats.total_points}")
    logger.info(f"   Weekly Points: {stats.weekly_points}")
    logger.info(f"   Level: {stats.level}")
    
    if stats.level > old_level:
        notification = models.Notification(
            user_id=user_id,
            title=f"Level Up! Now Level {stats.level}",
            message=f"Congratulations! You've reached level {stats.level}. Keep learning to unlock more!",
            notification_type="level_up"
        )
        db.add(notification)
    
    today = datetime.now(timezone.utc).date()
    streak_milestone_reached = False
    old_streak = stats.current_streak
    
    if stats.last_activity_date:
        if hasattr(stats.last_activity_date, 'date'):
            last_date = stats.last_activity_date.date()
        else:
            last_date = stats.last_activity_date
        if last_date == today:
            pass
        elif last_date == today - timedelta(days=1):
            stats.current_streak += 1
            if stats.current_streak > stats.longest_streak:
                stats.longest_streak = stats.current_streak
            if stats.current_streak in [7, 14, 30, 60, 100]:
                streak_milestone_reached = True
        else:
            if old_streak >= 7:
                notification = models.Notification(
                    user_id=user_id,
                    title="Streak Broken",
                    message=f"Your {old_streak}-day streak has ended. Start a new one today!",
                    notification_type="streak_broken"
                )
                db.add(notification)
            stats.current_streak = 1
    else:
        stats.current_streak = 1
    
    stats.last_activity_date = datetime.now(timezone.utc)
    
    if streak_milestone_reached:
        notification = models.Notification(
            user_id=user_id,
            title=f"{stats.current_streak}-Day Streak!",
            message=f"Incredible! You've maintained a {stats.current_streak}-day learning streak. Keep it going!",
            notification_type="streak_milestone"
        )
        db.add(notification)
    
    transaction = models.PointTransaction(
        user_id=user_id,
        activity_type=activity_type,
        points_earned=points_earned,
        description=description,
        activity_metadata=str(metadata) if metadata else None
    )
    db.add(transaction)
    db.commit()
    
    return {
        "points_earned": points_earned,
        "total_points": stats.total_points,
        "level": stats.level,
        "experience": stats.experience
    }

def get_user_stats(db: Session, user_id: int):
    """Get user's gamification stats"""
    stats = get_or_create_stats(db, user_id)
    check_and_reset_weekly_stats(stats)
    
    today = datetime.now(timezone.utc).date()
    if stats.last_activity_date:
        if hasattr(stats.last_activity_date, 'date'):
            last_date = stats.last_activity_date.date()
        else:
            last_date = stats.last_activity_date
        
        if last_date < today - timedelta(days=1):
            stats.current_streak = 0
    
    db.commit()
    
    next_level_xp = get_xp_for_level(stats.level + 1)
    xp_to_next_level = next_level_xp - stats.experience
    
    all_stats = db.query(models.UserGamificationStats).order_by(
        models.UserGamificationStats.total_points.desc()
    ).all()
    rank = next((i + 1 for i, s in enumerate(all_stats) if s.user_id == user_id), None)
    
    total_chat_sessions = db.query(func.count(func.distinct(models.ChatSession.id))).join(
        models.ChatMessage, models.ChatMessage.chat_session_id == models.ChatSession.id
    ).filter(
        models.ChatSession.user_id == user_id
    ).scalar() or 0
    
    current_messages = db.query(func.count(models.ChatMessage.id)).join(
        models.ChatSession, models.ChatMessage.chat_session_id == models.ChatSession.id
    ).filter(
        models.ChatSession.user_id == user_id
    ).scalar() or 0
    
    return {
        "total_points": stats.total_points,
        "weekly_points": stats.weekly_points,
        "level": stats.level,
        "experience": stats.experience,
        "xp_to_next_level": xp_to_next_level,
        "next_level_xp": next_level_xp,
        "rank": rank,
        "global_rank": rank,
        "current_streak": stats.current_streak,
        "longest_streak": stats.longest_streak,
        "weekly_ai_chats": stats.weekly_ai_chats,
        "weekly_notes_created": stats.weekly_notes_created,
        "weekly_questions_answered": stats.weekly_questions_answered,
        "weekly_quizzes_completed": stats.weekly_quizzes_completed,
        "weekly_flashcards_created": stats.weekly_flashcards_created,
        "weekly_study_minutes": stats.weekly_study_minutes,
        "weekly_battles_won": stats.weekly_battles_won,
        "weekly_solo_quizzes": getattr(stats, 'weekly_solo_quizzes', 0),
        "weekly_flashcards_reviewed": getattr(stats, 'weekly_flashcards_reviewed', 0),
        "weekly_flashcards_mastered": getattr(stats, 'weekly_flashcards_mastered', 0),
        "total_ai_chats": stats.total_ai_chats,
        "total_chat_sessions": total_chat_sessions,
        "current_messages": current_messages,
        "total_notes_created": stats.total_notes_created,
        "total_questions_answered": stats.total_questions_answered,
        "total_quizzes_completed": stats.total_quizzes_completed,
        "total_flashcards_created": stats.total_flashcards_created,
        "total_study_minutes": stats.total_study_minutes,
        "total_battles_won": stats.total_battles_won,
        "total_solo_quizzes": getattr(stats, 'total_solo_quizzes', 0),
        "total_flashcards_reviewed": getattr(stats, 'total_flashcards_reviewed', 0),
        "total_flashcards_mastered": getattr(stats, 'total_flashcards_mastered', 0)
    }

def recalculate_all_stats(db: Session):
    """Recalculate stats for all users from scratch"""
    users = db.query(models.User).all()
    week_start_datetime = datetime.combine(get_week_start(), datetime.min.time()).replace(tzinfo=timezone.utc)
    
    for user in users:
        stats = get_or_create_stats(db, user.id)
        
        stats.total_points = 0
        stats.weekly_points = 0
        stats.total_ai_chats = 0
        stats.weekly_ai_chats = 0
        stats.total_notes_created = 0
        stats.weekly_notes_created = 0
        stats.total_questions_answered = 0
        stats.weekly_questions_answered = 0
        stats.total_quizzes_completed = 0
        stats.weekly_quizzes_completed = 0
        stats.total_flashcards_created = 0
        stats.weekly_flashcards_created = 0
        stats.total_study_minutes = 0
        stats.weekly_study_minutes = 0
        stats.total_battles_won = 0
        stats.weekly_battles_won = 0
        
        total_chats = db.query(func.count(models.ChatMessage.id)).filter(
            models.ChatMessage.user_id == user.id
        ).scalar() or 0
        weekly_chats = db.query(func.count(models.ChatMessage.id)).filter(
            models.ChatMessage.user_id == user.id,
            models.ChatMessage.timestamp >= week_start_datetime
        ).scalar() or 0
        
        stats.total_ai_chats = total_chats
        stats.weekly_ai_chats = weekly_chats
        stats.total_points += total_chats * POINT_VALUES["ai_chat"]
        stats.weekly_points += weekly_chats * POINT_VALUES["ai_chat"]
        
        total_notes = db.query(func.count(models.Note.id)).filter(
            models.Note.user_id == user.id
        ).scalar() or 0
        weekly_notes = db.query(func.count(models.Note.id)).filter(
            models.Note.user_id == user.id,
            models.Note.created_at >= week_start_datetime
        ).scalar() or 0
        
        stats.total_notes_created = total_notes
        stats.weekly_notes_created = weekly_notes
        stats.total_points += total_notes * POINT_VALUES["note_created"]
        stats.weekly_points += weekly_notes * POINT_VALUES["note_created"]
        
        total_flashcards = db.query(func.count(models.FlashcardSet.id)).filter(
            models.FlashcardSet.user_id == user.id
        ).scalar() or 0
        weekly_flashcards = db.query(func.count(models.FlashcardSet.id)).filter(
            models.FlashcardSet.user_id == user.id,
            models.FlashcardSet.created_at >= week_start_datetime
        ).scalar() or 0
        
        stats.total_flashcards_created = total_flashcards
        stats.weekly_flashcards_created = weekly_flashcards
        stats.total_points += total_flashcards * POINT_VALUES["flashcard_set"]
        stats.weekly_points += weekly_flashcards * POINT_VALUES["flashcard_set"]
        
        stats.experience = stats.total_points
        stats.level = calculate_level_from_xp(stats.experience)
        stats.week_start_date = week_start_datetime
        stats.last_activity_date = datetime.now(timezone.utc)
    
    db.commit()
    return len(users)
