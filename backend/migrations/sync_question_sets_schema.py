"""
Migration: Sync question_sets table schema with model
"""

import sqlite3
import os

def migrate():
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(question_sets)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add total_questions column if it doesn't exist
        if 'total_questions' not in columns:
            print("Adding total_questions column to question_sets table...")
            cursor.execute("ALTER TABLE question_sets ADD COLUMN total_questions INTEGER DEFAULT 0")
            # Copy data from question_count if it exists
            if 'question_count' in columns:
                cursor.execute("UPDATE question_sets SET total_questions = question_count")
            conn.commit()
            print("✓ Added total_questions column")
        else:
            print("✓ total_questions column already exists")
        
        # Add attempts column if it doesn't exist
        if 'attempts' not in columns:
            print("Adding attempts column to question_sets table...")
            cursor.execute("ALTER TABLE question_sets ADD COLUMN attempts INTEGER DEFAULT 0")
            # Copy data from attempt_count if it exists
            if 'attempt_count' in columns:
                cursor.execute("UPDATE question_sets SET attempts = attempt_count")
            conn.commit()
            print("✓ Added attempts column")
        else:
            print("✓ attempts column already exists")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
