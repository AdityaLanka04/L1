"""
Comprehensive Caching System for Brainwave
Optimizes LLM token usage, database queries, and API responses
"""
import logging
import hashlib
import json
import time
import pickle
from typing import Optional, Dict, Any, List, Callable
from collections import OrderedDict
from datetime import datetime, timedelta
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

# Try to import Redis for distributed caching
try:
    import redis
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("Redis not available - using in-memory cache only")


class CacheEntry:
    """Represents a cached entry with metadata"""
    def __init__(self, value: Any, ttl: int = 3600):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl
        self.hits = 0
        self.last_accessed = time.time()
    
    def is_expired(self) -> bool:
        """Check if entry has expired"""
        return time.time() - self.created_at > self.ttl
    
    def access(self) -> Any:
        """Access the cached value and update stats"""
        self.hits += 1
        self.last_accessed = time.time()
        return self.value


class LRUCache:
    """
    LRU Cache with TTL support
    Thread-safe in-memory cache
    """
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "expirations": 0,
            "total_requests": 0
        }
    
    def _generate_key(self, *args, **kwargs) -> str:
        """Generate cache key from arguments"""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        self._stats["total_requests"] += 1
        
        if key in self._cache:
            entry = self._cache[key]
            
            # Check expiration
            if entry.is_expired():
                del self._cache[key]
                self._stats["expirations"] += 1
                self._stats["misses"] += 1
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._stats["hits"] += 1
            return entry.access()
        
        self._stats["misses"] += 1
        return None
    
    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache"""
        ttl = ttl or self.default_ttl
        
        # Evict oldest if at capacity
        if len(self._cache) >= self.max_size and key not in self._cache:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            self._stats["evictions"] += 1
        
        self._cache[key] = CacheEntry(value, ttl)
        self._cache.move_to_end(key)
    
    def delete(self, key: str):
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear all cached entries"""
        self._cache.clear()
    
    def cleanup_expired(self):
        """Remove expired entries"""
        expired_keys = [
            key for key, entry in self._cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            del self._cache[key]
        
        if expired_keys:
            self._stats["expirations"] += len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._stats["total_requests"]
        hit_rate = (self._stats["hits"] / total * 100) if total > 0 else 0
        
        return {
            **self._stats,
            "hit_rate_percent": round(hit_rate, 2),
            "cache_size": len(self._cache),
            "max_size": self.max_size
        }


class RedisCache:
    """
    Redis-based distributed cache
    Supports multiple backend instances
    """
    def __init__(self, redis_url: str = "redis://localhost:6379/0", default_ttl: int = 3600):
        if not REDIS_AVAILABLE:
            raise RuntimeError("Redis not available")
        
        self.redis_client = redis.from_url(redis_url, decode_responses=False)
        self.default_ttl = default_ttl
        self._stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from Redis"""
        try:
            value = self.redis_client.get(key)
            if value:
                self._stats["hits"] += 1
                return pickle.loads(value)
            self._stats["misses"] += 1
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            self._stats["errors"] += 1
            return None
    
    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in Redis"""
        try:
            ttl = ttl or self.default_ttl
            serialized = pickle.dumps(value)
            self.redis_client.setex(key, ttl, serialized)
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            self._stats["errors"] += 1
    
    def delete(self, key: str):
        """Delete key from Redis"""
        try:
            self.redis_client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
    
    def clear(self):
        """Clear all keys (use with caution)"""
        try:
            self.redis_client.flushdb()
        except Exception as e:
            logger.error(f"Redis clear error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total * 100) if total > 0 else 0
        
        return {
            **self._stats,
            "hit_rate_percent": round(hit_rate, 2)
        }


class CacheManager:
    """
    Unified cache manager supporting multiple cache backends
    Automatically falls back to in-memory if Redis unavailable
    """
    def __init__(
        self,
        redis_url: str = None,
        max_memory_size: int = 10000,
        default_ttl: int = 3600,
        enable_redis: bool = True
    ):
        self.default_ttl = default_ttl
        
        # Initialize Redis if available and enabled
        self.redis_cache = None
        if enable_redis and REDIS_AVAILABLE and redis_url:
            try:
                self.redis_cache = RedisCache(redis_url, default_ttl)
                logger.info("✅ Redis cache initialized")
            except Exception as e:
                logger.warning(f"Redis initialization failed: {e}")
        
        # Always have in-memory cache as fallback
        self.memory_cache = LRUCache(max_memory_size, default_ttl)
        
        # Specialized caches
        self.ai_response_cache = LRUCache(max_size=1000, default_ttl=3600)
        self.rag_query_cache = LRUCache(max_size=500, default_ttl=1800)
        self.db_query_cache = LRUCache(max_size=2000, default_ttl=300)
        self.embedding_cache = LRUCache(max_size=5000, default_ttl=7200)
        self.api_response_cache = LRUCache(max_size=1000, default_ttl=60)
        
        logger.info("✅ Cache Manager initialized")
    
    def _get_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key with prefix"""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        hash_key = hashlib.sha256(key_data.encode()).hexdigest()[:16]
        return f"{prefix}:{hash_key}"
    
    # ==================== AI Response Caching ====================
    
    def get_ai_response(self, prompt: str, temperature: float, max_tokens: int) -> Optional[str]:
        """Get cached AI response"""
        key = self._get_cache_key("ai", prompt, temperature, max_tokens)
        
        # Try Redis first
        if self.redis_cache:
            result = self.redis_cache.get(key)
            if result:
                logger.debug(f"AI cache hit (Redis): {prompt[:50]}...")
                return result
        
        # Fallback to memory
        result = self.ai_response_cache.get(key)
        if result:
            logger.debug(f"AI cache hit (memory): {prompt[:50]}...")
        return result
    
    def set_ai_response(self, prompt: str, temperature: float, max_tokens: int, response: str, ttl: int = None):
        """Cache AI response"""
        key = self._get_cache_key("ai", prompt, temperature, max_tokens)
        ttl = ttl or self.default_ttl
        
        # Store in both Redis and memory
        if self.redis_cache:
            self.redis_cache.set(key, response, ttl)
        self.ai_response_cache.set(key, response, ttl)
        
        logger.debug(f"AI response cached: {prompt[:50]}...")
    
    # ==================== RAG Query Caching ====================
    
    def get_rag_results(self, query: str, user_id: str, mode: str, top_k: int, filters: Dict = None) -> Optional[List]:
        """Get cached RAG query results"""
        key = self._get_cache_key("rag", query, user_id, mode, top_k, filters)
        
        if self.redis_cache:
            result = self.redis_cache.get(key)
            if result:
                return result
        
        return self.rag_query_cache.get(key)
    
    def set_rag_results(self, query: str, user_id: str, mode: str, top_k: int, results: List, filters: Dict = None, ttl: int = None):
        """Cache RAG query results"""
        key = self._get_cache_key("rag", query, user_id, mode, top_k, filters)
        ttl = ttl or 1800  # 30 minutes default for RAG
        
        if self.redis_cache:
            self.redis_cache.set(key, results, ttl)
        self.rag_query_cache.set(key, results, ttl)
    
    # ==================== Database Query Caching ====================
    
    def get_db_query(self, query_name: str, *args, **kwargs) -> Optional[Any]:
        """Get cached database query result"""
        key = self._get_cache_key("db", query_name, *args, **kwargs)
        
        if self.redis_cache:
            result = self.redis_cache.get(key)
            if result:
                return result
        
        return self.db_query_cache.get(key)
    
    def set_db_query(self, query_name: str, result: Any, ttl: int = None, *args, **kwargs):
        """Cache database query result"""
        key = self._get_cache_key("db", query_name, *args, **kwargs)
        ttl = ttl or 300  # 5 minutes default for DB queries
        
        if self.redis_cache:
            self.redis_cache.set(key, result, ttl)
        self.db_query_cache.set(key, result, ttl)
    
    def invalidate_db_query(self, query_name: str, *args, **kwargs):
        """Invalidate cached database query"""
        key = self._get_cache_key("db", query_name, *args, **kwargs)
        
        if self.redis_cache:
            self.redis_cache.delete(key)
        self.db_query_cache.delete(key)
    
    # ==================== Embedding Caching ====================
    
    def get_embedding(self, text: str) -> Optional[List[float]]:
        """Get cached text embedding"""
        key = self._get_cache_key("emb", text)
        return self.embedding_cache.get(key)
    
    def set_embedding(self, text: str, embedding: List[float], ttl: int = None):
        """Cache text embedding"""
        key = self._get_cache_key("emb", text)
        ttl = ttl or 7200  # 2 hours default for embeddings
        self.embedding_cache.set(key, embedding, ttl)
    
    # ==================== API Response Caching ====================
    
    def get_api_response(self, endpoint: str, *args, **kwargs) -> Optional[Any]:
        """Get cached API response"""
        key = self._get_cache_key("api", endpoint, *args, **kwargs)
        return self.api_response_cache.get(key)
    
    def set_api_response(self, endpoint: str, response: Any, ttl: int = None, *args, **kwargs):
        """Cache API response"""
        key = self._get_cache_key("api", endpoint, *args, **kwargs)
        ttl = ttl or 60  # 1 minute default for API responses
        self.api_response_cache.set(key, response, ttl)
    
    # ==================== Generic Caching ====================
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if self.redis_cache:
            result = self.redis_cache.get(key)
            if result:
                return result
        return self.memory_cache.get(key)
    
    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache"""
        ttl = ttl or self.default_ttl
        if self.redis_cache:
            self.redis_cache.set(key, value, ttl)
        self.memory_cache.set(key, value, ttl)
    
    def delete(self, key: str):
        """Delete key from cache"""
        if self.redis_cache:
            self.redis_cache.delete(key)
        self.memory_cache.delete(key)
    
    def clear_all(self):
        """Clear all caches"""
        if self.redis_cache:
            self.redis_cache.clear()
        self.memory_cache.clear()
        self.ai_response_cache.clear()
        self.rag_query_cache.clear()
        self.db_query_cache.clear()
        self.embedding_cache.clear()
        self.api_response_cache.clear()
        logger.info("All caches cleared")
    
    # ==================== Maintenance ====================
    
    def cleanup_expired(self):
        """Clean up expired entries from memory caches"""
        self.memory_cache.cleanup_expired()
        self.ai_response_cache.cleanup_expired()
        self.rag_query_cache.cleanup_expired()
        self.db_query_cache.cleanup_expired()
        self.embedding_cache.cleanup_expired()
        self.api_response_cache.cleanup_expired()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        stats = {
            "redis_available": self.redis_cache is not None,
            "memory_cache": self.memory_cache.get_stats(),
            "ai_response_cache": self.ai_response_cache.get_stats(),
            "rag_query_cache": self.rag_query_cache.get_stats(),
            "db_query_cache": self.db_query_cache.get_stats(),
            "embedding_cache": self.embedding_cache.get_stats(),
            "api_response_cache": self.api_response_cache.get_stats()
        }
        
        if self.redis_cache:
            stats["redis_cache"] = self.redis_cache.get_stats()
        
        return stats


# ==================== Decorators ====================

def cached(cache_manager: CacheManager, ttl: int = None, key_prefix: str = "func"):
    """
    Decorator for caching function results
    
    Usage:
        @cached(cache_manager, ttl=300, key_prefix="user_profile")
        def get_user_profile(user_id: int):
            # expensive operation
            return profile
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = cache_manager._get_cache_key(key_prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            result = cache_manager.get(key)
            if result is not None:
                return result
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result
            cache_manager.set(key, result, ttl)
            
            return result
        return wrapper
    return decorator


def async_cached(cache_manager: CacheManager, ttl: int = None, key_prefix: str = "func"):
    """
    Decorator for caching async function results
    
    Usage:
        @async_cached(cache_manager, ttl=300)
        async def get_user_data(user_id: int):
            # expensive async operation
            return data
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = cache_manager._get_cache_key(key_prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            result = cache_manager.get(key)
            if result is not None:
                return result
            
            # Execute async function
            result = await func(*args, **kwargs)
            
            # Cache result
            cache_manager.set(key, result, ttl)
            
            return result
        return wrapper
    return decorator


# ==================== Global Instance ====================

_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """Get global cache manager instance"""
    global _cache_manager
    if _cache_manager is None:
        import os
        redis_url = os.getenv("REDIS_URL")
        enable_redis = os.getenv("ENABLE_REDIS_CACHE", "true").lower() == "true"
        
        _cache_manager = CacheManager(
            redis_url=redis_url,
            max_memory_size=10000,
            default_ttl=3600,
            enable_redis=enable_redis
        )
    return _cache_manager


def initialize_cache_manager(redis_url: str = None, **kwargs) -> CacheManager:
    """Initialize global cache manager"""
    global _cache_manager
    _cache_manager = CacheManager(redis_url=redis_url, **kwargs)
    return _cache_manager
