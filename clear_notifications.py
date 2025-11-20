"""
Clear all notifications from database
Run this once to clean up old test notifications
"""
import sys
sys.path.append('backend')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models

# Database connection
DATABASE_URL = "sqlite:///./backend/brainwave.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def clear_all_notifications():
    db = SessionLocal()
    try:
        # Delete all notifications
        deleted = db.query(models.Notification).delete()
        db.commit()
        print(f"✅ Deleted {deleted} notifications from database")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🗑️  Clearing all notifications...")
    clear_all_notifications()
    print("✅ Done!")
