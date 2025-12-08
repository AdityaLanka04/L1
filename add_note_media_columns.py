"""
Migration: Add media fields to notes table
Run from project root: python add_note_media_columns.py
"""
import sqlite3
import os

def migrate():
    db_path = "backend/brainwave_tutor.db"
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found at {db_path}")
        print(f"Current directory: {os.getcwd()}")
        return
    
    print(f"📂 Using database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(notes)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"Existing columns: {columns}")
        
        # Add transcript column
        if 'transcript' not in columns:
            print("📝 Adding transcript column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN transcript TEXT")
            print("✅ Added transcript column")
        else:
            print("✅ transcript column already exists")
        
        # Add analysis column
        if 'analysis' not in columns:
            print("📝 Adding analysis column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN analysis TEXT")
            print("✅ Added analysis column")
        else:
            print("✅ analysis column already exists")
        
        # Add flashcards column
        if 'flashcards' not in columns:
            print("📝 Adding flashcards column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN flashcards TEXT")
            print("✅ Added flashcards column")
        else:
            print("✅ flashcards column already exists")
        
        # Add quiz_questions column
        if 'quiz_questions' not in columns:
            print("📝 Adding quiz_questions column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN quiz_questions TEXT")
            print("✅ Added quiz_questions column")
        else:
            print("✅ quiz_questions column already exists")
        
        # Add key_moments column
        if 'key_moments' not in columns:
            print("📝 Adding key_moments column...")
            cursor.execute("ALTER TABLE notes ADD COLUMN key_moments TEXT")
            print("✅ Added key_moments column")
        else:
            print("✅ key_moments column already exists")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("🔄 Please restart your backend server now.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
