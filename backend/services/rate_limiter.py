"""
Simple rate limiter to track API usage and prevent hitting limits
"""
import time
from collections import deque
from typing import Dict

class RateLimiter:
    """Track API calls to avoid hitting rate limits"""
    
    def __init__(self):
        self.groq_calls = deque(maxlen=100)
        self.gemini_calls = deque(maxlen=100)
    
    def can_call_groq(self) -> tuple[bool, float]:
        """
        Check if we can make a Groq API call
        Returns: (can_call, wait_seconds)
        Groq free tier: 30 requests per minute
        """
        now = time.time()
        minute_ago = now - 60
        
        while self.groq_calls and self.groq_calls[0] < minute_ago:
            self.groq_calls.popleft()
        
        if len(self.groq_calls) < 28:
            return True, 0
        
        oldest_call = self.groq_calls[0]
        wait_seconds = 60 - (now - oldest_call)
        return False, max(0, wait_seconds)
    
    def can_call_gemini(self) -> tuple[bool, float]:
        """
        Check if we can make a Gemini API call
        Returns: (can_call, wait_seconds)
        Gemini free tier: 15 requests per minute
        """
        now = time.time()
        minute_ago = now - 60
        
        while self.gemini_calls and self.gemini_calls[0] < minute_ago:
            self.gemini_calls.popleft()
        
        if len(self.gemini_calls) < 13:
            return True, 0
        
        oldest_call = self.gemini_calls[0]
        wait_seconds = 60 - (now - oldest_call)
        return False, max(0, wait_seconds)
    
    def record_groq_call(self):
        """Record a Groq API call"""
        self.groq_calls.append(time.time())
    
    def record_gemini_call(self):
        """Record a Gemini API call"""
        self.gemini_calls.append(time.time())
    
    def get_stats(self) -> Dict:
        """Get current rate limit stats"""
        now = time.time()
        minute_ago = now - 60
        
        groq_recent = sum(1 for t in self.groq_calls if t > minute_ago)
        gemini_recent = sum(1 for t in self.gemini_calls if t > minute_ago)
        
        return {
            "groq": {
                "calls_last_minute": groq_recent,
                "limit": 30,
                "remaining": max(0, 30 - groq_recent)
            },
            "gemini": {
                "calls_last_minute": gemini_recent,
                "limit": 15,
                "remaining": max(0, 15 - gemini_recent)
            }
        }

rate_limiter = RateLimiter()
