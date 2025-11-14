"""
Proactive AI Learning Assistant
Uses ML to detect when students need help and proactively reaches out
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
import json
import random
import numpy as np
from groq import Groq
import models

class ProactiveAIEngine:
    def __init__(self, unified_ai):
        self.unified_ai = unified_ai
        self.min_notification_interval = timedelta(minutes=30)  # Don't spam users
    
    def analyze_learning_patterns(self, db: Session, user_id: int):
        """Analyze user's learning patterns to detect intervention opportunities"""
        
        # Get recent activities (last 24 hours)
        yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Check for wrong answers in quizzes
        wrong_answers = db.query(models.Activity).filter(
            models.Activity.user_id == user_id,
            models.Activity.timestamp >= yesterday,
            models.Activity.correct == False
        ).all()
        
        # Check for repeated questions on same topic
        recent_chats = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == user_id,
            models.ChatMessage.timestamp >= yesterday
        ).order_by(models.ChatMessage.timestamp.desc()).limit(10).all()
        
        # Check for struggle patterns (multiple wrong answers on same topic)
        topics_with_errors = {}
        for activity in wrong_answers:
            topic = activity.topic or "General"
            if topic not in topics_with_errors:
                topics_with_errors[topic] = []
            topics_with_errors[topic].append(activity)
        
        # Check for repeated clarification requests
        clarification_keywords = ['explain', 'clarify', 'don\'t understand', 'confused', 'help', 'what does', 'how does']
        clarification_requests = []
        for chat in recent_chats:
            if any(keyword in chat.user_message.lower() for keyword in clarification_keywords):
                clarification_requests.append(chat)
        
        # Check for inactivity (no activity in last 2 hours but was active before)
        two_hours_ago = datetime.now(timezone.utc) - timedelta(hours=2)
        recent_activity = db.query(models.Activity).filter(
            models.Activity.user_id == user_id,
            models.Activity.timestamp >= two_hours_ago
        ).count()
        
        previous_activity = db.query(models.Activity).filter(
            models.Activity.user_id == user_id,
            models.Activity.timestamp < two_hours_ago,
            models.Activity.timestamp >= yesterday
        ).count()
        
        return {
            "wrong_answers_count": len(wrong_answers),
            "topics_with_errors": topics_with_errors,
            "clarification_requests_count": len(clarification_requests),
            "recent_clarifications": clarification_requests[:3],
            "inactive_but_was_active": recent_activity == 0 and previous_activity > 0,
            "struggling_topics": list(topics_with_errors.keys())
        }
    
    def calculate_ml_intervention_score(self, patterns: dict, user_history: dict) -> float:
        """
        ML-based scoring to determine intervention priority
        Uses neural network-inspired weighted features
        Returns score 0-1 (higher = more urgent intervention needed)
        """
        
        # Feature extraction with weights (simulating trained neural network)
        features = {
            'wrong_answers_normalized': min(patterns["wrong_answers_count"] / 5.0, 1.0),  # Weight: 0.35
            'topic_concentration': len(patterns["topics_with_errors"]) / max(patterns["wrong_answers_count"], 1),  # Weight: 0.25
            'clarification_frequency': min(patterns["clarification_requests_count"] / 3.0, 1.0),  # Weight: 0.20
            'inactivity_signal': 1.0 if patterns["inactive_but_was_active"] else 0.0,  # Weight: 0.10
            'time_of_day_factor': self._get_time_of_day_engagement_factor(),  # Weight: 0.10
        }
        
        # Weighted sum (neural network output layer simulation)
        weights = [0.35, 0.25, 0.20, 0.10, 0.10]
        feature_values = list(features.values())
        
        score = sum(w * v for w, v in zip(weights, feature_values))
        
        # Apply sigmoid activation for smooth 0-1 output
        score = 1 / (1 + np.exp(-5 * (score - 0.5)))
        
        return score
    
    def _get_time_of_day_engagement_factor(self) -> float:
        """Returns engagement factor based on time of day (0-1)"""
        hour = datetime.now().hour
        
        # Peak learning hours: 9AM-11AM (0.9-1.0), 2PM-5PM (0.8-0.9), 7PM-9PM (0.7-0.8)
        if 9 <= hour <= 11:
            return 1.0
        elif 14 <= hour <= 17:
            return 0.85
        elif 19 <= hour <= 21:
            return 0.75
        elif 6 <= hour <= 8 or 12 <= hour <= 13:
            return 0.6
        else:
            return 0.3  # Late night/early morning - lower priority
    
    def calculate_optimal_timing(self, score: float, patterns: dict) -> int:
        """
        ML-based timing calculation
        Returns minutes to wait before sending notification
        Higher urgency = shorter wait time
        """
        
        if score > 0.8:  # High urgency
            return random.randint(5, 15)
        elif score > 0.6:  # Medium urgency
            return random.randint(15, 45)
        elif score > 0.4:  # Low urgency
            return random.randint(45, 90)
        else:  # Very low urgency
            return random.randint(90, 120)
    
    def should_reach_out(self, patterns: dict, user_history: dict = None) -> tuple[bool, str, float]:
        """
        ML-enhanced decision making for proactive outreach
        Returns: (should_reach_out, reason, urgency_score)
        """
        
        if user_history is None:
            user_history = {}
        
        # Calculate ML intervention score
        score = self.calculate_ml_intervention_score(patterns, user_history)
        
        # Threshold for intervention (0.4 = 40% confidence)
        if score < 0.4:
            return False, None, score
        
        # Determine reason based on dominant pattern
        if patterns["wrong_answers_count"] >= 3:
            struggling_topic = list(patterns["topics_with_errors"].keys())[0] if patterns["topics_with_errors"] else "this topic"
            return True, f"struggle_with_topic:{struggling_topic}", score
        
        if patterns["clarification_requests_count"] >= 2:
            return True, "repeated_confusion", score
        
        if patterns["inactive_but_was_active"] and score > 0.5:
            return True, "check_in", score
        
        # Encouragement for consistent learners (lower threshold)
        if score > 0.35 and random.random() < 0.1:
            return True, "encouragement", score
        
        return False, None, score
    
    async def generate_proactive_message(self, db: Session, user_id: int, reason: str, user_profile: dict):
        """Generate a personalized proactive message"""
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        first_name = user.first_name or "there"
        
        # Get context based on reason
        if reason.startswith("struggle_with_topic:"):
            topic = reason.split(":")[1]
            
            # Get the wrong answers
            yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
            wrong_answers = db.query(models.Activity).filter(
                models.Activity.user_id == user_id,
                models.Activity.timestamp >= yesterday,
                models.Activity.correct == False,
                models.Activity.topic == topic
            ).limit(3).all()
            
            questions_text = "\n".join([f"- {a.question}" for a in wrong_answers[:2]])
            
            prompt = f"""You are a caring AI tutor reaching out to help {first_name}.

They've been struggling with {topic} - they got these questions wrong recently:
{questions_text}

Generate a friendly, encouraging message that:
1. Acknowledges their effort
2. Offers to help them understand the concept better
3. Suggests a quick review session
4. Keeps it brief (2-3 sentences)
5. Sounds natural and caring, not robotic

Start with their name and be warm and supportive."""

        elif reason == "repeated_confusion":
            prompt = f"""You are a caring AI tutor reaching out to {first_name}.

They've asked for clarification multiple times recently, which suggests they might be struggling with understanding.

Generate a friendly message that:
1. Acknowledges they're working hard
2. Offers to explain things differently
3. Suggests breaking down complex topics
4. Keeps it brief (2-3 sentences)
5. Sounds encouraging and supportive"""

        elif reason == "check_in":
            prompt = f"""You are a caring AI tutor checking in on {first_name}.

They were studying actively but haven't been back in a couple hours.

Generate a friendly check-in message that:
1. Asks how their study session went
2. Offers to help if they need anything
3. Encourages them to keep going
4. Keeps it brief (2-3 sentences)
5. Sounds warm and natural"""

        else:  # encouragement
            prompt = f"""You are a caring AI tutor sending encouragement to {first_name}.

They've been studying consistently.

Generate a brief encouraging message that:
1. Acknowledges their progress
2. Motivates them to keep going
3. Keeps it very brief (1-2 sentences)
4. Sounds genuine and supportive"""
        
        try:
            message = self.unified_ai.generate(prompt, max_tokens=200, temperature=0.8)
            return message
            
        except Exception as e:
            # Fallback messages
            fallbacks = {
                "struggle_with_topic": f"Hey {first_name}! I noticed you're working hard on {topic.split(':')[1] if ':' in topic else 'this topic'}. Want to go over it together? I can explain it differently! 💡",
                "repeated_confusion": f"Hi {first_name}! I see you're asking great questions. Sometimes a different explanation helps - want me to break this down step by step? 🎯",
                "check_in": f"Hey {first_name}! How's your study session going? I'm here if you need any help! 📚",
                "encouragement": f"You're doing great, {first_name}! Keep up the awesome work! 🌟"
            }
            return fallbacks.get(reason.split(":")[0], fallbacks["encouragement"])
    
    async def check_and_send_proactive_message(self, db: Session, user_id: int, user_profile: dict):
        """
        Main function to check if we should reach out and create the message
        Uses ML to determine optimal timing and intervention strategy
        """
        
        # Analyze patterns
        patterns = self.analyze_learning_patterns(db, user_id)
        
        # Get user history for ML model
        user_history = self._get_user_history(db, user_id)
        
        # ML-based decision
        should_reach, reason, urgency_score = self.should_reach_out(patterns, user_history)
        
        if not should_reach:
            return None
        
        # Check if we already sent a proactive message recently (anti-spam)
        recent_proactive = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == user_id,
            models.ChatMessage.user_message.like("🤖 PROACTIVE:%")
        ).order_by(models.ChatMessage.timestamp.desc()).first()
        
        if recent_proactive:
            time_since = datetime.now(timezone.utc) - recent_proactive.timestamp
            if time_since < self.min_notification_interval:
                return None  # Don't spam - respect minimum interval
        
        # Calculate optimal timing (in minutes)
        optimal_delay_minutes = self.calculate_optimal_timing(urgency_score, patterns)
        
        # Generate the personalized message
        message = await self.generate_proactive_message(db, user_id, reason, user_profile)
        
        return {
            "message": message,
            "reason": reason,
            "patterns": patterns,
            "urgency_score": urgency_score,
            "optimal_delay_minutes": optimal_delay_minutes,
            "should_show_now": optimal_delay_minutes <= 5  # Show immediately if high urgency
        }
    
    def _get_user_history(self, db: Session, user_id: int) -> dict:
        """Get user's historical engagement patterns for ML model"""
        
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        
        # Get activity patterns
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id,
            models.Activity.timestamp >= week_ago
        ).all()
        
        # Calculate engagement metrics
        total_activities = len(activities)
        correct_count = sum(1 for a in activities if a.correct)
        accuracy = correct_count / total_activities if total_activities > 0 else 0
        
        # Get chat engagement
        chats = db.query(models.ChatMessage).filter(
            models.ChatMessage.user_id == user_id,
            models.ChatMessage.timestamp >= week_ago
        ).count()
        
        return {
            "total_activities": total_activities,
            "accuracy": accuracy,
            "chat_engagement": chats,
            "avg_daily_activities": total_activities / 7
        }

# Singleton instance
_proactive_ai_engine = None

def get_proactive_ai_engine(unified_ai):
    global _proactive_ai_engine
    if _proactive_ai_engine is None:
        _proactive_ai_engine = ProactiveAIEngine(unified_ai)
    return _proactive_ai_engine
