"""
PRODUCTION DEPLOYMENT SCRIPT FOR GAMIFICATION SYSTEM
Run this ONCE on production after deploying the new code

This script will:
1. Run database migrations to add gamification tables
2. Recalculate all existing user stats from their historical activities
3. Verify the data integrity

Usage:
    python deploy_gamification.py
"""
import os
import sys
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, func, inspect
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import (
    Base, User, UserGamificationStats, PointTransaction, 
    ChatMessage, Note, Activity, FlashcardSet
)
from database import DATABASE_URL

print("=" * 60)
print("GAMIFICATION SYSTEM DEPLOYMENT")
print("=" * 60)
print(f"Database: {DATABASE_URL[:50]}...")
print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
print("=" * 60)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_week_start():
    """Get the start of the current week (Monday)"""
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=today.weekday())

def calculate_level_from_xp(xp: int) -> int:
    """Calculate level based on XP"""
    return max(1, int((xp / 100) ** (1/1.5)))

def check_tables_exist():
    """Check if gamification tables exist"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    required_tables = [
        'user_gamification_stats',
        'point_transactions',
        'weekly_bingo_progress'
    ]
    
    missing = [t for t in required_tables if t not in existing_tables]
    return len(missing) == 0, missing

def create_tables():
    """Create gamification tables"""
    print("\n[STEP 1] Creating gamification tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {str(e)}")
        return False

def recalculate_user_stats():
    """Recalculate all user stats from historical data"""
    print("\n[STEP 2] Recalculating user statistics...")
    
    db = SessionLocal()
    try:
        week_start = get_week_start()
        week_start_datetime = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        users = db.query(User).all()
        print(f"Found {len(users)} users to process\n")
        
        total_points_awarded = 0
        users_updated = 0
        
        for user in users:
            try:
                print(f"Processing {user.username}...", end=" ")
                
                # Get or create stats
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
                stats.total_ai_chats = 0
                stats.weekly_ai_chats = 0
                stats.total_notes_created = 0
                stats.weekly_notes_created = 0
                stats.total_questions_answered = 0
                stats.weekly_questions_answered = 0
                stats.total_flashcards_created = 0
                stats.weekly_flashcards_created = 0
                
                # Count AI Chats (1 pt each)
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
                
                # Count Notes (10 pts each)
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
                
                # Count Questions (2 pts each)
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
                
                # Count Flashcards (10 pts each)
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
                
                # Calculate level
                stats.experience = stats.total_points
                stats.level = calculate_level_from_xp(stats.experience)
                stats.week_start_date = week_start_datetime
                stats.last_activity_date = datetime.now(timezone.utc)
                
                total_points_awarded += stats.total_points
                users_updated += 1
                
                print(f"✅ {stats.total_points} pts, Level {stats.level}")
                
            except Exception as e:
                print(f"❌ Error: {str(e)}")
                continue
        
        db.commit()
        
        print(f"\n✅ Successfully updated {users_updated} users")
        print(f"📊 Total points awarded: {total_points_awarded:,}")
        return True
        
    except Exception as e:
        print(f"\n❌ Error during recalculation: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

def verify_deployment():
    """Verify the deployment was successful"""
    print("\n[STEP 3] Verifying deployment...")
    
    db = SessionLocal()
    try:
        # Check if tables exist
        tables_ok, missing = check_tables_exist()
        if not tables_ok:
            print(f"❌ Missing tables: {missing}")
            return False
        print("✅ All gamification tables exist")
        
        # Check if users have stats
        user_count = db.query(User).count()
        stats_count = db.query(UserGamificationStats).count()
        
        print(f"✅ Users: {user_count}, Stats records: {stats_count}")
        
        # Show top 5 users
        top_users = db.query(
            User.username,
            UserGamificationStats.total_points,
            UserGamificationStats.level
        ).join(
            UserGamificationStats,
            User.id == UserGamificationStats.user_id
        ).order_by(
            UserGamificationStats.total_points.desc()
        ).limit(5).all()
        
        if top_users:
            print("\n🏆 Top 5 Users:")
            for i, (username, points, level) in enumerate(top_users, 1):
                print(f"   {i}. {username}: {points:,} pts (Level {level})")
        
        return True
        
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return False
    finally:
        db.close()

def main():
    """Main deployment function"""
    try:
        # Check if tables already exist
        tables_exist, missing = check_tables_exist()
        
        if not tables_exist:
            print(f"\n⚠️  Missing tables: {missing}")
            if not create_tables():
                print("\n❌ DEPLOYMENT FAILED: Could not create tables")
                return False
        else:
            print("\n✅ Gamification tables already exist")
        
        # Recalculate stats
        if not recalculate_user_stats():
            print("\n❌ DEPLOYMENT FAILED: Could not recalculate stats")
            return False
        
        # Verify
        if not verify_deployment():
            print("\n⚠️  DEPLOYMENT WARNING: Verification failed")
            return False
        
        print("\n" + "=" * 60)
        print("✅ GAMIFICATION DEPLOYMENT COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Restart your application")
        print("2. Test the /api/get_gamification_stats endpoint")
        print("3. Check the Games page in the frontend")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ DEPLOYMENT FAILED: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
