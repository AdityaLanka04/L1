"""
RAG API Endpoints
Exposes enhanced RAG functionality to the frontend.
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from agents.rag.rag_helper import (
    get_rag_system,
    smart_retrieve,
    get_context_string,
    get_learning_context,
    index_user_content,
    get_rag_stats,
    clear_rag_cache
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag-helper", tags=["RAG Helper"])


# ==================== Request Models ====================

class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    max_context_length: int = 2000
    user_context: Optional[Dict[str, Any]] = None


class IndexRequest(BaseModel):
    content_type: str  # notes, flashcards, quizzes, slides
    items: List[Dict[str, Any]]
    use_hierarchical: bool = False


# ==================== Endpoints ====================

@router.post("/search")
async def search_content(
    request: SearchRequest,
    db: Session = Depends(get_db)
):
    """
    Smart search across user's content with all RAG enhancements.
    
    Features:
    - Query enhancement (rewriting, expansion)
    - Agentic search strategy
    - Contextual compression
    - Re-ranking
    """
    try:
        # Get user_id from request or use anonymous
        user_id = request.user_context.get("user_id") if request.user_context else "anonymous"
        
        results = await smart_retrieve(
            query=request.query,
            user_id=user_id,
            user_context=request.user_context,
            top_k=request.top_k,
            max_context_length=request.max_context_length
        )
        
        return {
            "success": True,
            "results": [r.to_dict() for r in results["results"]],
            "metadata": {
                "total": results.get("total", 0),
                "from_cache": results.get("from_cache", False),
                "enhanced": results.get("enhanced", False),
                "compressed": results.get("compressed", False),
                "enhanced_query": results.get("enhanced_query")
            }
        }
        
    except Exception as e:
        logger.error(f"RAG search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/context")
async def get_context(
    query: str = Query(..., description="Search query"),
    max_length: int = Query(2000, description="Maximum context length"),
    db: Session = Depends(get_db)
):
    """
    Get formatted context string for a query.
    Useful for building prompts with relevant context.
    """
    try:
        user_id = "anonymous"  # Can be enhanced with auth later
        
        context = await get_context_string(
            query=query,
            user_id=user_id,
            max_length=max_length
        )
        
        return {
            "success": True,
            "context": context,
            "length": len(context)
        }
        
    except Exception as e:
        logger.error(f"Get context failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning-context")
async def get_learning_ctx(
    query: str = Query(..., description="Learning query"),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive learning context including:
    - Retrieved content from user's materials
    - Knowledge graph relationships
    - Learning paths
    - Enhanced query information
    """
    try:
        user_id = "anonymous"  # Can be enhanced with auth later
        
        # Build user context from database
        user_context = await _build_user_context(user_id, db)
        
        learning_ctx = await get_learning_context(
            query=query,
            user_id=user_id,
            user_context=user_context
        )
        
        return {
            "success": True,
            **learning_ctx
        }
        
    except Exception as e:
        logger.error(f"Get learning context failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index")
async def index_content(
    request: IndexRequest,
    db: Session = Depends(get_db)
):
    """
    Index user content for retrieval.
    
    Content types: notes, flashcards, quizzes, slides
    """
    try:
        user_id = "anonymous"  # Can be enhanced with auth later
        
        # Add user_id to each item
        for item in request.items:
            item["user_id"] = user_id
        
        index_user_content(
            content_type=request.content_type,
            items=request.items,
            use_hierarchical=request.use_hierarchical
        )
        
        return {
            "success": True,
            "message": f"Indexed {len(request.items)} {request.content_type} items",
            "count": len(request.items)
        }
        
    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db)
):
    """
    Get RAG system statistics.
    """
    try:
        stats = get_rag_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Get stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-cache")
async def clear_cache(
    db: Session = Depends(get_db)
):
    """
    Clear the RAG result cache.
    """
    try:
        clear_rag_cache()
        
        return {
            "success": True,
            "message": "Cache cleared successfully"
        }
        
    except Exception as e:
        logger.error(f"Clear cache failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Helper Functions ====================

async def _build_user_context(user_id: str, db: Session) -> Dict[str, Any]:
    """Build user context from database"""
    try:
        from models import TopicMastery, UserPreferences
        
        context = {
            "weak_topics": [],
            "topics_of_interest": [],
            "difficulty_level": "intermediate"
        }
        
        # Get weak topics
        weak_masteries = db.query(TopicMastery).filter(
            TopicMastery.user_id == int(user_id),
            TopicMastery.mastery_level < 0.6
        ).order_by(TopicMastery.mastery_level).limit(10).all()
        
        context["weak_topics"] = [m.topic_name for m in weak_masteries]
        
        # Get topics of interest
        all_masteries = db.query(TopicMastery).filter(
            TopicMastery.user_id == int(user_id)
        ).order_by(TopicMastery.times_studied.desc()).limit(10).all()
        
        context["topics_of_interest"] = [m.topic_name for m in all_masteries]
        
        # Get user preferences
        prefs = db.query(UserPreferences).filter(
            UserPreferences.user_id == int(user_id)
        ).first()
        
        if prefs:
            context["difficulty_level"] = prefs.difficulty_level or "intermediate"
        
        return context
        
    except Exception as e:
        logger.error(f"Build user context failed: {e}")
        return {}


def register_rag_api(app):
    """Register RAG API routes"""
    app.include_router(router)
    logger.info("✅ RAG API endpoints registered")
