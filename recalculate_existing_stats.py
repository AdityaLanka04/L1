"""
Recalculate gamification stats for existing users
Run this once to update all user stats from their actual activities
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.models import User, UserGamificationStats, ChatMessage, Note, Activity, FlashcardSet
from backend.database import DATABASE_URL

print("🔄 Recalculating gamification stats from actual activities...")
print(f"📊 Database: {DATABASE_URL[:50]}...")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def get_week_start():
    """Get the start of the current week (Monday)"""
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())

def calculate_level_from_xp(xp: int) -> int:
    """Calculate level based on XP with better progression"""
    # Level thresholds: 100, 282, 500, 800, 1200, 1700, 2300, 3000...
    if xp < 100:
        return 1
    elif xp < 282:
        return 2
    elif xp < 500:
        return 3
    elif xp < 800:
        return 4
    elif xp < 1200:
        return 5
    elif xp < 1700:
        return 6
    elif xp < 2300:
        return 7
    elif xp < 3000:
        return 8
    else:
        # For higher levels, use formula
        return 8 + int((xp - 3000) / 1000)

try:
    week_start = get_week_start()
    week_start_datetime = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    users = db.query(User).all()
    print(f"\n📋 Found {len(users)} users to process\n")
    
    for user in users:
        print(f"👤 Processing {user.username}...")
        
        # Get or create gamification stats
        stats = db.query(UserGamificationStats).filter(
            UserGamificationStats.user_id == user.id
        ).first()
        
        if not stats:
            stats = UserGamificationStats(
                user_id=user.id,
                week_start_date=week_start_datetime
            )
            db.add(stats)
            db.flush()
        
        # Reset to recalculate
        stats.total_points = 0
        stats.weekly_points = 0
        
        # 1. AI Chats (1 point each) - Count ChatMessage records
        total_chats = db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.user_id == user.id
        ).scalar() or 0
        
        weekly_chats = db.query(func.count(ChatMessage.id)).filter(
            ChatMessage.user_id == user.id,
            ChatMessage.timestamp >= week_start_datetime
        ).scalar() or 0
        
        stats.total_ai_chats = total_chats
        stats.weekly_ai_chats = weekly_chats
        stats.total_points += total_chats * 1
        stats.weekly_points += weekly_chats * 1
        print(f"   💬 AI Chats: {total_chats} total ({weekly_chats} this week) = +{total_chats} pts")
        
        # 2. Notes (10 points each)
        total_notes = db.query(func.count(Note.id)).filter(
            Note.user_id == user.id
        ).scalar() or 0
        
        weekly_notes = db.query(func.count(Note.id)).filter(
            Note.user_id == user.id,
            Note.created_at >= week_start_datetime
        ).scalar() or 0
        
        stats.total_notes_created = total_notes
        stats.weekly_notes_created = weekly_notes
        stats.total_points += total_notes * 10
        stats.weekly_points += weekly_notes * 10
        print(f"   📝 Notes: {total_notes} total ({weekly_notes} this week) = +{total_notes * 10} pts")
        
        # 3. Questions from Activity table (2 points each) - NOT AI chats
        total_questions = db.query(func.count(Activity.id)).filter(
            Activity.user_id == user.id
        ).scalar() or 0
        
        weekly_questions = db.query(func.count(Activity.id)).filter(
            Activity.user_id == user.id,
            Activity.timestamp >= week_start_datetime
        ).scalar() or 0
        
        stats.total_questions_answered = total_questions
        stats.weekly_questions_answered = weekly_questions
        stats.total_points += total_questions * 2
        stats.weekly_points += weekly_questions * 2
        print(f"   ❓ Questions: {total_questions} total ({weekly_questions} this week) = +{total_questions * 2} pts")
        
        # 4. Flashcard Sets (10 points each)
        total_flashcards = db.query(func.count(FlashcardSet.id)).filter(
            FlashcardSet.user_id == user.id
        ).scalar() or 0
        
        weekly_flashcards = db.query(func.count(FlashcardSet.id)).filter(
            FlashcardSet.user_id == user.id,
            FlashcardSet.created_at >= week_start_datetime
        ).scalar() or 0
        
        stats.total_flashcards_created = total_flashcards
        stats.weekly_flashcards_created = weekly_flashcards
        stats.total_points += total_flashcards * 10
        stats.weekly_points += weekly_flashcards * 10
        print(f"   🎴 Flashcards: {total_flashcards} total ({weekly_flashcards} this week) = +{total_flashcards * 10} pts")
        
        # Calculate level with new formula
        stats.experience = stats.total_points
        stats.level = calculate_level_from_xp(stats.experience)
        stats.week_start_date = week_start_datetime
        stats.last_activity_date = datetime.now(timezone.utc)
        
        print(f"   🎯 TOTAL: {stats.total_points} points, Level {stats.level}")
        print(f"   📅 This week: {stats.weekly_points} points\n")
    
    db.commit()
    print("✅ Recalculation completed successfully!")
    print(f"📊 Processed {len(users)} users")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
