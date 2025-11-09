"""
Reset gamification stats for testing
Run this to clear all gamification data and start fresh
"""
from database import SessionLocal
import models

def reset_gamification():
    db = SessionLocal()
    try:
        # Delete all point transactions
        db.query(models.PointTransaction).delete()
        print("✓ Cleared point transactions")
        
        # Reset all user gamification stats
        stats = db.query(models.UserGamificationStats).all()
        for stat in stats:
            stat.total_points = 0
            stat.level = 1
            stat.experience = 0
            stat.weekly_points = 0
            stat.weekly_study_minutes = 0
            stat.quiz_battle_wins = 0
            stat.quiz_battle_draws = 0
            stat.quiz_battle_losses = 0
        print(f"✓ Reset {len(stats)} user stats")
        
        # Delete all weekly bingo progress
        db.query(models.WeeklyBingoProgress).delete()
        print("✓ Cleared weekly bingo progress")
        
        db.commit()
        print("\n✅ Gamification data reset successfully!")
        print("You can now test the system with fresh data.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔄 Resetting gamification data...")
    reset_gamification()
