"""
Migration: Add media_file_id column to notes table and create media_files table
Run from project root: python add_media_migration.py
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
        # Check if media_files table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='media_files'
        """)
        
        if not cursor.fetchone():
            print("📝 Creating media_files table...")
            cursor.execute("""
                CREATE TABLE media_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    file_type VARCHAR(20),
                    original_filename VARCHAR(255),
                    file_size INTEGER,
                    storage_path VARCHAR(500),
                    storage_type VARCHAR(20),
                    extracted_text TEXT,
                    language VARCHAR(10),
                    duration INTEGER,
                    page_count INTEGER,
                    word_count INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            conn.commit()
            print("✅ Successfully created media_files table")
        else:
            print("✅ media_files table already exists")
        
        # Check if column already exists in notes table
        cursor.execute("PRAGMA table_info(notes)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'media_file_id' in columns:
            print("✅ Column 'media_file_id' already exists in notes table")
        else:
            print("📝 Adding media_file_id column to notes table...")
            cursor.execute("""
                ALTER TABLE notes 
                ADD COLUMN media_file_id INTEGER 
                REFERENCES media_files(id)
            """)
            conn.commit()
            print("✅ Successfully added media_file_id column")
        
        print("\n✅ Migration completed successfully!")
        print("🔄 Please restart your backend server now.")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
