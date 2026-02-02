"""
Embedding Cache
Caches text embeddings to avoid recomputation
"""
import logging
from typing import List, Union
import hashlib

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


class CachedEmbeddingModel:
    """
    Wrapper for embedding models that adds caching
    Significantly reduces embedding computation overhead
    """
    
    def __init__(self, embedding_model):
        self.embedding_model = embedding_model
        self.cache_manager = get_cache_manager() if CACHE_AVAILABLE else None
        
        if self.cache_manager:
            logger.info("✅ Embedding model using cache manager")
    
    def encode(self, texts: Union[str, List[str]], **kwargs) -> Union[List[float], List[List[float]]]:
        """
        Encode text(s) to embeddings with caching
        
        Args:
            texts: Single text or list of texts
            **kwargs: Additional arguments for embedding model
        
        Returns:
            Embedding(s)
        """
        # Handle single text
        if isinstance(texts, str):
            return self._encode_single(texts, **kwargs)
        
        # Handle list of texts
        return self._encode_batch(texts, **kwargs)
    
    def _encode_single(self, text: str, **kwargs) -> List[float]:
        """Encode single text with caching"""
        # Check cache
        if self.cache_manager:
            cached_embedding = self.cache_manager.get_embedding(text)
            if cached_embedding is not None:
                logger.debug(f"Embedding cache hit: {text[:50]}...")
                return cached_embedding
        
        # Compute embedding
        embedding = self.embedding_model.encode(text, **kwargs)
        
        # Convert to list if numpy array
        if hasattr(embedding, 'tolist'):
            embedding = embedding.tolist()
        
        # Cache embedding
        if self.cache_manager:
            self.cache_manager.set_embedding(text, embedding)
        
        return embedding
    
    def _encode_batch(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Encode batch of texts with caching"""
        embeddings = []
        texts_to_compute = []
        text_indices = []
        
        # Check cache for each text
        for i, text in enumerate(texts):
            if self.cache_manager:
                cached_embedding = self.cache_manager.get_embedding(text)
                if cached_embedding is not None:
                    embeddings.append(cached_embedding)
                    continue
            
            # Need to compute this embedding
            texts_to_compute.append(text)
            text_indices.append(i)
            embeddings.append(None)  # Placeholder
        
        # Compute missing embeddings in batch
        if texts_to_compute:
            logger.debug(f"Computing {len(texts_to_compute)}/{len(texts)} embeddings (rest cached)")
            computed_embeddings = self.embedding_model.encode(texts_to_compute, **kwargs)
            
            # Convert to list if numpy array
            if hasattr(computed_embeddings, 'tolist'):
                computed_embeddings = computed_embeddings.tolist()
            
            # Cache and insert computed embeddings
            for i, (text, embedding) in enumerate(zip(texts_to_compute, computed_embeddings)):
                if self.cache_manager:
                    self.cache_manager.set_embedding(text, embedding)
                
                # Insert at correct position
                embeddings[text_indices[i]] = embedding
        else:
            logger.debug(f"All {len(texts)} embeddings from cache!")
        
        return embeddings
    
    def __getattr__(self, name):
        """Forward other attributes to underlying model"""
        return getattr(self.embedding_model, name)


def wrap_embedding_model(embedding_model):
    """
    Wrap an embedding model with caching
    
    Usage:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        cached_model = wrap_embedding_model(model)
        
        # Use as normal
        embeddings = cached_model.encode(["text1", "text2"])
    """
    return CachedEmbeddingModel(embedding_model)


# ==================== Batch Embedding Cache ====================

def cache_embeddings_batch(texts: List[str], embeddings: List[List[float]]):
    """
    Cache a batch of embeddings at once
    Useful for pre-computing and caching embeddings
    
    Usage:
        texts = ["text1", "text2", "text3"]
        embeddings = model.encode(texts)
        cache_embeddings_batch(texts, embeddings)
    """
    if not CACHE_AVAILABLE:
        return
    
    cache_manager = get_cache_manager()
    
    for text, embedding in zip(texts, embeddings):
        cache_manager.set_embedding(text, embedding)
    
    logger.info(f"Cached {len(texts)} embeddings")


def precompute_embeddings(texts: List[str], embedding_model):
    """
    Precompute and cache embeddings for a list of texts
    
    Usage:
        # Precompute embeddings for all notes
        note_texts = [note.content for note in notes]
        precompute_embeddings(note_texts, embedding_model)
    """
    if not CACHE_AVAILABLE:
        return
    
    logger.info(f"Precomputing embeddings for {len(texts)} texts...")
    
    # Use cached model to compute
    cached_model = wrap_embedding_model(embedding_model)
    cached_model.encode(texts)
    
    logger.info(f"✅ Precomputed and cached {len(texts)} embeddings")


# ==================== Cache Statistics ====================

def get_embedding_cache_stats():
    """Get embedding cache statistics"""
    if not CACHE_AVAILABLE:
        return {"cache_available": False}
    
    cache_manager = get_cache_manager()
    return cache_manager.embedding_cache.get_stats()
