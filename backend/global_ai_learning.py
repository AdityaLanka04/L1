import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
import numpy as np
from collections import defaultdict, Counter
import models
from textblob import TextBlob  # For sentiment analysis
import nltk
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class GlobalAILearningSystem:
    """
    Global AI Learning System that improves from all user interactions
    Every user's feedback makes the AI smarter for everyone
    """
    
    def __init__(self, db: Session):
        self.db = db
        
        # Download required NLTK data (run once)
        try:
            nltk.data.find('vader_lexicon')
        except LookupError:
            nltk.download('vader_lexicon', quiet=True)
        
        # Initialize vectorizer for similarity matching
        self.vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
        
    def analyze_user_message(self, message: str) -> Dict:
        """Analyze user message for various indicators"""
        analysis = {
            'sentiment': self._analyze_sentiment(message),
            'complexity_level': self._analyze_complexity(message),
            'question_type': self._classify_question_type(message),
            'emotional_indicators': self._detect_emotional_indicators(message),
            'learning_style_clues': self._detect_learning_style_clues(message),
            'urgency_level': self._detect_urgency(message),
            'formality_level': self._analyze_formality(message),
            'confusion_indicators': self._detect_confusion(message),
            'topics': self._extract_topics(message)
        }
        return analysis
    
    def generate_enhanced_response(self, user_message: str, user_id: int, 
                                 conversation_history: List = None) -> Dict:
        """Generate response using global knowledge base and personalization"""
        
        # Analyze the user's message
        analysis = self.analyze_user_message(user_message)
        
        # Get user personalization data
        user_context = self._get_user_context(user_id)
        
        # Check for common misconceptions
        misconception_correction = self._check_for_misconceptions(user_message, analysis['topics'])
        
        # Get relevant knowledge from global database
        relevant_knowledge = self._find_relevant_knowledge(user_message, analysis)
        
        # Build enhanced prompt
        enhanced_prompt = self._build_enhanced_prompt(
            user_message, user_context, analysis, misconception_correction, 
            relevant_knowledge, conversation_history
        )
        
        # Calculate AI confidence based on available knowledge
        ai_confidence = self._calculate_ai_confidence(
            user_message, relevant_knowledge, misconception_correction
        )
        
        return {
            'enhanced_prompt': enhanced_prompt,
            'ai_confidence': ai_confidence,
            'analysis': analysis,
            'misconception_detected': misconception_correction is not None,
            'relevant_knowledge_count': len(relevant_knowledge),
            'should_request_feedback': ai_confidence < 0.7  # Request feedback if confidence is low
        }
    
    def process_user_feedback(self, user_id: int, message_id: int, rating: int, 
                            feedback_text: str = None, improvement_suggestion: str = None):
        """Process user feedback to improve global AI performance"""
        
        # Get the original message and response
        message = self.db.query(models.ChatMessage).filter(
            models.ChatMessage.id == message_id
        ).first()
        
        if not message:
            return False
        
        # Store the feedback
        feedback = models.UserFeedback(
            user_id=user_id,
            feedback_type='rating' if not feedback_text else 'detailed',
            feedback_text=feedback_text,
            rating=rating,
            related_message_id=message_id,
            topic_context=', '.join(message.topics_discussed) if message.topics_discussed else None
        )
        self.db.add(feedback)
        
        # Update the message rating
        message.response_rating = rating
        
        # If rating is low or there's an improvement suggestion, create improvement entry
        if rating <= 2 or improvement_suggestion:
            improvement = models.AIResponseImprovement(
                original_question=message.user_message,
                original_response=message.ai_response,
                user_rating=rating,
                improvement_suggestion=improvement_suggestion or feedback_text,
                improvement_type=self._classify_improvement_type(improvement_suggestion or feedback_text),
                suggested_by_user_id=user_id
            )
            self.db.add(improvement)
        
        # Update global knowledge base if rating is high
        if rating >= 4:
            self._update_global_knowledge_success(message.user_message, message.ai_response)
        
        # Learn from this interaction
        self._learn_from_feedback(message, rating, feedback_text, improvement_suggestion)
        
        self.db.commit()
        return True
    
    def _get_user_context(self, user_id: int) -> Dict:
        """Get user personalization context"""
        user = self.db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return {}
        
        profile = self.db.query(models.UserPersonalityProfile).filter(
            models.UserPersonalityProfile.user_id == user_id
        ).first()
        
        preferences = self.db.query(models.UserPreferences).filter(
            models.UserPreferences.user_id == user_id
        ).first()
        
        # Get recent memories
        memories = self.db.query(models.ConversationMemory).filter(
            models.ConversationMemory.user_id == user_id
        ).order_by(desc(models.ConversationMemory.importance_score)).limit(5).all()
        
        return {
            'name': user.first_name or 'Student',
            'field_of_study': user.field_of_study,
            'learning_style': user.learning_style,
            'profile': profile,
            'preferences': preferences,
            'memories': memories
        }
    
    def _check_for_misconceptions(self, message: str, topics: List[str]) -> Optional[Dict]:
        """Check if the user's message indicates a common misconception"""
        
        message_lower = message.lower()
        
        # Get misconceptions for relevant topics
        misconceptions = self.db.query(models.CommonMisconceptions).filter(
            models.CommonMisconceptions.topic.in_(topics) if topics else True
        ).all()
        
        for misconception in misconceptions:
            trigger_phrases = json.loads(misconception.trigger_phrases) if misconception.trigger_phrases else []
            
            # Check if any trigger phrases are in the message
            for phrase in trigger_phrases:
                if phrase.lower() in message_lower:
                    # Update detection count
                    misconception.times_encountered += 1
                    self.db.commit()
                    
                    return {
                        'misconception': misconception.misconception_text,
                        'correction': misconception.correct_explanation,
                        'topic': misconception.topic
                    }
        
        return None
    
    def _find_relevant_knowledge(self, message: str, analysis: Dict) -> List[Dict]:
        """Find relevant knowledge from global database"""
        
        # Get knowledge entries for relevant topics
        topics = analysis.get('topics', [])
        difficulty = analysis.get('complexity_level', 'medium')
        question_type = analysis.get('question_type', 'general')
        
        # Query global knowledge base
        query = self.db.query(models.GlobalKnowledgeBase).filter(
            models.GlobalKnowledgeBase.is_active == True
        )
        
        if topics:
            query = query.filter(
                models.GlobalKnowledgeBase.topic_category.in_(topics + [question_type])
            )
        
        knowledge_entries = query.order_by(
            desc(models.GlobalKnowledgeBase.success_rate),
            desc(models.GlobalKnowledgeBase.usage_count)
        ).limit(10).all()
        
        # Score and rank by relevance
        relevant_knowledge = []
        for entry in knowledge_entries:
            relevance_score = self._calculate_relevance_score(message, entry)
            if relevance_score > 0.3:  # Threshold for relevance
                relevant_knowledge.append({
                    'entry': entry,
                    'relevance_score': relevance_score,
                    'pattern': entry.question_pattern,
                    'template': entry.response_template,
                    'success_rate': entry.success_rate
                })
        
        # Sort by relevance and success rate
        relevant_knowledge.sort(key=lambda x: (x['relevance_score'], x['success_rate']), reverse=True)
        
        return relevant_knowledge[:5]  # Return top 5
    
    
    def _calculate_relevance_score(self, message: str, knowledge_entry) -> float:
        """Calculate how relevant a knowledge entry is to the user's message"""
        
        try:
            # Simple keyword matching for now
            message_words = set(message.lower().split())
            pattern_words = set(knowledge_entry.question_pattern.lower().split())
            
            # Calculate Jaccard similarity
            intersection = message_words.intersection(pattern_words)
            union = message_words.union(pattern_words)
            
            if len(union) == 0:
                return 0.0
            
            jaccard_score = len(intersection) / len(union)
            
            # Boost score based on success rate
            boosted_score = jaccard_score * (1 + knowledge_entry.success_rate)
            
            return min(1.0, boosted_score)
        
        except Exception:
            return 0.0
    
    def _build_enhanced_prompt(self, user_message: str, user_context: Dict, 
                             analysis: Dict, misconception_correction: Optional[Dict],
                             relevant_knowledge: List[Dict], conversation_history: List = None) -> str:
        """Build an enhanced prompt using all available context"""
        
        prompt_parts = []
        
        # 1. Core identity with global learning
        prompt_parts.append(f"""You are an advanced AI tutor that learns from every interaction to become better for all students. You have been trained on feedback from thousands of users to provide the most effective explanations.""")
        
        # 2. User personalization context
        if user_context.get('name'):
            name = user_context['name']
            prompt_parts.append(f"You are currently helping {name}.")
            
            if user_context.get('field_of_study'):
                prompt_parts.append(f"{name} studies {user_context['field_of_study']}.")
            
            if user_context.get('learning_style'):
                prompt_parts.append(f"{name} is a {user_context['learning_style']} learner.")
        
        # 3. User preferences and learning style
        if user_context.get('profile'):
            profile = user_context['profile']
            
            # Communication style
            if profile.formality_preference > 0.7:
                prompt_parts.append("Use formal, professional language.")
            elif profile.formality_preference < 0.3:
                prompt_parts.append("Use casual, friendly language.")
            
            # Detail level
            if profile.detail_preference > 0.7:
                prompt_parts.append("Provide detailed, thorough explanations.")
            elif profile.detail_preference < 0.3:
                prompt_parts.append("Keep explanations concise and to the point.")
            
            # Learning style adaptation
            dominant_style = max([
                ('visual', profile.visual_learner_score),
                ('auditory', profile.auditory_learner_score),
                ('kinesthetic', profile.kinesthetic_learner_score),
                ('reading', profile.reading_learner_score)
            ], key=lambda x: x[1])
            
            if dominant_style[1] > 0.6:
                style_instructions = {
                    'visual': 'Use visual descriptions, suggest diagrams, and paint clear mental pictures.',
                    'auditory': 'Use clear verbal explanations, suggest discussing concepts aloud.',
                    'kinesthetic': 'Include hands-on examples and practical applications.',
                    'reading': 'Provide comprehensive written explanations and suggest additional reading.'
                }
                prompt_parts.append(style_instructions[dominant_style[0]])
        
        # 4. Important memories
        if user_context.get('memories'):
            memory_context = "Important things to remember about this student:\n"
            for memory in user_context['memories'][:3]:
                memory_context += f"- {memory.content}\n"
            prompt_parts.append(memory_context)
        
        # 5. Current interaction analysis
        emotional_state = analysis.get('emotional_indicators', [])
        if emotional_state:
            if 'frustrated' in emotional_state:
                prompt_parts.append("The student seems frustrated. Be extra patient and encouraging.")
            elif 'confused' in emotional_state:
                prompt_parts.append("The student appears confused. Break down concepts into simpler parts.")
            elif 'excited' in emotional_state:
                prompt_parts.append("The student seems excited to learn. Match their enthusiasm.")
        
        # 6. Misconception correction
        if misconception_correction:
            prompt_parts.append(f"""
IMPORTANT: This student may have a common misconception about {misconception_correction['topic']}.
Misconception: {misconception_correction['misconception']}
Correct explanation: {misconception_correction['correction']}
Address this gently and clearly in your response.""")
        
        # 7. Global knowledge base guidance
        if relevant_knowledge:
            prompt_parts.append("Based on successful interactions with other students, consider these proven approaches:")
            for knowledge in relevant_knowledge[:3]:
                prompt_parts.append(f"- Pattern: {knowledge['pattern']} (Success rate: {knowledge['success_rate']:.1%})")
        
        # 8. Conversation history
        if conversation_history:
            context_part = "Recent conversation context:\n"
            for msg in conversation_history[-4:]:
                context_part += f"Student: {msg.get('user_message', '')}\n"
                context_part += f"You: {msg.get('ai_response', '')}\n"
            prompt_parts.append(context_part)
        
        # 9. Current question and instructions
        prompt_parts.append(f"Current question: {user_message}")
        
        # 10. Final instructions
        final_instructions = """
Provide a helpful, accurate response that:
1. Directly answers the question
2. Matches the student's learning style and preferences
3. Corrects any misconceptions gently
4. Uses proven teaching approaches from the global knowledge base
5. Is encouraging and supportive

Remember: Your response will be used to improve the AI for all future students, so make it the best possible explanation."""
        
        prompt_parts.append(final_instructions)
        
        return "\n\n".join(prompt_parts)
    
    def _calculate_ai_confidence(self, message: str, relevant_knowledge: List[Dict], 
                               misconception_correction: Optional[Dict]) -> float:
        """Calculate AI confidence in its ability to answer well"""
        
        confidence_factors = []
        
        # Base confidence from relevant knowledge
        if relevant_knowledge:
            avg_success_rate = sum(k['success_rate'] for k in relevant_knowledge) / len(relevant_knowledge)
            knowledge_confidence = avg_success_rate * (len(relevant_knowledge) / 5)  # Normalize to 5 max
            confidence_factors.append(min(1.0, knowledge_confidence))
        else:
            confidence_factors.append(0.3)  # Low confidence without relevant knowledge
        
        # Boost if we can correct a known misconception
        if misconception_correction:
            confidence_factors.append(0.9)  # High confidence for known misconceptions
        
        # Reduce confidence for very complex or unusual questions
        message_complexity = len(message.split())
        if message_complexity > 50:
            confidence_factors.append(0.7)  # Longer questions are often more complex
        elif message_complexity < 5:
            confidence_factors.append(0.6)  # Very short questions might be unclear
        else:
            confidence_factors.append(0.8)  # Good length questions
        
        # Calculate weighted average
        final_confidence = sum(confidence_factors) / len(confidence_factors)
        
        return min(1.0, max(0.1, final_confidence))  # Clamp between 0.1 and 1.0
    
    def _update_global_knowledge_success(self, question: str, response: str):
        """Update global knowledge base with successful interactions"""
        
        # Extract pattern from successful question-answer pair
        question_pattern = self._generalize_question(question)
        response_template = self._generalize_response(response)
        
        if question_pattern and response_template:
            # Check if similar pattern exists
            similar_entry = self.db.query(models.GlobalKnowledgeBase).filter(
                models.GlobalKnowledgeBase.question_pattern.like(f"%{question_pattern[:50]}%")
            ).first()
            
            if similar_entry:
                # Update existing entry
                similar_entry.usage_count += 1
                similar_entry.success_rate = (similar_entry.success_rate * (similar_entry.usage_count - 1) + 1.0) / similar_entry.usage_count
                similar_entry.last_updated = datetime.utcnow()
            else:
                # Create new entry
                topics = self._extract_topics(question + " " + response)
                topic_category = topics[0] if topics else 'general'
                
                new_entry = models.GlobalKnowledgeBase(
                    question_pattern=question_pattern,
                    response_template=response_template,
                    topic_category=topic_category,
                    difficulty_level=self._analyze_complexity(question),
                    success_rate=1.0,
                    usage_count=1,
                    created_from_feedback=True
                )
                self.db.add(new_entry)
            
            self.db.commit()
    
    def _learn_from_feedback(self, message, rating: int, feedback_text: str, 
                           improvement_suggestion: str):
        """Learn from user feedback to improve future responses"""
        
        # Update AI learning metrics
        today = datetime.now().date()
        metrics = self.db.query(models.AILearningMetrics).filter(
            func.date(models.AILearningMetrics.date) == today
        ).first()
        
        if not metrics:
            metrics = models.AILearningMetrics(date=datetime.now())
            self.db.add(metrics)
        
        # Update metrics
        metrics.total_interactions += 1
        if rating >= 4:
            metrics.successful_interactions += 1
        
        # Update average rating
        if metrics.total_interactions == 1:
            metrics.average_response_rating = rating
        else:
            metrics.average_response_rating = (
                (metrics.average_response_rating * (metrics.total_interactions - 1) + rating) 
                / metrics.total_interactions
            )
        
        # Learn from improvement suggestions
        if improvement_suggestion and rating <= 3:
            # Analyze what type of improvement is needed
            improvement_type = self._classify_improvement_type(improvement_suggestion)
            
            # Store this learning for future responses
            self._store_improvement_pattern(
                message.user_message, 
                message.ai_response, 
                improvement_suggestion,
                improvement_type
            )
        
        self.db.commit()
    
    def _classify_improvement_type(self, suggestion: str) -> str:
        """Classify the type of improvement suggested"""
        
        suggestion_lower = suggestion.lower() if suggestion else ""
        
        if any(word in suggestion_lower for word in ['clear', 'confusing', 'understand', 'explain']):
            return 'clarity'
        elif any(word in suggestion_lower for word in ['wrong', 'incorrect', 'mistake', 'error']):
            return 'accuracy'
        elif any(word in suggestion_lower for word in ['more detail', 'elaborate', 'expand', 'deeper']):
            return 'completeness'
        elif any(word in suggestion_lower for word in ['example', 'practical', 'real world']):
            return 'examples'
        elif any(word in suggestion_lower for word in ['simple', 'complex', 'difficulty']):
            return 'difficulty_level'
        else:
            return 'general'
    
    def _store_improvement_pattern(self, question: str, response: str, 
                                 suggestion: str, improvement_type: str):
        """Store improvement patterns for future learning"""
        
        # This could be enhanced with ML models in the future
        # For now, store the pattern for manual review and system updates
        
        improvement = models.AIResponseImprovement(
            original_question=question,
            original_response=response,
            improvement_suggestion=suggestion,
            improvement_type=improvement_type,
            is_implemented=False  # Will be manually reviewed and implemented
        )
        self.db.add(improvement)
    
    # Helper methods for analysis
    
    def _analyze_sentiment(self, message: str) -> float:
        """Analyze sentiment of message"""
        try:
            blob = TextBlob(message)
            return blob.sentiment.polarity  # Returns -1 to 1
        except:
            return 0.0
    
    def _analyze_complexity(self, message: str) -> str:
        """Analyze complexity level of message"""
        words = message.split()
        avg_word_length = sum(len(word) for word in words) / len(words) if words else 0
        
        complex_indicators = ['however', 'therefore', 'consequently', 'furthermore', 'moreover']
        has_complex_words = any(word.lower() in complex_indicators for word in words)
        
        if avg_word_length > 6 or has_complex_words or len(words) > 30:
            return "advanced"
        elif avg_word_length < 4 and len(words) < 10:
            return "beginner"
        else:
            return "intermediate"
    
    def _classify_question_type(self, message: str) -> str:
        """Classify the type of question"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['what is', 'define', 'definition']):
            return "definition"
        elif any(word in message_lower for word in ['how to', 'how do', 'steps']):
            return "process"
        elif any(word in message_lower for word in ['why', 'reason', 'because']):
            return "explanation"
        elif any(word in message_lower for word in ['example', 'instance']):
            return "example_request"
        elif any(word in message_lower for word in ['compare', 'difference']):
            return "comparison"
        elif any(word in message_lower for word in ['solve', 'calculate']):
            return "problem_solving"
        else:
            return "general_question"
    
    def _detect_emotional_indicators(self, message: str) -> List[str]:
        """Detect emotional state indicators"""
        indicators = []
        message_lower = message.lower()
        
        emotion_patterns = {
            'frustrated': ['frustrated', 'stuck', 'confused', 'lost', 'difficult'],
            'excited': ['excited', 'amazing', 'awesome', 'love', 'fantastic'],
            'anxious': ['worried', 'anxious', 'nervous', 'scared', 'concerned'],
            'confident': ['confident', 'sure', 'certain', 'know', 'understand'],
            'curious': ['curious', 'wonder', 'interesting', 'intrigued']
        }
        
        for emotion, patterns in emotion_patterns.items():
            if any(pattern in message_lower for pattern in patterns):
                indicators.append(emotion)
        
        return indicators
    
    def _detect_learning_style_clues(self, message: str) -> Dict[str, int]:
        """Detect learning style preferences"""
        visual_clues = ['see', 'look', 'picture', 'diagram', 'visual', 'show']
        auditory_clues = ['hear', 'sound', 'listen', 'tell', 'explain', 'say']
        kinesthetic_clues = ['do', 'practice', 'hands-on', 'try', 'experience']
        reading_clues = ['read', 'text', 'written', 'document', 'article']
        
        message_lower = message.lower()
        
        return {
            'visual': sum(1 for clue in visual_clues if clue in message_lower),
            'auditory': sum(1 for clue in auditory_clues if clue in message_lower),
            'kinesthetic': sum(1 for clue in kinesthetic_clues if clue in message_lower),
            'reading': sum(1 for clue in reading_clues if clue in message_lower)
        }
    
    def _detect_urgency(self, message: str) -> str:
        """Detect urgency level"""
        message_lower = message.lower()
        
        high_urgency = ['urgent', 'asap', 'immediately', 'right now', 'deadline', 'test tomorrow']
        medium_urgency = ['soon', 'tonight', 'tomorrow', 'assignment', 'homework']
        
        if any(word in message_lower for word in high_urgency):
            return "high"
        elif any(word in message_lower for word in medium_urgency):
            return "medium"
        else:
            return "low"
    
    def _analyze_formality(self, message: str) -> float:
        """Analyze formality level"""
        formal_indicators = ['please', 'thank you', 'could you', 'would you']
        casual_indicators = ['hey', 'hi', 'yeah', 'gonna', 'wanna']
        
        message_lower = message.lower()
        formal_count = sum(1 for indicator in formal_indicators if indicator in message_lower)
        casual_count = sum(1 for indicator in casual_indicators if indicator in message_lower)
        
        if formal_count + casual_count == 0:
            return 0.5
        return formal_count / (formal_count + casual_count)
    
    def _detect_confusion(self, message: str) -> List[str]:
        """Detect confusion indicators"""
        confusion_indicators = []
        message_lower = message.lower()
        
        patterns = {
            'general_confusion': ['confused', 'lost', 'dont understand', "don't get it"],
            'conceptual_confusion': ['why does', 'how come', 'what does this mean'],
            'procedural_confusion': ['what do i do', 'how do i', 'what step'],
            'terminology_confusion': ['what is', 'what does', 'define']
        }
        
        for confusion_type, phrases in patterns.items():
            if any(phrase in message_lower for phrase in phrases):
                confusion_indicators.append(confusion_type)
        
        return confusion_indicators
    
    def _extract_topics(self, text: str) -> List[str]:
        """Extract topics from text"""
        topic_patterns = {
            'mathematics': r'\b(math|algebra|calculus|geometry|statistics|equation)\b',
            'physics': r'\b(physics|force|energy|motion|wave|quantum)\b',
            'chemistry': r'\b(chemistry|chemical|molecule|atom|reaction)\b',
            'biology': r'\b(biology|cell|DNA|organism|evolution)\b',
            'computer_science': r'\b(programming|code|algorithm|software)\b',
            'history': r'\b(history|historical|war|ancient|civilization)\b',
            'literature': r'\b(literature|novel|poem|author|character)\b'
        }
        
        text_lower = text.lower()
        topics = []
        
        for topic, pattern in topic_patterns.items():
            if re.search(pattern, text_lower):
                topics.append(topic)
        
        return topics
    
    def _generalize_question(self, question: str) -> str:
        """Generalize a question to create a pattern"""
        # Simple generalization - replace specific terms with placeholders
        generalized = question
        
        # Replace numbers with {number}
        generalized = re.sub(r'\b\d+\.?\d*\b', '{number}', generalized)
        
        # Replace proper nouns (basic detection)
        words = generalized.split()
        for i, word in enumerate(words):
            if word[0].isupper() and word.lower() not in ['what', 'how', 'why', 'when', 'where']:
                words[i] = '{concept}'
        
        return ' '.join(words)
    
    def _generalize_response(self, response: str) -> str:
        """Generalize a response to create a template"""
        # Simple template creation
        template = response
        
        # Replace specific examples with placeholders
        template = re.sub(r'\b\d+\.?\d*\b', '{number}', template)
        
        return template[:500] + "..." if len(template) > 500 else template