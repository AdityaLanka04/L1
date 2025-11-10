"""
Migration: Add document_metadata column to uploaded_documents table
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
        cursor.execute("PRAGMA table_info(uploaded_documents)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add document_metadata column if it doesn't exist
        if 'document_metadata' not in columns:
            print("Adding document_metadata column to uploaded_documents table...")
            cursor.execute("ALTER TABLE uploaded_documents ADD COLUMN document_metadata TEXT")
            conn.commit()
            print("✓ Added document_metadata column")
        else:
            print("✓ document_metadata column already exists")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
