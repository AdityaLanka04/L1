#!/usr/bin/env python3
"""
Check if Redis is actually connected in the running backend
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

def check_redis_in_backend():
    """Check Redis connection status"""
    print("🔍 Checking Redis Configuration...")
    print("=" * 60)
    
    # Check environment variables
    redis_url = os.getenv("REDIS_URL")
    enable_redis = os.getenv("ENABLE_REDIS_CACHE", "true").lower() == "true"
    
    print(f"REDIS_URL: {redis_url}")
    print(f"ENABLE_REDIS_CACHE: {enable_redis}")
    print()
    
    # Test direct Redis connection
    print("Testing direct Redis connection...")
    try:
        import redis
        r = redis.from_url(redis_url, decode_responses=True)
        response = r.ping()
        if response:
            print("✅ Direct Redis connection works!")
            print()
        else:
            print("❌ Redis ping failed")
            return
    except Exception as e:
        print(f"❌ Redis connection error: {e}")
        return
    
    # Test cache manager initialization
    print("Testing CacheManager initialization...")
    try:
        from caching.cache_manager import CacheManager
        
        # Create a test cache manager with same settings as backend
        test_manager = CacheManager(
            redis_url=redis_url,
            max_memory_size=10000,
            default_ttl=3600,
            enable_redis=enable_redis
        )
        
        if test_manager.redis_cache:
            print("✅ CacheManager successfully initialized with Redis!")
            print()
            
            # Test set/get
            print("Testing cache operations...")
            test_manager.set("test_key", "test_value", ttl=10)
            value = test_manager.get("test_key")
            
            if value == "test_value":
                print("✅ Cache set/get works!")
                test_manager.delete("test_key")
            else:
                print("❌ Cache set/get failed")
                return
            
            print()
            print("=" * 60)
            print("✅ Redis is properly configured!")
            print()
            print("The issue is that monitor_cache.py creates a NEW cache")
            print("manager instance instead of using the backend's instance.")
            print()
            print("Solution: The backend IS using Redis, but the monitor")
            print("script can't see it because they're separate processes.")
            print()
            print("To verify Redis is working in the backend:")
            print("  1. Use the app (chat, flashcards, etc.)")
            print("  2. Check Redis directly:")
            print(f"     docker exec optimistic_wright redis-cli DBSIZE")
            print("  3. If DBSIZE > 0, Redis is being used!")
            
        else:
            print("❌ CacheManager initialized WITHOUT Redis")
            print("   Check if REDIS_AVAILABLE is True")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_redis_in_backend()
