#!/usr/bin/env python3
"""
Test script to verify cache system imports
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("Testing cache system imports...")
print("=" * 50)

# Test 1: Import cache manager
try:
    from caching.cache_manager import CacheManager, get_cache_manager, initialize_cache_manager
    print("✅ Cache manager imports work")
except Exception as e:
    print(f"❌ Cache manager import failed: {e}")
    sys.exit(1)

# Test 2: Import cache stats API
try:
    from caching.cache_stats_api import register_cache_stats_api
    print("✅ Cache stats API imports work")
except Exception as e:
    print(f"❌ Cache stats API import failed: {e}")
    sys.exit(1)

# Test 3: Import db cache
try:
    from caching.db_cache import cached_query, invalidate_user_cache
    print("✅ DB cache imports work")
except Exception as e:
    print(f"❌ DB cache import failed: {e}")
    sys.exit(1)

# Test 4: Import embedding cache
try:
    from caching.embedding_cache import wrap_embedding_model
    print("✅ Embedding cache imports work")
except Exception as e:
    print(f"❌ Embedding cache import failed: {e}")
    sys.exit(1)

# Test 5: Import cached RAG
try:
    from caching.cached_rag import CachedRAGWrapper
    print("✅ Cached RAG imports work")
except Exception as e:
    print(f"❌ Cached RAG import failed: {e}")
    sys.exit(1)

# Test 6: Initialize cache manager
try:
    cache_manager = initialize_cache_manager(
        redis_url=None,
        max_memory_size=1000,
        default_ttl=300,
        enable_redis=False
    )
    print("✅ Cache manager initialization works")
except Exception as e:
    print(f"❌ Cache manager initialization failed: {e}")
    sys.exit(1)

# Test 7: Test cache operations
try:
    cache_manager.set("test_key", "test_value", ttl=60)
    value = cache_manager.get("test_key")
    assert value == "test_value", "Cache get/set failed"
    print("✅ Cache operations work")
except Exception as e:
    print(f"❌ Cache operations failed: {e}")
    sys.exit(1)

# Test 8: Get cache stats
try:
    stats = cache_manager.get_stats()
    assert "cache_available" in stats or "memory_cache" in stats
    print("✅ Cache statistics work")
except Exception as e:
    print(f"❌ Cache statistics failed: {e}")
    sys.exit(1)

print("=" * 50)
print("✅ All cache system tests passed!")
print("")
print("The caching system is ready to use.")
print("Restart your backend server to enable caching.")
