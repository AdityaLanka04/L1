"""
Advanced Flashcard Learning Agent System
Implements sophisticated spaced repetition, weakness detection,
and adaptive learning algorithms for optimal flashcard-based learning.
"""

import os
import json
import logging
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict, field
from enum import Enum
from collections import defaultdict, deque
import random
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CardDifficulty(Enum):
    """Difficulty ratings for flashcards"""
    EASY = 1
    MEDIUM = 2
    HARD = 3
    VERY_HARD = 4


class ReviewQuality(Enum):
    """Quality of review response"""
    COMPLETE_BLACKOUT = 0  # Complete failure
    INCORRECT = 1  # Incorrect response
    INCORRECT_BUT_REMEMBERED = 2  # Incorrect but showed some memory
    CORRECT_WITH_DIFFICULTY = 3  # Correct but required effort
    CORRECT_WITH_HESITATION = 4  # Correct with slight hesitation
    PERFECT = 5  # Perfect recall


class LearningPhase(Enum):
    """Learning phases for cards"""
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    RELEARNING = "relearning"
    MASTERED = "mastered"


class CardType(Enum):
    """Types of flashcards"""
    BASIC = "basic"
    CLOZE = "cloze"
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    IMAGE_OCCLUSION = "image_occlusion"
    AUDIO = "audio"


@dataclass
class FlashcardMetrics:
    """Comprehensive metrics for a flashcard"""
    card_id: str
    total_reviews: int = 0
    correct_reviews: int = 0
    incorrect_reviews: int = 0
    average_response_time: float = 0.0
    fastest_response_time: float = float('inf')
    slowest_response_time: float = 0.0
    streak_correct: int = 0
    streak_incorrect: int = 0
    last_review_date: Optional[datetime] = None
    next_review_date: Optional[datetime] = None
    ease_factor: float = 2.5  # SM-2 algorithm ease factor
    interval_days: float = 0.0
    repetitions: int = 0
    lapses: int = 0  # Number of times forgotten after being learned
    learning_phase: LearningPhase = LearningPhase.NEW
    difficulty_rating: CardDifficulty = CardDifficulty.MEDIUM
    confidence_score: float = 0.0
    retention_rate: float = 0.0
    time_to_mastery_estimate: Optional[int] = None
    
    def update_after_review(self, quality: ReviewQuality, response_time: float):
        """Update metrics after a review"""
        self.total_reviews += 1
        self.last_review_date = datetime.now()
        
        # Update response times
        self.average_response_time = (
            (self.average_response_time * (self.total_reviews - 1) + response_time) 
            / self.total_reviews
        )
        self.fastest_response_time = min(self.fastest_response_time, response_time)
        self.slowest_response_time = max(self.slowest_response_time, response_time)
        
        # Update correct/incorrect counts
        if quality.value >= 3:
            self.correct_reviews += 1
            self.streak_correct += 1
            self.streak_incorrect = 0
        else:
            self.incorrect_reviews += 1
            self.streak_incorrect += 1
            self.streak_correct = 0
            if self.learning_phase in [LearningPhase.REVIEW, LearningPhase.MASTERED]:
                self.lapses += 1
        
        # Update retention rate
        if self.total_reviews > 0:
            self.retention_rate = self.correct_reviews / self.total_reviews
        
        # Update confidence score
        self._update_confidence_score(quality, response_time)
    
    def _update_confidence_score(self, quality: ReviewQuality, response_time: float):
        """Calculate confidence score based on multiple factors"""
        # Quality factor (0-1)
        quality_factor = quality.value / 5.0
        
        # Speed factor (faster = more confident)
        speed_factor = 1.0 if response_time < 3 else max(0.3, 1.0 - (response_time - 3) / 10)
        
        # Streak factor
        streak_factor = min(1.0, self.streak_correct / 5)
        
        # Combine factors
        self.confidence_score = (
            quality_factor * 0.5 + 
            speed_factor * 0.3 + 
            streak_factor * 0.2
        )


@dataclass
class CardWeakness:
    """Identifies specific weaknesses with a card"""
    card_id: str
    weakness_type: str
    severity: float  # 0.0 to 1.0
    description: str
    first_detected: datetime
    occurrence_count: int
    suggested_actions: List[str]
    related_cards: List[str] = field(default_factory=list)


@dataclass
class StudySession:
    """Represents a study session"""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    cards_reviewed: List[str] = field(default_factory=list)
    cards_correct: int = 0
    cards_incorrect: int = 0
    total_time_seconds: int = 0
    average_quality: float = 0.0
    focus_score: float = 0.0
    efficiency_score: float = 0.0
    cards_mastered: int = 0
    cards_learned: int = 0


class SuperMemoAlgorithm:
    """Enhanced SM-2 (SuperMemo 2) spaced repetition algorithm"""
    
    def __init__(self):
        self.min_ease_factor = 1.3
        self.max_ease_factor = 2.5
        self.initial_ease_factor = 2.5
        
    def calculate_next_interval(self, metrics: FlashcardMetrics, 
                                quality: ReviewQuality) -> Tuple[float, float, datetime]:
        """Calculate next review interval using SM-2 algorithm"""
        q = quality.value
        
        # Update ease factor
        new_ease = metrics.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ease = max(self.min_ease_factor, new_ease)
        
        # Calculate interval
        if q < 3:  # Failed
            new_interval = 1 / 1440  # 1 minute in days
            new_repetitions = 0
            metrics.learning_phase = LearningPhase.RELEARNING
        else:
            if metrics.repetitions == 0:
                new_interval = 1  # 1 day
            elif metrics.repetitions == 1:
                new_interval = 6  # 6 days
            else:
                new_interval = metrics.interval_days * new_ease
            
            new_repetitions = metrics.repetitions + 1
            
            # Update learning phase
            if new_interval >= 21:
                metrics.learning_phase = LearningPhase.MASTERED
            elif new_interval >= 1:
                metrics.learning_phase = LearningPhase.REVIEW
            else:
                metrics.learning_phase = LearningPhase.LEARNING
        
        next_review = datetime.now() + timedelta(days=new_interval)
        
        return new_interval, new_ease, next_review
    
    def adjust_for_difficulty(self, interval: float, difficulty: CardDifficulty) -> float:
        """Adjust interval based on card difficulty"""
        difficulty_multipliers = {
            CardDifficulty.EASY: 1.3,
            CardDifficulty.MEDIUM: 1.0,
            CardDifficulty.HARD: 0.8,
            CardDifficulty.VERY_HARD: 0.6
        }
        return interval * difficulty_multipliers.get(difficulty, 1.0)


class LeitnerSystem:
    """Leitner system for flashcard organization"""
    
    def __init__(self, num_boxes: int = 5):
        self.num_boxes = num_boxes
        self.boxes = {i: [] for i in range(num_boxes)}
        self.review_intervals = {
            0: 1,    # Daily
            1: 3,    # Every 3 days
            2: 7,    # Weekly
            3: 14,   # Bi-weekly
            4: 30    # Monthly
        }
    
    def add_card(self, card_id: str, box: int = 0):
        """Add card to a box"""
        if 0 <= box < self.num_boxes:
            self.boxes[box].append(card_id)
    
    def move_card(self, card_id: str, correct: bool):
        """Move card based on review result"""
        current_box = self._find_card_box(card_id)
        if current_box is None:
            return
        
        self.boxes[current_box].remove(card_id)
        
        if correct:
            # Move to next box
            new_box = min(current_box + 1, self.num_boxes - 1)
        else:
            # Move back to first box
            new_box = 0
        
        self.boxes[new_box].append(card_id)
    
    def _find_card_box(self, card_id: str) -> Optional[int]:
        """Find which box contains the card"""
        for box, cards in self.boxes.items():
            if card_id in cards:
                return box
        return None
    
    def get_due_cards(self, current_date: datetime) -> List[str]:
        """Get cards due for review"""
        due_cards = []
        for box, cards in self.boxes.items():
            # Simplified - in practice, track last review date per card
            due_cards.extend(cards)
        return due_cards


class WeaknessAnalyzer:
    """Analyzes patterns in flashcard performance to identify weaknesses"""
    
    def __init__(self):
        self.weakness_patterns = {}
        self.concept_relationships = defaultdict(set)
        
    def analyze_card_performance(self, metrics: FlashcardMetrics, 
                                 card_content: Dict) -> List[CardWeakness]:
        """Analyze performance to identify weaknesses"""
        weaknesses = []
        
        # Low retention rate
        if metrics.retention_rate < 0.5 and metrics.total_reviews >= 5:
            weaknesses.append(CardWeakness(
                card_id=metrics.card_id,
                weakness_type="low_retention",
                severity=1.0 - metrics.retention_rate,
                description="Consistently struggling to remember this card",
                first_detected=datetime.now() - timedelta(days=7),
                occurrence_count=metrics.incorrect_reviews,
                suggested_actions=[
                    "Break down into simpler cards",
                    "Add mnemonic devices",
                    "Create related cards for context",
                    "Review more frequently"
                ]
            ))
        
        # Slow response time
        if metrics.average_response_time > 10 and metrics.total_reviews >= 3:
            weaknesses.append(CardWeakness(
                card_id=metrics.card_id,
                weakness_type="slow_recall",
                severity=min(1.0, metrics.average_response_time / 20),
                description="Takes too long to recall information",
                first_detected=datetime.now() - timedelta(days=3),
                occurrence_count=metrics.total_reviews,
                suggested_actions=[
                    "Practice active recall more frequently",
                    "Simplify the card content",
                    "Add visual cues",
                    "Create association techniques"
                ]
            ))
        
        # High lapse rate
        if metrics.lapses >= 3:
            weaknesses.append(CardWeakness(
                card_id=metrics.card_id,
                weakness_type="frequent_lapses",
                severity=min(1.0, metrics.lapses / 5),
                description="Frequently forgetting after initial learning",
                first_detected=datetime.now() - timedelta(days=14),
                occurrence_count=metrics.lapses,
                suggested_actions=[
                    "Strengthen foundational knowledge",
                    "Increase review frequency",
                    "Connect to existing knowledge",
                    "Use elaborative rehearsal"
                ]
            ))
        
        # Low confidence
        if metrics.confidence_score < 0.4 and metrics.total_reviews >= 3:
            weaknesses.append(CardWeakness(
                card_id=metrics.card_id,
                weakness_type="low_confidence",
                severity=1.0 - metrics.confidence_score,
                description="Lack of confidence in answers",
                first_detected=datetime.now() - timedelta(days=5),
                occurrence_count=metrics.total_reviews,
                suggested_actions=[
                    "Review related concepts",
                    "Practice with similar cards",
                    "Build understanding gradually",
                    "Use self-explanation technique"
                ]
            ))
        
        return weaknesses
    
    def identify_concept_gaps(self, all_metrics: Dict[str, FlashcardMetrics],
                             card_tags: Dict[str, List[str]]) -> List[Dict]:
        """Identify gaps in concept understanding"""
        concept_performance = defaultdict(list)
        
        # Group cards by concept
        for card_id, metrics in all_metrics.items():
            tags = card_tags.get(card_id, [])
            for tag in tags:
                concept_performance[tag].append(metrics.retention_rate)
        
        # Identify weak concepts
        weak_concepts = []
        for concept, rates in concept_performance.items():
            avg_rate = sum(rates) / len(rates) if rates else 0
            if avg_rate < 0.6:
                weak_concepts.append({
                    "concept": concept,
                    "average_retention": avg_rate,
                    "card_count": len(rates),
                    "severity": 1.0 - avg_rate,
                    "recommendation": self._generate_concept_recommendation(concept, avg_rate)
                })
        
        return sorted(weak_concepts, key=lambda x: x["severity"], reverse=True)
    
    def _generate_concept_recommendation(self, concept: str, retention: float) -> str:
        """Generate recommendation for weak concept"""
        if retention < 0.3:
            return f"Critical: Review fundamentals of {concept} immediately"
        elif retention < 0.5:
            return f"Important: Strengthen understanding of {concept}"
        else:
            return f"Moderate: Continue practicing {concept}"


class AdaptiveScheduler:
    """Adaptive scheduling system that learns from user patterns"""
    
    def __init__(self):
        self.user_patterns = {
            "best_time_of_day": None,
            "optimal_session_length": 20,  # minutes
            "cards_per_session": 20,
            "accuracy_by_time": defaultdict(list),
            "focus_by_duration": defaultdict(list)
        }
        self.sm2 = SuperMemoAlgorithm()
        
    def schedule_review(self, metrics: FlashcardMetrics, 
                       quality: ReviewQuality) -> datetime:
        """Schedule next review with adaptive adjustments"""
        # Base calculation using SM-2
        interval, ease, next_review = self.sm2.calculate_next_interval(metrics, quality)
        
        # Adjust based on user patterns
        adjusted_review = self._adjust_for_user_patterns(next_review, metrics)
        
        # Adjust for optimal learning times
        adjusted_review = self._adjust_for_optimal_time(adjusted_review)
        
        return adjusted_review
    
    def _adjust_for_user_patterns(self, scheduled_time: datetime, 
                                  metrics: FlashcardMetrics) -> datetime:
        """Adjust schedule based on learned user patterns"""
        # If user performs better at certain times, schedule then
        if self.user_patterns["best_time_of_day"]:
            target_hour = self.user_patterns["best_time_of_day"]
            scheduled_time = scheduled_time.replace(hour=target_hour, minute=0)
        
        return scheduled_time
    
    def _adjust_for_optimal_time(self, scheduled_time: datetime) -> datetime:
        """Adjust to optimal learning time based on circadian rhythm"""
        hour = scheduled_time.hour
        
        # Avoid late night (poor retention)
        if 23 <= hour or hour < 6:
            scheduled_time = scheduled_time.replace(hour=9, minute=0)
        
        return scheduled_time
    
    def optimize_session(self, available_cards: List[str],
                        metrics_dict: Dict[str, FlashcardMetrics]) -> List[str]:
        """Optimize card selection for a study session"""
        # Prioritize cards
        prioritized = []
        
        for card_id in available_cards:
            metrics = metrics_dict.get(card_id)
            if not metrics:
                continue
            
            priority_score = self._calculate_priority(metrics)
            prioritized.append((card_id, priority_score))
        
        # Sort by priority
        prioritized.sort(key=lambda x: x[1], reverse=True)
        
        # Select optimal number of cards
        optimal_count = self.user_patterns["cards_per_session"]
        selected = [card_id for card_id, _ in prioritized[:optimal_count]]
        
        # Interleave different types/difficulties for better learning
        return self._interleave_cards(selected, metrics_dict)
    
    def _calculate_priority(self, metrics: FlashcardMetrics) -> float:
        """Calculate priority score for a card"""
        priority = 0.0
        
        # Overdue cards get highest priority
        if metrics.next_review_date and metrics.next_review_date < datetime.now():
            days_overdue = (datetime.now() - metrics.next_review_date).days
            priority += min(100, days_overdue * 10)
        
        # Low retention cards get high priority
        if metrics.retention_rate < 0.6:
            priority += (1.0 - metrics.retention_rate) * 50
        
        # Cards with lapses need attention
        priority += metrics.lapses * 10
        
        # New cards get moderate priority
        if metrics.learning_phase == LearningPhase.NEW:
            priority += 30
        
        # Low confidence cards
        if metrics.confidence_score < 0.5:
            priority += (1.0 - metrics.confidence_score) * 20
        
        return priority
    
    def _interleave_cards(self, cards: List[str], 
                         metrics_dict: Dict[str, FlashcardMetrics]) -> List[str]:
        """Interleave cards for optimal learning"""
        if len(cards) <= 3:
            return cards
        
        # Group by difficulty
        easy = []
        medium = []
        hard = []
        
        for card_id in cards:
            metrics = metrics_dict.get(card_id)
            if not metrics:
                medium.append(card_id)
                continue
            
            if metrics.difficulty_rating == CardDifficulty.EASY:
                easy.append(card_id)
            elif metrics.difficulty_rating in [CardDifficulty.HARD, CardDifficulty.VERY_HARD]:
                hard.append(card_id)
            else:
                medium.append(card_id)
        
        # Interleave: hard, medium, easy pattern
        interleaved = []
        max_len = max(len(easy), len(medium), len(hard))
        
        for i in range(max_len):
            if i < len(hard):
                interleaved.append(hard[i])
            if i < len(medium):
                interleaved.append(medium[i])
            if i < len(easy):
                interleaved.append(easy[i])
        
        return interleaved


class PerformancePredictor:
    """Predicts future performance and mastery timeline"""
    
    def __init__(self):
        self.prediction_model = {}
        
    def predict_mastery_time(self, metrics: FlashcardMetrics) -> int:
        """Predict days until mastery"""
        if metrics.learning_phase == LearningPhase.MASTERED:
            return 0
        
        # Calculate based on current progress
        current_retention = metrics.retention_rate
        target_retention = 0.9
        
        if current_retention >= target_retention:
            return 0
        
        # Estimate improvement rate
        if metrics.total_reviews < 3:
            return 30  # Default estimate
        
        improvement_per_review = current_retention / metrics.total_reviews
        reviews_needed = (target_retention - current_retention) / max(improvement_per_review, 0.01)
        
        # Estimate days (assuming 1 review every 3 days on average)
        days_estimate = int(reviews_needed * 3)
        
        return min(days_estimate, 90)  # Cap at 90 days
    
    def predict_retention(self, metrics: FlashcardMetrics, 
                         days_ahead: int) -> float:
        """Predict retention rate after specified days"""
        # Exponential forgetting curve
        current_retention = metrics.retention_rate
        decay_rate = 0.05  # 5% decay per day without review
        
        predicted = current_retention * math.exp(-decay_rate * days_ahead)
        return max(0.0, min(1.0, predicted))
    
    def estimate_session_outcome(self, cards: List[str],
                                metrics_dict: Dict[str, FlashcardMetrics]) -> Dict:
        """Estimate outcomes of a study session"""
        total_cards = len(cards)
        estimated_correct = 0
        estimated_time = 0
        
        for card_id in cards:
            metrics = metrics_dict.get(card_id)
            if not metrics:
                estimated_correct += 0.5
                estimated_time += 5
                continue
            
            # Estimate probability of correct answer
            prob_correct = metrics.retention_rate * metrics.confidence_score
            estimated_correct += prob_correct
            
            # Estimate time based on average
            estimated_time += metrics.average_response_time if metrics.average_response_time > 0 else 5
        
        return {
            "total_cards": total_cards,
            "estimated_correct": int(estimated_correct),
            "estimated_accuracy": estimated_correct / total_cards if total_cards > 0 else 0,
            "estimated_time_minutes": int(estimated_time / 60),
            "difficulty_distribution": self._analyze_difficulty_distribution(cards, metrics_dict)
        }
    
    def _analyze_difficulty_distribution(self, cards: List[str],
                                        metrics_dict: Dict[str, FlashcardMetrics]) -> Dict:
        """Analyze difficulty distribution of cards"""
        distribution = {
            "easy": 0,
            "medium": 0,
            "hard": 0,
            "very_hard": 0
        }
        
        for card_id in cards:
            metrics = metrics_dict.get(card_id)
            if not metrics:
                distribution["medium"] += 1
                continue
            
            diff = metrics.difficulty_rating
            if diff == CardDifficulty.EASY:
                distribution["easy"] += 1
            elif diff == CardDifficulty.MEDIUM:
                distribution["medium"] += 1
            elif diff == CardDifficulty.HARD:
                distribution["hard"] += 1
            else:
                distribution["very_hard"] += 1
        
        return distribution


class FlashcardRecommendationEngine:
    """Generates intelligent recommendations for flashcard learning"""
    
    def __init__(self):
        self.recommendation_rules = self._load_recommendation_rules()
        
    def _load_recommendation_rules(self) -> Dict:
        """Load recommendation rules"""
        return {
            "struggling_cards": {
                "condition": lambda m: m.retention_rate < 0.5 and m.total_reviews >= 5,
                "action": "intensive_review",
                "message": "These cards need immediate attention"
            },
            "ready_to_advance": {
                "condition": lambda m: m.retention_rate >= 0.9 and m.streak_correct >= 3,
                "action": "increase_interval",
                "message": "You've mastered these - extending review interval"
            },
            "inconsistent_performance": {
                "condition": lambda m: m.lapses >= 2 and m.retention_rate > 0.6,
                "action": "stabilize",
                "message": "Focus on consistent recall"
            }
        }
    
    def generate_recommendations(self, metrics_dict: Dict[str, FlashcardMetrics],
                                weaknesses: List[CardWeakness]) -> List[Dict]:
        """Generate personalized recommendations"""
        recommendations = []
        
        # Analyze overall performance
        total_cards = len(metrics_dict)
        if total_cards == 0:
            return recommendations
        
        avg_retention = sum(m.retention_rate for m in metrics_dict.values()) / total_cards
        
        # General recommendations
        if avg_retention < 0.6:
            recommendations.append({
                "type": "study_strategy",
                "priority": 5,
                "title": "Increase Study Frequency",
                "description": "Your overall retention is below target. Consider studying more frequently.",
                "actions": [
                    "Study for 15-20 minutes daily",
                    "Focus on weak cards first",
                    "Use active recall techniques"
                ]
            })
        
        # Card-specific recommendations
        struggling_cards = [
            card_id for card_id, m in metrics_dict.items()
            if m.retention_rate < 0.5 and m.total_reviews >= 3
        ]
        
        if struggling_cards:
            recommendations.append({
                "type": "card_specific",
                "priority": 4,
                "title": f"Review {len(struggling_cards)} Struggling Cards",
                "description": "These cards consistently cause difficulty",
                "actions": [
                    "Break down complex cards",
                    "Add visual aids",
                    "Create related cards for context",
                    f"Focus on: {', '.join(struggling_cards[:3])}"
                ]
            })
        
        # Weakness-based recommendations
        if weaknesses:
            top_weakness = weaknesses[0]
            recommendations.append({
                "type": "weakness",
                "priority": 4,
                "title": f"Address {top_weakness.weakness_type.replace('_', ' ').title()}",
                "description": top_weakness.description,
                "actions": top_weakness.suggested_actions
            })
        
        # Optimization recommendations
        mastered_count = sum(1 for m in metrics_dict.values() 
                           if m.learning_phase == LearningPhase.MASTERED)
        
        if mastered_count > total_cards * 0.7:
            recommendations.append({
                "type": "optimization",
                "priority": 2,
                "title": "Add New Cards",
                "description": f"You've mastered {mastered_count}/{total_cards} cards. Time to expand!",
                "actions": [
                    "Add 10-15 new cards",
                    "Explore related topics",
                    "Challenge yourself with advanced content"
                ]
            })
        
        return sorted(recommendations, key=lambda x: x["priority"], reverse=True)
    
    def suggest_study_techniques(self, metrics: FlashcardMetrics) -> List[str]:
        """Suggest study techniques based on performance"""
        techniques = []
        
        if metrics.average_response_time > 10:
            techniques.append("Use the 'memory palace' technique for faster recall")
        
        if metrics.retention_rate < 0.6:
            techniques.append("Try elaborative rehearsal - explain the concept in your own words")
        
        if metrics.lapses >= 2:
            techniques.append("Use spaced repetition more consistently")
        
        if metrics.confidence_score < 0.5:
            techniques.append("Practice active recall without looking at the answer first")
        
        return techniques


class FlashcardAgent:
    """Main Flashcard Agent orchestrating all components"""
    
    def __init__(self, student_id: str):
        self.student_id = student_id
        
        # Initialize components
        self.sm2_algorithm = SuperMemoAlgorithm()
        self.leitner_system = LeitnerSystem()
        self.weakness_analyzer = WeaknessAnalyzer()
        self.adaptive_scheduler = AdaptiveScheduler()
        self.performance_predictor = PerformancePredictor()
        self.recommendation_engine = FlashcardRecommendationEngine()
        
        # Data storage
        self.card_metrics = {}  # card_id -> FlashcardMetrics
        self.card_content = {}  # card_id -> card data
        self.card_tags = {}  # card_id -> tags
        self.study_sessions = []
        self.current_session = None
        
        # Load student data
        self._load_student_data()
        
    def _load_student_data(self):
        """Load student's flashcard data"""
        # Placeholder - integrate with actual database
        logger.info(f"Loading data for student {self.student_id}")
        
    def add_card(self, card_id: str, content: Dict, tags: List[str] = None):
        """Add a new flashcard"""
        self.card_content[card_id] = content
        self.card_tags[card_id] = tags or []
        
        # Initialize metrics
        self.card_metrics[card_id] = FlashcardMetrics(
            card_id=card_id,
            learning_phase=LearningPhase.NEW
        )
        
        # Add to Leitner system
        self.leitner_system.add_card(card_id, box=0)
        
        logger.info(f"Added card {card_id}")
    
    def start_study_session(self, session_type: str = "review") -> Dict:
        """Start a new study session"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        self.current_session = StudySession(
            session_id=session_id,
            start_time=datetime.now()
        )
        
        # Get cards for this session
        due_cards = self._get_due_cards()
        optimized_cards = self.adaptive_scheduler.optimize_session(
            due_cards,
            self.card_metrics
        )
        
        # Predict session outcome
        prediction = self.performance_predictor.estimate_session_outcome(
            optimized_cards,
            self.card_metrics
        )
        
        return {
            "session_id": session_id,
            "cards": optimized_cards,
            "card_count": len(optimized_cards),
            "prediction": prediction,
            "estimated_duration": prediction["estimated_time_minutes"]
        }
    
    def review_card(self, card_id: str, quality: ReviewQuality, 
                   response_time: float, user_answer: str = None) -> Dict:
        """Process a card review"""
        if card_id not in self.card_metrics:
            logger.error(f"Card {card_id} not found")
            return {"error": "Card not found"}
        
        metrics = self.card_metrics[card_id]
        
        # Update metrics
        metrics.update_after_review(quality, response_time)
        
        # Calculate next review using SM-2
        interval, ease, next_review = self.sm2_algorithm.calculate_next_interval(
            metrics, quality
        )
        
        # Update metrics with new values
        metrics.interval_days = interval
        metrics.ease_factor = ease
        metrics.next_review_date = next_review
        metrics.repetitions += 1 if quality.value >= 3 else 0
        
        # Update Leitner system
        self.leitner_system.move_card(card_id, quality.value >= 3)
        
        # Update current session
        if self.current_session:
            self.current_session.cards_reviewed.append(card_id)
            if quality.value >= 3:
                self.current_session.cards_correct += 1
            else:
                self.current_session.cards_incorrect += 1
        
        # Analyze for weaknesses
        weaknesses = self.weakness_analyzer.analyze_card_performance(
            metrics,
            self.card_content.get(card_id, {})
        )
        
        # Get recommendations
        techniques = self.recommendation_engine.suggest_study_techniques(metrics)
        
        return {
            "card_id": card_id,
            "quality": quality.name,
            "next_review": next_review.isoformat(),
            "interval_days": interval,
            "learning_phase": metrics.learning_phase.value,
            "retention_rate": metrics.retention_rate,
            "confidence_score": metrics.confidence_score,
            "streak": metrics.streak_correct,
            "weaknesses": [asdict(w) for w in weaknesses],
            "suggested_techniques": techniques,
            "mastery_progress": self._calculate_mastery_progress(metrics)
        }
    
    def end_study_session(self) -> Dict:
        """End the current study session"""
        if not self.current_session:
            return {"error": "No active session"}
        
        self.current_session.end_time = datetime.now()
        duration = (self.current_session.end_time - self.current_session.start_time).seconds
        self.current_session.total_time_seconds = duration
        
        # Calculate session metrics
        total_reviewed = len(self.current_session.cards_reviewed)
        if total_reviewed > 0:
            accuracy = self.current_session.cards_correct / total_reviewed
            self.current_session.average_quality = accuracy
            
            # Calculate focus score (based on time per card)
            avg_time_per_card = duration / total_reviewed
            expected_time = 10  # seconds
            self.current_session.focus_score = min(1.0, expected_time / max(avg_time_per_card, 1))
            
            # Calculate efficiency score
            self.current_session.efficiency_score = (
                accuracy * 0.6 + self.current_session.focus_score * 0.4
            )
        
        # Count cards mastered/learned in this session
        for card_id in self.current_session.cards_reviewed:
            metrics = self.card_metrics.get(card_id)
            if metrics:
                if metrics.learning_phase == LearningPhase.MASTERED:
                    self.current_session.cards_mastered += 1
                elif metrics.learning_phase in [LearningPhase.LEARNING, LearningPhase.REVIEW]:
                    self.current_session.cards_learned += 1
        
        # Store session
        self.study_sessions.append(self.current_session)
        
        # Generate session summary
        summary = {
            "session_id": self.current_session.session_id,
            "duration_minutes": duration // 60,
            "cards_reviewed": total_reviewed,
            "accuracy": self.current_session.average_quality,
            "cards_correct": self.current_session.cards_correct,
            "cards_incorrect": self.current_session.cards_incorrect,
            "focus_score": self.current_session.focus_score,
            "efficiency_score": self.current_session.efficiency_score,
            "cards_mastered": self.current_session.cards_mastered,
            "cards_learned": self.current_session.cards_learned,
            "insights": self._generate_session_insights()
        }
        
        self.current_session = None
        return summary
    
    def _get_due_cards(self) -> List[str]:
        """Get cards that are due for review"""
        due_cards = []
        now = datetime.now()
        
        for card_id, metrics in self.card_metrics.items():
            # New cards are always available
            if metrics.learning_phase == LearningPhase.NEW:
                due_cards.append(card_id)
                continue
            
            # Check if review is due
            if metrics.next_review_date and metrics.next_review_date <= now:
                due_cards.append(card_id)
        
        return due_cards
    
    def _calculate_mastery_progress(self, metrics: FlashcardMetrics) -> Dict:
        """Calculate mastery progress for a card"""
        # Estimate time to mastery
        days_to_mastery = self.performance_predictor.predict_mastery_time(metrics)
        
        # Calculate progress percentage
        if metrics.learning_phase == LearningPhase.MASTERED:
            progress = 100
        else:
            # Based on retention rate and repetitions
            progress = min(95, (metrics.retention_rate * 50 + 
                              min(metrics.repetitions / 10, 0.5) * 50))
        
        return {
            "progress_percentage": progress,
            "days_to_mastery": days_to_mastery,
            "current_phase": metrics.learning_phase.value,
            "next_milestone": self._get_next_milestone(metrics)
        }
    
    def _get_next_milestone(self, metrics: FlashcardMetrics) -> str:
        """Get next learning milestone"""
        if metrics.learning_phase == LearningPhase.NEW:
            return "Complete first review"
        elif metrics.learning_phase == LearningPhase.LEARNING:
            return "Achieve 80% retention"
        elif metrics.learning_phase == LearningPhase.REVIEW:
            return "Maintain 90% retention for 3 reviews"
        elif metrics.learning_phase == LearningPhase.RELEARNING:
            return "Rebuild retention to 70%"
        else:
            return "Maintain mastery"
    
    def _generate_session_insights(self) -> List[Dict]:
        """Generate insights from the study session"""
        insights = []
        
        if not self.current_session:
            return insights
        
        accuracy = self.current_session.average_quality
        
        # Performance insight
        if accuracy >= 0.8:
            insights.append({
                "type": "positive",
                "title": "Excellent Performance!",
                "message": f"You got {accuracy:.0%} correct. Keep up the great work!"
            })
        elif accuracy < 0.5:
            insights.append({
                "type": "improvement",
                "title": "Room for Improvement",
                "message": "Consider reviewing these cards more frequently or breaking them down into simpler concepts."
            })
        
        # Focus insight
        if self.current_session.focus_score < 0.6:
            insights.append({
                "type": "focus",
                "title": "Improve Focus",
                "message": "You're taking longer than usual. Try shorter, more focused sessions."
            })
        
        # Progress insight
        if self.current_session.cards_mastered > 0:
            insights.append({
                "type": "achievement",
                "title": "Cards Mastered!",
                "message": f"You mastered {self.current_session.cards_mastered} cards this session!"
            })
        
        return insights
    
    def get_comprehensive_report(self) -> Dict:
        """Generate comprehensive learning report"""
        total_cards = len(self.card_metrics)
        if total_cards == 0:
            return {"error": "No cards to analyze"}
        
        # Calculate overall statistics
        total_reviews = sum(m.total_reviews for m in self.card_metrics.values())
        avg_retention = sum(m.retention_rate for m in self.card_metrics.values()) / total_cards
        
        # Phase distribution
        phase_distribution = defaultdict(int)
        for metrics in self.card_metrics.values():
            phase_distribution[metrics.learning_phase.value] += 1
        
        # Identify weaknesses
        all_weaknesses = []
        for card_id, metrics in self.card_metrics.items():
            weaknesses = self.weakness_analyzer.analyze_card_performance(
                metrics,
                self.card_content.get(card_id, {})
            )
            all_weaknesses.extend(weaknesses)
        
        # Concept gaps
        concept_gaps = self.weakness_analyzer.identify_concept_gaps(
            self.card_metrics,
            self.card_tags
        )
        
        # Generate recommendations
        recommendations = self.recommendation_engine.generate_recommendations(
            self.card_metrics,
            all_weaknesses
        )
        
        # Calculate study streak
        study_streak = self._calculate_study_streak()
        
        # Predict future performance
        cards_to_master = sum(1 for m in self.card_metrics.values() 
                            if m.learning_phase != LearningPhase.MASTERED)
        avg_days_to_mastery = sum(
            self.performance_predictor.predict_mastery_time(m)
            for m in self.card_metrics.values()
            if m.learning_phase != LearningPhase.MASTERED
        ) / max(cards_to_master, 1)
        
        return {
            "overview": {
                "total_cards": total_cards,
                "total_reviews": total_reviews,
                "average_retention": avg_retention,
                "study_streak_days": study_streak,
                "cards_mastered": phase_distribution.get("mastered", 0),
                "cards_in_progress": (
                    phase_distribution.get("learning", 0) + 
                    phase_distribution.get("review", 0)
                ),
                "cards_struggling": phase_distribution.get("relearning", 0),
                "new_cards": phase_distribution.get("new", 0)
            },
            "performance": {
                "retention_by_phase": {
                    phase: sum(m.retention_rate for m in self.card_metrics.values() 
                             if m.learning_phase.value == phase) / max(count, 1)
                    for phase, count in phase_distribution.items()
                },
                "average_response_time": sum(m.average_response_time 
                                            for m in self.card_metrics.values()) / total_cards,
                "total_time_spent_hours": sum(m.time_spent_seconds 
                                             for m in self.card_metrics.values()) / 3600
            },
            "weaknesses": {
                "critical_cards": [asdict(w) for w in all_weaknesses if w.severity > 0.7],
                "concept_gaps": concept_gaps,
                "total_weaknesses": len(all_weaknesses)
            },
            "predictions": {
                "estimated_days_to_master_all": int(avg_days_to_mastery),
                "cards_due_today": len(self._get_due_cards()),
                "cards_due_this_week": self._count_due_cards(7)
            },
            "recommendations": recommendations,
            "study_patterns": self._analyze_study_patterns(),
            "achievements": self._calculate_achievements()
        }
    
    def _calculate_study_streak(self) -> int:
        """Calculate current study streak in days"""
        if not self.study_sessions:
            return 0
        
        # Sort sessions by date
        sorted_sessions = sorted(self.study_sessions, 
                               key=lambda s: s.start_time, 
                               reverse=True)
        
        streak = 0
        current_date = datetime.now().date()
        
        for session in sorted_sessions:
            session_date = session.start_time.date()
            
            if session_date == current_date or session_date == current_date - timedelta(days=1):
                streak += 1
                current_date = session_date - timedelta(days=1)
            else:
                break
        
        return streak
    
    def _count_due_cards(self, days: int) -> int:
        """Count cards due within specified days"""
        target_date = datetime.now() + timedelta(days=days)
        count = 0
        
        for metrics in self.card_metrics.values():
            if metrics.next_review_date and metrics.next_review_date <= target_date:
                count += 1
        
        return count
    
    def _analyze_study_patterns(self) -> Dict:
        """Analyze study patterns"""
        if not self.study_sessions:
            return {}
        
        # Time of day analysis
        hour_distribution = defaultdict(int)
        for session in self.study_sessions:
            hour = session.start_time.hour
            hour_distribution[hour] += 1
        
        best_hour = max(hour_distribution.items(), key=lambda x: x[1])[0] if hour_distribution else None
        
        # Session length analysis
        avg_session_length = sum(s.total_time_seconds for s in self.study_sessions) / len(self.study_sessions)
        
        # Consistency analysis
        session_dates = [s.start_time.date() for s in self.study_sessions]
        unique_dates = len(set(session_dates))
        
        return {
            "preferred_study_time": f"{best_hour}:00" if best_hour else "Not enough data",
            "average_session_minutes": int(avg_session_length / 60),
            "study_days": unique_dates,
            "sessions_per_day": len(self.study_sessions) / max(unique_dates, 1),
            "consistency_score": min(1.0, unique_dates / 30)  # Based on last 30 days
        }
    
    def _calculate_achievements(self) -> List[Dict]:
        """Calculate achievements and milestones"""
        achievements = []
        
        # Mastery achievements
        mastered_count = sum(1 for m in self.card_metrics.values() 
                           if m.learning_phase == LearningPhase.MASTERED)
        
        if mastered_count >= 10:
            achievements.append({
                "title": "Flashcard Master",
                "description": f"Mastered {mastered_count} cards!",
                "icon": "🏆"
            })
        
        # Streak achievements
        streak = self._calculate_study_streak()
        if streak >= 7:
            achievements.append({
                "title": "Week Warrior",
                "description": f"{streak} day study streak!",
                "icon": "🔥"
            })
        
        # Review achievements
        total_reviews = sum(m.total_reviews for m in self.card_metrics.values())
        if total_reviews >= 100:
            achievements.append({
                "title": "Review Champion",
                "description": f"Completed {total_reviews} reviews!",
                "icon": "⭐"
            })
        
        # Accuracy achievements
        if self.card_metrics:
            avg_retention = sum(m.retention_rate for m in self.card_metrics.values()) / len(self.card_metrics)
            if avg_retention >= 0.9:
                achievements.append({
                    "title": "Accuracy Expert",
                    "description": f"{avg_retention:.0%} average retention!",
                    "icon": "🎯"
                })
        
        return achievements
    
    def get_next_study_recommendation(self) -> Dict:
        """Get recommendation for next study session"""
        due_cards = self._get_due_cards()
        
        if not due_cards:
            return {
                "message": "No cards due right now. Great job staying on top of your reviews!",
                "next_due_time": self._get_next_due_time(),
                "suggestion": "Consider adding new cards or reviewing weak areas."
            }
        
        # Analyze due cards
        urgent_cards = []
        for card_id in due_cards:
            metrics = self.card_metrics.get(card_id)
            if metrics and metrics.next_review_date:
                days_overdue = (datetime.now() - metrics.next_review_date).days
                if days_overdue > 2:
                    urgent_cards.append(card_id)
        
        # Generate recommendation
        recommendation = {
            "cards_due": len(due_cards),
            "urgent_cards": len(urgent_cards),
            "estimated_time": len(due_cards) * 0.5,  # 30 seconds per card
            "priority": "high" if urgent_cards else "normal",
            "message": self._generate_study_message(len(due_cards), len(urgent_cards))
        }
        
        return recommendation
    
    def _get_next_due_time(self) -> Optional[str]:
        """Get time when next card is due"""
        next_due = None
        
        for metrics in self.card_metrics.values():
            if metrics.next_review_date:
                if next_due is None or metrics.next_review_date < next_due:
                    next_due = metrics.next_review_date
        
        return next_due.isoformat() if next_due else None
    
    def _generate_study_message(self, due_count: int, urgent_count: int) -> str:
        """Generate personalized study message"""
        if urgent_count > 0:
            return f"You have {urgent_count} overdue cards that need immediate attention!"
        elif due_count > 20:
            return f"You have {due_count} cards to review. Consider breaking this into multiple sessions."
        elif due_count > 0:
            return f"Perfect time to review {due_count} cards. Let's keep your knowledge fresh!"
        else:
            return "All caught up! Great work maintaining your study schedule."


# Example usage and testing
if __name__ == "__main__":
    # Initialize agent
    agent = FlashcardAgent(student_id="student_123")
    
    # Add some sample cards
    print("=== Adding Sample Cards ===\n")
    sample_cards = [
        {"id": "card_1", "front": "What is Python?", "back": "A high-level programming language", "tags": ["programming", "python"]},
        {"id": "card_2", "front": "What is a variable?", "back": "A container for storing data", "tags": ["programming", "basics"]},
        {"id": "card_3", "front": "What is a function?", "back": "A reusable block of code", "tags": ["programming", "functions"]},
    ]
    
    for card in sample_cards:
        agent.add_card(card["id"], {"front": card["front"], "back": card["back"]}, card["tags"])
    
    # Start study session
    print("\n=== Starting Study Session ===\n")
    session = agent.start_study_session()
    print(f"Session ID: {session['session_id']}")
    print(f"Cards to review: {session['card_count']}")
    print(f"Estimated duration: {session['estimated_duration']} minutes\n")
    
    # Simulate reviews
    print("=== Simulating Card Reviews ===\n")
    for card_id in session['cards'][:3]:
        quality = random.choice([ReviewQuality.PERFECT, ReviewQuality.CORRECT_WITH_HESITATION, ReviewQuality.CORRECT_WITH_DIFFICULTY])
        response_time = random.uniform(3, 10)
        
        result = agent.review_card(card_id, quality, response_time)
        print(f"Card: {card_id}")
        print(f"Quality: {result['quality']}")
        print(f"Next review: {result['next_review']}")
        print(f"Retention: {result['retention_rate']:.2%}")
        print(f"Confidence: {result['confidence_score']:.2%}\n")
    
    # End session
    print("=== Ending Study Session ===\n")
    summary = agent.end_study_session()
    print(json.dumps(summary, indent=2, default=str))
    
    # Get comprehensive report
    print("\n=== Comprehensive Report ===\n")
    report = agent.get_comprehensive_report()
    print(json.dumps(report, indent=2, default=str))
    
    # Get next study recommendation
    print("\n=== Next Study Recommendation ===\n")
    next_rec = agent.get_next_study_recommendation()
    print(json.dumps(next_rec, indent=2, default=str))
