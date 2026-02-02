"""
Caching System Usage Examples
Demonstrates how to use the caching system in various scenarios
"""
import asyncio
from typing import List, Dict, Any
from sqlalchemy.orm import Session

# ==================== Example 1: AI Response Caching ====================

def example_ai_caching():
    """
    AI responses are automatically cached
    No code changes needed - just use unified_ai as normal
    """
    from ai_utils import UnifiedAIClient
    
    # Initialize AI client (already has caching built-in)
    ai_client = UnifiedAIClient(...)
    
    # First call - hits LLM API
    response1 = ai_client.generate("Explain photosynthesis")
    print(f"First call: {len(response1)} chars")
    
    # Second call - returns cached response (saves tokens!)
    response2 = ai_client.generate("Explain photosynthesis")
    print(f"Second call (cached): {len(response2)} chars")
    
    # Different prompt - hits API again
    response3 = ai_client.generate("Explain cellular respiration")
    print(f"Different prompt: {len(response3)} chars")


# ==================== Example 2: Database Query Caching ====================

def example_db_caching():
    """
    Cache expensive database queries
    """
    from caching.db_cache import cached_query, invalidate_user_cache
    from models import User, Note
    
    # Define cached query function
    @cached_query("user_with_notes", ttl=300)
    def get_user_with_notes(db: Session, user_id: int):
        """Get user with all their notes"""
        user = db.query(User).filter(User.id == user_id).first()
        notes = db.query(Note).filter(Note.user_id == user_id).all()
        return {"user": user, "notes": notes}
    
    # First call - queries database
    result1 = get_user_with_notes(db, user_id=123)
    print(f"First call: {len(result1['notes'])} notes")
    
    # Second call - returns cached result
    result2 = get_user_with_notes(db, user_id=123)
    print(f"Second call (cached): {len(result2['notes'])} notes")
    
    # When user data changes, invalidate cache
    # ... user updates their profile ...
    invalidate_user_cache(user_id=123)
    
    # Next call will query database again
    result3 = get_user_with_notes(db, user_id=123)


# ==================== Example 3: RAG Query Caching ====================

async def example_rag_caching():
    """
    RAG queries are automatically cached
    """
    from agents.rag.rag_helper import smart_retrieve
    
    # First call - performs vector search
    results1 = await smart_retrieve(
        query="machine learning algorithms",
        user_id="123",
        top_k=10
    )
    print(f"First call: {len(results1['results'])} results")
    
    # Second call - returns cached results
    results2 = await smart_retrieve(
        query="machine learning algorithms",
        user_id="123",
        top_k=10
    )
    print(f"Second call (cached): {len(results2['results'])} results")


# ==================== Example 4: Embedding Caching ====================

def example_embedding_caching():
    """
    Cache text embeddings to avoid recomputation
    """
    from caching.embedding_cache import wrap_embedding_model
    from sentence_transformers import SentenceTransformer
    
    # Wrap your embedding model
    base_model = SentenceTransformer('all-MiniLM-L6-v2')
    cached_model = wrap_embedding_model(base_model)
    
    texts = [
        "Machine learning is a subset of AI",
        "Deep learning uses neural networks",
        "Machine learning is a subset of AI"  # Duplicate
    ]
    
    # First call - computes embeddings
    embeddings1 = cached_model.encode(texts)
    print(f"Computed {len(embeddings1)} embeddings")
    # Note: The duplicate text only computed once!
    
    # Second call - all from cache
    embeddings2 = cached_model.encode(texts)
    print(f"All {len(embeddings2)} embeddings from cache!")


# ==================== Example 5: Batch Caching ====================

def example_batch_caching():
    """
    Cache multiple items at once for efficiency
    """
    from caching.db_cache import cache_batch_results
    from models import User
    
    # Load all users
    users = db.query(User).all()
    
    # Cache them all at once
    user_dict = {user.id: user for user in users}
    cache_batch_results("user_profile", user_dict, ttl=600)
    
    print(f"Cached {len(user_dict)} user profiles")


# ==================== Example 6: Cache Warming ====================

def example_cache_warming():
    """
    Pre-load frequently accessed data on user login
    """
    from caching.db_cache import warm_user_cache
    
    def on_user_login(db: Session, user_id: int):
        """Called when user logs in"""
        # Warm cache with commonly accessed data
        warm_user_cache(db, user_id)
        
        print(f"Cache warmed for user {user_id}")
        print("Pre-loaded: profile, stats, flashcards, notes, chats, metrics")


# ==================== Example 7: Smart Cache Invalidation ====================

def example_smart_invalidation():
    """
    Automatically invalidate cache when data changes
    """
    from caching.db_cache import CacheInvalidator
    from models import Note
    
    def update_note(db: Session, note_id: int, user_id: int, new_content: str):
        """Update note with automatic cache invalidation"""
        
        # Use context manager for automatic invalidation
        with CacheInvalidator(user_id=user_id, content_type="note", content_id=note_id):
            note = db.query(Note).filter(Note.id == note_id).first()
            note.content = new_content
            note.updated_at = datetime.utcnow()
            db.commit()
        
        # Cache automatically invalidated after successful commit
        print(f"Note {note_id} updated and cache invalidated")


# ==================== Example 8: Custom Caching ====================

def example_custom_caching():
    """
    Use cache manager directly for custom caching needs
    """
    from caching import get_cache_manager
    
    cache_manager = get_cache_manager()
    
    # Cache any data
    cache_manager.set("my_expensive_calculation", {"result": 42}, ttl=300)
    
    # Retrieve later
    result = cache_manager.get("my_expensive_calculation")
    if result:
        print(f"Got cached result: {result}")
    else:
        print("Cache miss - need to recalculate")


# ==================== Example 9: Decorator-based Caching ====================

def example_decorator_caching():
    """
    Use decorators for automatic function result caching
    """
    from caching import get_cache_manager, cached, async_cached
    
    cache_manager = get_cache_manager()
    
    # Sync function caching
    @cached(cache_manager, ttl=300, key_prefix="fibonacci")
    def fibonacci(n: int) -> int:
        """Expensive recursive calculation"""
        if n <= 1:
            return n
        return fibonacci(n-1) + fibonacci(n-2)
    
    # First call - computes
    result1 = fibonacci(30)
    print(f"First call: {result1}")
    
    # Second call - cached
    result2 = fibonacci(30)
    print(f"Second call (cached): {result2}")
    
    # Async function caching
    @async_cached(cache_manager, ttl=300)
    async def fetch_user_data(user_id: int) -> Dict[str, Any]:
        """Expensive async operation"""
        # Simulate API call
        await asyncio.sleep(1)
        return {"user_id": user_id, "data": "..."}
    
    # Use async function
    data1 = await fetch_user_data(123)  # Takes 1 second
    data2 = await fetch_user_data(123)  # Instant (cached)


# ==================== Example 10: Monitoring Cache Performance ====================

async def example_cache_monitoring():
    """
    Monitor cache performance and health
    """
    import requests
    
    # Get cache statistics
    response = requests.get("http://localhost:8000/api/cache/stats")
    stats = response.json()
    
    print("Cache Statistics:")
    print(f"Overall hit rate: {stats['overall_metrics']['hit_rate_percent']}%")
    print(f"AI cache hit rate: {stats['cache_details']['ai_response_cache']['hit_rate_percent']}%")
    print(f"RAG cache hit rate: {stats['cache_details']['rag_query_cache']['hit_rate_percent']}%")
    
    # Check cache health
    response = requests.get("http://localhost:8000/api/cache/health")
    health = response.json()
    
    print(f"\nCache Health: {health['status']}")
    if health['warnings']:
        print("Warnings:")
        for warning in health['warnings']:
            print(f"  - {warning}")
    
    # Clear cache if needed
    if health['status'] == 'warning':
        requests.post("http://localhost:8000/api/cache/clear?cache_type=all")
        print("Cache cleared")


# ==================== Example 11: Precomputing Embeddings ====================

def example_precompute_embeddings():
    """
    Precompute and cache embeddings for large datasets
    """
    from caching.embedding_cache import precompute_embeddings
    from models import Note
    
    # Get all notes
    notes = db.query(Note).all()
    note_texts = [note.content for note in notes]
    
    print(f"Precomputing embeddings for {len(note_texts)} notes...")
    
    # Precompute and cache all embeddings
    precompute_embeddings(note_texts, embedding_model)
    
    print("✅ All embeddings precomputed and cached")
    print("Future RAG queries will be much faster!")


# ==================== Example 12: API Response Caching ====================

def example_api_caching():
    """
    Cache API responses with middleware
    """
    from fastapi import FastAPI
    from caching.api_cache_middleware import APICacheMiddleware
    
    app = FastAPI()
    
    # Add caching middleware
    app.add_middleware(
        APICacheMiddleware,
        default_ttl=60,
        cache_paths=[
            "/api/stats",
            "/api/leaderboard",
            "/api/analytics"
        ],
        exclude_paths=[
            "/api/auth",
            "/api/login",
            "/api/chat/send"
        ]
    )
    
    # Now all GET requests to cache_paths are automatically cached
    @app.get("/api/stats")
    async def get_stats():
        # Expensive calculation
        return {"stats": "..."}
    
    # First request - computes stats
    # Second request - returns cached response
    # Response includes X-Cache header: HIT or MISS


# ==================== Run Examples ====================

if __name__ == "__main__":
    print("Caching System Examples")
    print("=" * 50)
    
    # Run synchronous examples
    print("\n1. AI Response Caching")
    example_ai_caching()
    
    print("\n2. Database Query Caching")
    example_db_caching()
    
    print("\n4. Embedding Caching")
    example_embedding_caching()
    
    print("\n5. Batch Caching")
    example_batch_caching()
    
    print("\n8. Custom Caching")
    example_custom_caching()
    
    # Run async examples
    print("\n3. RAG Query Caching")
    asyncio.run(example_rag_caching())
    
    print("\n10. Cache Monitoring")
    asyncio.run(example_cache_monitoring())
