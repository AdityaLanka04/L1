"""
Advanced AI Chat Agent System
Provides sophisticated conversational learning with weakness analysis,
adaptive difficulty, and personalized learning path recommendations.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum
import re
from collections import defaultdict, Counter
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConversationMode(Enum):
    """Different modes of conversation"""
    TUTORING = "tutoring"
    SOCRATIC = "socratic"
    EXPLANATION = "explanation"
    PRACTICE = "practice"
    REVIEW = "review"
    EXPLORATION = "exploration"
    DEBUGGING = "debugging"


class DifficultyLevel(Enum):
    """Difficulty levels for content"""
    BEGINNER = 1
    INTERMEDIATE = 2
    ADVANCED = 3
    EXPERT = 4


class LearningStyle(Enum):
    """Learning style preferences"""
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"


@dataclass
class ConceptMastery:
    """Tracks mastery of a specific concept"""
    concept_name: str
    mastery_level: float  # 0.0 to 1.0
    attempts: int
    correct_responses: int
    last_interaction: datetime
    difficulty_level: int
    common_mistakes: List[str]
    time_spent_seconds: int
    confidence_score: float
    
    def update_mastery(self, is_correct: bool, time_taken: int):
        """Update mastery based on performance"""
        self.attempts += 1
        if is_correct:
            self.correct_responses += 1
        
        # Calculate new mastery level
        accuracy = self.correct_responses / self.attempts
        time_factor = min(1.0, 60 / max(time_taken, 1))  # Faster = better
        self.mastery_level = (accuracy * 0.7 + time_factor * 0.3)
        self.last_interaction = datetime.now()
        self.time_spent_seconds += time_taken


@dataclass
class WeaknessPattern:
    """Identifies patterns in student weaknesses"""
    category: str
    subcategory: str
    frequency: int
    severity: float  # 0.0 to 1.0
    first_detected: datetime
    last_detected: datetime
    related_concepts: List[str]
    suggested_resources: List[str]
    improvement_rate: float


@dataclass
class LearningInsight:
    """Insights generated from learning patterns"""
    insight_type: str
    title: str
    description: str
    priority: int  # 1-5, 5 being highest
    actionable_steps: List[str]
    estimated_impact: str
    timestamp: datetime


class AIConversationAnalyzer:
    """Analyzes conversation patterns and learning effectiveness"""
    
    def __init__(self):
        self.conversation_history = []
        self.concept_mentions = defaultdict(int)
        self.question_types = defaultdict(int)
        self.response_times = []
        self.confusion_indicators = [
            "i don't understand", "confused", "what does", "can you explain",
            "i'm lost", "not sure", "don't get it", "unclear", "help"
        ]
        
    def analyze_message(self, message: str, is_student: bool) -> Dict[str, Any]:
        """Analyze a single message for learning indicators"""
        analysis = {
            "sentiment": self._analyze_sentiment(message),
            "complexity": self._calculate_complexity(message),
            "concepts_mentioned": self._extract_concepts(message),
            "question_type": self._identify_question_type(message) if is_student else None,
            "confusion_level": self._detect_confusion(message) if is_student else 0,
            "engagement_score": self._calculate_engagement(message)
        }
        return analysis
    
    def _analyze_sentiment(self, text: str) -> str:
        """Analyze sentiment of the message"""
        positive_words = ["understand", "got it", "makes sense", "clear", "thanks", "helpful"]
        negative_words = ["confused", "don't understand", "lost", "difficult", "hard"]
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            return "positive"
        elif negative_count > positive_count:
            return "negative"
        return "neutral"
    
    def _calculate_complexity(self, text: str) -> float:
        """Calculate text complexity score"""
        words = text.split()
        if not words:
            return 0.0
        
        avg_word_length = sum(len(word) for word in words) / len(words)
        sentence_count = text.count('.') + text.count('!') + text.count('?') + 1
        words_per_sentence = len(words) / sentence_count
        
        # Normalize to 0-1 scale
        complexity = min(1.0, (avg_word_length / 10 + words_per_sentence / 20) / 2)
        return complexity
    
    def _extract_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        # Simple keyword extraction (can be enhanced with NLP)
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        technical_terms = re.findall(r'\b[a-z]+(?:_[a-z]+)+\b', text.lower())
        return list(set(words + technical_terms))
    
    def _identify_question_type(self, text: str) -> Optional[str]:
        """Identify the type of question being asked"""
        text_lower = text.lower()
        
        if any(word in text_lower for word in ["what", "define", "meaning"]):
            return "definition"
        elif any(word in text_lower for word in ["how", "process", "steps"]):
            return "procedural"
        elif any(word in text_lower for word in ["why", "reason", "because"]):
            return "conceptual"
        elif any(word in text_lower for word in ["example", "instance", "demonstrate"]):
            return "example"
        elif any(word in text_lower for word in ["compare", "difference", "versus"]):
            return "comparison"
        return "general"
    
    def _detect_confusion(self, text: str) -> float:
        """Detect level of confusion in student message"""
        text_lower = text.lower()
        confusion_count = sum(1 for indicator in self.confusion_indicators if indicator in text_lower)
        return min(1.0, confusion_count / 3)
    
    def _calculate_engagement(self, text: str) -> float:
        """Calculate engagement score based on message characteristics"""
        word_count = len(text.split())
        has_question = '?' in text
        has_examples = any(word in text.lower() for word in ["example", "like", "such as"])
        
        engagement = 0.0
        if word_count > 10:
            engagement += 0.3
        if has_question:
            engagement += 0.4
        if has_examples:
            engagement += 0.3
        
        return min(1.0, engagement)


class WeaknessDetector:
    """Detects and tracks student weaknesses"""
    
    def __init__(self):
        self.weakness_patterns = {}
        self.concept_errors = defaultdict(list)
        self.misconceptions = defaultdict(int)
        
    def detect_weaknesses(self, conversation_history: List[Dict], 
                         concept_mastery: Dict[str, ConceptMastery]) -> List[WeaknessPattern]:
        """Detect patterns of weakness from conversation and mastery data"""
        weaknesses = []
        
        # Analyze concept mastery
        for concept_name, mastery in concept_mastery.items():
            if mastery.mastery_level < 0.6:
                weakness = WeaknessPattern(
                    category="concept_understanding",
                    subcategory=concept_name,
                    frequency=mastery.attempts,
                    severity=1.0 - mastery.mastery_level,
                    first_detected=mastery.last_interaction - timedelta(days=7),
                    last_detected=mastery.last_interaction,
                    related_concepts=self._find_related_concepts(concept_name, concept_mastery),
                    suggested_resources=self._generate_resources(concept_name),
                    improvement_rate=self._calculate_improvement_rate(mastery)
                )
                weaknesses.append(weakness)
        
        # Analyze conversation patterns
        confusion_topics = self._analyze_confusion_patterns(conversation_history)
        for topic, frequency in confusion_topics.items():
            if frequency > 2:
                weakness = WeaknessPattern(
                    category="comprehension",
                    subcategory=topic,
                    frequency=frequency,
                    severity=min(1.0, frequency / 5),
                    first_detected=datetime.now() - timedelta(days=3),
                    last_detected=datetime.now(),
                    related_concepts=[],
                    suggested_resources=self._generate_resources(topic),
                    improvement_rate=0.0
                )
                weaknesses.append(weakness)
        
        return sorted(weaknesses, key=lambda x: x.severity, reverse=True)
    
    def _find_related_concepts(self, concept: str, all_mastery: Dict) -> List[str]:
        """Find concepts related to the weak concept"""
        related = []
        for other_concept, mastery in all_mastery.items():
            if other_concept != concept and mastery.mastery_level < 0.7:
                related.append(other_concept)
        return related[:3]
    
    def _generate_resources(self, concept: str) -> List[str]:
        """Generate suggested learning resources"""
        return [
            f"Review fundamentals of {concept}",
            f"Practice problems on {concept}",
            f"Watch video tutorial on {concept}",
            f"Create flashcards for {concept}",
            f"Discuss {concept} with AI tutor"
        ]
    
    def _calculate_improvement_rate(self, mastery: ConceptMastery) -> float:
        """Calculate rate of improvement"""
        if mastery.attempts < 5:
            return 0.0
        recent_accuracy = mastery.correct_responses / mastery.attempts
        return recent_accuracy * 0.1  # Simplified calculation
    
    def _analyze_confusion_patterns(self, history: List[Dict]) -> Dict[str, int]:
        """Analyze conversation history for confusion patterns"""
        confusion_topics = defaultdict(int)
        
        for entry in history:
            if entry.get("is_student") and entry.get("confusion_level", 0) > 0.5:
                concepts = entry.get("concepts_mentioned", [])
                for concept in concepts:
                    confusion_topics[concept] += 1
        
        return confusion_topics


class AdaptiveDifficultyManager:
    """Manages adaptive difficulty based on student performance"""
    
    def __init__(self):
        self.performance_history = []
        self.current_difficulty = DifficultyLevel.INTERMEDIATE
        self.adjustment_threshold = 0.75
        
    def adjust_difficulty(self, recent_performance: List[bool]) -> DifficultyLevel:
        """Adjust difficulty based on recent performance"""
        if len(recent_performance) < 3:
            return self.current_difficulty
        
        accuracy = sum(recent_performance) / len(recent_performance)
        
        if accuracy >= 0.85 and self.current_difficulty.value < 4:
            # Increase difficulty
            new_level = DifficultyLevel(self.current_difficulty.value + 1)
            logger.info(f"Increasing difficulty to {new_level.name}")
            return new_level
        elif accuracy < 0.5 and self.current_difficulty.value > 1:
            # Decrease difficulty
            new_level = DifficultyLevel(self.current_difficulty.value - 1)
            logger.info(f"Decreasing difficulty to {new_level.name}")
            return new_level
        
        return self.current_difficulty
    
    def get_difficulty_parameters(self, level: DifficultyLevel) -> Dict[str, Any]:
        """Get parameters for the current difficulty level"""
        params = {
            DifficultyLevel.BEGINNER: {
                "explanation_depth": "basic",
                "examples_count": 3,
                "hints_available": True,
                "step_by_step": True,
                "vocabulary_level": "simple"
            },
            DifficultyLevel.INTERMEDIATE: {
                "explanation_depth": "moderate",
                "examples_count": 2,
                "hints_available": True,
                "step_by_step": False,
                "vocabulary_level": "standard"
            },
            DifficultyLevel.ADVANCED: {
                "explanation_depth": "detailed",
                "examples_count": 1,
                "hints_available": False,
                "step_by_step": False,
                "vocabulary_level": "technical"
            },
            DifficultyLevel.EXPERT: {
                "explanation_depth": "comprehensive",
                "examples_count": 0,
                "hints_available": False,
                "step_by_step": False,
                "vocabulary_level": "advanced"
            }
        }
        return params.get(level, params[DifficultyLevel.INTERMEDIATE])


class PersonalizedPromptGenerator:
    """Generates personalized prompts based on student profile"""
    
    def __init__(self):
        self.prompt_templates = self._load_prompt_templates()
        
    def _load_prompt_templates(self) -> Dict[str, str]:
        """Load prompt templates for different scenarios"""
        return {
            "tutoring": """You are an expert tutor helping a student learn {subject}.
Student Profile:
- Learning Style: {learning_style}
- Current Level: {difficulty_level}
- Known Weaknesses: {weaknesses}
- Mastery Areas: {strengths}

Adapt your teaching to their learning style. Use {explanation_style} explanations.
{additional_instructions}""",
            
            "socratic": """Engage in Socratic dialogue to help the student discover {concept}.
Guide them with questions rather than direct answers.
Student's current understanding level: {mastery_level}
Focus on: {focus_areas}""",
            
            "weakness_targeted": """The student struggles with: {weakness_area}
Common mistakes: {common_mistakes}
Provide targeted practice and explanations to address this specific weakness.
Use {approach} approach.""",
            
            "review": """Help the student review {topic}.
They last studied this {days_ago} days ago.
Previous mastery level: {previous_mastery}
Focus on reinforcing weak areas: {weak_points}"""
        }
    
    def generate_system_prompt(self, mode: ConversationMode, 
                              student_profile: Dict[str, Any],
                              context: Dict[str, Any]) -> str:
        """Generate personalized system prompt"""
        template = self.prompt_templates.get(mode.value, self.prompt_templates["tutoring"])
        
        # Fill in template with student data
        prompt = template.format(
            subject=context.get("subject", "the topic"),
            learning_style=student_profile.get("learning_style", "adaptive"),
            difficulty_level=student_profile.get("difficulty_level", "intermediate"),
            weaknesses=", ".join(student_profile.get("weaknesses", [])[:3]),
            strengths=", ".join(student_profile.get("strengths", [])[:3]),
            explanation_style=self._get_explanation_style(student_profile),
            additional_instructions=self._get_additional_instructions(student_profile, context),
            concept=context.get("concept", "the concept"),
            mastery_level=context.get("mastery_level", "beginner"),
            focus_areas=", ".join(context.get("focus_areas", [])),
            weakness_area=context.get("weakness_area", "this topic"),
            common_mistakes=", ".join(context.get("common_mistakes", [])),
            approach=context.get("approach", "step-by-step"),
            topic=context.get("topic", "the material"),
            days_ago=context.get("days_since_review", 7),
            previous_mastery=context.get("previous_mastery", "moderate"),
            weak_points=", ".join(context.get("weak_points", []))
        )
        
        return prompt
    
    def _get_explanation_style(self, profile: Dict[str, Any]) -> str:
        """Determine explanation style based on learning style"""
        learning_style = profile.get("learning_style", "adaptive")
        
        styles = {
            "visual": "visual and diagram-based",
            "auditory": "conversational and narrative",
            "kinesthetic": "hands-on and example-driven",
            "reading_writing": "detailed written"
        }
        return styles.get(learning_style, "clear and structured")
    
    def _get_additional_instructions(self, profile: Dict, context: Dict) -> str:
        """Generate additional context-specific instructions"""
        instructions = []
        
        if profile.get("prefers_examples", True):
            instructions.append("Provide concrete examples.")
        
        if profile.get("needs_encouragement", False):
            instructions.append("Offer positive reinforcement.")
        
        if context.get("time_pressure", False):
            instructions.append("Be concise and focused.")
        
        return " ".join(instructions)


class LearningPathRecommender:
    """Recommends personalized learning paths"""
    
    def __init__(self):
        self.concept_dependencies = {}
        self.learning_objectives = []
        
    def recommend_next_topics(self, mastery_data: Dict[str, ConceptMastery],
                             weaknesses: List[WeaknessPattern],
                             goals: List[str]) -> List[Dict[str, Any]]:
        """Recommend next topics to study"""
        recommendations = []
        
        # Priority 1: Address critical weaknesses
        for weakness in weaknesses[:3]:
            if weakness.severity > 0.7:
                recommendations.append({
                    "topic": weakness.subcategory,
                    "reason": "Critical weakness - needs immediate attention",
                    "priority": 5,
                    "estimated_time": "30-45 minutes",
                    "approach": "targeted_practice",
                    "resources": weakness.suggested_resources
                })
        
        # Priority 2: Build on partial mastery
        for concept_name, mastery in mastery_data.items():
            if 0.4 <= mastery.mastery_level < 0.7:
                recommendations.append({
                    "topic": concept_name,
                    "reason": "Partial understanding - ready to advance",
                    "priority": 3,
                    "estimated_time": "20-30 minutes",
                    "approach": "progressive_difficulty",
                    "resources": [f"Advanced exercises on {concept_name}"]
                })
        
        # Priority 3: Introduce new related concepts
        mastered_concepts = [name for name, m in mastery_data.items() if m.mastery_level >= 0.8]
        for concept in mastered_concepts[:2]:
            next_concepts = self._get_next_concepts(concept)
            for next_concept in next_concepts:
                recommendations.append({
                    "topic": next_concept,
                    "reason": f"Natural progression from {concept}",
                    "priority": 2,
                    "estimated_time": "25-35 minutes",
                    "approach": "exploration",
                    "resources": [f"Introduction to {next_concept}"]
                })
        
        # Sort by priority and return top recommendations
        recommendations.sort(key=lambda x: x["priority"], reverse=True)
        return recommendations[:5]
    
    def _get_next_concepts(self, current_concept: str) -> List[str]:
        """Get concepts that naturally follow the current one"""
        # Simplified concept progression (can be enhanced with knowledge graph)
        progressions = {
            "variables": ["data_types", "operators"],
            "loops": ["nested_loops", "loop_optimization"],
            "functions": ["recursion", "higher_order_functions"],
            "arrays": ["linked_lists", "stacks", "queues"]
        }
        return progressions.get(current_concept.lower(), [])
    
    def generate_study_plan(self, recommendations: List[Dict], 
                           available_time: int) -> Dict[str, Any]:
        """Generate a structured study plan"""
        plan = {
            "total_time": available_time,
            "sessions": [],
            "goals": [],
            "checkpoints": []
        }
        
        time_allocated = 0
        for rec in recommendations:
            if time_allocated >= available_time:
                break
            
            session_time = self._parse_time(rec["estimated_time"])
            if time_allocated + session_time <= available_time:
                plan["sessions"].append({
                    "topic": rec["topic"],
                    "duration": session_time,
                    "activities": self._generate_activities(rec),
                    "success_criteria": self._generate_success_criteria(rec)
                })
                time_allocated += session_time
        
        return plan
    
    def _parse_time(self, time_str: str) -> int:
        """Parse time string to minutes"""
        # Extract first number from string like "30-45 minutes"
        numbers = re.findall(r'\d+', time_str)
        return int(numbers[0]) if numbers else 30
    
    def _generate_activities(self, recommendation: Dict) -> List[str]:
        """Generate specific activities for a topic"""
        approach = recommendation["approach"]
        
        activities = {
            "targeted_practice": [
                "Review concept explanation",
                "Work through 5 practice problems",
                "Identify and correct mistakes"
            ],
            "progressive_difficulty": [
                "Quick review of basics",
                "Solve intermediate problems",
                "Attempt advanced challenge"
            ],
            "exploration": [
                "Read introduction",
                "Explore examples",
                "Try simple exercises"
            ]
        }
        return activities.get(approach, activities["targeted_practice"])
    
    def _generate_success_criteria(self, recommendation: Dict) -> List[str]:
        """Generate success criteria for a topic"""
        return [
            f"Understand core concepts of {recommendation['topic']}",
            "Complete practice exercises with 80% accuracy",
            "Explain concept in own words"
        ]


class ConversationContextManager:
    """Manages conversation context and history"""
    
    def __init__(self, max_context_length: int = 10):
        self.context_window = []
        self.max_length = max_context_length
        self.topic_stack = []
        self.clarification_needed = False
        
    def add_message(self, role: str, content: str, metadata: Dict = None):
        """Add message to context"""
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.context_window.append(message)
        
        # Maintain context window size
        if len(self.context_window) > self.max_length:
            self.context_window.pop(0)
    
    def get_context_summary(self) -> str:
        """Get summary of current conversation context"""
        if not self.context_window:
            return "No previous context"
        
        topics = set()
        for msg in self.context_window:
            topics.update(msg.get("metadata", {}).get("concepts", []))
        
        return f"Current discussion topics: {', '.join(topics)}"
    
    def detect_topic_shift(self, new_message: str) -> bool:
        """Detect if conversation topic has shifted"""
        if len(self.context_window) < 2:
            return False
        
        # Simple topic shift detection (can be enhanced with NLP)
        recent_topics = set()
        for msg in self.context_window[-3:]:
            recent_topics.update(msg.get("metadata", {}).get("concepts", []))
        
        analyzer = AIConversationAnalyzer()
        new_concepts = analyzer._extract_concepts(new_message)
        
        overlap = len(set(new_concepts) & recent_topics)
        return overlap < len(new_concepts) * 0.3


class AIChatAgent:
    """Main AI Chat Agent orchestrating all components"""
    
    def __init__(self, student_id: str, api_key: str = None):
        self.student_id = student_id
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        
        # Initialize components
        self.analyzer = AIConversationAnalyzer()
        self.weakness_detector = WeaknessDetector()
        self.difficulty_manager = AdaptiveDifficultyManager()
        self.prompt_generator = PersonalizedPromptGenerator()
        self.path_recommender = LearningPathRecommender()
        self.context_manager = ConversationContextManager()
        
        # Student data
        self.student_profile = self._load_student_profile()
        self.concept_mastery = {}
        self.conversation_mode = ConversationMode.TUTORING
        self.performance_history = []
        
    def _load_student_profile(self) -> Dict[str, Any]:
        """Load student profile from database"""
        # Placeholder - integrate with actual database
        return {
            "learning_style": "visual",
            "difficulty_level": "intermediate",
            "weaknesses": [],
            "strengths": [],
            "goals": [],
            "preferences": {
                "prefers_examples": True,
                "needs_encouragement": True,
                "learning_pace": "moderate"
            }
        }
    
    def process_message(self, user_message: str, context: Dict = None) -> Dict[str, Any]:
        """Process user message and generate response"""
        context = context or {}
        
        # Analyze user message
        message_analysis = self.analyzer.analyze_message(user_message, is_student=True)
        
        # Update context
        self.context_manager.add_message("user", user_message, message_analysis)
        
        # Detect topic shift
        topic_shifted = self.context_manager.detect_topic_shift(user_message)
        if topic_shifted:
            logger.info("Topic shift detected")
        
        # Adjust difficulty if needed
        if len(self.performance_history) >= 5:
            new_difficulty = self.difficulty_manager.adjust_difficulty(
                self.performance_history[-5:]
            )
            self.difficulty_manager.current_difficulty = new_difficulty
        
        # Generate personalized system prompt
        system_prompt = self.prompt_generator.generate_system_prompt(
            self.conversation_mode,
            self.student_profile,
            {
                **context,
                "current_difficulty": self.difficulty_manager.current_difficulty.name,
                "recent_analysis": message_analysis
            }
        )
        
        # Generate AI response (integrate with your AI model)
        ai_response = self._generate_ai_response(system_prompt, user_message)
        
        # Analyze AI response
        response_analysis = self.analyzer.analyze_message(ai_response, is_student=False)
        
        # Update context with AI response
        self.context_manager.add_message("assistant", ai_response, response_analysis)
        
        # Detect weaknesses
        weaknesses = self.weakness_detector.detect_weaknesses(
            self.context_manager.context_window,
            self.concept_mastery
        )
        
        # Generate insights
        insights = self._generate_insights(message_analysis, weaknesses)
        
        # Get recommendations
        recommendations = self.path_recommender.recommend_next_topics(
            self.concept_mastery,
            weaknesses,
            self.student_profile.get("goals", [])
        )
        
        return {
            "response": ai_response,
            "analysis": {
                "user_message": message_analysis,
                "ai_response": response_analysis,
                "confusion_detected": message_analysis["confusion_level"] > 0.5,
                "engagement_score": message_analysis["engagement_score"]
            },
            "weaknesses": [asdict(w) for w in weaknesses[:3]],
            "insights": insights,
            "recommendations": recommendations[:3],
            "difficulty_level": self.difficulty_manager.current_difficulty.name,
            "context_summary": self.context_manager.get_context_summary()
        }
    
    def _generate_ai_response(self, system_prompt: str, user_message: str) -> str:
        """Generate AI response using language model with caching"""
        try:
            # Import the cached unified AI client
            from main import unified_ai
            
            # Combine system prompt and user message
            full_prompt = f"{system_prompt}\n\nStudent: {user_message}\n\nTutor:"
            
            # CRITICAL: Disable caching for chat conversations
            # Each message should get a fresh response based on conversation context
            response = unified_ai.generate(
                full_prompt, 
                max_tokens=2000, 
                temperature=0.7,
                use_cache=False,  # DISABLE CACHING FOR CONVERSATIONS
                conversation_id=f"aichat_{self.student_id}"  # Unique per student
            )
            
            return response
        except Exception as e:
            logger.error(f"Error generating AI response: {e}")
            return "I'm having trouble processing that. Could you rephrase your question?"
    
    def _generate_insights(self, message_analysis: Dict, 
                          weaknesses: List[WeaknessPattern]) -> List[Dict]:
        """Generate learning insights"""
        insights = []
        
        # Insight from confusion
        if message_analysis["confusion_level"] > 0.6:
            insights.append({
                "type": "confusion_alert",
                "title": "Confusion Detected",
                "description": "You seem confused about this topic. Let's break it down step by step.",
                "priority": 5,
                "actions": [
                    "Review fundamentals",
                    "Try simpler examples",
                    "Ask specific questions"
                ]
            })
        
        # Insight from weaknesses
        if weaknesses:
            top_weakness = weaknesses[0]
            insights.append({
                "type": "weakness_identified",
                "title": f"Focus Area: {top_weakness.subcategory}",
                "description": f"This area needs attention. Severity: {top_weakness.severity:.0%}",
                "priority": 4,
                "actions": top_weakness.suggested_resources[:3]
            })
        
        # Insight from engagement
        if message_analysis["engagement_score"] > 0.7:
            insights.append({
                "type": "positive_engagement",
                "title": "Great Engagement!",
                "description": "You're actively participating. Keep it up!",
                "priority": 2,
                "actions": ["Continue with current approach"]
            })
        
        return insights
    
    def update_mastery(self, concept: str, is_correct: bool, time_taken: int):
        """Update concept mastery"""
        if concept not in self.concept_mastery:
            self.concept_mastery[concept] = ConceptMastery(
                concept_name=concept,
                mastery_level=0.0,
                attempts=0,
                correct_responses=0,
                last_interaction=datetime.now(),
                difficulty_level=self.difficulty_manager.current_difficulty.value,
                common_mistakes=[],
                time_spent_seconds=0,
                confidence_score=0.0
            )
        
        self.concept_mastery[concept].update_mastery(is_correct, time_taken)
        self.performance_history.append(is_correct)
    
    def get_study_plan(self, available_time: int = 60) -> Dict[str, Any]:
        """Generate personalized study plan"""
        weaknesses = self.weakness_detector.detect_weaknesses(
            self.context_manager.context_window,
            self.concept_mastery
        )
        
        recommendations = self.path_recommender.recommend_next_topics(
            self.concept_mastery,
            weaknesses,
            self.student_profile.get("goals", [])
        )
        
        return self.path_recommender.generate_study_plan(recommendations, available_time)
    
    def switch_mode(self, new_mode: ConversationMode):
        """Switch conversation mode"""
        self.conversation_mode = new_mode
        logger.info(f"Switched to {new_mode.name} mode")
    
    def get_progress_report(self) -> Dict[str, Any]:
        """Generate comprehensive progress report"""
        total_concepts = len(self.concept_mastery)
        mastered = sum(1 for m in self.concept_mastery.values() if m.mastery_level >= 0.8)
        in_progress = sum(1 for m in self.concept_mastery.values() if 0.4 <= m.mastery_level < 0.8)
        struggling = sum(1 for m in self.concept_mastery.values() if m.mastery_level < 0.4)
        
        weaknesses = self.weakness_detector.detect_weaknesses(
            self.context_manager.context_window,
            self.concept_mastery
        )
        
        return {
            "overview": {
                "total_concepts": total_concepts,
                "mastered": mastered,
                "in_progress": in_progress,
                "struggling": struggling,
                "overall_progress": (mastered / total_concepts * 100) if total_concepts > 0 else 0
            },
            "mastery_breakdown": {
                name: {
                    "level": m.mastery_level,
                    "attempts": m.attempts,
                    "accuracy": m.correct_responses / m.attempts if m.attempts > 0 else 0
                }
                for name, m in self.concept_mastery.items()
            },
            "weaknesses": [asdict(w) for w in weaknesses],
            "recent_performance": {
                "last_10_accuracy": sum(self.performance_history[-10:]) / min(10, len(self.performance_history))
                if self.performance_history else 0,
                "trend": self._calculate_trend()
            },
            "recommendations": self.path_recommender.recommend_next_topics(
                self.concept_mastery,
                weaknesses,
                self.student_profile.get("goals", [])
            )
        }
    
    def _calculate_trend(self) -> str:
        """Calculate performance trend"""
        if len(self.performance_history) < 10:
            return "insufficient_data"
        
        recent = sum(self.performance_history[-5:]) / 5
        older = sum(self.performance_history[-10:-5]) / 5
        
        if recent > older + 0.1:
            return "improving"
        elif recent < older - 0.1:
            return "declining"
        return "stable"


# Example usage and testing
if __name__ == "__main__":
    # Initialize agent
    agent = AIChatAgent(student_id="student_123")
    
    # Simulate conversation
    messages = [
        "Can you explain what recursion is?",
        "I don't understand how the base case works",
        "Can you give me an example?",
        "That makes more sense now, thanks!"
    ]
    
    print("=== AI Chat Agent Demo ===\n")
    
    for msg in messages:
        print(f"Student: {msg}")
        result = agent.process_message(msg)
        print(f"AI: {result['response']}\n")
        
        if result['weaknesses']:
            print("Detected Weaknesses:")
            for weakness in result['weaknesses']:
                print(f"  - {weakness['subcategory']}: {weakness['severity']:.0%} severity")
        
        if result['insights']:
            print("\nInsights:")
            for insight in result['insights']:
                print(f"  - {insight['title']}: {insight['description']}")
        
        print("\n" + "="*50 + "\n")
    
    # Get progress report
    print("\n=== Progress Report ===")
    report = agent.get_progress_report()
    print(json.dumps(report, indent=2, default=str))
    
    # Get study plan
    print("\n=== Study Plan (60 minutes) ===")
    plan = agent.get_study_plan(60)
    print(json.dumps(plan, indent=2, default=str))
