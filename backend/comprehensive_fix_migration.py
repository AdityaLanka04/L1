"""
COMPREHENSIVE FIX - Single Source of Truth for All Stats
This migration creates a clean, unified tracking system
"""
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from datetime import datetime, timezone

def comprehensive_fix():
    db = SessionLocal()
    try:
        print("\n🔥 COMPREHENSIVE FIX - SINGLE SOURCE OF TRUTH 🔥\n")
        
        # 1. Reset ALL gamification stats to zero
        print("📊 Resetting all gamification stats...")
        stats = db.query(models.UserGamificationStats).all()
        
        for stat in stats:
            # Points and levels
            stat.total_points = 0
            stat.level = 1
            stat.experience = 0
            stat.weekly_points = 0
            
            # Weekly stats
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
            
            # Total stats (SINGLE SOURCE OF TRUTH)
            stat.total_ai_chats = 0
            stat.total_notes_created = 0
            stat.total_questions_answered = 0
            stat.total_quizzes_completed = 0
            stat.total_flashcards_created = 0
            stat.total_study_minutes = 0
            stat.total_battles_won = 0
            
            # Streaks
            stat.current_streak = 0
            stat.longest_streak = 0
            
            print(f"  ✓ Reset stats for user {stat.user_id}")
        
        # 2. Delete ALL tracking data
        print("\n🗑️  Deleting all tracking data...")
        
        # Point transactions
        transaction_count = db.query(models.PointTransaction).count()
        db.query(models.PointTransaction).delete()
        print(f"  ✓ Deleted {transaction_count} point transactions")
        
        # Chat messages (count them first for recalculation)
        message_count = db.query(models.ChatMessage).count()
        db.query(models.ChatMessage).delete()
        print(f"  ✓ Deleted {message_count} chat messages")
        
        # Chat sessions
        session_count = db.query(models.ChatSession).count()
        db.query(models.ChatSession).delete()
        print(f"  ✓ Deleted {session_count} chat sessions")
        
        # Activities (REMOVE - causes duplicate tracking)
        try:
            activity_count = db.query(models.Activity).count()
            db.query(models.Activity).delete()
            print(f"  ✓ Deleted {activity_count} activities (duplicate tracking removed)")
        except:
            print(f"  ⚠️  Activity table not found")
        
        # Daily metrics (REMOVE - causes duplicate tracking)
        try:
            metrics_count = db.query(models.DailyLearningMetrics).count()
            db.query(models.DailyLearningMetrics).delete()
            print(f"  ✓ Deleted {metrics_count} daily metrics (duplicate tracking removed)")
        except:
            print(f"  ⚠️  DailyLearningMetrics table not found")
        
        # Flashcards
        try:
            card_count = db.query(models.Flashcard).count()
            db.query(models.Flashcard).delete()
            set_count = db.query(models.FlashcardSet).count()
            db.query(models.FlashcardSet).delete()
            print(f"  ✓ Deleted {card_count} flashcards and {set_count} sets")
        except Exception as e:
            print(f"  ⚠️  Could not delete flashcards: {str(e)[:100]}")
        
        db.commit()
        
        print("\n✅ COMPREHENSIVE FIX COMPLETE!")
        print("\n📋 NEW SYSTEM RULES:")
        print("  1. UserGamificationStats = SINGLE SOURCE OF TRUTH")
        print("  2. Only USER messages count (not AI responses)")
        print("  3. No duplicate tracking in Activity/DailyMetrics")
        print("  4. Points awarded ONCE per action via gamification_system")
        print("  5. Frontend calls /track_gamification_activity for all actions")
        print("\n🎯 Clean slate - ready for proper tracking!\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("⚠️  This will reset ALL data and remove duplicate tracking systems")
    confirm = input("Type 'FIX IT' to proceed: ")
    
    if confirm == "FIX IT":
        comprehensive_fix()
    else:
        print("❌ Cancelled")
