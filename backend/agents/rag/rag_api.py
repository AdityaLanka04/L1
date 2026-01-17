"""
Advanced RAG API
Exposes endpoints for the advanced RAG capabilities.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from .advanced_rag import (
    AdvancedRAGSystem,
    SearchMode,
    RAGResult
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["rag"])

# Global RAG system instance
_rag_system: Optional[AdvancedRAGSystem] = None


def get_rag_system() -> Optional[AdvancedRAGSystem]:
    """Get the global RAG system instance"""
    return _rag_system


async def initialize_rag_system(
    ai_client=None,
    knowledge_graph=None,
    vector_store=None,
    embedding_model=None
) -> AdvancedRAGSystem:
    """Initialize the global RAG system"""
    global _rag_system
    
    _rag_system = AdvancedRAGSystem(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        vector_store=vector_store,
        embedding_model=embedding_model
    )
    
    logger.info("Advanced RAG system initialized")
    return _rag_system


# ==================== Request/Response Models ====================

class RetrieveRequest(BaseModel):
    """Request for RAG retrieval"""
    query: str = Field(..., description="Search query")
    user_id: Optional[str] = Field(None, description="User ID for personalization")
    mode: str = Field("agentic", description="Search mode: semantic, keyword, hybrid, graph, agentic")
    top_k: int = Field(10, ge=1, le=50, description="Number of results")
    use_cache: bool = Field(True, description="Whether to use caching")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")


class RetrieveResponse(BaseModel):
    """Response from RAG retrieval"""
    results: List[Dict[str, Any]]
    total: int
    mode: str
    from_cache: bool
    strategy: Optional[Dict[str, Any]] = None
    followup_performed: bool = False


class IndexRequest(BaseModel):
    """Request to index content"""
    content_type: str = Field(..., description="Type of content: notes, flashcards, questions")
    items: List[Dict[str, Any]] = Field(..., description="Items to index")


class LearningContextRequest(BaseModel):
    """Request for learning context"""
    query: str
    user_id: str


class LearningContextResponse(BaseModel):
    """Response with learning context"""
    retrieved_content: List[Dict[str, Any]]
    graph_context: Dict[str, Any]
    retrieval_metadata: Dict[str, Any]


# ==================== API Endpoints ====================

@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(request: RetrieveRequest):
    """
    Retrieve relevant content using advanced RAG.
    
    Supports multiple search modes:
    - semantic: Vector similarity search
    - keyword: BM25 keyword search
    - hybrid: Combined semantic + keyword
    - graph: Knowledge graph traversal
    - agentic: AI-decided strategy (recommended)
    """
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    # Map string mode to enum
    mode_map = {
        "semantic": SearchMode.SEMANTIC,
        "keyword": SearchMode.KEYWORD,
        "hybrid": SearchMode.HYBRID,
        "graph": SearchMode.GRAPH,
        "agentic": SearchMode.AGENTIC
    }
    mode = mode_map.get(request.mode.lower(), SearchMode.AGENTIC)
    
    result = await rag.retrieve(
        query=request.query,
        user_id=request.user_id,
        mode=mode,
        top_k=request.top_k,
        use_cache=request.use_cache,
        context=request.context
    )
    
    return RetrieveResponse(
        results=[r.to_dict() if hasattr(r, 'to_dict') else r for r in result.get("results", [])],
        total=result.get("total", len(result.get("results", []))),
        mode=result.get("strategy", {}).get("method", request.mode) if isinstance(result.get("strategy", {}).get("method"), str) else request.mode,
        from_cache=result.get("from_cache", False),
        strategy=result.get("strategy"),
        followup_performed=result.get("followup_performed", False)
    )


@router.post("/index")
async def index_content(request: IndexRequest):
    """
    Index content for RAG retrieval.
    
    Content types: notes, flashcards, questions, media
    """
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    rag.index_content(request.content_type, request.items)
    
    return {
        "status": "success",
        "indexed_count": len(request.items),
        "content_type": request.content_type
    }


@router.post("/learning-context", response_model=LearningContextResponse)
async def get_learning_context(request: LearningContextRequest):
    """
    Get comprehensive learning context for a query.
    
    Combines RAG retrieval with knowledge graph context
    for personalized learning recommendations.
    """
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    result = await rag.get_learning_context(request.query, request.user_id)
    
    return LearningContextResponse(**result)


@router.get("/context")
async def get_context_string(
    query: str,
    user_id: Optional[str] = None,
    max_length: int = 2000
):
    """
    Get formatted context string for LLM prompts.
    
    Returns a ready-to-use context string combining
    relevant retrieved content.
    """
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    context = await rag.get_context_for_query(query, user_id, max_length)
    
    return {
        "context": context,
        "length": len(context)
    }


@router.get("/stats")
async def get_rag_stats():
    """Get RAG system statistics"""
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    return {
        "status": "healthy",
        **rag.get_stats(),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/clear-cache")
async def clear_cache():
    """Clear the RAG result cache"""
    rag = get_rag_system()
    if not rag:
        raise HTTPException(status_code=503, detail="RAG system not initialized")
    
    rag.clear_cache()
    
    return {"status": "cache_cleared"}


@router.get("/search-modes")
async def list_search_modes():
    """List available search modes with descriptions"""
    return {
        "modes": [
            {
                "name": "semantic",
                "description": "Vector similarity search using embeddings. Best for meaning-based queries."
            },
            {
                "name": "keyword",
                "description": "BM25 keyword search. Best for exact term matching."
            },
            {
                "name": "hybrid",
                "description": "Combined semantic + keyword search. Good balance of precision and recall."
            },
            {
                "name": "graph",
                "description": "Knowledge graph traversal. Best for conceptual and relationship queries."
            },
            {
                "name": "agentic",
                "description": "AI-decided strategy. Automatically chooses best approach based on query analysis. Recommended."
            }
        ]
    }


# ==================== User-Specific RAG Endpoints ====================

class UserRAGIndexRequest(BaseModel):
    """Request to index content for a specific user"""
    user_id: str = Field(..., description="User ID")
    content_type: str = Field(..., description="Type: notes, flashcards, chats, questions")
    items: List[Dict[str, Any]] = Field(..., description="Items to index")


class UserRAGRetrieveRequest(BaseModel):
    """Request to retrieve from user's personal RAG"""
    user_id: str = Field(..., description="User ID")
    query: str = Field(..., description="Search query")
    top_k: int = Field(10, ge=1, le=20, description="Number of results")
    content_types: Optional[List[str]] = Field(None, description="Filter by content types")


class UserRAGFeedbackRequest(BaseModel):
    """Feedback on retrieved content for learning"""
    user_id: str = Field(..., description="User ID")
    query: str = Field(..., description="Original query")
    retrieved_items: List[str] = Field(..., description="IDs of retrieved items")
    relevant_items: Optional[List[str]] = Field(None, description="IDs of relevant items")
    needed_more_context: bool = Field(False, description="User needed more context")
    too_much_context: bool = Field(False, description="Too much context provided")
    helpful_content_types: Optional[List[str]] = Field(None, description="Content types that were helpful")


@router.post("/user/index")
async def index_user_content(request: UserRAGIndexRequest):
    """
    Index content for a specific user's personal RAG.
    Builds their personalized knowledge base.
    """
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    success = await user_rag.index_user_content(
        user_id=request.user_id,
        content_type=request.content_type,
        items=request.items
    )
    
    return {
        "status": "success" if success else "failed",
        "user_id": request.user_id,
        "content_type": request.content_type,
        "indexed_count": len(request.items)
    }


@router.post("/user/retrieve")
async def retrieve_user_content(request: UserRAGRetrieveRequest):
    """
    Retrieve content from user's personal RAG.
    Uses their indexed content and learned preferences.
    """
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    results = await user_rag.retrieve_for_user(
        user_id=request.user_id,
        query=request.query,
        top_k=request.top_k,
        content_types=request.content_types
    )
    
    return {
        "user_id": request.user_id,
        "query": request.query,
        "results": results,
        "total": len(results)
    }


@router.post("/user/feedback")
async def submit_user_feedback(request: UserRAGFeedbackRequest):
    """
    Submit feedback on retrieved content.
    Helps the system learn user preferences.
    """
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    await user_rag.learn_from_feedback(
        user_id=request.user_id,
        query=request.query,
        retrieved_items=request.retrieved_items,
        feedback={
            "relevant_items": request.relevant_items,
            "needed_more_context": request.needed_more_context,
            "too_much_context": request.too_much_context,
            "helpful_content_types": request.helpful_content_types
        }
    )
    
    return {
        "status": "feedback_recorded",
        "user_id": request.user_id
    }


@router.post("/user/auto-index/{user_id}")
async def auto_index_user_activity(user_id: str):
    """
    Automatically index user's recent activity.
    Keeps their personal RAG up-to-date.
    """
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    await user_rag.auto_index_user_activity(user_id)
    
    return {
        "status": "auto_indexed",
        "user_id": user_id
    }


@router.get("/user/stats/{user_id}")
async def get_user_rag_stats(user_id: str):
    """Get statistics about user's personal RAG"""
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    stats = user_rag.get_user_stats(user_id)
    
    return {
        "user_id": user_id,
        **stats
    }


@router.delete("/user/clear/{user_id}")
async def clear_user_rag_data(user_id: str):
    """Clear all RAG data for a user (GDPR compliance)"""
    from .user_rag_manager import get_user_rag_manager
    
    user_rag = get_user_rag_manager()
    if not user_rag:
        raise HTTPException(status_code=503, detail="User RAG Manager not initialized")
    
    await user_rag.clear_user_data(user_id)
    
    return {
        "status": "cleared",
        "user_id": user_id
    }


# ==================== Auto-Indexer Endpoints ====================

@router.post("/auto-indexer/trigger/{user_id}")
async def trigger_manual_indexing(user_id: str):
    """
    Manually trigger indexing for a specific user.
    Useful for immediate indexing after user creates content.
    """
    from .auto_indexer import get_auto_indexer
    
    auto_indexer = get_auto_indexer()
    if not auto_indexer:
        raise HTTPException(status_code=503, detail="Auto-Indexer not initialized")
    
    success = await auto_indexer.index_user_now(user_id)
    
    return {
        "status": "success" if success else "failed",
        "user_id": user_id,
        "message": "Content indexed successfully" if success else "Indexing failed"
    }


@router.get("/auto-indexer/status")
async def get_auto_indexer_status():
    """Get the status of the auto-indexer"""
    from .auto_indexer import get_auto_indexer
    
    auto_indexer = get_auto_indexer()
    if not auto_indexer:
        return {
            "status": "not_initialized",
            "is_running": False
        }
    
    return {
        "status": "initialized",
        "is_running": auto_indexer.is_running,
        "interval_minutes": auto_indexer.interval_minutes
    }


@router.post("/auto-indexer/start")
async def start_auto_indexer():
    """Start the auto-indexer if it's stopped"""
    from .auto_indexer import get_auto_indexer
    
    auto_indexer = get_auto_indexer()
    if not auto_indexer:
        raise HTTPException(status_code=503, detail="Auto-Indexer not initialized")
    
    await auto_indexer.start()
    
    return {
        "status": "started",
        "message": "Auto-indexer is now running"
    }


@router.post("/auto-indexer/stop")
async def stop_auto_indexer():
    """Stop the auto-indexer"""
    from .auto_indexer import get_auto_indexer
    
    auto_indexer = get_auto_indexer()
    if not auto_indexer:
        raise HTTPException(status_code=503, detail="Auto-Indexer not initialized")
    
    await auto_indexer.stop()
    
    return {
        "status": "stopped",
        "message": "Auto-indexer has been stopped"
    }
