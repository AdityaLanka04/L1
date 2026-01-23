"""
Smart AI Model Router
Routes queries to the best model based on complexity and task type
"""

import logging
import os
from typing import Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class QueryComplexity(Enum):
    """Query complexity levels"""
    SIMPLE = "simple"           # Facts, definitions
    MODERATE = "moderate"       # Explanations, examples
    COMPLEX = "complex"         # Multi-step reasoning, analysis
    CREATIVE = "creative"       # Generation, brainstorming


class TaskType(Enum):
    """Types of AI tasks"""
    CHAT = "chat"
    EXPLANATION = "explanation"
    FLASHCARD_GEN = "flashcard_generation"
    QUIZ_GEN = "quiz_generation"
    REASONING = "reasoning"
    ANALYSIS = "analysis"
    GENERATION = "generation"


class SmartAIRouter:
    """
    Routes queries to optimal models based on:
    - Query complexity
    - Task type
    - Performance requirements
    - Cost optimization
    """
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
        
        # Model configurations
        self.models = {
            "fast": os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            "thinking": os.getenv("GEMINI_THINKING_MODEL", "gemini-2.0-flash-thinking-exp"),
            "groq": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        }
        
        # Complexity indicators
        self.complex_indicators = [
            "why", "how does", "explain the relationship", "compare",
            "analyze", "evaluate", "prove", "derive", "calculate",
            "step by step", "reasoning", "logic", "solve", "problem"
        ]
        
        self.simple_indicators = [
            "what is", "define", "list", "name", "when", "who",
            "yes or no", "true or false"
        ]
    
    def detect_complexity(self, query: str) -> QueryComplexity:
        """Detect query complexity from content"""
        query_lower = query.lower()
        
        # Check for complex indicators
        complex_count = sum(1 for indicator in self.complex_indicators if indicator in query_lower)
        simple_count = sum(1 for indicator in self.simple_indicators if indicator in query_lower)
        
        # Multi-sentence queries are usually more complex
        sentence_count = query.count('.') + query.count('?') + query.count('!')
        
        # Long queries often need more reasoning
        word_count = len(query.split())
        
        if complex_count >= 2 or word_count > 50:
            return QueryComplexity.COMPLEX
        elif complex_count >= 1 or (word_count > 20 and sentence_count > 1):
            return QueryComplexity.MODERATE
        elif simple_count >= 1 or word_count < 10:
            return QueryComplexity.SIMPLE
        else:
            return QueryComplexity.MODERATE
    
    def select_model(
        self, 
        task_type: TaskType, 
        query: str = "",
        complexity: Optional[QueryComplexity] = None
    ) -> Dict[str, Any]:
        """
        Select the optimal model for the task
    