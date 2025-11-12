"""
Migration: Add notifications table
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
        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'")
        if cursor.fetchone():
            print("✓ notifications table already exists")
            return
        
        print("Creating notifications table...")
        cursor.execute("""
            CREATE TABLE notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                notification_type VARCHAR(50),
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        conn.commit()
        print("✅ notifications table created successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
