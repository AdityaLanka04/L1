from sqlalchemy import create_engine, Column, Boolean, DateTime
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import models
from database import engine

def upgrade():
    """Add missing columns to notes table"""
    try:
        # Check if columns exist, if not add them
        with engine.connect() as conn:
            # Add is_deleted column if it doesn't exist
            try:
                conn.execute("ALTER TABLE notes ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE")
                print("✅ Added is_deleted column")
            except:
                print("ℹ️ is_deleted column already exists")
            
            # Add deleted_at column if it doesn't exist
            try:
                conn.execute("ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE")
                print("✅ Added deleted_at column")
            except:
                print("ℹ️ deleted_at column already exists")
            
            # Add is_favorite column if it doesn't exist
            try:
                conn.execute("ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE")
                print("✅ Added is_favorite column")
            except:
                print("ℹ️ is_favorite column already exists")
            
            # Add folder_id column if it doesn't exist
            try:
                conn.execute("ALTER TABLE notes ADD COLUMN folder_id INTEGER")
                print("✅ Added folder_id column")
            except:
                print("ℹ️ folder_id column already exists")
            
            conn.commit()
            print("✅ Migration completed successfully")
    
    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")

if __name__ == "__main__":
    upgrade()