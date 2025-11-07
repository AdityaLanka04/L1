"""
Simple migration script using your existing database setup
This works with both SQLite and PostgreSQL
"""

import sys
from sqlalchemy import text
from database import engine, SessionLocal

def migrate():
    """Add challenger_answers and opponent_answers columns"""
    
    print("🔧 Starting migration...")
    
    db = SessionLocal()
    
    try:
        # Try to add challenger_answers column
        print("Adding challenger_answers column...")
        try:
            db.execute(text("""
                ALTER TABLE quiz_battles 
                ADD COLUMN challenger_answers TEXT
            """))
            db.commit()
            print("✅ Added challenger_answers column")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("⏭️  challenger_answers column already exists")
                db.rollback()
            else:
                print(f"⚠️  Error adding challenger_answers: {e}")
                db.rollback()
        
        # Try to add opponent_answers column
        print("Adding opponent_answers column...")
        try:
            db.execute(text("""
                ALTER TABLE quiz_battles 
                ADD COLUMN opponent_answers TEXT
            """))
            db.commit()
            print("✅ Added opponent_answers column")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("⏭️  opponent_answers column already exists")
                db.rollback()
            else:
                print(f"⚠️  Error adding opponent_answers: {e}")
                db.rollback()
        
        print("\n✅ Migration completed!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
