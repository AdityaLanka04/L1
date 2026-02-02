"""
Cached RAG System
Wraps RAG queries with intelligent caching
"""
import logging
from typing import Dict, Any, List, Optional

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


class CachedRAGWrapper:
    """
    Wrapper for RAG system that adds caching
    Reduces vector search overhead and embedding computations
    """
    
    def __init__(self, rag_system):
        self.rag_system = rag_system
        self.cache_manager = get_cache_manager() if CACHE_AVAILABLE else None
        
        if self.cache_manager:
            logger.info("✅ RAG system using cache manager")
    
    async def retrieve(
        self,
        query: str,
        user_id: str = None,
        mode: str = "agentic",
        top_k: int = 10,
        context: Dict[str, Any] = None,
        enhance_query: bool = True,
        compress_results: bool = True,
        max_context_length: int = 2000
    ) -> Dict[str, Any]:
        """
        Retrieve with caching
        """
        # Check cache first
        if self.cache_manager:
            cached_results = self.cache_manager.get_rag_results(
                query=query,
                user_id=user_id or "default",
                mode=mode,
                top_k=top_k,
                filters=context
            )
            
            if cached_results:
                logger.info(f"✅ RAG cache hit for query: {query[:50]}...")
                return cached_results
        
        # Execute RAG query
        results = await self.rag_system.retrieve(
            query=query,
            user_id=user_id,
            mode=mode,
            top_k=top_k,
            context=context,
            enhance_query=enhance_query,
            compress_results=compress_results,
            max_context_length=max_context_length
        )
        
        # Cache results
        if self.cache_manager:
            self.cache_manager.set_rag_results(
                query=query,
                user_id=user_id or "default",
                mode=mode,
                top_k=top_k,
                results=results,
                filters=context,
                ttl=1800  # 30 minutes
            )
        
        return results
    
    async def get_context_for_query(
        self,
        query: str,
        user_id: str = None,
        max_context_length: int = 2000,
        enhance: bool = True
    ) -> str:
        """
        Get context string with caching
        """
        # Check cache
        if self.cache_manager:
            cache_key = f"rag_context:{user_id}:{query}:{max_context_length}"
            cached_context = self.cache_manager.get(cache_key)
            if cached_context:
                logger.info(f"✅ RAG context cache hit")
                return cached_context
        
        # Get context
        context = await self.rag_system.get_context_for_query(
            query=query,
            user_id=user_id,
            max_context_length=max_context_length,
            enhance=enhance
        )
        
        # Cache context
        if self.cache_manager:
            cache_key = f"rag_context:{user_id}:{query}:{max_context_length}"
            self.cache_manager.set(cache_key, context, ttl=1800)
        
        return context
    
    def index_content(self, content_type: str, items: List[Dict[str, Any]], use_parent_child: bool = False):
        """
        Index content and invalidate related caches
        """
        self.rag_system.index_content(content_type, items, use_parent_child)
        
        # Invalidate caches for this content type
        if self.cache_manager:
            # Clear RAG query cache since new content was added
            self.cache_manager.rag_query_cache.clear()
            logger.info(f"Invalidated RAG cache after indexing {content_type}")
    
    def clear_cache(self):
        """Clear RAG-related caches"""
        if self.cache_manager:
            self.cache_manager.rag_query_cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get RAG and cache statistics"""
        stats = self.rag_system.get_stats() if hasattr(self.rag_system, 'get_stats') else {}
        
        if self.cache_manager:
            stats['cache_stats'] = self.cache_manager.rag_query_cache.get_stats()
        
        return stats


def wrap_rag_with_cache(rag_system):
    """
    Wrap a RAG system with caching
    
    Usage:
        rag_system = AdvancedRAGSystem(...)
        cached_rag = wrap_rag_with_cache(rag_system)
    """
    return CachedRAGWrapper(rag_system)
