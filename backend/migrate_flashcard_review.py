"""
Migration script to add marked_for_review column to flashcards table
Run this once to update existing databases
"""

import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column already exists
    cursor.execute("PRAGMA table_info(flashcards)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'marked_for_review' not in columns:
        print("Adding marked_for_review column to flashcards table...")
        cursor.execute("ALTER TABLE flashcards ADD COLUMN marked_for_review BOOLEAN DEFAULT 0")
        conn.commit()
        print("✓ Migration complete: marked_for_review column added")
    else:
        print("✓ Column marked_for_review already exists, no migration needed")
    
    conn.close()

if __name__ == "__main__":
    migrate()
