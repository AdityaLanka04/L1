"""
Recalculate gamification points for all existing users
Run this after deploying to production to update all user stats
"""
from database import SessionLocal
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
import models

def recalculate_user_points(db, user):
    """Calculate points for a single user based on their activity"""
    
    # Get start of current week
    today = datetime.now(timezone.utc).date()
    start_of_week = today - timedelta(days=today.weekday())
    
    print(f"\n📊 Calculating points for {user.username}...")
    
    # Count AI chat messages
    ai_chats = db.query(models.ChatMessage).filter(
        models.ChatMessage.user_id == user.id,
        models.ChatMessage.is_user == True,
        func.date(models.ChatMessage.timestamp) >= start_of_week
    ).count()
    
    # Count notes created
    notes = db.query(models.Note).filter(
        models.Note.user_id == user.id,
        func.date(models.Note.created_at) >= start_of_week,
        models.Note.is_deleted == False
    ).count()
    
    # Count questions answered
    questions = db.query(models.Activity).filter(
        models.Activity.user_id == user.id,
        func.date(models.Activity.timestamp) >= start_of_week
    ).count()
    
    # Count quizzes completed
    quizzes = db.query(models.SoloQuiz).filter(
        models.SoloQuiz.user_id == user.id,
        models.SoloQuiz.completed == True,
        func.date(models.SoloQuiz.completed_at) >= start_of_week
    ).count()
    
    # Count flashcard sets
    flashcards = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id,
        func.date(models.FlashcardSet.created_at) >= start_of_week
    ).count()
    
    # Calculate study time
    daily_metrics = db.query(models.DailyLearningMetrics).filter(
        models.DailyLearningMetrics.user_id == user.id,
        models.DailyLearningMetrics.date >= start_of_week
    ).all()
    study_minutes = sum(m.time_spent_minutes for m in daily_metrics)
    study_hours = int(study_minutes / 60)
    
    # Calculate points
    weekly_points = (
        (ai_chats * 1) +
        (notes * 10) +
        (questions * 2) +
        (quizzes * 50) +
        (flashcards * 10) +
        (study_hours * 10)
    )
    
    print(f"   AI Chats: {ai_chats} × 1 = {ai_chats * 1} pts")
    print(f"   Notes: {notes} × 10 = {notes * 10} pts")
    print(f"   Questions: {questions} × 2 = {questions * 2} pts")
    print(f"   Quizzes: {quizzes} × 50 = {quizzes * 50} pts")
    print(f"   Flashcards: {flashcards} × 10 = {flashcards * 10} pts")
    print(f"   Study Hours: {study_hours} × 10 = {study_hours * 10} pts")
    print(f"   ✅ Total Weekly Points: {weekly_points}")
    
    # Get or create gamification stats
    stats = db.query(models.UserGamificationStats).filter(
        models.UserGamificationStats.user_id == user.id
    ).first()
    
    if not stats:
        stats = models.UserGamificationStats(user_id=user.id)
        db.add(stats)
    
    # Update stats
    stats.weekly_points = weekly_points
    stats.total_points = weekly_points  # For now, use weekly as total
    stats.experience = weekly_points
    stats.weekly_study_minutes = study_minutes
    
    # Calculate level
    level = 1
    exp_needed = 100
    remaining_exp = weekly_points
    
    while remaining_exp >= exp_needed:
        remaining_exp -= exp_needed
        level += 1
        exp_needed = int(100 * (level ** 1.5))
    
    stats.level = level
    
    print(f"   📈 Level: {level}")
    print(f"   🎯 Total Points: {stats.total_points}")
    
    return weekly_points

def recalculate_all_points():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("RECALCULATING GAMIFICATION POINTS FOR ALL USERS")
        print("=" * 60)
        
        users = db.query(models.User).all()
        print(f"\nFound {len(users)} users")
        
        total_points_awarded = 0
        
        for user in users:
            try:
                points = recalculate_user_points(db, user)
                total_points_awarded += points
            except Exception as e:
                print(f"   ❌ Error for {user.username}: {e}")
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("RECALCULATION COMPLETE")
        print("=" * 60)
        print(f"Users processed: {len(users)}")
        print(f"Total points awarded: {total_points_awarded}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    recalculate_all_points()
