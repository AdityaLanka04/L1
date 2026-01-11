"""
NLP Engine for SearchHub Agent
Advanced Natural Language Processing for understanding user intent like a smart chatbot.

Features:
- Semantic understanding with sentence embeddings
- Fuzzy intent matching with conversational patterns
- Context-aware entity extraction
- Conversational memory with follow-up handling
- Multi-language support
- Synonym expansion
- Contextual disambiguation
- Navigation decision making
- Chatbot-like response generation
"""

import logging
import re
import json
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import asyncio
from functools import lru_cache

logger = logging.getLogger(__name__)

# Try to import NLP libraries
try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False
    logger.warning("sentence-transformers not available, using fallback NLP")

try:
    from langdetect import detect as detect_language
    HAS_LANGDETECT = True
except ImportError:
    HAS_LANGDETECT = False


# ==================== Data Classes ====================

@dataclass
class IntentMatch:
    """Represents a matched intent with confidence"""
    intent: str
    confidence: float
    entities: Dict[str, Any] = field(default_factory=dict)
    context_used: bool = False
    original_query: str = ""
    normalized_query: str = ""
    language: str = "en"
    navigation_target: Optional[str] = None
    navigation_params: Dict[str, Any] = field(default_factory=dict)
    response_type: str = "action"  # action, navigate, explain, search, chat


@dataclass
class ConversationContext:
    """Tracks conversation context for better understanding"""
    last_topic: Optional[str] = None
    last_action: Optional[str] = None
    last_entities: Dict[str, Any] = field(default_factory=dict)
    conversation_history: List[Dict[str, Any]] = field(default_factory=list)
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    session_start: datetime = field(default_factory=datetime.utcnow)
    pending_clarification: Optional[str] = None
    last_navigation: Optional[str] = None


# ==================== Intent Definitions ====================

class IntentCategory(str, Enum):
    """High-level intent categories"""
    CREATE = "create"
    SEARCH = "search"
    LEARN = "learn"
    REVIEW = "review"
    ANALYZE = "analyze"
    NAVIGATE = "navigate"
    CHAT = "chat"
    HELP = "help"
    GREETING = "greeting"
    FOLLOWUP = "followup"


# Navigation targets for each intent
# None = show response in SearchHub UI (no navigation)
INTENT_NAVIGATION = {
    # Content creation - navigate after creating
    "create_note": "/notes/editor/{id}",
    "create_flashcards": "/flashcards?set_id={id}",
    "create_questions": "/question-bank?set_id={id}",
    "create_quiz": "/solo-quiz",
    
    # Review - navigate to flashcards
    "review_flashcards": "/flashcards",
    
    # Analytics - show in UI, don't navigate
    "show_weak_areas": None,
    "show_strong_areas": None,
    "show_progress": None,
    "show_learning_analytics": None,
    "show_knowledge_gaps": None,
    "show_concepts_to_review": None,
    "show_recommended_topics": None,
    "get_learning_path": None,
    "detect_learning_style": None,
    
    # Chat - navigate to AI chat
    "start_chat": "/ai-chat",
    
    # Search/Explore - show in UI
    "search_all": None,
    "explain_topic": None,
    "summarize_topic": None,
    "show_help": None,
    "greeting": None,
}


# Intent definitions with semantic examples and synonyms
INTENT_DEFINITIONS = {
    # ============ GREETING INTENTS ============
    "greeting": {
        "category": IntentCategory.GREETING,
        "examples": [
            "hi", "hello", "hey", "hi there", "hello there",
            "good morning", "good afternoon", "good evening",
            "what's up", "sup", "yo", "howdy", "hey there",
        ],
        "keywords": ["hi", "hello", "hey", "morning", "afternoon", "evening"],
        "verbs": [],
        "requires_topic": False,
        "response_type": "chat",
    },
    
    # ============ CREATION INTENTS ============
    "create_note": {
        "category": IntentCategory.CREATE,
        "examples": [
            "create a note about machine learning",
            "make notes on python programming",
            "write a note about calculus",
            "new note on biology",
            "i want to create notes about physics",
            "can you make a note for me about chemistry",
            "help me write notes on history",
            "start a new note about economics",
            "draft a note covering data structures",
            "yo make me a note on algebra",
            "need notes on organic chemistry",
            "gimme a note about world history",
            "let's write about machine learning",
            "could you create a note on databases",
            "would you mind making notes about networking",
            "i need to take notes on quantum physics",
            "help me document my learning about AI",
            "write something about neural networks",
        ],
        "keywords": ["note", "notes", "write", "draft", "document"],
        "verbs": ["create", "make", "write", "start", "draft", "new", "take"],
        "requires_topic": True,
        "response_type": "action",
    },
    "create_flashcards": {
        "category": IntentCategory.CREATE,
        "examples": [
            "create flashcards about photosynthesis",
            "make 10 flashcards on spanish vocabulary",
            "generate flashcards for my exam",
            "i need flashcards about world war 2",
            "can you create some cards about anatomy",
            "help me make study cards for chemistry",
            "flashcards on programming concepts",
            "create revision cards about math formulas",
            "gimme some flashcards on biology",
            "need cards for my physics test",
            "make me some cards about history",
            "5 flashcards on calculus",
            "twenty cards about python",
            "a few flashcards on economics",
            "i want to memorize vocabulary",
            "help me study for my test",
            "prepare study materials on chemistry",
        ],
        "keywords": ["flashcard", "flashcards", "cards", "study cards", "revision cards", "memorize"],
        "verbs": ["create", "make", "generate", "build", "prepare"],
        "requires_topic": True,
        "response_type": "action",
    },
    "create_questions": {
        "category": IntentCategory.CREATE,
        "examples": [
            "create practice questions about algebra",
            "make questions on cell biology",
            "generate quiz questions about history",
            "i need practice problems for physics",
            "create test questions about programming",
            "help me with practice questions on chemistry",
            "make some questions to test my knowledge",
            "gimme some questions on math",
            "need practice problems for my exam",
            "questions about data structures please",
            "i want to practice algebra",
            "help me prepare for my test",
        ],
        "keywords": ["question", "questions", "problems", "practice", "test", "exercise"],
        "verbs": ["create", "make", "generate", "prepare"],
        "requires_topic": True,
        "response_type": "action",
    },
    "create_quiz": {
        "category": IntentCategory.CREATE,
        "examples": [
            "quiz me on machine learning",
            "test me about python",
            "create a quiz about biology",
            "i want to take a quiz on history",
            "start a quiz about chemistry",
            "give me a test on physics",
            "can you quiz me about math",
            "let's do a quiz on programming",
            "test my knowledge on databases",
            "challenge me on algorithms",
            "ready to be quizzed on calculus",
            "i want to test myself",
            "check my understanding of physics",
            "see how much i know about biology",
        ],
        "keywords": ["quiz", "test", "exam", "assessment", "challenge", "check"],
        "verbs": ["quiz", "test", "assess", "examine", "create", "start", "take", "challenge"],
        "requires_topic": True,
        "response_type": "action",
    },
    
    # ============ LEARNING INTENTS ============
    "explain_topic": {
        "category": IntentCategory.LEARN,
        "examples": [
            "explain machine learning to me",
            "what is quantum computing",
            "tell me about neural networks",
            "how does photosynthesis work",
            "explain the concept of recursion",
            "what are design patterns",
            "teach me about databases",
            "i want to understand blockchain",
            "can you explain calculus",
            "help me understand algorithms",
            "what's the deal with machine learning",
            "break down neural networks for me",
            "eli5 quantum physics",
            "dumb it down for me - what is AI",
            "how do databases work",
            "why is recursion important",
            "what makes python popular",
            "i don't understand derivatives",
            "confused about pointers",
            "struggling with recursion",
        ],
        "keywords": ["explain", "what", "how", "tell", "teach", "understand", "learn", "why", "confused", "struggling"],
        "verbs": ["explain", "tell", "teach", "describe", "clarify", "break down"],
        "requires_topic": True,
        "response_type": "explain",
    },
    "summarize_topic": {
        "category": IntentCategory.LEARN,
        "examples": [
            "summarize machine learning",
            "give me a summary of world war 2",
            "brief overview of python",
            "quick summary of calculus",
            "tldr on neural networks",
            "in a nutshell what is blockchain",
            "short version of quantum computing",
            "give me the gist of economics",
            "key points of data structures",
        ],
        "keywords": ["summary", "summarize", "brief", "overview", "tldr", "quick", "short", "nutshell", "gist", "key points"],
        "verbs": ["summarize", "brief", "overview"],
        "requires_topic": True,
        "response_type": "explain",
    },
    
    # ============ REVIEW INTENTS ============
    "review_flashcards": {
        "category": IntentCategory.REVIEW,
        "examples": [
            "review my flashcards",
            "study my cards",
            "practice flashcards",
            "i want to review",
            "let me study my flashcards",
            "time to review",
            "start a review session",
            "let's study",
            "ready to practice",
            "drill me on my cards",
            "i need to study",
            "time to memorize",
            "practice time",
        ],
        "keywords": ["review", "study", "practice", "revise", "drill", "memorize"],
        "verbs": ["review", "study", "practice", "revise"],
        "requires_topic": False,
        "response_type": "navigate",
    },
    
    # ============ ANALYSIS INTENTS ============
    "show_weak_areas": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "what are my weak areas",
            "show me where i struggle",
            "what do i need to improve",
            "my weaknesses",
            "where am i struggling",
            "what topics am i weak in",
            "show my weak points",
            "areas i need to work on",
            "where do i suck",
            "what am i bad at",
            "help me find my weak spots",
            "what's holding me back",
            "which subjects need work",
            "what should i focus on improving",
        ],
        "keywords": ["weak", "struggle", "improve", "weakness", "difficult", "hard", "bad", "focus"],
        "verbs": ["show", "find", "identify", "tell", "what"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_strong_areas": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "what are my strengths",
            "show me what i'm good at",
            "my strong areas",
            "where do i excel",
            "what topics am i strong in",
            "show my strong points",
            "what am i crushing it at",
            "where am i doing well",
            "my best subjects",
        ],
        "keywords": ["strong", "strength", "good", "excel", "best", "crushing"],
        "verbs": ["show", "find", "identify", "tell"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_progress": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "show my progress",
            "how am i doing",
            "my learning progress",
            "show my stats",
            "my statistics",
            "how have i been doing",
            "my performance",
            "how's my learning going",
            "am i making progress",
            "give me an update on my learning",
            "what's my status",
            "how far have i come",
        ],
        "keywords": ["progress", "stats", "statistics", "performance", "doing", "update", "status"],
        "verbs": ["show", "display", "tell", "how"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_learning_analytics": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "show my learning analytics",
            "my study analytics",
            "learning insights",
            "detailed stats",
            "my learning data",
            "analytics dashboard",
            "deep dive into my learning",
            "break down my performance",
        ],
        "keywords": ["analytics", "insights", "data", "detailed", "breakdown", "dashboard"],
        "verbs": ["show", "display", "get"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_knowledge_gaps": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "show my knowledge gaps",
            "what am i missing",
            "gaps in my knowledge",
            "what should i learn next",
            "blind spots",
            "missing knowledge",
            "what don't i know",
        ],
        "keywords": ["gap", "gaps", "missing", "blind spot", "lack", "don't know"],
        "verbs": ["show", "find", "identify"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_concepts_to_review": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "what should i review",
            "concepts to review",
            "what's due for review",
            "overdue reviews",
            "what do i need to review",
            "review schedule",
            "what's next to study",
        ],
        "keywords": ["review", "due", "overdue", "schedule", "next"],
        "verbs": ["show", "tell", "list", "what"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "show_recommended_topics": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "recommend topics",
            "what should i study",
            "suggested topics",
            "topic recommendations",
            "what to learn next",
            "suggest something to study",
        ],
        "keywords": ["recommend", "suggest", "next", "should study", "suggestion"],
        "verbs": ["recommend", "suggest", "show"],
        "requires_topic": False,
        "response_type": "explain",
    },
    "get_learning_path": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "learning path for machine learning",
            "how should i learn python",
            "roadmap for data science",
            "study plan for calculus",
            "path to learn programming",
            "guide me through learning AI",
            "step by step plan for web development",
        ],
        "keywords": ["path", "roadmap", "plan", "journey", "route", "guide", "step by step"],
        "verbs": ["get", "show", "create", "make"],
        "requires_topic": True,
        "response_type": "explain",
    },
    "detect_learning_style": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "what is my learning style",
            "how do i learn best",
            "my learning preference",
            "detect my learning style",
            "what kind of learner am i",
            "analyze how i learn",
            "what type of learner am i",
        ],
        "keywords": ["learning style", "learner", "preference", "how i learn", "type of learner"],
        "verbs": ["detect", "find", "identify", "show", "what", "analyze"],
        "requires_topic": False,
        "response_type": "explain",
    },
    
    # ============ SEARCH INTENTS ============
    "search_all": {
        "category": IntentCategory.SEARCH,
        "examples": [
            "search for machine learning",
            "find notes about python",
            "look for biology content",
            "search my content",
            "find something about chemistry",
            "look up calculus",
            "search flashcards on physics",
        ],
        "keywords": ["search", "find", "look", "locate", "look up"],
        "verbs": ["search", "find", "look", "locate"],
        "requires_topic": True,
        "response_type": "search",
    },
    
    # ============ CHAT INTENTS ============
    "start_chat": {
        "category": IntentCategory.CHAT,
        "examples": [
            "let's chat about physics",
            "talk to me about history",
            "discuss machine learning",
            "i want to chat about programming",
            "can we talk about math",
            "have a conversation about AI",
            "let's discuss databases",
        ],
        "keywords": ["chat", "talk", "discuss", "conversation", "converse"],
        "verbs": ["chat", "talk", "discuss", "converse"],
        "requires_topic": True,
        "response_type": "navigate",
    },
    
    # ============ HELP INTENTS ============
    "show_help": {
        "category": IntentCategory.HELP,
        "examples": [
            "help",
            "what can you do",
            "show me what you can do",
            "how do i use this",
            "commands",
            "features",
            "what are your capabilities",
            "how does this work",
        ],
        "keywords": ["help", "commands", "features", "how to", "what can", "capabilities"],
        "verbs": ["help", "show", "tell"],
        "requires_topic": False,
        "response_type": "chat",
    },
    
    # ============ FOLLOW-UP INTENTS ============
    "followup_more": {
        "category": IntentCategory.FOLLOWUP,
        "examples": [
            "more", "tell me more", "go on", "continue",
            "what else", "anything else", "more details",
            "elaborate", "expand on that",
        ],
        "keywords": ["more", "else", "continue", "elaborate", "expand", "details"],
        "verbs": ["tell", "go", "continue"],
        "requires_topic": False,
        "response_type": "followup",
    },
    "followup_yes": {
        "category": IntentCategory.FOLLOWUP,
        "examples": [
            "yes", "yeah", "yep", "sure", "ok", "okay",
            "yes please", "do it", "go ahead", "sounds good",
            "that's right", "correct", "exactly",
        ],
        "keywords": ["yes", "yeah", "yep", "sure", "ok", "okay", "correct", "right"],
        "verbs": [],
        "requires_topic": False,
        "response_type": "followup",
    },
    "followup_no": {
        "category": IntentCategory.FOLLOWUP,
        "examples": [
            "no", "nope", "nah", "not really", "never mind",
            "cancel", "stop", "forget it", "that's not what i meant",
        ],
        "keywords": ["no", "nope", "nah", "cancel", "stop", "forget", "never mind"],
        "verbs": [],
        "requires_topic": False,
        "response_type": "followup",
    },
}


# ==================== Synonym Mappings ====================

SYNONYMS = {
    # Action synonyms
    "create": ["make", "generate", "build", "produce", "craft", "prepare", "write", "draft"],
    "show": ["display", "reveal", "present", "give", "tell", "list", "view"],
    "explain": ["describe", "clarify", "elaborate", "teach", "tell about", "break down"],
    "review": ["study", "practice", "revise", "go over", "revisit"],
    "search": ["find", "look for", "locate", "discover", "seek"],
    
    # Content synonyms
    "flashcard": ["card", "study card", "revision card", "flash card"],
    "note": ["notes", "document", "article", "write-up"],
    "question": ["problem", "exercise", "practice question", "test question"],
    "quiz": ["test", "exam", "assessment", "evaluation"],
    
    # Analysis synonyms
    "weak": ["struggling", "difficult", "hard", "challenging", "poor"],
    "strong": ["good", "excellent", "proficient", "skilled", "mastered"],
    "progress": ["performance", "improvement", "advancement", "growth"],
}


# ==================== Filler Words ====================

FILLER_WORDS = {
    "please", "can", "could", "would", "will", "should", "might",
    "i", "me", "my", "you", "your", "we", "our", "the", "a", "an",
    "want", "need", "like", "help", "just", "really", "very",
    "some", "any", "this", "that", "these", "those",
    "to", "for", "with", "about", "on", "in", "at", "of",
    "and", "or", "but", "so", "if", "then", "when", "while",
    "be", "is", "are", "was", "were", "been", "being",
    "have", "has", "had", "do", "does", "did", "done",
    "get", "got", "getting", "let", "lets", "let's",
}


# ==================== Conversational Patterns ====================

CONVERSATIONAL_PATTERNS = {
    # Polite requests
    r"(?:can|could|would)\s+you\s+(?:please\s+)?(.+)": "polite_request",
    r"(?:i\s+)?(?:want|need|would\s+like)\s+(?:to\s+)?(.+)": "desire_statement",
    r"(?:help\s+me\s+)?(?:with\s+)?(.+)": "help_request",
    
    # Questions
    r"(?:what|how|why|when|where|who)\s+(.+)\??": "question",
    r"(?:is|are|can|does|do)\s+(.+)\??": "yes_no_question",
    
    # Commands
    r"(?:please\s+)?(?:show|tell|give|display)\s+(?:me\s+)?(.+)": "show_command",
    r"(?:let's|lets)\s+(.+)": "collaborative_command",
    
    # Confirmations
    r"^(?:yes|yeah|yep|sure|ok|okay|correct|right)$": "confirmation",
    r"^(?:no|nope|nah|cancel|stop)$": "negation",
}


# ==================== NLP Engine ====================

class NLPEngine:
    """
    Advanced NLP Engine for understanding natural language commands.
    Works like a smart chatbot - understands context, synonyms, and natural speech.
    Makes intelligent navigation decisions based on user intent.
    """
    
    def __init__(self, ai_client=None, model_name: str = "all-MiniLM-L6-v2"):
        self.ai_client = ai_client
        self.model_name = model_name
        self._model = None
        self._intent_embeddings = None
        self._conversation_contexts: Dict[str, ConversationContext] = {}
        
        # Initialize embeddings if available
        if HAS_SENTENCE_TRANSFORMERS:
            self._initialize_embeddings()
    
    def _initialize_embeddings(self):
        """Initialize sentence transformer model and compute intent embeddings"""
        try:
            self._model = SentenceTransformer(self.model_name)
            self._compute_intent_embeddings()
            logger.info(f"NLP Engine initialized with {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize sentence transformer: {e}")
            self._model = None
    
    def _compute_intent_embeddings(self):
        """Pre-compute embeddings for all intent examples"""
        if not self._model:
            return
        
        self._intent_embeddings = {}
        for intent_name, intent_data in INTENT_DEFINITIONS.items():
            examples = intent_data["examples"]
            embeddings = self._model.encode(examples)
            self._intent_embeddings[intent_name] = {
                "embeddings": embeddings,
                "examples": examples,
            }
        logger.info(f"Computed embeddings for {len(self._intent_embeddings)} intents")
    
    def _get_context(self, user_id: str) -> ConversationContext:
        """Get or create conversation context for user"""
        if user_id not in self._conversation_contexts:
            self._conversation_contexts[user_id] = ConversationContext()
        return self._conversation_contexts[user_id]
    
    def _update_context(self, user_id: str, intent: str, entities: Dict[str, Any], query: str, navigation: Optional[str] = None):
        """Update conversation context after processing"""
        context = self._get_context(user_id)
        context.last_action = intent
        context.last_topic = entities.get("topic")
        context.last_entities = entities
        context.last_navigation = navigation
        context.conversation_history.append({
            "query": query,
            "intent": intent,
            "entities": entities,
            "navigation": navigation,
            "timestamp": datetime.utcnow().isoformat()
        })
        # Keep only last 10 interactions
        if len(context.conversation_history) > 10:
            context.conversation_history = context.conversation_history[-10:]
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for better matching"""
        # Lowercase
        normalized = query.lower().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove punctuation except apostrophes
        normalized = re.sub(r"[^\w\s']", ' ', normalized)
        
        return normalized.strip()
    
    def _expand_synonyms(self, query: str) -> str:
        """Expand query with synonyms for better matching"""
        words = query.split()
        expanded_words = []
        
        for word in words:
            expanded_words.append(word)
            # Add synonyms
            for key, synonyms in SYNONYMS.items():
                if word == key or word in synonyms:
                    expanded_words.extend([key] + synonyms[:2])
                    break
        
        return ' '.join(expanded_words)
    
    def _extract_topic(self, query: str, intent_data: Dict) -> Optional[str]:
        """Extract topic from query based on intent patterns"""
        normalized = self._normalize_query(query)
        
        # Remove filler words
        words = normalized.split()
        content_words = [w for w in words if w not in FILLER_WORDS]
        
        # Remove action verbs
        verbs = intent_data.get("verbs", [])
        keywords = intent_data.get("keywords", [])
        
        topic_words = []
        skip_next = False
        
        for i, word in enumerate(content_words):
            if skip_next:
                skip_next = False
                continue
            
            # Skip verbs and keywords
            if word in verbs or word in keywords:
                continue
            
            # Skip prepositions that introduce topics
            if word in ["about", "on", "for", "regarding", "concerning"]:
                continue
            
            topic_words.append(word)
        
        topic = ' '.join(topic_words).strip()
        
        # Clean up topic
        topic = re.sub(r'^(a|an|the|some)\s+', '', topic)
        
        return topic if topic else None
    
    def _extract_count(self, query: str) -> Optional[int]:
        """Extract count/number from query - only when explicitly specified"""
        query_lower = query.lower()
        
        # Check for digit numbers followed by content type keywords
        match = re.search(r'(\d+)\s*(?:flashcard|question|card|problem|quiz)', query_lower)
        if match:
            return int(match.group(1))
        
        # Check for word numbers ONLY when followed by content keywords
        number_words = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "fifteen": 15, "twenty": 20
        }
        
        for word, num in number_words.items():
            # Only match if followed by content type keyword
            pattern = rf'\b{word}\s+(?:flashcard|question|card|problem|quiz)'
            if re.search(pattern, query_lower):
                return num
        
        return None
    
    def _detect_conversational_pattern(self, query: str) -> Tuple[Optional[str], Optional[str]]:
        """Detect conversational patterns in the query"""
        normalized = self._normalize_query(query)
        
        for pattern, pattern_type in CONVERSATIONAL_PATTERNS.items():
            match = re.match(pattern, normalized)
            if match:
                extracted = match.group(1) if match.groups() else normalized
                return pattern_type, extracted
        
        return None, normalized
    
    def _semantic_match(self, query: str) -> Tuple[str, float]:
        """Use semantic similarity to match intent"""
        if not self._model or not self._intent_embeddings:
            return None, 0.0
        
        try:
            query_embedding = self._model.encode([query])
            
            best_intent = None
            best_score = 0.0
            
            for intent_name, data in self._intent_embeddings.items():
                similarities = cosine_similarity(query_embedding, data["embeddings"])[0]
                max_sim = float(np.max(similarities))
                
                if max_sim > best_score:
                    best_score = max_sim
                    best_intent = intent_name
            
            return best_intent, best_score
            
        except Exception as e:
            logger.error(f"Semantic matching failed: {e}")
            return None, 0.0
    
    def _keyword_match(self, query: str) -> Tuple[str, float]:
        """Use keyword matching as fallback - improved version"""
        normalized = self._normalize_query(query)
        words = set(normalized.split())
        
        # First check for specific create patterns (high priority)
        create_patterns = [
            # Note patterns
            (r'\bnote[s]?\s+(?:on|about|for)\s+\w+', 'create_note', 0.85),
            (r'\bnote[s]?\s+\w+', 'create_note', 0.75),
            (r'(?:create|make|write|draft)\s+(?:a\s+)?note', 'create_note', 0.9),
            # Flashcard patterns
            (r'\bflashcard[s]?\s+(?:on|about|for)\s+\w+', 'create_flashcards', 0.85),
            (r'\bcard[s]?\s+(?:on|about|for)\s+\w+', 'create_flashcards', 0.8),
            (r'(?:create|make|generate)\s+(?:\d+\s+)?flashcard', 'create_flashcards', 0.9),
            (r'\d+\s+flashcard', 'create_flashcards', 0.85),
            # Question patterns
            (r'\bquestion[s]?\s+(?:on|about|for)\s+\w+', 'create_questions', 0.85),
            (r'(?:create|make|generate)\s+(?:\d+\s+)?question', 'create_questions', 0.9),
            (r'practice\s+(?:question|problem)', 'create_questions', 0.8),
            # Quiz patterns
            (r'quiz\s+(?:me\s+)?(?:on|about)\s+\w+', 'create_quiz', 0.9),
            (r'test\s+(?:me\s+)?(?:on|about)\s+\w+', 'create_quiz', 0.85),
            # Analytics patterns (high priority - user asking about themselves)
            (r'(?:what|show|tell).*\bmy\s+learning\s+style', 'detect_learning_style', 0.95),
            (r'(?:what|how)\s+(?:kind|type)\s+(?:of\s+)?learner\s+am\s+i', 'detect_learning_style', 0.95),
            (r'how\s+do\s+i\s+learn\s+best', 'detect_learning_style', 0.95),
            (r'(?:what|show).*\bmy\s+(?:weak|weakness)', 'show_weak_areas', 0.95),
            (r'(?:what|where)\s+(?:am\s+i|do\s+i)\s+(?:weak|struggling|bad)', 'show_weak_areas', 0.95),
            (r'(?:what|where).*\bweak\s+area', 'show_weak_areas', 0.95),
            (r'\bmy\s+weak(?:ness|areas?)?', 'show_weak_areas', 0.9),
            (r'(?:what|show).*\bmy\s+(?:strong|strength)', 'show_strong_areas', 0.95),
            (r'(?:what|show).*\bmy\s+progress', 'show_progress', 0.95),
            (r'how\s+am\s+i\s+doing', 'show_progress', 0.9),
            (r'(?:what|show).*\bmy\s+(?:knowledge\s+)?gap', 'show_knowledge_gaps', 0.95),
            # Greeting patterns
            (r'^(?:hi|hello|hey|yo|sup|howdy)(?:\s|$)', 'greeting', 0.95),
            (r'^good\s+(?:morning|afternoon|evening)', 'greeting', 0.95),
            # Help patterns
            (r'^help$', 'show_help', 0.95),
            (r'what\s+can\s+you\s+do', 'show_help', 0.9),
            # Follow-up patterns
            (r'^(?:yes|yeah|yep|sure|ok|okay)$', 'followup_yes', 0.95),
            (r'^(?:no|nope|nah|cancel|stop)$', 'followup_no', 0.95),
            (r'^(?:more|tell\s+me\s+more|continue|go\s+on)$', 'followup_more', 0.95),
        ]
        
        for pattern, intent, score in create_patterns:
            if re.search(pattern, normalized):
                return intent, score
        
        best_intent = None
        best_score = 0.0
        
        for intent_name, intent_data in INTENT_DEFINITIONS.items():
            score = 0.0
            
            # Check keywords - look for substring matches too
            keywords = intent_data.get("keywords", [])
            for keyword in keywords:
                if keyword in normalized:  # Substring match
                    score += 0.4
            
            # Check verbs - exact word match
            verbs = set(intent_data.get("verbs", []))
            verb_matches = len(words & verbs)
            score += verb_matches * 0.3
            
            if score > best_score:
                best_score = score
                best_intent = intent_name
        
        return best_intent, min(best_score, 1.0)
    
    def _use_context(self, query: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Use conversation context to resolve ambiguous queries"""
        context = self._get_context(user_id)
        normalized = self._normalize_query(query)
        
        # Check for pronouns or references to previous topic
        if any(word in normalized for word in ["it", "that", "this", "same", "more", "another"]):
            if context.last_topic:
                return {
                    "topic": context.last_topic,
                    "from_context": True
                }
        
        # Check for continuation patterns
        if any(phrase in normalized for phrase in ["again", "one more", "another one", "same thing"]):
            if context.last_action:
                return {
                    "action": context.last_action,
                    "topic": context.last_topic,
                    "from_context": True
                }
        
        return None
    
    def _handle_followup(self, intent: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Handle follow-up intents based on conversation context"""
        context = self._get_context(user_id)
        
        if intent == "followup_yes" and context.pending_clarification:
            # User confirmed a pending action
            return {
                "action": context.pending_clarification,
                "topic": context.last_topic,
                "confirmed": True
            }
        elif intent == "followup_no":
            # User cancelled
            context.pending_clarification = None
            return {"cancelled": True}
        elif intent == "followup_more" and context.last_topic:
            # User wants more info on last topic
            return {
                "action": "explain_topic",
                "topic": context.last_topic,
                "expand": True
            }
        
        return None
    
    def _detect_language(self, query: str) -> str:
        """Detect query language"""
        if not HAS_LANGDETECT:
            return "en"
        
        try:
            return detect_language(query)
        except:
            return "en"
    
    def _get_navigation_target(self, intent: str, entities: Dict[str, Any]) -> Tuple[Optional[str], Dict[str, Any]]:
        """Determine navigation target based on intent"""
        nav_template = INTENT_NAVIGATION.get(intent)
        nav_params = {}
        
        if nav_template:
            # Replace placeholders with actual values
            if "{id}" in nav_template:
                content_id = entities.get("content_id")
                if content_id:
                    nav_template = nav_template.replace("{id}", str(content_id))
                else:
                    # Will be filled after content creation
                    nav_template = nav_template.replace("{id}", "")
            
            if entities.get("topic"):
                nav_params["topic"] = entities["topic"]
            if entities.get("count"):
                nav_params["count"] = entities["count"]
        
        return nav_template, nav_params
    
    async def understand(self, query: str, user_id: str = "default") -> IntentMatch:
        """
        Main method to understand user intent from natural language.
        Combines semantic matching, keyword matching, and context awareness.
        Works like a chatbot - understands conversational patterns and makes navigation decisions.
        """
        normalized = self._normalize_query(query)
        language = self._detect_language(query)
        
        # Detect conversational pattern
        pattern_type, extracted_query = self._detect_conversational_pattern(query)
        
        # Try context resolution first
        context_info = self._use_context(query, user_id)
        
        # Keyword matching first (has specific patterns for create commands)
        keyword_intent, keyword_score = self._keyword_match(normalized)
        
        # Semantic matching
        semantic_intent, semantic_score = self._semantic_match(normalized)
        
        # Combine scores - prioritize keyword matching for high-confidence patterns
        if keyword_score >= 0.75:
            # High confidence keyword match (specific patterns like "note on X")
            best_intent = keyword_intent
            confidence = keyword_score
        elif semantic_score >= 0.7:
            best_intent = semantic_intent
            confidence = semantic_score
        elif keyword_score >= 0.5:
            best_intent = keyword_intent
            confidence = keyword_score
        elif semantic_score >= 0.5:
            best_intent = semantic_intent
            confidence = semantic_score
        else:
            # Default to explain_topic for unknown queries
            best_intent = "explain_topic"
            confidence = 0.4
        
        # Handle follow-up intents
        if best_intent in ["followup_yes", "followup_no", "followup_more"]:
            followup_result = self._handle_followup(best_intent, user_id)
            if followup_result:
                if followup_result.get("cancelled"):
                    return IntentMatch(
                        intent="cancelled",
                        confidence=1.0,
                        entities={},
                        context_used=True,
                        original_query=query,
                        normalized_query=normalized,
                        language=language,
                        response_type="chat"
                    )
                elif followup_result.get("action"):
                    best_intent = followup_result["action"]
                    context_info = followup_result
        
        # Extract entities
        intent_data = INTENT_DEFINITIONS.get(best_intent, {})
        entities = {}
        
        # Extract topic
        if intent_data.get("requires_topic", False):
            topic = self._extract_topic(query, intent_data)
            if topic:
                entities["topic"] = topic
            elif context_info and context_info.get("topic"):
                entities["topic"] = context_info["topic"]
                entities["from_context"] = True
        
        # Extract count
        count = self._extract_count(query)
        if count:
            entities["count"] = count
        
        # Use context if available
        if context_info:
            if "action" in context_info and confidence < 0.5:
                best_intent = context_info["action"]
                confidence = 0.6
            entities["context_used"] = True
        
        # Get navigation target
        nav_target, nav_params = self._get_navigation_target(best_intent, entities)
        
        # Get response type
        response_type = intent_data.get("response_type", "action")
        
        # Update context
        self._update_context(user_id, best_intent, entities, query, nav_target)
        
        return IntentMatch(
            intent=best_intent,
            confidence=confidence,
            entities=entities,
            context_used=bool(context_info),
            original_query=query,
            normalized_query=normalized,
            language=language,
            navigation_target=nav_target,
            navigation_params=nav_params,
            response_type=response_type
        )
    
    async def understand_with_ai(self, query: str, user_id: str = "default") -> IntentMatch:
        """
        Use AI for complex queries that can't be matched with patterns.
        Falls back to pattern matching if AI is unavailable.
        """
        # First try pattern/semantic matching
        result = await self.understand(query, user_id)
        
        # If confidence is low and AI is available, use AI
        if result.confidence < 0.5 and self.ai_client:
            try:
                ai_result = await self._ai_classify(query)
                if ai_result and ai_result.get("confidence", 0) > result.confidence:
                    # Get intent data for response type
                    intent_data = INTENT_DEFINITIONS.get(ai_result["intent"], {})
                    nav_target, nav_params = self._get_navigation_target(
                        ai_result["intent"], 
                        ai_result.get("entities", {})
                    )
                    
                    return IntentMatch(
                        intent=ai_result["intent"],
                        confidence=ai_result["confidence"],
                        entities=ai_result.get("entities", {}),
                        context_used=False,
                        original_query=query,
                        normalized_query=self._normalize_query(query),
                        language=result.language,
                        navigation_target=nav_target,
                        navigation_params=nav_params,
                        response_type=intent_data.get("response_type", "action")
                    )
            except Exception as e:
                logger.error(f"AI classification failed: {e}")
        
        return result
    
    async def _ai_classify(self, query: str) -> Optional[Dict[str, Any]]:
        """Use AI to classify intent"""
        if not self.ai_client:
            return None
        
        intent_list = "\n".join([f"- {name}: {data.get('examples', [''])[0]}" 
                                  for name, data in INTENT_DEFINITIONS.items()])
        
        prompt = f"""You are a smart assistant that understands user requests. Classify this user request and extract the topic.

User query: "{query}"

Available intents:
{intent_list}

Analyze the query carefully:
1. What is the user trying to do?
2. What topic are they asking about (if any)?
3. How confident are you in this classification?

Return JSON only:
{{"intent": "intent_name", "topic": "extracted topic or null", "confidence": 0.0-1.0}}"""

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
                    "intent": result.get("intent", "explain_topic"),
                    "confidence": result.get("confidence", 0.6),
                    "entities": {"topic": result.get("topic")} if result.get("topic") else {}
                }
        except Exception as e:
            logger.error(f"AI classification parsing failed: {e}")
        
        return None
    
    def get_suggestions(self, partial_query: str, user_id: str = "default") -> List[str]:
        """Get autocomplete suggestions based on partial query and user context"""
        context = self._get_context(user_id)
        suggestions = []
        
        partial_lower = partial_query.lower().strip()
        
        # Add context-aware suggestions based on last topic
        if context.last_topic:
            suggestions.extend([
                f"create flashcards on {context.last_topic}",
                f"quiz me on {context.last_topic}",
                f"explain {context.last_topic}",
                f"create a note on {context.last_topic}",
            ])
        
        # Add suggestions based on partial query
        if partial_lower:
            # Match against intent examples
            for intent_name, intent_data in INTENT_DEFINITIONS.items():
                for example in intent_data["examples"][:3]:
                    if partial_lower in example.lower() or example.lower().startswith(partial_lower):
                        suggestions.append(example)
            
            # Add topic-based suggestions if partial looks like a topic
            if len(partial_lower) > 3 and not any(kw in partial_lower for kw in ["create", "make", "show", "what", "how"]):
                suggestions.extend([
                    f"explain {partial_lower}",
                    f"create flashcards on {partial_lower}",
                    f"quiz me on {partial_lower}",
                    f"create a note on {partial_lower}",
                ])
        else:
            # Default suggestions when no query
            suggestions.extend([
                "what are my weak areas",
                "show my progress",
                "what should I study next",
                "create flashcards on [topic]",
                "explain [topic]",
                "quiz me on [topic]",
            ])
        
        # Deduplicate and limit
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            s_lower = s.lower()
            if s_lower not in seen:
                seen.add(s_lower)
                unique_suggestions.append(s)
        
        return unique_suggestions[:8]
    
    def get_chatbot_response(self, intent: str, entities: Dict[str, Any], user_id: str = "default") -> str:
        """Generate a chatbot-like response based on intent"""
        context = self._get_context(user_id)
        topic = entities.get("topic", "")
        
        responses = {
            "greeting": [
                "Hey! How can I help you learn today?",
                "Hi there! Ready to study something?",
                "Hello! What would you like to learn about?",
            ],
            "show_help": [
                "I can help you with:\n• Creating flashcards, notes, and quizzes\n• Explaining topics\n• Tracking your progress\n• Finding your weak areas\n\nJust ask naturally!",
            ],
            "create_note": [
                f"Creating a comprehensive note on {topic}...",
                f"Let me write up some notes on {topic} for you...",
            ],
            "create_flashcards": [
                f"Generating flashcards on {topic}...",
                f"Creating study cards for {topic}...",
            ],
            "create_quiz": [
                f"Starting a quiz on {topic}...",
                f"Let's test your knowledge of {topic}!",
            ],
            "explain_topic": [
                f"Let me explain {topic} for you...",
                f"Here's what you need to know about {topic}...",
            ],
            "show_weak_areas": [
                "Let me check your learning analytics...",
                "Looking at your study data...",
            ],
            "show_progress": [
                "Here's how you've been doing...",
                "Let me show you your progress...",
            ],
        }
        
        import random
        intent_responses = responses.get(intent, [f"Processing your request..."])
        return random.choice(intent_responses)
    
    def clear_context(self, user_id: str):
        """Clear conversation context for user"""
        if user_id in self._conversation_contexts:
            del self._conversation_contexts[user_id]


# ==================== Singleton Instance ====================

_nlp_engine_instance: Optional[NLPEngine] = None


def get_nlp_engine(ai_client=None) -> NLPEngine:
    """Get or create NLP engine singleton"""
    global _nlp_engine_instance
    if _nlp_engine_instance is None:
        _nlp_engine_instance = NLPEngine(ai_client=ai_client)
    return _nlp_engine_instance
