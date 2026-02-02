#!/usr/bin/env python3
"""
Test Redis Connection
Quick script to verify Redis is accessible
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_redis():
    """Test Redis connection"""
    print("🔍 Testing Redis Connection...")
    print("=" * 60)
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    print(f"Redis URL: {redis_url}")
    print()
    
    try:
        import redis
        print("✅ Redis package installed")
    except ImportError:
        print("❌ Redis package not installed")
        print("   Install with: pip install redis")
        return False
    
    try:
        # Parse Redis URL
        r = redis.from_url(redis_url, decode_responses=True)
        
        # Test connection
        print("Testing connection...")
        response = r.ping()
        
        if response:
            print("✅ Redis connection successful!")
            print()
            
            # Get Redis info
            info = r.info()
            print("Redis Server Info:")
            print(f"  Version: {info.get('redis_version', 'unknown')}")
            print(f"  Mode: {info.get('redis_mode', 'unknown')}")
            print(f"  Connected clients: {info.get('connected_clients', 0)}")
            print(f"  Used memory: {info.get('used_memory_human', 'unknown')}")
            print()
            
            # Test set/get
            print("Testing set/get operations...")
            r.set("test_key", "test_value", ex=10)
            value = r.get("test_key")
            
            if value == "test_value":
                print("✅ Set/Get operations work!")
                r.delete("test_key")
            else:
                print("❌ Set/Get operations failed")
                return False
            
            print()
            print("=" * 60)
            print("✅ Redis is ready to use!")
            print()
            print("Next steps:")
            print("  1. Restart your backend server")
            print("  2. Run: python monitor_cache.py")
            print("  3. Redis status should show '✅ Connected'")
            
            return True
        else:
            print("❌ Redis ping failed")
            return False
            
    except redis.ConnectionError as e:
        print(f"❌ Connection error: {e}")
        print()
        print("Troubleshooting:")
        print("  1. Check if Redis is running: docker ps | grep redis")
        print("  2. Check Redis URL in .env file")
        print("  3. Try: docker exec <container> redis-cli ping")
        return False
    
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    test_redis()
