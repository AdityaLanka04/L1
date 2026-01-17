"""
Advanced RAG (Retrieval-Augmented Generation) Module

Features:
- Hybrid Search: Combines semantic + keyword search
- Re-ranking: Uses cross-encoder models for better relevance
- GraphRAG: Leverages knowledge graph for context-aware retrieval
- Agentic RAG: Agents decide when/what to retrieve
- User-Specific RAG: Per-user learning and personalized retrieval
- Auto-Indexing: Background task for keeping user RAG up-to-date
"""

from .advanced_rag import (
    AdvancedRAGSystem,
    HybridSearchEngine,
    ReRanker,
    GraphRAGEngine,
    AgenticRAGEngine,
    RAGResult,
    SearchMode
)
from .user_rag_manager import (
    UserRAGManager,
    get_user_rag_manager,
    initialize_user_rag_manager
)
from .auto_indexer import (
    AutoIndexer,
    get_auto_indexer,
    initialize_auto_indexer,
    shutdown_auto_indexer
)

__all__ = [
    'AdvancedRAGSystem',
    'HybridSearchEngine',
    'ReRanker',
    'GraphRAGEngine',
    'AgenticRAGEngine',
    'RAGResult',
    'SearchMode',
    'UserRAGManager',
    'get_user_rag_manager',
    'initialize_user_rag_manager',
    'AutoIndexer',
    'get_auto_indexer',
    'initialize_auto_indexer',
    'shutdown_auto_indexer',
]
