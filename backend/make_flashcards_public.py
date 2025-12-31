"""
Quick script to make all flashcard sets public
Run this once to make existing flashcard sets searchable
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models

def make_all_flashcards_public():
    db = SessionLocal()
    try:
        # Get all flashcard sets
        flashcard_sets = db.query(models.FlashcardSet).all()
        
        print(f"Found {len(flashcard_sets)} flashcard sets")
        
        # Make them all public
        for fset in flashcard_sets:
            fset.is_public = True
            print(f" Made public: {fset.title} (ID: {fset.id}, User: {fset.user_id})")
        
        db.commit()
        print(f"\n Successfully made {len(flashcard_sets)} flashcard sets public!")
        
    except Exception as e:
        print(f" Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    make_all_flashcards_public()
