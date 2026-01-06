"""
Unified Memory System
Central memory layer that provides context to all agents
"""

import logging
import json
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)


class MemoryType(str, Enum):
    """Types of memories stored"""
    # Interaction memories
    CONVERSATION = "conversation"      # Chat history
    QUESTION = "question"              # Questions asked
    EXPLANATION = "explanation"        # Explanations given
    
    # Content memories
    FLASHCARD = "flashcard"            # Flashcard interactions
    NOTE = "note"                      # Note interactions
    QUIZ = "quiz"                      # Quiz attempts
    
    # Learning memories
    CONCEPT_LEARNED = "concept_learned"
    CONCEPT_STRUGGLED = "concept_struggled"
    MISTAKE = "mistake"
    INSIGHT = "insight"
    
    # Preference memories
    PREFERENCE = "preference"
    LEARNING_PATTERN = "learning_pattern"
    
    # Context memories
    TOPIC_CONTEXT = "topic_context"
    SESSION_CONTEXT = "session_context"


@dataclass
class MemoryEntry:
    """A single memory entry"""
    id: str
    user_id: str
    memory_type: MemoryType
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None
    importance: float = 0.5  # 0-1 scale
    access_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_accessed: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    source_agent: str = ""
    related_memories: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["memory_type"] = self.memory_type.value
        data["created_at"] = self.created_at.isoformat()
        data["last_accessed"] = self.last_accessed.isoformat()
        if self.expires_at:
            data["expires_at"] = self.expires_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MemoryEntry':
        data["memory_type"] = MemoryType(data["memory_type"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["last_accessed"] = datetime.fromisoformat(data["last_accessed"])
        if data.get("expires_at"):
            data["expires_at"] = datetime.fromisoformat(data["expires_at"])
        return cls(**data)


class UnifiedMemory:
    """
    Unified Memory System - The "Brain" above all agents
    
    Provides:
    - Short-term memory (current session)
    - Long-term memory (persistent across sessions)
    - Working memory (active context for current task)
    - Episodic memory (specific interactions)
    - Semantic memory (learned concepts and relationships)
    """
    
    # Memory retention periods
    RETENTION_PERIODS = {
        MemoryType.CONVERSATION: timedelta(days=30),
        MemoryType.QUESTION: timedelta(days=90),
        MemoryType.EXPLANATION: timedelta(days=90),
        MemoryType.FLASHCARD: timedelta(days=365),
        MemoryType.NOTE: timedelta(days=365),
        MemoryType.QUIZ: timedelta(days=180),
        MemoryType.CONCEPT_LEARNED: timedelta(days=365),
        MemoryType.CONCEPT_STRUGGLED: timedelta(days=180),
        MemoryType.MISTAKE: timedelta(days=90),
        MemoryType.INSIGHT: timedelta(days=365),
        MemoryType.PREFERENCE: timedelta(days=730),
        MemoryType.LEARNING_PATTERN: timedelta(days=365),
        MemoryType.TOPIC_CONTEXT: timedelta(days=7),
        MemoryType.SESSION_CONTEXT: timedelta(hours=24),
    }
    
    def __init__(
        self,
        knowledge_graph=None,
        vector_store=None,
        db_session_factory=None
    ):
        self.knowledge_graph = knowledge_graph
        self.vector_store = vector_store
        self.db_session_factory = db_session_factory
        
        # In-memory stores (will be persisted)
        self._short_term: Dict[str, List[MemoryEntry]] = defaultdict(list)  # user_id -> memories
        self._working: Dict[str, Dict[str, Any]] = {}  # session_id -> context
        
        # Memory index for fast lookup
        self._index: Dict[str, Dict[str, List[str]]] = defaultdict(lambda: defaultdict(list))  # user_id -> type -> memory_ids
        
    
    def _generate_id(self, content: str, user_id: str) -> str:
        """Generate unique memory ID"""
        hash_input = f"{user_id}:{content}:{datetime.utcnow().isoformat()}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]
    
    # ==================== Core Memory Operations ====================
    
    async def store(
        self,
        user_id: str,
        memory_type: MemoryType,
        content: str,
        metadata: Dict[str, Any] = None,
        importance: float = 0.5,
        source_agent: str = "",
        tags: List[str] = None
    ) -> MemoryEntry:
        """Store a new memory"""
        memory_id = self._generate_id(content, user_id)
        
        # Calculate expiration
        retention = self.RETENTION_PERIODS.get(memory_type, timedelta(days=30))
        expires_at = datetime.utcnow() + retention
        
        entry = MemoryEntry(
            id=memory_id,
            user_id=user_id,
            memory_type=memory_type,
            content=content,
            metadata=metadata or {},
            importance=importance,
            source_agent=source_agent,
            tags=tags or [],
            expires_at=expires_at
        )
        
        # Store in short-term memory
        self._short_term[user_id].append(entry)
        self._index[user_id][memory_type.value].append(memory_id)
        
        # Store in knowledge graph for long-term
        if self.knowledge_graph:
            await self._persist_to_graph(entry)
        
        logger.debug(f"Stored memory {memory_id} for user {user_id}")
        return entry
    
    async def recall(
        self,
        user_id: str,
        query: str = None,
        memory_types: List[MemoryType] = None,
        limit: int = 10,
        min_importance: float = 0.0,
        include_expired: bool = False
    ) -> List[MemoryEntry]:
        """Recall memories based on query and filters"""
        memories = []
        now = datetime.utcnow()
        
        # Get from short-term memory
        user_memories = self._short_term.get(user_id, [])
        
        for memory in user_memories:
            # Filter by expiration
            if not include_expired and memory.expires_at and memory.expires_at < now:
                continue
            
            # Filter by type
            if memory_types and memory.memory_type not in memory_types:
                continue
            
            # Filter by importance
            if memory.importance < min_importance:
                continue
            
            # Score by relevance if query provided
            if query:
                relevance = self._calculate_relevance(memory, query)
                if relevance > 0.1:
                    memory.metadata["relevance_score"] = relevance
                    memories.append(memory)
            else:
                memories.append(memory)
        
        # Sort by relevance or recency
        if query:
            memories.sort(key=lambda m: m.metadata.get("relevance_score", 0), reverse=True)
        else:
            memories.sort(key=lambda m: m.last_accessed, reverse=True)
        
        # Update access counts
        for memory in memories[:limit]:
            memory.access_count += 1
            memory.last_accessed = now
        
        return memories[:limit]

    def _calculate_relevance(self, memory: MemoryEntry, query: str) -> float:
        """Calculate relevance score between memory and query"""
        query_words = set(query.lower().split())
        content_words = set(memory.content.lower().split())
        tag_words = set(tag.lower() for tag in memory.tags)
        
        # Word overlap
        content_overlap = len(query_words & content_words) / max(len(query_words), 1)
        tag_overlap = len(query_words & tag_words) / max(len(query_words), 1)
        
        # Recency boost
        age_days = (datetime.utcnow() - memory.created_at).days
        recency_score = max(0, 1 - (age_days / 30))
        
        # Importance weight
        importance_weight = memory.importance
        
        # Combined score
        score = (content_overlap * 0.5 + tag_overlap * 0.3 + recency_score * 0.1 + importance_weight * 0.1)
        return min(1.0, score)
    
    # ==================== Working Memory (Session Context) ====================
    
    def set_working_context(self, session_id: str, key: str, value: Any):
        """Set a value in working memory for current session"""
        if session_id not in self._working:
            self._working[session_id] = {
                "created_at": datetime.utcnow().isoformat(),
                "data": {}
            }
        self._working[session_id]["data"][key] = value
        self._working[session_id]["updated_at"] = datetime.utcnow().isoformat()
    
    def get_working_context(self, session_id: str, key: str = None) -> Any:
        """Get value(s) from working memory"""
        if session_id not in self._working:
            return None if key else {}
        
        if key:
            return self._working[session_id]["data"].get(key)
        return self._working[session_id]["data"]
    
    def clear_working_context(self, session_id: str):
        """Clear working memory for a session"""
        if session_id in self._working:
            del self._working[session_id]
    
    # ==================== Specialized Memory Operations ====================
    
    async def store_conversation(
        self,
        user_id: str,
        user_message: str,
        ai_response: str,
        session_id: str,
        topics: List[str] = None
    ) -> MemoryEntry:
        """Store a conversation exchange"""
        content = f"User: {user_message}\nAssistant: {ai_response}"
        
        return await self.store(
            user_id=user_id,
            memory_type=MemoryType.CONVERSATION,
            content=content,
            metadata={
                "user_message": user_message,
                "ai_response": ai_response,
                "session_id": session_id,
                "topics": topics or []
            },
            importance=0.5,
            source_agent="chat",
            tags=topics or []
        )
    
    async def store_concept_interaction(
        self,
        user_id: str,
        concept: str,
        interaction_type: Literal["learned", "struggled", "reviewed"],
        score: float = None,
        context: str = ""
    ) -> MemoryEntry:
        """Store interaction with a concept"""
        memory_type = (
            MemoryType.CONCEPT_LEARNED if interaction_type == "learned"
            else MemoryType.CONCEPT_STRUGGLED if interaction_type == "struggled"
            else MemoryType.CONCEPT_LEARNED
        )
        
        importance = 0.7 if interaction_type == "struggled" else 0.5
        
        return await self.store(
            user_id=user_id,
            memory_type=memory_type,
            content=f"Concept: {concept}. {context}",
            metadata={
                "concept": concept,
                "interaction_type": interaction_type,
                "score": score
            },
            importance=importance,
            tags=[concept]
        )
    
    async def store_learning_insight(
        self,
        user_id: str,
        insight: str,
        related_concepts: List[str] = None
    ) -> MemoryEntry:
        """Store a learning insight about the user"""
        return await self.store(
            user_id=user_id,
            memory_type=MemoryType.INSIGHT,
            content=insight,
            metadata={"related_concepts": related_concepts or []},
            importance=0.8,
            tags=related_concepts or []
        )
    
    async def store_preference(
        self,
        user_id: str,
        preference_type: str,
        value: Any,
        confidence: float = 0.5
    ) -> MemoryEntry:
        """Store a learned user preference"""
        return await self.store(
            user_id=user_id,
            memory_type=MemoryType.PREFERENCE,
            content=f"{preference_type}: {value}",
            metadata={
                "preference_type": preference_type,
                "value": value,
                "confidence": confidence
            },
            importance=0.6 + (confidence * 0.3),
            tags=[preference_type]
        )

    # ==================== Context Building ====================
    
    async def build_context(
        self,
        user_id: str,
        current_query: str,
        session_id: str = None,
        include_types: List[MemoryType] = None
    ) -> Dict[str, Any]:
        """
        Build comprehensive context for agents from all memory sources.
        This is the main method agents use to get context.
        """
        context = {
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "query": current_query,
            
            # Memory sections
            "recent_conversations": [],
            "relevant_memories": [],
            "user_preferences": {},
            "learning_state": {},
            "working_context": {},
            
            # Derived insights
            "topics_of_interest": [],
            "struggled_concepts": [],
            "strong_concepts": [],
            "suggested_focus": [],
            
            # Cross-session memory summary
            "session_history_summary": ""
        }
        
        # 0. Load memories from persistent storage if not already loaded
        # This ensures new sessions have access to old session memories
        if user_id not in self._short_term or len(self._short_term.get(user_id, [])) == 0:
            await self.load_from_graph(user_id)
        
        # 1. Get working context (current session)
        if session_id:
            context["working_context"] = self.get_working_context(session_id) or {}
        
        # 2. Get recent conversations (including from previous sessions)
        recent_convos = await self.recall(
            user_id=user_id,
            memory_types=[MemoryType.CONVERSATION],
            limit=10  # Increased to get more cross-session context
        )
        context["recent_conversations"] = [
            {
                "user": m.metadata.get("user_message", ""),
                "assistant": m.metadata.get("ai_response", ""),
                "topics": m.metadata.get("topics", []),
                "session_id": m.metadata.get("session_id", ""),
                "timestamp": m.created_at.isoformat() if hasattr(m, 'created_at') else ""
            }
            for m in recent_convos
        ]
        
        # 3. Build session history summary for cross-session context
        if recent_convos:
            session_topics = set()
            recent_questions = []
            for m in recent_convos:
                session_topics.update(m.metadata.get("topics", []))
                user_msg = m.metadata.get("user_message", "")
                if user_msg and len(recent_questions) < 5:
                    recent_questions.append(user_msg[:100])
            
            summary_parts = []
            if recent_questions:
                summary_parts.append(f"Recent questions you asked: {'; '.join(recent_questions[:3])}")
            if session_topics:
                summary_parts.append(f"Topics discussed: {', '.join(list(session_topics)[:10])}")
            
            context["session_history_summary"] = " | ".join(summary_parts) if summary_parts else ""
            
            logger.info(f"📝 Built session history summary with {len(recent_convos)} conversations, {len(session_topics)} topics")
        
        # 3. Get relevant memories based on query
        relevant = await self.recall(
            user_id=user_id,
            query=current_query,
            limit=10
        )
        context["relevant_memories"] = [
            {
                "type": m.memory_type.value,
                "content": m.content[:200],
                "relevance": m.metadata.get("relevance_score", 0),
                "tags": m.tags
            }
            for m in relevant
        ]
        
        # 4. Get user preferences
        preferences = await self.recall(
            user_id=user_id,
            memory_types=[MemoryType.PREFERENCE],
            limit=20
        )
        for pref in preferences:
            pref_type = pref.metadata.get("preference_type", "unknown")
            context["user_preferences"][pref_type] = pref.metadata.get("value")
        
        # 5. Get learning state
        struggled = await self.recall(
            user_id=user_id,
            memory_types=[MemoryType.CONCEPT_STRUGGLED],
            limit=10
        )
        context["struggled_concepts"] = [
            m.metadata.get("concept", "") for m in struggled
        ]
        
        learned = await self.recall(
            user_id=user_id,
            memory_types=[MemoryType.CONCEPT_LEARNED],
            min_importance=0.6,
            limit=10
        )
        context["strong_concepts"] = [
            m.metadata.get("concept", "") for m in learned
        ]
        
        # 6. Extract topics of interest from recent activity
        all_tags = []
        for m in recent_convos + relevant:
            all_tags.extend(m.tags)
        
        # Count tag frequency
        tag_counts = defaultdict(int)
        for tag in all_tags:
            tag_counts[tag] += 1
        
        context["topics_of_interest"] = sorted(
            tag_counts.keys(),
            key=lambda t: tag_counts[t],
            reverse=True
        )[:10]
        
        # 7. Suggest focus areas (struggled but not recently reviewed)
        context["suggested_focus"] = context["struggled_concepts"][:3]
        
        logger.debug(f"Built context with {len(context['relevant_memories'])} relevant memories")
        return context
    
    # ==================== Knowledge Graph Integration ====================
    
    async def _persist_to_graph(self, entry: MemoryEntry):
        """Persist memory to knowledge graph for long-term storage"""
        if not self.knowledge_graph:
            return
        
        try:
            # Store as a Memory node linked to User
            query = """
            MATCH (u:User {user_id: $user_id})
            CREATE (m:Memory {
                id: $id,
                type: $type,
                content: $content,
                importance: $importance,
                created_at: datetime($created_at),
                source_agent: $source_agent
            })
            CREATE (u)-[:HAS_MEMORY]->(m)
            
            WITH m
            UNWIND $tags as tag
            MERGE (t:Tag {name: tag})
            CREATE (m)-[:TAGGED_WITH]->(t)
            """
            
            async with self.knowledge_graph.session() as session:
                await session.run(query, {
                    "user_id": int(entry.user_id) if entry.user_id.isdigit() else 0,
                    "id": entry.id,
                    "type": entry.memory_type.value,
                    "content": entry.content[:500],
                    "importance": entry.importance,
                    "created_at": entry.created_at.isoformat(),
                    "source_agent": entry.source_agent,
                    "tags": entry.tags
                })
        except Exception as e:
            logger.error(f"Failed to persist memory to graph: {e}")
    
    async def load_from_graph(self, user_id: str, limit: int = 100):
        """Load memories from knowledge graph and database into short-term memory"""
        logger.info(f"🧠 Loading memories for user {user_id} from persistent storage...")
        
        # First try to load from knowledge graph
        if self.knowledge_graph:
            try:
                query = """
                MATCH (u:User {user_id: $user_id})-[:HAS_MEMORY]->(m:Memory)
                OPTIONAL MATCH (m)-[:TAGGED_WITH]->(t:Tag)
                RETURN m, collect(t.name) as tags
                ORDER BY m.created_at DESC
                LIMIT $limit
                """
                
                async with self.knowledge_graph.session() as session:
                    result = await session.run(query, {
                        "user_id": int(user_id) if user_id.isdigit() else 0,
                        "limit": limit
                    })
                    
                    records = await result.data()
                    
                    for record in records:
                        m = record["m"]
                        entry = MemoryEntry(
                            id=m["id"],
                            user_id=user_id,
                            memory_type=MemoryType(m["type"]),
                            content=m["content"],
                            importance=m["importance"],
                            source_agent=m.get("source_agent", ""),
                            tags=record["tags"],
                            created_at=datetime.fromisoformat(str(m["created_at"]).replace("Z", ""))
                        )
                        self._short_term[user_id].append(entry)
                    
                    logger.info(f"✅ Loaded {len(records)} memories from graph for user {user_id}")
                    
            except Exception as e:
                logger.error(f"❌ Failed to load memories from graph: {e}")
        
        # Also load from database ConversationMemory table
        if self.db_session_factory:
            try:
                from models import ConversationMemory, ChatMessage, ChatSession
                
                db = self.db_session_factory()
                try:
                    user_id_int = int(user_id) if user_id.isdigit() else 0
                    
                    # Load from ConversationMemory table
                    memories = db.query(ConversationMemory).filter(
                        ConversationMemory.user_id == user_id_int
                    ).order_by(ConversationMemory.created_at.desc()).limit(limit).all()
                    
                    logger.info(f"📚 Found {len(memories)} ConversationMemory records for user {user_id}")
                    
                    for mem in memories:
                        # Handle topic_tags which might be double-encoded as JSON string
                        topics = mem.topic_tags
                        if isinstance(topics, str):
                            try:
                                topics = json.loads(topics)
                            except:
                                topics = []
                        elif topics is None:
                            topics = []
                        
                        entry = MemoryEntry(
                            id=f"db_conv_{mem.id}",
                            user_id=user_id,
                            memory_type=MemoryType.CONVERSATION,
                            content=f"User: {mem.question}\nAssistant: {mem.answer}",
                            metadata={
                                "user_message": mem.question,
                                "ai_response": mem.answer,
                                "session_id": str(mem.session_id) if mem.session_id else "",
                                "topics": topics if isinstance(topics, list) else [],
                                "question_type": mem.question_type,
                                "emotional_context": mem.emotional_context
                            },
                            importance=0.5,
                            source_agent="chat",
                            tags=topics if isinstance(topics, list) else [],
                            created_at=mem.created_at or datetime.utcnow()
                        )
                        # Avoid duplicates
                        if not any(e.id == entry.id for e in self._short_term[user_id]):
                            self._short_term[user_id].append(entry)
                    
                    # Also load recent ChatMessages for more context
                    chat_messages = db.query(ChatMessage).filter(
                        ChatMessage.user_id == user_id_int
                    ).order_by(ChatMessage.timestamp.desc()).limit(limit).all()
                    
                    logger.info(f"💬 Found {len(chat_messages)} ChatMessage records for user {user_id}")
                    
                    for msg in chat_messages:
                        entry = MemoryEntry(
                            id=f"db_chat_{msg.id}",
                            user_id=user_id,
                            memory_type=MemoryType.CONVERSATION,
                            content=f"User: {msg.user_message}\nAssistant: {msg.ai_response}",
                            metadata={
                                "user_message": msg.user_message,
                                "ai_response": msg.ai_response,
                                "session_id": str(msg.chat_session_id) if msg.chat_session_id else "",
                                "topics": []
                            },
                            importance=0.5,
                            source_agent="chat",
                            tags=[],
                            created_at=msg.timestamp or datetime.utcnow()
                        )
                        # Avoid duplicates
                        if not any(e.id == entry.id for e in self._short_term[user_id]):
                            self._short_term[user_id].append(entry)
                    
                    total_loaded = len(self._short_term[user_id])
                    logger.info(f"✅ Total memories loaded for user {user_id}: {total_loaded}")
                    
                finally:
                    db.close()
                    
            except Exception as e:
                logger.error(f"❌ Failed to load memories from database: {e}")
                import traceback
                logger.error(traceback.format_exc())
    
    # ==================== Memory Maintenance ====================
    
    async def consolidate(self, user_id: str):
        """Consolidate and clean up memories"""
        now = datetime.utcnow()
        
        # Remove expired memories
        self._short_term[user_id] = [
            m for m in self._short_term[user_id]
            if not m.expires_at or m.expires_at > now
        ]
        
        # Boost importance of frequently accessed memories
        for memory in self._short_term[user_id]:
            if memory.access_count > 5:
                memory.importance = min(1.0, memory.importance + 0.1)
        
        logger.info(f"Consolidated memories for user {user_id}")
    
    def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get memory statistics for a user"""
        memories = self._short_term.get(user_id, [])
        
        type_counts = defaultdict(int)
        for m in memories:
            type_counts[m.memory_type.value] += 1
        
        return {
            "total_memories": len(memories),
            "by_type": dict(type_counts),
            "avg_importance": sum(m.importance for m in memories) / max(len(memories), 1),
            "working_sessions": len(self._working)
        }


