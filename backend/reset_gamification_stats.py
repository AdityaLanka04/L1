"""
COMPLETE RESET - Reset ALL data to clean slate
Run this script to clear all points, levels, activity tracking, sessions, notes, flashcards, etc.
"""
from sqlalchemy.orm import Session
from database import SessionLocal
import models

def reset_everything():
    db = SessionLocal()
    try:
        print("\n🔥 STARTING COMPLETE RESET 🔥\n")
        
        # 1. Reset all user gamification stats
        stats = db.query(models.UserGamificationStats).all()
        print(f"📊 Found {len(stats)} user stats to reset")
        
        for stat in stats:
            # Reset points and levels
            stat.total_points = 0
            stat.level = 1
            stat.experience = 0
            
            # Reset weekly stats
            stat.weekly_points = 0
            stat.weekly_ai_chats = 0
            stat.weekly_notes_created = 0
            stat.weekly_questions_answered = 0
            stat.weekly_quizzes_completed = 0
            stat.weekly_flashcards_created = 0
            stat.weekly_study_minutes = 0
            stat.weekly_battles_won = 0
            stat.weekly_solo_quizzes = 0
            stat.weekly_flashcards_reviewed = 0
            stat.weekly_flashcards_mastered = 0
            
            # Reset TOTAL stats (this was missing!)
            stat.total_ai_chats = 0
            stat.total_notes_created = 0
            stat.total_questions_answered = 0
            stat.total_quizzes_completed = 0
            stat.total_flashcards_created = 0
            stat.total_study_minutes = 0
            stat.total_battles_won = 0
            
            # Reset streaks
            stat.current_streak = 0
            stat.longest_streak = 0
            
            print(f"  ✓ Reset stats for user {stat.user_id}")
        
        # 2. Delete all point transactions
        transaction_count = db.query(models.PointTransaction).count()
        db.query(models.PointTransaction).delete()
        print(f"\n💰 Deleted {transaction_count} point transactions")
        
        # 3. Delete all chat messages
        message_count = db.query(models.ChatMessage).count()
        db.query(models.ChatMessage).delete()
        print(f"💬 Deleted {message_count} chat messages")
        
        # 4. Delete all chat sessions
        session_count = db.query(models.ChatSession).count()
        db.query(models.ChatSession).delete()
        print(f"📝 Deleted {session_count} chat sessions")
        
        # 5. Delete all notes
        try:
            note_count = db.query(models.Note).count()
            db.query(models.Note).delete()
            print(f"📄 Deleted {note_count} notes")
        except Exception as e:
            print(f"⚠️  Could not delete notes: {str(e)[:100]}")
        
        # 6. Delete all flashcard sets and cards
        try:
            card_count = db.query(models.Flashcard).count()
            db.query(models.Flashcard).delete()
            set_count = db.query(models.FlashcardSet).count()
            db.query(models.FlashcardSet).delete()
            print(f"🃏 Deleted {card_count} flashcards and {set_count} flashcard sets")
        except Exception as e:
            print(f"⚠️  Could not delete flashcards: {str(e)[:100]}")
        
        # 7. Delete all activities
        try:
            activity_count = db.query(models.Activity).count()
            db.query(models.Activity).delete()
            print(f"📈 Deleted {activity_count} activities")
        except Exception as e:
            print(f"⚠️  Could not delete activities: {str(e)[:100]}")
        
        # 8. Delete all daily learning metrics
        try:
            metrics_count = db.query(models.DailyLearningMetrics).count()
            db.query(models.DailyLearningMetrics).delete()
            print(f"📊 Deleted {metrics_count} daily learning metrics")
        except Exception as e:
            print(f"⚠️  Could not delete metrics: {str(e)[:100]}")
        
        # 9. Delete all quiz attempts
        try:
            quiz_count = db.query(models.QuizAttempt).count()
            db.query(models.QuizAttempt).delete()
            print(f"🎯 Deleted {quiz_count} quiz attempts")
        except Exception as e:
            print(f"⚠️  Could not delete quiz attempts: {str(e)[:100]}")
        
        # 10. Delete all battle history
        try:
            battle_count = db.query(models.BattleHistory).count()
            db.query(models.BattleHistory).delete()
            print(f"⚔️  Deleted {battle_count} battle records")
        except Exception as e:
            print(f"⚠️  Could not delete battle history: {str(e)[:100]}")
        
        db.commit()
        print("\n✅ COMPLETE RESET SUCCESSFUL! ALL DATA CLEARED!")
        print("🎉 Fresh start - all stats, sessions, notes, and flashcards deleted\n")
        
    except Exception as e:
        print(f"\n❌ Error during reset: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("⚠️  ⚠️  ⚠️  DANGER ZONE ⚠️  ⚠️  ⚠️")
    print("This will DELETE ALL DATA:")
    print("  - All gamification stats and points")
    print("  - All chat sessions and messages")
    print("  - All notes")
    print("  - All flashcards")
    print("  - All activities and metrics")
    print("  - All quiz attempts")
    print("  - All battle history")
    print("\nThis action CANNOT be undone!")
    print("\n" + "="*50)
    confirm = input("\nType 'DELETE EVERYTHING' to confirm: ")
    
    if confirm == "DELETE EVERYTHING":
        reset_everything()
    else:
        print("\n❌ Reset cancelled - no changes made")
