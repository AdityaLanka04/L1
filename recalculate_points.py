"""
Script to recalculate all user points with the new point values:
- AI chat message: 1 point
- Flashcard set created: 10 points
- Note created: 20 points
- 1 hour on app: 50 points
- Quiz 80%+ score: 30 points
- Quiz completed: 15 points
- Question answered: 2 points
- Battle win: 10 points
- Battle draw: 5 points
- Battle loss: 2 points
"""

import sys
sys.path.insert(0, 'backend')

from database import SessionLocal
from gamification_system import recalculate_all_stats

def main():
    print("=" * 50)
    print("RECALCULATING ALL USER POINTS")
    print("=" * 50)
    print("\nNew Point Values:")
    print("  - AI chat message: 1 pt")
    print("  - Question answered: 2 pts")
    print("  - Battle loss: 2 pts")
    print("  - Battle draw: 5 pts")
    print("  - Flashcard set: 10 pts")
    print("  - Battle win: 10 pts")
    print("  - Quiz completed: 15 pts")
    print("  - Note created: 20 pts")
    print("  - Quiz 80%+ score: 30 pts")
    print("  - Study 1 hour: 50 pts")
    print()
    
    db = SessionLocal()
    try:
        user_count = recalculate_all_stats(db)
        print(f"✅ Successfully recalculated stats for {user_count} users!")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
