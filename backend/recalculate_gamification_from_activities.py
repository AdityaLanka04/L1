"""
Recalculate gamification stats from actual user activities
This ensures existing users get proper points based on their historical data
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import User, UserGamificationStats, PointTransaction, ChatMessage, Note, Activity, FlashcardSet
from database import DATABASE_URL

print("🔄 Starting gamification recalculation from actual activities...")
print(f"📊 Database: {DATABASE_URL[:50]}...")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

def get_week_start():
    """Get the start of the current week (Monday)"""
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())

def calculate_level_from_xp(xp: int) -> int:
    """Calculate level based on XP"""
    return max(1, int((xp / 100) ** (1/1.5)))

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
            print(f"   ✅ Created new stats record")
        
        # Reset stats to recalculate
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
        stats.experience = 0
        
        # 1. Count AI Chat Messages (1 point each)
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
        
        # 2. Count Notes Created (10 points each)
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
        
        # 3. Count Questions Answered (2 points each)
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
        
        # 4. Count Flashcard Sets (10 points each)
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
        
        # 5. Calculate XP and Level
        stats.experience = stats.total_points
        stats.level = calculate_level_from_xp(stats.experience)
        
        # 6. Update week start date
        stats.week_start_date = week_start_datetime
        stats.last_activity_date = datetime.now(timezone.utc)
        
        print(f"   🎯 TOTAL: {stats.total_points} points, Level {stats.level}")
        print(f"   📅 This week: {stats.weekly_points} points\n")
    
    # Commit all changes
    db.commit()
    print("✅ Gamification recalculation completed successfully!")
    print(f"📊 Processed {len(users)} users")
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    db.rollback()
    raise
finally:
    db.close()
