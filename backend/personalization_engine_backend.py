import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import numpy as np
from collections import defaultdict, Counter
import models

class PersonalizationEngine:
    """Personalization engine that learns and adapts to individual users"""
    
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.user = self.db.query(models.User).filter(models.User.id == user_id).first()
        
        # Initialize or get user profile components
        self.profile = self._get_or_create_personality_profile()
        self.preferences = self._get_or_create_preferences()
        self.learning_patterns = self._get_or_create_learning_patterns()
        
    def _get_or_create_personality_profile(self) -> models.UserPersonalityProfile:
        """Get or create user personality profile"""
        profile = self.db.query(models.UserPersonalityProfile).filter(
            models.UserPersonalityProfile.user_id == self.user_id
        ).first()
        
        if not profile:
            profile = models.UserPersonalityProfile(
                user_id=self.user_id,
                formality_preference=0.5,
                humor_preference=0.5,
                detail_preference=0.5,
                encouragement_preference=0.7,
                pace_preference="medium",
                question_frequency=0.5,
                example_preference=0.7,
                repetition_tolerance=0.5,
                visual_learner_score=0.5,
                auditory_learner_score=0.5,
                kinesthetic_learner_score=0.5,
                reading_learner_score=0.5,
                session_length_preference=30,
                break_frequency=15,
                profile_confidence=0.1
            )
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)
        
        return profile
    
    def _get_or_create_preferences(self) -> models.UserPreferences:
        """Get or create user preferences"""
        prefs = self.db.query(models.UserPreferences).filter(
            models.UserPreferences.user_id == self.user_id
        ).first()
        
        if not prefs:
            prefs = models.UserPreferences(
                user_id=self.user_id,
                preferred_explanation_style="balanced",
                language_complexity="medium",
                preferred_difficulty_progression="gradual",
                likes_challenges=True,
                likes_games=False,
                likes_storytelling=True,
                likes_step_by_step=True,
                wants_progress_updates=True,
                wants_encouragement=True,
                wants_constructive_criticism=True,
                prefers_analogies=True,
                prefers_real_examples=True
            )
            self.db.add(prefs)
            self.db.commit()
            self.db.refresh(prefs)
        
        return prefs
    
    def _get_or_create_learning_patterns(self) -> models.LearningPattern:
        """Get or create learning patterns"""
        patterns = self.db.query(models.LearningPattern).filter(
            models.LearningPattern.user_id == self.user_id
        ).first()
        
        if not patterns:
            patterns = models.LearningPattern(
                user_id=self.user_id,
                average_session_length=0.0,
                questions_per_session=0.0,
                concepts_mastered_per_hour=0.0,
                retention_rate=0.0,
                help_seeking_frequency=0.0,
                topic_jumping_tendency=0.0,
                depth_vs_breadth=0.5,
                average_response_time=0.0,
                session_completion_rate=0.0,
                comeback_likelihood=0.0
            )
            self.db.add(patterns)
            self.db.commit()
            self.db.refresh(patterns)
        
        return patterns
    
    def analyze_user_message(self, message: str) -> Dict:
        """Analyze user message for personality and learning indicators"""
        analysis = {
            'sentiment': self._analyze_sentiment(message),
            'complexity_level': self._analyze_complexity(message),
            'question_type': self._classify_question_type(message),
            'emotional_indicators': self._detect_emotional_indicators(message),
            'learning_style_clues': self._detect_learning_style_clues(message),
            'urgency_level': self._detect_urgency(message),
            'formality_level': self._analyze_formality(message)
        }
        
        # Update user profile based on analysis
        self._update_profile_from_analysis(analysis)
        
        return analysis
    
    def _analyze_sentiment(self, message: str) -> float:
        """Simple sentiment analysis (-1 to 1)"""
        positive_words = ['good', 'great', 'excellent', 'awesome', 'amazing', 'wonderful', 
                         'fantastic', 'perfect', 'love', 'like', 'enjoy', 'happy', 'excited',
                         'thank', 'thanks', 'appreciate', 'helpful', 'clear', 'understand']
        
        negative_words = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'confused', 'lost',
                         'frustrated', 'angry', 'difficult', 'hard', 'impossible', 'stuck',
                         'dont understand', 'unclear', 'confusing', 'wrong', 'error']
        
        uncertainty_words = ['maybe', 'perhaps', 'might', 'could', 'unsure', 'not sure',
                           'think', 'guess', 'probably', 'confused', 'unclear']
        
        words = message.lower().split()
        positive_count = sum(1 for word in words if word in positive_words)
        negative_count = sum(1 for word in words if word in negative_words)
        uncertainty_count = sum(1 for word in words if word in uncertainty_words)
        
        total_words = len(words)
        if total_words == 0:
            return 0.0
        
        sentiment = (positive_count - negative_count - uncertainty_count * 0.5) / total_words
        return max(-1.0, min(1.0, sentiment * 10))
    
    def _analyze_complexity(self, message: str) -> str:
        """Analyze complexity level of user's message"""
        words = message.split()
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        
        complex_indicators = ['however', 'therefore', 'consequently', 'furthermore', 'moreover',
                            'nevertheless', 'specifically', 'particularly', 'essentially']
        
        has_complex_words = any(word.lower() in complex_indicators for word in words)
        
        if avg_word_length > 6 or has_complex_words or len(words) > 30:
            return "advanced"
        elif avg_word_length < 4 and len(words) < 10:
            return "simple"
        else:
            return "medium"
    
    def _classify_question_type(self, message: str) -> str:
        """Classify the type of question or statement"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['what is', 'define', 'definition', 'meaning']):
            return "definition"
        elif any(word in message_lower for word in ['how to', 'how do', 'steps', 'process']):
            return "process"
        elif any(word in message_lower for word in ['why', 'reason', 'because', 'cause']):
            return "explanation"
        elif any(word in message_lower for word in ['example', 'instance', 'like what', 'such as']):
            return "example_request"
        elif any(word in message_lower for word in ['compare', 'difference', 'vs', 'versus']):
            return "comparison"
        elif any(word in message_lower for word in ['solve', 'calculate', 'find', 'compute']):
            return "problem_solving"
        elif '?' in message:
            return "general_question"
        else:
            return "statement"
    
    def _detect_emotional_indicators(self, message: str) -> List[str]:
        """Detect emotional state indicators"""
        indicators = []
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['frustrated', 'stuck', 'confused', 'lost']):
            indicators.append('frustrated')
        if any(word in message_lower for word in ['excited', 'amazing', 'awesome', 'love']):
            indicators.append('excited')
        if any(word in message_lower for word in ['worried', 'anxious', 'nervous', 'scared']):
            indicators.append('anxious')
        if any(word in message_lower for word in ['bored', 'tired', 'sleepy']):
            indicators.append('low_energy')
        if any(word in message_lower for word in ['curious', 'wonder', 'interesting']):
            indicators.append('curious')
        
        return indicators
    
    def _detect_learning_style_clues(self, message: str) -> Dict[str, float]:
        """Detect learning style preferences from message"""
        visual_clues = ['see', 'look', 'picture', 'diagram', 'chart', 'visual', 'image', 'show me']
        auditory_clues = ['hear', 'sound', 'listen', 'tell me', 'explain', 'say']
        kinesthetic_clues = ['do', 'practice', 'hands-on', 'try', 'experience', 'feel']
        reading_clues = ['read', 'text', 'written', 'document', 'article', 'book']
        
        message_lower = message.lower()
        
        return {
            'visual': sum(1 for clue in visual_clues if clue in message_lower),
            'auditory': sum(1 for clue in auditory_clues if clue in message_lower),
            'kinesthetic': sum(1 for clue in kinesthetic_clues if clue in message_lower),
            'reading': sum(1 for clue in reading_clues if clue in message_lower)
        }
    
    def _detect_urgency(self, message: str) -> str:
        """Detect urgency level in message"""
        message_lower = message.lower()
        
        high_urgency = ['urgent', 'asap', 'immediately', 'right now', 'emergency', 'deadline',
                       'test tomorrow', 'exam today', 'due today', 'help!', 'quickly']
        
        medium_urgency = ['soon', 'tonight', 'tomorrow', 'this week', 'assignment', 'homework',
                         'need help', 'stuck', 'confused']
        
        if any(word in message_lower for word in high_urgency):
            return "high"
        elif any(word in message_lower for word in medium_urgency):
            return "medium"
        else:
            return "low"
    
    def _analyze_formality(self, message: str) -> float:
        """Analyze formality level (0=very casual, 1=very formal)"""
        formal_indicators = ['please', 'thank you', 'could you', 'would you', 'i would like',
                           'assistance', 'appreciate', 'kindly', 'regards']
        
        casual_indicators = ['hey', 'hi', 'whats up', 'yeah', 'yep', 'nah', 'gonna', 'wanna',
                           'gotta', 'sup', 'lol', 'haha', 'omg', 'btw']
        
        message_lower = message.lower()
        formal_count = sum(1 for indicator in formal_indicators if indicator in message_lower)
        casual_count = sum(1 for indicator in casual_indicators if indicator in message_lower)
        
        if formal_count + casual_count == 0:
            return 0.5  # Neutral
        
        return formal_count / (formal_count + casual_count)
    
    def _update_profile_from_analysis(self, analysis: Dict):
        """Update user profile based on message analysis"""
        # Update formality preference
        if analysis['formality_level'] is not None:
            self.profile.formality_preference = (
                self.profile.formality_preference * 0.8 + analysis['formality_level'] * 0.2
            )
        
        # Update learning style scores
        style_clues = analysis['learning_style_clues']
        total_clues = sum(style_clues.values())
        
        if total_clues > 0:
            learning_factor = 0.1  # How much to adjust based on one message
            
            self.profile.visual_learner_score = (
                self.profile.visual_learner_score * (1 - learning_factor) +
                (style_clues['visual'] / total_clues) * learning_factor
            )
            self.profile.auditory_learner_score = (
                self.profile.auditory_learner_score * (1 - learning_factor) +
                (style_clues['auditory'] / total_clues) * learning_factor
            )
            self.profile.kinesthetic_learner_score = (
                self.profile.kinesthetic_learner_score * (1 - learning_factor) +
                (style_clues['kinesthetic'] / total_clues) * learning_factor
            )
            self.profile.reading_learner_score = (
                self.profile.reading_learner_score * (1 - learning_factor) +
                (style_clues['reading'] / total_clues) * learning_factor
            )
        
        # Update detail preference based on complexity
        if analysis['complexity_level'] == 'advanced':
            self.profile.detail_preference = min(1.0, self.profile.detail_preference + 0.05)
        elif analysis['complexity_level'] == 'simple':
            self.profile.detail_preference = max(0.0, self.profile.detail_preference - 0.05)
        
        # Increase profile confidence
        self.profile.profile_confidence = min(1.0, self.profile.profile_confidence + 0.01)
        self.profile.last_updated = datetime.utcnow()
        
        self.db.commit()
    
    def get_conversation_memories(self, limit: int = 10) -> List[models.ConversationMemory]:
        """Get relevant conversation memories"""
        return self.db.query(models.ConversationMemory).filter(
            models.ConversationMemory.user_id == self.user_id
        ).order_by(
            desc(models.ConversationMemory.importance_score),
            desc(models.ConversationMemory.last_referenced)
        ).limit(limit).all()
    
    def store_conversation_memory(self, memory_type: str, content: str, 
                                importance: float = 0.5, context: str = None,
                                emotional_valence: float = 0.0):
        """Store important conversation memory"""
        memory = models.ConversationMemory(
            user_id=self.user_id,
            memory_type=memory_type,
            content=content,
            context=context,
            importance_score=importance,
            emotional_valence=emotional_valence,
            confidence_level=0.8
        )
        self.db.add(memory)
        self.db.commit()
    
    def get_topic_mastery(self, topic: str) -> Optional[models.TopicMastery]:
        """Get user's mastery level for a specific topic"""
        return self.db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == self.user_id,
            models.TopicMastery.topic_name == topic
        ).first()
    
    def update_topic_mastery(self, topic: str, interaction_success: bool, 
                           time_spent: float, question_difficulty: str = "medium"):
        """Update topic mastery based on interaction"""
        mastery = self.get_topic_mastery(topic)
        
        if not mastery:
            mastery = models.TopicMastery(
                user_id=self.user_id,
                topic_name=topic,
                mastery_level=0.1,
                confidence_level=0.1
            )
            self.db.add(mastery)
        
        # Update mastery based on success
        adjustment = 0.05 if interaction_success else -0.02
        if question_difficulty == "simple":
            adjustment *= 0.5
        elif question_difficulty == "advanced":
            adjustment *= 1.5
        
        mastery.mastery_level = max(0.0, min(1.0, mastery.mastery_level + adjustment))
        mastery.times_studied += 1
        mastery.total_time_spent += time_spent
        mastery.last_practiced = datetime.utcnow()
        
        if interaction_success:
            mastery.correct_answers += 1
        
        self.db.commit()
    
    def post_interaction_update(self, user_message: str, ai_response: str, 
                              user_feedback: Optional[int] = None,
                              interaction_duration: float = 0,
                              topics_discussed: List[str] = None):
        """Update all user models after an interaction"""
        
        # Extract and store important memories
        self._extract_and_store_memories(user_message, ai_response)
        
        # Update topic mastery
        if topics_discussed:
            success = user_feedback is None or user_feedback >= 3
            for topic in topics_discussed:
                self.update_topic_mastery(topic, success, interaction_duration / len(topics_discussed))
        
        # Update preferences based on feedback
        if user_feedback is not None:
            self._update_preferences_from_feedback(user_feedback, ai_response)
        
        # Update learning patterns
        self._update_learning_patterns(interaction_duration, topics_discussed)
        
        # Increment profile confidence
        self.profile.profile_confidence = min(1.0, self.profile.profile_confidence + 0.005)
        self.db.commit()
    
    def _extract_and_store_memories(self, user_message: str, ai_response: str):
        """Extract and store important conversation memories"""
        
        # Look for personal information
        personal_patterns = [
            (r"my name is (\w+)", "personal_fact", "name"),
            (r"i study (\w+)", "personal_fact", "field_of_study"),
            (r"im studying (\w+)", "personal_fact", "field_of_study"),
            (r"i work at (\w+)", "personal_fact", "workplace"),
            (r"im struggling with (.+)", "struggle_point", "difficulty"),
            (r"i love (.+)", "preference", "likes"),
            (r"i hate (.+)", "preference", "dislikes"),
            (r"my goal is (.+)", "learning_goal", "objective")
        ]
        
        message_lower = user_message.lower()
        
        for pattern, memory_type, category in personal_patterns:
            match = re.search(pattern, message_lower)
            if match:
                content = f"{category}: {match.group(1)}"
                importance = 0.8 if memory_type == "personal_fact" else 0.6
                
                # Check if we already have this memory
                existing = self.db.query(models.ConversationMemory).filter(
                    models.ConversationMemory.user_id == self.user_id,
                    models.ConversationMemory.content.like(f"{category}:%")
                ).first()
                
                if existing:
                    existing.content = content
                    existing.last_referenced = datetime.utcnow()
                    existing.reference_count += 1
                else:
                    self.store_conversation_memory(
                        memory_type=memory_type,
                        content=content,
                        importance=importance,
                        context=user_message[:100]
                    )
    
    def _update_preferences_from_feedback(self, feedback: int, ai_response: str):
        """Update preferences based on user feedback"""
        adjustment = 0.05 if feedback >= 4 else -0.03
        
        # Analyze response characteristics and adjust preferences
        response_length = len(ai_response.split())
        
        if response_length > 100:  # Long response
            self.profile.detail_preference = max(0, min(1, 
                self.profile.detail_preference + adjustment))
        elif response_length < 30:  # Short response
            self.profile.detail_preference = max(0, min(1,
                self.profile.detail_preference - adjustment))
        
        # Check for examples in response
        if 'example' in ai_response.lower() or 'for instance' in ai_response.lower():
            self.profile.example_preference = max(0, min(1,
                self.profile.example_preference + adjustment))
        
        self.db.commit()
    
    def _update_learning_patterns(self, interaction_duration: float, topics_discussed: List[str]):
        """Update learning patterns based on interaction"""
        patterns = self.learning_patterns
        
        # Update session metrics
        if patterns.average_session_length == 0:
            patterns.average_session_length = interaction_duration
        else:
            patterns.average_session_length = (
                patterns.average_session_length * 0.8 + interaction_duration * 0.2
            )
        
        # Update questions per session (simplified)
        if patterns.questions_per_session == 0:
            patterns.questions_per_session = 1
        else:
            patterns.questions_per_session = (
                patterns.questions_per_session * 0.9 + 1 * 0.1
            )
        
        # Update time-based patterns
        current_hour = datetime.now().hour
        
        if patterns.most_active_hour is None:
            patterns.most_active_hour = current_hour
        else:
            # Simple moving average towards current hour
            if abs(current_hour - patterns.most_active_hour) < 12:
                patterns.most_active_hour = int(
                    patterns.most_active_hour * 0.9 + current_hour * 0.1
                )
        
        patterns.last_updated = datetime.utcnow()
        self.db.commit()