"""
Migration script to add roadmap_id and is_manual columns to knowledge_nodes table
"""
import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(knowledge_nodes)")
    columns = [col[1] for col in cursor.fetchall()]
    
    # Add roadmap_id column if it doesn't exist
    if 'roadmap_id' not in columns:
        print("Adding roadmap_id column...")
        cursor.execute("ALTER TABLE knowledge_nodes ADD COLUMN roadmap_id INTEGER REFERENCES knowledge_roadmaps(id)")
        print("✓ roadmap_id column added")
    else:
        print("roadmap_id column already exists")
    
    # Add is_manual column if it doesn't exist
    if 'is_manual' not in columns:
        print("Adding is_manual column...")
        cursor.execute("ALTER TABLE knowledge_nodes ADD COLUMN is_manual BOOLEAN DEFAULT 0")
        print("✓ is_manual column added")
    else:
        print("is_manual column already exists")
    
    conn.commit()
    conn.close()
    print("\nMigration complete!")

if __name__ == "__main__":
    migrate()
