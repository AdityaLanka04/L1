"""
Migration script to add missing columns to existing tables
Run this once to fix schema issues
"""

import sys
from sqlalchemy import text
from database import engine, SessionLocal

def migrate():
    """Add missing columns to tables"""
    
    print("🔧 Starting migration to fix missing columns...")
    
    db = SessionLocal()
    
    try:
        # Add folder_id to chat_sessions
        print("Adding folder_id to chat_sessions...")
        try:
            db.execute(text("""
                ALTER TABLE chat_sessions 
                ADD COLUMN folder_id INTEGER
            """))
            db.commit()
            print("✅ Added folder_id to chat_sessions")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  folder_id already exists in chat_sessions")
                db.rollback()
            else:
                print(f"⚠️  Could not add folder_id to chat_sessions: {e}")
                db.rollback()
        
        # Add quiz_skipped to comprehensive_user_profiles
        print("Adding quiz_skipped to comprehensive_user_profiles...")
        try:
            db.execute(text("""
                ALTER TABLE comprehensive_user_profiles 
                ADD COLUMN quiz_skipped BOOLEAN DEFAULT 0
            """))
            db.commit()
            print("✅ Added quiz_skipped to comprehensive_user_profiles")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("⏭️  quiz_skipped already exists in comprehensive_user_profiles")
                db.rollback()
            elif "no such table" in str(e).lower():
                print("⏭️  comprehensive_user_profiles table doesn't exist yet")
                db.rollback()
            else:
                print(f"⚠️  Could not add quiz_skipped: {e}")
                db.rollback()
        
        print("\n✅ Migration completed!")
        print("\n📝 Missing columns have been added!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
