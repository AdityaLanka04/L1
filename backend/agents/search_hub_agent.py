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
    SHOW_ACHIEVEMENTS = "show_achievements"
    
    # Adaptive Learning
    DETECT_LEARNING_STYLE = "detect_learning_style"
    SHOW_KNOWLEDGE_GAPS = "show_knowledge_gaps"
    OPTIMIZE_RETENTION = "optimize_retention"
    PREDICT_FORGETTING = "predict_forgetting"
    SUGGEST_NEXT_TOPIC = "suggest_next_topic"
    ADAPT_DIFFICULTY = "adapt_difficulty"
    
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
        # Creation patterns
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
        
        # Explanation patterns
        SearchHubAction.EXPLAIN_TOPIC: [
            r"explain\s+(.+?)(?:\s+to\s+me)?(?:\s+step.by.step)?$",
            r"what\s+is\s+(.+)",
            r"what\s+are\s+(.+)",
            r"how\s+does\s+(.+)\s+work",
            r"how\s+do\s+(.+)\s+work",
            r"tell\s+me\s+about\s+(.+)",
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
        SearchHubAction.SHOW_WEAK_AREAS: [
            r"show\s+(?:my\s+)?weak\s+areas?",
            r"what\s+am\s+i\s+weak\s+(?:in|at)",
            r"my\s+weak\s+(?:areas?|spots?|points?)",
            r"where\s+do\s+i\s+need\s+(?:help|improvement)",
        ],
        SearchHubAction.SHOW_ACHIEVEMENTS: [
            r"show\s+(?:my\s+)?achievements?",
            r"my\s+achievements?",
            r"my\s+badges?",
            r"what\s+have\s+i\s+earned",
        ],
        
        # Adaptive learning patterns
        SearchHubAction.DETECT_LEARNING_STYLE: [
            r"(?:what\s+is\s+)?my\s+learning\s+style",
            r"how\s+do\s+i\s+learn\s+best",
            r"detect\s+(?:my\s+)?learning\s+style",
        ],
        SearchHubAction.SHOW_KNOWLEDGE_GAPS: [
            r"show\s+(?:my\s+)?knowledge\s+gaps?",
            r"(?:my\s+)?knowledge\s+gaps?",
            r"what\s+(?:am\s+i\s+missing|don'?t\s+i\s+know)",
            r"find\s+(?:my\s+)?blind\s+spots?",
        ],
        SearchHubAction.PREDICT_FORGETTING: [
            r"what\s+will\s+i\s+forget",
            r"predict\s+(?:what\s+i'?ll\s+)?forget",
            r"forgetting\s+curve",
            r"what\s+should\s+i\s+review",
        ],
        SearchHubAction.SUGGEST_NEXT_TOPIC: [
            r"what\s+should\s+i\s+(?:study|learn)\s+next",
            r"suggest\s+(?:a\s+)?(?:next\s+)?topic",
            r"recommend\s+(?:a\s+)?topic",
            r"next\s+topic",
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
            from models import User
            from question_bank_models import QuestionSet, Question
            
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
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        
        # Initialize components
        self.intent_detector = IntentDetector(ai_client)
        self.content_creator = ContentCreator(ai_client, db_session_factory) if db_session_factory else None
        self.topic_explorer = TopicExplorer(ai_client)
        self.content_searcher = ContentSearcher(db_session_factory, ai_client) if db_session_factory else None
        
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
                "chat": "chat_action",
                "error": "handle_error"
            }
        )
        
        # All actions lead to format_response
        graph.add_edge("create_content", "format_response")
        graph.add_edge("search_content", "format_response")
        graph.add_edge("explore_topic", "format_response")
        graph.add_edge("learning_action", "format_response")
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
        
        # Learning actions
        elif action in [
            SearchHubAction.REVIEW_FLASHCARDS.value,
            SearchHubAction.TAKE_QUIZ.value,
            SearchHubAction.SHOW_PROGRESS.value,
            SearchHubAction.SHOW_WEAK_AREAS.value,
            SearchHubAction.SHOW_ACHIEVEMENTS.value,
            SearchHubAction.DETECT_LEARNING_STYLE.value,
            SearchHubAction.SHOW_KNOWLEDGE_GAPS.value,
            SearchHubAction.OPTIMIZE_RETENTION.value,
            SearchHubAction.PREDICT_FORGETTING.value,
            SearchHubAction.SUGGEST_NEXT_TOPIC.value,
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
        """Search for content"""
        query = state.get("extracted_topic") or state.get("user_input", "")
        user_id = state.get("user_id")
        action = state.get("detected_action")
        
        state["execution_path"].append("searchhub:search")
        
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
        """Handle learning-related actions"""
        action = state.get("detected_action")
        user_id = state.get("user_id")
        
        state["execution_path"].append(f"searchhub:learning:{action}")
        
        # Map actions to navigation
        navigation_map = {
            SearchHubAction.REVIEW_FLASHCARDS.value: "/flashcards",
            SearchHubAction.TAKE_QUIZ.value: "/solo-quiz",
            SearchHubAction.SHOW_PROGRESS.value: "/study-insights",
            SearchHubAction.SHOW_WEAK_AREAS.value: "/study-insights?tab=weak",
            SearchHubAction.SHOW_ACHIEVEMENTS.value: "/study-insights?tab=achievements",
            SearchHubAction.DETECT_LEARNING_STYLE.value: "/study-insights?tab=style",
            SearchHubAction.SHOW_KNOWLEDGE_GAPS.value: "/study-insights?tab=gaps",
            SearchHubAction.FIND_STUDY_TWIN.value: "/community",
        }
        
        navigate_to = navigation_map.get(action, "/dashboard")
        
        # Generate contextual message
        messages = {
            SearchHubAction.REVIEW_FLASHCARDS.value: "Opening your flashcards for review...",
            SearchHubAction.TAKE_QUIZ.value: "Starting quiz mode...",
            SearchHubAction.SHOW_PROGRESS.value: "Loading your learning progress...",
            SearchHubAction.SHOW_WEAK_AREAS.value: "Analyzing your weak areas...",
            SearchHubAction.SHOW_ACHIEVEMENTS.value: "Loading your achievements...",
            SearchHubAction.DETECT_LEARNING_STYLE.value: "Analyzing your learning style...",
            SearchHubAction.SHOW_KNOWLEDGE_GAPS.value: "Identifying knowledge gaps...",
            SearchHubAction.PREDICT_FORGETTING.value: "Calculating your forgetting curve...",
            SearchHubAction.SUGGEST_NEXT_TOPIC.value: "Finding your optimal next topic...",
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
    db_session_factory: Optional[Any] = None
) -> SearchHubAgent:
    """Factory function to create a SearchHub agent"""
    return SearchHubAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
