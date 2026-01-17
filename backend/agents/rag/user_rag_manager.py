"""
User-Specific RAG Manager
Manages separate RAG instances and learning for each user.

Features:
- Per-user vector stores (ChromaDB collections)
- User-specific content indexing
- Personalized retrieval based on user history
- Adaptive learning from user interactions
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)


class UserRAGManager:
    """
    Manages RAG systems for individual users.
    Each user gets their own:
    - Vector store collection
    - Indexed content
    - Retrieval history
    - Learning patterns
    """
    
    def __init__(
        self,
        base_vector_store=None,
        embedding_model=None,
        ai_client=None,
        knowledge_graph=None,
        db_session_factory=None
    ):
        self.base_vector_store = base_vector_store
        self.embedding_model = embedding_model
        self.ai_client = ai_client
        self.knowledge_graph = knowledge_graph
        self.db_session_factory = db_session_factory
        
        # Per-user collections
        self._user_collections: Dict[str, Any] = {}
        
        # Per-user retrieval history for learning
        self._user_retrieval_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        # Per-user content index
        self._user_indexed_content: Dict[str, set] = defaultdict(set)
        
        # Per-user preferences learned from interactions
        self._user_preferences: Dict[str, Dict[str, Any]] = defaultdict(dict)
        
        logger.info("User RAG Manager initialized")
    
    def _get_user_collection_name(self, user_id: str) -> str:
        """Generate unique collection name for user"""
        # Hash user_id to create valid collection name
        user_hash = hashlib.sha256(user_id.encode()).hexdigest()[:16]
        return f"user_{user_hash}"
    
    def _get_or_create_user_collection(self, user_id: str):
        """Get or create a ChromaDB collection for a specific user"""
        if user_id in self._user_collections:
            return self._user_collections[user_id]
        
        if not self.base_vector_store:
            logger.warning(f"No vector store available for user {user_id}")
            return None
        
        try:
            collection_name = self._get_user_collection_name(user_id)
            
            # Try to get existing collection
            try:
                collection = self.base_vector_store.get_collection(collection_name)
                logger.info(f"Retrieved existing collection for user {user_id}")
            except:
                # Create new collection
                collection = self.base_vector_store.create_collection(
                    name=collection_name,
                    metadata={"user_id": user_id, "created_at": datetime.utcnow().isoformat()}
                )
                logger.info(f"Created new collection for user {user_id}")
            
            self._user_collections[user_id] = collection
            return collection
            
        except Exception as e:
            logger.error(f"Failed to get/create collection for user {user_id}: {e}")
            return None
    
    async def index_user_content(
        self,
        user_id: str,
        content_type: str,
        items: List[Dict[str, Any]]
    ) -> bool:
        """
        Index content specifically for a user.
        This builds their personalized knowledge base.
        """
        collection = self._get_or_create_user_collection(user_id)
        if not collection or not self.embedding_model:
            return False
        
        try:
            indexed_count = 0
            
            for item in items:
                content = item.get("content", item.get("text", ""))
                if not content or len(content) < 10:
                    continue
                
                # Create unique ID for this content
                content_id = f"{content_type}_{item.get('id', '')}_{user_id}"
                
                # Skip if already indexed
                if content_id in self._user_indexed_content[user_id]:
                    continue
                
                # Generate embedding
                embedding = self.embedding_model.encode(content)
                
                # Add to user's collection
                collection.add(
                    ids=[content_id],
                    embeddings=[embedding.tolist()],
                    documents=[content],
                    metadatas=[{
                        "type": content_type,
                        "title": item.get("title", ""),
                        "user_id": user_id,
                        "indexed_at": datetime.utcnow().isoformat(),
                        **{k: v for k, v in item.items() if k not in ["content", "text", "embedding"]}
                    }]
                )
                
                self._user_indexed_content[user_id].add(content_id)
                indexed_count += 1
            
            logger.info(f"Indexed {indexed_count} {content_type} items for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to index content for user {user_id}: {e}")
            return False
    
    async def retrieve_for_user(
        self,
        user_id: str,
        query: str,
        top_k: int = 10,
        content_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve content from user's personal knowledge base.
        Uses their indexed content and learned preferences.
        """
        collection = self._get_or_create_user_collection(user_id)
        if not collection:
            return []
        
        try:
            # Build filter for content types if specified
            where_filter = None
            if content_types:
                where_filter = {"type": {"$in": content_types}}
            
            # Apply user preferences to adjust retrieval
            adjusted_top_k = self._adjust_top_k_for_user(user_id, top_k)
            
            # Query user's collection
            results = collection.query(
                query_texts=[query],
                n_results=adjusted_top_k,
                where=where_filter
            )
            
            # Format results
            formatted_results = []
            if results and results.get("documents"):
                docs = results["documents"][0]
                ids = results.get("ids", [[]])[0]
                distances = results.get("distances", [[]])[0]
                metadatas = results.get("metadatas", [[]])[0]
                
                for i, doc in enumerate(docs):
                    formatted_results.append({
                        "id": ids[i] if i < len(ids) else f"doc_{i}",
                        "content": doc,
                        "score": 1.0 / (1.0 + distances[i]) if i < len(distances) else 0.5,
                        "source": "user_rag",
                        "metadata": metadatas[i] if i < len(metadatas) else {}
                    })
            
            # Record retrieval for learning
            self._record_retrieval(user_id, query, len(formatted_results))
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"Retrieval failed for user {user_id}: {e}")
            return []
    
    def _adjust_top_k_for_user(self, user_id: str, base_top_k: int) -> int:
        """Adjust retrieval count based on user's learned preferences"""
        prefs = self._user_preferences.get(user_id, {})
        
        # If user typically needs more context, increase top_k
        if prefs.get("prefers_more_context", False):
            return min(base_top_k + 5, 20)
        
        # If user prefers concise results, decrease top_k
        if prefs.get("prefers_concise", False):
            return max(base_top_k - 3, 5)
        
        return base_top_k
    
    def _record_retrieval(self, user_id: str, query: str, result_count: int):
        """Record retrieval for learning user patterns"""
        self._user_retrieval_history[user_id].append({
            "query": query[:100],
            "result_count": result_count,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep only recent history (last 100 retrievals)
        if len(self._user_retrieval_history[user_id]) > 100:
            self._user_retrieval_history[user_id] = self._user_retrieval_history[user_id][-100:]
    
    async def learn_from_feedback(
        self,
        user_id: str,
        query: str,
        retrieved_items: List[str],
        feedback: Dict[str, Any]
    ):
        """
        Learn from user feedback on retrieved content.
        Adapts future retrievals based on what was helpful.
        """
        prefs = self._user_preferences[user_id]
        
        # Learn from relevance feedback
        if feedback.get("relevant_items"):
            prefs["successful_queries"] = prefs.get("successful_queries", 0) + 1
        
        # Learn context preferences
        if feedback.get("needed_more_context"):
            prefs["prefers_more_context"] = True
        elif feedback.get("too_much_context"):
            prefs["prefers_concise"] = True
        
        # Learn content type preferences
        helpful_types = feedback.get("helpful_content_types", [])
        if helpful_types:
            type_prefs = prefs.get("preferred_content_types", defaultdict(int))
            for ct in helpful_types:
                type_prefs[ct] = type_prefs.get(ct, 0) + 1
            prefs["preferred_content_types"] = dict(type_prefs)
        
        logger.info(f"Updated preferences for user {user_id} based on feedback")
    
    async def auto_index_user_activity(self, user_id: str):
        """
        Automatically index user's recent activity.
        Called periodically to keep their RAG up-to-date.
        """
        if not self.db_session_factory:
            return
        
        try:
            from sqlalchemy import text
            session = self.db_session_factory()
            
            # Get numeric user ID
            try:
                numeric_user_id = int(user_id)
            except (ValueError, TypeError):
                result = session.execute(
                    text("SELECT id FROM users WHERE email = :email OR username = :email LIMIT 1"),
                    {"email": user_id}
                )
                numeric_user_id = result.scalar()
                if not numeric_user_id:
                    return
            
            # Index recent notes
            notes_query = text("""
                SELECT id, title, content, created_at
                FROM notes
                WHERE user_id = :user_id
                AND created_at > datetime('now', '-7 days')
                ORDER BY created_at DESC
                LIMIT 50
            """)
            notes = session.execute(notes_query, {"user_id": numeric_user_id}).fetchall()
            
            if notes:
                note_items = [
                    {
                        "id": n[0],
                        "title": n[1],
                        "content": n[2],
                        "created_at": n[3]
                    }
                    for n in notes if n[2]
                ]
                await self.index_user_content(user_id, "note", note_items)
            
            # Index recent flashcards
            flashcards_query = text("""
                SELECT f.id, f.question, f.answer, f.created_at
                FROM flashcards f
                JOIN flashcard_sets fs ON f.set_id = fs.id
                WHERE fs.user_id = :user_id
                AND f.created_at > datetime('now', '-7 days')
                ORDER BY f.created_at DESC
                LIMIT 50
            """)
            flashcards = session.execute(flashcards_query, {"user_id": numeric_user_id}).fetchall()
            
            if flashcards:
                card_items = [
                    {
                        "id": f[0],
                        "content": f"{f[1]} | {f[2]}",
                        "front": f[1],
                        "back": f[2],
                        "created_at": f[3]
                    }
                    for f in flashcards if f[1] and f[2]
                ]
                await self.index_user_content(user_id, "flashcard", card_items)
            
            # Index recent chat messages
            chat_query = text("""
                SELECT cm.id, cm.user_message, cm.ai_response, cm.timestamp
                FROM chat_messages cm
                JOIN chat_sessions cs ON cm.chat_session_id = cs.id
                WHERE cs.user_id = :user_id
                AND cm.timestamp > datetime('now', '-7 days')
                ORDER BY cm.timestamp DESC
                LIMIT 30
            """)
            chats = session.execute(chat_query, {"user_id": numeric_user_id}).fetchall()
            
            if chats:
                chat_items = [
                    {
                        "id": c[0],
                        "content": f"Q: {c[1]}\nA: {c[2]}",
                        "timestamp": c[3]
                    }
                    for c in chats if c[1] and c[2]
                ]
                await self.index_user_content(user_id, "chat", chat_items)
            
            # Index recent question sets
            questions_query = text("""
                SELECT qs.id, qs.title, qs.description, qs.created_at,
                       GROUP_CONCAT(q.question_text || ' | ' || q.correct_answer, '\n') as questions_content
                FROM question_sets qs
                LEFT JOIN questions q ON q.question_set_id = qs.id
                WHERE qs.user_id = :user_id
                AND qs.created_at > datetime('now', '-7 days')
                GROUP BY qs.id, qs.title, qs.description, qs.created_at
                ORDER BY qs.created_at DESC
                LIMIT 20
            """)
            question_sets = session.execute(questions_query, {"user_id": numeric_user_id}).fetchall()
            
            if question_sets:
                question_items = [
                    {
                        "id": qs[0],
                        "title": qs[1] or "Question Set",
                        "content": f"Title: {qs[1]}\nDescription: {qs[2] or ''}\n\nQuestions:\n{qs[4] or ''}",
                        "description": qs[2],
                        "created_at": qs[3]
                    }
                    for qs in question_sets if qs[4]  # Only if has questions
                ]
                await self.index_user_content(user_id, "question_bank", question_items)
            
            logger.info(f"Auto-indexed recent activity for user {user_id}")
            
        except Exception as e:
            logger.error(f"Auto-indexing failed for user {user_id}: {e}")
    
    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Get statistics about user's RAG system"""
        return {
            "indexed_items": len(self._user_indexed_content.get(user_id, set())),
            "retrieval_count": len(self._user_retrieval_history.get(user_id, [])),
            "has_collection": user_id in self._user_collections,
            "preferences": self._user_preferences.get(user_id, {}),
            "collection_name": self._get_user_collection_name(user_id)
        }
    
    async def clear_user_data(self, user_id: str):
        """Clear all RAG data for a user (GDPR compliance)"""
        try:
            # Delete collection
            if user_id in self._user_collections:
                collection_name = self._get_user_collection_name(user_id)
                self.base_vector_store.delete_collection(collection_name)
                del self._user_collections[user_id]
            
            # Clear history and preferences
            if user_id in self._user_retrieval_history:
                del self._user_retrieval_history[user_id]
            if user_id in self._user_indexed_content:
                del self._user_indexed_content[user_id]
            if user_id in self._user_preferences:
                del self._user_preferences[user_id]
            
            logger.info(f"Cleared all RAG data for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to clear data for user {user_id}: {e}")


# Global instance
_user_rag_manager: Optional[UserRAGManager] = None


def get_user_rag_manager() -> Optional[UserRAGManager]:
    """Get the global user RAG manager instance"""
    return _user_rag_manager


async def initialize_user_rag_manager(
    vector_store=None,
    embedding_model=None,
    ai_client=None,
    knowledge_graph=None,
    db_session_factory=None
) -> UserRAGManager:
    """Initialize the global user RAG manager"""
    global _user_rag_manager
    
    _user_rag_manager = UserRAGManager(
        base_vector_store=vector_store,
        embedding_model=embedding_model,
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        db_session_factory=db_session_factory
    )
    
    logger.info("User RAG Manager initialized globally")
    return _user_rag_manager
