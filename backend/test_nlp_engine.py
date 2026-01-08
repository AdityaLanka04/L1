"""
Test script for the NLP Engine
Run with: python test_nlp_engine.py
"""

import asyncio
import sys
import os
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Simple test without full dependencies

class IntentCategory(str, Enum):
    CREATE = "create"
    SEARCH = "search"
    LEARN = "learn"
    REVIEW = "review"
    ANALYZE = "analyze"
    NAVIGATE = "navigate"
    CHAT = "chat"
    HELP = "help"


@dataclass
class IntentMatch:
    intent: str
    confidence: float
    entities: Dict[str, Any] = field(default_factory=dict)
    context_used: bool = False
    original_query: str = ""
    normalized_query: str = ""
    language: str = "en"


# Simplified intent definitions for testing
INTENT_DEFINITIONS = {
    "create_note": {
        "category": IntentCategory.CREATE,
        "examples": [
            "create a note about machine learning",
            "make notes on python programming",
            "write a note about calculus",
            "i want to create notes about physics",
            "gimme a note about world history",
        ],
        "keywords": ["note", "notes", "write", "draft", "document"],
        "verbs": ["create", "make", "write", "start", "draft", "new"],
        "requires_topic": True,
    },
    "create_flashcards": {
        "category": IntentCategory.CREATE,
        "examples": [
            "create flashcards about photosynthesis",
            "make 10 flashcards on spanish vocabulary",
            "i need flashcards about world war 2",
            "gimme some flashcards on biology",
        ],
        "keywords": ["flashcard", "flashcards", "cards", "study cards"],
        "verbs": ["create", "make", "generate", "build"],
        "requires_topic": True,
    },
    "create_quiz": {
        "category": IntentCategory.CREATE,
        "examples": [
            "quiz me on machine learning",
            "test me about python",
            "create a quiz about biology",
            "challenge me on algorithms",
        ],
        "keywords": ["quiz", "test", "exam", "challenge"],
        "verbs": ["quiz", "test", "create", "start", "take", "challenge"],
        "requires_topic": True,
    },
    "explain_topic": {
        "category": IntentCategory.LEARN,
        "examples": [
            "explain machine learning to me",
            "what is quantum computing",
            "how does photosynthesis work",
            "break down neural networks for me",
            "eli5 recursion",
        ],
        "keywords": ["explain", "what", "how", "tell", "teach", "understand"],
        "verbs": ["explain", "tell", "teach", "describe"],
        "requires_topic": True,
    },
    "show_weak_areas": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "what are my weak areas",
            "show me where i struggle",
            "where am i struggling",
            "what am i bad at",
        ],
        "keywords": ["weak", "struggle", "improve", "weakness", "bad"],
        "verbs": ["show", "find", "identify", "tell"],
        "requires_topic": False,
    },
    "show_progress": {
        "category": IntentCategory.ANALYZE,
        "examples": [
            "show my progress",
            "how am i doing",
            "my learning progress",
            "show my stats",
        ],
        "keywords": ["progress", "stats", "statistics", "performance", "doing"],
        "verbs": ["show", "display", "tell"],
        "requires_topic": False,
    },
    "show_help": {
        "category": IntentCategory.HELP,
        "examples": [
            "help",
            "what can you do",
            "show me what you can do",
        ],
        "keywords": ["help", "commands", "features", "what can"],
        "verbs": ["help", "show", "tell"],
        "requires_topic": False,
    },
}

FILLER_WORDS = {
    "please", "can", "could", "would", "will", "should",
    "i", "me", "my", "you", "your", "the", "a", "an",
    "want", "need", "like", "help", "just",
    "some", "any", "this", "that",
    "to", "for", "with", "about", "on", "in", "at", "of",
}


class SimpleNLPEngine:
    """Simplified NLP Engine for testing"""
    
    def __init__(self):
        self._conversation_contexts = {}
    
    def _normalize_query(self, query: str) -> str:
        normalized = query.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        normalized = re.sub(r"[^\w\s']", ' ', normalized)
        return normalized.strip()
    
    def _extract_topic(self, query: str, intent_data: Dict) -> Optional[str]:
        normalized = self._normalize_query(query)
        words = normalized.split()
        content_words = [w for w in words if w not in FILLER_WORDS]
        
        verbs = intent_data.get("verbs", [])
        keywords = intent_data.get("keywords", [])
        
        topic_words = []
        for word in content_words:
            if word in verbs or word in keywords:
                continue
            if word in ["about", "on", "for", "regarding"]:
                continue
            topic_words.append(word)
        
        topic = ' '.join(topic_words).strip()
        topic = re.sub(r'^(a|an|the|some)\s+', '', topic)
        return topic if topic else None
    
    def _keyword_match(self, query: str) -> Tuple[str, float]:
        normalized = self._normalize_query(query)
        words = set(normalized.split())
        
        best_intent = None
        best_score = 0.0
        
        for intent_name, intent_data in INTENT_DEFINITIONS.items():
            score = 0.0
            
            # Check keywords - higher weight
            keywords = set(intent_data.get("keywords", []))
            for keyword in keywords:
                if keyword in normalized:  # Check if keyword appears anywhere
                    score += 0.4
            
            # Check verbs
            verbs = set(intent_data.get("verbs", []))
            for verb in verbs:
                if verb in words:
                    score += 0.3
            
            # Normalize score
            if score > best_score:
                best_score = score
                best_intent = intent_name
        
        # Cap at 1.0
        return best_intent, min(best_score, 1.0)
    
    async def understand(self, query: str, user_id: str = "default") -> IntentMatch:
        normalized = self._normalize_query(query)
        
        # Keyword matching
        best_intent, confidence = self._keyword_match(normalized)
        
        if not best_intent or confidence < 0.3:
            best_intent = "explain_topic"
            confidence = 0.4
        
        # Extract entities
        intent_data = INTENT_DEFINITIONS.get(best_intent, {})
        entities = {}
        
        if intent_data.get("requires_topic", False):
            topic = self._extract_topic(query, intent_data)
            if topic:
                entities["topic"] = topic
        
        # Extract count
        count_match = re.search(r'(\d+)\s*(?:flashcard|question|card)', query.lower())
        if count_match:
            entities["count"] = int(count_match.group(1))
        
        return IntentMatch(
            intent=best_intent,
            confidence=confidence,
            entities=entities,
            original_query=query,
            normalized_query=normalized
        )
    
    def get_suggestions(self, partial_query: str, user_id: str = "default") -> List[str]:
        suggestions = []
        partial_lower = partial_query.lower().strip()
        
        for intent_name, intent_data in INTENT_DEFINITIONS.items():
            for example in intent_data["examples"][:2]:
                if partial_lower in example.lower() or example.lower().startswith(partial_lower):
                    suggestions.append(example)
        
        return suggestions[:8]


async def test_nlp_engine():
    """Test the NLP engine with various queries"""
    
    print("=" * 60)
    print("Testing Enhanced SearchHub NLP Engine")
    print("=" * 60)
    
    nlp = SimpleNLPEngine()
    
    test_queries = [
        # Creation - Standard
        ("create flashcards on machine learning", "create_flashcards"),
        ("make a note about python programming", "create_note"),
        ("quiz me on calculus", "create_quiz"),
        
        # Creation - Conversational
        ("i need some flashcards about biology", "create_flashcards"),
        ("gimme a quiz on physics", "create_quiz"),
        
        # Learning - Standard
        ("explain neural networks", "explain_topic"),
        ("what is quantum computing", "explain_topic"),
        ("how does photosynthesis work", "explain_topic"),
        
        # Analytics
        ("show my progress", "show_progress"),
        ("what are my weak areas", "show_weak_areas"),
        ("how am i doing", "show_progress"),
        
        # Help
        ("help", "show_help"),
        ("what can you do", "show_help"),
    ]
    
    print("\nTesting intent detection:\n")
    
    correct = 0
    total = len(test_queries)
    
    for query, expected_intent in test_queries:
        result = await nlp.understand(query, user_id="test_user")
        
        confidence_bar = "█" * int(result.confidence * 10) + "░" * (10 - int(result.confidence * 10))
        is_correct = result.intent == expected_intent
        status = "✓" if is_correct else "✗"
        
        if is_correct:
            correct += 1
        
        print(f"{status} Query: \"{query}\"")
        print(f"  Intent: {result.intent} (expected: {expected_intent})")
        print(f"  Confidence: [{confidence_bar}] {result.confidence:.2f}")
        if result.entities:
            print(f"  Entities: {result.entities}")
        print()
    
    print(f"\nAccuracy: {correct}/{total} ({correct/total*100:.1f}%)")
    
    # Test suggestions
    print("\n" + "=" * 60)
    print("Testing autocomplete suggestions:")
    print("=" * 60 + "\n")
    
    partial_queries = ["create", "show", "what", "quiz"]
    
    for partial in partial_queries:
        suggestions = nlp.get_suggestions(partial, "test_user")
        print(f"Partial: \"{partial}\"")
        print(f"  Suggestions: {suggestions[:5]}")
        print()
    
    print("=" * 60)
    print("NLP Engine test complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_nlp_engine())
