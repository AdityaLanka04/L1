"""
Content Creation Hooks
Automatically triggers RAG indexing when users create content.

This ensures user RAG is always up-to-date without waiting for the background task.
"""

import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


class ContentIndexingHooks:
    """
    Hooks that trigger immediate indexing when users create content.
    Provides real-time RAG updates for better question generation.
    """
    
    def __init__(self, user_rag_manager=None):
        self.user_rag_manager = user_rag_manager
        logger.info("Content Indexing Hooks initialized")
    
    async def on_note_created(self, user_id: str, note: Dict[str, Any]):
        """Hook: Called when a user creates a note"""
        if not self.user_rag_manager:
            return
        
        try:
            await self.user_rag_manager.index_user_content(
                user_id=user_id,
                content_type="note",
                items=[{
                    "id": note.get("id"),
                    "title": note.get("title", ""),
                    "content": note.get("content", ""),
                    "created_at": note.get("created_at")
                }]
            )
            logger.info(f"✅ Indexed new note for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to index note for user {user_id}: {e}")
    
    async def on_flashcard_created(self, user_id: str, flashcard: Dict[str, Any]):
        """Hook: Called when a user creates a flashcard"""
        if not self.user_rag_manager:
            return
        
        try:
            await self.user_rag_manager.index_user_content(
                user_id=user_id,
                content_type="flashcard",
                items=[{
                    "id": flashcard.get("id"),
                    "content": f"{flashcard.get('front', '')} | {flashcard.get('back', '')}",
                    "front": flashcard.get("front", ""),
                    "back": flashcard.get("back", ""),
                    "created_at": flashcard.get("created_at")
                }]
            )
            logger.info(f"✅ Indexed new flashcard for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to index flashcard for user {user_id}: {e}")
    
    async def on_chat_message(self, user_id: str, message: Dict[str, Any]):
        """Hook: Called when a user sends a chat message"""
        if not self.user_rag_manager:
            return
        
        try:
            # Only index if both user message and AI response exist
            if message.get("user_message") and message.get("ai_response"):
                await self.user_rag_manager.index_user_content(
                    user_id=user_id,
                    content_type="chat",
                    items=[{
                        "id": message.get("id"),
                        "content": f"Q: {message.get('user_message')}\nA: {message.get('ai_response')}",
                        "timestamp": message.get("timestamp")
                    }]
                )
                logger.info(f"✅ Indexed chat message for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to index chat for user {user_id}: {e}")
    
    async def on_question_set_created(self, user_id: str, question_set: Dict[str, Any], questions: List[Dict[str, Any]]):
        """Hook: Called when a user generates a question set"""
        if not self.user_rag_manager:
            return
        
        try:
            # Build comprehensive content from questions
            questions_text_parts = []
            for q in questions:
                q_text = q.get('question_text', '')
                q_answer = q.get('correct_answer', '')
                q_explanation = q.get('explanation', '')
                q_topic = q.get('topic', '')
                
                question_block = f"Q: {q_text}\nA: {q_answer}"
                if q_explanation:
                    question_block += f"\nExplanation: {q_explanation}"
                if q_topic:
                    question_block += f"\nTopic: {q_topic}"
                
                questions_text_parts.append(question_block)
            
            questions_content = "\n\n".join(questions_text_parts)
            
            # Create comprehensive content for indexing
            full_content = f"""Title: {question_set.get('title', 'Question Set')}
Description: {question_set.get('description', '')}
Source: {question_set.get('source_type', 'custom')}
Total Questions: {len(questions)}

Questions and Answers:
{questions_content}"""
            
            await self.user_rag_manager.index_user_content(
                user_id=user_id,
                content_type="question_bank",
                items=[{
                    "id": question_set.get("id"),
                    "title": question_set.get("title", "Question Set"),
                    "content": full_content,
                    "question_count": len(questions),
                    "source_type": question_set.get("source_type", "custom"),
                    "created_at": question_set.get("created_at")
                }]
            )
            logger.info(f"✅ Indexed question set ({len(questions)} questions) for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to index questions for user {user_id}: {e}")
    
    async def on_bulk_content_created(self, user_id: str, content_type: str, items: List[Dict[str, Any]]):
        """Hook: Called when multiple items are created at once"""
        if not self.user_rag_manager:
            return
        
        try:
            await self.user_rag_manager.index_user_content(
                user_id=user_id,
                content_type=content_type,
                items=items
            )
            logger.info(f"✅ Bulk indexed {len(items)} {content_type} items for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to bulk index for user {user_id}: {e}")


# Global instance
_content_hooks: Optional[ContentIndexingHooks] = None


def get_content_hooks() -> Optional[ContentIndexingHooks]:
    """Get the global content hooks instance"""
    return _content_hooks


def initialize_content_hooks(user_rag_manager=None) -> ContentIndexingHooks:
    """Initialize the global content hooks"""
    global _content_hooks
    
    _content_hooks = ContentIndexingHooks(user_rag_manager=user_rag_manager)
    
    logger.info("Content Indexing Hooks initialized globally")
    return _content_hooks


# Convenience functions for easy hook calling

async def trigger_note_index(user_id: str, note: Dict[str, Any]):
    """Trigger indexing for a newly created note"""
    hooks = get_content_hooks()
    if hooks:
        await hooks.on_note_created(user_id, note)


async def trigger_flashcard_index(user_id: str, flashcard: Dict[str, Any]):
    """Trigger indexing for a newly created flashcard"""
    hooks = get_content_hooks()
    if hooks:
        await hooks.on_flashcard_created(user_id, flashcard)


async def trigger_chat_index(user_id: str, message: Dict[str, Any]):
    """Trigger indexing for a chat message"""
    hooks = get_content_hooks()
    if hooks:
        await hooks.on_chat_message(user_id, message)


async def trigger_question_set_index(user_id: str, question_set: Dict[str, Any], questions: List[Dict[str, Any]]):
    """Trigger indexing for a question set"""
    hooks = get_content_hooks()
    if hooks:
        await hooks.on_question_set_created(user_id, question_set, questions)
