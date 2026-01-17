"""
Auto-Indexing Background Task
Automatically indexes user content for personalized RAG retrieval.

This runs periodically to keep each user's RAG up-to-date with their latest:
- Notes
- Flashcards
- Chat conversations
- Generated questions
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class AutoIndexer:
    """
    Background task that automatically indexes user content.
    Runs periodically to keep user RAG systems up-to-date.
    """
    
    def __init__(
        self,
        user_rag_manager=None,
        db_session_factory=None,
        interval_minutes: int = 30
    ):
        self.user_rag_manager = user_rag_manager
        self.db_session_factory = db_session_factory
        self.interval_minutes = interval_minutes
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        
        logger.info(f"Auto-Indexer initialized (interval: {interval_minutes} minutes)")
    
    async def start(self):
        """Start the auto-indexing background task"""
        if self.is_running:
            logger.warning("Auto-indexer already running")
            return
        
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("✅ Auto-indexer started")
    
    async def stop(self):
        """Stop the auto-indexing background task"""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Auto-indexer stopped")
    
    async def _run_loop(self):
        """Main loop that runs periodically"""
        while self.is_running:
            try:
                await self._index_active_users()
            except Exception as e:
                logger.error(f"Auto-indexing error: {e}")
            
            # Wait for next interval
            await asyncio.sleep(self.interval_minutes * 60)
    
    async def _index_active_users(self):
        """Index content for recently active users"""
        if not self.user_rag_manager or not self.db_session_factory:
            return
        
        try:
            from sqlalchemy import text
            session = self.db_session_factory()
            
            # Get users active in the last 24 hours
            active_users_query = text("""
                SELECT DISTINCT u.id, u.email
                FROM users u
                WHERE u.last_login > datetime('now', '-1 day')
                OR EXISTS (
                    SELECT 1 FROM notes n 
                    WHERE n.user_id = u.id 
                    AND n.created_at > datetime('now', '-1 day')
                )
                OR EXISTS (
                    SELECT 1 FROM flashcard_sets fs 
                    WHERE fs.user_id = u.id 
                    AND fs.created_at > datetime('now', '-1 day')
                )
                OR EXISTS (
                    SELECT 1 FROM chat_sessions cs 
                    WHERE cs.user_id = u.id 
                    AND cs.created_at > datetime('now', '-1 day')
                )
                OR EXISTS (
                    SELECT 1 FROM question_sets qs 
                    WHERE qs.user_id = u.id 
                    AND qs.created_at > datetime('now', '-1 day')
                )
                LIMIT 100
            """)
            
            active_users = session.execute(active_users_query).fetchall()
            
            if not active_users:
                logger.info("No active users to index")
                return
            
            logger.info(f"Auto-indexing content for {len(active_users)} active users")
            
            # Index each user's content
            for user_id, email in active_users:
                try:
                    user_identifier = str(user_id)
                    await self.user_rag_manager.auto_index_user_activity(user_identifier)
                    logger.info(f"✅ Auto-indexed content for user {user_identifier}")
                except Exception as e:
                    logger.error(f"Failed to auto-index user {user_id}: {e}")
            
            logger.info(f"Auto-indexing completed for {len(active_users)} users")
            
        except Exception as e:
            logger.error(f"Failed to get active users: {e}")
    
    async def index_user_now(self, user_id: str):
        """Manually trigger indexing for a specific user"""
        if not self.user_rag_manager:
            logger.warning("User RAG Manager not available")
            return False
        
        try:
            await self.user_rag_manager.auto_index_user_activity(user_id)
            logger.info(f"✅ Manually indexed content for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Manual indexing failed for user {user_id}: {e}")
            return False


# Global instance
_auto_indexer: Optional[AutoIndexer] = None


def get_auto_indexer() -> Optional[AutoIndexer]:
    """Get the global auto-indexer instance"""
    return _auto_indexer


async def initialize_auto_indexer(
    user_rag_manager=None,
    db_session_factory=None,
    interval_minutes: int = 30,
    auto_start: bool = True
) -> AutoIndexer:
    """
    Initialize and optionally start the auto-indexer.
    
    Args:
        user_rag_manager: User RAG Manager instance
        db_session_factory: Database session factory
        interval_minutes: How often to run (default: 30 minutes)
        auto_start: Whether to start immediately (default: True)
    """
    global _auto_indexer
    
    _auto_indexer = AutoIndexer(
        user_rag_manager=user_rag_manager,
        db_session_factory=db_session_factory,
        interval_minutes=interval_minutes
    )
    
    if auto_start:
        await _auto_indexer.start()
    
    logger.info("Auto-Indexer initialized globally")
    return _auto_indexer


async def shutdown_auto_indexer():
    """Shutdown the auto-indexer gracefully"""
    global _auto_indexer
    if _auto_indexer:
        await _auto_indexer.stop()
        _auto_indexer = None
