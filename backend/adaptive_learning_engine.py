"""
Advanced Adaptive Learning & Personalization Engine for SearchHub
Implements intelligent difficulty adjustment, learning style detection, and personalized curriculum
Enhanced with real-time adaptation, cognitive load monitoring, and personalized question sequencing
"""

import numpy as np
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import models
import logging
from collections import deque

logger = logging.getLogger(__name__)


class RealTimeSessionAdapter:
    """Real-time adaptation during active learning sessions"""
    
    def __init__(self):
        self.session_data = {}  # user_id -> session state
        self.adaptation_threshold = 3  # Questions before adapting
        
    def start_session(self, user_id: int, initial_difficulty: str = 'intermediate'):
        """Initialize a new learning session"""
        self.session_data[user_id] = {
            'start_time': datetime.now(timezone.utc),
            'current_difficulty': initial_difficulty,
            'question_history': deque(maxlen=10),
            'response_times': deque(maxlen=10),
            'accuracy_streak': 0,
            'struggle_count': 0,
            'cognitive_load': 0.5,
            'engagement_score': 1.0,
            'last_adaptation': datetime.now(timezone.utc),
            'total_questions': 0,
            'correct_answers': 0
        }
        logger.info(f"Started adaptive session for user {user_id} at {initial_difficulty} level")
        
    def record_question_response(self, user_id: int, question_data: Dict[str, Any]):
        """Record real-time question response and adapt immediately"""
        if user_id not in self.session_data:
            self.start_session(user_id)
            
        session = self.session_data[user_id]
        
        # Record response
        is_correct = question_data.get('is_correct', False)
        response_time = question_data.get('response_time', 30)
        difficulty = question_data.get('difficulty', session['current_difficulty'])
        
        session['question_history'].append({
            'correct': is_correct,
            'time': response_time,
            'difficulty': difficulty,
            'timestamp': datetime.now(timezone.utc)
        })
        session['response_times'].append(response_time)
        session['total_questions'] += 1
        
        if is_correct:
            session['correct_answers'] += 1
            session['accuracy_streak'] += 1
            session['struggle_count'] = 0
        else:
            session['accuracy_streak'] = 0
            session['struggle_count'] += 1
            
        # Update cognitive load
        session['cognitive_load'] = self._calculate_cognitive_load(session)
        
        # Real-time adaptation decision
        adaptation = self._should_adapt_now(session)
        if adaptation['should_adapt']:
            session['current_difficulty'] = adaptation['new_difficulty']
            session['last_adaptation'] = datetime.now(timezone.utc)
            logger.info(f"Real-time adaptation for user {user_id}: {adaptation['reason']}")
            
        return {
            'current_difficulty': session['current_difficulty'],
            'cognitive_load': session['cognitive_load'],
            'adaptation_made': adaptation['should_adapt'],
            'recommendation': adaptation.get('reason', 'Continue at current level')
        }
    
    def _calculate_cognitive_load(self, session: Dict) -> float:
        """Calculate current cognitive load (0-1 scale)"""
        if len(session['question_history']) < 2:
            return 0.5
            
        recent = list(session['question_history'])[-5:]
        
        # Factors affecting cognitive load
        avg_response_time = np.mean([q['time'] for q in recent])
        accuracy_rate = np.mean([q['correct'] for q in recent])
        time_variance = np.std([q['time'] for q in recent]) if len(recent) > 1 else 0
        
        # High response time + low accuracy = high cognitive load
        time_factor = min(avg_response_time / 60.0, 1.0)  # Normalize to 60 seconds
        accuracy_factor = 1.0 - accuracy_rate
        variance_factor = min(time_variance / 30.0, 1.0)  # High variance = struggling
        
        cognitive_load = (time_factor * 0.4 + accuracy_factor * 0.4 + variance_factor * 0.2)
        
        return np.clip(cognitive_load, 0.0, 1.0)
    
    def _should_adapt_now(self, session: Dict) -> Dict[str, Any]:
        """Determine if difficulty should be adapted in real-time"""
        if len(session['question_history']) < self.adaptation_threshold:
            return {'should_adapt': False}
            
        difficulty_levels = ['beginner', 'intermediate', 'advanced', 'expert']
        current_idx = difficulty_levels.index(session['current_difficulty'])
        
        # Check for rapid success (increase difficulty)
        if session['accuracy_streak'] >= 4 and session['cognitive_load'] < 0.4:
            if current_idx < len(difficulty_levels) - 1:
                return {
                    'should_adapt': True,
                    'new_difficulty': difficulty_levels[current_idx + 1],
                    'reason': 'High accuracy streak with low cognitive load - increasing challenge'
                }
        
        # Check for struggle (decrease difficulty)
        if session['struggle_count'] >= 3 or session['cognitive_load'] > 0.75:
            if current_idx > 0:
                return {
                    'should_adapt': True,
                    'new_difficulty': difficulty_levels[current_idx - 1],
                    'reason': 'High cognitive load detected - reducing difficulty'
                }
        
        # Check for optimal challenge zone (maintain)
        recent_accuracy = np.mean([q['correct'] for q in list(session['question_history'])[-5:]])
        if 0.6 <= recent_accuracy <= 0.8 and 0.4 <= session['cognitive_load'] <= 0.6:
            return {
                'should_adapt': False,
                'reason': 'Optimal challenge zone - maintaining current difficulty'
            }
            
        return {'should_adapt': False}
    
    def get_session_metrics(self, user_id: int) -> Dict[str, Any]:
        """Get current session metrics"""
        if user_id not in self.session_data:
            return {}
            
        session = self.session_data[user_id]
        duration = (datetime.now(timezone.utc) - session['start_time']).total_seconds() / 60
        
        return {
            'duration_minutes': duration,
            'total_questions': session['total_questions'],
            'accuracy_rate': session['correct_answers'] / max(session['total_questions'], 1),
            'current_difficulty': session['current_difficulty'],
            'cognitive_load': session['cognitive_load'],
            'accuracy_streak': session['accuracy_streak'],
            'avg_response_time': np.mean(list(session['response_times'])) if session['response_times'] else 0,
            'engagement_score': session['engagement_score']
        }
    
    def end_session(self, user_id: int) -> Dict[str, Any]:
        """End session and return summary"""
        metrics = self.get_session_metrics(user_id)
        if user_id in self.session_data:
            del self.session_data[user_id]
        return metrics


class CognitiveLoadMonitor:
    """Monitor and manage cognitive load during learning"""
    
    def __init__(self):
        self.load_thresholds = {
            'low': 0.3,
            'optimal': 0.6,
            'high': 0.8,
            'overload': 0.9
        }
        
    def assess_cognitive_load(self, session_data: Dict) -> Dict[str, Any]:
        """Comprehensive cognitive load assessment"""
        indicators = {
            'response_time': self._analyze_response_times(session_data),
            'accuracy_pattern': self._analyze_accuracy_pattern(session_data),
            'hesitation': self._detect_hesitation(session_data),
            'error_rate': self._calculate_error_rate(session_data),
            'time_on_task': self._analyze_time_on_task(session_data)
        }
        
        # Weighted cognitive load score
        load_score = (
            indicators['response_time'] * 0.25 +
            indicators['accuracy_pattern'] * 0.25 +
            indicators['hesitation'] * 0.20 +
            indicators['error_rate'] * 0.20 +
            indicators['time_on_task'] * 0.10
        )
        
        load_level = self._categorize_load(load_score)
        
        return {
            'load_score': load_score,
            'load_level': load_level,
            'indicators': indicators,
            'recommendations': self._get_load_recommendations(load_level, indicators),
            'intervention_needed': load_score > self.load_thresholds['high']
        }
    
    def _analyze_response_times(self, session_data: Dict) -> float:
        """Analyze response time patterns"""
        if 'response_times' not in session_data or not session_data['response_times']:
            return 0.5
            
        times = list(session_data['response_times'])
        avg_time = np.mean(times)
        
        # Longer times indicate higher cognitive load
        return min(avg_time / 60.0, 1.0)
    
    def _analyze_accuracy_pattern(self, session_data: Dict) -> float:
        """Analyze accuracy patterns for cognitive load"""
        if 'question_history' not in session_data or not session_data['question_history']:
            return 0.5
            
        recent = list(session_data['question_history'])[-5:]
        accuracy = np.mean([q['correct'] for q in recent])
        
        # Lower accuracy = higher cognitive load
        return 1.0 - accuracy
    
    def _detect_hesitation(self, session_data: Dict) -> float:
        """Detect hesitation patterns (variance in response times)"""
        if 'response_times' not in session_data or len(session_data['response_times']) < 3:
            return 0.5
            
        times = list(session_data['response_times'])
        variance = np.std(times)
        
        # High variance indicates uncertainty/hesitation
        return min(variance / 30.0, 1.0)
    
    def _calculate_error_rate(self, session_data: Dict) -> float:
        """Calculate recent error rate"""
        if 'question_history' not in session_data or not session_data['question_history']:
            return 0.5
            
        recent = list(session_data['question_history'])[-5:]
        error_rate = 1.0 - np.mean([q['correct'] for q in recent])
        
        return error_rate
    
    def _analyze_time_on_task(self, session_data: Dict) -> float:
        """Analyze total time on task for fatigue"""
        if 'start_time' not in session_data:
            return 0.5
            
        duration_minutes = (datetime.now(timezone.utc) - session_data['start_time']).total_seconds() / 60
        
        # Cognitive load increases with session length
        if duration_minutes < 20:
            return 0.3
        elif duration_minutes < 45:
            return 0.5
        elif duration_minutes < 90:
            return 0.7
        else:
            return 0.9
    
    def _categorize_load(self, load_score: float) -> str:
        """Categorize cognitive load level"""
        if load_score < self.load_thresholds['low']:
            return 'under-challenged'
        elif load_score < self.load_thresholds['optimal']:
            return 'optimal'
        elif load_score < self.load_thresholds['high']:
            return 'high'
        elif load_score < self.load_thresholds['overload']:
            return 'very_high'
        else:
            return 'overload'
    
    def _get_load_recommendations(self, load_level: str, indicators: Dict) -> List[str]:
        """Get recommendations based on cognitive load"""
        recommendations = []
        
        if load_level == 'under-challenged':
            recommendations.append("Increase difficulty to maintain engagement")
            recommendations.append("Introduce more complex problems")
            
        elif load_level == 'optimal':
            recommendations.append("Maintain current difficulty level")
            recommendations.append("Continue with current pace")
            
        elif load_level == 'high':
            recommendations.append("Consider taking a short break")
            recommendations.append("Review recent concepts before continuing")
            
        elif load_level in ['very_high', 'overload']:
            recommendations.append("Take a 10-15 minute break immediately")
            recommendations.append("Reduce difficulty level")
            recommendations.append("Review fundamentals")
            recommendations.append("Consider ending session if fatigue persists")
            
        # Specific recommendations based on indicators
        if indicators.get('hesitation', 0) > 0.7:
            recommendations.append("High uncertainty detected - provide more examples")
            
        if indicators.get('error_rate', 0) > 0.6:
            recommendations.append("High error rate - review previous material")
            
        return recommendations


class PersonalizedQuestionSequencer:
    """Intelligent question sequencing based on user state"""
    
    def __init__(self):
        self.sequencing_strategies = {
            'scaffolding': self._scaffolding_sequence,
            'spaced_repetition': self._spaced_repetition_sequence,
            'interleaving': self._interleaving_sequence,
            'adaptive_challenge': self._adaptive_challenge_sequence
        }
        
    def generate_question_sequence(
        self, 
        db: Session, 
        user_id: int, 
        topic: str,
        session_state: Dict,
        num_questions: int = 10
    ) -> List[Dict[str, Any]]:
        """Generate personalized question sequence"""
        
        # Determine optimal strategy based on user state
        strategy = self._select_strategy(session_state)
        
        # Get available questions
        available_questions = self._get_available_questions(db, user_id, topic)
        
        # Apply sequencing strategy
        sequence = self.sequencing_strategies[strategy](
            available_questions,
            session_state,
            num_questions
        )
        
        return {
            'questions': sequence,
            'strategy': strategy,
            'rationale': self._get_strategy_rationale(strategy, session_state)
        }
    
    def _select_strategy(self, session_state: Dict) -> str:
        """Select optimal sequencing strategy"""
        cognitive_load = session_state.get('cognitive_load', 0.5)
        accuracy_rate = session_state.get('correct_answers', 0) / max(session_state.get('total_questions', 1), 1)
        
        # High cognitive load -> scaffolding
        if cognitive_load > 0.7:
            return 'scaffolding'
        
        # Low accuracy -> spaced repetition
        if accuracy_rate < 0.6:
            return 'spaced_repetition'
        
        # High performance -> adaptive challenge
        if accuracy_rate > 0.8 and cognitive_load < 0.5:
            return 'adaptive_challenge'
        
        # Default -> interleaving
        return 'interleaving'
    
    def _scaffolding_sequence(
        self, 
        questions: List[Dict], 
        session_state: Dict, 
        num: int
    ) -> List[Dict]:
        """Build from simple to complex gradually"""
        # Sort by difficulty
        sorted_questions = sorted(questions, key=lambda q: q.get('difficulty_score', 0.5))
        
        # Start with easier questions, gradually increase
        sequence = []
        step_size = len(sorted_questions) // num if sorted_questions else 1
        
        for i in range(num):
            idx = min(i * step_size, len(sorted_questions) - 1)
            if idx < len(sorted_questions):
                sequence.append(sorted_questions[idx])
                
        return sequence
    
    def _spaced_repetition_sequence(
        self, 
        questions: List[Dict], 
        session_state: Dict, 
        num: int
    ) -> List[Dict]:
        """Prioritize questions needing review"""
        # Sort by last_seen and mastery level
        sorted_questions = sorted(
            questions,
            key=lambda q: (
                q.get('mastery_level', 0.5),
                -(q.get('days_since_seen', 999))
            )
        )
        
        return sorted_questions[:num]
    
    def _interleaving_sequence(
        self, 
        questions: List[Dict], 
        session_state: Dict, 
        num: int
    ) -> List[Dict]:
        """Mix different topics and difficulty levels"""
        if not questions:
            return []
            
        # Group by subtopic
        by_subtopic = {}
        for q in questions:
            subtopic = q.get('subtopic', 'general')
            if subtopic not in by_subtopic:
                by_subtopic[subtopic] = []
            by_subtopic[subtopic].append(q)
        
        # Interleave questions from different subtopics
        sequence = []
        subtopics = list(by_subtopic.keys())
        idx = 0
        
        while len(sequence) < num and any(by_subtopic.values()):
            subtopic = subtopics[idx % len(subtopics)]
            if by_subtopic[subtopic]:
                sequence.append(by_subtopic[subtopic].pop(0))
            idx += 1
            
        return sequence
    
    def _adaptive_challenge_sequence(
        self, 
        questions: List[Dict], 
        session_state: Dict, 
        num: int
    ) -> List[Dict]:
        """Progressively challenging sequence"""
        # Sort by difficulty, prioritize harder questions
        sorted_questions = sorted(
            questions,
            key=lambda q: q.get('difficulty_score', 0.5),
            reverse=True
        )
        
        # Mix in some medium difficulty to avoid overload
        hard = [q for q in sorted_questions if q.get('difficulty_score', 0.5) > 0.7]
        medium = [q for q in sorted_questions if 0.4 <= q.get('difficulty_score', 0.5) <= 0.7]
        
        # 70% hard, 30% medium
        sequence = []
        hard_count = int(num * 0.7)
        medium_count = num - hard_count
        
        sequence.extend(hard[:hard_count])
        sequence.extend(medium[:medium_count])
        
        return sequence[:num]
    
    def _get_available_questions(self, db: Session, user_id: int, topic: str) -> List[Dict]:
        """Get available questions for the topic"""
        # This would query your question bank
        # Placeholder implementation
        return []
    
    def _get_strategy_rationale(self, strategy: str, session_state: Dict) -> str:
        """Explain why this strategy was chosen"""
        rationales = {
            'scaffolding': "Building confidence with gradual difficulty increase due to high cognitive load",
            'spaced_repetition': "Reinforcing weak areas with strategic review",
            'interleaving': "Mixing topics to enhance retention and transfer",
            'adaptive_challenge': "Maximizing growth with challenging problems based on strong performance"
        }
        return rationales.get(strategy, "Optimizing learning based on current performance")


class DifficultyAdapter:
    """Auto-adjusts content difficulty based on user performance"""
    
    def __init__(self):
        self.difficulty_levels = ['beginner', 'intermediate', 'advanced', 'expert']
        self.performance_window = 10  # Last N questions to consider
        
    def calculate_current_level(self, db: Session, user_id: int) -> str:
        """Calculate user's current difficulty level based on recent performance"""
        recent_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(self.performance_window).all()
        
        if not recent_activities:
            return 'intermediate'
        
        # Analyze performance metrics
        avg_satisfaction = np.mean([a.user_satisfaction or 3 for a in recent_activities])
        avg_time = np.mean([a.time_to_understand or 30 for a in recent_activities])
        follow_ups = sum([a.follow_up_questions for a in recent_activities])
        
        # Calculate difficulty score (0-1)
        satisfaction_score = avg_satisfaction / 5.0
        time_score = 1.0 - min(avg_time / 120.0, 1.0)  # Normalize to 2 min max
        follow_up_score = 1.0 - min(follow_ups / 20.0, 1.0)
        
        overall_score = (satisfaction_score * 0.5 + time_score * 0.3 + follow_up_score * 0.2)
        
        # Map to difficulty level
        if overall_score >= 0.8:
            return 'expert'
        elif overall_score >= 0.6:
            return 'advanced'
        elif overall_score >= 0.4:
            return 'intermediate'
        else:
            return 'beginner'

    def adjust_difficulty(self, db: Session, user_id: int, current_difficulty: str) -> str:
        """Dynamically adjust difficulty based on real-time performance"""
        recent_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id
        ).order_by(models.DailyLearningMetrics.date.desc()).limit(7).all()
        
        if not recent_metrics:
            return current_difficulty
        
        # Calculate accuracy trend
        accuracies = [m.accuracy_rate for m in recent_metrics if m.questions_answered > 0]
        if not accuracies:
            return current_difficulty
        
        avg_accuracy = np.mean(accuracies)
        
        # Adjust based on accuracy
        current_idx = self.difficulty_levels.index(current_difficulty)
        
        if avg_accuracy >= 0.85 and current_idx < len(self.difficulty_levels) - 1:
            return self.difficulty_levels[current_idx + 1]
        elif avg_accuracy < 0.60 and current_idx > 0:
            return self.difficulty_levels[current_idx - 1]
        
        return current_difficulty
    
    def get_optimal_question_difficulty(self, db: Session, user_id: int, topic: str) -> str:
        """Get optimal difficulty for a specific topic"""
        topic_mastery = db.query(models.TopicMastery).filter(
            and_(
                models.TopicMastery.user_id == user_id,
                models.TopicMastery.topic_name == topic
            )
        ).first()
        
        if not topic_mastery:
            return 'intermediate'
        
        mastery_level = topic_mastery.mastery_level
        
        if mastery_level >= 0.8:
            return 'expert'
        elif mastery_level >= 0.6:
            return 'advanced'
        elif mastery_level >= 0.4:
            return 'intermediate'
        else:
            return 'beginner'


class LearningStyleDetector:
    """AI detects and adapts to learning preferences"""
    
    def __init__(self):
        self.style_indicators = {
            'visual': ['diagram', 'chart', 'image', 'show me', 'picture', 'graph', 'visualize'],
            'auditory': ['explain', 'tell me', 'describe', 'say', 'hear', 'listen'],
            'kinesthetic': ['practice', 'try', 'do', 'hands-on', 'example', 'exercise'],
            'reading': ['read', 'text', 'article', 'document', 'write', 'notes']
        }
    
    def detect_style(self, db: Session, user_id: int) -> Dict[str, float]:
        """Detect learning style from user interactions"""
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(50).all()
        
        style_scores = {'visual': 0, 'auditory': 0, 'kinesthetic': 0, 'reading': 0}
        
        for activity in activities:
            question_lower = activity.question.lower()
            
            for style, indicators in self.style_indicators.items():
                for indicator in indicators:
                    if indicator in question_lower:
                        style_scores[style] += 1
        
        # Normalize scores
        total = sum(style_scores.values()) or 1
        return {style: score / total for style, score in style_scores.items()}
    
    def get_dominant_style(self, style_scores: Dict[str, float]) -> str:
        """Get the dominant learning style"""
        return max(style_scores.items(), key=lambda x: x[1])[0]
    
    def adapt_content_format(self, learning_style: str, content: str) -> Dict[str, Any]:
        """Adapt content format based on learning style"""
        adaptations = {
            'visual': {
                'suggestion': 'Include diagrams, charts, and visual representations',
                'format_hints': ['Use bullet points', 'Add visual examples', 'Include flowcharts']
            },
            'auditory': {
                'suggestion': 'Use clear explanations and verbal descriptions',
                'format_hints': ['Use conversational tone', 'Add audio-friendly explanations', 'Include step-by-step narration']
            },
            'kinesthetic': {
                'suggestion': 'Provide hands-on examples and practice exercises',
                'format_hints': ['Include practical examples', 'Add exercises', 'Suggest real-world applications']
            },
            'reading': {
                'suggestion': 'Provide detailed text-based explanations',
                'format_hints': ['Use comprehensive text', 'Add references', 'Include detailed notes']
            }
        }
        
        return adaptations.get(learning_style, adaptations['reading'])



class PersonalizedCurriculumBuilder:
    """Creates personalized learning paths based on goals and performance"""
    
    def __init__(self):
        self.prerequisite_map = {
            'calculus': ['algebra', 'trigonometry'],
            'machine_learning': ['linear_algebra', 'calculus', 'statistics'],
            'data_structures': ['programming_basics', 'algorithms'],
            'quantum_physics': ['classical_mechanics', 'linear_algebra'],
            'organic_chemistry': ['general_chemistry', 'chemical_bonding']
        }
    
    def build_curriculum(self, db: Session, user_id: int, goal_topic: str) -> List[Dict[str, Any]]:
        """Build a personalized curriculum for a goal topic"""
        user_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        # Get user's current mastery levels
        mastery_records = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id
        ).all()
        
        mastery_map = {m.topic_name: m.mastery_level for m in mastery_records}
        
        # Build curriculum path
        curriculum = []
        prerequisites = self.prerequisite_map.get(goal_topic.lower(), [])
        
        # Add prerequisites that need work
        for prereq in prerequisites:
            mastery = mastery_map.get(prereq, 0.0)
            if mastery < 0.7:
                curriculum.append({
                    'topic': prereq,
                    'type': 'prerequisite',
                    'current_mastery': mastery,
                    'target_mastery': 0.7,
                    'estimated_hours': self._estimate_hours(mastery, 0.7),
                    'priority': 'high' if mastery < 0.4 else 'medium'
                })
        
        # Add main topic
        main_mastery = mastery_map.get(goal_topic.lower(), 0.0)
        curriculum.append({
            'topic': goal_topic,
            'type': 'main_goal',
            'current_mastery': main_mastery,
            'target_mastery': 0.9,
            'estimated_hours': self._estimate_hours(main_mastery, 0.9),
            'priority': 'high'
        })
        
        # Add related advanced topics
        related_topics = self._find_related_topics(goal_topic)
        for related in related_topics:
            curriculum.append({
                'topic': related,
                'type': 'advanced',
                'current_mastery': mastery_map.get(related, 0.0),
                'target_mastery': 0.8,
                'estimated_hours': 10,
                'priority': 'low'
            })
        
        return curriculum
    
    def _estimate_hours(self, current: float, target: float) -> int:
        """Estimate hours needed to reach target mastery"""
        gap = target - current
        return int(gap * 20)  # Rough estimate: 20 hours per 1.0 mastery point
    
    def _find_related_topics(self, topic: str) -> List[str]:
        """Find related advanced topics"""
        related_map = {
            'calculus': ['differential_equations', 'multivariable_calculus'],
            'machine_learning': ['deep_learning', 'reinforcement_learning'],
            'data_structures': ['advanced_algorithms', 'system_design'],
            'quantum_physics': ['quantum_field_theory', 'particle_physics']
        }
        return related_map.get(topic.lower(), [])
    
    def suggest_next_topic(self, db: Session, user_id: int) -> Optional[str]:
        """Suggest the next topic to study based on curriculum"""
        curriculum = self.build_curriculum(db, user_id, 'general')
        
        # Find topic with highest priority and lowest mastery
        high_priority = [c for c in curriculum if c['priority'] == 'high']
        if high_priority:
            return min(high_priority, key=lambda x: x['current_mastery'])['topic']
        
        return None


class RetentionOptimizer:
    """Optimizes spaced repetition for better retention"""
    
    def __init__(self):
        self.intervals = [1, 3, 7, 14, 30, 60, 120]  # Days
    
    def calculate_next_review(self, mastery_level: float, last_reviewed: datetime) -> datetime:
        """Calculate optimal next review time using spaced repetition"""
        # Higher mastery = longer intervals
        interval_index = min(int(mastery_level * len(self.intervals)), len(self.intervals) - 1)
        days_to_add = self.intervals[interval_index]
        
        return last_reviewed + timedelta(days=days_to_add)
    
    def get_due_reviews(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Get topics due for review"""
        now = datetime.now(timezone.utc)
        
        mastery_records = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id
        ).all()
        
        due_reviews = []
        for record in mastery_records:
            if not record.last_studied:
                continue
            
            next_review = self.calculate_next_review(record.mastery_level, record.last_studied)
            
            if next_review <= now:
                days_overdue = (now - next_review).days
                due_reviews.append({
                    'topic': record.topic_name,
                    'mastery_level': record.mastery_level,
                    'last_studied': record.last_studied,
                    'days_overdue': days_overdue,
                    'priority': 'urgent' if days_overdue > 7 else 'normal'
                })
        
        # Sort by priority and days overdue
        due_reviews.sort(key=lambda x: (x['priority'] == 'urgent', x['days_overdue']), reverse=True)
        
        return due_reviews
    
    def predict_forgetting_curve(self, mastery_level: float, days_since_review: int) -> float:
        """Predict retention based on forgetting curve"""
        # Ebbinghaus forgetting curve: R = e^(-t/S)
        # R = retention, t = time, S = strength (mastery)
        strength = mastery_level * 30  # Scale mastery to days
        retention = np.exp(-days_since_review / max(strength, 1))
        
        return retention



class KnowledgeGapAnalyzer:
    """Deep analysis of knowledge blind spots"""
    
    def __init__(self):
        self.confidence_threshold = 0.6
    
    def find_knowledge_gaps(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Identify knowledge blind spots and gaps"""
        mastery_records = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id
        ).all()
        
        gaps = []
        
        for record in mastery_records:
            # Low mastery = knowledge gap
            if record.mastery_level < self.confidence_threshold:
                struggles = json.loads(record.struggles_with or "[]")
                
                gaps.append({
                    'topic': record.topic_name,
                    'mastery_level': record.mastery_level,
                    'confidence_level': record.confidence_level,
                    'gap_severity': 'critical' if record.mastery_level < 0.3 else 'moderate',
                    'specific_struggles': struggles,
                    'times_studied': record.times_studied,
                    'last_studied': record.last_studied
                })
        
        # Sort by severity
        gaps.sort(key=lambda x: x['mastery_level'])
        
        return gaps
    
    def analyze_misconceptions(self, db: Session, user_id: int, topic: str) -> List[str]:
        """Identify common misconceptions for a topic"""
        # Get user's incorrect answers or low-rated responses
        activities = db.query(models.Activity).filter(
            and_(
                models.Activity.user_id == user_id,
                models.Activity.topic == topic,
                models.Activity.user_satisfaction < 3
            )
        ).all()
        
        misconceptions = []
        for activity in activities:
            # Extract potential misconceptions from questions
            if any(word in activity.question.lower() for word in ['why', 'how', 'explain']):
                misconceptions.append(activity.question)
        
        return misconceptions[:5]
    
    def suggest_remediation(self, gap: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest remediation strategy for a knowledge gap"""
        severity = gap['gap_severity']
        
        if severity == 'critical':
            return {
                'strategy': 'intensive_review',
                'recommended_actions': [
                    'Start with fundamentals',
                    'Use multiple learning resources',
                    'Practice with simple examples',
                    'Seek additional help or tutoring'
                ],
                'estimated_time': '10-15 hours',
                'priority': 'high'
            }
        else:
            return {
                'strategy': 'targeted_practice',
                'recommended_actions': [
                    'Review key concepts',
                    'Practice specific problem areas',
                    'Connect to related topics'
                ],
                'estimated_time': '3-5 hours',
                'priority': 'medium'
            }


class ContentTransformer:
    """Transforms content into different formats and complexity levels"""
    
    def __init__(self):
        self.complexity_levels = {
            'beginner': {'vocab_level': 'simple', 'sentence_length': 'short', 'examples': 'many'},
            'intermediate': {'vocab_level': 'moderate', 'sentence_length': 'medium', 'examples': 'some'},
            'advanced': {'vocab_level': 'technical', 'sentence_length': 'long', 'examples': 'few'},
            'expert': {'vocab_level': 'specialized', 'sentence_length': 'complex', 'examples': 'minimal'}
        }
    
    def simplify_content(self, content: str, target_level: str = 'beginner') -> str:
        """Simplify content for beginners"""
        instructions = f"""
Simplify this content for a {target_level} level learner:
- Use simple, everyday language
- Break down complex concepts
- Add more examples
- Use shorter sentences
- Explain technical terms

Content: {content}
"""
        return instructions
    
    def add_real_world_examples(self, topic: str, content: str) -> str:
        """Generate real-world examples for a topic"""
        instructions = f"""
Add 3 real-world examples to illustrate this concept:

Topic: {topic}
Content: {content}

Examples should be:
- Practical and relatable
- From everyday life
- Easy to understand
- Directly connected to the concept
"""
        return instructions
    
    def create_analogies(self, concept: str) -> str:
        """Create analogies to explain complex concepts"""
        instructions = f"""
Create 2-3 helpful analogies to explain this concept:

Concept: {concept}

Analogies should:
- Use familiar everyday situations
- Highlight key similarities
- Make the abstract concrete
- Be memorable and engaging
"""
        return instructions
    
    def make_interactive(self, content: str) -> Dict[str, Any]:
        """Convert static content to interactive format"""
        return {
            'quiz_questions': f"Generate 5 quiz questions from: {content}",
            'practice_exercises': f"Create 3 practice exercises for: {content}",
            'discussion_prompts': f"Generate 3 discussion questions about: {content}",
            'hands_on_activities': f"Suggest 2 hands-on activities to reinforce: {content}"
        }


class PredictiveAIEngine:
    """Predictive and proactive AI features"""
    
    def __init__(self):
        self.forgetting_threshold = 0.5
    
    def predict_next_forgotten_topic(self, db: Session, user_id: int) -> Optional[Dict[str, Any]]:
        """Predict what the user will forget next"""
        optimizer = RetentionOptimizer()
        
        mastery_records = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id,
            models.TopicMastery.last_studied.isnot(None)
        ).all()
        
        predictions = []
        now = datetime.now(timezone.utc)
        
        for record in mastery_records:
            days_since = (now - record.last_studied).days
            predicted_retention = optimizer.predict_forgetting_curve(record.mastery_level, days_since)
            
            if predicted_retention < self.forgetting_threshold:
                predictions.append({
                    'topic': record.topic_name,
                    'current_retention': predicted_retention,
                    'days_since_review': days_since,
                    'urgency': 'high' if predicted_retention < 0.3 else 'medium'
                })
        
        if predictions:
            return min(predictions, key=lambda x: x['current_retention'])
        
        return None
    
    def detect_burnout_risk(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Monitor and detect burnout risk"""
        recent_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id
        ).order_by(models.DailyLearningMetrics.date.desc()).limit(14).all()
        
        if len(recent_metrics) < 7:
            return {'risk_level': 'unknown', 'confidence': 0.0}
        
        # Analyze patterns
        daily_hours = [m.time_spent_minutes / 60 for m in recent_metrics]
        engagement_scores = [m.engagement_score for m in recent_metrics]
        accuracy_rates = [m.accuracy_rate for m in recent_metrics if m.questions_answered > 0]
        
        # Burnout indicators
        avg_hours = np.mean(daily_hours)
        hours_trend = np.polyfit(range(len(daily_hours)), daily_hours, 1)[0]
        engagement_trend = np.polyfit(range(len(engagement_scores)), engagement_scores, 1)[0]
        accuracy_trend = np.polyfit(range(len(accuracy_rates)), accuracy_rates, 1)[0] if accuracy_rates else 0
        
        # Calculate risk score
        risk_score = 0.0
        
        if avg_hours > 4:  # More than 4 hours/day
            risk_score += 0.3
        if hours_trend > 0.5:  # Increasing hours rapidly
            risk_score += 0.2
        if engagement_trend < -0.05:  # Declining engagement
            risk_score += 0.3
        if accuracy_trend < -0.05:  # Declining accuracy
            risk_score += 0.2
        
        risk_level = 'high' if risk_score > 0.6 else 'medium' if risk_score > 0.3 else 'low'
        
        return {
            'risk_level': risk_level,
            'risk_score': risk_score,
            'indicators': {
                'avg_daily_hours': avg_hours,
                'engagement_trend': 'declining' if engagement_trend < 0 else 'stable',
                'accuracy_trend': 'declining' if accuracy_trend < 0 else 'stable'
            },
            'recommendations': self._get_burnout_recommendations(risk_level)
        }
    
    def _get_burnout_recommendations(self, risk_level: str) -> List[str]:
        """Get recommendations based on burnout risk"""
        if risk_level == 'high':
            return [
                'Take a 2-3 day break from studying',
                'Reduce daily study time to 1-2 hours',
                'Focus on topics you enjoy',
                'Try different learning methods',
                'Consider talking to a mentor or counselor'
            ]
        elif risk_level == 'medium':
            return [
                'Take regular breaks every 45 minutes',
                'Limit study sessions to 2-3 hours',
                'Mix challenging and easy topics',
                'Ensure adequate sleep and exercise'
            ]
        else:
            return [
                'Maintain current study pace',
                'Continue with regular breaks',
                'Keep variety in learning activities'
            ]
    
    def suggest_optimal_break_times(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Suggest optimal break times based on patterns"""
        learning_patterns = db.query(models.LearningPattern).filter(
            models.LearningPattern.user_id == user_id
        ).first()
        
        if not learning_patterns:
            # Default recommendations
            return [
                {'after_minutes': 25, 'break_duration': 5, 'type': 'short'},
                {'after_minutes': 50, 'break_duration': 10, 'type': 'medium'},
                {'after_minutes': 90, 'break_duration': 15, 'type': 'long'}
            ]
        
        avg_session = learning_patterns.average_session_length
        
        # Adaptive break schedule
        breaks = []
        if avg_session > 60:
            breaks.append({'after_minutes': 25, 'break_duration': 5, 'type': 'short'})
            breaks.append({'after_minutes': 50, 'break_duration': 10, 'type': 'medium'})
        else:
            breaks.append({'after_minutes': 30, 'break_duration': 5, 'type': 'short'})
        
        return breaks
    
    def predict_focus_level(self, db: Session, user_id: int, time_of_day: int) -> Dict[str, Any]:
        """Predict focus level at different times of day"""
        learning_patterns = db.query(models.LearningPattern).filter(
            models.LearningPattern.user_id == user_id
        ).first()
        
        if not learning_patterns or not learning_patterns.most_active_hour:
            return {
                'predicted_focus': 0.7,
                'confidence': 0.3,
                'recommendation': 'Not enough data to predict'
            }
        
        peak_hour = learning_patterns.most_active_hour
        hour_diff = abs(time_of_day - peak_hour)
        
        # Focus decreases with distance from peak hour
        focus_score = max(0.3, 1.0 - (hour_diff / 12.0))
        
        recommendation = 'optimal' if hour_diff < 2 else 'good' if hour_diff < 4 else 'suboptimal'
        
        return {
            'predicted_focus': focus_score,
            'confidence': 0.7,
            'peak_hour': peak_hour,
            'recommendation': recommendation
        }



class AITutorModes:
    """Different AI tutor interaction modes"""
    
    def __init__(self):
        self.modes = {
            'step_by_step': 'Break down concepts into sequential steps',
            'socratic': 'Guide through questions rather than direct answers',
            'hints_only': 'Provide hints without revealing full solutions',
            'multiple_perspectives': 'Explain from different angles',
            'challenge': 'Test understanding with probing questions',
            'error_analysis': 'Focus on common mistakes and how to avoid them'
        }
    
    def get_mode_prompt(self, mode: str, topic: str, user_level: str) -> str:
        """Generate prompt for specific tutor mode"""
        base_prompts = {
            'step_by_step': f"""
Teach {topic} step-by-step for a {user_level} learner:
1. Start with the basics
2. Build complexity gradually
3. Check understanding at each step
4. Use clear transitions between steps
5. Provide examples at each stage
""",
            'socratic': f"""
Guide the learner to understand {topic} through Socratic questioning:
- Ask thought-provoking questions
- Don't give direct answers
- Help them discover the answer themselves
- Build on their responses
- Encourage critical thinking
Level: {user_level}
""",
            'hints_only': f"""
Provide hints to help understand {topic} without giving away the answer:
- Give subtle clues
- Point in the right direction
- Encourage independent thinking
- Offer progressively stronger hints if needed
Level: {user_level}
""",
            'multiple_perspectives': f"""
Explain {topic} from multiple perspectives:
1. Theoretical perspective
2. Practical/applied perspective
3. Visual/intuitive perspective
4. Historical/contextual perspective
Adapt to {user_level} level
""",
            'challenge': f"""
Challenge the learner's understanding of {topic}:
- Ask probing questions
- Present edge cases
- Test assumptions
- Encourage deeper thinking
- Provide constructive feedback
Level: {user_level}
""",
            'error_analysis': f"""
Teach {topic} by focusing on common mistakes:
- Identify typical errors
- Explain why they happen
- Show correct approach
- Provide prevention strategies
Level: {user_level}
"""
        }
        
        return base_prompts.get(mode, base_prompts['step_by_step'])


class CollaborativeLearningMatcher:
    """Match users for collaborative learning"""
    
    def __init__(self):
        self.similarity_threshold = 0.6
    
    def find_study_twin(self, db: Session, user_id: int) -> Optional[Dict[str, Any]]:
        """Find users with similar learning patterns"""
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return None
        
        user_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        if not user_profile:
            return None
        
        # Get user's learning patterns
        user_patterns = db.query(models.LearningPattern).filter(
            models.LearningPattern.user_id == user_id
        ).first()
        
        # Find similar users
        all_users = db.query(models.User).filter(models.User.id != user_id).all()
        
        matches = []
        for other_user in all_users:
            other_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == other_user.id
            ).first()
            
            if not other_profile:
                continue
            
            similarity = self._calculate_similarity(user, user_profile, other_user, other_profile)
            
            if similarity >= self.similarity_threshold:
                matches.append({
                    'user_id': other_user.id,
                    'name': f"{other_user.first_name} {other_user.last_name}",
                    'similarity_score': similarity,
                    'common_interests': self._find_common_interests(user_profile, other_profile)
                })
        
        if matches:
            return max(matches, key=lambda x: x['similarity_score'])
        
        return None
    
    def _calculate_similarity(self, user1, profile1, user2, profile2) -> float:
        """Calculate similarity between two user profiles"""
        score = 0.0
        
        # Same field of study (from User model or ComprehensiveUserProfile)
        field1 = user1.field_of_study or profile1.major or profile1.main_subject
        field2 = user2.field_of_study or profile2.major or profile2.main_subject
        if field1 and field2 and field1.lower() == field2.lower():
            score += 0.3
        
        # Similar difficulty level
        if profile1.difficulty_level == profile2.difficulty_level:
            score += 0.2
        
        # Similar learning pace
        if profile1.learning_pace == profile2.learning_pace:
            score += 0.2
        
        # Similar study schedule (use best_study_times)
        try:
            times1 = json.loads(profile1.best_study_times or "[]")
            times2 = json.loads(profile2.best_study_times or "[]")
            if times1 and times2:
                common_times = set(times1) & set(times2)
                if common_times:
                    score += 0.15
        except:
            pass
        
        # Similar learning style (use preferred_subjects)
        try:
            user1_subjects = json.loads(profile1.preferred_subjects or "[]")
            user2_subjects = json.loads(profile2.preferred_subjects or "[]")
            
            common_subjects = set(user1_subjects) & set(user2_subjects)
            if common_subjects:
                score += 0.15
        except:
            pass
        
        return min(score, 1.0)
    
    def _find_common_interests(self, profile1, profile2) -> List[str]:
        """Find common interests between users"""
        try:
            subjects1 = set(json.loads(profile1.preferred_subjects or "[]"))
            subjects2 = set(json.loads(profile2.preferred_subjects or "[]"))
            return list(subjects1 & subjects2)
        except:
            return []
    
    def find_complementary_learners(self, db: Session, user_id: int) -> List[Dict[str, Any]]:
        """Find users with complementary strengths/weaknesses"""
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            return []
        
        user_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        if not user_profile:
            return []
        
        try:
            user_weak = set(json.loads(user_profile.weak_areas or "[]"))
            user_strong = set(json.loads(user_profile.strong_areas or "[]"))
        except:
            return []
        
        all_users = db.query(models.User).filter(models.User.id != user_id).all()
        
        complementary = []
        for other_user in all_users:
            other_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == other_user.id
            ).first()
            
            if not other_profile:
                continue
            
            try:
                other_weak = set(json.loads(other_profile.weak_areas or "[]"))
                other_strong = set(json.loads(other_profile.strong_areas or "[]"))
                
                # User's weak areas are other's strong areas
                can_help_user = user_weak & other_strong
                # User's strong areas are other's weak areas
                can_help_other = user_strong & other_weak
                
                if can_help_user or can_help_other:
                    complementary.append({
                        'user_id': other_user.id,
                        'name': f"{other_user.first_name} {other_user.last_name}",
                        'can_help_you_with': list(can_help_user),
                        'you_can_help_with': list(can_help_other),
                        'synergy_score': len(can_help_user) + len(can_help_other)
                    })
            except:
                continue
        
        complementary.sort(key=lambda x: x['synergy_score'], reverse=True)
        return complementary[:5]


# Main adaptive learning engine class
class AdaptiveLearningEngine:
    """Main engine coordinating all adaptive learning features"""
    
    def __init__(self):
        self.difficulty_adapter = DifficultyAdapter()
        self.style_detector = LearningStyleDetector()
        self.curriculum_builder = PersonalizedCurriculumBuilder()
        self.retention_optimizer = RetentionOptimizer()
        self.gap_analyzer = KnowledgeGapAnalyzer()
        self.content_transformer = ContentTransformer()
        self.predictive_engine = PredictiveAIEngine()
        self.tutor_modes = AITutorModes()
        self.collab_matcher = CollaborativeLearningMatcher()
        
        # NEW: Real-time adaptation components
        self.session_adapter = RealTimeSessionAdapter()
        self.cognitive_monitor = CognitiveLoadMonitor()
        self.question_sequencer = PersonalizedQuestionSequencer()
    
    def get_personalized_recommendations(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get comprehensive personalized recommendations"""
        return {
            'difficulty_level': self.difficulty_adapter.calculate_current_level(db, user_id),
            'learning_style': self.style_detector.detect_style(db, user_id),
            'knowledge_gaps': self.gap_analyzer.find_knowledge_gaps(db, user_id),
            'due_reviews': self.retention_optimizer.get_due_reviews(db, user_id),
            'next_forgotten': self.predictive_engine.predict_next_forgotten_topic(db, user_id),
            'burnout_risk': self.predictive_engine.detect_burnout_risk(db, user_id),
            'study_twin': self.collab_matcher.find_study_twin(db, user_id)
        }
    
    def adapt_content_for_user(self, db: Session, user_id: int, content: str, topic: str) -> Dict[str, Any]:
        """Adapt content based on user's profile and preferences"""
        difficulty = self.difficulty_adapter.calculate_current_level(db, user_id)
        learning_style = self.style_detector.detect_style(db, user_id)
        dominant_style = self.style_detector.get_dominant_style(learning_style)
        
        return {
            'adapted_difficulty': difficulty,
            'learning_style_adaptations': self.style_detector.adapt_content_format(dominant_style, content),
            'simplified_version': self.content_transformer.simplify_content(content, difficulty),
            'real_world_examples': self.content_transformer.add_real_world_examples(topic, content),
            'analogies': self.content_transformer.create_analogies(topic),
            'interactive_elements': self.content_transformer.make_interactive(content)
        }
    
    # NEW: Real-time session management methods
    def start_adaptive_session(self, db: Session, user_id: int, topic: str) -> Dict[str, Any]:
        """Start a new adaptive learning session with real-time monitoring"""
        # Get user's baseline difficulty
        initial_difficulty = self.difficulty_adapter.calculate_current_level(db, user_id)
        
        # Initialize session
        self.session_adapter.start_session(user_id, initial_difficulty)
        
        # Get initial question sequence
        session_state = self.session_adapter.session_data[user_id]
        question_sequence = self.question_sequencer.generate_question_sequence(
            db, user_id, topic, session_state, num_questions=10
        )
        
        return {
            'session_id': f"{user_id}_{datetime.now(timezone.utc).timestamp()}",
            'initial_difficulty': initial_difficulty,
            'question_sequence': question_sequence,
            'cognitive_load': session_state['cognitive_load'],
            'message': 'Adaptive session started with personalized question sequence'
        }
    
    def process_question_response(
        self, 
        db: Session, 
        user_id: int, 
        question_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process question response with real-time adaptation"""
        # Record response and get adaptation
        adaptation_result = self.session_adapter.record_question_response(user_id, question_data)
        
        # Get current session state
        session_state = self.session_adapter.session_data.get(user_id, {})
        
        # Assess cognitive load
        cognitive_assessment = self.cognitive_monitor.assess_cognitive_load(session_state)
        
        # Update session with cognitive load assessment
        if user_id in self.session_adapter.session_data:
            self.session_adapter.session_data[user_id]['cognitive_load'] = cognitive_assessment['load_score']
        
        # Determine next question
        next_question = None
        if not cognitive_assessment['intervention_needed']:
            # Generate next question based on current state
            sequence = self.question_sequencer.generate_question_sequence(
                db, user_id, question_data.get('topic', ''), session_state, num_questions=1
            )
            next_question = sequence['questions'][0] if sequence['questions'] else None
        
        return {
            'adaptation': adaptation_result,
            'cognitive_assessment': cognitive_assessment,
            'next_question': next_question,
            'session_metrics': self.session_adapter.get_session_metrics(user_id),
            'should_continue': not cognitive_assessment['intervention_needed']
        }
    
    def get_real_time_recommendations(self, user_id: int) -> Dict[str, Any]:
        """Get real-time recommendations during active session"""
        if user_id not in self.session_adapter.session_data:
            return {'error': 'No active session'}
        
        session_state = self.session_adapter.session_data[user_id]
        cognitive_assessment = self.cognitive_monitor.assess_cognitive_load(session_state)
        
        recommendations = {
            'cognitive_load': cognitive_assessment['load_level'],
            'recommendations': cognitive_assessment['recommendations'],
            'current_difficulty': session_state['current_difficulty'],
            'performance_trend': self._analyze_performance_trend(session_state),
            'suggested_actions': []
        }
        
        # Add specific action suggestions
        if cognitive_assessment['load_score'] > 0.8:
            recommendations['suggested_actions'].append({
                'action': 'take_break',
                'duration_minutes': 10,
                'reason': 'High cognitive load detected'
            })
        
        if session_state['accuracy_streak'] >= 5:
            recommendations['suggested_actions'].append({
                'action': 'increase_difficulty',
                'reason': 'Strong performance - ready for more challenge'
            })
        
        if session_state['struggle_count'] >= 3:
            recommendations['suggested_actions'].append({
                'action': 'review_concepts',
                'reason': 'Multiple incorrect answers - review recommended'
            })
        
        return recommendations
    
    def _analyze_performance_trend(self, session_state: Dict) -> str:
        """Analyze performance trend in current session"""
        if len(session_state['question_history']) < 3:
            return 'insufficient_data'
        
        recent = list(session_state['question_history'])[-5:]
        accuracy_trend = [q['correct'] for q in recent]
        
        # Calculate trend
        if len(accuracy_trend) >= 3:
            first_half = np.mean(accuracy_trend[:len(accuracy_trend)//2])
            second_half = np.mean(accuracy_trend[len(accuracy_trend)//2:])
            
            if second_half > first_half + 0.2:
                return 'improving'
            elif second_half < first_half - 0.2:
                return 'declining'
        
        return 'stable'
    
    def end_adaptive_session(self, db: Session, user_id: int) -> Dict[str, Any]:
        """End adaptive session and save results"""
        session_summary = self.session_adapter.end_session(user_id)
        
        # Update user's learning metrics in database
        if session_summary:
            self._save_session_to_db(db, user_id, session_summary)
        
        return {
            'session_summary': session_summary,
            'achievements': self._calculate_session_achievements(session_summary),
            'next_session_recommendations': self._get_next_session_recommendations(db, user_id, session_summary)
        }
    
    def _save_session_to_db(self, db: Session, user_id: int, session_summary: Dict):
        """Save session data to database"""
        try:
            # Update daily metrics
            today = datetime.now(timezone.utc).date()
            metrics = db.query(models.DailyLearningMetrics).filter(
                and_(
                    models.DailyLearningMetrics.user_id == user_id,
                    models.DailyLearningMetrics.date == today
                )
            ).first()
            
            if not metrics:
                metrics = models.DailyLearningMetrics(
                    user_id=user_id,
                    date=today,
                    time_spent_minutes=0,
                    questions_answered=0,
                    accuracy_rate=0.0,
                    engagement_score=0.0
                )
                db.add(metrics)
            
            # Update metrics
            metrics.time_spent_minutes += session_summary.get('duration_minutes', 0)
            metrics.questions_answered += session_summary.get('total_questions', 0)
            
            # Recalculate accuracy rate
            total_correct = metrics.accuracy_rate * (metrics.questions_answered - session_summary.get('total_questions', 0))
            total_correct += session_summary.get('total_questions', 0) * session_summary.get('accuracy_rate', 0)
            metrics.accuracy_rate = total_correct / max(metrics.questions_answered, 1)
            
            metrics.engagement_score = session_summary.get('engagement_score', 0.5)
            
            db.commit()
            logger.info(f"Saved session data for user {user_id}")
        except Exception as e:
            logger.error(f"Error saving session data: {e}")
            db.rollback()
    
    def _calculate_session_achievements(self, session_summary: Dict) -> List[Dict[str, Any]]:
        """Calculate achievements earned during session"""
        achievements = []
        
        if session_summary.get('accuracy_rate', 0) >= 0.9:
            achievements.append({
                'type': 'high_accuracy',
                'title': 'Accuracy Master',
                'description': 'Achieved 90%+ accuracy in session'
            })
        
        if session_summary.get('accuracy_streak', 0) >= 10:
            achievements.append({
                'type': 'streak',
                'title': 'Perfect Streak',
                'description': f"Answered {session_summary['accuracy_streak']} questions correctly in a row"
            })
        
        if session_summary.get('duration_minutes', 0) >= 45:
            achievements.append({
                'type': 'endurance',
                'title': 'Focused Learner',
                'description': 'Maintained focus for 45+ minutes'
            })
        
        return achievements
    
    def _get_next_session_recommendations(
        self, 
        db: Session, 
        user_id: int, 
        session_summary: Dict
    ) -> Dict[str, Any]:
        """Get recommendations for next session"""
        recommendations = {
            'suggested_topics': [],
            'difficulty_level': session_summary.get('current_difficulty', 'intermediate'),
            'optimal_duration': 30,
            'focus_areas': []
        }
        
        # Suggest topics based on performance
        if session_summary.get('accuracy_rate', 0) < 0.6:
            recommendations['focus_areas'].append('Review current topic fundamentals')
            recommendations['suggested_topics'].append('Prerequisite concepts')
        else:
            recommendations['focus_areas'].append('Advance to next topic')
            recommendations['suggested_topics'].append('Related advanced concepts')
        
        # Suggest optimal duration based on cognitive load
        avg_load = session_summary.get('cognitive_load', 0.5)
        if avg_load > 0.7:
            recommendations['optimal_duration'] = 20
            recommendations['focus_areas'].append('Shorter sessions recommended')
        elif avg_load < 0.4:
            recommendations['optimal_duration'] = 45
            recommendations['focus_areas'].append('Can handle longer sessions')
        
        return recommendations


# Export main engine
def get_adaptive_engine() -> AdaptiveLearningEngine:
    """Get singleton instance of adaptive learning engine"""
    return AdaptiveLearningEngine()
