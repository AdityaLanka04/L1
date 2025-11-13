"""
Script to delete ALL concept web data and start fresh
Run this from project root: python cleanup_concepts.py
"""
import sys
import os

# Add backend to path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)

# Now import
from database import SessionLocal, engine
from sqlalchemy import text

def cleanup_all_concepts():
    db = SessionLocal()
    try:
        # Delete using raw SQL to avoid import issues
        result1 = db.execute(text("DELETE FROM concept_connections"))
        print(f"Deleted {result1.rowcount} connections")
        
        result2 = db.execute(text("DELETE FROM concept_nodes"))
        print(f"Deleted {result2.rowcount} concept nodes")
        
        db.commit()
        print("\n✅ ALL CONCEPTS DELETED SUCCESSFULLY!")
        print("Now click the refresh button (⟳) in the UI to regenerate from actual content.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🗑️  Cleaning up ALL concept web data...")
    cleanup_all_concepts()
