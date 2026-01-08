"""
Test script for the Enhanced NLP Engine
Run with: python test_nlp_engine.py
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_nlp_engine():
    """Test the NLP engine with various queries"""
    
    print("=" * 60)
    print("Testing Enhanced SearchHub NLP Engine")
    print("=" * 60)
    
    # Import the actual NLP engine
    try:
        from agents.nlp_engine import NLPEngine, INTENT_DEFINITIONS, INTENT_NAVIGATION
        nlp = NLPEngine()
        print("✓ NLP Engine imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import NLP Engine: {e}")
        print("Running simplified test instead...")
        await run_simplified_test()
        return
    
    test_queries = [
        # Greetings
        ("hi", "greeting", None),
        ("hello there", "greeting", None),
        ("hey", "greeting", None),
        
        # Creation - Standard
        ("create flashcards on machine learning", "create_flashcards", "machine learning"),
        ("make a note about python programming", "create_note", "python programming"),
        ("quiz me on calculus", "create_quiz", "calculus"),
        ("create 10 flashcards on biology", "create_flashcards", "biology"),
        
        # Creation - Conversational
        ("i need some flashcards about biology", "create_flashcards", "biology"),
        ("can you make me a note on physics", "create_note", "physics"),
        ("help me create questions about chemistry", "create_questions", "chemistry"),
        
        # Learning - Standard
        ("explain neural networks", "explain_topic", "neural networks"),
        ("what is quantum computing", "explain_topic", "quantum computing"),
        ("how does photosynthesis work", "explain_topic", "photosynthesis"),
        ("teach me about databases", "explain_topic", "databases"),
        
        # Learning - Conversational
        ("i don't understand recursion", "explain_topic", "recursion"),
        ("break down machine learning for me", "explain_topic", "machine learning"),
        
        # Analytics
        ("show my progress", "show_progress", None),
        ("what are my weak areas", "show_weak_areas", None),
        ("how am i doing", "show_progress", None),
        ("what is my learning style", "detect_learning_style", None),
        ("show my knowledge gaps", "show_knowledge_gaps", None),
        
        # Review
        ("review my flashcards", "review_flashcards", None),
        ("let's study", "review_flashcards", None),
        ("time to practice", "review_flashcards", None),
        
        # Search
        ("search for python notes", "search_all", "python"),
        ("find my flashcards on math", "search_all", "math"),
        
        # Chat
        ("let's chat about physics", "start_chat", "physics"),
        ("talk to me about history", "start_chat", "history"),
        
        # Help
        ("help", "show_help", None),
        ("what can you do", "show_help", None),
        
        # Follow-ups
        ("yes", "followup_yes", None),
        ("no", "followup_no", None),
        ("tell me more", "followup_more", None),
    ]
    
    print("\nTesting intent detection:\n")
    
    correct = 0
    total = len(test_queries)
    
    for query, expected_intent, expected_topic in test_queries:
        result = await nlp.understand(query, user_id="test_user")
        
        confidence_bar = "█" * int(result.confidence * 10) + "░" * (10 - int(result.confidence * 10))
        is_correct = result.intent == expected_intent
        status = "✓" if is_correct else "✗"
        
        if is_correct:
            correct += 1
        
        print(f"{status} Query: \"{query}\"")
        print(f"  Intent: {result.intent} (expected: {expected_intent})")
        print(f"  Confidence: [{confidence_bar}] {result.confidence:.2f}")
        print(f"  Response Type: {result.response_type}")
        if result.entities:
            print(f"  Entities: {result.entities}")
        if result.navigation_target:
            print(f"  Navigation: {result.navigation_target}")
        print()
    
    print(f"\nAccuracy: {correct}/{total} ({correct/total*100:.1f}%)")
    
    # Test suggestions
    print("\n" + "=" * 60)
    print("Testing autocomplete suggestions:")
    print("=" * 60 + "\n")
    
    partial_queries = ["create", "show", "what", "quiz", "explain", ""]
    
    for partial in partial_queries:
        suggestions = nlp.get_suggestions(partial, "test_user")
        print(f"Partial: \"{partial or '(empty)'}\"")
        print(f"  Suggestions: {suggestions[:5]}")
        print()
    
    # Test chatbot responses
    print("\n" + "=" * 60)
    print("Testing chatbot responses:")
    print("=" * 60 + "\n")
    
    test_intents = [
        ("greeting", {}),
        ("create_flashcards", {"topic": "machine learning"}),
        ("show_progress", {}),
        ("explain_topic", {"topic": "neural networks"}),
    ]
    
    for intent, entities in test_intents:
        response = nlp.get_chatbot_response(intent, entities, "test_user")
        print(f"Intent: {intent}")
        print(f"  Response: {response}")
        print()
    
    # Test navigation targets
    print("\n" + "=" * 60)
    print("Testing navigation targets:")
    print("=" * 60 + "\n")
    
    for intent, nav_target in INTENT_NAVIGATION.items():
        print(f"  {intent}: {nav_target or '(stays on page)'}")
    
    print("\n" + "=" * 60)
    print("NLP Engine test complete!")
    print("=" * 60)


async def run_simplified_test():
    """Run simplified test without full dependencies"""
    import re
    from typing import Dict, Any, List, Optional, Tuple
    from dataclasses import dataclass, field
    from enum import Enum
    
    class IntentCategory(str, Enum):
        CREATE = "create"
        SEARCH = "search"
        LEARN = "learn"
        REVIEW = "review"
        ANALYZE = "analyze"
        NAVIGATE = "navigate"
        CHAT = "chat"
        HELP = "help"
        GREETING = "greeting"
    
    @dataclass
    class IntentMatch:
        intent: str
        confidence: float
        entities: Dict[str, Any] = field(default_factory=dict)
        response_type: str = "action"
        navigation_target: Optional[str] = None
    
    INTENT_DEFINITIONS = {
        "greeting": {
            "keywords": ["hi", "hello", "hey"],
            "verbs": [],
            "requires_topic": False,
        },
        "create_note": {
            "keywords": ["note", "notes", "write", "draft"],
            "verbs": ["create", "make", "write"],
            "requires_topic": True,
        },
        "create_flashcards": {
            "keywords": ["flashcard", "flashcards", "cards"],
            "verbs": ["create", "make", "generate"],
            "requires_topic": True,
        },
        "create_quiz": {
            "keywords": ["quiz", "test"],
            "verbs": ["quiz", "test", "create"],
            "requires_topic": True,
        },
        "explain_topic": {
            "keywords": ["explain", "what", "how", "teach"],
            "verbs": ["explain", "tell", "teach"],
            "requires_topic": True,
        },
        "show_progress": {
            "keywords": ["progress", "stats", "doing"],
            "verbs": ["show", "display"],
            "requires_topic": False,
        },
        "show_weak_areas": {
            "keywords": ["weak", "struggle", "bad"],
            "verbs": ["show", "find"],
            "requires_topic": False,
        },
        "show_help": {
            "keywords": ["help", "commands", "what can"],
            "verbs": ["help", "show"],
            "requires_topic": False,
        },
    }
    
    FILLER_WORDS = {"please", "can", "could", "would", "i", "me", "my", "you", "the", "a", "an", "to", "for", "with", "about", "on"}
    
    def normalize(query):
        return re.sub(r'\s+', ' ', re.sub(r"[^\w\s']", ' ', query.lower().strip())).strip()
    
    def keyword_match(query):
        normalized = normalize(query)
        words = set(normalized.split())
        
        # Check greeting first
        if normalized in ["hi", "hello", "hey"] or normalized.startswith("hi ") or normalized.startswith("hello "):
            return "greeting", 0.95
        
        # Check for specific patterns
        patterns = [
            (r'\bweak\s+area', 'show_weak_areas', 0.95),
            (r'\bmy\s+weak', 'show_weak_areas', 0.9),
            (r'where.*\bstruggl', 'show_weak_areas', 0.9),
        ]
        
        for pattern, intent, score in patterns:
            if re.search(pattern, normalized):
                return intent, score
        
        best_intent = None
        best_score = 0.0
        
        for intent_name, intent_data in INTENT_DEFINITIONS.items():
            score = 0.0
            for keyword in intent_data.get("keywords", []):
                if keyword in normalized:
                    score += 0.4
            for verb in intent_data.get("verbs", []):
                if verb in words:
                    score += 0.3
            if score > best_score:
                best_score = score
                best_intent = intent_name
        
        return best_intent or "explain_topic", min(best_score, 1.0) or 0.4
    
    def extract_topic(query, intent_data):
        normalized = normalize(query)
        words = [w for w in normalized.split() if w not in FILLER_WORDS]
        verbs = intent_data.get("verbs", [])
        keywords = intent_data.get("keywords", [])
        topic_words = [w for w in words if w not in verbs and w not in keywords and w not in ["about", "on", "for"]]
        return ' '.join(topic_words).strip() or None
    
    test_queries = [
        ("hi", "greeting"),
        ("create flashcards on machine learning", "create_flashcards"),
        ("make a note about python", "create_note"),
        ("quiz me on calculus", "create_quiz"),
        ("explain neural networks", "explain_topic"),
        ("show my progress", "show_progress"),
        ("what are my weak areas", "show_weak_areas"),
        ("help", "show_help"),
    ]
    
    print("\nTesting intent detection (simplified):\n")
    
    correct = 0
    for query, expected in test_queries:
        intent, confidence = keyword_match(query)
        is_correct = intent == expected
        status = "✓" if is_correct else "✗"
        if is_correct:
            correct += 1
        
        intent_data = INTENT_DEFINITIONS.get(intent, {})
        topic = extract_topic(query, intent_data) if intent_data.get("requires_topic") else None
        
        print(f"{status} \"{query}\" -> {intent} (expected: {expected})")
        if topic:
            print(f"    Topic: {topic}")
    
    print(f"\nAccuracy: {correct}/{len(test_queries)} ({correct/len(test_queries)*100:.1f}%)")


if __name__ == "__main__":
    asyncio.run(test_nlp_engine())
