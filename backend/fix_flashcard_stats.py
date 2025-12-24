"""
Fix flashcard statistics by recalculating from actual flashcard activity
This will properly count flashcard reviews and separate them from AI chat questions
Run this with: python backend/fix_flashcard_stats.py
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Use PostgreSQL database
os.environ['USE_POSTGRES'] = 'true'

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
import psycopg2

# Import models
import models

def get_postgres_session():
    """Create PostgreSQL database session"""
    # Read from .env file
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    db_url = None
    
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    
    if not db_url:
        print("❌ DATABASE_URL not found in .env file")
        sys.exit(1)
    
    print(f"📊 Connecting to PostgreSQL database...")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    return Session()

def fix_flashcard_stats():
    db = get_postgres_session()
    
    try:
        print("🔄 Fixing flashcard statistics...\n")
        
        # Get all users
        users = db.query(models.User).all()
        print(f"Found {len(users)} users\n")
        
        for user in users:
            print(f"{'='*60}")
            print(f"👤 User: {user.username} (ID: {user.id})")
            print(f"{'='*60}")
            
            # Get or create gamification stats
            stats = db.query(models.UserGamificationStats).filter(
                models.UserGamificationStats.user_id == user.id
            ).first()
            
            if not stats:
                print(f"  ⚠️  No gamification stats found, creating new record...")
                stats = models.UserGamificationStats(
                    user_id=user.id,
                    total_points=0,
                    level=1,
                    experience=0
                )
                db.add(stats)
                db.flush()
            
            # === FLASHCARD STATISTICS ===
            print(f"\n📚 FLASHCARD STATISTICS:")
            
            # Count flashcard sets created
            flashcard_sets_count = db.query(func.count(models.FlashcardSet.id)).filter(
                models.FlashcardSet.user_id == user.id
            ).scalar() or 0
            print(f"  • Flashcard sets created: {flashcard_sets_count}")
            
            # Count flashcard study sessions
            total_sessions = db.query(func.count(models.FlashcardStudySession.id)).filter(
                models.FlashcardStudySession.user_id == user.id
            ).scalar() or 0
            print(f"  • Study sessions: {total_sessions}")
            
            # Count total cards studied
            total_cards_studied = db.query(func.sum(models.FlashcardStudySession.cards_studied)).filter(
                models.FlashcardStudySession.user_id == user.id
            ).scalar() or 0
            print(f"  • Total cards reviewed: {total_cards_studied}")
            
            # Count mastered cards (correct answers)
            total_mastered = db.query(func.sum(models.FlashcardStudySession.correct_answers)).filter(
                models.FlashcardStudySession.user_id == user.id
            ).scalar() or 0
            print(f"  • Cards mastered: {total_mastered}")
            
            # This week's flashcard activity
            week_start = datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            weekly_sets = db.query(func.count(models.FlashcardSet.id)).filter(
                models.FlashcardSet.user_id == user.id,
                models.FlashcardSet.created_at >= week_start
            ).scalar() or 0
            
            weekly_cards = db.query(func.sum(models.FlashcardStudySession.cards_studied)).filter(
                models.FlashcardStudySession.user_id == user.id,
                models.FlashcardStudySession.session_date >= week_start
            ).scalar() or 0
            
            weekly_mastered = db.query(func.sum(models.FlashcardStudySession.correct_answers)).filter(
                models.FlashcardStudySession.user_id == user.id,
                models.FlashcardStudySession.session_date >= week_start
            ).scalar() or 0
            
            print(f"  • This week: {weekly_sets} sets, {weekly_cards} cards reviewed, {weekly_mastered} mastered")
            
            # === AI CHAT STATISTICS ===
            print(f"\n💬 AI CHAT STATISTICS:")
            
            ai_chat_count = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type == 'ai_chat'
            ).scalar() or 0
            print(f"  • Total AI chats: {ai_chat_count}")
            
            weekly_ai_chats = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type == 'ai_chat',
                models.PointTransaction.created_at >= week_start
            ).scalar() or 0
            print(f"  • This week: {weekly_ai_chats}")
            
            # === QUIZ QUESTION STATISTICS ===
            print(f"\n❓ QUIZ QUESTION STATISTICS:")
            
            question_count = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type == 'question_answered'
            ).scalar() or 0
            print(f"  • Total questions answered: {question_count}")
            
            weekly_questions = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type == 'question_answered',
                models.PointTransaction.created_at >= week_start
            ).scalar() or 0
            print(f"  • This week: {weekly_questions}")
            
            # === UPDATE STATS ===
            print(f"\n🔄 Updating statistics...")
            
            # Flashcard stats
            stats.total_flashcards_created = flashcard_sets_count
            stats.total_flashcards_reviewed = total_cards_studied
            stats.total_flashcards_mastered = total_mastered
            stats.weekly_flashcards_created = weekly_sets
            stats.weekly_flashcards_reviewed = weekly_cards
            stats.weekly_flashcards_mastered = weekly_mastered
            
            # AI chat stats
            stats.total_ai_chats = ai_chat_count
            stats.weekly_ai_chats = weekly_ai_chats
            
            # Question stats
            stats.total_questions_answered = question_count
            stats.weekly_questions_answered = weekly_questions
            
            stats.updated_at = datetime.now(timezone.utc)
            
            print(f"  ✅ Stats updated successfully!\n")
        
        db.commit()
        
        print(f"\n{'='*60}")
        print("✅ ALL STATISTICS FIXED SUCCESSFULLY!")
        print(f"{'='*60}")
        print("\n📊 Summary:")
        print("  • Flashcards: Counted from FlashcardSet and FlashcardStudySession tables")
        print("  • AI Chats: Counted from PointTransaction with activity_type='ai_chat'")
        print("  • Quiz Questions: Counted from PointTransaction with activity_type='question_answered'")
        print("  • All stats properly separated and updated")
        print("\n✨ Your dashboard and analytics will now show correct numbers!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_flashcard_stats()
