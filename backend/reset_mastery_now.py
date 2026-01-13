"""
Quick script to reset all flashcard mastery data
Run this once to clear existing mastery data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models

def reset_all_mastery():
    db = SessionLocal()
    try:
        # Reset all flashcard mastery data
        updated = db.query(models.Flashcard).update({
            "times_reviewed": 0,
            "correct_count": 0,
            "marked_for_review": False,
            "last_reviewed": None
        })
        db.commit()
        print(f"✓ Reset mastery data for {updated} flashcards")
        return updated
    except Exception as e:
        db.rollback()
        print(f"✗ Error: {e}")
        return 0
    finally:
        db.close()

if __name__ == "__main__":
    reset_all_mastery()
