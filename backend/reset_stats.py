"""
Reset all gamification stats and chat sessions for a clean slate
Run this once to reset everything
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import UserGamificationStats, PointTransaction, DailyLearningMetrics, ChatMessage, ChatSession
from datetime import datetime, timezone

def reset_all_stats():
    db = SessionLocal()
    
    try:
        print("🔄 Resetting all data...")
        
        # Delete all chat messages first (foreign key constraint) - handle if table doesn't exist
        try:
            deleted_messages = db.query(ChatMessage).delete()
            print(f"✅ Deleted {deleted_messages} chat messages")
        except Exception as e:
            print(f"⚠️ Could not delete chat messages: {e}")
        
        # Delete all chat sessions - handle if table doesn't exist
        try:
            deleted_sessions = db.query(ChatSession).delete()
            print(f"✅ Deleted {deleted_sessions} chat sessions")
        except Exception as e:
            print(f"⚠️ Could not delete chat sessions: {e}")
        
        # Reset all UserGamificationStats
        stats = db.query(UserGamificationStats).all()
        for stat in stats:
            stat.total_points = 0
            stat.weekly_points = 0
            stat.level = 1
            stat.experience = 0
            stat.total_ai_chats = 0
            stat.weekly_ai_chats = 0
            stat.total_notes_created = 0
            stat.weekly_notes_created = 0
            stat.total_questions_answered = 0
            stat.weekly_questions_answered = 0
            stat.total_quizzes_completed = 0
            stat.weekly_quizzes_completed = 0
            stat.total_flashcards_created = 0
            stat.weekly_flashcards_created = 0
            stat.total_study_minutes = 0
            stat.weekly_study_minutes = 0
            stat.total_battles_won = 0
            stat.weekly_battles_won = 0
            stat.current_streak = 0
            stat.updated_at = datetime.now(timezone.utc)
        
        print(f"✅ Reset {len(stats)} user stats")
        
        # Delete all point transactions
        deleted_transactions = db.query(PointTransaction).delete()
        print(f"✅ Deleted {deleted_transactions} point transactions")
        
        # Reset daily metrics
        deleted_metrics = db.query(DailyLearningMetrics).delete()
        print(f"✅ Deleted {deleted_metrics} daily metrics")
        
        db.commit()
        print("\n✅ All data reset successfully!")
        print("Users can now start fresh with proper point tracking.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    reset_all_stats()
