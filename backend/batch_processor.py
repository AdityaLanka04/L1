"""
Batch Processing for AI Operations
Reduces API calls by batching multiple requests into single calls
"""
import logging
import json
from typing import List, Dict, Any, Optional
import asyncio

logger = logging.getLogger(__name__)


class BatchFlashcardGenerator:
    """Generate multiple flashcards in a single AI call"""
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    async def generate_batch(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium",
        topic: str = ""
    ) -> List[Dict[str, str]]:
        """Generate multiple flashcards in one API call"""
        
        prompt = f"""Generate {count} flashcards from this content.

Topic: {topic}
Difficulty: {difficulty}
Content: {content[:2000]}

Return ONLY a JSON array (no markdown, no explanation):
[
  {{"front": "Question 1", "back": "Answer 1", "concept": "concept1"}},
  {{"front": "Question 2", "back": "Answer 2", "concept": "concept2"}}
]

Requirements:
- Each card tests ONE concept
- Questions are clear and specific
- Answers are concise (max 200 chars)
- Difficulty matches {difficulty} level
- No duplicate concepts
"""
        
        try:
            # Use appropriate temperature for generation
            import os
            temp = float(os.getenv("FLASHCARD_GENERATION_TEMPERATURE", "0.5"))
            
            response = await asyncio.to_thread(
                self.ai_client.generate,
                prompt,
                max_tokens=2000,
                temperature=temp
            )
            
            # Extract JSON from response
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            elif "[" in json_str:
                # Find the JSON array
                start = json_str.find("[")
                end = json_str.rfind("]") + 1
                json_str = json_str[start:end]
            
            cards = json.loads(json_str)
            
            # Validate and normalize
            validated_cards = []
            for card in cards:
                if isinstance(card, dict) and "front" in card and "back" in card:
                    validated_cards.append({
                        "front": card["front"],
                        "back": card["back"],
                        "concept": card.get("concept", topic),
                        "difficulty": difficulty
                    })
            
            logger.info(f"✅ Batch generated {len(validated_cards)} flashcards in 1 API call")
            return validated_cards
            
        except Exception as e:
            logger.error(f"Batch flashcard generation failed: {e}")
            return []


class BatchQuizGenerator:
    """Generate multiple quiz questions in a single AI call"""
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    async def generate_batch(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium",
        topic: str = ""
    ) -> List[Dict[str, Any]]:
        """Generate multiple quiz questions in one API call"""
        
        prompt = f"""Generate {count} multiple-choice quiz questions from this content.

Topic: {topic}
Difficulty: {difficulty}
Content: {content[:2000]}

Return ONLY a JSON array:
[
  {{
    "question": "Question text",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct_answer": "A",
    "explanation": "Why this is correct"
  }}
]

Requirements:
- Each question tests understanding
- 4 options per question (A, B, C, D)
- One clearly correct answer
- Plausible distractors
- Brief explanations
"""
        
        try:
            import os
            temp = float(os.getenv("QUIZ_GENERATION_TEMPERATURE", "0.4"))
            
            response = await asyncio.to_thread(
                self.ai_client.generate,
                prompt,
                max_tokens=2500,
                temperature=temp
            )
            
            # Extract JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            elif "[" in json_str:
                start = json_str.find("[")
                end = json_str.rfind("]") + 1
                json_str = json_str[start:end]
            
            questions = json.loads(json_str)
            
            logger.info(f"✅ Batch generated {len(questions)} quiz questions in 1 API call")
            return questions
            
        except Exception as e:
            logger.error(f"Batch quiz generation failed: {e}")
            return []


class BatchExplanationGenerator:
    """Generate multiple explanations in a single AI call"""
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    async def explain_batch(
        self,
        concepts: List[str],
        difficulty: str = "medium",
        max_length: int = 200
    ) -> Dict[str, str]:
        """Generate explanations for multiple concepts in one call"""
        
        concepts_str = "\n".join([f"{i+1}. {c}" for i, c in enumerate(concepts)])
        
        prompt = f"""Explain these {len(concepts)} concepts briefly ({max_length} chars each).

Difficulty: {difficulty}

Concepts:
{concepts_str}

Return ONLY a JSON object:
{{
  "concept1": "Brief explanation...",
  "concept2": "Brief explanation..."
}}
"""
        
        try:
            import os
            temp = float(os.getenv("EXPLANATION_TEMPERATURE", "0.6"))
            
            response = await asyncio.to_thread(
                self.ai_client.generate,
                prompt,
                max_tokens=len(concepts) * 150,
                temperature=temp
            )
            
            # Extract JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            elif "{" in json_str:
                start = json_str.find("{")
                end = json_str.rfind("}") + 1
                json_str = json_str[start:end]
            
            explanations = json.loads(json_str)
            
            logger.info(f"✅ Batch explained {len(explanations)} concepts in 1 API call")
            return explanations
            
        except Exception as e:
            logger.error(f"Batch explanation failed: {e}")
            return {}


class BatchProcessor:
    """Main batch processor coordinating all batch operations"""
    
    def __init__(self, ai_client):
        self.flashcard_gen = BatchFlashcardGenerator(ai_client)
        self.quiz_gen = BatchQuizGenerator(ai_client)
        self.explanation_gen = BatchExplanationGenerator(ai_client)
    
    async def process_flashcards(self, content: str, count: int = 10, **kwargs) -> List[Dict]:
        """Process flashcard generation"""
        return await self.flashcard_gen.generate_batch(content, count, **kwargs)
    
    async def process_quiz(self, content: str, count: int = 10, **kwargs) -> List[Dict]:
        """Process quiz generation"""
        return await self.quiz_gen.generate_batch(content, count, **kwargs)
    
    async def process_explanations(self, concepts: List[str], **kwargs) -> Dict[str, str]:
        """Process explanation generation"""
        return await self.explanation_gen.explain_batch(concepts, **kwargs)


# Global instance
_batch_processor: Optional[BatchProcessor] = None


def get_batch_processor(ai_client) -> BatchProcessor:
    """Get or create batch processor instance"""
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor(ai_client)
    return _batch_processor
