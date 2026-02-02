"""
Semantic Caching for AI Responses
Caches based on semantic similarity, not exact string matching
"""
import logging
import hashlib
from typing import Optional, List, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class SemanticCache:
    """
    Semantic cache that matches similar queries
    Uses embeddings to find semantically similar cached responses
    """
    
    def __init__(self, similarity_threshold: float = 0.95, max_size: int = 1000):
        """
        Args:
            similarity_threshold: Minimum cosine similarity to consider a cache hit (0.95 = 95% similar)
            max_size: Maximum number of cached items
        """
        self.similarity_threshold = similarity_threshold
        self.max_size = max_size
        
        # Storage: {cache_key: (embedding, response, metadata)}
        self.cache = {}
        
        # Load embedding model (lightweight, fast)
        try:
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✅ Semantic cache initialized with embedding model")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.embedding_model = None
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for better matching"""
        # Remove extra whitespace, lowercase
        normalized = ' '.join(query.lower().strip().split())
        return normalized
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for text"""
        if not self.embedding_model:
            return None
        
        try:
            embedding = self.embedding_model.encode(text, convert_to_numpy=True)
            return embedding
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return None
    
    def _cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        dot_product = np.dot(emb1, emb2)
        norm1 = np.linalg.norm(emb1)
        norm2 = np.linalg.norm(emb2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def get(self, query: str, temperature: float, max_tokens: int) -> Optional[str]:
        """
        Get cached response for semantically similar query
        
        Returns:
            Cached response if similar query found, None otherwise
        """
        if not self.embedding_model:
            return None
        
        # Normalize query
        normalized_query = self._normalize_query(query)
        
        # Get embedding
        query_embedding = self._get_embedding(normalized_query)
        if query_embedding is None:
            return None
        
        # Find most similar cached query
        best_match = None
        best_similarity = 0.0
        
        for cache_key, (cached_embedding, cached_response, metadata) in self.cache.items():
            # Check if temperature and max_tokens match
            if metadata['temperature'] != temperature or metadata['max_tokens'] != max_tokens:
                continue
            
            # Calculate similarity
            similarity = self._cosine_similarity(query_embedding, cached_embedding)
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = cached_response
        
        # Return if similarity exceeds threshold
        if best_similarity >= self.similarity_threshold:
            logger.info(f"✅ Semantic cache HIT (similarity: {best_similarity:.2%})")
            logger.debug(f"   Query: {normalized_query[:50]}...")
            return best_match
        
        logger.debug(f"Semantic cache MISS (best similarity: {best_similarity:.2%})")
        return None
    
    def set(self, query: str, temperature: float, max_tokens: int, response: str):
        """
        Cache response with semantic indexing
        """
        if not self.embedding_model:
            return
        
        # Normalize query
        normalized_query = self._normalize_query(query)
        
        # Get embedding
        query_embedding = self._get_embedding(normalized_query)
        if query_embedding is None:
            return
        
        # Generate cache key
        cache_key = hashlib.sha256(
            f"{normalized_query}:{temperature}:{max_tokens}".encode()
        ).hexdigest()[:16]
        
        # Store in cache
        metadata = {
            'temperature': temperature,
            'max_tokens': max_tokens,
            'query': normalized_query
        }
        
        self.cache[cache_key] = (query_embedding, response, metadata)
        
        # Evict oldest if over max size
        if len(self.cache) > self.max_size:
            # Remove first item (oldest)
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        
        logger.debug(f"Semantic cache SET: {normalized_query[:50]}...")
    
    def clear(self):
        """Clear all cached items"""
        self.cache.clear()
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        return {
            "cache_size": len(self.cache),
            "max_size": self.max_size,
            "similarity_threshold": self.similarity_threshold,
            "model_loaded": self.embedding_model is not None
        }


# Global semantic cache instance
_semantic_cache: Optional[SemanticCache] = None


def get_semantic_cache() -> SemanticCache:
    """Get global semantic cache instance"""
    global _semantic_cache
    if _semantic_cache is None:
        _semantic_cache = SemanticCache(
            similarity_threshold=0.95,  # 95% similar = cache hit
            max_size=1000
        )
    return _semantic_cache
