"""
RAG Helper Module
Provides easy-to-use functions for the enhanced RAG system.
"""

import logging
from typing import Dict, Any, List, Optional
from .advanced_rag import (
    AdvancedRAGSystem,
    SearchMode,
    QueryType
)

logger = logging.getLogger(__name__)


# Global RAG system instance
_rag_system: Optional[AdvancedRAGSystem] = None


def initialize_rag_system(
    ai_client,
    knowledge_graph=None,
    vector_store=None,
    embedding_model=None
) -> AdvancedRAGSystem:
    """
    Initialize the global RAG system.
    Call this once at application startup.
    """
    global _rag_system
    
    _rag_system = AdvancedRAGSystem(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        vector_store=vector_store,
        embedding_model=embedding_model
    )
    
    logger.info("✅ Advanced RAG system initialized with all enhancements")
    return _rag_system


def get_rag_system() -> Optional[AdvancedRAGSystem]:
    """Get the global RAG system instance"""
    return _rag_system


async def smart_retrieve(
    query: str,
    user_id: str = None,
    user_context: Dict[str, Any] = None,
    top_k: int = 10,
    max_context_length: int = 2000
) -> Dict[str, Any]:
    """
    Smart retrieval with all enhancements enabled.
    
    This is the recommended way to use the RAG system.
    It automatically applies:
    - Query enhancement (rewriting, expansion)
    - Agentic search strategy
    - Contextual compression
    - Re-ranking
    
    Args:
        query: User's search query
        user_id: User ID for personalization
        user_context: Additional user context (weak topics, preferences, etc.)
        top_k: Number of results to return
        max_context_length: Maximum context length in characters
    
    Returns:
        Dict with results and metadata
    """
    if not _rag_system:
        raise RuntimeError("RAG system not initialized. Call initialize_rag_system() first.")
    
    return await _rag_system.retrieve(
        query=query,
        user_id=user_id,
        mode=SearchMode.AGENTIC,
        top_k=top_k,
        context=user_context,
        enhance_query=True,
        compress_results=True,
        max_context_length=max_context_length
    )


async def get_context_string(
    query: str,
    user_id: str = None,
    user_context: Dict[str, Any] = None,
    max_length: int = 2000
) -> str:
    """
    Get formatted context string ready for LLM prompts.
    
    Args:
        query: Search query
        user_id: User ID
        user_context: User context
        max_length: Maximum context length
    
    Returns:
        Formatted context string
    """
    if not _rag_system:
        raise RuntimeError("RAG system not initialized")
    
    return await _rag_system.get_context_for_query(
        query=query,
        user_id=user_id,
        max_context_length=max_length,
        enhance=True
    )


async def get_learning_context(
    query: str,
    user_id: str,
    user_context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Get comprehensive learning context for educational queries.
    
    Includes:
    - Retrieved content from user's materials
    - Knowledge graph relationships
    - Learning paths
    - Enhanced query information
    
    Args:
        query: Learning query
        user_id: User ID
        user_context: User context with weak topics, preferences, etc.
    
    Returns:
        Comprehensive learning context
    """
    if not _rag_system:
        raise RuntimeError("RAG system not initialized")
    
    return await _rag_system.get_learning_context(
        query=query,
        user_id=user_id,
        user_context=user_context
    )


def index_user_content(
    content_type: str,
    items: List[Dict[str, Any]],
    use_hierarchical: bool = False
):
    """
    Index user content for retrieval.
    
    Args:
        content_type: Type of content (notes, flashcards, quizzes, slides)
        items: List of items to index
        use_hierarchical: Use parent-child indexing for long documents
    
    Example:
        index_user_content("notes", [
            {"id": 1, "content": "...", "title": "My Note", "topic": "Math"},
            {"id": 2, "content": "...", "title": "Another Note"}
        ])
    """
    if not _rag_system:
        raise RuntimeError("RAG system not initialized")
    
    _rag_system.index_content(
        content_type=content_type,
        items=items,
        use_parent_child=use_hierarchical
    )
    
    logger.info(f"Indexed {len(items)} {content_type} items")


def clear_rag_cache():
    """Clear the RAG result cache"""
    if _rag_system:
        _rag_system.clear_cache()


def get_rag_stats() -> Dict[str, Any]:
    """Get RAG system statistics"""
    if not _rag_system:
        return {"status": "not_initialized"}
    
    return _rag_system.get_stats()


# ==================== Usage Examples ====================

"""
USAGE EXAMPLES:

1. Initialize at startup (in main.py or similar):
   
   from agents.rag.rag_helper import initialize_rag_system
   
   rag_system = initialize_rag_system(
       ai_client=ai_client,
       knowledge_graph=user_kg,
       vector_store=chroma_collection,
       embedding_model=embedding_model
   )


2. Simple retrieval in agents:
   
   from agents.rag.rag_helper import smart_retrieve
   
   results = await smart_retrieve(
       query="explain photosynthesis",
       user_id="123",
       user_context={"weak_topics": ["biology"], "difficulty_level": "intermediate"}
   )
   
   for result in results["results"]:
       print(f"[{result.source}] {result.content}")


3. Get context for LLM prompts:
   
   from agents.rag.rag_helper import get_context_string
   
   context = await get_context_string(
       query="what are my notes about machine learning?",
       user_id="123",
       max_length=2000
   )
   
   prompt = f"Context: {context}\n\nQuestion: {user_query}\n\nAnswer:"


4. Get comprehensive learning context:
   
   from agents.rag.rag_helper import get_learning_context
   
   learning_ctx = await get_learning_context(
       query="neural networks",
       user_id="123",
       user_context={
           "weak_topics": ["backpropagation"],
           "topics_of_interest": ["deep learning", "AI"]
       }
   )
   
   # Use learning_ctx["retrieved_content"] for RAG results
   # Use learning_ctx["graph_context"] for concept relationships


5. Index user content:
   
   from agents.rag.rag_helper import index_user_content
   
   # Index notes
   index_user_content("notes", [
       {"id": 1, "content": "...", "title": "Biology Notes", "topic": "biology"},
       {"id": 2, "content": "...", "title": "Math Notes", "topic": "calculus"}
   ])
   
   # Index flashcards
   index_user_content("flashcards", [
       {"id": 1, "content": "Q: ... A: ...", "topic": "history"}
   ])
   
   # Index long documents with hierarchical indexing
   index_user_content("slides", [
       {"id": 1, "content": "very long presentation content...", "title": "Lecture 1"}
   ], use_hierarchical=True)


6. Get statistics:
   
   from agents.rag.rag_helper import get_rag_stats
   
   stats = get_rag_stats()
   print(f"Cache size: {stats['cache_size']}")
   print(f"Query enhancer available: {stats['query_enhancer_available']}")
"""
