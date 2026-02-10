"""
Production Cache and Stats Cleanup Script
For use with Supabase PostgreSQL database

This script connects to your production Supabase database and clears:
- User statistics
- Learning metrics
- Chat history
- Weak areas
- Topic mastery
- Activities

Usage:
    # Set environment variables first
    export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
    
    # Or use .env.production file
    python clear_production.py --all --confirm
    
    # Clear specific user
    python clear_production.py --user 123 --confirm
    
    # Clear only stats (keep chat history)
    python clear_production.py --stats-only --confirm
"""

import os
import sys
import argparse
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Load production environment
load_dotenv('.env.production')


def get_production_db():
    """Get production database connection"""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL not found in environment")
        print("\nSet it with:")
        print('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"')
        print("\nOr create .env.production file with:")
        print('  DATABASE_URL=postgresql://user:pass@host:5432/dbname')
        sys.exit(1)
    
    # Verify it's a PostgreSQL URL
    if not database_url.startswith("postgresql://") and not database_url.startswith("postgres://"):
        print("❌ ERROR: DATABASE_URL must be a PostgreSQL connection string")
        print(f"   Got: {database_url[:50]}...")
        sys.exit(1)
    
    # Check if it looks like production (has cloud host)
    if "localhost" in database_url or "127.0.0.1" in database_url:
        print("⚠️  WARNING: DATABASE_URL appears to be localhost")
        response = input("Are you sure this is production? (yes/no): ")
        if response.lower() != "yes":
            print("❌ Cancelled")
            sys.exit(1)
    
    try:
        engine = create_engine(database_url)
        Session = sessionmaker(bind=engine)
        return Session()
    except Exception as e:
        print(f"❌ ERROR: Could not connect to database: {e}")
        sys.exit(1)


def clear_user_stats(db, user_id=None):
    """Clear user statistics"""
    print("\n" + "="*80)
    print(f"CLEARING USER STATS{f' (User {user_id})' if user_id else ' (ALL USERS)'}")
    print("="*80)
    
    try:
        tables_to_clear = [
            "user_stats",
            "enhanced_user_stats",
            "daily_learning_metrics",
            "user_weak_areas",
            "topic_mastery",
            "activities",
        ]
        
        total_deleted = 0
        
        for table_name in tables_to_clear:
            try:
                if user_id:
                    # Count first
                    count_result = db.execute(
                        text(f"SELECT COUNT(*) FROM {table_name} WHERE user_id = :user_id"),
                        {"user_id": user_id}
                    )
                    count = count_result.scalar()
                    
                    # Delete
                    db.execute(
                        text(f"DELETE FROM {table_name} WHERE user_id = :user_id"),
                        {"user_id": user_id}
                    )
                else:
                    # Count first
                    count_result = db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    count = count_result.scalar()
                    
                    # Delete
                    db.execute(text(f"DELETE FROM {table_name}"))
                
                print(f"  ✅ Cleared {count} rows from {table_name}")
                total_deleted += count
            except Exception as e:
                print(f"  ⚠️  Could not clear {table_name}: {e}")
        
        db.commit()
        print(f"✅ Total: Cleared {total_deleted} rows from user stats tables")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing user stats: {e}")
        db.rollback()
        return False


def clear_chat_history(db, user_id=None):
    """Clear chat history"""
    print("\n" + "="*80)
    print(f"CLEARING CHAT HISTORY{f' (User {user_id})' if user_id else ' (ALL USERS)'}")
    print("="*80)
    
    try:
        if user_id:
            # Count messages
            message_count_result = db.execute(
                text("""
                    SELECT COUNT(*) FROM chat_messages 
                    WHERE chat_session_id IN (
                        SELECT id FROM chat_sessions WHERE user_id = :user_id
                    )
                """),
                {"user_id": user_id}
            )
            message_count = message_count_result.scalar()
            
            # Count sessions
            session_count_result = db.execute(
                text("SELECT COUNT(*) FROM chat_sessions WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            session_count = session_count_result.scalar()
            
            # Delete messages first (foreign key constraint)
            db.execute(
                text("""
                    DELETE FROM chat_messages 
                    WHERE chat_session_id IN (
                        SELECT id FROM chat_sessions WHERE user_id = :user_id
                    )
                """),
                {"user_id": user_id}
            )
            
            # Delete sessions
            db.execute(
                text("DELETE FROM chat_sessions WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
        else:
            # Count all
            message_count_result = db.execute(text("SELECT COUNT(*) FROM chat_messages"))
            message_count = message_count_result.scalar()
            
            session_count_result = db.execute(text("SELECT COUNT(*) FROM chat_sessions"))
            session_count = session_count_result.scalar()
            
            # Delete all
            db.execute(text("DELETE FROM chat_messages"))
            db.execute(text("DELETE FROM chat_sessions"))
        
        db.commit()
        print(f"  ✅ Cleared {message_count} messages")
        print(f"  ✅ Cleared {session_count} chat sessions")
        print("✅ Chat history cleared successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing chat history: {e}")
        db.rollback()
        return False


def verify_cleanup(db, user_id=None):
    """Verify that cleanup was successful"""
    print("\n" + "="*80)
    print("VERIFICATION")
    print("="*80)
    
    tables = [
        "user_stats",
        "enhanced_user_stats",
        "daily_learning_metrics",
        "user_weak_areas",
        "topic_mastery",
        "activities",
        "chat_sessions",
    ]
    
    print("\nRemaining rows:")
    for table in tables:
        try:
            if user_id:
                result = db.execute(
                    text(f"SELECT COUNT(*) FROM {table} WHERE user_id = :user_id"),
                    {"user_id": user_id}
                )
            else:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
            
            count = result.scalar()
            status = "✅" if count == 0 else "⚠️ "
            print(f"  {status} {table}: {count} rows")
        except Exception as e:
            print(f"  ❌ {table}: Error - {e}")


def main():
    parser = argparse.ArgumentParser(description="Clear production cache and stats")
    parser.add_argument("--all", action="store_true", help="Clear everything")
    parser.add_argument("--stats-only", action="store_true", help="Clear only stats")
    parser.add_argument("--chat-only", action="store_true", help="Clear only chat history")
    parser.add_argument("--user", type=int, help="Clear for specific user ID")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--verify-only", action="store_true", help="Only verify, don't delete")
    
    args = parser.parse_args()
    
    # Default to --all if no specific option
    if not any([args.all, args.stats_only, args.chat_only, args.verify_only]):
        args.all = True
    
    # Get production database
    print("\n" + "="*80)
    print("PRODUCTION DATABASE CLEANUP")
    print("="*80)
    print(f"Time: {datetime.now().isoformat()}")
    
    db = get_production_db()
    
    # Verify database connection
    try:
        result = db.execute(text("SELECT current_database(), current_user"))
        db_name, db_user = result.fetchone()
        print(f"\n✅ Connected to database: {db_name}")
        print(f"✅ Connected as user: {db_user}")
    except Exception as e:
        print(f"❌ Could not verify database connection: {e}")
        sys.exit(1)
    
    # Verify-only mode
    if args.verify_only:
        verify_cleanup(db, args.user)
        db.close()
        return
    
    # Confirmation
    if not args.confirm:
        print("\n" + "="*80)
        print("⚠️  WARNING: This will permanently delete PRODUCTION data!")
        print("="*80)
        
        if args.user:
            print(f"\nTarget: User {args.user}")
        else:
            print("\n🚨 Target: ALL USERS IN PRODUCTION DATABASE 🚨")
        
        print("\nWhat will be cleared:")
        if args.all or args.stats_only:
            print("  - User statistics")
            print("  - Learning metrics")
            print("  - Weak areas")
            print("  - Topic mastery")
            print("  - Activities")
        if args.all or args.chat_only:
            print("  - Chat history")
            print("  - Chat sessions")
        
        print("\n⚠️  THIS CANNOT BE UNDONE!")
        response = input("\nType 'DELETE PRODUCTION DATA' to continue: ")
        if response != "DELETE PRODUCTION DATA":
            print("❌ Cancelled")
            db.close()
            return
    
    print("\n" + "="*80)
    print("STARTING PRODUCTION CLEANUP")
    print("="*80)
    
    results = []
    
    try:
        # Clear stats
        if args.all or args.stats_only:
            results.append(("User Stats", clear_user_stats(db, args.user)))
        
        # Clear chat history
        if args.all or args.chat_only:
            results.append(("Chat History", clear_chat_history(db, args.user)))
        
        # Verify
        verify_cleanup(db, args.user)
        
    finally:
        db.close()
    
    # Summary
    print("\n" + "="*80)
    print("PRODUCTION CLEANUP SUMMARY")
    print("="*80)
    
    for name, success in results:
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{status}: {name}")
    
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    print(f"\nCompleted: {success_count}/{total_count} operations successful")
    print(f"Time: {datetime.now().isoformat()}")
    print("="*80 + "\n")
    
    print("📝 NOTE: This script only clears PostgreSQL data.")
    print("   To clear Redis cache and RAG collections, run:")
    print("   python clear_cache_and_stats.py --cache-only --rag-only")


if __name__ == "__main__":
    main()
