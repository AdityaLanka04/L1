"""Streamlined Flashcard Generation System"""

import logging
from typing import Dict, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class FlashcardGenerationRequest(BaseModel):
    user_id: str
    topic: Optional[str] = None
    chat_data: Optional[str] = None
    card_count: int = 10
    difficulty_level: str = "medium"
    save_to_set: bool = False
    set_title: Optional[str] = None


class MinimalFlashcardPrompts:
    @staticmethod
    def build_prompt(content: str, card_count: int, difficulty: str) -> str:
        difficulty_guides = {
            "easy": "basic recall and definitions",
            "medium": "application and understanding",
            "hard": "analysis and synthesis"
        }
        guide = difficulty_guides.get(difficulty, "mixed difficulty")
        
        return f"""Generate {card_count} flashcards from this content for {guide}.

CONTENT:
{content[:2000]}

FORMAT (JSON):
{{
  "flashcards": [
    {{"question": "...", "answer": "..."}},
    ...
  ]
}}

RULES:
- Questions: Clear, specific, testable
- Answers: Concise (2-4 sentences max), informative
- Focus on key concepts only"""
    
    @staticmethod
    def build_topic_prompt(topic: str, card_count: int, difficulty: str) -> str:
        return f"""Generate {card_count} flashcards about: {topic}

Difficulty: {difficulty}

FORMAT (JSON):
{{
  "flashcards": [
    {{"question": "...", "answer": "..."}},
    ...
  ]
}}

RULES:
- Cover essential concepts only
- Answers: 2-4 sentences maximum
- Questions must be clear and specific"""


class SmartFlashcardAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.card_reviews = {}
        self.session_active = False
        self.current_session = None
    
    def add_card(self, card_id: str):
        if card_id not in self.card_reviews:
            self.card_reviews[card_id] = {"correct": 0, "total": 0}
    
    def review_card(self, card_id: str, was_correct: bool):
        if card_id not in self.card_reviews:
            self.add_card(card_id)
        
        self.card_reviews[card_id]["total"] += 1
        if was_correct:
            self.card_reviews[card_id]["correct"] += 1
        
        return {
            "card_id": card_id,
            "retention_rate": self._get_retention(card_id),
            "total_reviews": self.card_reviews[card_id]["total"]
        }
    
    def _get_retention(self, card_id: str) -> float:
        reviews = self.card_reviews.get(card_id, {"correct": 0, "total": 0})
        if reviews["total"] == 0:
            return 0.0
        return reviews["correct"] / reviews["total"]
    
    def get_weak_cards(self) -> List[str]:
        weak = []
        for card_id, reviews in self.card_reviews.items():
            if reviews["total"] >= 3:
                retention = self._get_retention(card_id)
                if retention < 0.7:
                    weak.append(card_id)
        return weak
    
    def get_statistics(self) -> Dict:
        if not self.card_reviews:
            return {"total_cards": 0, "total_reviews": 0, "average_retention": 0.0}
        
        total_reviews = sum(r["total"] for r in self.card_reviews.values())
        total_correct = sum(r["correct"] for r in self.card_reviews.values())
        avg_retention = total_correct / total_reviews if total_reviews > 0 else 0.0
        
        return {
            "total_cards": len(self.card_reviews),
            "total_reviews": total_reviews,
            "average_retention": avg_retention,
            "weak_cards": len(self.get_weak_cards())
        }


def generate_flashcards_minimal(
    unified_ai,
    content_or_topic: str,
    card_count: int,
    difficulty: str,
    is_topic: bool = False
) -> List[Dict]:
    try:
        if is_topic:
            prompt = MinimalFlashcardPrompts.build_topic_prompt(
                content_or_topic, card_count, difficulty
            )
        else:
            prompt = MinimalFlashcardPrompts.build_prompt(
                content_or_topic, card_count, difficulty
            )
        
        response = unified_ai.generate(prompt, max_tokens=2000, temperature=0.7)
        
        import json
        import re
        
        json_match = re.search(r'\{[\s\S]*"flashcards"[\s\S]*\}', response)
        if json_match:
            data = json.loads(json_match.group())
            flashcards = data.get("flashcards", [])
            
            valid_cards = []
            for card in flashcards[:card_count]:
                if "question" in card and "answer" in card:
                    answer = card["answer"]
                    if len(answer) > 400:
                        answer = answer[:400] + "..."
                    
                    valid_cards.append({
                        "question": card["question"].strip(),
                        "answer": answer.strip(),
                        "difficulty": difficulty
                    })
            
            return valid_cards
        
        logger.error("No valid JSON found in response")
        return []
        
    except Exception as e:
        logger.error(f"Flashcard generation error: {e}")
        return []


active_agents = {}

def get_agent(user_id: str) -> SmartFlashcardAgent:
    if user_id not in active_agents:
        active_agents[user_id] = SmartFlashcardAgent(user_id)
    return active_agents[user_id]
