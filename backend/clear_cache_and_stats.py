"""
Clear All Cache and Stats Script
Clears Redis cache, AI cache, and optionally resets user stats

Usage:
    python clear_cache_and_stats.py --all              # Clear everything
    python clear_cache_and_stats.py --cache-only       # Clear only cache
    python clear_cache_and_stats.py --stats-only       # Clear only stats
    python clear_cache_and_stats.py --user USER_ID     # Clear for specific user
"""

import os
import sys
import argparse
from datetime import datetime
from sqlalchemy import text

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models


def clear_redis_cache():
    """Clear Redis cache if available"""
    print("\n" + "="*80)
    print("CLEARING REDIS CACHE")
    print("="*80)
    
    try:
        import redis
        redis_url = os.getenv("REDIS_URL")
        
        if not redis_url:
            print("⚠️  No REDIS_URL found in environment")
            return False
        
        r = redis.from_url(redis_url)
        
        # Get all keys
        keys = r.keys("*")
        print(f"Found {len(keys)} Redis keys")
        
        if keys:
            # Delete all keys
            deleted = r.delete(*keys)
            print(f"✅ Deleted {deleted} Redis keys")
        else:
            print("✅ Redis cache already empty")
        
        return True
        
    except ImportError:
        print("⚠️  Redis not installed (pip install redis)")
        return False
    except Exception as e:
        print(f"❌ Error clearing Redis: {e}")
        return False


def clear_ai_cache():
    """Clear AI response cache"""
    print("\n" + "="*80)
    print("CLEARING AI CACHE")
    print("="*80)
    
    try:
        from caching.cache_manager import get_cache_manager
        
        cache_manager = get_cache_manager()
        if cache_manager:
            cache_manager.clear_all()
            print("✅ AI cache cleared")
            return True
        else:
            print("⚠️  Cache manager not available")
            return False
            
    except Exception as e:
        print(f"❌ Error clearing AI cache: {e}")
        return False


def clear_user_stats(db, user_id=None):
    """Clear user statistics"""
    print("\n" + "="*80)
    print(f"CLEARING USER STATS{f' (User {user_id})' if user_id else ' (ALL USERS)'}")
    print("="*80)
    
    try:
        if user_id:
            # Clear specific user
            filter_clause = f"WHERE user_id = {user_id}"
        else:
            # Clear all users
            filter_clause = ""
        
        tables_to_clear = [
            ("UserStats", "user_stats"),
            ("EnhancedUserStats", "enhanced_user_stats"),
            ("DailyLearningMetrics", "daily_learning_metrics"),
            ("UserWeakArea", "user_weak_areas"),
            ("TopicMastery", "topic_mastery"),
            ("Activity", "activities"),
        ]
        
        for model_name, table_name in tables_to_clear:
            try:
                if user_id:
                    count = db.execute(text(f"SELECT COUNT(*) FROM {table_name} WHERE user_id = :user_id"), {"user_id": user_id}).scalar()
                    db.execute(text(f"DELETE FROM {table_name} WHERE user_id = :user_id"), {"user_id": user_id})
                else:
                    count = db.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
                    db.execute(text(f"DELETE FROM {table_name}"))
                
                print(f"  ✅ Cleared {count} rows from {table_name}")
            except Exception as e:
                print(f"  ⚠️  Could not clear {table_name}: {e}")
        
        db.commit()
        print("✅ User stats cleared successfully")
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
            # Clear specific user's chats
            message_count = db.query(models.ChatMessage).join(models.ChatSession).filter(
                models.ChatSession.user_id == user_id
            ).count()
            
            session_count = db.query(models.ChatSession).filter(
                models.ChatSession.user_id == user_id
            ).count()
            
            # Delete messages first (foreign key constraint)
            db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id.in_(
                    db.query(models.ChatSession.id).filter(models.ChatSession.user_id == user_id)
                )
            ).delete(synchronize_session=False)
            
            # Delete sessions
            db.query(models.ChatSession).filter(
                models.ChatSession.user_id == user_id
            ).delete(synchronize_session=False)
        else:
            # Clear all chats
            message_count = db.query(models.ChatMessage).count()
            session_count = db.query(models.ChatSession).count()
            
            db.query(models.ChatMessage).delete()
            db.query(models.ChatSession).delete()
        
        db.commit()
        print(f"  ✅ Cleared {message_count} messages")
        print(f"  ✅ Cleared {session_count} chat sessions")
        print("✅ Chat history cleared successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing chat history: {e}")
        db.rollback()
        return False


def clear_rag_collections(user_id=None):
    """Clear RAG vector store collections"""
    print("\n" + "="*80)
    print(f"CLEARING RAG COLLECTIONS{f' (User {user_id})' if user_id else ' (ALL USERS)'}")
    print("="*80)
    
    try:
        import chromadb
        from agents.rag.user_rag_manager import UserRAGManager
        
        # Get ChromaDB path
        chroma_path = os.path.join(os.path.dirname(__file__), "chroma_db")
        
        if not os.path.exists(chroma_path):
            print("⚠️  ChromaDB directory not found")
            return False
        
        client = chromadb.PersistentClient(path=chroma_path)
        
        if user_id:
            # Clear specific user's collection
            rag_manager = UserRAGManager()
            collection_name = rag_manager._get_user_collection_name(str(user_id))
            
            try:
                client.delete_collection(collection_name)
                print(f"  ✅ Deleted collection: {collection_name}")
            except Exception as e:
                print(f"  ⚠️  Collection {collection_name} not found or already deleted")
        else:
            # Clear all collections
            collections = client.list_collections()
            print(f"Found {len(collections)} collections")
            
            for collection in collections:
                try:
                    client.delete_collection(collection.name)
                    print(f"  ✅ Deleted collection: {collection.name}")
                except Exception as e:
                    print(f"  ⚠️  Could not delete {collection.name}: {e}")
        
        print("✅ RAG collections cleared successfully")
        return True
        
    except ImportError:
        print("⚠️  ChromaDB not installed")
        return False
    except Exception as e:
        print(f"❌ Error clearing RAG collections: {e}")
        return False


def clear_knowledge_graph(user_id=None):
    """Clear knowledge graph data"""
    print("\n" + "="*80)
    print(f"CLEARING KNOWLEDGE GRAPH{f' (User {user_id})' if user_id else ' (ALL USERS)'}")
    print("="*80)
    
    try:
        from knowledge_graph.neo4j_client import Neo4jClient
        
        neo4j_client = Neo4jClient()
        
        if not neo4j_client.driver:
            print("⚠️  Neo4j not configured")
            return False
        
        with neo4j_client.driver.session() as session:
            if user_id:
                # Delete specific user's data
                result = session.run("""
                    MATCH (u:User {user_id: $user_id})
                    OPTIONAL MATCH (u)-[r]-()
                    DELETE r, u
                    RETURN count(u) as deleted
                """, user_id=str(user_id))
                
                deleted = result.single()["deleted"]
                print(f"  ✅ Deleted user node and {deleted} relationships")
            else:
                # Delete all user data (keep concept structure)
                result = session.run("""
                    MATCH (u:User)
                    OPTIONAL MATCH (u)-[r]-()
                    DELETE r, u
                    RETURN count(u) as deleted
                """)
                
                deleted = result.single()["deleted"]
                print(f"  ✅ Deleted {deleted} user nodes and their relationships")
        
        print("✅ Knowledge graph cleared successfully")
        return True
        
    except Exception as e:
        print(f"❌ Error clearing knowledge graph: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Clear cache and stats")
    parser.add_argument("--all", action="store_true", help="Clear everything")
    parser.add_argument("--cache-only", action="store_true", help="Clear only cache")
    parser.add_argument("--stats-only", action="store_true", help="Clear only stats")
    parser.add_argument("--chat-only", action="store_true", help="Clear only chat history")
    parser.add_argument("--rag-only", action="store_true", help="Clear only RAG collections")
    parser.add_argument("--kg-only", action="store_true", help="Clear only knowledge graph")
    parser.add_argument("--user", type=int, help="Clear for specific user ID")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    
    args = parser.parse_args()
    
    # Default to --all if no specific option
    if not any([args.all, args.cache_only, args.stats_only, args.chat_only, args.rag_only, args.kg_only]):
        args.all = True
    
    # Confirmation
    if not args.confirm:
        print("\n" + "="*80)
        print("⚠️  WARNING: This will permanently delete data!")
        print("="*80)
        
        if args.user:
            print(f"\nTarget: User {args.user}")
        else:
            print("\nTarget: ALL USERS")
        
        print("\nWhat will be cleared:")
        if args.all or args.cache_only:
            print("  - Redis cache")
            print("  - AI response cache")
        if args.all or args.stats_only:
            print("  - User statistics")
            print("  - Learning metrics")
            print("  - Weak areas")
            print("  - Topic mastery")
            print("  - Activities")
        if args.all or args.chat_only:
            print("  - Chat history")
            print("  - Chat sessions")
        if args.all or args.rag_only:
            print("  - RAG vector collections")
        if args.all or args.kg_only:
            print("  - Knowledge graph data")
        
        response = input("\nAre you sure? Type 'yes' to continue: ")
        if response.lower() != "yes":
            print("❌ Cancelled")
            return
    
    print("\n" + "="*80)
    print("STARTING CLEANUP")
    print("="*80)
    print(f"Time: {datetime.now().isoformat()}")
    
    db = SessionLocal()
    results = []
    
    try:
        # Clear cache
        if args.all or args.cache_only:
            results.append(("Redis Cache", clear_redis_cache()))
            results.append(("AI Cache", clear_ai_cache()))
        
        # Clear stats
        if args.all or args.stats_only:
            results.append(("User Stats", clear_user_stats(db, args.user)))
        
        # Clear chat history
        if args.all or args.chat_only:
            results.append(("Chat History", clear_chat_history(db, args.user)))
        
        # Clear RAG
        if args.all or args.rag_only:
            results.append(("RAG Collections", clear_rag_collections(args.user)))
        
        # Clear knowledge graph
        if args.all or args.kg_only:
            results.append(("Knowledge Graph", clear_knowledge_graph(args.user)))
        
    finally:
        db.close()
    
    # Summary
    print("\n" + "="*80)
    print("CLEANUP SUMMARY")
    print("="*80)
    
    for name, success in results:
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{status}: {name}")
    
    success_count = sum(1 for _, success in results if success)
    total_count = len(results)
    
    print(f"\nCompleted: {success_count}/{total_count} operations successful")
    print(f"Time: {datetime.now().isoformat()}")
    print("="*80 + "\n")


if __name__ == "__main__":
    main()
