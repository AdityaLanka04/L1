"""
Migration: Add export fields to knowledge_nodes table
Adds: why_important, real_world_examples, learning_tips columns
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
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(knowledge_nodes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add why_important column if it doesn't exist
        if 'why_important' not in columns:
            print("Adding why_important column...")
            cursor.execute("ALTER TABLE knowledge_nodes ADD COLUMN why_important TEXT")
            print("✓ Added why_important column")
        else:
            print("✓ why_important column already exists")
        
        # Add real_world_examples column if it doesn't exist
        if 'real_world_examples' not in columns:
            print("Adding real_world_examples column...")
            cursor.execute("ALTER TABLE knowledge_nodes ADD COLUMN real_world_examples TEXT")
            print("✓ Added real_world_examples column")
        else:
            print("✓ real_world_examples column already exists")
        
        # Add learning_tips column if it doesn't exist
        if 'learning_tips' not in columns:
            print("Adding learning_tips column...")
            cursor.execute("ALTER TABLE knowledge_nodes ADD COLUMN learning_tips TEXT")
            print("✓ Added learning_tips column")
        else:
            print("✓ learning_tips column already exists")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
