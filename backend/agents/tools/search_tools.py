"""
Search Tools
Tools for agents to search content and the web
"""

import logging
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Global references (set during initialization)
_db_session_factory = None
_vector_store = None

def set_search_dependencies(db_session_factory=None, vector_store=None):
    global _db_session_factory, _vector_store
    _db_session_factory = db_session_factory
    _vector_store = vector_store


@tool
def search_flashcards(query: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search user's flashcards by content.
    Use this to find relevant flashcards for review or reference.
    
    Args:
        query: Search query
        user_id: User's ID
        limit: Maximum results
    
    Returns:
        List of matching flashcards with id, front, back, set_name
    """
    if not _db_session_factory:
        return []
    try:
        from sqlalchemy import or_
        import models
        
        db = _db_session_factory()
        results = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user_id,
            or_(
                models.Flashcard.front.ilike(f"%{query}%"),
                models.Flashcard.back.ilike(f"%{query}%")
            )
        ).limit(limit).all()
        
        db.close()
        return [
            {"id": f.id, "front": f.front, "back": f.back, "set_id": f.set_id}
            for f in results
        ]
    except Exception as e:
        logger.error(f"Error searching flashcards: {e}")
        return []


@tool
def search_notes(query: str, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search user's notes by title and content.
    Use this to find relevant notes for context.
    
    Args:
        query: Search query
        user_id: User's ID
        limit: Maximum results
    
    Returns:
        List of matching notes with id, title, content_preview
    """
    if not _db_session_factory:
        return []
    try:
        from sqlalchemy import or_
        import models
        
        db = _db_session_factory()
        results = db.query(models.Note).filter(
            models.Note.user_id == user_id,
            or_(
                models.Note.title.ilike(f"%{query}%"),
                models.Note.content.ilike(f"%{query}%")
            )
        ).limit(limit).all()
        
        db.close()
        return [
            {
                "id": n.id, 
                "title": n.title, 
                "content_preview": n.content[:200] if n.content else ""
            }
            for n in results
        ]
    except Exception as e:
        logger.error(f"Error searching notes: {e}")
        return []


@tool
def search_quiz_history(user_id: int, topic: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Search user's quiz history.
    Use this to understand past performance on topics.
    
    Args:
        user_id: User's ID
        topic: Optional topic filter
        limit: Maximum results
    
    Returns:
        List of quiz results with topic, score, date
    """
    if not _db_session_factory:
        return []
    try:
        import models
        
        db = _db_session_factory()
        query = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user_id
        )
        
        if topic:
            query = query.filter(models.QuestionSet.topic.ilike(f"%{topic}%"))
        
        results = query.order_by(models.QuestionSet.created_at.desc()).limit(limit).all()
        
        db.close()
        return [
            {
                "id": q.id,
                "topic": q.topic,
                "difficulty": q.difficulty,
                "created_at": q.created_at.isoformat() if q.created_at else None
            }
            for q in results
        ]
    except Exception as e:
        logger.error(f"Error searching quiz history: {e}")
        return []


@tool
def get_study_statistics(user_id: int, days: int = 30) -> Dict[str, Any]:
    """
    Get user's study statistics.
    Use this to understand learning patterns and progress.
    
    Args:
        user_id: User's ID
        days: Number of days to look back
    
    Returns:
        Statistics including total_sessions, avg_score, topics_studied, streak
    """
    if not _db_session_factory:
        return {}
    try:
        from datetime import datetime, timedelta
        import models
        
        db = _db_session_factory()
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get daily metrics
        metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id,
            models.DailyLearningMetrics.date >= cutoff.date()
        ).all()
        
        total_questions = sum(m.questions_answered for m in metrics)
        total_correct = sum(m.correct_answers for m in metrics)
        
        db.close()
        return {
            "days_active": len(metrics),
            "total_questions": total_questions,
            "total_correct": total_correct,
            "accuracy": round(total_correct / max(total_questions, 1) * 100, 1),
            "avg_questions_per_day": round(total_questions / max(len(metrics), 1), 1)
        }
    except Exception as e:
        logger.error(f"Error getting study statistics: {e}")
        return {}


@tool
def semantic_search(query: str, collection: str = "notes", limit: int = 5) -> List[Dict[str, Any]]:
    """
    Perform semantic search using vector embeddings.
    Use this for finding conceptually similar content.
    
    Args:
        query: Search query
        collection: Collection to search (notes, flashcards)
        limit: Maximum results
    
    Returns:
        List of semantically similar results
    """
    if not _vector_store:
        return []
    try:
        results = _vector_store.similarity_search(query, k=limit)
        return [
            {
                "content": doc.page_content,
                "metadata": doc.metadata
            }
            for doc in results
        ]
    except Exception as e:
        logger.error(f"Error in semantic search: {e}")
        return []


class SearchTools:
    """Collection of search tools for agents"""
    
    def __init__(self, db_session_factory=None, vector_store=None):
        set_search_dependencies(db_session_factory, vector_store)
    
    @staticmethod
    def get_tools():
        """Get all search tools"""
        return [
            search_flashcards,
            search_notes,
            search_quiz_history,
            get_study_statistics,
            semantic_search
        ]
