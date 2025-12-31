"""
BACKFILL POINT TRANSACTIONS
============================
This script creates PointTransaction records for all existing activities
that were created before the point system was implemented.

This will populate the Analytics charts with historical data.

Run with: python backend/backfill_point_transactions.py
"""
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import models

# Detect database type
DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_POSTGRES = "postgres" in DATABASE_URL

def get_db_session():
    """Create database session (auto-detect SQLite or PostgreSQL)"""
    if USE_POSTGRES:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        db_url = None
        
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
        
        if not db_url:
            print(" DATABASE_URL not found in .env file")
            sys.exit(1)
        
        print(f"📊 Connecting to PostgreSQL database...")
        engine = create_engine(db_url)
    else:
        db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
        
        if not os.path.exists(db_path):
            print(f" SQLite database not found at: {db_path}")
            sys.exit(1)
        
        print(f"📊 Connecting to SQLite database: {db_path}")
        engine = create_engine(f'sqlite:///{db_path}')
    
    Session = sessionmaker(bind=engine)
    return Session()

# Point values (must match gamification_system.py)
POINT_VALUES = {
    "ai_chat": 1,
    "note_created": 20,
    "flashcard_set": 10,
    "quiz_completed": 15,
    "question_answered": 2,
}

def backfill_transactions():
    db = get_db_session()
    
    try:
        print("\n" + "="*80)
        print("🔄 BACKFILLING POINT TRANSACTIONS")
        print("="*80 + "\n")
        
        # Get all users
        users = db.query(models.User).all()
        print(f"📋 Found {len(users)} user(s) in database\n")
        
        total_created = 0
        
        for user in users:
            print("="*80)
            print(f"👤 USER: {user.username} (ID: {user.id})")
            print("="*80)
            
            user_transactions_created = 0
            
            # Get existing transactions to avoid duplicates
            existing_transactions = db.query(models.PointTransaction).filter(
                models.PointTransaction.user_id == user.id
            ).all()
            
            existing_by_type = {}
            for t in existing_transactions:
                key = f"{t.activity_type}_{t.created_at.date()}"
                if key not in existing_by_type:
                    existing_by_type[key] = []
                existing_by_type[key].append(t)
            
            print(f"📊 Existing transactions: {len(existing_transactions)}\n")
            
            # ============================================================
            # 1. BACKFILL FLASHCARD SETS
            # ============================================================
            print("📚 BACKFILLING FLASHCARD SETS:")
            print("-" * 40)
            
            flashcard_sets = db.query(models.FlashcardSet).filter(
                models.FlashcardSet.user_id == user.id
            ).order_by(models.FlashcardSet.created_at.asc()).all()
            
            flashcard_count = 0
            for fs in flashcard_sets:
                created_date = fs.created_at.date() if fs.created_at else datetime.now(timezone.utc).date()
                key = f"flashcard_set_{created_date}"
                
                # Count how many flashcard sets were created on this date
                sets_on_date = [s for s in flashcard_sets if s.created_at and s.created_at.date() == created_date]
                
                # Count existing transactions for this date
                existing_count = len(existing_by_type.get(key, []))
                
                # Only create if we haven't already created enough for this date
                if existing_count < len(sets_on_date):
                    transaction = models.PointTransaction(
                        user_id=user.id,
                        activity_type="flashcard_set",
                        points_earned=POINT_VALUES["flashcard_set"],
                        description=f"Created Flashcard Set: {fs.title}",
                        created_at=fs.created_at or datetime.now(timezone.utc)
                    )
                    db.add(transaction)
                    flashcard_count += 1
                    user_transactions_created += 1
                    
                    # Update the existing count for this key
                    if key not in existing_by_type:
                        existing_by_type[key] = []
                    existing_by_type[key].append(transaction)
            
            print(f"   Created {flashcard_count} flashcard set transactions")
            
            # ============================================================
            # 2. BACKFILL NOTES
            # ============================================================
            print("\n BACKFILLING NOTES:")
            print("-" * 40)
            
            notes = db.query(models.Note).filter(
                models.Note.user_id == user.id
            ).order_by(models.Note.created_at.asc()).all()
            
            note_count = 0
            for note in notes:
                created_date = note.created_at.date() if note.created_at else datetime.now(timezone.utc).date()
                key = f"note_created_{created_date}"
                
                # Count existing transactions for this date
                existing_count = len(existing_by_type.get(key, []))
                
                # Only create if we haven't already created enough for this date
                # (in case multiple notes were created on same day)
                notes_on_date = [n for n in notes if n.created_at and n.created_at.date() == created_date]
                if existing_count < len(notes_on_date):
                    transaction = models.PointTransaction(
                        user_id=user.id,
                        activity_type="note_created",
                        points_earned=POINT_VALUES["note_created"],
                        description=f"Created Note: {note.title[:50]}",
                        created_at=note.created_at or datetime.now(timezone.utc)
                    )
                    db.add(transaction)
                    note_count += 1
                    user_transactions_created += 1
            
            print(f"   Created {note_count} note transactions")
            
            # ============================================================
            # 3. BACKFILL AI CHAT SESSIONS
            # ============================================================
            print("\n BACKFILLING AI CHAT SESSIONS:")
            print("-" * 40)
            
            # Get chat messages (each message = 1 point)
            chat_messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.user_id == user.id
            ).order_by(models.ChatMessage.timestamp.asc()).all()
            
            chat_count = 0
            for msg in chat_messages:
                created_date = msg.timestamp.date() if msg.timestamp else datetime.now(timezone.utc).date()
                key = f"ai_chat_{created_date}"
                
                # Count existing transactions for this date
                existing_count = len(existing_by_type.get(key, []))
                
                # Count messages on this date
                messages_on_date = [m for m in chat_messages if m.timestamp and m.timestamp.date() == created_date]
                
                # Only create if we haven't already created enough for this date
                if existing_count < len(messages_on_date):
                    transaction = models.PointTransaction(
                        user_id=user.id,
                        activity_type="ai_chat",
                        points_earned=POINT_VALUES["ai_chat"],
                        description="AI Chat Message",
                        created_at=msg.timestamp or datetime.now(timezone.utc)
                    )
                    db.add(transaction)
                    chat_count += 1
                    user_transactions_created += 1
            
            print(f"   Created {chat_count} AI chat transactions")
            
            # ============================================================
            # 4. SUMMARY
            # ============================================================
            print("\n" + "-" * 40)
            print(f"📊 TOTAL NEW TRANSACTIONS: {user_transactions_created}")
            print()
            
            total_created += user_transactions_created
        
        # Commit all changes
        db.commit()
        
        print("="*80)
        print(" BACKFILL COMPLETED SUCCESSFULLY!")
        print("="*80)
        print(f"\n📊 SUMMARY:")
        print(f"  • Total new transactions created: {total_created}")
        print(f"  • Users processed: {len(users)}")
        print("\n WHAT WAS BACKFILLED:")
        print("  • Flashcard Sets: 10 points each")
        print("  • Notes: 20 points each")
        print("  • AI Chat Messages: 1 point each")
        print("\n NEXT STEPS:")
        print("  1. Refresh your Analytics page")
        print("  2. Charts will now show complete historical data")
        print("  3. All future activities will automatically create transactions")
        print()
        
    except Exception as e:
        print(f"\n ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n  WARNING: This script will create PointTransaction records for existing activities.")
    print("This is safe to run multiple times - it checks for existing transactions.\n")
    
    response = input("Continue? (yes/no): ").strip().lower()
    if response in ['yes', 'y']:
        backfill_transactions()
    else:
        print(" Cancelled")
