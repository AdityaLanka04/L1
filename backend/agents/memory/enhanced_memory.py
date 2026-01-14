"""
Enhanced Memory System
Long-term memory with cross-session persistence, semantic search, and memory consolidation.

Features:
- Cross-session memory persistence
- Semantic memory search with embeddings
- Memory importance decay and consolidation
- Episodic memory for specific interactions
- Procedural memory for learned patterns
"""

import logging
import json
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import numpy as np

logger = logging.getLogger(__name__)


class MemoryPriority(str, Enum):
    """Memory priority levels for retention"""
    CRITICAL = "critical"      # Never forget (user preferences, key insights)
    HIGH = "high"              # Long retention (learned concepts, achievements)
    MEDIUM = "medium"          # Standard retention (conversations, interactions)
    LOW = "low"                # Short retention (temporary context)
    EPHEMERAL = "ephemeral"    # Session only


@dataclass
class EnhancedMemoryEntry:
    """Enhanced memory entry with additional metadata for long-term storage"""
    id: str
    user_id: str
    memory_type: str
    content: str
    embedding: Optional[List[float]] = None
    
    # Importance and decay
    importance: float = 0.5
    priority: MemoryPriority = MemoryPriority.MEDIUM
    decay_rate: float = 0.01  # Daily decay
    
    # Access patterns
    access_count: int = 0
    last_accessed: datetime = field(default_factory=datetime.utcnow)
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Relationships
    related_memories: List[str] = field(default_factory=list)
    source_memories: List[str] = field(default_factory=list)  # Memories this was derived from
    
    # Context
    session_id: Optional[str] = None
    source_agent: str = ""
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Consolidation
    is_consolidated: bool = False
    consolidation_count: int = 0
    
    def get_current_importance(self) -> float:
        """Calculate current importance with decay"""
        days_old = (datetime.utcnow() - self.created_at).days
        decay = self.decay_rate * days_old
        
        # Boost for frequent access
        access_boost = min(0.3, self.access_count * 0.02)
        
        # Priority multiplier
        priority_mult = {
            MemoryPriority.CRITICAL: 1.0,
            MemoryPriority.HIGH: 0.9,
            MemoryPriority.MEDIUM: 0.7,
            MemoryPriority.LOW: 0.5,
            MemoryPriority.EPHEMERAL: 0.2
        }.get(self.priority, 0.7)
        
        return max(0.1, min(1.0, (self.importance - decay + access_boost) * priority_mult))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "memory_type": self.memory_type,
            "content": self.content,
            "importance": self.importance,
            "priority": self.priority.value,
            "access_count": self.access_count,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "tags": self.tags,
            "metadata": self.metadata,
            "is_consolidated": self.is_consolidated
        }


class EpisodicMemory:
    """
    Episodic Memory - Stores specific interaction episodes.
    Good for remembering specific conversations, events, and experiences.
    """
    
    def __init__(self, max_episodes: int = 1000):
        self.episodes: Dict[str, List[EnhancedMemoryEntry]] = defaultdict(list)
        self.max_episodes = max_episodes
    
    def store_episode(
        self,
        user_id: str,
        episode_type: str,
        content: str,
        context: Dict[str, Any] = None,
        importance: float = 0.5
    ) -> EnhancedMemoryEntry:
        """Store a specific episode/event"""
        episode_id = hashlib.sha256(
            f"{user_id}:{content}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:16]
        
        entry = EnhancedMemoryEntry(
            id=episode_id,
            user_id=user_id,
            memory_type=f"episode:{episode_type}",
            content=content,
            importance=importance,
            metadata=context or {},
            priority=MemoryPriority.MEDIUM
        )
        
        self.episodes[user_id].append(entry)
        
        # Trim old episodes if needed
        if len(self.episodes[user_id]) > self.max_episodes:
            # Remove lowest importance episodes
            self.episodes[user_id].sort(
                key=lambda e: e.get_current_importance(),
                reverse=True
            )
            self.episodes[user_id] = self.episodes[user_id][:self.max_episodes]
        
        return entry
    
    def recall_episodes(
        self,
        user_id: str,
        episode_type: str = None,
        query: str = None,
        limit: int = 10
    ) -> List[EnhancedMemoryEntry]:
        """Recall episodes matching criteria"""
        episodes = self.episodes.get(user_id, [])
        
        if episode_type:
            episodes = [e for e in episodes if episode_type in e.memory_type]
        
        if query:
            # Simple keyword matching (would use embeddings in production)
            query_words = set(query.lower().split())
            scored = []
            for ep in episodes:
                content_words = set(ep.content.lower().split())
                overlap = len(query_words & content_words)
                if overlap > 0:
                    scored.append((ep, overlap))
            scored.sort(key=lambda x: x[1], reverse=True)
            episodes = [ep for ep, _ in scored]
        
        # Sort by recency and importance
        episodes.sort(
            key=lambda e: (e.get_current_importance(), e.last_accessed),
            reverse=True
        )
        
        return episodes[:limit]


class SemanticMemory:
    """
    Semantic Memory - Stores learned facts, concepts, and relationships.
    Good for knowledge that should persist long-term.
    """
    
    def __init__(self):
        self.concepts: Dict[str, Dict[str, EnhancedMemoryEntry]] = defaultdict(dict)
        self.relationships: Dict[str, List[Tuple[str, str, str]]] = defaultdict(list)
    
    def store_concept(
        self,
        user_id: str,
        concept_name: str,
        description: str,
        related_concepts: List[str] = None,
        mastery_level: float = 0.0
    ) -> EnhancedMemoryEntry:
        """Store a learned concept"""
        concept_id = hashlib.sha256(
            f"{user_id}:concept:{concept_name}".encode()
        ).hexdigest()[:16]
        
        entry = EnhancedMemoryEntry(
            id=concept_id,
            user_id=user_id,
            memory_type="semantic:concept",
            content=description,
            importance=0.6 + (mastery_level * 0.3),
            priority=MemoryPriority.HIGH,
            decay_rate=0.005,  # Slow decay for concepts
            tags=[concept_name] + (related_concepts or []),
            metadata={
                "concept_name": concept_name,
                "mastery_level": mastery_level,
                "related_concepts": related_concepts or []
            }
        )
        
        self.concepts[user_id][concept_name] = entry
        
        # Store relationships
        for related in (related_concepts or []):
            self.relationships[user_id].append((concept_name, "RELATED_TO", related))
        
        return entry
    
    def get_concept(self, user_id: str, concept_name: str) -> Optional[EnhancedMemoryEntry]:
        """Get a specific concept"""
        return self.concepts.get(user_id, {}).get(concept_name)
    
    def get_related_concepts(self, user_id: str, concept_name: str) -> List[str]:
        """Get concepts related to a given concept"""
        related = []
        for c1, rel, c2 in self.relationships.get(user_id, []):
            if c1 == concept_name:
                related.append(c2)
            elif c2 == concept_name:
                related.append(c1)
        return list(set(related))
    
    def update_mastery(self, user_id: str, concept_name: str, delta: float):
        """Update mastery level for a concept"""
        if concept_name in self.concepts.get(user_id, {}):
            entry = self.concepts[user_id][concept_name]
            current = entry.metadata.get("mastery_level", 0.0)
            entry.metadata["mastery_level"] = max(0.0, min(1.0, current + delta))
            entry.importance = 0.6 + (entry.metadata["mastery_level"] * 0.3)


class ProceduralMemory:
    """
    Procedural Memory - Stores learned patterns and behaviors.
    Good for remembering how to do things and user preferences.
    """
    
    def __init__(self):
        self.patterns: Dict[str, Dict[str, EnhancedMemoryEntry]] = defaultdict(dict)
        self.preferences: Dict[str, Dict[str, Any]] = defaultdict(dict)
    
    def store_pattern(
        self,
        user_id: str,
        pattern_name: str,
        pattern_data: Dict[str, Any],
        confidence: float = 0.5
    ) -> EnhancedMemoryEntry:
        """Store a learned pattern"""
        pattern_id = hashlib.sha256(
            f"{user_id}:pattern:{pattern_name}".encode()
        ).hexdigest()[:16]
        
        entry = EnhancedMemoryEntry(
            id=pattern_id,
            user_id=user_id,
            memory_type="procedural:pattern",
            content=json.dumps(pattern_data),
            importance=0.5 + (confidence * 0.4),
            priority=MemoryPriority.HIGH,
            decay_rate=0.002,  # Very slow decay
            metadata={
                "pattern_name": pattern_name,
                "confidence": confidence,
                **pattern_data
            }
        )
        
        self.patterns[user_id][pattern_name] = entry
        return entry
    
    def store_preference(
        self,
        user_id: str,
        preference_key: str,
        preference_value: Any,
        confidence: float = 0.5
    ):
        """Store a user preference"""
        self.preferences[user_id][preference_key] = {
            "value": preference_value,
            "confidence": confidence,
            "updated_at": datetime.utcnow().isoformat()
        }
    
    def get_preference(self, user_id: str, preference_key: str) -> Optional[Any]:
        """Get a user preference"""
        pref = self.preferences.get(user_id, {}).get(preference_key)
        return pref["value"] if pref else None
    
    def get_all_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get all preferences for a user"""
        return {k: v["value"] for k, v in self.preferences.get(user_id, {}).items()}


class MemoryConsolidator:
    """
    Consolidates and compresses memories over time.
    Merges similar memories, extracts insights, and manages memory lifecycle.
    """
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def consolidate_conversations(
        self,
        memories: List[EnhancedMemoryEntry],
        max_consolidated: int = 5
    ) -> List[EnhancedMemoryEntry]:
        """Consolidate multiple conversation memories into summaries"""
        if len(memories) < 3:
            return memories
        
        # Group by topic/tags
        topic_groups: Dict[str, List[EnhancedMemoryEntry]] = defaultdict(list)
        for mem in memories:
            primary_tag = mem.tags[0] if mem.tags else "general"
            topic_groups[primary_tag].append(mem)
        
        consolidated = []
        for topic, group in topic_groups.items():
            if len(group) >= 3:
                # Create consolidated memory
                combined_content = "\n".join([m.content[:200] for m in group[:10]])
                
                # Generate summary if AI client available
                if self.ai_client:
                    try:
                        summary = self.ai_client.generate(
                            f"Summarize these conversation snippets about {topic} in 2-3 sentences:\n{combined_content}",
                            max_tokens=150
                        )
                    except:
                        summary = f"Multiple conversations about {topic}"
                else:
                    summary = f"Multiple conversations about {topic}: {len(group)} interactions"
                
                consolidated_entry = EnhancedMemoryEntry(
                    id=f"consolidated_{topic}_{datetime.utcnow().strftime('%Y%m%d')}",
                    user_id=group[0].user_id,
                    memory_type="consolidated:conversation",
                    content=summary,
                    importance=max(m.importance for m in group),
                    priority=MemoryPriority.HIGH,
                    decay_rate=0.005,
                    tags=[topic],
                    metadata={
                        "source_count": len(group),
                        "source_ids": [m.id for m in group],
                        "date_range": {
                            "start": min(m.created_at for m in group).isoformat(),
                            "end": max(m.created_at for m in group).isoformat()
                        }
                    },
                    is_consolidated=True,
                    consolidation_count=1,
                    source_memories=[m.id for m in group]
                )
                consolidated.append(consolidated_entry)
            else:
                consolidated.extend(group)
        
        return consolidated[:max_consolidated * 2]
    
    def extract_insights(
        self,
        memories: List[EnhancedMemoryEntry]
    ) -> List[Dict[str, Any]]:
        """Extract insights from a collection of memories"""
        insights = []
        
        # Analyze patterns
        tag_counts = defaultdict(int)
        for mem in memories:
            for tag in mem.tags:
                tag_counts[tag] += 1
        
        # Top interests
        top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        if top_tags:
            insights.append({
                "type": "interest_pattern",
                "content": f"Most discussed topics: {', '.join(t[0] for t in top_tags)}",
                "confidence": 0.8
            })
        
        # Learning patterns
        struggled = [m for m in memories if "struggled" in m.memory_type]
        learned = [m for m in memories if "learned" in m.memory_type]
        
        if struggled:
            struggled_concepts = [m.tags[0] for m in struggled if m.tags][:5]
            insights.append({
                "type": "struggle_pattern",
                "content": f"Areas needing attention: {', '.join(struggled_concepts)}",
                "confidence": 0.7
            })
        
        if learned:
            learned_concepts = [m.tags[0] for m in learned if m.tags][:5]
            insights.append({
                "type": "strength_pattern",
                "content": f"Strong areas: {', '.join(learned_concepts)}",
                "confidence": 0.7
            })
        
        return insights


class EnhancedMemorySystem:
    """
    Main enhanced memory system combining all memory types.
    Provides unified interface for memory operations.
    """
    
    def __init__(
        self,
        ai_client=None,
        knowledge_graph=None,
        vector_store=None,
        db_session_factory=None
    ):
        self.ai_client = ai_client
        self.knowledge_graph = knowledge_graph
        self.vector_store = vector_store
        self.db_session_factory = db_session_factory
        
        # Memory subsystems
        self.episodic = EpisodicMemory()
        self.semantic = SemanticMemory()
        self.procedural = ProceduralMemory()
        self.consolidator = MemoryConsolidator(ai_client)
        
        # Cross-session storage
        self._long_term: Dict[str, List[EnhancedMemoryEntry]] = defaultdict(list)
        self._session_memories: Dict[str, List[EnhancedMemoryEntry]] = defaultdict(list)
    
    async def store(
        self,
        user_id: str,
        memory_type: str,
        content: str,
        importance: float = 0.5,
        priority: MemoryPriority = MemoryPriority.MEDIUM,
        tags: List[str] = None,
        metadata: Dict[str, Any] = None,
        session_id: str = None,
        persist: bool = True
    ) -> EnhancedMemoryEntry:
        """Store a memory with enhanced metadata"""
        memory_id = hashlib.sha256(
            f"{user_id}:{content}:{datetime.utcnow().isoformat()}".encode()
        ).hexdigest()[:16]
        
        entry = EnhancedMemoryEntry(
            id=memory_id,
            user_id=user_id,
            memory_type=memory_type,
            content=content,
            importance=importance,
            priority=priority,
            tags=tags or [],
            metadata=metadata or {},
            session_id=session_id
        )
        
        # Store in appropriate subsystem
        if "episode" in memory_type or "conversation" in memory_type:
            self.episodic.store_episode(
                user_id, memory_type, content,
                context=metadata, importance=importance
            )
        elif "concept" in memory_type or "semantic" in memory_type:
            concept_name = (tags[0] if tags else 
                          metadata.get("concept_name", "unknown"))
            self.semantic.store_concept(
                user_id, concept_name, content,
                related_concepts=tags[1:] if len(tags) > 1 else None
            )
        elif "pattern" in memory_type or "preference" in memory_type:
            if "preference" in memory_type:
                pref_key = metadata.get("preference_key", tags[0] if tags else "unknown")
                self.procedural.store_preference(
                    user_id, pref_key, metadata.get("value", content)
                )
        
        # Store in long-term memory
        self._long_term[user_id].append(entry)
        
        if session_id:
            self._session_memories[session_id].append(entry)
        
        # Persist to knowledge graph
        if persist and self.knowledge_graph:
            await self._persist_to_graph(entry)
        
        return entry
    
    async def recall(
        self,
        user_id: str,
        query: str = None,
        memory_types: List[str] = None,
        limit: int = 10,
        min_importance: float = 0.0,
        include_consolidated: bool = True,
        session_id: str = None
    ) -> List[EnhancedMemoryEntry]:
        """Recall memories with enhanced filtering"""
        memories = []
        
        # Get from long-term memory
        user_memories = self._long_term.get(user_id, [])
        
        # Filter by session if specified
        if session_id:
            session_mems = self._session_memories.get(session_id, [])
            user_memories = list(set(user_memories + session_mems))
        
        for mem in user_memories:
            # Filter by type
            if memory_types and not any(t in mem.memory_type for t in memory_types):
                continue
            
            # Filter by importance
            if mem.get_current_importance() < min_importance:
                continue
            
            # Filter consolidated
            if not include_consolidated and mem.is_consolidated:
                continue
            
            # Score by relevance
            if query:
                relevance = self._calculate_relevance(mem, query)
                if relevance > 0.1:
                    mem.metadata["relevance_score"] = relevance
                    memories.append(mem)
            else:
                memories.append(mem)
        
        # Sort by relevance or importance
        if query:
            memories.sort(key=lambda m: m.metadata.get("relevance_score", 0), reverse=True)
        else:
            memories.sort(key=lambda m: m.get_current_importance(), reverse=True)
        
        # Update access counts
        for mem in memories[:limit]:
            mem.access_count += 1
            mem.last_accessed = datetime.utcnow()
        
        return memories[:limit]
    
    def _calculate_relevance(self, memory: EnhancedMemoryEntry, query: str) -> float:
        """Calculate relevance score"""
        query_words = set(query.lower().split())
        content_words = set(memory.content.lower().split())
        tag_words = set(t.lower() for t in memory.tags)
        
        content_overlap = len(query_words & content_words) / max(len(query_words), 1)
        tag_overlap = len(query_words & tag_words) / max(len(query_words), 1)
        
        # Recency boost
        age_days = (datetime.utcnow() - memory.created_at).days
        recency_score = max(0, 1 - (age_days / 30))
        
        return (content_overlap * 0.5 + tag_overlap * 0.3 + 
                recency_score * 0.1 + memory.get_current_importance() * 0.1)
    
    async def consolidate_user_memories(self, user_id: str):
        """Consolidate memories for a user"""
        memories = self._long_term.get(user_id, [])
        
        # Get old, unconsolidated memories
        old_memories = [
            m for m in memories
            if not m.is_consolidated and 
            (datetime.utcnow() - m.created_at).days > 7
        ]
        
        if len(old_memories) >= 5:
            consolidated = self.consolidator.consolidate_conversations(old_memories)
            
            # Replace old memories with consolidated ones
            self._long_term[user_id] = [
                m for m in memories if m not in old_memories
            ] + consolidated
            
            logger.info(f"Consolidated {len(old_memories)} memories into {len(consolidated)} for user {user_id}")
    
    async def get_user_insights(self, user_id: str) -> List[Dict[str, Any]]:
        """Get insights about a user from their memories"""
        memories = self._long_term.get(user_id, [])
        return self.consolidator.extract_insights(memories)
    
    async def _persist_to_graph(self, entry: EnhancedMemoryEntry):
        """Persist memory to knowledge graph"""
        if not self.knowledge_graph:
            return
        
        try:
            query = """
            MERGE (u:User {user_id: $user_id})
            CREATE (m:EnhancedMemory {
                id: $id,
                type: $type,
                content: $content,
                importance: $importance,
                priority: $priority,
                created_at: datetime($created_at),
                is_consolidated: $is_consolidated
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
                    "type": entry.memory_type,
                    "content": entry.content[:500],
                    "importance": entry.importance,
                    "priority": entry.priority.value,
                    "created_at": entry.created_at.isoformat(),
                    "is_consolidated": entry.is_consolidated,
                    "tags": entry.tags
                })
        except Exception as e:
            logger.error(f"Failed to persist enhanced memory: {e}")
    
    async def load_user_memories(self, user_id: str, limit: int = 200):
        """Load user memories from persistent storage"""
        if self._long_term.get(user_id):
            return  # Already loaded
        
        # Load from knowledge graph
        if self.knowledge_graph:
            try:
                query = """
                MATCH (u:User {user_id: $user_id})-[:HAS_MEMORY]->(m:EnhancedMemory)
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
                        entry = EnhancedMemoryEntry(
                            id=m["id"],
                            user_id=user_id,
                            memory_type=m["type"],
                            content=m["content"],
                            importance=m["importance"],
                            priority=MemoryPriority(m.get("priority", "medium")),
                            tags=record["tags"],
                            is_consolidated=m.get("is_consolidated", False),
                            created_at=datetime.fromisoformat(
                                str(m["created_at"]).replace("Z", "")
                            )
                        )
                        self._long_term[user_id].append(entry)
                    
                    logger.info(f"Loaded {len(records)} enhanced memories for user {user_id}")
                    
            except Exception as e:
                logger.error(f"Failed to load enhanced memories: {e}")
    
    def get_stats(self, user_id: str) -> Dict[str, Any]:
        """Get memory statistics"""
        memories = self._long_term.get(user_id, [])
        
        type_counts = defaultdict(int)
        for m in memories:
            type_counts[m.memory_type] += 1
        
        return {
            "total_memories": len(memories),
            "by_type": dict(type_counts),
            "consolidated_count": sum(1 for m in memories if m.is_consolidated),
            "avg_importance": sum(m.get_current_importance() for m in memories) / max(len(memories), 1),
            "episodic_count": len(self.episodic.episodes.get(user_id, [])),
            "semantic_concepts": len(self.semantic.concepts.get(user_id, {})),
            "preferences_count": len(self.procedural.preferences.get(user_id, {}))
        }
