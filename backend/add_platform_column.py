"""
Migration script to add platform column to playlist_items table
"""
import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')

def add_platform_column():
    """Add platform column to playlist_items table"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(playlist_items)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'platform' not in columns:
            print("Adding platform column to playlist_items table...")
            cursor.execute("""
                ALTER TABLE playlist_items 
                ADD COLUMN platform VARCHAR(100)
            """)
            conn.commit()
            print("✅ Successfully added platform column!")
        else:
            print("ℹ️  Platform column already exists")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.close()

if __name__ == "__main__":
    add_platform_column()
