"""
Conversation Context Detector
Detects when users are rejecting AI's approach, discussing emotional topics,
or explicitly requesting to avoid certain conversation styles.
"""

import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class ConversationContextDetector:
    """Detects conversation context and user intent changes"""
    
    # Phrases indicating user is rejecting the AI's approach
    REJECTION_PHRASES = [
        "can we not", "don't talk about", "stop talking about",
        "i said", "i told you", "not about", "don't want to discuss",
        "change the subject", "let's not", "enough about",
        "stop", "no more", "i don't want", "please don't",
        "can you not", "stop with", "enough with"
    ]
    
    # Emotional/personal topics that shouldn't be academic
    EMOTIONAL_TOPICS = [
        "depressed", "depression", "sad", "sadness", "anxious", "anxiety",
        "stressed", "stress", "worried", "worry", "upset", "angry",
        "frustrated", "frustration", "lonely", "loneliness", "scared",
        "fear", "afraid", "hurt", "pain", "suffering", "struggling",
        "mental health", "feeling down", "feeling bad", "not okay",
        "suicidal", "self harm", "hopeless", "helpless"
    ]
    
    # Academic keywords to avoid when user requests it
    ACADEMIC_KEYWORDS = [
        "study", "studying", "learn", "learning", "practice", "quiz",
        "test", "exam", "homework", "assignment", "course", "class",
        "subject", "topic", "lesson", "tutorial", "education",
        "academic", "school", "university", "college"
    ]
    
    def __init__(self):
        self.rejection_count = 0
        self.last_detected_emotion = None
    
    def is_rejecting_previous_approach(self, current_message: str, 
                                      conversation_history: List[Dict] = None) -> bool:
        """
        Check if user is explicitly rejecting the AI's approach
        
        Args:
            current_message: The current user message
            conversation_history: Recent conversation history
        
        Returns:
            True if user is rejecting the approach
        """
        current_lower = current_message.lower().strip()
        
        # Check for direct rejection phrases
        for phrase in self.REJECTION_PHRASES:
            if phrase in current_lower:
                logger.warning(f"🚨 User rejection detected: '{phrase}' in message")
                self.rejection_count += 1
                return True
        
        # Check if user is repeating themselves (sign of not being heard)
        if "i said" in current_lower or "i told you" in current_lower:
            logger.warning(f"🚨 User repeating themselves - not being heard")
            self.rejection_count += 1
            return True
        
        # Check if user is contradicting previous AI response
        if conversation_history and len(conversation_history) > 0:
            last_ai_response = conversation_history[-1].get("ai_response", "").lower()
            
            # If AI talked about academics and user says "not academics"
            if any(keyword in last_ai_response for keyword in self.ACADEMIC_KEYWORDS):
                if "not" in current_lower and any(keyword in current_lower for keyword in ["academic", "study", "learn"]):
                    logger.warning(f"🚨 User contradicting AI's academic approach")
                    self.rejection_count += 1
                    return True
        
        return False
    
    def is_emotional_personal_topic(self, message: str) -> bool:
        """
        Check if this is an emotional/personal topic, not academic
        
        Args:
            message: The user message
        
        Returns:
            True if this is an emotional/personal topic
        """
        message_lower = message.lower().strip()
        
        for topic in self.EMOTIONAL_TOPICS:
            if topic in message_lower:
                logger.info(f"🎭 Emotional topic detected: '{topic}'")
                self.last_detected_emotion = topic
                return True
        
        return False
    
    def should_avoid_academics(self, conversation_history: List[Dict]) -> bool:
        """
        Check if user has explicitly asked to avoid academic topics
        
        Args:
            conversation_history: Recent conversation history
        
        Returns:
            True if user wants to avoid academics
        """
        if not conversation_history:
            return False
        
        # Check last 5 messages for explicit requests
        for msg in conversation_history[-5:]:
            user_msg = msg.get("user_message", "").lower()
            
            # Direct requests to avoid academics
            avoid_phrases = [
                "not talk about academics",
                "don't talk about academics",
                "stop talking about academics",
                "can we not talk about academics",
                "no academics",
                "not about academics",
                "don't want to talk about academics",
                "not academic",
                "don't make it academic"
            ]
            
            for phrase in avoid_phrases:
                if phrase in user_msg:
                    logger.warning(f"🚨 User explicitly requested to avoid academics")
                    return True
        
        return False
    
    def get_conversation_mode_suggestion(self, message: str, 
                                        conversation_history: List[Dict] = None) -> str:
        """
        Suggest appropriate conversation mode based on context
        
        Args:
            message: Current user message
            conversation_history: Recent conversation history
        
        Returns:
            Suggested mode: "personal_support", "tutoring", "casual", etc.
        """
        # Check for emotional/personal topics first
        if self.is_emotional_personal_topic(message):
            return "personal_support"
        
        # Check if user is rejecting academic approach
        if self.is_rejecting_previous_approach(message, conversation_history):
            if self.should_avoid_academics(conversation_history or []):
                return "personal_support"
            return "casual"
        
        # Check if user wants to avoid academics
        if self.should_avoid_academics(conversation_history or []):
            return "personal_support"
        
        # Check for casual conversation
        casual_patterns = [
            "how are you", "what's up", "hey", "hi", "hello",
            "good morning", "good afternoon", "good evening",
            "thanks", "thank you", "bye", "goodbye"
        ]
        
        message_lower = message.lower().strip()
        if any(pattern in message_lower for pattern in casual_patterns):
            return "casual"
        
        # Default to tutoring for educational queries
        return "tutoring"
    
    def get_rejection_count(self) -> int:
        """Get number of times user has rejected AI's approach"""
        return self.rejection_count
    
    def reset_rejection_count(self):
        """Reset rejection counter"""
        self.rejection_count = 0
    
    def get_context_summary(self, message: str, 
                           conversation_history: List[Dict] = None) -> Dict:
        """
        Get comprehensive context summary
        
        Returns:
            Dict with context information
        """
        return {
            "is_emotional": self.is_emotional_personal_topic(message),
            "is_rejecting": self.is_rejecting_previous_approach(message, conversation_history),
            "should_avoid_academics": self.should_avoid_academics(conversation_history or []),
            "suggested_mode": self.get_conversation_mode_suggestion(message, conversation_history),
            "rejection_count": self.rejection_count,
            "last_emotion": self.last_detected_emotion
        }


# Global instance for easy access
_detector_instance = None

def get_context_detector() -> ConversationContextDetector:
    """Get global context detector instance"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = ConversationContextDetector()
    return _detector_instance
