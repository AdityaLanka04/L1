"""
Memory Manager
High-level interface for the Unified Memory System
Provides easy access for all agents and API endpoints
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .unified_memory import UnifiedMemory, MemoryType, MemoryEntry

logger = logging.getLogger(__name__)

# Singleton instance
_memory_manager: Optional['MemoryManager'] = None


class MemoryManager:
    """
    High-level memory manager that provides:
    - Simple API for agents to store/recall memories
    - Context building for any agent
    - Cross-agent memory sharing
    - User learning profile management
    """
    
    def __init__(
        self,
        knowledge_graph=None,
        vector_store=None,
        db_session_factory=None
    ):
        self.memory = UnifiedMemory(
            knowledge_graph=knowledge_graph,
            vector_store=vector_store,
            db_session_factory=db_session_factory
        )
        self._user_profiles: Dict[str, Dict[str, Any]] = {}
        
    
    # ==================== Context API (Main Interface for Agents) ====================
    
    async def get_context_for_agent(
        self,
        user_id: str,
        agent_type: str,
        query: str,
        session_id: str = None
    ) -> Dict[str, Any]:
        """
        Get context tailored for a specific agent type.
        This is the main method agents should use.
        """
        # Build base context
        base_context = await self.memory.build_context(
            user_id=user_id,
            current_query=query,
            session_id=session_id
        )
        
        # Add agent-specific context
        agent_context = await self._get_agent_specific_context(
            user_id, agent_type, query
        )
        
        # Merge contexts
        context = {
            **base_context,
            "agent_type": agent_type,
            "agent_context": agent_context
        }
        
        return context
    
    async def _get_agent_specific_context(
        self,
        user_id: str,
        agent_type: str,
        query: str
    ) -> Dict[str, Any]:
        """Get context specific to an agent type"""
        
        if agent_type == "flashcard":
            # Get flashcard-related memories
            flashcard_memories = await self.memory.recall(
                user_id=user_id,
                memory_types=[MemoryType.FLASHCARD],
                query=query,
                limit=5
            )
            return {
                "recent_flashcard_topics": [m.tags for m in flashcard_memories],
                "flashcard_performance": self._get_flashcard_performance(user_id)
            }
        
        elif agent_type == "chat":
            # Get conversation context
            return {
                "conversation_style": self._user_profiles.get(user_id, {}).get("conversation_style", "balanced"),
                "explanation_depth": self._user_profiles.get(user_id, {}).get("explanation_depth", "medium")
            }
        
        elif agent_type == "quiz":
            # Get quiz-related context
            quiz_memories = await self.memory.recall(
                user_id=user_id,
                memory_types=[MemoryType.QUIZ],
                limit=10
            )
            return {
                "recent_quiz_topics": list(set(
                    tag for m in quiz_memories for tag in m.tags
                )),
                "avg_quiz_score": self._calculate_avg_score(quiz_memories)
            }
        
        elif agent_type == "notes":
            # Get notes context
            note_memories = await self.memory.recall(
                user_id=user_id,
                memory_types=[MemoryType.NOTE],
                query=query,
                limit=5
            )
            return {
                "related_notes": [m.content[:100] for m in note_memories]
            }
        
        return {}
    
    def _get_flashcard_performance(self, user_id: str) -> Dict[str, float]:
        """Calculate flashcard performance metrics"""
        # Placeholder - would calculate from actual data
        return {"retention_rate": 0.75, "review_consistency": 0.6}
    
    def _calculate_avg_score(self, memories: List[MemoryEntry]) -> float:
        """Calculate average score from quiz memories"""
        scores = [m.metadata.get("score", 0) for m in memories if m.metadata.get("score")]
        return sum(scores) / max(len(scores), 1)

    # ==================== Memory Storage API ====================
    
    async def remember_conversation(
        self,
        user_id: str,
        user_message: str,
        ai_response: str,
        session_id: str,
        agent_type: str = "chat",
        topics: List[str] = None
    ):
        """Store a conversation exchange"""
        await self.memory.store_conversation(
            user_id=user_id,
            user_message=user_message,
            ai_response=ai_response,
            session_id=session_id,
            topics=topics
        )
        
        # Update working context
        self.memory.set_working_context(session_id, "last_exchange", {
            "user": user_message,
            "assistant": ai_response,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Update topics in working context
        current_topics = self.memory.get_working_context(session_id, "session_topics") or []
        if topics:
            current_topics.extend(topics)
            self.memory.set_working_context(session_id, "session_topics", list(set(current_topics)))
    
    async def remember_flashcard_interaction(
        self,
        user_id: str,
        flashcard_id: int,
        front: str,
        back: str,
        correct: bool,
        response_time_ms: int = None
    ):
        """Store a flashcard review interaction"""
        await self.memory.store(
            user_id=user_id,
            memory_type=MemoryType.FLASHCARD,
            content=f"Reviewed: {front[:50]}... -> {'Correct' if correct else 'Incorrect'}",
            metadata={
                "flashcard_id": flashcard_id,
                "front": front,
                "back": back,
                "correct": correct,
                "response_time_ms": response_time_ms
            },
            importance=0.6 if not correct else 0.4,
            source_agent="flashcard",
            tags=self._extract_topics(front + " " + back)
        )
        
        # Store concept interaction
        concepts = self._extract_topics(front + " " + back)
        for concept in concepts[:3]:
            await self.memory.store_concept_interaction(
                user_id=user_id,
                concept=concept,
                interaction_type="learned" if correct else "struggled",
                score=1.0 if correct else 0.0
            )
    
    async def remember_quiz_attempt(
        self,
        user_id: str,
        quiz_topic: str,
        score: float,
        questions_count: int,
        wrong_concepts: List[str] = None
    ):
        """Store a quiz attempt"""
        await self.memory.store(
            user_id=user_id,
            memory_type=MemoryType.QUIZ,
            content=f"Quiz on {quiz_topic}: {score*100:.0f}% ({int(score*questions_count)}/{questions_count})",
            metadata={
                "topic": quiz_topic,
                "score": score,
                "questions_count": questions_count,
                "wrong_concepts": wrong_concepts or []
            },
            importance=0.7 if score < 0.6 else 0.5,
            source_agent="quiz",
            tags=[quiz_topic] + (wrong_concepts or [])
        )
        
        # Store struggled concepts
        for concept in (wrong_concepts or []):
            await self.memory.store_concept_interaction(
                user_id=user_id,
                concept=concept,
                interaction_type="struggled",
                score=0.0,
                context=f"Missed in quiz on {quiz_topic}"
            )
    
    async def remember_note_interaction(
        self,
        user_id: str,
        note_id: int,
        title: str,
        action: str,  # "created", "edited", "viewed"
        content_preview: str = ""
    ):
        """Store a note interaction"""
        await self.memory.store(
            user_id=user_id,
            memory_type=MemoryType.NOTE,
            content=f"Note '{title}' {action}",
            metadata={
                "note_id": note_id,
                "title": title,
                "action": action,
                "content_preview": content_preview[:200]
            },
            importance=0.5 if action == "viewed" else 0.6,
            source_agent="notes",
            tags=self._extract_topics(title + " " + content_preview)
        )
    
    def _extract_topics(self, text: str) -> List[str]:
        """Extract topic keywords from text"""
        # Simple keyword extraction - could be enhanced with NLP
        stop_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
                      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
                      'could', 'should', 'may', 'might', 'must', 'shall', 'can',
                      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
                      'as', 'into', 'through', 'during', 'before', 'after', 'above',
                      'below', 'between', 'under', 'again', 'further', 'then', 'once',
                      'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
                      'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just'}
        
        words = text.lower().split()
        topics = [w for w in words if len(w) > 3 and w not in stop_words]
        return list(set(topics))[:10]

    # ==================== User Profile Management ====================
    
    async def update_user_profile(
        self,
        user_id: str,
        updates: Dict[str, Any]
    ):
        """Update user learning profile"""
        if user_id not in self._user_profiles:
            self._user_profiles[user_id] = {}
        
        self._user_profiles[user_id].update(updates)
        
        # Store as preferences
        for key, value in updates.items():
            await self.memory.store_preference(
                user_id=user_id,
                preference_type=key,
                value=value,
                confidence=0.7
            )
    
    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user learning profile"""
        # Load from preferences if not in cache
        if user_id not in self._user_profiles:
            preferences = await self.memory.recall(
                user_id=user_id,
                memory_types=[MemoryType.PREFERENCE],
                limit=50
            )
            
            profile = {}
            for pref in preferences:
                pref_type = pref.metadata.get("preference_type")
                if pref_type:
                    profile[pref_type] = pref.metadata.get("value")
            
            self._user_profiles[user_id] = profile
        
        return self._user_profiles.get(user_id, {})
    
    async def learn_from_interaction(
        self,
        user_id: str,
        interaction_data: Dict[str, Any]
    ):
        """Learn user preferences from interaction patterns"""
        # Analyze interaction to learn preferences
        
        # Example: Learn explanation depth preference
        if "response_length" in interaction_data:
            length = interaction_data["response_length"]
            if length > 500:
                await self.update_user_profile(user_id, {"explanation_depth": "detailed"})
            elif length < 200:
                await self.update_user_profile(user_id, {"explanation_depth": "concise"})
        
        # Example: Learn topic interests
        if "topics" in interaction_data:
            current_interests = self._user_profiles.get(user_id, {}).get("topic_interests", [])
            new_interests = list(set(current_interests + interaction_data["topics"]))[:20]
            await self.update_user_profile(user_id, {"topic_interests": new_interests})
    
    # ==================== Working Memory API ====================
    
    def set_session_context(self, session_id: str, key: str, value: Any):
        """Set context for current session"""
        self.memory.set_working_context(session_id, key, value)
    
    def get_session_context(self, session_id: str, key: str = None) -> Any:
        """Get context from current session"""
        return self.memory.get_working_context(session_id, key)
    
    def end_session(self, session_id: str):
        """Clean up session context"""
        self.memory.clear_working_context(session_id)
    
    # ==================== Analytics ====================
    
    def get_memory_stats(self, user_id: str) -> Dict[str, Any]:
        """Get memory statistics for a user"""
        return self.memory.get_stats(user_id)
    
    async def get_learning_summary(self, user_id: str) -> Dict[str, Any]:
        """Get a summary of user's learning journey"""
        context = await self.memory.build_context(user_id, "")
        
        return {
            "topics_studied": context.get("topics_of_interest", []),
            "strong_areas": context.get("strong_concepts", []),
            "areas_to_improve": context.get("struggled_concepts", []),
            "suggested_focus": context.get("suggested_focus", []),
            "preferences": context.get("user_preferences", {}),
            "memory_stats": self.get_memory_stats(user_id)
        }
    
    # ==================== Maintenance ====================
    
    async def consolidate_memories(self, user_id: str):
        """Consolidate and clean up user memories"""
        await self.memory.consolidate(user_id)
    
    async def load_user_memories(self, user_id: str):
        """Load user memories from persistent storage"""
        await self.memory.load_from_graph(user_id)


# ==================== Singleton Access ====================

def get_memory_manager() -> Optional[MemoryManager]:
    """Get the global memory manager instance"""
    return _memory_manager


async def initialize_memory_manager(
    knowledge_graph=None,
    vector_store=None,
    db_session_factory=None
) -> MemoryManager:
    """Initialize the global memory manager"""
    global _memory_manager
    
    _memory_manager = MemoryManager(
        knowledge_graph=knowledge_graph,
        vector_store=vector_store,
        db_session_factory=db_session_factory
    )
    
    return _memory_manager


