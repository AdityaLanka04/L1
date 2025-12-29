"""
Knowledge Graph Tools
Tools for agents to query and update the knowledge graph
"""

import logging
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Global reference to knowledge graph (set during initialization)
_kg_client = None

def set_knowledge_graph(kg_client):
    global _kg_client
    _kg_client = kg_client


@tool
async def get_user_mastery(user_id: int, concepts: List[str]) -> Dict[str, float]:
    """
    Get user's mastery levels for specific concepts.
    Use this to understand what the user already knows.
    
    Args:
        user_id: The user's ID
        concepts: List of concept names to check
    
    Returns:
        Dictionary mapping concept names to mastery levels (0.0 to 1.0)
    """
    if not _kg_client:
        return {}
    try:
        return await _kg_client.get_user_mastery(user_id, concepts)
    except Exception as e:
        logger.error(f"Error getting user mastery: {e}")
        return {}


@tool
async def find_related_concepts(text: str, limit: int = 10) -> List[str]:
    """
    Find concepts related to the given text.
    Use this to discover relevant topics for the user's query.
    
    Args:
        text: The text to find related concepts for
        limit: Maximum number of concepts to return
    
    Returns:
        List of related concept names
    """
    if not _kg_client:
        return []
    try:
        return await _kg_client.get_related_concepts(text, limit)
    except Exception as e:
        logger.error(f"Error finding related concepts: {e}")
        return []


@tool
async def get_concept_prerequisites(concept: str) -> List[str]:
    """
    Get prerequisite concepts that should be learned before this concept.
    Use this to identify knowledge gaps.
    
    Args:
        concept: The concept name
    
    Returns:
        List of prerequisite concept names
    """
    if not _kg_client:
        return []
    try:
        return await _kg_client.get_concept_prerequisites(concept)
    except Exception as e:
        logger.error(f"Error getting prerequisites: {e}")
        return []


@tool
async def update_user_mastery(user_id: int, concept: str, correct: bool) -> str:
    """
    Update user's mastery of a concept after they answer a question.
    Use this to track learning progress.
    
    Args:
        user_id: The user's ID
        concept: The concept name
        correct: Whether the user answered correctly
    
    Returns:
        Confirmation message
    """
    if not _kg_client:
        return "Knowledge graph not available"
    try:
        delta = 0.1 if correct else -0.05
        await _kg_client.update_user_mastery(user_id, concept, delta, correct)
        return f"Updated mastery for {concept}: {'increased' if correct else 'decreased'}"
    except Exception as e:
        logger.error(f"Error updating mastery: {e}")
        return f"Error: {str(e)}"


@tool
async def get_learning_context(text: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Get comprehensive learning context for a query.
    Includes related concepts, user mastery, and prerequisites.
    
    Args:
        text: The user's query
        user_id: Optional user ID for personalized context
    
    Returns:
        Dictionary with related_concepts, user_mastery, prerequisites
    """
    if not _kg_client:
        return {"related_concepts": [], "user_mastery": {}, "prerequisites": []}
    try:
        return await _kg_client.get_context(text, user_id)
    except Exception as e:
        logger.error(f"Error getting learning context: {e}")
        return {"related_concepts": [], "user_mastery": {}, "prerequisites": []}


@tool
async def create_concept(name: str, domain: str, description: str, keywords: List[str]) -> str:
    """
    Create a new concept in the knowledge graph.
    Use this when discovering new topics from user content.
    
    Args:
        name: Concept name
        domain: Subject domain (e.g., "biology", "mathematics")
        description: Brief description
        keywords: Related keywords for search
    
    Returns:
        Confirmation message
    """
    if not _kg_client:
        return "Knowledge graph not available"
    try:
        await _kg_client.create_concept({
            "name": name,
            "domain": domain,
            "description": description,
            "subdomain": "",
            "difficulty": 0.5,
            "keywords": keywords
        })
        return f"Created concept: {name}"
    except Exception as e:
        logger.error(f"Error creating concept: {e}")
        return f"Error: {str(e)}"


class KnowledgeGraphTools:
    """Collection of knowledge graph tools for agents"""
    
    def __init__(self, kg_client=None):
        if kg_client:
            set_knowledge_graph(kg_client)
    
    @staticmethod
    def get_tools():
        """Get all knowledge graph tools"""
        return [
            get_user_mastery,
            find_related_concepts,
            get_concept_prerequisites,
            update_user_mastery,
            get_learning_context,
            create_concept
        ]
