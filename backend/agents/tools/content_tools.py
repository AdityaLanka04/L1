"""
Content Tools
Tools for agents to create and manage learning content
"""

import logging
import json
from typing import Dict, Any, List, Optional
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Global references
_db_session_factory = None
_ai_client = None

def set_content_dependencies(db_session_factory=None, ai_client=None):
    global _db_session_factory, _ai_client
    _db_session_factory = db_session_factory
    _ai_client = ai_client


@tool
def generate_flashcards(content: str, num_cards: int = 5, difficulty: str = "medium") -> List[Dict[str, str]]:
    """
    Generate flashcards from content using AI.
    Use this to create study materials from text.
    
    Args:
        content: Source content to create flashcards from
        num_cards: Number of flashcards to generate
        difficulty: easy, medium, or hard
    
    Returns:
        List of flashcards with front and back
    """
    if not _ai_client:
        return []
    
    prompt = f"""Create {num_cards} flashcards from this content. Difficulty: {difficulty}

Content: {content[:2000]}

Return JSON array only:
[{{"front": "question", "back": "answer"}}]
"""
    
    try:
        response = _ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
        
        # Parse JSON
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        cards = json.loads(json_str)
        return cards if isinstance(cards, list) else []
    except Exception as e:
        logger.error(f"Error generating flashcards: {e}")
        return []


@tool
def generate_quiz_questions(topic: str, num_questions: int = 5, difficulty: str = "medium") -> List[Dict[str, Any]]:
    """
    Generate quiz questions on a topic using AI.
    Use this to create practice tests.
    
    Args:
        topic: Topic for questions
        num_questions: Number of questions
        difficulty: easy, medium, or hard
    
    Returns:
        List of questions with options and correct answer
    """
    if not _ai_client:
        return []
    
    prompt = f"""Create {num_questions} multiple choice questions about: {topic}
Difficulty: {difficulty}

Return JSON array only:
[{{"question": "...", "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"], "correct": 0, "explanation": "..."}}]

CRITICAL: Each option MUST contain the FULL ANSWER TEXT, not just letter labels like "A", "B", "C", "D".
"""
    
    try:
        response = _ai_client.generate(prompt, max_tokens=1500, temperature=0.7)
        
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        questions = json.loads(json_str)
        return questions if isinstance(questions, list) else []
    except Exception as e:
        logger.error(f"Error generating quiz: {e}")
        return []


@tool
def summarize_content(content: str, style: str = "bullet_points") -> str:
    """
    Summarize content in different styles.
    Use this to create concise study notes.
    
    Args:
        content: Content to summarize
        style: bullet_points, paragraph, or key_concepts
    
    Returns:
        Summarized content
    """
    if not _ai_client:
        return "AI client not available"
    
    style_instructions = {
        "bullet_points": "Use bullet points for key ideas",
        "paragraph": "Write a concise paragraph summary",
        "key_concepts": "List the main concepts with brief explanations"
    }
    
    prompt = f"""Summarize this content for studying. {style_instructions.get(style, '')}

Content: {content[:3000]}

Summary:"""
    
    try:
        return _ai_client.generate(prompt, max_tokens=500, temperature=0.5)
    except Exception as e:
        logger.error(f"Error summarizing: {e}")
        return f"Error: {str(e)}"


@tool
def extract_concepts(content: str) -> List[Dict[str, str]]:
    """
    Extract key concepts from content.
    Use this to identify topics for the knowledge graph.
    
    Args:
        content: Content to analyze
    
    Returns:
        List of concepts with name, domain, and description
    """
    if not _ai_client:
        return []
    
    prompt = f"""Extract key concepts from this educational content.

Content: {content[:2000]}

Return JSON array:
[{{"name": "concept name", "domain": "subject area", "description": "brief description"}}]
"""
    
    try:
        response = _ai_client.generate(prompt, max_tokens=500, temperature=0.3)
        
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        concepts = json.loads(json_str)
        return concepts if isinstance(concepts, list) else []
    except Exception as e:
        logger.error(f"Error extracting concepts: {e}")
        return []


@tool
def explain_concept(concept: str, user_level: str = "intermediate", learning_style: str = "mixed") -> str:
    """
    Explain a concept tailored to user's level and learning style.
    Use this for personalized explanations.
    
    Args:
        concept: Concept to explain
        user_level: beginner, intermediate, or advanced
        learning_style: visual, auditory, kinesthetic, or mixed
    
    Returns:
        Personalized explanation
    """
    if not _ai_client:
        return "AI client not available"
    
    style_hints = {
        "visual": "Use diagrams descriptions, examples you can visualize, and clear formatting",
        "auditory": "Use conversational tone, analogies, and rhythm in explanations",
        "kinesthetic": "Include hands-on examples, real-world applications, and interactive elements",
        "mixed": "Balance different explanation styles"
    }
    
    prompt = f"""Explain "{concept}" for a {user_level} learner.
Learning style preference: {learning_style}
{style_hints.get(learning_style, '')}

Provide a clear, educational explanation:"""
    
    try:
        return _ai_client.generate(prompt, max_tokens=800, temperature=0.7)
    except Exception as e:
        logger.error(f"Error explaining concept: {e}")
        return f"Error: {str(e)}"


@tool
def generate_study_plan(topics: List[str], available_hours: int, goal: str) -> Dict[str, Any]:
    """
    Generate a personalized study plan.
    Use this to help users organize their learning.
    
    Args:
        topics: List of topics to study
        available_hours: Hours available per week
        goal: Learning goal (e.g., "exam prep", "deep understanding")
    
    Returns:
        Study plan with schedule and recommendations
    """
    if not _ai_client:
        return {}
    
    prompt = f"""Create a study plan:
Topics: {', '.join(topics)}
Available time: {available_hours} hours/week
Goal: {goal}

Return JSON:
{{"weekly_schedule": [{{"day": "Monday", "topics": [], "duration_hours": 1}}], "recommendations": [], "milestones": []}}
"""
    
    try:
        response = _ai_client.generate(prompt, max_tokens=800, temperature=0.7)
        
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"Error generating study plan: {e}")
        return {"error": str(e)}


class ContentTools:
    """Collection of content creation tools for agents"""
    
    def __init__(self, db_session_factory=None, ai_client=None):
        set_content_dependencies(db_session_factory, ai_client)
    
    @staticmethod
    def get_tools():
        """Get all content tools"""
        return [
            generate_flashcards,
            generate_quiz_questions,
            summarize_content,
            extract_concepts,
            explain_concept,
            generate_study_plan
        ]

