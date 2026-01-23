"""
AI Response Caching System
Caches AI responses to reduce API calls and improve performance
"""
import logging
import json
import hashlib
import time
from typing import Optional, Dict, Any
from collections import OrderedDict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ResponseCache:
    """LRU cache for AI responses with TTL support"""
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "total_requests": 0
        }
    
    def _generate_key(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Generate cache key from prompt and parameters"""
        key_str = f"{prompt}:{temperature}:{max_tokens}"
        return hashlib.sha256(key_str.encode()).hexdigest()[:16]
    
    def get(self, prompt: str, temperature: float, max_tokens: int) -> Optional[str]:
        """Get cached response if available and not expired"""
        self._stats["total_requests"] += 1
        key = self._generate_key(prompt, temperature, max_tokens)
        
        if key in self._cache:
            entry = self._cache[key]
            
            # Check if expired
            if time.time() - entry["timestamp"] > self.ttl_seconds:
                del self._cache[key]
                self._stats["misses"] += 1
                logger.debug(f"Cache expired for key {key}")
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            self._stats["hits"] += 1
            logger.debug(f"Cache hit for key {key}")
            return entry["response"]
        
        self._stats["misses"] += 1
        return None
    
    def set(self, prompt: str, temperature: float, max_tokens: int, response: str):
        """Cache a response"""
        key = self._generate_key(prompt, temperature, max_tokens)
        
        # Evict oldest if at capacity
        if len(self._cache) >= self.max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            self._stats["evictions"] += 1
            logger.debug(f"Evicted oldest cache entry: {oldest_key}")
        
        self._cache[key] = {
            "response": response,
            "timestamp": time.time(),
            "prompt_length": len(prompt),
            "response_length": len(response)
        }
        
        logger.debug(f"Cached response for key {key}")
    
    def clear(self):
        """Clear all cached responses"""
        self._cache.clear()
        logger.info("Cache cleared")
    
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
    
    def cleanup_expired(self):
        """Remove expired entries"""
        now = time.time()
        expired_keys = [
            key for key, entry in self._cache.items()
            if now - entry["timestamp"] > self.ttl_seconds
        ]
        
        for key in expired_keys:
            del self._cache[key]
        
        if expired_keys:
            logger.info(f"Cleaned up {len(expired_keys)} expired cache entries")


class QueryCache:
    """Cache for RAG query results"""
    
    def __init__(self, max_size: int = 500, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
    
    def _generate_key(self, query: str, mode: str, top_k: int, filters: Dict = None) -> str:
        """Generate cache key for query"""
        filter_str = json.dumps(filters, sort_keys=True) if filters else ""
        key_str = f"{query}:{mode}:{top_k}:{filter_str}"
        return hashlib.sha256(key_str.encode()).hexdigest()[:16]
    
    def get(self, query: str, mode: str, top_k: int, filters: Dict = None) -> Optional[list]:
        """Get cached query results"""
        key = self._generate_key(query, mode, top_k, filters)
        
        if key in self._cache:
            entry = self._cache[key]
            
            # Check expiration
            if time.time() - entry["timestamp"] > self.ttl_seconds:
                del self._cache[key]
                return None
            
            self._cache.move_to_end(key)
            logger.debug(f"Query cache hit: {query[:50]}")
            return entry["results"]
        
        return None
    
    def set(self, query: str, mode: str, top_k: int, results: list, filters: Dict = None):
        """Cache query results"""
        key = self._generate_key(query, mode, top_k, filters)
        
        # Evict oldest if at capacity
        if len(self._cache) >= self.max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        
        self._cache[key] = {
            "results": results,
            "timestamp": time.time()
        }
        
        logger.debug(f"Cached query results: {query[:50]}")
    
    def clear(self):
        """Clear query cache"""
        self._cache.clear()


class AgentDecisionCache:
    """Cache for agent routing decisions"""
    
    def __init__(self, max_size: int = 100):
        self.max_size = max_size
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
    
    def _generate_key(self, query: str) -> str:
        """Generate key from query (normalized)"""
        normalized = query.lower().strip()
        return hashlib.sha256(normalized.encode()).hexdigest()[:12]
    
    def get_similar_decision(self, query: str, similarity_threshold: float = 0.8) -> Optional[Dict]:
        """Get cached decision for similar query"""
        key = self._generate_key(query)
        
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]["decision"]
        
        # Check for similar queries (simple word overlap)
        query_words = set(query.lower().split())
        
        for cached_key, entry in self._cache.items():
            cached_words = set(entry["query"].lower().split())
            overlap = len(query_words & cached_words) / max(len(query_words), 1)
            
            if overlap >= similarity_threshold:
                logger.debug(f"Found similar cached decision (overlap: {overlap:.2f})")
                return entry["decision"]
        
        return None
    
    def set(self, query: str, decision: Dict):
        """Cache a routing decision"""
        key = self._generate_key(query)
        
        if len(self._cache) >= self.max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        
        self._cache[key] = {
            "query": query,
            "decision": decision,
            "timestamp": time.time()
        }


# Global cache instances
_response_cache: Optional[ResponseCache] = None
_query_cache: Optional[QueryCache] = None
_decision_cache: Optional[AgentDecisionCache] = None


def get_response_cache() -> ResponseCache:
    """Get global response cache instance"""
    global _response_cache
    if _response_cache is None:
        import os
        ttl = int(os.getenv("CACHE_TTL_SECONDS", "3600"))
        _response_cache = ResponseCache(max_size=1000, ttl_seconds=ttl)
    return _response_cache


def get_query_cache() -> QueryCache:
    """Get global query cache instance"""
    global _query_cache
    if _query_cache is None:
        import os
        ttl = int(os.getenv("RAG_CACHE_TTL", "3600"))
        _query_cache = QueryCache(max_size=500, ttl_seconds=ttl)
    return _query_cache


def get_decision_cache() -> AgentDecisionCache:
    """Get global decision cache instance"""
    global _decision_cache
    if _decision_cache is None:
        import os
        size = int(os.getenv("AGENT_DECISION_CACHE_SIZE", "100"))
        _decision_cache = AgentDecisionCache(max_size=size)
    return _decision_cache
