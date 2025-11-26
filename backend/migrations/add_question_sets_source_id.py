"""
Migration: Add source_id column to question_sets table
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
        # Check if column already exists
        cursor.execute("PRAGMA table_info(question_sets)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add source_id column if it doesn't exist
        if 'source_id' not in columns:
            print("Adding source_id column to question_sets table...")
            cursor.execute("ALTER TABLE question_sets ADD COLUMN source_id INTEGER")
            conn.commit()
            print("✓ Added source_id column")
        else:
            print("✓ source_id column already exists")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
