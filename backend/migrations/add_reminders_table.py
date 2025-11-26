"""
Migration: Add reminders table for calendar events and reminders
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
        # Check if table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reminders'")
        if cursor.fetchone():
            print("✓ reminders table already exists")
        else:
            print("Creating reminders table...")
            cursor.execute("""
                CREATE TABLE reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    title VARCHAR(200) NOT NULL,
                    description TEXT,
                    reminder_date DATETIME NOT NULL,
                    reminder_type VARCHAR(50) DEFAULT 'event',
                    priority VARCHAR(20) DEFAULT 'medium',
                    color VARCHAR(20) DEFAULT '#3b82f6',
                    is_completed BOOLEAN DEFAULT 0,
                    is_notified BOOLEAN DEFAULT 0,
                    notify_before_minutes INTEGER DEFAULT 15,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX idx_reminders_user_id ON reminders(user_id)")
            cursor.execute("CREATE INDEX idx_reminders_date ON reminders(reminder_date)")
            
            conn.commit()
            print("✓ Created reminders table with indexes")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
