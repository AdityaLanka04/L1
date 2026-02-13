"""
Human-Like Response Logic
Makes AI respond naturally like a human, not a verbose bot.
Detects repetition, trolling, and adjusts response style accordingly.
"""

import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from collections import Counter
import re

logger = logging.getLogger(__name__)


class HumanResponseLogic:
    """
    Makes AI respond like a human:
    - Short responses for simple messages
    - Detects when user is repeating themselves
    - Detects trolling/testing behavior
    - Adjusts verbosity based on context
    - Calls out repetitive behavior naturally
    """
    
    def __init__(self):
        self.repetition_threshold = 3  # After 3 same messages, call it out
        self.short_message_threshold = 10  # Messages under 10 chars are "short"
        self.verbose_response_penalty = 0  # Tracks how verbose we've been
        
    def analyze_conversation_pattern(self, 
                                    current_message: str,
                                    conversation_history: List[Dict]) -> Dict:
        """
        Analyze conversation for patterns that need human-like responses
        
        Returns:
            Dict with analysis results and suggested response style
        """
        analysis = {
            "is_repetitive": False,
            "repetition_count": 0,
            "repeated_message": None,
            "is_trolling": False,
            "is_testing": False,
            "is_short_message": False,
            "is_real_question": False,  # NEW - detect if it's a real question
            "suggested_style": "normal",
            "suggested_max_length": "medium",  # short, medium, long
            "call_out_behavior": False,
            "human_response_needed": False
        }
        
        current_lower = current_message.lower().strip()
        
        # FIRST: Check if this is a REAL QUESTION that needs answering
        real_question_indicators = [
            "what", "how", "why", "when", "where", "who", "which",
            "explain", "tell me", "can you", "could you", "would you",
            "help me", "i need", "i want", "show me", "teach me",
            "?", "discuss", "talk about", "let's", "lets"
        ]
        
        # If message contains question indicators and is longer than 15 chars, it's a real question
        if any(indicator in current_lower for indicator in real_question_indicators) and len(current_message) > 15:
            analysis["is_real_question"] = True
            analysis["suggested_max_length"] = "long"  # Allow full response
            logger.info(f"✅ Detected REAL QUESTION - will provide full answer")
            return analysis  # Skip other checks, just answer the question
        
        # Check if message is short
        if len(current_message.strip()) <= self.short_message_threshold:
            analysis["is_short_message"] = True
            analysis["suggested_max_length"] = "short"
        
        # Check for repetition in recent messages (but only if NOT a real question)
        if conversation_history and not analysis["is_real_question"]:
            recent_user_messages = [
                msg.get("user_message", "").lower().strip()
                for msg in conversation_history[-10:]
                if msg.get("user_message")
            ]
            
            # Count how many times current message appears
            repetition_count = recent_user_messages.count(current_lower)
            
            if repetition_count >= 2:  # Said it 2+ times before
                analysis["is_repetitive"] = True
                analysis["repetition_count"] = repetition_count + 1  # +1 for current
                analysis["repeated_message"] = current_message
                analysis["call_out_behavior"] = True
                analysis["human_response_needed"] = True
                analysis["suggested_style"] = "call_out_repetition"
        
        # Check for trolling patterns (but only if NOT a real question)
        if not analysis["is_real_question"]:
            trolling_patterns = [
                r"^(hey|hi|hello|sup|yo)( man| dude| bro)?[\s!.?]*$",  # Just "hey man" repeatedly
                r"^(lol|lmao|haha|wtf|bruh)[\s!.?]*$",  # Just reactions
                r"^(test|testing|test test)[\s!.?]*$",  # Testing
                r"^(ok|okay|k)[\s!.?]*$",  # Just "ok"
                r"^\.+$",  # Just dots
                r"^[!?]+$",  # Just punctuation
            ]
            
            for pattern in trolling_patterns:
                if re.match(pattern, current_lower):
                    # Check if they've done this multiple times
                    if conversation_history and len(conversation_history) >= 3:
                        recent_short = sum(
                            1 for msg in conversation_history[-5:]
                            if len(msg.get("user_message", "").strip()) <= 15
                        )
                        if recent_short >= 3:
                            analysis["is_trolling"] = True
                            analysis["call_out_behavior"] = True
                            analysis["human_response_needed"] = True
                            analysis["suggested_style"] = "call_out_trolling"
                    break
        
        # Check for testing behavior
        testing_keywords = ["test", "testing", "are you working", "do you work", "can you hear me"]
        if any(keyword in current_lower for keyword in testing_keywords) and len(current_message) < 20:
            analysis["is_testing"] = True
            analysis["suggested_style"] = "acknowledge_test"
            analysis["suggested_max_length"] = "short"
        
        # Check if AI has been too verbose recently
        if conversation_history:
            recent_ai_responses = [
                msg.get("ai_response", "")
                for msg in conversation_history[-3:]
                if msg.get("ai_response")
            ]
            avg_ai_length = sum(len(r) for r in recent_ai_responses) / max(len(recent_ai_responses), 1)
            
            # If AI has been writing essays (>500 chars average), tone it down
            # BUT NOT if this is a real question that needs a full answer
            if avg_ai_length > 500 and not analysis["is_real_question"]:
                analysis["suggested_max_length"] = "short"
                logger.info(f"AI has been verbose (avg {avg_ai_length:.0f} chars), suggesting shorter response")
        
        return analysis
    
    def generate_human_response_instruction(self, analysis: Dict, current_message: str) -> str:
        """
        Generate instruction for AI to respond like a human based on analysis
        
        Returns:
            Instruction string to prepend to AI prompt
        """
        instructions = []
        
        # If this is a REAL QUESTION, don't add restrictive instructions
        if analysis.get("is_real_question"):
            instructions.append("""ANSWER THE QUESTION FULLY AND COMPREHENSIVELY:
- This is a real question that needs a complete answer
- Provide detailed explanations
- Use examples and context
- Be thorough and educational
- Don't hold back on length - answer completely""")
            return "\n".join(instructions)
        
        # Base instruction for natural responses (only for non-questions)
        base = """RESPOND LIKE A REAL HUMAN, NOT A BOT:
- Keep it SHORT and NATURAL
- Don't write essays for simple messages
- Don't repeat yourself
- Don't be overly formal or therapeutic
- Match the user's energy and tone"""
        
        instructions.append(base)
        
        # Handle repetition
        if analysis["is_repetitive"]:
            count = analysis["repetition_count"]
            msg = analysis["repeated_message"]
            instructions.append(f"""
🚨 USER IS REPEATING THEMSELVES:
They've said "{msg}" {count} times now.

RESPOND NATURALLY:
- Acknowledge they're repeating: "You've said that {count} times now 😅"
- Ask what's up: "Everything okay? What's going on?"
- Be direct and casual, not therapeutic
- Keep it SHORT (2-3 sentences MAX)

Example: "Hey, you've said '{msg}' like {count} times now 😅 What's up? Everything okay?"
""")
        
        # Handle trolling
        elif analysis["is_trolling"]:
            instructions.append("""
🚨 USER SEEMS TO BE TROLLING/TESTING:
They're sending very short messages repeatedly.

RESPOND NATURALLY:
- Call it out casually: "Okay, what's going on? 😅"
- Be playful but direct: "You testing me or something?"
- Keep it SHORT and casual
- Don't write a therapy session

Example: "Alright, you're definitely testing me 😅 What's actually up?"
""")
        
        # Handle testing
        elif analysis["is_testing"]:
            instructions.append("""
🧪 USER IS TESTING THE SYSTEM:

RESPOND SIMPLY:
- Confirm you're working: "Yep, I'm here!"
- Keep it SHORT (1 sentence)
- Be casual and friendly

Example: "Yep, I'm here! What's up?"
""")
        
        # Handle short messages
        elif analysis["is_short_message"]:
            instructions.append(f"""
💬 USER SENT A SHORT MESSAGE: "{current_message}"

RESPOND SHORT:
- Match their energy
- 1-2 sentences MAX
- Be casual and natural
- Don't launch into a speech

Examples:
- "hey" → "Hey! What's up?"
- "hi" → "Hi! How's it going?"
- "sup" → "Not much! You?"
- "thanks" → "No problem! 😊"
""")
        
        # Length constraints (only for non-questions)
        if analysis["suggested_max_length"] == "short":
            instructions.append("""
📏 LENGTH LIMIT: 
- Maximum 2-3 sentences
- Around 50-100 characters
- Be concise and direct
""")
        elif analysis["suggested_max_length"] == "medium":
            instructions.append("""
📏 LENGTH LIMIT:
- Maximum 4-5 sentences
- Around 200-300 characters
- Get to the point quickly
""")
        
        # Final reminder
        instructions.append("""
🎯 REMEMBER:
- Real humans don't write essays for "hey"
- Match the user's vibe
- Be natural and casual
- If they're being weird, call it out
- Keep it SHORT unless they ask for detail
""")
        
        return "\n".join(instructions)
    
    def should_call_out_behavior(self, analysis: Dict) -> Tuple[bool, str]:
        """
        Determine if AI should call out user's behavior
        
        Returns:
            (should_call_out, reason)
        """
        if analysis["is_repetitive"]:
            count = analysis["repetition_count"]
            msg = analysis["repeated_message"]
            return True, f"repetition_{count}_{msg}"
        
        if analysis["is_trolling"]:
            return True, "trolling"
        
        return False, ""
    
    def get_max_tokens_for_style(self, analysis: Dict) -> int:
        """
        Get appropriate max_tokens based on response style
        
        Returns:
            max_tokens value
        """
        # ALWAYS allow full responses for real questions
        if analysis.get("is_real_question"):
            return 3000  # Full detailed answer
        
        if analysis["suggested_max_length"] == "short":
            return 150  # Force short responses
        elif analysis["suggested_max_length"] == "medium":
            return 800
        else:
            return 2000  # Normal length
    
    def detect_conversation_loop(self, conversation_history: List[Dict]) -> bool:
        """
        Detect if conversation is stuck in a loop
        
        CRITICAL: Only check USER messages, not AI responses!
        We don't want to trigger loop detection because the AI repeated itself.
        
        Returns:
            True if loop detected
        """
        if len(conversation_history) < 4:
            return False
        
        # Check last 4 exchanges - ONLY USER MESSAGES
        recent = conversation_history[-4:]
        user_messages = []
        
        for msg in recent:
            # Get user message from various possible keys
            user_msg = (
                msg.get("user_message", "") or 
                msg.get("user", "") or 
                msg.get("message", "")
            )
            if user_msg:
                user_messages.append(user_msg.lower().strip())
        
        # Need at least 3 user messages to detect a loop
        if len(user_messages) < 3:
            return False
        
        # If 3+ USER messages are identical, it's a loop
        message_counts = Counter(user_messages)
        most_common_count = message_counts.most_common(1)[0][1] if message_counts else 0
        
        # IMPORTANT: Only trigger if user is actually repeating themselves
        # Not if AI is repeating (which would be our bug, not a loop)
        return most_common_count >= 3
    
    def get_loop_breaking_response(self) -> str:
        """
        Get a response to break out of a conversation loop
        
        Returns:
            Direct response to break the loop
        """
        return """Okay, I notice we're going in circles here 😅 

Let's reset. What do you actually want to talk about or do? I'm here to help, but I need to know what you need."""


# Global instance
_human_logic_instance = None

def get_human_logic() -> HumanResponseLogic:
    """Get global human response logic instance"""
    global _human_logic_instance
    if _human_logic_instance is None:
        _human_logic_instance = HumanResponseLogic()
    return _human_logic_instance
