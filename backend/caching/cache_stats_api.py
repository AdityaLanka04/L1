"""
Cache Statistics API
Provides endpoints for monitoring cache performance
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any

logger = logging.getLogger(__name__)

try:
    from .cache_manager import get_cache_manager
    CACHE_AVAILABLE = True
except ImportError:
    try:
        from caching.cache_manager import get_cache_manager
        CACHE_AVAILABLE = True
    except ImportError:
        CACHE_AVAILABLE = False


def register_cache_stats_api(app):
    """Register cache statistics endpoints"""
    
    @app.get("/api/cache/stats")
    async def get_cache_stats() -> Dict[str, Any]:
        """
        Get comprehensive cache statistics
        Shows hit rates, sizes, and performance metrics
        """
        if not CACHE_AVAILABLE:
            return {
                "cache_available": False,
                "message": "Cache system not initialized"
            }
        
        cache_manager = get_cache_manager()
        stats = cache_manager.get_stats()
        
        # Calculate overall metrics
        total_hits = sum(
            cache_stats.get("hits", 0)
            for cache_stats in stats.values()
            if isinstance(cache_stats, dict)
        )
        total_misses = sum(
            cache_stats.get("misses", 0)
            for cache_stats in stats.values()
            if isinstance(cache_stats, dict)
        )
        total_requests = total_hits + total_misses
        overall_hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "cache_available": True,
            "overall_metrics": {
                "total_hits": total_hits,
                "total_misses": total_misses,
                "total_requests": total_requests,
                "hit_rate_percent": round(overall_hit_rate, 2)
            },
            "cache_details": stats,
            "recommendations": _generate_recommendations(stats)
        }
    
    @app.post("/api/cache/clear")
    async def clear_cache(cache_type: str = "all") -> Dict[str, str]:
        """
        Clear cache
        
        Args:
            cache_type: Type of cache to clear (all, ai, rag, db, embedding, api)
        """
        if not CACHE_AVAILABLE:
            raise HTTPException(status_code=503, detail="Cache system not available")
        
        cache_manager = get_cache_manager()
        
        if cache_type == "all":
            cache_manager.clear_all()
            return {"message": "All caches cleared"}
        elif cache_type == "ai":
            cache_manager.ai_response_cache.clear()
            return {"message": "AI response cache cleared"}
        elif cache_type == "rag":
            cache_manager.rag_query_cache.clear()
            return {"message": "RAG query cache cleared"}
        elif cache_type == "db":
            cache_manager.db_query_cache.clear()
            return {"message": "Database query cache cleared"}
        elif cache_type == "embedding":
            cache_manager.embedding_cache.clear()
            return {"message": "Embedding cache cleared"}
        elif cache_type == "api":
            cache_manager.api_response_cache.clear()
            return {"message": "API response cache cleared"}
        else:
            raise HTTPException(status_code=400, detail=f"Unknown cache type: {cache_type}")
    
    @app.post("/api/cache/cleanup")
    async def cleanup_expired() -> Dict[str, str]:
        """Clean up expired cache entries"""
        if not CACHE_AVAILABLE:
            raise HTTPException(status_code=503, detail="Cache system not available")
        
        cache_manager = get_cache_manager()
        cache_manager.cleanup_expired()
        
        return {"message": "Expired cache entries cleaned up"}
    
    @app.get("/api/cache/health")
    async def cache_health() -> Dict[str, Any]:
        """
        Check cache system health
        Returns warnings if hit rates are low
        """
        if not CACHE_AVAILABLE:
            return {
                "status": "unavailable",
                "message": "Cache system not initialized"
            }
        
        cache_manager = get_cache_manager()
        stats = cache_manager.get_stats()
        
        # Check health metrics
        warnings = []
        
        # Check AI cache hit rate
        ai_stats = stats.get("ai_response_cache", {})
        ai_hit_rate = ai_stats.get("hit_rate_percent", 0)
        if ai_hit_rate < 30 and ai_stats.get("total_requests", 0) > 100:
            warnings.append(f"Low AI cache hit rate: {ai_hit_rate:.1f}%")
        
        # Check RAG cache hit rate
        rag_stats = stats.get("rag_query_cache", {})
        rag_hit_rate = rag_stats.get("hit_rate_percent", 0)
        if rag_hit_rate < 40 and rag_stats.get("total_requests", 0) > 50:
            warnings.append(f"Low RAG cache hit rate: {rag_hit_rate:.1f}%")
        
        # Check cache sizes
        for cache_name, cache_stats in stats.items():
            if isinstance(cache_stats, dict):
                size = cache_stats.get("cache_size", 0)
                max_size = cache_stats.get("max_size", 0)
                if max_size > 0 and size / max_size > 0.9:
                    warnings.append(f"{cache_name} is {size/max_size*100:.0f}% full")
        
        status = "healthy" if not warnings else "warning"
        
        return {
            "status": status,
            "redis_available": stats.get("redis_available", False),
            "warnings": warnings,
            "stats_summary": {
                "ai_hit_rate": ai_hit_rate,
                "rag_hit_rate": rag_hit_rate,
                "db_hit_rate": stats.get("db_query_cache", {}).get("hit_rate_percent", 0)
            }
        }


def _generate_recommendations(stats: Dict[str, Any]) -> list:
    """Generate recommendations based on cache statistics"""
    recommendations = []
    
    # Check AI cache
    ai_stats = stats.get("ai_response_cache", {})
    ai_hit_rate = ai_stats.get("hit_rate_percent", 0)
    if ai_hit_rate < 30 and ai_stats.get("total_requests", 0) > 100:
        recommendations.append({
            "type": "ai_cache",
            "message": "Low AI cache hit rate. Consider increasing TTL or cache size.",
            "current_hit_rate": ai_hit_rate
        })
    
    # Check RAG cache
    rag_stats = stats.get("rag_query_cache", {})
    rag_hit_rate = rag_stats.get("hit_rate_percent", 0)
    if rag_hit_rate < 40 and rag_stats.get("total_requests", 0) > 50:
        recommendations.append({
            "type": "rag_cache",
            "message": "Low RAG cache hit rate. Queries may be too diverse.",
            "current_hit_rate": rag_hit_rate
        })
    
    # Check evictions
    for cache_name, cache_stats in stats.items():
        if isinstance(cache_stats, dict):
            evictions = cache_stats.get("evictions", 0)
            total = cache_stats.get("total_requests", 0)
            if total > 0 and evictions / total > 0.2:
                recommendations.append({
                    "type": "evictions",
                    "cache": cache_name,
                    "message": f"High eviction rate in {cache_name}. Consider increasing cache size.",
                    "eviction_rate": evictions / total
                })
    
    # Check Redis
    if not stats.get("redis_available", False):
        recommendations.append({
            "type": "redis",
            "message": "Redis not available. Using in-memory cache only. Consider enabling Redis for distributed caching."
        })
    
    return recommendations
