"""
COMPREHENSIVE STATISTICS FIX FOR SQLITE (LOCALHOST)
====================================================
This script recalculates all statistics from actual database tables for SQLite.
Run with: python backend/fix_stats_sqlite.py
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Force SQLite
os.environ['USE_POSTGRES'] = 'false'

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone, timedelta
import models

def get_sqlite_session():
    """Create SQLite database session"""
    db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f" SQLite database not found at: {db_path}")
        sys.exit(1)
    
    print(f"📊 Connecting to SQLite database: {db_path}")
    engine = create_engine(f'sqlite:///{db_path}')
    Session = sessionmaker(bind=engine)
    return Session()

def comprehensive_stats_fix():
    db = get_sqlite_session()
    
    try:
        print("\n" + "="*80)
        print(" COMPREHENSIVE STATISTICS FIX (SQLITE/LOCALHOST)")
        print("="*80 + "\n")
        
        # Get all users
        users = db.query(models.User).all()
        print(f"📋 Found {len(users)} user(s) in database\n")
        
        for user in users:
            print("="*80)
            print(f"👤 USER: {user.username} (ID: {user.id})")
            print("="*80)
            
            # Get or create gamification stats
            stats = db.query(models.UserGamificationStats).filter(
                models.UserGamificationStats.user_id == user.id
            ).first()
            
            if not stats:
                print("  Creating new gamification stats record...")
                stats = models.UserGamificationStats(
                    user_id=user.id,
                    total_points=0,
                    level=1,
                    experience=0,
                    weekly_points=0,
                    current_streak=0,
                    longest_streak=0
                )
                db.add(stats)
                db.flush()
                print(" Stats record created\n")
            
            # Calculate week boundaries
            now = datetime.now(timezone.utc)
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
            
            print(f"📅 Week starts: {week_start.strftime('%Y-%m-%d')}\n")
            
            # ============================================================
            # 1. FLASHCARD SETS (Created)
            # ============================================================
            print("📚 FLASHCARD SETS:")
            print("-" * 40)
            
            total_flashcard_sets = db.query(func.count(models.FlashcardSet.id)).filter(
                models.FlashcardSet.user_id == user.id
            ).scalar() or 0
            
            weekly_flashcard_sets = db.query(func.count(models.FlashcardSet.id)).filter(
                models.FlashcardSet.user_id == user.id,
                models.FlashcardSet.created_at >= week_start
            ).scalar() or 0
            
            # List all flashcard sets with details
            flashcard_sets = db.query(models.FlashcardSet).filter(
                models.FlashcardSet.user_id == user.id
            ).order_by(models.FlashcardSet.created_at.desc()).all()
            
            print(f"  Total Sets Created: {total_flashcard_sets}")
            print(f"  This Week: {weekly_flashcard_sets}")
            
            if flashcard_sets:
                print(f"\n  📋 Your Flashcard Sets:")
                for i, fs in enumerate(flashcard_sets, 1):
                    # Count cards in this set
                    card_count = len(fs.cards) if hasattr(fs, 'cards') else 0
                    created_date = fs.created_at.strftime('%Y-%m-%d %H:%M') if fs.created_at else 'Unknown'
                    print(f"    {i}. {fs.title}")
                    print(f"       - Cards: {card_count}")
                    print(f"       - Created: {created_date}")
                    print(f"       - ID: {fs.id}")
            print()
            
            # ============================================================
            # 2. FLASHCARD REVIEWS (Study Sessions)
            # ============================================================
            print("📖 FLASHCARD REVIEWS:")
            print("-" * 40)
            
            total_cards_reviewed = db.query(func.sum(models.FlashcardStudySession.cards_studied)).filter(
                models.FlashcardStudySession.user_id == user.id
            ).scalar() or 0
            
            total_cards_mastered = db.query(func.sum(models.FlashcardStudySession.correct_answers)).filter(
                models.FlashcardStudySession.user_id == user.id
            ).scalar() or 0
            
            weekly_cards_reviewed = db.query(func.sum(models.FlashcardStudySession.cards_studied)).filter(
                models.FlashcardStudySession.user_id == user.id,
                models.FlashcardStudySession.session_date >= week_start
            ).scalar() or 0
            
            weekly_cards_mastered = db.query(func.sum(models.FlashcardStudySession.correct_answers)).filter(
                models.FlashcardStudySession.user_id == user.id,
                models.FlashcardStudySession.session_date >= week_start
            ).scalar() or 0
            
            print(f"  Total Cards Reviewed: {total_cards_reviewed}")
            print(f"  Total Cards Mastered: {total_cards_mastered}")
            print(f"  This Week Reviewed: {weekly_cards_reviewed}")
            print(f"  This Week Mastered: {weekly_cards_mastered}\n")
            
            # ============================================================
            # 3. AI CHAT SESSIONS
            # ============================================================
            print(" AI CHAT SESSIONS:")
            print("-" * 40)
            
            # Count from ChatSession table
            total_chat_sessions = db.query(func.count(models.ChatSession.id)).filter(
                models.ChatSession.user_id == user.id
            ).scalar() or 0
            
            weekly_chat_sessions = db.query(func.count(models.ChatSession.id)).filter(
                models.ChatSession.user_id == user.id,
                models.ChatSession.created_at >= week_start
            ).scalar() or 0
            
            # Count messages in chat sessions
            total_chat_messages = db.query(func.count(models.ChatMessage.id)).filter(
                models.ChatMessage.user_id == user.id
            ).scalar() or 0
            
            print(f"  Total Chat Sessions: {total_chat_sessions}")
            print(f"  Total Messages: {total_chat_messages}")
            print(f"  This Week Sessions: {weekly_chat_sessions}\n")
            
            # ============================================================
            # 4. NOTES
            # ============================================================
            print(" NOTES:")
            print("-" * 40)
            
            total_notes = db.query(func.count(models.Note.id)).filter(
                models.Note.user_id == user.id
            ).scalar() or 0
            
            weekly_notes = db.query(func.count(models.Note.id)).filter(
                models.Note.user_id == user.id,
                models.Note.created_at >= week_start
            ).scalar() or 0
            
            print(f"  Total Notes: {total_notes}")
            print(f"  This Week: {weekly_notes}\n")
            
            # ============================================================
            # 5. POINT TRANSACTIONS (for verification)
            # ============================================================
            print("💰 POINT TRANSACTIONS:")
            print("-" * 40)
            
            # Count by activity type
            activity_counts = {}
            activity_types = ['ai_chat', 'flashcard_set', 'flashcard_reviewed', 'flashcard_mastered', 
                            'note_created', 'question_answered', 'quiz_completed', 'solo_quiz']
            
            for activity_type in activity_types:
                count = db.query(func.count(models.PointTransaction.id)).filter(
                    models.PointTransaction.user_id == user.id,
                    models.PointTransaction.activity_type == activity_type
                ).scalar() or 0
                if count > 0:
                    activity_counts[activity_type] = count
                    print(f"  {activity_type}: {count}")
            
            if not activity_counts:
                print("  No point transactions found")
            print()
            
            # ============================================================
            # 6. UPDATE GAMIFICATION STATS
            # ============================================================
            print("🔄 UPDATING STATISTICS:")
            print("-" * 40)
            
            # Flashcards
            stats.total_flashcards_created = total_flashcard_sets
            stats.total_flashcards_reviewed = total_cards_reviewed
            stats.total_flashcards_mastered = total_cards_mastered
            stats.weekly_flashcards_created = weekly_flashcard_sets
            stats.weekly_flashcards_reviewed = weekly_cards_reviewed
            stats.weekly_flashcards_mastered = weekly_cards_mastered
            
            # AI Chats
            stats.total_ai_chats = total_chat_sessions
            stats.weekly_ai_chats = weekly_chat_sessions
            
            # Notes
            stats.total_notes_created = total_notes
            stats.weekly_notes_created = weekly_notes
            
            # Questions (from point transactions)
            total_questions = activity_counts.get('question_answered', 0)
            weekly_questions = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type == 'question_answered',
                models.PointTransaction.created_at >= week_start
            ).scalar() or 0
            
            stats.total_questions_answered = total_questions
            stats.weekly_questions_answered = weekly_questions
            
            # Quizzes
            total_quizzes = activity_counts.get('quiz_completed', 0) + activity_counts.get('solo_quiz', 0)
            weekly_quizzes = db.query(func.count(models.PointTransaction.id)).filter(
                models.PointTransaction.user_id == user.id,
                models.PointTransaction.activity_type.in_(['quiz_completed', 'solo_quiz']),
                models.PointTransaction.created_at >= week_start
            ).scalar() or 0
            
            stats.total_quizzes_completed = total_quizzes
            stats.weekly_quizzes_completed = weekly_quizzes
            
            stats.updated_at = datetime.now(timezone.utc)
            
            # Recalculate total points based on activities
            stats.total_points = 0
            stats.weekly_points = 0
            
            # Add points for flashcard sets
            stats.total_points += total_flashcard_sets * 10  # 10 points per set
            stats.weekly_points += weekly_flashcard_sets * 10
            
            # Add points for AI chats
            stats.total_points += total_chat_sessions * 1  # 1 point per chat
            stats.weekly_points += weekly_chat_sessions * 1
            
            # Add points for notes
            stats.total_points += total_notes * 20  # 20 points per note
            stats.weekly_points += weekly_notes * 20
            
            # Add points for questions
            stats.total_points += total_questions * 2  # 2 points per question
            stats.weekly_points += weekly_questions * 2
            
            # Add points for quizzes (15 points base)
            stats.total_points += total_quizzes * 15
            stats.weekly_points += weekly_quizzes * 15
            
            # Update experience and level
            stats.experience = stats.total_points
            from gamification_system import calculate_level_from_xp
            stats.level = calculate_level_from_xp(stats.experience)
            
            print(f"   Flashcard Sets: {total_flashcard_sets} (weekly: {weekly_flashcard_sets})")
            print(f"   Cards Reviewed: {total_cards_reviewed} (weekly: {weekly_cards_reviewed})")
            print(f"   AI Chats: {total_chat_sessions} (weekly: {weekly_chat_sessions})")
            print(f"   Notes: {total_notes} (weekly: {weekly_notes})")
            print(f"   Questions: {total_questions} (weekly: {weekly_questions})")
            print(f"   Quizzes: {total_quizzes} (weekly: {weekly_quizzes})")
            print(f"   TOTAL POINTS: {stats.total_points} (weekly: {stats.weekly_points})")
            print(f"   LEVEL: {stats.level}")
            print()
        
        # Commit all changes
        db.commit()
        
        print("="*80)
        print(" COMPREHENSIVE FIX COMPLETED SUCCESSFULLY!")
        print("="*80)
        print("\n📊 SUMMARY:")
        print("  • All statistics recalculated from actual database tables")
        print("  • Flashcard sets counted correctly")
        print("  • AI chats separated from flashcards")
        print("  • Weekly and all-time totals updated")
        print("\n WHAT'S TRACKED:")
        print("  • Flashcard Sets: From FlashcardSet table")
        print("  • Flashcard Reviews: From FlashcardStudySession table")
        print("  • AI Chats: From ChatSession table")
        print("  • Notes: From Note table")
        print("  • Questions: From PointTransaction (question_answered)")
        print("  • Quizzes: From PointTransaction (quiz_completed, solo_quiz)")
        print("\n NEXT STEPS:")
        print("  1. Refresh your Dashboard page (Ctrl+Shift+R)")
        print("  2. Check that flashcard count shows correctly")
        print("  3. Stats will auto-update when you add/delete items")
        print()
        
    except Exception as e:
        print(f"\n ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    comprehensive_stats_fix()
