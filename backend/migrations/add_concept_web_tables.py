"""
Migration: Add concept web builder tables
Creates: concept_nodes and concept_connections tables
"""

import sqlite3
import os

def migrate():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'brainwave_tutor.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("=" * 60)
        print("CREATING CONCEPT WEB BUILDER TABLES")
        print("=" * 60)
        
        # Check if concept_nodes table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='concept_nodes'")
        if not cursor.fetchone():
            print("\n1. Creating concept_nodes table...")
            cursor.execute("""
                CREATE TABLE concept_nodes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    concept_name VARCHAR(200) NOT NULL,
                    description TEXT,
                    category VARCHAR(100),
                    importance_score FLOAT DEFAULT 0.5,
                    mastery_level FLOAT DEFAULT 0.0,
                    position_x FLOAT,
                    position_y FLOAT,
                    notes_count INTEGER DEFAULT 0,
                    quizzes_count INTEGER DEFAULT 0,
                    flashcards_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            print("   ✓ Created concept_nodes table")
        else:
            print("   ✓ concept_nodes table already exists")
        
        # Check if concept_connections table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='concept_connections'")
        if not cursor.fetchone():
            print("\n2. Creating concept_connections table...")
            cursor.execute("""
                CREATE TABLE concept_connections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    source_concept_id INTEGER NOT NULL,
                    target_concept_id INTEGER NOT NULL,
                    connection_type VARCHAR(50),
                    strength FLOAT DEFAULT 0.5,
                    ai_generated BOOLEAN DEFAULT 0,
                    user_confirmed BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (source_concept_id) REFERENCES concept_nodes(id),
                    FOREIGN KEY (target_concept_id) REFERENCES concept_nodes(id)
                )
            """)
            print("   ✓ Created concept_connections table")
        else:
            print("   ✓ concept_connections table already exists")
        
        conn.commit()
        print("\n" + "=" * 60)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
