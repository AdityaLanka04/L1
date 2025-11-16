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
        self.min_notification_interval = timedelta(minutes=2)  # Very frequent for proactive tutoring
    
    def analyze_learning_patterns(self, db: Session, user_id: int, is_idle: bool = False):
        """Analyze user's learning patterns to detect intervention opportunities"""
        
        # Get recent activities (last 24 hours)
        yesterday = datetime.now(timezone.utc) - timedelta(hours=24)
        
        # Check if user just completed profile quiz (within last 5 minutes)
        user = db.query(models.User).filter(models.User.id == user_id).first()
        five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
        just_completed_quiz = False
        is_new_user = False
        
        if user:
            # Check if user was created recently (within last hour)
            if user.created_at and user.created_at >= datetime.now(timezone.utc) - timedelta(hours=1):
                is_new_user = True
            
            # Check if user has profile data but very few chat sessions (just completed quiz)
            chat_count = db.query(models.ChatSession).filter(
                models.ChatSession.user_id == user_id
            ).count()
            
            if user.field_of_study and chat_count <= 1:
                just_completed_quiz = True
        
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
        
        # Get weak topics from user stats
        weak_topics = []
        try:
            # Get topics where user has low accuracy
            from sqlalchemy import Integer
            topic_stats = db.query(
                models.Activity.topic,
                func.count(models.Activity.id).label('total'),
                func.sum(func.cast(models.Activity.correct, Integer)).label('correct_count')
            ).filter(
                models.Activity.user_id == user_id,
                models.Activity.timestamp >= yesterday,
                models.Activity.topic.isnot(None)
            ).group_by(models.Activity.topic).all()
            
            for topic, total, correct in topic_stats:
                if total >= 3:  # At least 3 attempts
                    accuracy = (correct or 0) / total
                    if accuracy < 0.6:  # Less than 60% accuracy
                        weak_topics.append({
                            'topic': topic,
                            'accuracy': accuracy,
                            'attempts': total
                        })
        except Exception as e:
            print(f"Error getting weak topics: {e}")
        
        return {
            "wrong_answers_count": len(wrong_answers),
            "topics_with_errors": topics_with_errors,
            "clarification_requests_count": len(clarification_requests),
            "recent_clarifications": clarification_requests[:3],
            "inactive_but_was_active": recent_activity == 0 and previous_activity > 0,
            "struggling_topics": list(topics_with_errors.keys()),
            "is_new_user": is_new_user,
            "just_completed_quiz": just_completed_quiz,
            "is_idle": is_idle,
            "weak_topics": weak_topics
        }
    
    def calculate_ml_intervention_score(self, patterns: dict, user_history: dict) -> float:
        """
        ML-based scoring to determine intervention priority
        Uses neural network-inspired weighted features
        Returns score 0-1 (higher = more urgent intervention needed)
        """
        
        # Feature extraction with weights (simulating trained neural network)
        features = {
            'wrong_answers_normalized': min(patterns["wrong_answers_count"] / 5.0, 1.0),  # Weight: 0.25
            'topic_concentration': len(patterns["topics_with_errors"]) / max(patterns["wrong_answers_count"], 1),  # Weight: 0.15
            'clarification_frequency': min(patterns["clarification_requests_count"] / 3.0, 1.0),  # Weight: 0.15
            'inactivity_signal': 1.0 if patterns["inactive_but_was_active"] else 0.0,  # Weight: 0.10
            'idle_signal': 1.0 if patterns.get("is_idle", False) else 0.0,  # Weight: 0.15
            'weak_topics_signal': min(len(patterns.get("weak_topics", [])) / 3.0, 1.0),  # Weight: 0.10
            'time_of_day_factor': self._get_time_of_day_engagement_factor(),  # Weight: 0.10
        }
        
        # Weighted sum (neural network output layer simulation)
        weights = [0.25, 0.15, 0.15, 0.10, 0.15, 0.10, 0.10]
        feature_values = list(features.values())
        
        score = sum(w * v for w, v in zip(weights, feature_values))
        
        # Boost score for new users or just completed quiz
        if patterns.get("is_new_user") or patterns.get("just_completed_quiz"):
            score = max(score, 0.8)
        
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
        
        # Threshold for intervention (0.1 = 10% confidence - VERY proactive)
        if score < 0.1:
            return False, None, score
        
        # Determine reason based on dominant pattern (priority order)
        
        # 1. Welcome message for new users or after profile quiz (highest priority)
        if patterns.get("is_new_user") or patterns.get("just_completed_quiz"):
            return True, "welcome", 0.9
        
        # 2. Idle detection - user hasn't interacted in a while
        if patterns.get("is_idle"):
            weak_topics = patterns.get("weak_topics", [])
            if weak_topics:
                topic = weak_topics[0]['topic']
                return True, f"idle_weak_topic:{topic}", 0.8
            return True, "idle_check_in", 0.7
        
        # 3. Struggling with specific topics
        if patterns["wrong_answers_count"] >= 3:
            struggling_topic = list(patterns["topics_with_errors"].keys())[0] if patterns["topics_with_errors"] else "this topic"
            return True, f"struggle_with_topic:{struggling_topic}", score
        
        # 4. Weak topics detected (low accuracy)
        weak_topics = patterns.get("weak_topics", [])
        if weak_topics and score > 0.4:
            topic = weak_topics[0]['topic']
            accuracy = int(weak_topics[0]['accuracy'] * 100)
            return True, f"weak_topic:{topic}:{accuracy}", score
        
        # 5. Repeated confusion/clarification requests
        if patterns["clarification_requests_count"] >= 2:
            return True, "repeated_confusion", score
        
        # 6. Inactive but was active before
        if patterns["inactive_but_was_active"] and score > 0.5:
            return True, "check_in", score
        
        # 7. Encouragement for consistent learners
        if score > 0.25 and random.random() < 0.15:
            return True, "encouragement", score
        
        return False, None, score
    
    async def generate_proactive_message(self, db: Session, user_id: int, reason: str, user_profile: dict):
        """Generate a personalized proactive message"""
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        first_name = user.first_name or "there"
        field_of_study = user.field_of_study or "your studies"
        
        # Get context based on reason
        if reason.startswith("idle_weak_topic:"):
            topic = reason.split(":")[1]
            
            prompt = f"""You are a caring AI tutor checking in on {first_name} who has been idle.

They've been struggling with {topic} and haven't been active for a bit.

Generate a friendly, personalized message that:
1. Asks how they're doing with {topic}
2. Offers specific help or practice
3. Sounds like a caring human tutor, not a bot
4. Keeps it brief (2-3 sentences)
5. Makes them want to engage

Be warm, personal, and encouraging."""

        elif reason == "idle_check_in":
            prompt = f"""You are a caring AI tutor checking in on {first_name} who has been idle.

They're studying {field_of_study} but haven't been active recently.

Generate a friendly check-in message that:
1. Asks what they're working on
2. Offers to help with anything
3. Sounds natural and caring
4. Keeps it brief (2 sentences)
5. Encourages them to continue learning

Be warm and supportive."""

        elif reason.startswith("weak_topic:"):
            parts = reason.split(":")
            topic = parts[1]
            accuracy = parts[2] if len(parts) > 2 else "low"
            
            prompt = f"""You are a caring AI tutor reaching out to {first_name}.

You've noticed they have {accuracy}% accuracy on {topic} - they need help but might not realize it.

Generate a supportive message that:
1. Mentions you noticed they're working on {topic}
2. Offers to help them improve
3. Suggests a focused practice session
4. Sounds encouraging, not critical
5. Keeps it brief (2-3 sentences)

Be supportive and motivating."""

        elif reason.startswith("struggle_with_topic:"):
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

Be warm and supportive."""

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

        elif reason == "welcome":
            prompt = f"""You are a friendly AI tutor welcoming {first_name} to their personalized learning journey.

They just completed their profile quiz and are studying {field_of_study}.

Generate a warm, personalized welcome message that:
1. Greets them by name enthusiastically
2. Mentions their field of study ({field_of_study})
3. Asks what they'd like to learn first or what they're working on
4. Keeps it brief (2-3 sentences)
5. Sounds like an excited human tutor, not a bot

Be warm, personal, and inviting."""

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
            reason_key = reason.split(":")[0]
            topic_name = reason.split(":")[1] if ':' in reason else 'this topic'
            
            fallbacks = {
                "idle_weak_topic": f"Hey {first_name}! I noticed you've been working on {topic_name}. How's it going? Want to practice together? 💪",
                "idle_check_in": f"Hi {first_name}! Taking a break? I'm here when you're ready to continue learning! 📚",
                "weak_topic": f"Hey {first_name}! I see you're working on {topic_name}. Want some help to master it? I can explain it differently! 🎯",
                "struggle_with_topic": f"Hey {first_name}! I noticed you're working hard on {topic_name}. Want to go over it together? I can explain it differently! 💡",
                "repeated_confusion": f"Hi {first_name}! I see you're asking great questions. Sometimes a different explanation helps - want me to break this down step by step? 🎯",
                "check_in": f"Hey {first_name}! How's your study session going? I'm here if you need any help! 📚",
                "encouragement": f"You're doing great, {first_name}! Keep up the awesome work! 🌟",
                "welcome": f"Welcome {first_name}! 🎉 I'm excited to help you with {field_of_study}. What would you like to learn first?"
            }
            return fallbacks.get(reason_key, fallbacks["encouragement"])
    
    async def check_and_send_proactive_message(self, db: Session, user_id: int, user_profile: dict, is_idle: bool = False):
        """
        Main function to check if we should reach out and create the message
        Uses ML to determine optimal timing and intervention strategy
        """
        
        # Analyze patterns
        patterns = self.analyze_learning_patterns(db, user_id, is_idle)
        
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
