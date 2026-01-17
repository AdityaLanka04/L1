"""
SearchHub Agent - The Ultimate One-Sentence Command Center
LangGraph-based agent that handles ANY learning action from a single sentence.

Features:
- Natural language intent detection
- Auto-creates content (notes, flashcards, questions) with full content
- Returns navigation data to redirect user to created content
- Personalized recommendations
- Semantic search across all content types
- AI-powered topic exploration
- Smart autocomplete with context awareness
"""

import logging
import json
import re
import random
import string
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager

logger = logging.getLogger(__name__)


# ==================== Knowledge Graph Integration ====================

class KnowledgeGraphIntegration:
    """Integrates knowledge graph data into SearchHub responses"""
    
    def __init__(self, user_knowledge_graph=None, master_agent=None):
        self.user_kg = user_knowledge_graph
        self.master_agent = master_agent
    
    async def get_weak_areas(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get user's weak areas from knowledge graph"""
        result = {
            "weak_concepts": [],
            "domain_weaknesses": {},
            "recommendations": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            # Get weak concepts
            weak = await self.user_kg.get_weak_concepts(user_id, threshold=0.5, limit=limit)
            result["weak_concepts"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "classification": m.mastery_classification.value,
                    "review_count": m.review_count,
                    "streak": m.streak
                }
                for m in weak
            ]
            
            # Get domain mastery to find weak domains
            domain_mastery = await self.user_kg.get_domain_mastery(user_id)
            result["domain_weaknesses"] = {
                domain: data for domain, data in domain_mastery.items()
                if data.get("average_mastery", 1.0) < 0.5
            }
            
            # Generate recommendations
            for concept_data in result["weak_concepts"][:5]:
                result["recommendations"].append({
                    "action": f"create flashcards on {concept_data['concept']}",
                    "reason": f"Your mastery is {concept_data['mastery']:.0%} - needs practice"
                })
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get weak areas: {e}")
        
        return result
    
    async def get_strong_areas(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get user's strong areas from knowledge graph"""
        result = {
            "strong_concepts": [],
            "domain_strengths": {},
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            # Get strong concepts
            strong = await self.user_kg.get_strong_concepts(user_id, threshold=0.7, limit=limit)
            result["strong_concepts"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "classification": m.mastery_classification.value,
                    "review_count": m.review_count,
                    "streak": m.streak
                }
                for m in strong
            ]
            
            # Get domain mastery to find strong domains
            domain_mastery = await self.user_kg.get_domain_mastery(user_id)
            result["domain_strengths"] = {
                domain: data for domain, data in domain_mastery.items()
                if data.get("average_mastery", 0) >= 0.7
            }
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get strong areas: {e}")
        
        return result
    
    async def get_knowledge_gaps(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Find knowledge gaps - concepts user should learn next"""
        result = {
            "gaps": [],
            "recommended_learning_path": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            gaps = await self.user_kg.find_knowledge_gaps(user_id, limit=limit)
            result["gaps"] = gaps
            
            # Generate learning path from gaps
            for gap in gaps[:5]:
                result["recommended_learning_path"].append({
                    "concept": gap.get("concept"),
                    "reason": gap.get("reason", "Based on your current knowledge"),
                    "action": f"explain {gap.get('concept')}"
                })
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get knowledge gaps: {e}")
        
        return result
    
    async def get_concepts_to_review(self, user_id: int, days: int = 7, limit: int = 10) -> Dict[str, Any]:
        """Get concepts that need review based on spaced repetition"""
        result = {
            "concepts_to_review": [],
            "overdue_count": 0,
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            concepts = await self.user_kg.get_concepts_needing_review(user_id, days, limit)
            result["concepts_to_review"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "last_reviewed": m.last_reviewed.isoformat() if m.last_reviewed else "Never"
                }
                for m in concepts
            ]
            result["overdue_count"] = len(concepts)
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get concepts to review: {e}")
        
        return result
    
    async def get_learning_analytics(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive learning analytics"""
        result = {
            "summary": {},
            "mastery_distribution": {},
            "domain_breakdown": {},
            "recommendations": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            analytics = await self.user_kg.get_learning_analytics(user_id)
            result.update(analytics)
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get learning analytics: {e}")
        
        return result
    
    async def get_recommended_topics(self, user_id: int, limit: int = 5) -> Dict[str, Any]:
        """Get recommended topics based on learning progress"""
        result = {
            "recommended_topics": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            topics = await self.user_kg.get_recommended_topics(user_id, limit)
            result["recommended_topics"] = topics
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get recommended topics: {e}")
        
        return result
    
    async def get_learning_path(self, user_id: int, topic: str) -> Dict[str, Any]:
        """Get personalized learning path for a topic"""
        result = {
            "topic": topic,
            "concepts": [],
            "estimated_time_hours": 0,
            "prerequisites_met": True,
            "missing_prerequisites": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            path = await self.user_kg.get_learning_path(user_id, topic)
            result["concepts"] = path.concepts
            result["estimated_time_hours"] = path.estimated_time_hours
            result["prerequisites_met"] = path.prerequisites_met
            result["missing_prerequisites"] = path.missing_prerequisites
            result["difficulty"] = path.difficulty
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get learning path: {e}")
        
        return result
    
    async def get_full_user_context(self, user_id: str) -> Dict[str, Any]:
        """Get full user context from master agent"""
        if not self.master_agent:
            return {}
        
        try:
            # Use master agent's aggregator
            context = await self.master_agent.aggregator.get_full_user_context(user_id)
            return context
        except Exception as e:
            logger.error(f"Failed to get full user context: {e}")
            return {}


# ==================== Enums & Types ====================

class SearchHubAction(str, Enum):
    """All actions SearchHub can perform"""
    # Content Creation
    CREATE_NOTE = "create_note"
    CREATE_FLASHCARDS = "create_flashcards"
    CREATE_QUESTIONS = "create_questions"
    CREATE_QUIZ = "create_quiz"
    CREATE_ROADMAP = "create_roadmap"
    
    # Content Search
    SEARCH_ALL = "search_all"
    SEARCH_NOTES = "search_notes"
    SEARCH_FLASHCARDS = "search_flashcards"
    SEARCH_QUESTIONS = "search_questions"
    
    # AI Exploration
    EXPLAIN_TOPIC = "explain_topic"
    EXPLORE_TOPIC = "explore_topic"
    SUMMARIZE_TOPIC = "summarize_topic"
    
    # Learning Actions
    REVIEW_FLASHCARDS = "review_flashcards"
    TAKE_QUIZ = "take_quiz"
    SHOW_PROGRESS = "show_progress"
    SHOW_WEAK_AREAS = "show_weak_areas"
    SHOW_STRONG_AREAS = "show_strong_areas"
    SHOW_ACHIEVEMENTS = "show_achievements"
    
    # Knowledge Graph / Adaptive Learning
    DETECT_LEARNING_STYLE = "detect_learning_style"
    SHOW_KNOWLEDGE_GAPS = "show_knowledge_gaps"
    SHOW_CONCEPTS_TO_REVIEW = "show_concepts_to_review"
    SHOW_LEARNING_ANALYTICS = "show_learning_analytics"
    SHOW_RECOMMENDED_TOPICS = "show_recommended_topics"
    GET_LEARNING_PATH = "get_learning_path"
    OPTIMIZE_RETENTION = "optimize_retention"
    PREDICT_FORGETTING = "predict_forgetting"
    SUGGEST_NEXT_TOPIC = "suggest_next_topic"
    ADAPT_DIFFICULTY = "adapt_difficulty"
    GET_FULL_CONTEXT = "get_full_context"
    
    # Social
    FIND_STUDY_TWIN = "find_study_twin"
    BROWSE_PUBLIC = "browse_public"
    
    # Chat
    START_CHAT = "start_chat"
    ASK_AI = "ask_ai"


class ContentType(str, Enum):
    """Types of content that can be created/searched"""
    NOTE = "note"
    FLASHCARD_SET = "flashcard_set"
    QUESTION_SET = "question_set"
    QUIZ = "quiz"
    ROADMAP = "roadmap"
    CHAT = "chat"


# ==================== State Definition ====================

class SearchHubState(TypedDict, total=False):
    """State for the SearchHub agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Intent detection
    detected_action: str
    action_confidence: float
    extracted_topic: str
    extracted_params: Dict[str, Any]
    
    # Content creation
    created_content: Dict[str, Any]
    content_id: int
    content_type: str
    
    # Search results
    search_results: List[Dict[str, Any]]
    search_query: str
    search_filters: Dict[str, Any]
    
    # AI generation
    ai_response: str
    ai_suggestions: List[str]
    related_topics: List[str]
    
    # Knowledge Graph data
    kg_weak_areas: Dict[str, Any]
    kg_strong_areas: Dict[str, Any]
    kg_knowledge_gaps: Dict[str, Any]
    kg_concepts_to_review: Dict[str, Any]
    kg_learning_analytics: Dict[str, Any]
    kg_recommended_topics: Dict[str, Any]
    kg_learning_path: Dict[str, Any]
    kg_full_context: Dict[str, Any]
    
    # Navigation
    navigate_to: str
    navigate_params: Dict[str, Any]
    
    # Memory context
    memory_context: Dict[str, Any]
    user_preferences: Dict[str, Any]
    personalized_prompts: List[Dict[str, Any]]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Intent Detector ====================

class IntentDetector:
    """Detects user intent from natural language"""
    
    # Pattern-based intent detection
    INTENT_PATTERNS = {
        # ============ KNOWLEDGE GRAPH PATTERNS (check first - most specific) ============
        SearchHubAction.SHOW_WEAK_AREAS: [
            r"(?:what\s+are\s+)?(?:my\s+)?weak\s+(?:areas?|spots?|points?|concepts?|topics?)",
            r"show\s+(?:my\s+)?weak\s+(?:areas?|concepts?|topics?)",
            r"what\s+am\s+i\s+weak\s+(?:in|at|on)",
            r"where\s+(?:do\s+)?i\s+(?:need\s+(?:help|improvement)|struggle)",
            r"what\s+(?:do\s+)?i\s+need\s+to\s+(?:work\s+on|improve)",
            r"struggling\s+(?:with|in|at)",
            r"areas?\s+(?:needing|for)\s+improvement",
            r"where\s+am\s+i\s+struggling",
            r"my\s+weaknesses",
        ],
        SearchHubAction.SHOW_STRONG_AREAS: [
            r"(?:what\s+are\s+)?(?:my\s+)?strong\s+(?:areas?|points?|concepts?|topics?)",
            r"show\s+(?:my\s+)?strong\s+(?:areas?|concepts?|topics?)",
            r"what\s+am\s+i\s+(?:good|strong)\s+(?:in|at|on)",
            r"where\s+(?:do\s+)?i\s+excel",
            r"my\s+strengths?",
            r"what\s+(?:do\s+)?i\s+know\s+(?:well|best)",
        ],
        SearchHubAction.SHOW_KNOWLEDGE_GAPS: [
            r"(?:show\s+)?(?:my\s+)?knowledge\s+gaps?",
            r"what\s+(?:am\s+i\s+missing|don'?t\s+i\s+know)",
            r"find\s+(?:my\s+)?(?:blind\s+spots?|gaps?)",
            r"what\s+should\s+i\s+learn\s+next",
            r"gaps?\s+in\s+(?:my\s+)?knowledge",
            r"missing\s+(?:knowledge|concepts?)",
        ],
        SearchHubAction.SHOW_CONCEPTS_TO_REVIEW: [
            r"(?:what|which)\s+(?:concepts?|topics?)\s+(?:should\s+i|to|do\s+i\s+need\s+to)\s+review",
            r"show\s+(?:concepts?|topics?)\s+to\s+review",
            r"what\s+(?:do\s+)?i\s+need\s+to\s+review",
            r"overdue\s+(?:concepts?|reviews?)",
            r"spaced\s+repetition",
            r"what'?s\s+due\s+for\s+review",
            r"review\s+schedule",
        ],
        SearchHubAction.SHOW_LEARNING_ANALYTICS: [
            r"(?:show\s+)?(?:my\s+)?learning\s+(?:analytics?|stats?|statistics?)",
            r"(?:my\s+)?study\s+(?:stats?|statistics?|analytics?)",
            r"how\s+(?:am\s+i|have\s+i\s+been)\s+(?:doing|learning|progressing)",
            r"(?:my\s+)?mastery\s+(?:levels?|distribution)",
            r"learning\s+(?:summary|overview|report)",
            r"my\s+(?:learning\s+)?analytics",
        ],
        SearchHubAction.SHOW_RECOMMENDED_TOPICS: [
            r"(?:show\s+)?recommended\s+topics?",
            r"what\s+(?:topics?|subjects?)\s+(?:should\s+i|do\s+you\s+recommend)",
            r"suggest\s+(?:some\s+)?topics?",
            r"topic\s+recommendations?",
            r"what\s+to\s+(?:study|learn)\s+next",
        ],
        SearchHubAction.GET_LEARNING_PATH: [
            r"(?:show\s+)?learning\s+path\s+(?:for|on|about)\s+(.+)",
            r"how\s+(?:should\s+i|to)\s+learn\s+(.+)",
            r"roadmap\s+(?:for|to\s+learn)\s+(.+)",
            r"study\s+plan\s+(?:for|on)\s+(.+)",
        ],
        SearchHubAction.GET_FULL_CONTEXT: [
            r"(?:show\s+)?(?:my\s+)?(?:full\s+)?(?:learning\s+)?(?:context|profile|dashboard)",
            r"everything\s+about\s+(?:my\s+)?learning",
            r"(?:my\s+)?complete\s+(?:learning\s+)?(?:profile|overview)",
            r"my\s+learning\s+(?:profile|dashboard)",
        ],
        SearchHubAction.DETECT_LEARNING_STYLE: [
            r"(?:what\s+is\s+)?(?:my\s+)?learning\s+style",
            r"how\s+do\s+i\s+learn\s+(?:best)?",
            r"detect\s+(?:my\s+)?learning\s+style",
            r"(?:my\s+)?learning\s+(?:style|preference)",
            r"what\s+(?:kind|type)\s+of\s+learner\s+am\s+i",
        ],
        SearchHubAction.PREDICT_FORGETTING: [
            r"what\s+will\s+i\s+forget",
            r"predict\s+(?:what\s+i'?ll\s+)?forget",
            r"forgetting\s+curve",
            r"what\s+(?:am\s+i\s+)?(?:about\s+to|going\s+to)\s+forget",
        ],
        SearchHubAction.SUGGEST_NEXT_TOPIC: [
            r"what\s+should\s+i\s+(?:study|learn)\s+next",
            r"suggest\s+(?:a\s+)?(?:next\s+)?topic",
            r"recommend\s+(?:a\s+)?topic",
            r"next\s+topic",
            r"what'?s\s+next",
        ],
        
        # ============ CREATION PATTERNS ============
        SearchHubAction.CREATE_NOTE: [
            r"create\s+(?:a\s+)?note\s+(?:on|about)\s+(.+)",
            r"make\s+(?:a\s+)?note\s+(?:on|about)\s+(.+)",
            r"write\s+(?:a\s+)?note\s+(?:on|about)\s+(.+)",
            r"new\s+note\s+(?:on|about)\s+(.+)",
            r"note\s+(?:on|about)\s+(.+)",
        ],
        SearchHubAction.CREATE_FLASHCARDS: [
            r"create\s+(?:\d+\s+)?flashcards?\s+(?:on|about|for)\s+(.+)",
            r"make\s+(?:\d+\s+)?flashcards?\s+(?:on|about|for)\s+(.+)",
            r"generate\s+(?:\d+\s+)?flashcards?\s+(?:on|about|for)\s+(.+)",
            r"flashcards?\s+(?:on|about|for)\s+(.+)",
            r"(\d+)\s+flashcards?\s+(?:on|about|for)\s+(.+)",
        ],
        SearchHubAction.CREATE_QUESTIONS: [
            r"create\s+(?:\d+\s+)?questions?\s+(?:on|about|for)\s+(.+)",
            r"make\s+(?:\d+\s+)?questions?\s+(?:on|about|for)\s+(.+)",
            r"generate\s+(?:\d+\s+)?questions?\s+(?:on|about|for)\s+(.+)",
            r"questions?\s+(?:on|about|for)\s+(.+)",
        ],
        SearchHubAction.CREATE_QUIZ: [
            r"create\s+(?:a\s+)?quiz\s+(?:on|about)\s+(.+)",
            r"make\s+(?:a\s+)?quiz\s+(?:on|about)\s+(.+)",
            r"quiz\s+me\s+(?:on|about)\s+(.+)",
            r"test\s+me\s+(?:on|about)\s+(.+)",
        ],
        
        # ============ EXPLANATION PATTERNS (more generic - check later) ============
        SearchHubAction.EXPLAIN_TOPIC: [
            r"explain\s+(.+?)(?:\s+to\s+me)?(?:\s+step.by.step)?$",
            r"what\s+is\s+(?!my\s+(?:learning\s+style|weak|strong|knowledge|progress|profile|dashboard))(.+)",  # Exclude personal queries
            r"what\s+are\s+(?!my\s+(?:weak|strong|knowledge|learning|recommended|concepts))(.+)",  # Exclude personal queries
            r"how\s+does\s+(.+)\s+work",
            r"how\s+do\s+(?!i\s+learn)(.+)\s+work",  # Exclude "how do i learn"
            r"tell\s+me\s+about\s+(?!my\s+)(.+)",  # Exclude "tell me about my..."
            r"teach\s+me\s+(?:about\s+)?(.+)",
        ],
        
        # Review patterns
        SearchHubAction.REVIEW_FLASHCARDS: [
            r"review\s+(?:my\s+)?flashcards?",
            r"study\s+(?:my\s+)?flashcards?",
            r"practice\s+(?:my\s+)?flashcards?",
            r"review\s+weak\s+(?:flashcards?|cards?)",
        ],
        
        # Progress patterns
        SearchHubAction.SHOW_PROGRESS: [
            r"show\s+(?:my\s+)?progress",
            r"my\s+progress",
            r"how\s+am\s+i\s+doing",
            r"my\s+stats",
            r"my\s+statistics",
        ],
        SearchHubAction.SHOW_ACHIEVEMENTS: [
            r"show\s+(?:my\s+)?achievements?",
            r"my\s+achievements?",
            r"my\s+badges?",
            r"what\s+have\s+i\s+earned",
        ],
        
        # Adaptive learning patterns (navigation-based)
        SearchHubAction.OPTIMIZE_RETENTION: [
            r"optimize\s+(?:my\s+)?retention",
            r"improve\s+(?:my\s+)?retention",
            r"retention\s+schedule",
        ],
        SearchHubAction.ADAPT_DIFFICULTY: [
            r"adapt\s+(?:the\s+)?difficulty",
            r"adjust\s+(?:the\s+)?difficulty",
            r"change\s+(?:the\s+)?difficulty\s+(?:level|to)",
        ],
        SearchHubAction.FIND_STUDY_TWIN: [
            r"find\s+(?:my\s+)?study\s+twin",
            r"find\s+(?:a\s+)?study\s+(?:partner|buddy)",
            r"study\s+twin",
        ],
        
        # Chat patterns
        SearchHubAction.START_CHAT: [
            r"chat\s+(?:about|with)\s+(.+)",
            r"talk\s+(?:about|to\s+me\s+about)\s+(.+)",
            r"discuss\s+(.+)",
            r"let'?s\s+(?:talk|chat|discuss)\s+(?:about\s+)?(.+)",
        ],
        SearchHubAction.ASK_AI: [
            r"ask\s+(?:ai|cerbyl)\s+(.+)",
            r"ai\s+(.+)",
        ],
        
        # Search patterns (fallback)
        SearchHubAction.SEARCH_ALL: [
            r"search\s+(?:for\s+)?(.+)",
            r"find\s+(.+)",
            r"look\s+(?:for|up)\s+(.+)",
        ],
    }
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def detect(self, user_input: str) -> Dict[str, Any]:
        """Detect intent and extract parameters from user input"""
        input_lower = user_input.lower().strip()
        
        # Try pattern matching first
        for action, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, input_lower, re.IGNORECASE)
                if match:
                    topic = match.group(1) if match.groups() else ""
                    
                    # Extract count if present (e.g., "10 flashcards")
                    count_match = re.search(r'(\d+)\s+(?:flashcards?|questions?|cards?)', input_lower)
                    count = int(count_match.group(1)) if count_match else 10
                    
                    return {
                        "action": action.value,
                        "confidence": 0.9,
                        "topic": topic.strip(),
                        "params": {
                            "count": count,
                            "difficulty": "medium"
                        }
                    }
        
        # If no pattern matches, use AI for classification
        if self.ai_client:
            return self._ai_classify(user_input)
        
        # Default to explore/explain the input as a topic
        return {
            "action": SearchHubAction.EXPLAIN_TOPIC.value,
            "confidence": 0.5,
            "topic": user_input,
            "params": {}
        }
    
    def _ai_classify(self, user_input: str) -> Dict[str, Any]:
        """Use AI to classify intent when patterns don't match"""
        prompt = f"""Classify this user request into one action and extract the topic.

User input: "{user_input}"

Actions:
- create_note: User wants to create a note
- create_flashcards: User wants flashcards
- create_questions: User wants practice questions
- create_quiz: User wants a quiz
- explain_topic: User wants explanation of a topic
- search_all: User is searching for content
- review_flashcards: User wants to review flashcards
- show_progress: User wants to see their progress
- start_chat: User wants to chat about a topic

Return JSON only:
{{"action": "action_name", "topic": "extracted topic", "confidence": 0.0-1.0}}"""

        try:
            response = self.ai_client.generate(prompt, max_tokens=100, temperature=0.1)
            
            # Parse JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            match = re.search(r'\{[\s\S]*\}', json_str)
            if match:
                result = json.loads(match.group())
                return {
                    "action": result.get("action", "explain_topic"),
                    "confidence": result.get("confidence", 0.7),
                    "topic": result.get("topic", user_input),
                    "params": {}
                }
        except Exception as e:
            logger.error(f"AI classification failed: {e}")
        
        return {
            "action": SearchHubAction.EXPLAIN_TOPIC.value,
            "confidence": 0.5,
            "topic": user_input,
            "params": {}
        }


# ==================== Content Creator ====================

class ContentCreator:
    """Creates content (notes, flashcards, questions) with AI-generated content"""
    
    NOTE_PROMPT = """Write a comprehensive, detailed study note about this topic.

Topic: {topic}

Create a well-structured educational article with:
1. A clear introduction explaining what {topic} is
2. 3-4 main sections covering key aspects
3. Practical examples where relevant
4. A summary of key takeaways

Use HTML formatting:
- <h2> for main headings
- <h3> for subheadings  
- <p> for paragraphs
- <ul><li> for bullet points
- <strong> for important terms
- <em> for emphasis

Write detailed, educational content (at least 500 words):"""

    FLASHCARD_PROMPT = """Generate {count} high-quality flashcards about this topic.

Topic: {topic}

Create flashcards that:
1. Cover key concepts progressively (basic to advanced)
2. Have clear, specific questions
3. Have concise but complete answers
4. Test understanding, not just memorization

Return ONLY valid JSON:
{{
  "flashcards": [
    {{"question": "What is...?", "answer": "...", "difficulty": "easy"}},
    {{"question": "How does...?", "answer": "...", "difficulty": "medium"}},
    {{"question": "Why is...?", "answer": "...", "difficulty": "hard"}}
  ]
}}"""

    QUESTION_PROMPT = """Generate {count} multiple-choice questions about this topic.

Topic: {topic}

Create questions that:
1. Test understanding at different levels
2. Have 4 plausible options each
3. Include clear explanations for the correct answer
4. Progress from basic to advanced

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "...",
      "difficulty": "medium"
    }}
  ]
}}"""

    def __init__(self, ai_client, db_session_factory):
        self.ai_client = ai_client
        self.db_session_factory = db_session_factory
    
    def _generate_share_code(self) -> str:
        """Generate a random 6-character share code"""
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    def _parse_json(self, response: str) -> Any:
        """Parse JSON from AI response"""
        json_str = response.strip()
        
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        match = re.search(r'[\[{][\s\S]*[\]}]', json_str)
        if match:
            return json.loads(match.group())
        
        return {}
    
    async def create_note(self, user_id: str, topic: str) -> Dict[str, Any]:
        """Create a note with AI-generated content"""
        logger.info(f"Creating note for user {user_id} on topic: {topic}")
        
        # Generate content
        prompt = self.NOTE_PROMPT.format(topic=topic)
        content = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
        
        # Clean up content
        if not content.strip().startswith('<'):
            content = f"<p>{content}</p>"
        
        # Save to database
        db = self.db_session_factory()
        try:
            from models import Note, User
            
            # Get actual user_id
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            # Create note
            note = Note(
                user_id=actual_user_id,
                title=f"Study Notes: {topic.title()}",
                content=content,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            
            logger.info(f"Created note {note.id} for user {actual_user_id}")
            
            return {
                "success": True,
                "content_type": "note",
                "content_id": note.id,
                "title": note.title,
                "content_preview": content[:500],
                "navigate_to": f"/notes/editor/{note.id}",
                "message": f"Created note '{note.title}' with comprehensive content about {topic}"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create note: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()
    
    async def create_flashcards(self, user_id: str, topic: str, count: int = 10) -> Dict[str, Any]:
        """Create a flashcard set with AI-generated cards"""
        logger.info(f"Creating {count} flashcards for user {user_id} on topic: {topic}")
        
        # Generate flashcards
        prompt = self.FLASHCARD_PROMPT.format(topic=topic, count=count)
        response = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
        
        data = self._parse_json(response)
        cards = data.get("flashcards", []) if isinstance(data, dict) else data
        
        if not cards:
            return {"error": "Failed to generate flashcards", "success": False}
        
        # Save to database
        db = self.db_session_factory()
        try:
            from models import FlashcardSet, Flashcard, User
            
            # Get actual user_id
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            # Create flashcard set
            flashcard_set = FlashcardSet(
                user_id=actual_user_id,
                title=f"{topic.title()} Flashcards",
                description=f"AI-generated flashcards covering key concepts of {topic}",
                source_type="ai_generated",
                share_code=self._generate_share_code(),
                is_public=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(flashcard_set)
            db.flush()
            
            # Add flashcards
            for card in cards[:count]:
                if "question" in card and "answer" in card:
                    flashcard = Flashcard(
                        set_id=flashcard_set.id,
                        question=card["question"],
                        answer=card["answer"][:400],
                        difficulty=card.get("difficulty", "medium"),
                        created_at=datetime.utcnow()
                    )
                    db.add(flashcard)
            
            db.commit()
            db.refresh(flashcard_set)
            
            logger.info(f"Created flashcard set {flashcard_set.id} with {len(cards)} cards")
            
            return {
                "success": True,
                "content_type": "flashcard_set",
                "content_id": flashcard_set.id,
                "title": flashcard_set.title,
                "card_count": len(cards),
                "cards_preview": cards[:3],
                "navigate_to": f"/flashcards?set_id={flashcard_set.id}",
                "message": f"Created '{flashcard_set.title}' with {len(cards)} flashcards"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create flashcards: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()
    
    async def create_questions(self, user_id: str, topic: str, count: int = 10) -> Dict[str, Any]:
        """Create a question set with AI-generated questions"""
        logger.info(f"Creating {count} questions for user {user_id} on topic: {topic}")
        
        # Generate questions
        prompt = self.QUESTION_PROMPT.format(topic=topic, count=count)
        response = self.ai_client.generate(prompt, max_tokens=3000, temperature=0.7)
        
        data = self._parse_json(response)
        questions = data.get("questions", []) if isinstance(data, dict) else data
        
        if not questions:
            return {"error": "Failed to generate questions", "success": False}
        
        # Save to database
        db = self.db_session_factory()
        try:
            from models import User, QuestionSet, Question
            
            # Get actual user_id
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            # Create question set
            question_set = QuestionSet(
                user_id=actual_user_id,
                title=f"{topic.title()} Questions",
                description=f"AI-generated practice questions about {topic}",
                subject=topic,
                source_type="ai_generated",
                is_public=False,
                created_at=datetime.utcnow()
            )
            db.add(question_set)
            db.flush()
            
            # Add questions
            for q in questions[:count]:
                if "question" in q and "options" in q:
                    question = Question(
                        set_id=question_set.id,
                        question_text=q["question"],
                        question_type="multiple_choice",
                        options=json.dumps(q["options"]),
                        correct_answer=q.get("correct_answer", "A"),
                        explanation=q.get("explanation", ""),
                        difficulty=q.get("difficulty", "medium"),
                        created_at=datetime.utcnow()
                    )
                    db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            logger.info(f"Created question set {question_set.id} with {len(questions)} questions")
            
            return {
                "success": True,
                "content_type": "question_set",
                "content_id": question_set.id,
                "title": question_set.title,
                "question_count": len(questions),
                "questions_preview": questions[:2],
                "navigate_to": f"/question-bank?set_id={question_set.id}",
                "message": f"Created '{question_set.title}' with {len(questions)} practice questions"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create questions: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()


# ==================== Topic Explorer ====================

class TopicExplorer:
    """Explores and explains topics with AI"""
    
    EXPLAIN_PROMPT = """Explain this topic clearly and comprehensively for a student.

Topic: {topic}

Provide:
1. A clear definition/introduction
2. Key concepts and principles
3. Real-world examples or applications
4. Common misconceptions to avoid
5. Related topics to explore next

Write in an engaging, educational style. Use markdown for formatting."""

    SUMMARY_PROMPT = """Provide a concise summary of this topic.

Topic: {topic}

Include:
- What it is (1-2 sentences)
- Why it matters
- 3-5 key points
- One practical example

Keep it brief but informative."""

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def explain(self, topic: str, depth: str = "standard") -> Dict[str, Any]:
        """Generate a detailed explanation of a topic"""
        prompt = self.EXPLAIN_PROMPT.format(topic=topic)
        
        max_tokens = {"surface": 500, "standard": 1000, "deep": 1500}.get(depth, 1000)
        
        try:
            explanation = self.ai_client.generate(prompt, max_tokens=max_tokens, temperature=0.7)
            
            # Generate follow-up suggestions
            suggestions = [
                f"create flashcards on {topic}",
                f"create a note on {topic}",
                f"quiz me on {topic}",
                f"what are the key concepts of {topic}"
            ]
            
            # Extract related topics
            related = self._extract_related_topics(explanation, topic)
            
            return {
                "success": True,
                "explanation": explanation,
                "topic": topic,
                "suggestions": suggestions,
                "related_topics": related
            }
            
        except Exception as e:
            logger.error(f"Topic explanation failed: {e}")
            return {"success": False, "error": str(e)}
    
    def summarize(self, topic: str) -> Dict[str, Any]:
        """Generate a brief summary of a topic"""
        prompt = self.SUMMARY_PROMPT.format(topic=topic)
        
        try:
            summary = self.ai_client.generate(prompt, max_tokens=400, temperature=0.7)
            
            return {
                "success": True,
                "summary": summary,
                "topic": topic
            }
            
        except Exception as e:
            logger.error(f"Topic summary failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _extract_related_topics(self, text: str, original_topic: str) -> List[str]:
        """Extract related topics from explanation text"""
        # Simple extraction - look for capitalized phrases
        topics = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        
        # Filter and deduplicate
        filtered = list(set([t for t in topics if t.lower() != original_topic.lower() and len(t) > 3]))
        
        return filtered[:5]


# ==================== Content Searcher ====================

class ContentSearcher:
    """Searches across all content types"""
    
    def __init__(self, db_session_factory, ai_client=None):
        self.db_session_factory = db_session_factory
        self.ai_client = ai_client
    
    async def search(
        self,
        user_id: str,
        query: str,
        content_types: List[str] = None,
        include_public: bool = True,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Search across all content types"""
        db = self.db_session_factory()
        results = []
        
        try:
            from models import Note, FlashcardSet, User
            from question_bank_models import QuestionSet
            
            # Get actual user_id
            actual_user_id = None
            if user_id and user_id != "guest":
                if isinstance(user_id, str) and not user_id.isdigit():
                    user = db.query(User).filter(User.username == user_id).first()
                    if user:
                        actual_user_id = user.id
                elif isinstance(user_id, str):
                    actual_user_id = int(user_id)
                else:
                    actual_user_id = user_id
            
            query_lower = query.lower()
            content_types = content_types or ["notes", "flashcards", "questions"]
            
            # Search notes
            if "notes" in content_types:
                notes_query = db.query(Note).filter(
                    Note.is_deleted == False,
                    (Note.title.ilike(f"%{query}%") | Note.content.ilike(f"%{query}%"))
                )
                if actual_user_id:
                    notes_query = notes_query.filter(Note.user_id == actual_user_id)
                
                for note in notes_query.limit(limit // 3).all():
                    results.append({
                        "id": note.id,
                        "type": "note",
                        "title": note.title,
                        "description": note.content[:200] if note.content else "",
                        "created_at": note.created_at.isoformat() if note.created_at else None,
                        "is_own": note.user_id == actual_user_id if actual_user_id else False,
                        "navigate_to": f"/notes/editor/{note.id}"
                    })
            
            # Search flashcard sets
            if "flashcards" in content_types:
                fc_query = db.query(FlashcardSet).filter(
                    (FlashcardSet.title.ilike(f"%{query}%") | FlashcardSet.description.ilike(f"%{query}%"))
                )
                if actual_user_id:
                    if include_public:
                        fc_query = fc_query.filter(
                            (FlashcardSet.user_id == actual_user_id) | (FlashcardSet.is_public == True)
                        )
                    else:
                        fc_query = fc_query.filter(FlashcardSet.user_id == actual_user_id)
                elif include_public:
                    fc_query = fc_query.filter(FlashcardSet.is_public == True)
                
                for fc_set in fc_query.limit(limit // 3).all():
                    card_count = len(fc_set.flashcards) if fc_set.flashcards else 0
                    results.append({
                        "id": fc_set.id,
                        "type": "flashcard_set",
                        "title": fc_set.title,
                        "description": fc_set.description or "",
                        "card_count": card_count,
                        "created_at": fc_set.created_at.isoformat() if fc_set.created_at else None,
                        "is_own": fc_set.user_id == actual_user_id if actual_user_id else False,
                        "is_public": fc_set.is_public,
                        "navigate_to": f"/flashcards?set_id={fc_set.id}"
                    })
            
            # Search question sets
            if "questions" in content_types:
                try:
                    q_query = db.query(QuestionSet).filter(
                        (QuestionSet.title.ilike(f"%{query}%") | QuestionSet.description.ilike(f"%{query}%"))
                    )
                    if actual_user_id:
                        if include_public:
                            q_query = q_query.filter(
                                (QuestionSet.user_id == actual_user_id) | (QuestionSet.is_public == True)
                            )
                        else:
                            q_query = q_query.filter(QuestionSet.user_id == actual_user_id)
                    elif include_public:
                        q_query = q_query.filter(QuestionSet.is_public == True)
                    
                    for q_set in q_query.limit(limit // 3).all():
                        results.append({
                            "id": q_set.id,
                            "type": "question_set",
                            "title": q_set.title,
                            "description": q_set.description or "",
                            "question_count": q_set.question_count if hasattr(q_set, 'question_count') else 0,
                            "created_at": q_set.created_at.isoformat() if q_set.created_at else None,
                            "is_own": q_set.user_id == actual_user_id if actual_user_id else False,
                            "navigate_to": f"/question-bank?set_id={q_set.id}"
                        })
                except Exception as e:
                    logger.warning(f"Question set search failed: {e}")
            
            return {
                "success": True,
                "results": results,
                "total_results": len(results),
                "query": query
            }
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {"success": False, "error": str(e), "results": []}
        finally:
            db.close()


# ==================== Main SearchHub Agent ====================

class SearchHubAgent(BaseAgent):
    """
    The Ultimate SearchHub Agent - One sentence does it all!
    
    Capabilities:
    - Natural language command processing
    - Auto-creates notes, flashcards, questions with full AI content
    - Returns navigation data to redirect to created content
    - Semantic search across all content
    - AI-powered topic exploration
    - Personalized recommendations
    - Adaptive learning insights
    - Knowledge graph integration for weak/strong areas
    - Learning analytics and progress tracking
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        user_knowledge_graph: Optional[Any] = None,
        master_agent: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.user_knowledge_graph = user_knowledge_graph
        self.master_agent = master_agent
        
        # Initialize components
        self.intent_detector = IntentDetector(ai_client)
        self.content_creator = ContentCreator(ai_client, db_session_factory) if db_session_factory else None
        self.topic_explorer = TopicExplorer(ai_client)
        self.content_searcher = ContentSearcher(db_session_factory, ai_client) if db_session_factory else None
        
        # Knowledge graph integration
        self.kg_integration = KnowledgeGraphIntegration(user_knowledge_graph, master_agent)
        
        super().__init__(
            agent_type=AgentType.SEARCHHUB,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(SearchHubState)
        
        # Add nodes
        graph.add_node("detect_intent", self._detect_intent)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("create_content", self._create_content)
        graph.add_node("search_content", self._search_content)
        graph.add_node("explore_topic", self._explore_topic)
        graph.add_node("learning_action", self._learning_action)
        graph.add_node("knowledge_graph_action", self._knowledge_graph_action)
        graph.add_node("chat_action", self._chat_action)
        
        # Finalization
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("detect_intent")
        
        # Add edges
        graph.add_edge("detect_intent", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "create": "create_content",
                "search": "search_content",
                "explore": "explore_topic",
                "learning": "learning_action",
                "knowledge_graph": "knowledge_graph_action",
                "chat": "chat_action",
                "error": "handle_error"
            }
        )
        
        # All actions lead to format_response
        graph.add_edge("create_content", "format_response")
        graph.add_edge("search_content", "format_response")
        graph.add_edge("explore_topic", "format_response")
        graph.add_edge("learning_action", "format_response")
        graph.add_edge("knowledge_graph_action", "format_response")
        graph.add_edge("chat_action", "format_response")
        
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)

    
    # ==================== Graph Nodes ====================
    
    async def _detect_intent(self, state: SearchHubState) -> SearchHubState:
        """Detect user intent from natural language input"""
        user_input = state.get("user_input", "")
        
        state["execution_path"] = ["searchhub:detect_intent"]
        
        # Detect intent
        intent_result = self.intent_detector.detect(user_input)
        
        state["detected_action"] = intent_result["action"]
        state["action_confidence"] = intent_result["confidence"]
        state["extracted_topic"] = intent_result["topic"]
        state["extracted_params"] = intent_result.get("params", {})
        
        logger.info(f"Detected intent: {intent_result['action']} (confidence: {intent_result['confidence']}) topic: {intent_result['topic']}")
        
        return state
    
    async def _load_context(self, state: SearchHubState) -> SearchHubState:
        """Load user context and preferences"""
        user_id = state.get("user_id")
        
        if self.memory_manager and user_id:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="searchhub",
                    query=state.get("extracted_topic", ""),
                    session_id=state.get("session_id", "default")
                )
                state["memory_context"] = context
                state["user_preferences"] = context.get("user_preferences", {})
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        state["execution_path"].append("searchhub:load_context")
        return state
    
    def _get_action_route(self, state: SearchHubState) -> str:
        """Route to appropriate action handler"""
        action = state.get("detected_action", "")
        
        # Creation actions
        if action in [
            SearchHubAction.CREATE_NOTE.value,
            SearchHubAction.CREATE_FLASHCARDS.value,
            SearchHubAction.CREATE_QUESTIONS.value,
            SearchHubAction.CREATE_QUIZ.value,
            SearchHubAction.CREATE_ROADMAP.value
        ]:
            return "create"
        
        # Search actions
        elif action in [
            SearchHubAction.SEARCH_ALL.value,
            SearchHubAction.SEARCH_NOTES.value,
            SearchHubAction.SEARCH_FLASHCARDS.value,
            SearchHubAction.SEARCH_QUESTIONS.value,
            SearchHubAction.BROWSE_PUBLIC.value
        ]:
            return "search"
        
        # Exploration/explanation actions
        elif action in [
            SearchHubAction.EXPLAIN_TOPIC.value,
            SearchHubAction.EXPLORE_TOPIC.value,
            SearchHubAction.SUMMARIZE_TOPIC.value
        ]:
            return "explore"
        
        # Knowledge Graph actions (new!)
        elif action in [
            SearchHubAction.SHOW_WEAK_AREAS.value,
            SearchHubAction.SHOW_STRONG_AREAS.value,
            SearchHubAction.SHOW_KNOWLEDGE_GAPS.value,
            SearchHubAction.SHOW_CONCEPTS_TO_REVIEW.value,
            SearchHubAction.SHOW_LEARNING_ANALYTICS.value,
            SearchHubAction.SHOW_RECOMMENDED_TOPICS.value,
            SearchHubAction.DETECT_LEARNING_STYLE.value,
            SearchHubAction.GET_LEARNING_PATH.value,
            SearchHubAction.GET_FULL_CONTEXT.value,
            SearchHubAction.PREDICT_FORGETTING.value,
            SearchHubAction.SUGGEST_NEXT_TOPIC.value,
        ]:
            return "knowledge_graph"
        
        # Learning actions (navigation-based)
        elif action in [
            SearchHubAction.REVIEW_FLASHCARDS.value,
            SearchHubAction.TAKE_QUIZ.value,
            SearchHubAction.SHOW_PROGRESS.value,
            SearchHubAction.SHOW_ACHIEVEMENTS.value,
            SearchHubAction.OPTIMIZE_RETENTION.value,
            SearchHubAction.ADAPT_DIFFICULTY.value,
            SearchHubAction.FIND_STUDY_TWIN.value
        ]:
            return "learning"
        
        # Chat actions
        elif action in [
            SearchHubAction.START_CHAT.value,
            SearchHubAction.ASK_AI.value
        ]:
            return "chat"
        
        # Default to explore
        return "explore"
    
    async def _route_action(self, state: SearchHubState) -> SearchHubState:
        """Prepare for action routing"""
        state["execution_path"].append(f"searchhub:route:{state.get('detected_action')}")
        return state

    
    async def _create_content(self, state: SearchHubState) -> SearchHubState:
        """Create content (notes, flashcards, questions)"""
        action = state.get("detected_action")
        topic = state.get("extracted_topic", "")
        user_id = state.get("user_id")
        params = state.get("extracted_params", {})
        
        state["execution_path"].append(f"searchhub:create:{action}")
        
        if not self.content_creator:
            state["errors"] = ["Content creation not available"]
            return state
        
        if not topic:
            state["errors"] = ["No topic specified for content creation"]
            return state
        
        result = None
        
        if action == SearchHubAction.CREATE_NOTE.value:
            result = await self.content_creator.create_note(user_id, topic)
            
        elif action == SearchHubAction.CREATE_FLASHCARDS.value:
            count = params.get("count", 10)
            result = await self.content_creator.create_flashcards(user_id, topic, count)
            
        elif action == SearchHubAction.CREATE_QUESTIONS.value:
            count = params.get("count", 10)
            result = await self.content_creator.create_questions(user_id, topic, count)
            
        elif action == SearchHubAction.CREATE_QUIZ.value:
            # Create questions and navigate to quiz mode
            count = params.get("count", 10)
            result = await self.content_creator.create_questions(user_id, topic, count)
            if result.get("success"):
                result["navigate_to"] = f"/solo-quiz?set_id={result['content_id']}"
                result["message"] = f"Created quiz with {result.get('question_count', count)} questions about {topic}"
        
        if result:
            state["created_content"] = result
            state["content_id"] = result.get("content_id")
            state["content_type"] = result.get("content_type")
            state["navigate_to"] = result.get("navigate_to")
            state["navigate_params"] = {"id": result.get("content_id"), "title": result.get("title")}
            
            if result.get("success"):
                state["response_data"] = result
            else:
                state["errors"] = [result.get("error", "Content creation failed")]
        
        return state
    
    async def _search_content(self, state: SearchHubState) -> SearchHubState:
        """Search for content using RAG for semantic search"""
        query = state.get("extracted_topic") or state.get("user_input", "")
        user_id = state.get("user_id")
        action = state.get("detected_action")
        
        state["execution_path"].append("searchhub:search")
        
        # ==================== RAG-POWERED SEARCH ====================
        # Use RAG for intelligent semantic search
        try:
            from .rag.user_rag_manager import get_user_rag_manager
            user_rag = get_user_rag_manager()
            
            if user_rag:
                logger.info(f"🔍 SearchHub using RAG for semantic search: '{query}'")
                
                # Determine content types to search
                content_types = None
                if action == SearchHubAction.SEARCH_NOTES.value:
                    content_types = ["note"]
                elif action == SearchHubAction.SEARCH_FLASHCARDS.value:
                    content_types = ["flashcard"]
                elif action == SearchHubAction.SEARCH_QUESTIONS.value:
                    content_types = ["question_bank"]
                # If no specific type, search all
                
                # Retrieve from user's personal knowledge base using RAG
                rag_results = await user_rag.retrieve_for_user(
                    user_id=str(user_id),
                    query=query,
                    top_k=20,  # Get more results for search
                    content_types=content_types
                )
                
                if rag_results:
                    # Format RAG results for SearchHub response
                    formatted_results = []
                    for r in rag_results:
                        formatted_results.append({
                            "id": r.get("id", ""),
                            "content": r.get("content", ""),
                            "score": r.get("score", 0),
                            "type": r.get("metadata", {}).get("type", "content"),
                            "title": r.get("metadata", {}).get("title", ""),
                            "metadata": r.get("metadata", {})
                        })
                    
                    state["search_results"] = formatted_results
                    state["search_query"] = query
                    state["response_data"] = {
                        "results": formatted_results,
                        "total": len(formatted_results),
                        "query": query,
                        "search_method": "rag_semantic"
                    }
                    
                    logger.info(f"✅ RAG search found {len(formatted_results)} results")
                    return state
                else:
                    logger.info("ℹ️ RAG search returned no results")
            else:
                logger.warning("⚠️ User RAG Manager not available, falling back to standard search")
                
        except Exception as e:
            logger.error(f"❌ RAG search failed: {e}, falling back to standard search")
        
        # ==================== FALLBACK TO STANDARD SEARCH ====================
        if not self.content_searcher:
            state["errors"] = ["Search not available"]
            return state
        
        # Determine content types to search
        content_types = None
        if action == SearchHubAction.SEARCH_NOTES.value:
            content_types = ["notes"]
        elif action == SearchHubAction.SEARCH_FLASHCARDS.value:
            content_types = ["flashcards"]
        elif action == SearchHubAction.SEARCH_QUESTIONS.value:
            content_types = ["questions"]
        
        result = await self.content_searcher.search(
            user_id=user_id,
            query=query,
            content_types=content_types,
            include_public=True
        )
        
        state["search_results"] = result.get("results", [])
        state["search_query"] = query
        state["response_data"] = result
        
        # If no results, provide AI exploration
        if not result.get("results"):
            explore_result = self.topic_explorer.explain(query)
            state["ai_response"] = explore_result.get("explanation", "")
            state["ai_suggestions"] = explore_result.get("suggestions", [])
        
        return state
    
    async def _explore_topic(self, state: SearchHubState) -> SearchHubState:
        """Explore/explain a topic with AI"""
        topic = state.get("extracted_topic") or state.get("user_input", "")
        action = state.get("detected_action")
        
        state["execution_path"].append(f"searchhub:explore:{action}")
        
        if action == SearchHubAction.SUMMARIZE_TOPIC.value:
            result = self.topic_explorer.summarize(topic)
            state["ai_response"] = result.get("summary", "")
        else:
            result = self.topic_explorer.explain(topic)
            state["ai_response"] = result.get("explanation", "")
            state["ai_suggestions"] = result.get("suggestions", [])
            state["related_topics"] = result.get("related_topics", [])
        
        state["response_data"] = {
            "success": result.get("success", False),
            "topic": topic,
            "explanation": state.get("ai_response"),
            "suggestions": state.get("ai_suggestions", []),
            "related_topics": state.get("related_topics", []),
            "action_buttons": [
                {"label": f"Create Note on {topic}", "action": "create_note", "topic": topic},
                {"label": f"Create Flashcards", "action": "create_flashcards", "topic": topic},
                {"label": f"Quiz Me", "action": "create_quiz", "topic": topic},
                {"label": "Chat About This", "action": "start_chat", "topic": topic}
            ]
        }
        
        return state

    
    async def _learning_action(self, state: SearchHubState) -> SearchHubState:
        """Handle learning-related actions (navigation-based)"""
        action = state.get("detected_action")
        user_id = state.get("user_id")
        
        state["execution_path"].append(f"searchhub:learning:{action}")
        
        # Map actions to navigation
        navigation_map = {
            SearchHubAction.REVIEW_FLASHCARDS.value: "/flashcards",
            SearchHubAction.TAKE_QUIZ.value: "/solo-quiz",
            SearchHubAction.SHOW_PROGRESS.value: "/study-insights",
            SearchHubAction.SHOW_ACHIEVEMENTS.value: "/study-insights?tab=achievements",
            SearchHubAction.DETECT_LEARNING_STYLE.value: "/study-insights?tab=style",
            SearchHubAction.FIND_STUDY_TWIN.value: "/community",
            SearchHubAction.OPTIMIZE_RETENTION.value: "/study-insights?tab=retention",
            SearchHubAction.ADAPT_DIFFICULTY.value: "/study-insights?tab=difficulty",
        }
        
        navigate_to = navigation_map.get(action, "/dashboard")
        
        # Generate contextual message
        messages = {
            SearchHubAction.REVIEW_FLASHCARDS.value: "Opening your flashcards for review...",
            SearchHubAction.TAKE_QUIZ.value: "Starting quiz mode...",
            SearchHubAction.SHOW_PROGRESS.value: "Loading your learning progress...",
            SearchHubAction.SHOW_ACHIEVEMENTS.value: "Loading your achievements...",
            SearchHubAction.DETECT_LEARNING_STYLE.value: "Analyzing your learning style...",
            SearchHubAction.OPTIMIZE_RETENTION.value: "Optimizing your retention schedule...",
            SearchHubAction.ADAPT_DIFFICULTY.value: "Adjusting difficulty to your level...",
            SearchHubAction.FIND_STUDY_TWIN.value: "Finding learners like you...",
        }
        
        state["navigate_to"] = navigate_to
        state["response_data"] = {
            "success": True,
            "action": action,
            "navigate_to": navigate_to,
            "message": messages.get(action, "Processing your request...")
        }
        
        return state
    
    async def _knowledge_graph_action(self, state: SearchHubState) -> SearchHubState:
        """Handle knowledge graph related actions - weak areas, strong areas, gaps, analytics"""
        action = state.get("detected_action")
        user_id = state.get("user_id")
        topic = state.get("extracted_topic", "")
        
        state["execution_path"].append(f"searchhub:knowledge_graph:{action}")
        
        # Convert user_id to int - handle both numeric IDs and email/username
        user_id_int = None
        try:
            if user_id:
                if str(user_id).isdigit():
                    user_id_int = int(user_id)
                elif self.db_session_factory:
                    # Look up user by email/username
                    from models import User
                    db = self.db_session_factory()
                    try:
                        user = db.query(User).filter(
                            (User.email == user_id) | (User.username == user_id)
                        ).first()
                        if user:
                            user_id_int = user.id
                    finally:
                        db.close()
        except Exception as e:
            logger.error(f"Error resolving user_id: {e}")
        
        if not user_id_int:
            state["errors"] = ["Please log in to access your learning analytics"]
            return state
        
        result = {}
        message = ""
        ai_response = ""
        
        # Handle different knowledge graph actions
        if action == SearchHubAction.SHOW_WEAK_AREAS.value:
            result = await self.kg_integration.get_weak_areas(user_id_int)
            state["kg_weak_areas"] = result
            logger.info(f"Weak areas result for user {user_id_int}: {result.get('success')}, concepts: {len(result.get('weak_concepts', []))}")
            
            if result.get("success") and result.get("weak_concepts"):
                weak_list = result["weak_concepts"][:5]
                concepts_text = "\n".join([
                    f"  - {c['concept']}: {c['mastery']:.0%} mastery ({c['classification']})"
                    for c in weak_list
                ])
                recommendations_text = "\n".join([
                    f"  - {r['action']}" for r in result.get('recommendations', [])[:3]
                ])
                ai_response = f"""Your Weak Areas:

{concepts_text}

Recommendations:
{recommendations_text}

Focus on these areas to improve your overall mastery."""
                message = f"Found {len(result['weak_concepts'])} concepts that need attention"
            else:
                ai_response = "Great job! No significant weak areas detected. Keep up the good work!"
                message = "No weak areas found"
        
        elif action == SearchHubAction.SHOW_STRONG_AREAS.value:
            result = await self.kg_integration.get_strong_areas(user_id_int)
            state["kg_strong_areas"] = result
            
            if result.get("success") and result.get("strong_concepts"):
                strong_list = result["strong_concepts"][:5]
                concepts_text = "\n".join([
                    f"  - {c['concept']}: {c['mastery']:.0%} mastery ({c['classification']})"
                    for c in strong_list
                ])
                ai_response = f"""Your Strengths:

{concepts_text}

You're excelling in these areas! Consider:
  - Challenging yourself with harder questions
  - Helping others learn these topics
  - Exploring advanced concepts"""
                message = f"You're strong in {len(result['strong_concepts'])} concepts!"
            else:
                ai_response = "Keep studying! Your strengths will develop as you practice more."
                message = "Keep building your knowledge"
        
        elif action == SearchHubAction.SHOW_KNOWLEDGE_GAPS.value:
            result = await self.kg_integration.get_knowledge_gaps(user_id_int)
            state["kg_knowledge_gaps"] = result
            
            if result.get("success") and result.get("gaps"):
                gaps_list = result["gaps"][:5]
                gaps_text = "\n".join([
                    f"  - {g['concept']}: {g.get('reason', 'Ready to learn')}"
                    for g in gaps_list
                ])
                path_text = "\n".join([
                    f"  - {p['action']}" for p in result.get('recommended_learning_path', [])[:3]
                ])
                ai_response = f"""Knowledge Gaps Detected:

These concepts build on what you already know:

{gaps_text}

Suggested Learning Path:
{path_text}"""
                message = f"Found {len(result['gaps'])} concepts you're ready to learn"
            else:
                ai_response = "No knowledge gaps detected. You're on a great learning path!"
                message = "No gaps found"
        
        elif action == SearchHubAction.SHOW_CONCEPTS_TO_REVIEW.value or action == SearchHubAction.PREDICT_FORGETTING.value:
            result = await self.kg_integration.get_concepts_to_review(user_id_int)
            state["kg_concepts_to_review"] = result
            
            if result.get("success") and result.get("concepts_to_review"):
                review_list = result["concepts_to_review"][:5]
                review_text = "\n".join([
                    f"  - {c['concept']}: {c['mastery']:.0%} mastery (last reviewed: {c['last_reviewed']})"
                    for c in review_list
                ])
                ai_response = f"""Concepts Due for Review:

{review_text}

You have {result['overdue_count']} concepts that need review to maintain retention.

Tip: Regular spaced repetition helps move knowledge to long-term memory."""
                message = f"{result['overdue_count']} concepts need review"
            else:
                ai_response = "You're all caught up! No concepts need immediate review."
                message = "All caught up on reviews"
        
        elif action == SearchHubAction.SHOW_LEARNING_ANALYTICS.value:
            result = await self.kg_integration.get_learning_analytics(user_id_int)
            state["kg_learning_analytics"] = result
            
            if result.get("success"):
                summary = result.get("summary", {})
                distribution = result.get("mastery_distribution", {})
                recommendations_text = "\n".join([
                    f"  - {r['action']}" for r in result.get('recommendations', [])[:3]
                ])
                
                ai_response = f"""Your Learning Analytics:

Summary:
  - Total Concepts Learned: {summary.get('total_concepts', 0)}
  - Average Mastery: {summary.get('average_mastery', 0):.0%}
  - Total Reviews: {summary.get('total_reviews', 0)}
  - Accuracy Rate: {summary.get('accuracy_rate', 0):.0%}

Mastery Distribution:
  - Expert: {distribution.get('expert', 0)} concepts
  - Proficient: {distribution.get('proficient', 0)} concepts
  - Intermediate: {distribution.get('intermediate', 0)} concepts
  - Beginner: {distribution.get('beginner', 0)} concepts
  - Novice: {distribution.get('novice', 0)} concepts

Recommendations:
{recommendations_text}"""
                message = "Here's your learning analytics"
            else:
                ai_response = "Start studying to see your learning analytics!"
                message = "No analytics data yet"
        
        elif action == SearchHubAction.SHOW_RECOMMENDED_TOPICS.value or action == SearchHubAction.SUGGEST_NEXT_TOPIC.value:
            result = await self.kg_integration.get_recommended_topics(user_id_int)
            state["kg_recommended_topics"] = result
            
            if result.get("success") and result.get("recommended_topics"):
                topics_list = result["recommended_topics"][:5]
                topics_text = "\n".join([
                    f"  - {t['topic']}: {t.get('recommendation_reason', 'Good next step')}"
                    for t in topics_list
                ])
                ai_response = f"""Recommended Topics for You:

{topics_text}

These topics are selected based on your current progress and learning patterns."""
                message = f"Found {len(result['recommended_topics'])} recommended topics"
            else:
                ai_response = "Start learning to get personalized topic recommendations!"
                message = "No recommendations yet"
        
        elif action == SearchHubAction.GET_LEARNING_PATH.value:
            if topic:
                result = await self.kg_integration.get_learning_path(user_id_int, topic)
                state["kg_learning_path"] = result
                
                if result.get("success") and result.get("concepts"):
                    concepts_list = result["concepts"][:8]
                    path_text = "\n".join([
                        f"  {i+1}. {c['name']}: {c.get('description', '')[:50]}..."
                        for i, c in enumerate(concepts_list)
                    ])
                    
                    prereq_warning = ""
                    if not result.get("prerequisites_met"):
                        prereq_warning = f"\n\nMissing Prerequisites: {', '.join(result.get('missing_prerequisites', []))}"
                    
                    ai_response = f"""Learning Path for {topic}:

{path_text}

Estimated Time: {result.get('estimated_time_hours', 0):.1f} hours
Difficulty: {result.get('difficulty', 'intermediate').title()}{prereq_warning}"""
                    message = f"Generated learning path for {topic}"
                else:
                    ai_response = f"I couldn't find a structured learning path for '{topic}'. Try exploring the topic first!"
                    message = "No learning path found"
            else:
                ai_response = "Please specify a topic to get a learning path. Example: 'learning path for machine learning'"
                message = "No topic specified"
        
        elif action == SearchHubAction.GET_FULL_CONTEXT.value:
            result = await self.kg_integration.get_full_user_context(user_id)
            state["kg_full_context"] = result
            
            if result:
                learning_state = result.get("learning_state", {})
                performance = result.get("performance", {})
                
                weak_topics = learning_state.get("weak_topics", [])[:3]
                strong_topics = learning_state.get("strong_topics", [])[:3]
                recommendations_text = "\n".join([
                    f"  - {r.get('suggested_action', r.get('reason', ''))}" 
                    for r in result.get('recommendations', [])[:3]
                ])
                
                ai_response = f"""Your Complete Learning Profile:

Performance Score: {performance.get('overall_score', 0.5):.0%}

Dimension Scores:
  - Knowledge: {performance.get('dimension_scores', {}).get('knowledge', 0.5):.0%}
  - Retention: {performance.get('dimension_scores', {}).get('retention', 0.5):.0%}
  - Consistency: {performance.get('dimension_scores', {}).get('consistency', 0.5):.0%}
  - Engagement: {performance.get('dimension_scores', {}).get('engagement', 0.5):.0%}

Weak Areas: {', '.join(weak_topics) if weak_topics else 'None identified'}
Strengths: {', '.join(strong_topics) if strong_topics else 'Building knowledge'}

Recommendations:
{recommendations_text}"""
                message = "Here's your complete learning profile"
            else:
                ai_response = "Start learning to build your profile!"
                message = "No profile data yet"
        
        elif action == SearchHubAction.DETECT_LEARNING_STYLE.value:
            # Get learning analytics to infer learning style
            result = await self.kg_integration.get_learning_analytics(user_id_int)
            
            if result.get("success"):
                summary = result.get("summary", {})
                # Infer learning style from patterns
                total_reviews = summary.get("total_reviews", 0)
                accuracy = summary.get("accuracy_rate", 0)
                
                # Simple learning style inference
                if total_reviews > 50 and accuracy > 0.8:
                    style = "Visual-Sequential"
                    description = "You learn best through structured, step-by-step content with visual aids."
                elif total_reviews > 30:
                    style = "Active-Reflective"
                    description = "You learn by doing and then reflecting on what you've learned."
                elif accuracy > 0.7:
                    style = "Intuitive-Global"
                    description = "You grasp big-picture concepts quickly and make connections between ideas."
                else:
                    style = "Sensing-Sequential"
                    description = "You prefer concrete facts and practical applications, learning step by step."
                
                ai_response = f"""Your Learning Style: {style}

{description}

Based on your activity:
  - Total Reviews: {total_reviews}
  - Accuracy Rate: {accuracy:.0%}

Tips for your learning style:
  - Use flashcards with visual cues
  - Break complex topics into smaller chunks
  - Practice regularly with spaced repetition
  - Connect new concepts to what you already know"""
                message = f"Your learning style is {style}"
                result["learning_style"] = style
                result["success"] = True
            else:
                ai_response = "Complete more study sessions to detect your learning style. Try reviewing some flashcards first!"
                message = "Need more data to detect learning style"
        
        # Build response
        state["ai_response"] = ai_response
        state["response_data"] = {
            "success": result.get("success", False),
            "action": action,
            "data": result,
            "message": message,
            "ai_response": ai_response,
            "suggestions": [
                "create flashcards on weak topics",
                "show my learning analytics",
                "what should I study next"
            ]
        }
        
        return state
    
    async def _chat_action(self, state: SearchHubState) -> SearchHubState:
        """Handle chat-related actions"""
        topic = state.get("extracted_topic") or state.get("user_input", "")
        
        state["execution_path"].append("searchhub:chat")
        
        state["navigate_to"] = "/ai-chat"
        state["navigate_params"] = {"initialMessage": topic}
        state["response_data"] = {
            "success": True,
            "action": "start_chat",
            "navigate_to": "/ai-chat",
            "navigate_params": {"initialMessage": topic},
            "message": f"Starting chat about {topic}..."
        }
        
        return state
    
    async def _format_response(self, state: SearchHubState) -> SearchHubState:
        """Format the final response"""
        action = state.get("detected_action")
        topic = state.get("extracted_topic", "")
        
        state["execution_path"].append("searchhub:format_response")
        
        # Build response based on action type
        response_data = state.get("response_data", {})
        
        if state.get("errors"):
            state["final_response"] = f"Sorry, I encountered an issue: {state['errors'][0]}"
            state["response_metadata"] = {
                "success": False,
                "errors": state["errors"],
                "action": action
            }
        else:
            # Success response
            state["final_response"] = response_data.get("message", f"Completed {action} for {topic}")
            state["response_metadata"] = {
                "success": True,
                "action": action,
                "topic": topic,
                "navigate_to": state.get("navigate_to"),
                "navigate_params": state.get("navigate_params", {}),
                "content_id": state.get("content_id"),
                "content_type": state.get("content_type"),
                "response_data": response_data
            }
        
        return state
    
    async def _handle_error(self, state: SearchHubState) -> SearchHubState:
        """Handle errors gracefully"""
        errors = state.get("errors", ["Unknown error"])
        
        state["final_response"] = f"I couldn't complete that request: {errors[0]}. Try rephrasing or being more specific."
        state["response_metadata"] = {
            "success": False,
            "errors": errors,
            "suggestions": [
                "create flashcards on [topic]",
                "create a note about [topic]",
                "explain [topic]",
                "search for [topic]"
            ]
        }
        
        return state
    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process input - handled by _detect_intent"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute core logic - handled by action nodes"""
        return state


# ==================== Factory Function ====================

def create_search_hub_agent(
    ai_client: Any,
    knowledge_graph: Optional[Any] = None,
    memory_manager: Optional[MemoryManager] = None,
    db_session_factory: Optional[Any] = None,
    user_knowledge_graph: Optional[Any] = None,
    master_agent: Optional[Any] = None
) -> SearchHubAgent:
    """Factory function to create a SearchHub agent"""
    return SearchHubAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory,
        user_knowledge_graph=user_knowledge_graph,
        master_agent=master_agent
    )
