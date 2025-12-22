"""
Centralized Gamification System
Handles all point calculations, level progression, and activity tracking
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
import models
from models import PointTransaction

# ==================== POINT VALUES ====================
POINT_VALUES = {
    "ai_chat": 1,           # AI chat message
    "note_created": 20,     # Create note (AI chat, audio, or own)
    "flashcard_set": 10,    # Flashcard set created
    "quiz_high_score": 30,  # Quiz with 80%+ score
    "quiz_completed": 15,   # Complete quiz (any score)
    "study_hour": 50,       # Study 1 hour on app
    "question_answered": 2, # Answer question
    "battle_win": 10,       # Battle win
    "battle_draw": 5,       # Battle draw
    "battle_loss": 2,       # Battle loss (participation)
    "flashcard_reviewed": 1, # Review a flashcard
    "flashcard_mastered": 5, # Master a flashcard
}

# ==================== SOLO QUIZ POINT FORMULA ====================
# Max points: 40 (hard difficulty, max questions)
# Formula: base_points * difficulty_multiplier * question_multiplier * score_multiplier

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
    base_points = 40  # Maximum possible points
    
    # Get multipliers
    diff_mult = DIFFICULTY_MULTIPLIERS.get(difficulty.lower(), 0.75)
    
    # Find closest question count multiplier
    q_mult = 0.5
    for q_count, mult in sorted(QUESTION_COUNT_MULTIPLIERS.items()):
        if question_count >= q_count:
            q_mult = mult
    
    # Score multiplier (0-1 based on percentage)
    score_mult = score_percentage / 100.0
    
    # Calculate base points
    points = int(base_points * diff_mult * q_mult * score_mult)
    
    # Bonus points
    bonus = 0
    bonus_reasons = []
    
    # Perfect score bonus
    if score_percentage == 100:
        bonus += 5
        bonus_reasons.append("Perfect Score (+5)")
    
    # High score bonus (90%+)
    elif score_percentage >= 90:
        bonus += 3
        bonus_reasons.append("Excellent Score (+3)")
    
    # Hard difficulty bonus
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

# ==================== LEVEL THRESHOLDS ====================
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
    # For levels beyond threshold list
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
    # Handle both datetime and date objects
    if stats.week_start_date is None:
        needs_reset = True
    elif hasattr(stats.week_start_date, 'date'):
        needs_reset = stats.week_start_date.date() < week_start
    else:
        needs_reset = stats.week_start_date < week_start
    
    if needs_reset:
        stats.weekly_points = 0
        stats.weekly_ai_chats = 0
        stats.weekly_notes_created = 0
        stats.weekly_questions_answered = 0
        stats.weekly_quizzes_completed = 0
        stats.weekly_flashcards_created = 0
        stats.weekly_study_minutes = 0
        stats.weekly_battles_won = 0
        # Reset new weekly stats
        if hasattr(stats, 'weekly_solo_quizzes'):
            stats.weekly_solo_quizzes = 0
        if hasattr(stats, 'weekly_flashcards_reviewed'):
            stats.weekly_flashcards_reviewed = 0
        if hasattr(stats, 'weekly_flashcards_mastered'):
            stats.weekly_flashcards_mastered = 0
        stats.week_start_date = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc)

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
    
    # Get or create stats
    stats = get_or_create_stats(db, user_id)
    check_and_reset_weekly_stats(stats)
    
    # Prevent duplicate tracking within 2 seconds
    from datetime import datetime, timedelta, timezone
    recent_transaction = db.query(PointTransaction).filter(
        PointTransaction.user_id == user_id,
        PointTransaction.activity_type == activity_type,
        PointTransaction.created_at >= datetime.now(timezone.utc) - timedelta(seconds=2)
    ).first()
    
    if recent_transaction:
        print(f"⚠️  Duplicate {activity_type} detected within 2 seconds - skipping")
        return {
            "points_earned": 0,
            "total_points": stats.total_points,
            "level": stats.level,
            "experience": stats.experience,
            "description": f"Duplicate {activity_type} (skipped)"
        }
    
    # Calculate points
    points_earned = 0
    description = ""
    
    if activity_type == "ai_chat":
        points_earned = POINT_VALUES["ai_chat"]
        stats.total_ai_chats += 1
        stats.weekly_ai_chats += 1
        description = "AI Chat Message"
        
    elif activity_type == "note_created":
        points_earned = POINT_VALUES["note_created"]
        stats.total_notes_created += 1
        stats.weekly_notes_created += 1
        description = "Created Note"
        
    elif activity_type == "question_answered":
        points_earned = POINT_VALUES["question_answered"]
        stats.total_questions_answered += 1
        stats.weekly_questions_answered += 1
        description = "Answered Question"
        
    elif activity_type == "flashcard_set":
        points_earned = POINT_VALUES["flashcard_set"]
        stats.total_flashcards_created += 1
        stats.weekly_flashcards_created += 1
        description = "Created Flashcard Set"
        
    elif activity_type == "quiz_completed":
        score_percentage = metadata.get("score_percentage", 0)
        if score_percentage >= 80:
            points_earned = POINT_VALUES["quiz_high_score"]
            description = f"Completed Quiz with {score_percentage}% (High Score Bonus!)"
        else:
            points_earned = POINT_VALUES["quiz_completed"]
            description = f"Completed Quiz with {score_percentage}%"
        stats.total_quizzes_completed += 1
        stats.weekly_quizzes_completed += 1
        
    elif activity_type == "study_time":
        minutes = metadata.get("minutes", 0)
        hours = minutes / 60
        points_earned = int(hours * POINT_VALUES["study_hour"])  # 50 pts per hour
        stats.total_study_minutes += minutes
        stats.weekly_study_minutes += minutes
        if minutes >= 60:
            description = f"Studied {int(hours)}h {minutes % 60}m (+{points_earned} pts)"
        else:
            description = f"Studied {minutes} minutes"
        
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
    
    elif activity_type == "solo_quiz":
        # Use the new formula for solo quiz points
        difficulty = metadata.get("difficulty", "intermediate")
        question_count = metadata.get("question_count", 10)
        score_percentage = metadata.get("score_percentage", 0)
        
        quiz_result = calculate_solo_quiz_points(difficulty, question_count, score_percentage)
        points_earned = quiz_result["points_earned"]
        
        # Update solo quiz stats
        if hasattr(stats, 'total_solo_quizzes'):
            stats.total_solo_quizzes += 1
        if hasattr(stats, 'weekly_solo_quizzes'):
            stats.weekly_solo_quizzes += 1
        
        # Also count as quiz completed
        stats.total_quizzes_completed += 1
        stats.weekly_quizzes_completed += 1
        
        bonus_str = f" ({', '.join(quiz_result['bonus_reasons'])})" if quiz_result['bonus_reasons'] else ""
        description = f"Solo Quiz: {difficulty.title()} {question_count}Q - {score_percentage}%{bonus_str}"
    
    elif activity_type == "flashcard_reviewed":
        points_earned = POINT_VALUES["flashcard_reviewed"]
        if hasattr(stats, 'total_flashcards_reviewed'):
            stats.total_flashcards_reviewed += 1
        if hasattr(stats, 'weekly_flashcards_reviewed'):
            stats.weekly_flashcards_reviewed += 1
        description = "Reviewed Flashcard"
    
    elif activity_type == "flashcard_mastered":
        points_earned = POINT_VALUES["flashcard_mastered"]
        if hasattr(stats, 'total_flashcards_mastered'):
            stats.total_flashcards_mastered += 1
        if hasattr(stats, 'weekly_flashcards_mastered'):
            stats.weekly_flashcards_mastered += 1
        description = "Mastered Flashcard"
    
    # Update points and level
    old_level = stats.level
    stats.total_points += points_earned
    stats.weekly_points += points_earned
    stats.experience = stats.total_points
    stats.level = calculate_level_from_xp(stats.experience)
    
    # Check for level up
    if stats.level > old_level:
        notification = models.Notification(
            user_id=user_id,
            title=f"Level Up! Now Level {stats.level}",
            message=f"Congratulations! You've reached level {stats.level}. Keep learning to unlock more!",
            notification_type="level_up"
        )
        db.add(notification)
    
    # Update streak
    today = datetime.now(timezone.utc).date()
    streak_milestone_reached = False
    old_streak = stats.current_streak
    
    if stats.last_activity_date:
        # Handle both datetime and date objects
        if hasattr(stats.last_activity_date, 'date'):
            last_date = stats.last_activity_date.date()
        else:
            last_date = stats.last_activity_date
        if last_date == today:
            pass  # Same day
        elif last_date == today - timedelta(days=1):
            stats.current_streak += 1
            if stats.current_streak > stats.longest_streak:
                stats.longest_streak = stats.current_streak
            # Check for streak milestones
            if stats.current_streak in [7, 14, 30, 60, 100]:
                streak_milestone_reached = True
        else:
            # Streak broken
            if old_streak >= 7:
                # Notify about broken streak
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
    
    # Create streak milestone notification
    if streak_milestone_reached:
        notification = models.Notification(
            user_id=user_id,
            title=f"{stats.current_streak}-Day Streak!",
            message=f"Incredible! You've maintained a {stats.current_streak}-day learning streak. Keep it going!",
            notification_type="streak_milestone"
        )
        db.add(notification)
    
    # Create transaction record
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
    db.commit()  # Commit any resets
    
    # Calculate XP to next level
    next_level_xp = get_xp_for_level(stats.level + 1)
    xp_to_next_level = next_level_xp - stats.experience
    
    # Get rank
    all_stats = db.query(models.UserGamificationStats).order_by(
        models.UserGamificationStats.total_points.desc()
    ).all()
    rank = next((i + 1 for i, s in enumerate(all_stats) if s.user_id == user_id), None)
    
    # Get actual chat session count (not message count)
    total_chat_sessions = db.query(func.count(models.ChatSession.id)).filter(
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
        # Weekly stats
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
        # Total stats
        "total_ai_chats": stats.total_ai_chats,  # Message count (for points)
        "total_chat_sessions": total_chat_sessions,  # Actual session count
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
        
        # Reset everything
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
        
        # Count AI chats
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
        
        # Count notes
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
        
        # Count flashcards
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
        
        # Update level
        stats.experience = stats.total_points
        stats.level = calculate_level_from_xp(stats.experience)
        stats.week_start_date = week_start_datetime
        stats.last_activity_date = datetime.now(timezone.utc)
    
    db.commit()
    return len(users)
