"""
Migration script to add is_edited and edited_at columns to flashcards table
"""
import sqlite3
from datetime import datetime

def add_edited_columns():
    """Add is_edited and edited_at columns to flashcards table"""
    
    db_path = "brainwave_tutor.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(flashcards)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add is_edited column if it doesn't exist
        if 'is_edited' not in columns:
            print("Adding is_edited column...")
            cursor.execute("""
                ALTER TABLE flashcards 
                ADD COLUMN is_edited BOOLEAN DEFAULT 0
            """)
            print("✓ Added is_edited column")
        else:
            print("✓ is_edited column already exists")
        
        # Add edited_at column if it doesn't exist
        if 'edited_at' not in columns:
            print("Adding edited_at column...")
            cursor.execute("""
                ALTER TABLE flashcards 
                ADD COLUMN edited_at DATETIME
            """)
            print("✓ Added edited_at column")
        else:
            print("✓ edited_at column already exists")
        
        conn.commit()
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(flashcards)")
        columns = cursor.fetchall()
        print("\nFlashcards table columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise

if __name__ == "__main__":
    add_edited_columns()
