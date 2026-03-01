"""
Agent API module for knowledge graph interactions
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_user_kg_instance = None

class UserKnowledgeGraph:
    """User knowledge graph for tracking concept interactions"""
    
    def __init__(self):
        self.enabled = False
        try:
            from tutor import neo4j_store
            self.enabled = neo4j_store.available()
            self.neo4j = neo4j_store if self.enabled else None
        except Exception as e:
            logger.warning(f"UserKG initialization failed: {e}")
            self.enabled = False
    
    async def record_concept_interaction(
        self,
        user_id: int,
        concept: str,
        correct: bool,
        source: str = "quiz",
        difficulty: float = 0.5
    ):
        """Record a concept interaction in the knowledge graph"""
        if not self.enabled:
            return
        
        try:
            if self.neo4j:
                await self.neo4j.record_interaction(
                    user_id=str(user_id),
                    concept=concept,
                    correct=correct,
                    source=source,
                    difficulty=difficulty
                )
        except Exception as e:
            logger.warning(f"Failed to record concept interaction: {e}")

def get_user_kg() -> Optional[UserKnowledgeGraph]:
    """Get or create the user knowledge graph instance"""
    global _user_kg_instance
    if _user_kg_instance is None:
        _user_kg_instance = UserKnowledgeGraph()
    return _user_kg_instance if _user_kg_instance.enabled else None
