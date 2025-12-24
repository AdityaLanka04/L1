"""
Flashcard API Module
Comprehensive flashcard generation and management system with advanced AI prompting
"""

import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models

logger = logging.getLogger(__name__)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================
def get_db():
    """Dependency to get database session"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class FlashcardSetCreate(BaseModel):
    user_id: str
    title: str = "New Flashcard Set"
    description: str = ""
    source_type: str = "manual"
    source_id: Optional[int] = None
    is_public: bool = False

class FlashcardCreate(BaseModel):
    set_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardSetUpdate(BaseModel):
    set_id: int
    title: str
    description: str
    is_public: Optional[bool] = None

class FlashcardUpdate(BaseModel):
    flashcard_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardStudySession(BaseModel):
    set_id: int
    user_id: str
    cards_studied: int
    correct_answers: int
    session_duration: int

class FlashcardGenerationRequest(BaseModel):
    user_id: str
    topic: Optional[str] = None
    generation_type: str = "topic"  # "topic", "chat_history", "note"
    chat_data: Optional[str] = None
    card_count: int = 10
    difficulty_level: str = "medium"  # "easy", "medium", "hard", "mixed"
    depth_level: str = "standard"  # "surface", "standard", "deep", "comprehensive"
    save_to_set: bool = False
    set_title: Optional[str] = None
    focus_areas: Optional[List[str]] = None

# ============================================================================
# FLASHCARD GENERATION PROMPTS WITH GUARDRAILS
# ============================================================================

class FlashcardPromptEngine:
    """Advanced prompt engineering for flashcard generation with guardrails"""
    
    DIFFICULTY_CONFIGS = {
        "easy": {
            "description": "Basic recall and simple understanding",
            "cognitive_level": "Remember and Understand (Bloom's Taxonomy levels 1-2)",
            "question_style": "Direct, straightforward questions with clear answers",
            "complexity": "Single concept per card, minimal prerequisites"
        },
        "medium": {
            "description": "Application and analysis of concepts",
            "cognitive_level": "Apply and Analyze (Bloom's Taxonomy levels 3-4)",
            "question_style": "Scenario-based questions requiring application of knowledge",
            "complexity": "Multiple related concepts, some prerequisite knowledge needed"
        },
        "hard": {
            "description": "Evaluation and synthesis of complex ideas",
            "cognitive_level": "Evaluate and Create (Bloom's Taxonomy levels 5-6)",
            "question_style": "Critical thinking questions requiring deep analysis",
            "complexity": "Complex multi-step reasoning, extensive prerequisite knowledge"
        },
        "mixed": {
            "description": "Varied difficulty levels for comprehensive learning",
            "cognitive_level": "All levels of Bloom's Taxonomy",
            "question_style": "Mix of recall, application, and critical thinking questions",
            "complexity": "Progressive difficulty from basic to advanced"
        }
    }
    
    DEPTH_CONFIGS = {
        "surface": {
            "focus": "Quick recall and basic definitions",
            "detail_level": "Brief, concise answers (1-2 sentences)",
            "coverage": "Main concepts only, broad overview"
        },
        "standard": {
            "focus": "Core understanding with key details",
            "detail_level": "Moderate explanations (2-4 sentences)",
            "coverage": "Essential concepts with important context"
        },
        "deep": {
            "focus": "Comprehensive understanding with connections",
            "detail_level": "Detailed explanations (4-6 sentences)",
            "coverage": "Deep dive into mechanisms, relationships, and implications"
        },
        "comprehensive": {
            "focus": "Mastery-level understanding with cross-connections",
            "detail_level": "Thorough explanations with examples (6+ sentences)",
            "coverage": "Complete coverage including edge cases, examples, and interdisciplinary connections"
        }
    }
    
    @staticmethod
    def build_generation_prompt(
        content_source: str,
        card_count: int,
        difficulty_level: str,
        depth_level: str,
        user_profile: Dict[str, Any],
        focus_areas: Optional[List[str]] = None
    ) -> str:
        """Build an advanced prompt with guardrails for flashcard generation"""
        
        difficulty_config = FlashcardPromptEngine.DIFFICULTY_CONFIGS.get(
            difficulty_level, 
            FlashcardPromptEngine.DIFFICULTY_CONFIGS["medium"]
        )
        depth_config = FlashcardPromptEngine.DEPTH_CONFIGS.get(
            depth_level,
            FlashcardPromptEngine.DEPTH_CONFIGS["standard"]
        )
        
        # Extract user context
        first_name = user_profile.get('first_name', 'Student')
        field_of_study = user_profile.get('field_of_study', 'General Studies')
        learning_style = user_profile.get('learning_style', 'Mixed')
        primary_archetype = user_profile.get('primary_archetype', '')
        
        # Build archetype-aware teaching style
        archetype_style = FlashcardPromptEngine._get_archetype_style(primary_archetype)
        
        prompt = f"""You are an expert educational flashcard creator helping {first_name}, who studies {field_of_study}.

🎯 GENERATION PARAMETERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Number of Cards: {card_count} flashcards
• Difficulty Level: {difficulty_level.upper()}
  - {difficulty_config['description']}
  - Cognitive Level: {difficulty_config['cognitive_level']}
  - Question Style: {difficulty_config['question_style']}
  - Complexity: {difficulty_config['complexity']}

• Depth Level: {depth_level.upper()}
  - Focus: {depth_config['focus']}
  - Detail Level: {depth_config['detail_level']}
  - Coverage: {depth_config['coverage']}

• Learning Style: {learning_style}
{archetype_style}
"""

        if focus_areas:
            prompt += f"\n• Focus Areas: {', '.join(focus_areas)}\n"
        
        prompt += f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 CONTENT TO LEARN:
{content_source[:3000]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛡️ CRITICAL GUARDRAILS - MUST FOLLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONTENT ACCURACY:
   ✓ Only create flashcards from the provided content
   ✗ Never invent, assume, or add information not in the source
   ✓ If content is insufficient, create fewer high-quality cards
   ✗ Never create speculative or hypothetical information

2. QUESTION QUALITY:
   ✓ Each question must be clear, specific, and unambiguous
   ✓ Questions should test understanding, not just memory
   ✗ Avoid yes/no questions (use "What", "How", "Why", "Explain")
   ✗ Avoid trick questions or unnecessarily complex phrasing
   ✓ Questions should be answerable from the provided content

3. ANSWER QUALITY:
   ✓ Answers must be complete, accurate, and self-contained
   ✓ Include context so the answer makes sense independently
   ✗ Never reference "the text" or "above" in answers
   ✓ Match answer detail level to the specified depth configuration
   ✗ Avoid vague answers like "It depends" without explanation

4. DIFFICULTY ADHERENCE:
   ✓ Strictly follow the difficulty level parameters above
   ✓ For "mixed" difficulty, distribute evenly across levels
   ✗ Don't make easy questions artificially hard
   ✗ Don't oversimplify hard questions

5. DIVERSITY:
   ✓ Cover different aspects of the content
   ✓ Vary question types (What, How, Why, Compare, Apply)
   ✗ Avoid repetitive or overlapping questions
   ✓ Progress logically from foundational to advanced concepts

6. FORMATTING:
   ✓ Use proper grammar, punctuation, and capitalization
   ✗ Never use informal abbreviations or text-speak
   ✓ Format special characters, equations, and symbols correctly
   ✗ Avoid unnecessary special characters or emojis in cards

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REQUIRED OUTPUT FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate exactly {card_count} flashcards in valid JSON format:

[
  {{
    "question": "Clear, specific question here",
    "answer": "Complete, self-contained answer here",
    "difficulty": "{difficulty_level}",
    "category": "relevant category",
    "cognitive_level": "bloom's taxonomy level",
    "key_concepts": ["concept1", "concept2"]
  }}
]

⚠️ CRITICAL: Return ONLY the JSON array. No explanations before or after.

Generate the {card_count} flashcards now:"""

        return prompt
    
    @staticmethod
    def _get_archetype_style(archetype: str) -> str:
        """Get teaching style based on learning archetype"""
        styles = {
            "Logicor": "• Style: Use logical structures, step-by-step breakdowns, systematic approaches",
            "Flowist": "• Style: Keep dynamic and interactive, encourage active application",
            "Kinetiq": "• Style: Include practical, action-oriented examples",
            "Synth": "• Style: Show connections between concepts and cross-domain relationships",
            "Dreamweaver": "• Style: Start with big picture, use visual metaphors and creative scenarios",
            "Anchor": "• Style: Provide clear structure with step-by-step progressions",
            "Spark": "• Style: Use creative analogies and unexpected connections",
            "Empathion": "• Style: Relate to human experiences and practical applications",
            "Seeker": "• Style: Present intriguing questions and fascinating insights",
            "Resonant": "• Style: Offer varied approaches and multiple perspectives"
        }
        return styles.get(archetype, "• Style: Clear and comprehensive explanations")

    @staticmethod
    def validate_and_clean_flashcards(
        flashcards: List[Dict],
        card_count: int,
        difficulty_level: str
    ) -> List[Dict]:
        """Validate and clean generated flashcards with quality checks"""
        
        valid_flashcards = []
        seen_questions = set()
        
        for card in flashcards[:card_count * 2]:  # Check extra in case some are invalid
            if not isinstance(card, dict):
                continue
                
            question = card.get('question', '').strip()
            answer = card.get('answer', '').strip()
            
            # Quality checks
            if not question or not answer:
                continue
            
            if len(question) < 10 or len(answer) < 15:
                continue
            
            # Avoid duplicates
            if question.lower() in seen_questions:
                continue
            
            # Check for common issues
            if any(phrase in answer.lower() for phrase in ['the text says', 'as mentioned above', 'refer to']):
                continue
            
            # Check for yes/no questions (warn but don't reject)
            if question.lower().startswith(('is ', 'are ', 'does ', 'do ', 'can ', 'will ')):
                logger.warning(f"Potential yes/no question detected: {question[:50]}")
            
            seen_questions.add(question.lower())
            
            valid_flashcards.append({
                'question': question,
                'answer': answer,
                'difficulty': card.get('difficulty', difficulty_level).strip(),
                'category': card.get('category', 'general').strip(),
                'cognitive_level': card.get('cognitive_level', 'understand'),
                'key_concepts': card.get('key_concepts', [])
            })
            
            if len(valid_flashcards) >= card_count:
                break
        
        return valid_flashcards

# ============================================================================
# FLASHCARD API ENDPOINTS
# ============================================================================

class FlashcardAPI:
    """Flashcard API endpoints"""
    
    def __init__(self, app, unified_ai):
        self.app = app
        self.unified_ai = unified_ai
        self.prompt_engine = FlashcardPromptEngine()
        self._register_routes()
    
    def _register_routes(self):
        """Register all flashcard routes"""
        
        @self.app.post("/api/create_flashcard_set")
        def create_flashcard_set(set_data: FlashcardSetCreate, db: Session = Depends(get_db)):
            return self._create_flashcard_set(set_data, db)
        
        @self.app.post("/api/add_flashcard_to_set")
        def add_flashcard_to_set(card_data: FlashcardCreate, db: Session = Depends(get_db)):
            return self._add_flashcard_to_set(card_data, db)
        
        @self.app.get("/api/get_flashcard_sets")
        def get_flashcard_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
            return self._get_flashcard_sets(user_id, db)
        
        @self.app.get("/api/get_flashcards_in_set")
        def get_flashcards_in_set(set_id: int = Query(...), db: Session = Depends(get_db)):
            return self._get_flashcards_in_set(set_id, db)
        
        @self.app.get("/api/get_flashcard_history")
        def get_flashcard_history(user_id: str = Query(...), limit: int = Query(50), db: Session = Depends(get_db)):
            return self._get_flashcard_history(user_id, limit, db)
        
        @self.app.get("/api/get_flashcard_statistics")
        def get_flashcard_statistics(user_id: str = Query(...), db: Session = Depends(get_db)):
            return self._get_flashcard_statistics(user_id, db)
        
        @self.app.post("/api/generate_flashcards")
        async def generate_flashcards(
            user_id: str = Form(...),
            topic: str = Form(None),
            generation_type: str = Form("topic"),
            chat_data: str = Form(None),
            card_count: int = Form(10),
            difficulty_level: str = Form("medium"),
            depth_level: str = Form("standard"),
            save_to_set: str = Form("false"),  # Accept as string, convert below
            set_title: str = Form(None),
            focus_areas: str = Form(None),
            is_public: str = Form("false"),  # Accept as string, convert below
            db: Session = Depends(get_db)
        ):
            # Convert string to boolean explicitly
            save_to_set_bool = save_to_set.lower() in ('true', '1', 'yes', 'on')
            is_public_bool = is_public.lower() in ('true', '1', 'yes', 'on')
            return await self._generate_flashcards(
                user_id, topic, generation_type, chat_data, card_count,
                difficulty_level, depth_level, save_to_set_bool, set_title,
                focus_areas, is_public_bool, db
            )
        
        @self.app.post("/api/update_flashcard_set")
        def update_flashcard_set(update_data: FlashcardSetUpdate, db: Session = Depends(get_db)):
            return self._update_flashcard_set(update_data, db)
        
        @self.app.post("/api/update_flashcard")
        def update_flashcard(update_data: FlashcardUpdate, db: Session = Depends(get_db)):
            return self._update_flashcard(update_data, db)
        
        @self.app.delete("/api/delete_flashcard_set/{set_id}")
        def delete_flashcard_set(set_id: int, db: Session = Depends(get_db)):
            return self._delete_flashcard_set(set_id, db)
        
        @self.app.delete("/api/delete_flashcard/{flashcard_id}")
        def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
            return self._delete_flashcard(flashcard_id, db)
        
        @self.app.post("/api/record_flashcard_study_session")
        def record_study_session(session_data: FlashcardStudySession, db: Session = Depends(get_db)):
            return self._record_study_session(session_data, db)
        
        @self.app.post("/api/mark_flashcard_for_review")
        def mark_flashcard_for_review(flashcard_id: int = Form(...), marked: bool = Form(True), db: Session = Depends(get_db)):
            return self._mark_flashcard_for_review(flashcard_id, marked, db)
        
        @self.app.get("/api/get_flashcards_for_review")
        def get_flashcards_for_review(user_id: str = Query(...), db: Session = Depends(get_db)):
            return self._get_flashcards_for_review(user_id, db)
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    
    
    @staticmethod
    def _get_user_by_username(db, username: str):
        return db.query(models.User).filter(models.User.username == username).first()
    
    @staticmethod
    def _get_user_by_email(db, email: str):
        return db.query(models.User).filter(models.User.email == email).first()
    
    @staticmethod
    def _build_user_profile_dict(user, comprehensive_profile=None) -> Dict[str, Any]:
        """Build user profile dictionary from database models"""
        profile = {
            "user_id": getattr(user, "id", "unknown"),
            "first_name": getattr(user, "first_name", "Student"),
            "last_name": getattr(user, "last_name", ""),
            "field_of_study": getattr(user, "field_of_study", "General Studies"),
            "learning_style": getattr(user, "learning_style", "Mixed"),
            "school_university": getattr(user, "school_university", "Student"),
            "age": getattr(user, "age", None)
        }
        
        if comprehensive_profile:
            profile.update({
                "difficulty_level": getattr(comprehensive_profile, "difficulty_level", "intermediate"),
                "learning_pace": getattr(comprehensive_profile, "learning_pace", "moderate"),
                "study_environment": getattr(comprehensive_profile, "study_environment", "quiet"),
                "preferred_language": getattr(comprehensive_profile, "preferred_language", "english"),
                "study_goals": getattr(comprehensive_profile, "study_goals", None),
                "career_goals": getattr(comprehensive_profile, "career_goals", None),
                "primary_archetype": getattr(comprehensive_profile, "primary_archetype", ""),
                "secondary_archetype": getattr(comprehensive_profile, "secondary_archetype", ""),
                "archetype_description": getattr(comprehensive_profile, "archetype_description", "")
            })
        
        return profile
    
    # ========================================================================
    # ENDPOINT IMPLEMENTATIONS
    # ========================================================================
    
    def _create_flashcard_set(self, set_data: FlashcardSetCreate, db: Session):
        """Create a new flashcard set"""
        user = self._get_user_by_username(db, set_data.user_id) or self._get_user_by_email(db, set_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        flashcard_set = models.FlashcardSet(
            user_id=user.id,
            title=set_data.title,
            description=set_data.description,
            source_type=set_data.source_type,
            source_id=set_data.source_id,
            is_public=set_data.is_public
        )
        db.add(flashcard_set)
        db.commit()
        db.refresh(flashcard_set)
        
        return {
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "source_type": flashcard_set.source_type,
            "is_public": flashcard_set.is_public,
            "created_at": flashcard_set.created_at.isoformat(),
            "card_count": 0,
            "status": "success"
        }
    
    def _add_flashcard_to_set(self, card_data: FlashcardCreate, db: Session):
        """Add a flashcard to an existing set"""
        flashcard_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == card_data.set_id
        ).first()
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        flashcard = models.Flashcard(
            set_id=card_data.set_id,
            question=card_data.question,
            answer=card_data.answer,
            difficulty=card_data.difficulty,
            category=card_data.category
        )
        db.add(flashcard)
        db.commit()
        db.refresh(flashcard)
        
        return {
            "id": flashcard.id,
            "question": flashcard.question,
            "answer": flashcard.answer,
            "difficulty": flashcard.difficulty,
            "category": flashcard.category,
            "status": "success"
        }
    
    def _get_flashcard_sets(self, user_id: str, db: Session):
        """Get all flashcard sets for a user"""
        user = self._get_user_by_username(db, user_id) or self._get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        flashcard_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).order_by(models.FlashcardSet.updated_at.desc()).all()
        
        result = []
        for flashcard_set in flashcard_sets:
            card_count = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == flashcard_set.id
            ).count()
            
            result.append({
                "id": flashcard_set.id,
                "title": flashcard_set.title,
                "description": flashcard_set.description,
                "source_type": flashcard_set.source_type,
                "source_id": flashcard_set.source_id,
                "card_count": card_count,
                "created_at": flashcard_set.created_at.isoformat(),
                "updated_at": flashcard_set.updated_at.isoformat()
            })
        
        return {"flashcard_sets": result}
    
    def _get_flashcards_in_set(self, set_id: int, db: Session):
        """Get all flashcards in a specific set"""
        flashcard_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == set_id
        ).first()
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        flashcards = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == set_id
        ).order_by(models.Flashcard.created_at.asc()).all()
        
        return {
            "set_id": set_id,
            "set_title": flashcard_set.title,
            "set_description": flashcard_set.description,
            "flashcards": [
                {
                    "id": card.id,
                    "question": card.question,
                    "answer": card.answer,
                    "difficulty": card.difficulty,
                    "category": card.category,
                    "times_reviewed": card.times_reviewed,
                    "last_reviewed": card.last_reviewed.isoformat() if card.last_reviewed else None,
                    "created_at": card.created_at.isoformat(),
                    "marked_for_review": getattr(card, 'marked_for_review', False)
                }
                for card in flashcards
            ]
        }
    
    def _get_flashcard_history(self, user_id: str, limit: int, db: Session):
        """Get flashcard study history for a user"""
        user = self._get_user_by_username(db, user_id) or self._get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        flashcard_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).order_by(models.FlashcardSet.updated_at.desc()).limit(limit).all()
        
        history = []
        for flashcard_set in flashcard_sets:
            card_count = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == flashcard_set.id
            ).count()
            
            recent_sessions = db.query(models.FlashcardStudySession).filter(
                models.FlashcardStudySession.set_id == flashcard_set.id
            ).order_by(models.FlashcardStudySession.session_date.desc()).limit(3).all()
            
            total_sessions = db.query(models.FlashcardStudySession).filter(
                models.FlashcardStudySession.set_id == flashcard_set.id
            ).count()
            
            total_study_time = db.query(models.FlashcardStudySession.session_duration).filter(
                models.FlashcardStudySession.set_id == flashcard_set.id
            ).all()
            
            avg_study_time = sum(duration[0] for duration in total_study_time) / len(total_study_time) if total_study_time else 0
            
            all_sessions = db.query(models.FlashcardStudySession).filter(
                models.FlashcardStudySession.set_id == flashcard_set.id
            ).all()
            
            total_cards = sum(session.cards_studied for session in all_sessions)
            total_correct = sum(session.correct_answers for session in all_sessions)
            accuracy = (total_correct / total_cards * 100) if total_cards > 0 else 0
            
            history.append({
                "id": flashcard_set.id,
                "title": flashcard_set.title,
                "description": flashcard_set.description,
                "source_type": flashcard_set.source_type,
                "source_id": flashcard_set.source_id,
                "card_count": card_count,
                "total_sessions": total_sessions,
                "avg_study_time_minutes": round(avg_study_time, 1),
                "accuracy_percentage": round(accuracy, 1),
                "created_at": flashcard_set.created_at.isoformat(),
                "updated_at": flashcard_set.updated_at.isoformat(),
                "last_studied": recent_sessions[0].session_date.isoformat() if recent_sessions else None
            })
        
        return {
            "total_sets": len(history),
            "flashcard_history": history
        }
    
    def _get_flashcard_statistics(self, user_id: str, db: Session):
        """Get comprehensive flashcard statistics for a user"""
        user = self._get_user_by_username(db, user_id) or self._get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        total_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_cards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.user_id == user.id
        ).count()
        
        total_time_result = db.query(models.FlashcardStudySession.session_duration).filter(
            models.FlashcardStudySession.user_id == user.id
        ).all()
        total_study_time = sum(duration[0] for duration in total_time_result)
        
        all_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.user_id == user.id
        ).all()
        
        total_cards_studied = sum(session.cards_studied for session in all_sessions)
        total_correct = sum(session.correct_answers for session in all_sessions)
        overall_accuracy = (total_correct / total_cards_studied * 100) if total_cards_studied > 0 else 0
        
        return {
            "total_sets": total_sets,
            "total_cards": total_cards,
            "total_sessions": total_sessions,
            "total_study_time_minutes": total_study_time,
            "total_cards_studied": total_cards_studied,
            "overall_accuracy_percentage": round(overall_accuracy, 1),
            "average_session_duration": round(total_study_time / total_sessions, 1) if total_sessions > 0 else 0
        }
    
    async def _generate_flashcards(
        self,
        user_id: str,
        topic: Optional[str],
        generation_type: str,
        chat_data: Optional[str],
        card_count: int,
        difficulty_level: str,
        depth_level: str,
        save_to_set: bool,
        set_title: Optional[str],
        focus_areas: Optional[str],
        is_public: bool,
        db: Session
    ):
        """Generate flashcards using advanced AI with guardrails"""
        try:
            # Validate inputs
            if card_count < 1 or card_count > 50:
                raise HTTPException(status_code=400, detail="Card count must be between 1 and 50")
            
            if difficulty_level not in ["easy", "medium", "hard", "mixed"]:
                difficulty_level = "medium"
            
            if depth_level not in ["surface", "standard", "deep", "comprehensive"]:
                depth_level = "standard"
            
            # Get user
            user = self._get_user_by_username(db, user_id) or self._get_user_by_email(db, user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get comprehensive profile
            comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == user.id
            ).first()
            
            user_profile = self._build_user_profile_dict(user, comprehensive_profile)
            
            # Prepare content source
            if generation_type == "topic" and topic:
                content_source = f"Topic: {topic}"
            elif generation_type == "chat_history" and chat_data:
                try:
                    chat_messages = json.loads(chat_data)
                    conversation_content = []
                    for msg in chat_messages[:30]:
                        conversation_content.append(f"Q: {msg.get('user_message', '')}")
                        conversation_content.append(f"A: {msg.get('ai_response', '')}")
                    content_source = "\n".join(conversation_content)
                except:
                    content_source = "Invalid chat data"
            else:
                content_source = topic or "General knowledge"
            
            # Parse focus areas
            focus_areas_list = None
            if focus_areas:
                try:
                    focus_areas_list = json.loads(focus_areas) if isinstance(focus_areas, str) else focus_areas
                except:
                    focus_areas_list = [area.strip() for area in focus_areas.split(',')]
            
            # Build advanced prompt
            prompt = self.prompt_engine.build_generation_prompt(
                content_source,
                card_count,
                difficulty_level,
                depth_level,
                user_profile,
                focus_areas_list
            )
            
            # Generate with AI (Gemini primary, Groq fallback)
            logger.info(f"Generating {card_count} flashcards at {difficulty_level} difficulty and {depth_level} depth")
            
            full_prompt = f"You are an expert educational flashcard creator. Always return valid JSON arrays.\n\n{prompt}"
            response = self.unified_ai.generate(full_prompt, max_tokens=4096, temperature=0.7)
            
            # Extract and validate JSON
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                try:
                    flashcards_data = json.loads(json_match.group())
                    valid_flashcards = self.prompt_engine.validate_and_clean_flashcards(
                        flashcards_data,
                        card_count,
                        difficulty_level
                    )
                    
                    if len(valid_flashcards) > 0:
                        logger.info(f"Successfully generated {len(valid_flashcards)} flashcards")
                        
                        if save_to_set:
                            if not set_title:
                                set_title = f"Flashcards: {topic}" if topic else "AI Generated Flashcards"
                            
                            flashcard_set = models.FlashcardSet(
                                user_id=user.id,
                                title=set_title,
                                description=f"Generated flashcards - {difficulty_level} difficulty, {depth_level} depth",
                                source_type=generation_type,
                                is_public=is_public
                            )
                            db.add(flashcard_set)
                            db.commit()
                            db.refresh(flashcard_set)
                            
                            saved_cards = []
                            for card_data in valid_flashcards:
                                flashcard = models.Flashcard(
                                    set_id=flashcard_set.id,
                                    question=card_data['question'],
                                    answer=card_data['answer'],
                                    difficulty=card_data['difficulty'],
                                    category=card_data['category']
                                )
                                db.add(flashcard)
                                saved_cards.append(flashcard)
                            
                            db.commit()
                            
                            # Award points for creating flashcard set
                            from gamification_system import award_points
                            points_result = award_points(db, user.id, "flashcard_set")
                            logger.info(f"Awarded {points_result.get('points_earned', 0)} points for flashcard set creation")
                            
                            # Check for flashcard set milestones and create notifications (only once)
                            total_sets = db.query(models.FlashcardSet).filter(
                                models.FlashcardSet.user_id == user.id
                            ).count()
                            
                            notification_data = None
                            milestone_title = None
                            milestone_message = None
                            
                            if total_sets == 1:
                                milestone_title = "First Flashcard Set! 🎉"
                                milestone_message = "Great start! You've created your first flashcard set. Keep learning!"
                            elif total_sets == 10:
                                milestone_title = "10 Flashcard Sets! 📚"
                                milestone_message = "Amazing! You've created 10 flashcard sets. Your knowledge base is growing!"
                            elif total_sets == 25:
                                milestone_title = "25 Flashcard Sets! 🏆"
                                milestone_message = "Incredible! You've created 25 flashcard sets. You're a dedicated learner!"
                            
                            # Only create notification if milestone reached and doesn't already exist
                            if milestone_title:
                                existing_notif = db.query(models.Notification).filter(
                                    models.Notification.user_id == user.id,
                                    models.Notification.title == milestone_title
                                ).first()
                                
                                if not existing_notif:
                                    notification = models.Notification(
                                        user_id=user.id,
                                        title=milestone_title,
                                        message=milestone_message,
                                        notification_type="milestone",
                                        is_read=False
                                    )
                                    db.add(notification)
                                    db.commit()
                                    notification_data = {"title": notification.title, "message": notification.message}
                            
                            result = {
                                "flashcards": valid_flashcards,
                                "saved_to_set": True,
                                "set_id": flashcard_set.id,
                                "set_title": set_title,
                                "cards_saved": len(saved_cards),
                                "difficulty_level": difficulty_level,
                                "depth_level": depth_level,
                                "status": "success"
                            }
                            if notification_data:
                                result["notification"] = notification_data
                            return result
                        else:
                            return {
                                "flashcards": valid_flashcards,
                                "saved_to_set": False,
                                "difficulty_level": difficulty_level,
                                "depth_level": depth_level,
                                "status": "success"
                            }
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
            
            # Fallback response
            logger.warning("Failed to generate flashcards, returning fallback")
            return {
                "flashcards": [
                    {
                        "question": f"What is a key concept in {topic or 'this topic'}?",
                        "answer": "Review the material to learn key concepts.",
                        "difficulty": difficulty_level,
                        "category": "general"
                    }
                ],
                "saved_to_set": False,
                "status": "fallback"
            }
            
        except Exception as e:
            logger.error(f"Error generating flashcards: {str(e)}")
            return {
                "flashcards": [
                    {
                        "question": "Error generating flashcards",
                        "answer": f"Error: {str(e)}",
                        "difficulty": "medium",
                        "category": "error"
                    }
                ],
                "saved_to_set": False,
                "status": "error",
                "error_message": str(e)
            }
    
    def _update_flashcard_set(self, update_data: FlashcardSetUpdate, db: Session):
        """Update flashcard set details"""
        flashcard_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == update_data.set_id
        ).first()
        
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        flashcard_set.title = update_data.title
        flashcard_set.description = update_data.description
        if update_data.is_public is not None:
            flashcard_set.is_public = update_data.is_public
        flashcard_set.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(flashcard_set)
        
        return {
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "is_public": flashcard_set.is_public,
            "updated_at": flashcard_set.updated_at.isoformat(),
            "status": "success"
        }
    
    def _update_flashcard(self, update_data: FlashcardUpdate, db: Session):
        """Update individual flashcard"""
        flashcard = db.query(models.Flashcard).filter(
            models.Flashcard.id == update_data.flashcard_id
        ).first()
        
        if not flashcard:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        
        flashcard.question = update_data.question
        flashcard.answer = update_data.answer
        flashcard.difficulty = update_data.difficulty
        flashcard.category = update_data.category
        
        db.commit()
        db.refresh(flashcard)
        
        return {
            "id": flashcard.id,
            "question": flashcard.question,
            "answer": flashcard.answer,
            "difficulty": flashcard.difficulty,
            "category": flashcard.category,
            "status": "success"
        }
    
    def _delete_flashcard_set(self, set_id: int, db: Session):
        """Delete a flashcard set and all its cards"""
        flashcard_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == set_id
        ).first()
        
        if not flashcard_set:
            raise HTTPException(status_code=404, detail="Flashcard set not found")
        
        # Delete all flashcards in the set
        db.query(models.Flashcard).filter(
            models.Flashcard.set_id == set_id
        ).delete()
        
        # Delete study sessions
        db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == set_id
        ).delete()
        
        # Delete the set
        db.delete(flashcard_set)
        db.commit()
        
        return {"status": "success", "message": "Flashcard set deleted"}
    
    def _delete_flashcard(self, flashcard_id: int, db: Session):
        """Delete individual flashcard"""
        flashcard = db.query(models.Flashcard).filter(
            models.Flashcard.id == flashcard_id
        ).first()
        
        if not flashcard:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        
        db.delete(flashcard)
        db.commit()
        
        return {"status": "success", "message": "Flashcard deleted"}
    
    def _mark_flashcard_for_review(self, flashcard_id: int, marked: bool, db: Session):
        """Mark or unmark a flashcard for review (I don't know this)"""
        flashcard = db.query(models.Flashcard).filter(
            models.Flashcard.id == flashcard_id
        ).first()
        
        if not flashcard:
            raise HTTPException(status_code=404, detail="Flashcard not found")
        
        flashcard.marked_for_review = marked
        db.commit()
        
        return {
            "status": "success",
            "flashcard_id": flashcard_id,
            "marked_for_review": marked
        }
    
    def _get_flashcards_for_review(self, user_id: str, db: Session):
        """Get all flashcards marked for review across all sets for a user"""
        user = self._get_user_by_username(db, user_id) or self._get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get all flashcards marked for review from user's sets
        review_cards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id,
            models.Flashcard.marked_for_review == True
        ).all()
        
        # Group by set for better organization
        cards_by_set = {}
        for card in review_cards:
            set_id = card.set_id
            if set_id not in cards_by_set:
                flashcard_set = db.query(models.FlashcardSet).filter(
                    models.FlashcardSet.id == set_id
                ).first()
                cards_by_set[set_id] = {
                    "set_id": set_id,
                    "set_title": flashcard_set.title if flashcard_set else "Unknown Set",
                    "cards": []
                }
            cards_by_set[set_id]["cards"].append({
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "difficulty": card.difficulty,
                "category": card.category,
                "times_reviewed": card.times_reviewed,
                "last_reviewed": card.last_reviewed.isoformat() if card.last_reviewed else None
            })
        
        return {
            "total_cards": len(review_cards),
            "sets": list(cards_by_set.values())
        }
    
    def _record_study_session(self, session_data: FlashcardStudySession, db: Session):
        """Record a flashcard study session with gamification"""
        user = self._get_user_by_username(db, session_data.user_id) or self._get_user_by_email(db, session_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        study_session = models.FlashcardStudySession(
            set_id=session_data.set_id,
            user_id=user.id,
            cards_studied=session_data.cards_studied,
            correct_answers=session_data.correct_answers,
            session_duration=session_data.session_duration,
            session_date=datetime.now(timezone.utc)
        )
        
        db.add(study_session)
        db.commit()
        db.refresh(study_session)
        
        # Calculate accuracy
        accuracy = round((session_data.correct_answers / session_data.cards_studied * 100), 1) if session_data.cards_studied > 0 else 0
        
        # Award gamification points for flashcard review
        total_points = 0
        try:
            from gamification_system import award_points
            
            # Award points for each card reviewed (1 point each)
            for _ in range(session_data.cards_studied):
                result = award_points(db, user.id, "flashcard_reviewed")
                total_points += result.get("points_earned", 0)
            
            # Award bonus points for mastered cards (correct answers with high accuracy)
            if accuracy >= 80:
                mastered_count = session_data.correct_answers
                for _ in range(mastered_count):
                    result = award_points(db, user.id, "flashcard_mastered")
                    total_points += result.get("points_earned", 0)
            
            db.commit()
            logger.info(f"Awarded {total_points} points for flashcard session")
        except Exception as e:
            logger.error(f"Error awarding flashcard points: {e}")
        
        # Create notification based on performance
        if accuracy >= 90:
            notification = models.Notification(
                user_id=user.id,
                title="🎯 Excellent Flashcard Session!",
                message=f"Amazing! You got {accuracy}% accuracy studying {session_data.cards_studied} cards. You earned {total_points} points!",
                notification_type="flashcard_excellent"
            )
            db.add(notification)
            db.commit()
        elif accuracy < 50 and session_data.cards_studied >= 5:
            notification = models.Notification(
                user_id=user.id,
                title="📚 Keep Practicing!",
                message=f"You scored {accuracy}% on {session_data.cards_studied} cards. Review the material and try again!",
                notification_type="flashcard_review"
            )
            db.add(notification)
            db.commit()
        
        return {
            "id": study_session.id,
            "accuracy": accuracy,
            "points_earned": total_points,
            "status": "success"
        }


def register_flashcard_api(app, unified_ai):
    """
    Register flashcard API with the FastAPI app
    
    Usage in main.py:
        from flashcard_api import register_flashcard_api
        register_flashcard_api(app, unified_ai)
    """
    flashcard_api = FlashcardAPI(app, unified_ai)
    logger.info("✓ Flashcard API registered successfully")
    return flashcard_api