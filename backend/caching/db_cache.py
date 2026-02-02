"""
Database Query Caching
Reduces database load for frequently accessed data
"""
import logging
from typing import Any, Callable, Optional
from functools import wraps
from sqlalchemy.orm import Session

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


def cached_query(query_name: str, ttl: int = 300, invalidate_on: list = None):
    """
    Decorator for caching database queries
    
    Args:
        query_name: Unique name for this query
        ttl: Time to live in seconds (default 5 minutes)
        invalidate_on: List of operations that should invalidate this cache
    
    Usage:
        @cached_query("user_profile", ttl=600)
        def get_user_profile(db: Session, user_id: int):
            return db.query(User).filter(User.id == user_id).first()
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not CACHE_AVAILABLE:
                return func(*args, **kwargs)
            
            cache_manager = get_cache_manager()
            
            # Try to get from cache
            result = cache_manager.get_db_query(query_name, *args, **kwargs)
            if result is not None:
                logger.debug(f"DB cache hit: {query_name}")
                return result
            
            # Execute query
            result = func(*args, **kwargs)
            
            # Cache result
            cache_manager.set_db_query(query_name, result, ttl, *args, **kwargs)
            logger.debug(f"DB query cached: {query_name}")
            
            return result
        
        # Add invalidation method
        wrapper.invalidate = lambda *args, **kwargs: invalidate_cache(query_name, *args, **kwargs)
        
        return wrapper
    return decorator


def invalidate_cache(query_name: str, *args, **kwargs):
    """Invalidate a specific cached query"""
    if CACHE_AVAILABLE:
        cache_manager = get_cache_manager()
        cache_manager.invalidate_db_query(query_name, *args, **kwargs)
        logger.debug(f"Invalidated cache: {query_name}")


def invalidate_user_cache(user_id: int):
    """Invalidate all caches related to a user"""
    if CACHE_AVAILABLE:
        cache_manager = get_cache_manager()
        
        # Invalidate common user-related queries
        queries_to_invalidate = [
            "user_profile",
            "user_stats",
            "user_flashcards",
            "user_notes",
            "user_chats",
            "user_activities",
            "user_learning_metrics"
        ]
        
        for query_name in queries_to_invalidate:
            try:
                cache_manager.invalidate_db_query(query_name, user_id=user_id)
            except:
                pass
        
        logger.info(f"Invalidated all caches for user {user_id}")


def invalidate_content_cache(content_type: str, content_id: int):
    """Invalidate caches for specific content"""
    if CACHE_AVAILABLE:
        cache_manager = get_cache_manager()
        cache_manager.invalidate_db_query(f"{content_type}_detail", content_id=content_id)
        logger.debug(f"Invalidated cache for {content_type} {content_id}")


# ==================== Common Cached Queries ====================

@cached_query("user_profile", ttl=600)
def get_cached_user_profile(db: Session, user_id: int):
    """Get user profile with caching"""
    from models import User
    return db.query(User).filter(User.id == user_id).first()


@cached_query("user_stats", ttl=300)
def get_cached_user_stats(db: Session, user_id: int):
    """Get user statistics with caching"""
    from models import UserStats
    return db.query(UserStats).filter(UserStats.user_id == user_id).first()


@cached_query("user_flashcard_sets", ttl=300)
def get_cached_flashcard_sets(db: Session, user_id: int):
    """Get user's flashcard sets with caching"""
    from models import FlashcardSet
    return db.query(FlashcardSet).filter(FlashcardSet.user_id == user_id).all()


@cached_query("user_notes_list", ttl=180)
def get_cached_notes_list(db: Session, user_id: int, limit: int = 50):
    """Get user's notes list with caching"""
    from models import Note
    return db.query(Note).filter(Note.user_id == user_id).order_by(Note.updated_at.desc()).limit(limit).all()


@cached_query("user_chat_sessions", ttl=180)
def get_cached_chat_sessions(db: Session, user_id: int, limit: int = 20):
    """Get user's chat sessions with caching"""
    from models import ChatSession
    return db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).limit(limit).all()


@cached_query("daily_learning_metrics", ttl=600)
def get_cached_daily_metrics(db: Session, user_id: int, days: int = 30):
    """Get daily learning metrics with caching"""
    from models import DailyLearningMetrics
    from datetime import datetime, timedelta
    
    start_date = datetime.now() - timedelta(days=days)
    return db.query(DailyLearningMetrics).filter(
        DailyLearningMetrics.user_id == user_id,
        DailyLearningMetrics.date >= start_date
    ).order_by(DailyLearningMetrics.date.desc()).all()


# ==================== Cache Warming ====================

def warm_user_cache(db: Session, user_id: int):
    """
    Pre-load commonly accessed user data into cache
    Call this after user login
    """
    if not CACHE_AVAILABLE:
        return
    
    logger.info(f"Warming cache for user {user_id}")
    
    try:
        # Load common queries
        get_cached_user_profile(db, user_id)
        get_cached_user_stats(db, user_id)
        get_cached_flashcard_sets(db, user_id)
        get_cached_notes_list(db, user_id)
        get_cached_chat_sessions(db, user_id)
        get_cached_daily_metrics(db, user_id)
        
        logger.info(f"✅ Cache warmed for user {user_id}")
    except Exception as e:
        logger.error(f"Cache warming failed: {e}")


# ==================== Batch Caching ====================

def cache_batch_results(query_name: str, results: dict, ttl: int = 300):
    """
    Cache multiple results at once
    
    Usage:
        users = {user.id: user for user in db.query(User).all()}
        cache_batch_results("user_profile", users, ttl=600)
    """
    if not CACHE_AVAILABLE:
        return
    
    cache_manager = get_cache_manager()
    
    for key, value in results.items():
        cache_manager.set_db_query(query_name, value, ttl, key)
    
    logger.info(f"Cached {len(results)} {query_name} results")


# ==================== Smart Cache Invalidation ====================

class CacheInvalidator:
    """
    Context manager for automatic cache invalidation
    
    Usage:
        with CacheInvalidator(user_id=123, content_type="note"):
            # Perform database operations
            note.title = "New Title"
            db.commit()
        # Cache automatically invalidated after commit
    """
    
    def __init__(self, user_id: int = None, content_type: str = None, content_id: int = None):
        self.user_id = user_id
        self.content_type = content_type
        self.content_id = content_id
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:  # Only invalidate if no exception
            if self.user_id:
                invalidate_user_cache(self.user_id)
            
            if self.content_type and self.content_id:
                invalidate_content_cache(self.content_type, self.content_id)
