"""
Embedding Model Wrapper Utility
Automatically wraps embedding models with caching
"""
import logging

logger = logging.getLogger(__name__)

def wrap_all_embedding_models():
    """
    Wrap all embedding models in the application with caching
    Call this during startup
    """
    try:
        from caching.embedding_cache import wrap_embedding_model
        
        # Wrap RAG embedding models
        try:
            from agents.rag.user_rag_manager import get_user_rag_manager
            user_rag = get_user_rag_manager()
            
            if user_rag and user_rag.embedding_model:
                user_rag.embedding_model = wrap_embedding_model(user_rag.embedding_model)
                logger.info("✅ Wrapped RAG embedding model with cache")
        except Exception as e:
            logger.warning(f"Could not wrap RAG embedding model: {e}")
        
        # Wrap any other embedding models in the system
        # Add more wrapping here as needed
        
        logger.info("✅ Embedding model caching enabled")
        
    except Exception as e:
        logger.warning(f"Embedding model wrapping failed (non-critical): {e}")


def wrap_embedding_model_if_available(model):
    """
    Wrap an embedding model with caching if available
    
    Args:
        model: The embedding model to wrap
    
    Returns:
        Wrapped model or original model if wrapping fails
    """
    try:
        from caching.embedding_cache import wrap_embedding_model
        return wrap_embedding_model(model)
    except Exception as e:
        logger.warning(f"Could not wrap embedding model: {e}")
        return model
