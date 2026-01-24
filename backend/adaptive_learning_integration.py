"""
Adaptive Learning Integration Layer
Integrates adaptive learning engine with flashcards, quizzes, and question banks
"""

import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from adaptive_learning_engine import get_adaptive_engine
import models

logger = logging.getLogger(__name__)


class AdaptiveLearningIntegration:
    """Integration layer for adaptive learning across all study systems"""
    
    def __init__(self):
        self.engine = get_adaptive_engine()
    
    # ==================== Flashcard Integration ====================
    
    def start_flashcard_session(self, db: Session, user_id: int, set_id: int) -> Dict[str, Any]:
        """Start adaptive flashcard study session"""
        try:
            # Get flashcard set info
            flashcard_set = db.query(models.FlashcardSet).filter(
                models.FlashcardSet.id == set_id
            ).first()
            
            if not flashcard_set:
                return {'error': 'Flashcard set not found'}
            
            # Start adaptive session
            session_data = self.engine.start_adaptive_session(
                db, user_id, flashcard_set.title or 'flashcards'
            )
            
            # Get flashcards in optimal order
            flashcards = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == set_id
            ).all()
            
            # Sequence flashcards based on user's mastery
            sequenced_cards = self._sequence_flashcards(db, user_id, flashcards)
            
            return {
                'session': session_data,
                'flashcards': sequenced_cards,
                'total_cards': len(sequenced_cards)
            }
        except Exception as e:
            logger.error(f"Error starting flashcard session: {e}")
            return {'error': str(e)}
    
    def process_flashcard_response(
        self, 
        db: Session, 
        user_id: int, 
        card_id: int,
        quality: str,  # 'again', 'hard', 'good', 'easy'
        response_time: float
    ) -> Dict[str, Any]:
        """Process flashcard response with real-time adaptation"""
        try:
            # Map quality to correctness
            is_correct = quality in ['good', 'easy']
            
            # Process with adaptive engine
            question_data = {
                'is_correct': is_correct,
                'response_time': response_time,
                'difficulty': self._map_quality_to_difficulty(quality),
                'topic': 'flashcard',
                'question_id': card_id
            }
            
            result = self.engine.process_question_response(db, user_id, question_data)
            
            # Update flashcard mastery in database
            self._update_flashcard_mastery(db, user_id, card_id, quality, response_time)
            
            return result
        except Exception as e:
            logger.error(f"Error processing flashcard response: {e}")
            return {'error': str(e)}
    
    def _sequence_flashcards(
        self, 
        db: Session, 
        user_id: int, 
        flashcards: List[models.Flashcard]
    ) -> List[Dict[str, Any]]:
        """Sequence flashcards based on spaced repetition and mastery"""
        sequenced = []
        
        for card in flashcards:
            # Get user's mastery for this card
            study_record = db.query(models.FlashcardStudySession).filter(
                models.FlashcardStudySession.user_id == user_id,
                models.FlashcardStudySession.flashcard_id == card.id
            ).order_by(models.FlashcardStudySession.studied_at.desc()).first()
            
            mastery_level = 0.0
            days_since_review = 999
            
            if study_record:
                mastery_level = study_record.mastery_level or 0.0
                if study_record.studied_at:
                    days_since_review = (datetime.now(timezone.utc) - study_record.studied_at).days
            
            sequenced.append({
                'id': card.id,
                'question': card.question,
                'answer': card.answer,
                'difficulty': card.difficulty,
                'mastery_level': mastery_level,
                'days_since_review': days_since_review,
                'priority': self._calculate_card_priority(mastery_level, days_since_review)
            })
        
        # Sort by priority (lower mastery + more days = higher priority)
        sequenced.sort(key=lambda x: x['priority'], reverse=True)
        
        return sequenced
    
    def _calculate_card_priority(self, mastery_level: float, days_since_review: int) -> float:
        """Calculate priority score for card review"""
        # Lower mastery = higher priority
        mastery_factor = 1.0 - mastery_level
        
        # More days since review = higher priority (with diminishing returns)
        time_factor = min(days_since_review / 30.0, 1.0)
        
        return mastery_factor * 0.6 + time_factor * 0.4
    
    def _update_flashcard_mastery(
        self, 
        db: Session, 
        user_id: int, 
        card_id: int,
        quality: str,
        response_time: float
    ):
        """Update flashcard mastery based on response"""
        try:
            # Get or create study record
            study_record = db.query(models.FlashcardStudySession).filter(
                models.FlashcardStudySession.user_id == user_id,
                models.FlashcardStudySession.flashcard_id == card_id
            ).order_by(models.FlashcardStudySession.studied_at.desc()).first()
            
            if not study_record:
                study_record = models.FlashcardStudySession(
                    user_id=user_id,
                    flashcard_id=card_id,
                    mastery_level=0.0,
                    times_reviewed=0
                )
                db.add(study_record)
            
            # Update mastery based on quality
            quality_adjustments = {
                'again': -0.2,
                'hard': 0.05,
                'good': 0.15,
                'easy': 0.25
            }
            
            adjustment = quality_adjustments.get(quality, 0.1)
            study_record.mastery_level = max(0.0, min(1.0, (study_record.mastery_level or 0.0) + adjustment))
            study_record.times_reviewed = (study_record.times_reviewed or 0) + 1
            study_record.studied_at = datetime.now(timezone.utc)
            
            db.commit()
        except Exception as e:
            logger.error(f"Error updating flashcard mastery: {e}")
            db.rollback()
    
    def _map_quality_to_difficulty(self, quality: str) -> str:
        """Map quality rating to difficulty level"""
        mapping = {
            'again': 'beginner',
            'hard': 'intermediate',
            'good': 'intermediate',
            'easy': 'advanced'
        }
        return mapping.get(quality, 'intermediate')
    
    # ==================== Quiz Integration ====================
    
    def start_quiz_session(
        self, 
        db: Session, 
        user_id: int, 
        topic: str,
        question_count: int = 10
    ) -> Dict[str, Any]:
        """Start adaptive quiz session"""
        try:
            # Start adaptive session
            session_data = self.engine.start_adaptive_session(db, user_id, topic)
            
            # Get user's current difficulty level
            difficulty = self.engine.difficulty_adapter.calculate_current_level(db, user_id)
            
            return {
                'session': session_data,
                'difficulty': difficulty,
                'question_count': question_count
            }
        except Exception as e:
            logger.error(f"Error starting quiz session: {e}")
            return {'error': str(e)}
    
    def process_quiz_answer(
        self,
        db: Session,
        user_id: int,
        question_id: int,
        is_correct: bool,
        response_time: float,
        topic: str
    ) -> Dict[str, Any]:
        """Process quiz answer with real-time adaptation"""
        try:
            question_data = {
                'is_correct': is_correct,
                'response_time': response_time,
                'topic': topic,
                'question_id': question_id
            }
            
            result = self.engine.process_question_response(db, user_id, question_data)
            
            # Update topic mastery
            self._update_topic_mastery(db, user_id, topic, is_correct)
            
            return result
        except Exception as e:
            logger.error(f"Error processing quiz answer: {e}")
            return {'error': str(e)}
    
    def _update_topic_mastery(
        self,
        db: Session,
        user_id: int,
        topic: str,
        is_correct: bool
    ):
        """Update topic mastery based on quiz performance"""
        try:
            mastery = db.query(models.TopicMastery).filter(
                models.TopicMastery.user_id == user_id,
                models.TopicMastery.topic_name == topic
            ).first()
            
            if not mastery:
                mastery = models.TopicMastery(
                    user_id=user_id,
                    topic_name=topic,
                    mastery_level=0.5,
                    confidence_level=0.5,
                    times_studied=0
                )
                db.add(mastery)
            
            # Update mastery
            adjustment = 0.05 if is_correct else -0.03
            mastery.mastery_level = max(0.0, min(1.0, mastery.mastery_level + adjustment))
            mastery.times_studied += 1
            mastery.last_studied = datetime.now(timezone.utc)
            
            db.commit()
        except Exception as e:
            logger.error(f"Error updating topic mastery: {e}")
            db.rollback()
    
    # ==================== Question Bank Integration ====================
    
    def get_adaptive_questions(
        self,
        db: Session,
        user_id: int,
        topic: str,
        count: int = 10
    ) -> Dict[str, Any]:
        """Get adaptively selected questions from question bank"""
        try:
            # Get user's current state
            if user_id not in self.engine.session_adapter.session_data:
                self.engine.session_adapter.start_session(user_id)
            
            session_state = self.engine.session_adapter.session_data[user_id]
            
            # Get questions from database
            questions = db.query(models.Question).filter(
                models.Question.topic.ilike(f"%{topic}%")
            ).all()
            
            if not questions:
                return {'questions': [], 'message': 'No questions found for topic'}
            
            # Convert to format expected by sequencer
            available_questions = []
            for q in questions:
                # Get user's performance on this question
                attempts = db.query(models.QuestionAttempt).filter(
                    models.QuestionAttempt.user_id == user_id,
                    models.QuestionAttempt.question_id == q.id
                ).all()
                
                mastery = 0.5
                if attempts:
                    correct_count = sum(1 for a in attempts if a.is_correct)
                    mastery = correct_count / len(attempts)
                
                available_questions.append({
                    'id': q.id,
                    'question': q.question_text,
                    'difficulty_score': self._difficulty_to_score(q.difficulty),
                    'mastery_level': mastery,
                    'days_since_seen': 999,  # TODO: track this
                    'subtopic': q.subtopic or 'general'
                })
            
            # Use question sequencer
            sequence = self.engine.question_sequencer.generate_question_sequence(
                db, user_id, topic, session_state, count
            )
            
            return sequence
        except Exception as e:
            logger.error(f"Error getting adaptive questions: {e}")
            return {'error': str(e)}
    
    def process_question_bank_answer(
        self,
        db: Session,
        user_id: int,
        question_id: int,
        is_correct: bool,
        response_time: float
    ) -> Dict[str, Any]:
        """Process question bank answer with adaptation"""
        try:
            # Get question details
            question = db.query(models.Question).filter(
                models.Question.id == question_id
            ).first()
            
            if not question:
                return {'error': 'Question not found'}
            
            # Record attempt
            attempt = models.QuestionAttempt(
                user_id=user_id,
                question_id=question_id,
                is_correct=is_correct,
                time_taken=response_time,
                attempted_at=datetime.now(timezone.utc)
            )
            db.add(attempt)
            db.commit()
            
            # Process with adaptive engine
            question_data = {
                'is_correct': is_correct,
                'response_time': response_time,
                'topic': question.topic,
                'question_id': question_id,
                'difficulty': question.difficulty
            }
            
            result = self.engine.process_question_response(db, user_id, question_data)
            
            return result
        except Exception as e:
            logger.error(f"Error processing question bank answer: {e}")
            db.rollback()
            return {'error': str(e)}
    
    def _difficulty_to_score(self, difficulty: str) -> float:
        """Convert difficulty string to numeric score"""
        mapping = {
            'easy': 0.3,
            'medium': 0.5,
            'hard': 0.7,
            'expert': 0.9
        }
        return mapping.get(difficulty.lower(), 0.5)
    
    # ==================== Common Methods ====================
    
    def get_session_recommendations(self, user_id: int) -> Dict[str, Any]:
        """Get real-time recommendations for active session"""
        try:
            return self.engine.get_real_time_recommendations(user_id)
        except Exception as e:
            logger.error(f"Error getting session recommendations: {e}")
            return {'error': str(e)}
    
    def end_study_session(self, db: Session, user_id: int) -> Dict[str, Any]:
        """End any type of study session"""
        try:
            return self.engine.end_adaptive_session(db, user_id)
        except Exception as e:
            logger.error(f"Error ending study session: {e}")
            return {'error': str(e)}
    
    def get_cognitive_load_assessment(self, user_id: int) -> Dict[str, Any]:
        """Get current cognitive load assessment"""
        try:
            if user_id not in self.engine.session_adapter.session_data:
                return {'error': 'No active session'}
            
            session_state = self.engine.session_adapter.session_data[user_id]
            return self.engine.cognitive_monitor.assess_cognitive_load(session_state)
        except Exception as e:
            logger.error(f"Error assessing cognitive load: {e}")
            return {'error': str(e)}


# Singleton instance
_integration_instance = None

def get_adaptive_integration() -> AdaptiveLearningIntegration:
    """Get singleton instance of adaptive learning integration"""
    global _integration_instance
    if _integration_instance is None:
        _integration_instance = AdaptiveLearningIntegration()
    return _integration_instance
