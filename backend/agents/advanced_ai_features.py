"""
Advanced AI Features Module
Implements cutting-edge AI capabilities for personalized learning:
1. Reasoning Models - Step-by-step thinking for complex problems
2. Proactive Interventions - Real-time help triggers
3. Long-term Student Modeling - Cross-session learning patterns
4. Emotional State Tracking - Adaptive tone based on frustration/confidence
5. Learning Style Auto-Detection - Real-time adaptation
"""

import logging
import json
import re
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)


# ==================== Enums ====================

class EmotionalState(str, Enum):
    """Detected emotional states with confidence levels"""
    CONFIDENT = "confident"
    CONFUSED = "confused"
    FRUSTRATED = "frustrated"
    CURIOUS = "curious"
    ENGAGED = "engaged"
    ANXIOUS = "anxious"
    BORED = "bored"
    OVERWHELMED = "overwhelmed"
    NEUTRAL = "neutral"


class LearningStyle(str, Enum):
    """Learning style preferences"""
    VISUAL = "visual"
    AUDITORY = "auditory"
    KINESTHETIC = "kinesthetic"
    READING_WRITING = "reading_writing"
    MULTIMODAL = "multimodal"


class InterventionType(str, Enum):
    """Types of proactive interventions"""
    CONFUSION_HELP = "confusion_help"
    FRUSTRATION_SUPPORT = "frustration_support"
    ENGAGEMENT_BOOST = "engagement_boost"
    KNOWLEDGE_GAP = "knowledge_gap"
    REVIEW_REMINDER = "review_reminder"
    ENCOURAGEMENT = "encouragement"
    BREAK_SUGGESTION = "break_suggestion"
    DIFFICULTY_ADJUSTMENT = "difficulty_adjustment"


# ==================== Data Classes ====================

@dataclass
class ReasoningStep:
    """A single step in the reasoning chain"""
    step_number: int
    thought: str
    action: str
    observation: str
    confidence: float = 0.0


@dataclass
class ReasoningTrace:
    """Complete reasoning trace for a response"""
    query: str
    steps: List[ReasoningStep] = field(default_factory=list)
    final_answer: str = ""
    total_confidence: float = 0.0
    reasoning_time_ms: float = 0.0


@dataclass
class EmotionalProfile:
    """Tracks emotional state over time"""
    current_state: EmotionalState = EmotionalState.NEUTRAL
    confidence: float = 0.5
    history: List[Dict[str, Any]] = field(default_factory=list)
    frustration_level: float = 0.0
    engagement_level: float = 0.5
    anxiety_level: float = 0.0
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class LearningStyleProfile:
    """Tracks learning style preferences"""
    primary_style: LearningStyle = LearningStyle.MULTIMODAL
    style_scores: Dict[str, float] = field(default_factory=lambda: {
        "visual": 0.25, "auditory": 0.25, "kinesthetic": 0.25, "reading_writing": 0.25
    })
    confidence: float = 0.3
    interaction_count: int = 0
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class StudentModel:
    """Comprehensive long-term student model"""
    user_id: str
    emotional_profile: EmotionalProfile = field(default_factory=EmotionalProfile)
    learning_style: LearningStyleProfile = field(default_factory=LearningStyleProfile)
    
    # Knowledge state
    mastery_levels: Dict[str, float] = field(default_factory=dict)
    knowledge_gaps: List[str] = field(default_factory=list)
    strengths: List[str] = field(default_factory=list)
    
    # Behavioral patterns
    avg_session_duration: float = 30.0
    preferred_study_times: List[int] = field(default_factory=list)
    response_time_avg: float = 5.0
    question_frequency: float = 0.5
    
    # Engagement metrics
    total_sessions: int = 0
    total_interactions: int = 0
    streak_days: int = 0
    last_active: datetime = field(default_factory=datetime.utcnow)
    
    # Intervention history
    interventions_received: List[Dict[str, Any]] = field(default_factory=list)
    intervention_effectiveness: Dict[str, float] = field(default_factory=dict)


@dataclass
class ProactiveIntervention:
    """A proactive intervention to help the student"""
    intervention_type: InterventionType
    message: str
    priority: float
    trigger_reason: str
    suggested_actions: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)


# ==================== Reasoning Engine ====================

class ReasoningEngine:
    """
    Implements Large Reasoning Model (LRM) capabilities.
    Generates step-by-step reasoning traces for complex problems.
    """
    
    REASONING_PROMPT = """You are an expert tutor using step-by-step reasoning.

PROBLEM: {query}

Think through this step-by-step:

<thinking>
Step 1: [Understand the problem]
- What is being asked?
- What concepts are involved?

Step 2: [Recall relevant knowledge]
- What do I know about this topic?
- What are the key principles?

Step 3: [Plan the approach]
- How should I explain this?
- What examples would help?

Step 4: [Execute the explanation]
- Provide clear, structured explanation
- Use appropriate level of detail

Step 5: [Verify and refine]
- Is this clear and accurate?
- What might still be confusing?
</thinking>

<answer>
[Your final, polished response to the student]
</answer>

STUDENT CONTEXT:
- Learning style: {learning_style}
- Current emotional state: {emotional_state}
- Known struggles: {struggles}
- Difficulty level: {difficulty}

Provide your response:"""

    MATH_REASONING_PROMPT = """You are a math tutor showing your work step-by-step.

PROBLEM: {query}

<thinking>
1. Identify what we're solving for
2. List known information
3. Choose the right approach/formula
4. Work through each step
5. Verify the answer
</thinking>

<work>
[Show detailed mathematical work with LaTeX]
</work>

<answer>
[Final answer with explanation]
</answer>

Student level: {difficulty}
Show work appropriate for this level."""

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def generate_with_reasoning(
        self,
        query: str,
        context: Dict[str, Any] = None,
        show_thinking: bool = True
    ) -> ReasoningTrace:
        """Generate response with full reasoning trace"""
        import time
        start_time = time.time()
        
        context = context or {}
        
        # Determine if this is a math problem
        is_math = self._is_math_problem(query)
        
        if is_math:
            prompt = self.MATH_REASONING_PROMPT.format(
                query=query,
                difficulty=context.get("difficulty_level", "intermediate")
            )
        else:
            prompt = self.REASONING_PROMPT.format(
                query=query,
                learning_style=context.get("learning_style", "multimodal"),
                emotional_state=context.get("emotional_state", "neutral"),
                struggles=", ".join(context.get("struggles", [])[:3]) or "none identified",
                difficulty=context.get("difficulty_level", "intermediate")
            )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
            
            # Parse the response
            trace = self._parse_reasoning_response(query, response)
            trace.reasoning_time_ms = (time.time() - start_time) * 1000
            
            return trace
            
        except Exception as e:
            logger.error(f"Reasoning generation failed: {e}")
            return ReasoningTrace(
                query=query,
                final_answer=f"I'd be happy to help with that. Could you tell me more about what you're trying to understand?",
                total_confidence=0.3
            )
    
    def _is_math_problem(self, query: str) -> bool:
        """Detect if query is a math problem"""
        math_indicators = [
            r'\d+\s*[\+\-\*\/\=]',  # Numbers with operators
            r'solve', r'calculate', r'compute', r'find the value',
            r'equation', r'formula', r'derivative', r'integral',
            r'x\s*=', r'y\s*=', r'\^', r'sqrt', r'log'
        ]
        query_lower = query.lower()
        return any(re.search(pattern, query_lower) for pattern in math_indicators)
    
    def _parse_reasoning_response(self, query: str, response: str) -> ReasoningTrace:
        """Parse AI response into structured reasoning trace"""
        trace = ReasoningTrace(query=query)
        
        # Extract thinking section
        thinking_match = re.search(r'<thinking>(.*?)</thinking>', response, re.DOTALL)
        if thinking_match:
            thinking = thinking_match.group(1).strip()
            # Parse steps
            step_pattern = r'(?:Step\s*\d+|[\d]+\.)\s*[:\-]?\s*(.+?)(?=(?:Step\s*\d+|[\d]+\.|</thinking>|$))'
            steps = re.findall(step_pattern, thinking, re.DOTALL | re.IGNORECASE)
            
            for i, step_text in enumerate(steps, 1):
                trace.steps.append(ReasoningStep(
                    step_number=i,
                    thought=step_text.strip()[:500],
                    action="reasoning",
                    observation="",
                    confidence=0.8
                ))
        
        # Extract answer section
        answer_match = re.search(r'<answer>(.*?)</answer>', response, re.DOTALL)
        if answer_match:
            trace.final_answer = answer_match.group(1).strip()
        else:
            # Fall back to full response if no tags
            trace.final_answer = response.strip()
        
        # Calculate confidence based on reasoning depth
        trace.total_confidence = min(0.95, 0.5 + (len(trace.steps) * 0.1))
        
        return trace


# ==================== Emotional Intelligence Engine ====================

class EmotionalIntelligenceEngine:
    """
    Tracks and responds to student emotional states.
    Adapts tone and approach based on detected emotions.
    """
    
    # Emotional indicators in text
    EMOTION_PATTERNS = {
        EmotionalState.FRUSTRATED: [
            r"i give up", r"this is (so )?hard", r"i can't", r"impossible",
            r"hate this", r"doesn't make sense", r"ugh+", r"argh",
            r"frustrated", r"annoying", r"stupid", r"waste of time"
        ],
        EmotionalState.CONFUSED: [
            r"don't understand", r"confused", r"what does .+ mean",
            r"i'm lost", r"not sure", r"don't get it", r"unclear",
            r"huh\??", r"\?\?\?+", r"what\?+", r"i thought .+ but"
        ],
        EmotionalState.ANXIOUS: [
            r"worried", r"nervous", r"scared", r"afraid",
            r"exam", r"test tomorrow", r"deadline", r"running out of time",
            r"panic", r"stress"
        ],
        EmotionalState.CURIOUS: [
            r"interesting", r"tell me more", r"what about",
            r"how does .+ work", r"why does", r"what if",
            r"curious", r"wonder", r"fascinating"
        ],
        EmotionalState.CONFIDENT: [
            r"i got it", r"makes sense", r"understand now",
            r"easy", r"simple", r"i know", r"of course",
            r"obviously", r"clearly"
        ],
        EmotionalState.BORED: [
            r"boring", r"whatever", r"don't care",
            r"too easy", r"already know", r"skip"
        ],
        EmotionalState.OVERWHELMED: [
            r"too much", r"overwhelming", r"can't keep up",
            r"so many", r"information overload", r"slow down"
        ]
    }
    
    # Tone adaptations for each emotional state
    TONE_ADAPTATIONS = {
        EmotionalState.FRUSTRATED: {
            "tone": "patient and encouraging",
            "approach": "simplify and break down",
            "phrases": ["Let's take this step by step", "I understand this is challenging", "You're making progress"],
            "avoid": ["obviously", "simply", "just", "easy"]
        },
        EmotionalState.CONFUSED: {
            "tone": "clear and supportive",
            "approach": "use analogies and examples",
            "phrases": ["Let me explain it differently", "Think of it like this", "Here's a simpler way to see it"],
            "avoid": ["as I said", "again", "clearly"]
        },
        EmotionalState.ANXIOUS: {
            "tone": "calm and reassuring",
            "approach": "focus on manageable steps",
            "phrases": ["You've got this", "Let's focus on one thing at a time", "Take a breath"],
            "avoid": ["hurry", "quickly", "deadline", "must"]
        },
        EmotionalState.CURIOUS: {
            "tone": "enthusiastic and exploratory",
            "approach": "dive deeper, share interesting facts",
            "phrases": ["Great question!", "Here's something fascinating", "Let's explore that"],
            "avoid": ["basic", "simple", "just"]
        },
        EmotionalState.CONFIDENT: {
            "tone": "challenging and engaging",
            "approach": "push further, introduce complexity",
            "phrases": ["Ready for a challenge?", "Let's take it further", "Here's an advanced concept"],
            "avoid": ["let me explain", "basically"]
        },
        EmotionalState.BORED: {
            "tone": "engaging and dynamic",
            "approach": "make it interesting, real-world examples",
            "phrases": ["Here's why this matters", "Check this out", "Real-world application"],
            "avoid": ["let's review", "as we discussed"]
        },
        EmotionalState.OVERWHELMED: {
            "tone": "calm and structured",
            "approach": "prioritize, reduce scope",
            "phrases": ["Let's focus on the essentials", "One thing at a time", "Here's what matters most"],
            "avoid": ["also", "additionally", "furthermore", "moreover"]
        },
        EmotionalState.NEUTRAL: {
            "tone": "friendly and helpful",
            "approach": "balanced explanation",
            "phrases": ["Let me help with that", "Here's how it works"],
            "avoid": []
        }
    }
    
    def __init__(self):
        self.profiles: Dict[str, EmotionalProfile] = {}
    
    def detect_emotion(self, text: str, user_id: str = None) -> Tuple[EmotionalState, float]:
        """Detect emotional state from text with confidence score"""
        text_lower = text.lower()
        scores = defaultdict(float)
        
        for emotion, patterns in self.EMOTION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    scores[emotion] += 1.0
        
        # Normalize and find dominant emotion
        if scores:
            max_emotion = max(scores.items(), key=lambda x: x[1])
            confidence = min(0.95, max_emotion[1] / 3.0)  # Cap at 0.95
            detected = max_emotion[0]
        else:
            detected = EmotionalState.NEUTRAL
            confidence = 0.5
        
        # Update profile if user_id provided
        if user_id:
            self._update_profile(user_id, detected, confidence, text)
        
        return detected, confidence
    
    def _update_profile(self, user_id: str, emotion: EmotionalState, confidence: float, text: str):
        """Update user's emotional profile"""
        if user_id not in self.profiles:
            self.profiles[user_id] = EmotionalProfile()
        
        profile = self.profiles[user_id]
        profile.current_state = emotion
        profile.confidence = confidence
        profile.last_updated = datetime.utcnow()
        
        # Update history (keep last 20)
        profile.history.append({
            "emotion": emotion.value,
            "confidence": confidence,
            "timestamp": datetime.utcnow().isoformat(),
            "text_snippet": text[:100]
        })
        profile.history = profile.history[-20:]
        
        # Update aggregate metrics
        if emotion == EmotionalState.FRUSTRATED:
            profile.frustration_level = min(1.0, profile.frustration_level + 0.2)
        else:
            profile.frustration_level = max(0.0, profile.frustration_level - 0.05)
        
        if emotion in [EmotionalState.CURIOUS, EmotionalState.ENGAGED, EmotionalState.CONFIDENT]:
            profile.engagement_level = min(1.0, profile.engagement_level + 0.1)
        elif emotion in [EmotionalState.BORED, EmotionalState.FRUSTRATED]:
            profile.engagement_level = max(0.0, profile.engagement_level - 0.1)
        
        if emotion in [EmotionalState.ANXIOUS, EmotionalState.OVERWHELMED]:
            profile.anxiety_level = min(1.0, profile.anxiety_level + 0.15)
        else:
            profile.anxiety_level = max(0.0, profile.anxiety_level - 0.05)
    
    def get_tone_adaptation(self, emotion: EmotionalState) -> Dict[str, Any]:
        """Get tone adaptation guidelines for an emotional state"""
        return self.TONE_ADAPTATIONS.get(emotion, self.TONE_ADAPTATIONS[EmotionalState.NEUTRAL])
    
    def get_profile(self, user_id: str) -> EmotionalProfile:
        """Get or create emotional profile for user"""
        if user_id not in self.profiles:
            self.profiles[user_id] = EmotionalProfile()
        return self.profiles[user_id]
    
    def should_intervene(self, user_id: str) -> Optional[InterventionType]:
        """Check if emotional state warrants intervention"""
        profile = self.get_profile(user_id)
        
        if profile.frustration_level > 0.7:
            return InterventionType.FRUSTRATION_SUPPORT
        if profile.anxiety_level > 0.6:
            return InterventionType.BREAK_SUGGESTION
        if profile.engagement_level < 0.3:
            return InterventionType.ENGAGEMENT_BOOST
        
        return None


# ==================== Learning Style Detector ====================

class LearningStyleDetector:
    """
    Real-time learning style detection and adaptation.
    Analyzes interaction patterns to determine preferred learning modalities.
    """
    
    # Indicators for each learning style
    STYLE_INDICATORS = {
        LearningStyle.VISUAL: {
            "keywords": ["show", "diagram", "chart", "picture", "image", "graph", 
                        "visualize", "see", "look", "color", "shape", "draw"],
            "request_patterns": [r"can you show", r"draw .+", r"visualize", r"diagram of"],
            "preference_signals": ["prefers_diagrams", "uses_highlighting", "spatial_learner"]
        },
        LearningStyle.AUDITORY: {
            "keywords": ["explain", "tell", "describe", "say", "hear", "listen",
                        "sounds like", "talk through", "discuss", "verbal"],
            "request_patterns": [r"explain .+ to me", r"tell me about", r"can you describe"],
            "preference_signals": ["prefers_discussion", "talks_through_problems"]
        },
        LearningStyle.KINESTHETIC: {
            "keywords": ["try", "practice", "do", "hands-on", "example", "exercise",
                        "experiment", "build", "create", "apply", "work through"],
            "request_patterns": [r"let me try", r"can i practice", r"give me .+ exercise"],
            "preference_signals": ["learns_by_doing", "needs_practice", "active_learner"]
        },
        LearningStyle.READING_WRITING: {
            "keywords": ["read", "write", "text", "notes", "document", "article",
                        "list", "definition", "summary", "outline"],
            "request_patterns": [r"can you write", r"give me .+ notes", r"summarize"],
            "preference_signals": ["takes_notes", "prefers_text", "reads_documentation"]
        }
    }
    
    # Content adaptations for each style
    STYLE_ADAPTATIONS = {
        LearningStyle.VISUAL: {
            "format": "Use diagrams, charts, and visual representations",
            "structure": "Organize with clear visual hierarchy",
            "examples": "Include visual examples and flowcharts",
            "emphasis": "Use formatting (bold, bullets) for visual scanning"
        },
        LearningStyle.AUDITORY: {
            "format": "Use conversational, narrative explanations",
            "structure": "Explain concepts as if speaking aloud",
            "examples": "Use verbal analogies and stories",
            "emphasis": "Repeat key points in different ways"
        },
        LearningStyle.KINESTHETIC: {
            "format": "Provide hands-on exercises and practice problems",
            "structure": "Step-by-step instructions to follow along",
            "examples": "Real-world applications and experiments",
            "emphasis": "Interactive elements and try-it-yourself sections"
        },
        LearningStyle.READING_WRITING: {
            "format": "Detailed written explanations with definitions",
            "structure": "Well-organized text with clear sections",
            "examples": "Written case studies and documentation",
            "emphasis": "Comprehensive notes and summaries"
        },
        LearningStyle.MULTIMODAL: {
            "format": "Mix of visual, verbal, and practical elements",
            "structure": "Varied presentation styles",
            "examples": "Multiple types of examples",
            "emphasis": "Balanced approach"
        }
    }
    
    def __init__(self):
        self.profiles: Dict[str, LearningStyleProfile] = {}
    
    def analyze_interaction(self, text: str, user_id: str) -> LearningStyleProfile:
        """Analyze interaction to update learning style profile"""
        if user_id not in self.profiles:
            self.profiles[user_id] = LearningStyleProfile()
        
        profile = self.profiles[user_id]
        text_lower = text.lower()
        
        # Score each style based on indicators
        style_hits = defaultdict(float)
        
        for style, indicators in self.STYLE_INDICATORS.items():
            # Check keywords
            for keyword in indicators["keywords"]:
                if keyword in text_lower:
                    style_hits[style.value] += 0.5
            
            # Check patterns
            for pattern in indicators["request_patterns"]:
                if re.search(pattern, text_lower):
                    style_hits[style.value] += 1.0
        
        # Update profile scores with exponential moving average
        alpha = 0.1  # Learning rate
        for style_name, hit_score in style_hits.items():
            if hit_score > 0:
                current = profile.style_scores.get(style_name, 0.25)
                profile.style_scores[style_name] = current + alpha * (hit_score - current)
        
        # Normalize scores
        total = sum(profile.style_scores.values())
        if total > 0:
            profile.style_scores = {k: v/total for k, v in profile.style_scores.items()}
        
        # Update primary style
        max_style = max(profile.style_scores.items(), key=lambda x: x[1])
        if max_style[1] > 0.35:  # Threshold for dominant style
            profile.primary_style = LearningStyle(max_style[0])
            profile.confidence = min(0.95, max_style[1] + 0.2)
        else:
            profile.primary_style = LearningStyle.MULTIMODAL
            profile.confidence = 0.5
        
        profile.interaction_count += 1
        profile.last_updated = datetime.utcnow()
        
        return profile
    
    def get_adaptation(self, user_id: str) -> Dict[str, str]:
        """Get content adaptation guidelines for user's learning style"""
        profile = self.profiles.get(user_id, LearningStyleProfile())
        return self.STYLE_ADAPTATIONS.get(
            profile.primary_style, 
            self.STYLE_ADAPTATIONS[LearningStyle.MULTIMODAL]
        )
    
    def get_profile(self, user_id: str) -> LearningStyleProfile:
        """Get or create learning style profile"""
        if user_id not in self.profiles:
            self.profiles[user_id] = LearningStyleProfile()
        return self.profiles[user_id]


# ==================== Proactive Intervention Engine ====================

class ProactiveInterventionEngine:
    """
    Real-time detection of when students need help.
    Triggers proactive interventions based on behavioral signals.
    """
    
    # Intervention thresholds
    THRESHOLDS = {
        "confusion_consecutive": 2,      # Consecutive confused messages
        "wrong_answers_streak": 3,       # Wrong answers in a row
        "response_time_slow": 60,        # Seconds - indicates struggle
        "session_duration_long": 90,     # Minutes - suggest break
        "engagement_drop": 0.3,          # Engagement level threshold
        "frustration_high": 0.6,         # Frustration level threshold
    }
    
    # Intervention messages
    INTERVENTION_TEMPLATES = {
        InterventionType.CONFUSION_HELP: [
            "I notice you might be finding this tricky. Would you like me to explain it differently?",
            "Let me try a different approach to help clarify this concept.",
            "This is a common sticking point. Let's break it down together."
        ],
        InterventionType.FRUSTRATION_SUPPORT: [
            "I can see this is challenging. Remember, struggling is part of learning!",
            "Let's take a step back and approach this from a different angle.",
            "You're doing great - this topic trips up a lot of people. Let me help."
        ],
        InterventionType.ENGAGEMENT_BOOST: [
            "Here's something interesting about this topic that might surprise you...",
            "Want to try a quick challenge to test what you've learned?",
            "Let's make this more interactive - what questions do you have?"
        ],
        InterventionType.KNOWLEDGE_GAP: [
            "I noticed you might benefit from reviewing {topic} first. Want me to help?",
            "This builds on {topic}. Let's make sure that foundation is solid.",
            "Quick check: are you comfortable with {topic}? It'll help with this."
        ],
        InterventionType.REVIEW_REMINDER: [
            "It's been a while since you studied {topic}. A quick review could help!",
            "Your {topic} knowledge might be getting rusty. Want a refresher?",
            "Perfect time to reinforce {topic} - spaced repetition works!"
        ],
        InterventionType.ENCOURAGEMENT: [
            "You're making great progress! Keep it up!",
            "I can see you're really getting the hang of this.",
            "Your understanding has improved so much - well done!"
        ],
        InterventionType.BREAK_SUGGESTION: [
            "You've been studying for a while. A short break might help you absorb this better.",
            "Your brain needs rest to consolidate learning. How about a 5-minute break?",
            "Studies show breaks improve retention. Ready for a quick pause?"
        ],
        InterventionType.DIFFICULTY_ADJUSTMENT: [
            "This seems a bit challenging. Want me to simplify the explanations?",
            "You're handling this well! Ready for something more advanced?",
            "Let me adjust the difficulty to match your current level."
        ]
    }
    
    def __init__(self, emotional_engine: EmotionalIntelligenceEngine = None):
        self.emotional_engine = emotional_engine or EmotionalIntelligenceEngine()
        self.user_states: Dict[str, Dict[str, Any]] = {}
    
    def _get_user_state(self, user_id: str) -> Dict[str, Any]:
        """Get or initialize user state tracking"""
        if user_id not in self.user_states:
            self.user_states[user_id] = {
                "confusion_streak": 0,
                "wrong_answer_streak": 0,
                "last_response_time": None,
                "session_start": datetime.utcnow(),
                "interactions_count": 0,
                "last_intervention": None,
                "intervention_cooldown": timedelta(minutes=5)
            }
        return self.user_states[user_id]
    
    def track_interaction(
        self,
        user_id: str,
        message: str,
        response_time_seconds: float = None,
        was_correct: bool = None,
        topic: str = None
    ) -> Optional[ProactiveIntervention]:
        """Track interaction and check if intervention is needed"""
        state = self._get_user_state(user_id)
        state["interactions_count"] += 1
        
        # Detect emotion
        emotion, confidence = self.emotional_engine.detect_emotion(message, user_id)
        
        # Update streaks
        if emotion == EmotionalState.CONFUSED:
            state["confusion_streak"] += 1
        else:
            state["confusion_streak"] = 0
        
        if was_correct is not None:
            if not was_correct:
                state["wrong_answer_streak"] += 1
            else:
                state["wrong_answer_streak"] = 0
        
        if response_time_seconds:
            state["last_response_time"] = response_time_seconds
        
        # Check for intervention triggers
        intervention = self._check_triggers(user_id, state, emotion, topic)
        
        if intervention:
            # Check cooldown
            last = state.get("last_intervention")
            if last and datetime.utcnow() - last < state["intervention_cooldown"]:
                return None
            
            state["last_intervention"] = datetime.utcnow()
            return intervention
        
        return None
    
    def _check_triggers(
        self,
        user_id: str,
        state: Dict[str, Any],
        emotion: EmotionalState,
        topic: str = None
    ) -> Optional[ProactiveIntervention]:
        """Check all intervention triggers"""
        import random
        
        # 1. Confusion streak
        if state["confusion_streak"] >= self.THRESHOLDS["confusion_consecutive"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.CONFUSION_HELP,
                message=random.choice(self.INTERVENTION_TEMPLATES[InterventionType.CONFUSION_HELP]),
                priority=0.8,
                trigger_reason="Multiple confused messages detected",
                suggested_actions=["Simplify explanation", "Use different analogy", "Break into smaller steps"]
            )
        
        # 2. Wrong answer streak
        if state["wrong_answer_streak"] >= self.THRESHOLDS["wrong_answers_streak"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.KNOWLEDGE_GAP,
                message=random.choice(self.INTERVENTION_TEMPLATES[InterventionType.KNOWLEDGE_GAP]).format(topic=topic or "the prerequisites"),
                priority=0.7,
                trigger_reason="Multiple incorrect answers",
                suggested_actions=["Review prerequisites", "Provide simpler examples", "Offer practice problems"],
                context={"topic": topic}
            )
        
        # 3. Frustration detection
        profile = self.emotional_engine.get_profile(user_id)
        if profile.frustration_level > self.THRESHOLDS["frustration_high"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.FRUSTRATION_SUPPORT,
                message=random.choice(self.INTERVENTION_TEMPLATES[InterventionType.FRUSTRATION_SUPPORT]),
                priority=0.9,
                trigger_reason="High frustration level detected",
                suggested_actions=["Acknowledge difficulty", "Offer encouragement", "Simplify approach"]
            )
        
        # 4. Long session - suggest break
        session_duration = (datetime.utcnow() - state["session_start"]).total_seconds() / 60
        if session_duration > self.THRESHOLDS["session_duration_long"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.BREAK_SUGGESTION,
                message=random.choice(self.INTERVENTION_TEMPLATES[InterventionType.BREAK_SUGGESTION]),
                priority=0.5,
                trigger_reason=f"Session duration: {session_duration:.0f} minutes",
                suggested_actions=["Suggest 5-10 minute break", "Offer to save progress"]
            )
        
        # 5. Low engagement
        if profile.engagement_level < self.THRESHOLDS["engagement_drop"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.ENGAGEMENT_BOOST,
                message=random.choice(self.INTERVENTION_TEMPLATES[InterventionType.ENGAGEMENT_BOOST]),
                priority=0.6,
                trigger_reason="Low engagement detected",
                suggested_actions=["Make content more interactive", "Add interesting facts", "Offer challenge"]
            )
        
        # 6. Slow response time (struggling)
        if state.get("last_response_time") and state["last_response_time"] > self.THRESHOLDS["response_time_slow"]:
            return ProactiveIntervention(
                intervention_type=InterventionType.DIFFICULTY_ADJUSTMENT,
                message="Take your time! Would you like me to break this down into smaller steps?",
                priority=0.5,
                trigger_reason="Long response time indicates struggle",
                suggested_actions=["Offer hints", "Simplify question", "Provide scaffolding"]
            )
        
        return None
    
    def get_encouragement(self, user_id: str) -> Optional[str]:
        """Get an encouragement message if appropriate"""
        import random
        profile = self.emotional_engine.get_profile(user_id)
        
        # Only encourage if engagement is good and not frustrated
        if profile.engagement_level > 0.6 and profile.frustration_level < 0.3:
            if random.random() < 0.1:  # 10% chance
                return random.choice(self.INTERVENTION_TEMPLATES[InterventionType.ENCOURAGEMENT])
        
        return None


# ==================== Long-Term Student Modeler ====================

class LongTermStudentModeler:
    """
    Builds and maintains comprehensive long-term student models.
    Tracks patterns across sessions for personalized learning.
    """
    
    def __init__(
        self,
        emotional_engine: EmotionalIntelligenceEngine = None,
        style_detector: LearningStyleDetector = None,
        db_session_factory = None
    ):
        self.emotional_engine = emotional_engine or EmotionalIntelligenceEngine()
        self.style_detector = style_detector or LearningStyleDetector()
        self.db_session_factory = db_session_factory
        self.models: Dict[str, StudentModel] = {}
    
    def get_model(self, user_id: str) -> StudentModel:
        """Get or create student model"""
        if user_id not in self.models:
            self.models[user_id] = StudentModel(user_id=user_id)
            # Try to load from database
            self._load_from_db(user_id)
        return self.models[user_id]
    
    def _load_from_db(self, user_id: str):
        """Load student model data from database"""
        if not self.db_session_factory:
            return
        
        try:
            db = self.db_session_factory()
            model = self.models[user_id]
            
            # Load from various tables
            from models import (
                User, ComprehensiveUserProfile, TopicMastery,
                DailyLearningMetrics, Activity
            )
            
            user_id_int = int(user_id) if user_id.isdigit() else 0
            
            # Get user profile
            profile = db.query(ComprehensiveUserProfile).filter(
                ComprehensiveUserProfile.user_id == user_id_int
            ).first()
            
            if profile:
                model.learning_style.primary_style = LearningStyle(
                    profile.learning_style or "multimodal"
                ) if profile.learning_style in [s.value for s in LearningStyle] else LearningStyle.MULTIMODAL
            
            # Get mastery levels
            masteries = db.query(TopicMastery).filter(
                TopicMastery.user_id == user_id_int
            ).all()
            
            for m in masteries:
                model.mastery_levels[m.topic_name] = m.mastery_level
                if m.mastery_level < 0.4:
                    model.knowledge_gaps.append(m.topic_name)
                elif m.mastery_level > 0.7:
                    model.strengths.append(m.topic_name)
            
            # Get learning metrics
            metrics = db.query(DailyLearningMetrics).filter(
                DailyLearningMetrics.user_id == user_id_int
            ).order_by(DailyLearningMetrics.date.desc()).limit(30).all()
            
            if metrics:
                model.total_sessions = len(metrics)
                model.avg_session_duration = np.mean([m.time_spent_minutes for m in metrics])
                
                # Calculate streak
                today = datetime.now(timezone.utc).date()
                streak = 0
                for m in metrics:
                    if m.date == today - timedelta(days=streak):
                        streak += 1
                    else:
                        break
                model.streak_days = streak
            
            db.close()
            logger.info(f"Loaded student model for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to load student model: {e}")
    
    def update_from_interaction(
        self,
        user_id: str,
        message: str,
        response_time: float = None,
        topic: str = None,
        was_correct: bool = None
    ):
        """Update student model from an interaction"""
        model = self.get_model(user_id)
        
        # Update emotional profile
        emotion, confidence = self.emotional_engine.detect_emotion(message, user_id)
        model.emotional_profile = self.emotional_engine.get_profile(user_id)
        
        # Update learning style
        self.style_detector.analyze_interaction(message, user_id)
        model.learning_style = self.style_detector.get_profile(user_id)
        
        # Update interaction counts
        model.total_interactions += 1
        model.last_active = datetime.utcnow()
        
        # Update response time average
        if response_time:
            model.response_time_avg = (
                model.response_time_avg * 0.9 + response_time * 0.1
            )
        
        # Update mastery if topic provided
        if topic and was_correct is not None:
            current = model.mastery_levels.get(topic, 0.5)
            delta = 0.05 if was_correct else -0.03
            model.mastery_levels[topic] = max(0.0, min(1.0, current + delta))
            
            # Update gaps and strengths
            if model.mastery_levels[topic] < 0.4 and topic not in model.knowledge_gaps:
                model.knowledge_gaps.append(topic)
            elif model.mastery_levels[topic] >= 0.4 and topic in model.knowledge_gaps:
                model.knowledge_gaps.remove(topic)
            
            if model.mastery_levels[topic] > 0.7 and topic not in model.strengths:
                model.strengths.append(topic)
    
    def get_personalization_context(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive personalization context for AI prompts"""
        model = self.get_model(user_id)
        
        return {
            # Emotional context
            "emotional_state": model.emotional_profile.current_state.value,
            "frustration_level": model.emotional_profile.frustration_level,
            "engagement_level": model.emotional_profile.engagement_level,
            "anxiety_level": model.emotional_profile.anxiety_level,
            
            # Learning style
            "learning_style": model.learning_style.primary_style.value,
            "style_confidence": model.learning_style.confidence,
            "style_scores": model.learning_style.style_scores,
            
            # Knowledge state
            "mastery_levels": model.mastery_levels,
            "knowledge_gaps": model.knowledge_gaps[:5],
            "strengths": model.strengths[:5],
            
            # Behavioral patterns
            "avg_session_duration": model.avg_session_duration,
            "response_time_avg": model.response_time_avg,
            "streak_days": model.streak_days,
            "total_interactions": model.total_interactions,
            
            # Tone adaptation
            "tone_adaptation": self.emotional_engine.get_tone_adaptation(
                model.emotional_profile.current_state
            ),
            
            # Content adaptation
            "content_adaptation": self.style_detector.get_adaptation(user_id)
        }
    
    def save_to_db(self, user_id: str):
        """Persist student model to database"""
        if not self.db_session_factory:
            return
        
        try:
            model = self.get_model(user_id)
            db = self.db_session_factory()
            
            # Save to appropriate tables
            # This would update ComprehensiveUserProfile, TopicMastery, etc.
            # Implementation depends on your exact schema
            
            db.commit()
            db.close()
            logger.info(f"Saved student model for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to save student model: {e}")


# ==================== Unified Advanced AI System ====================

class AdvancedAISystem:
    """
    Unified system integrating all advanced AI features.
    Provides a single interface for the chat agent to use.
    """
    
    def __init__(self, ai_client, db_session_factory=None):
        self.ai_client = ai_client
        self.db_session_factory = db_session_factory
        
        # Initialize components
        self.reasoning_engine = ReasoningEngine(ai_client)
        self.emotional_engine = EmotionalIntelligenceEngine()
        self.style_detector = LearningStyleDetector()
        self.intervention_engine = ProactiveInterventionEngine(self.emotional_engine)
        self.student_modeler = LongTermStudentModeler(
            self.emotional_engine,
            self.style_detector,
            db_session_factory
        )
    
    async def process_with_advanced_features(
        self,
        user_id: str,
        message: str,
        context: Dict[str, Any] = None,
        response_time: float = None,
        topic: str = None
    ) -> Dict[str, Any]:
        """
        Process a message with all advanced AI features.
        Returns enhanced context and any interventions.
        """
        context = context or {}
        
        # 1. Update student model
        self.student_modeler.update_from_interaction(
            user_id, message, response_time, topic
        )
        
        # 2. Get personalization context
        personalization = self.student_modeler.get_personalization_context(user_id)
        
        # 3. Check for proactive interventions
        intervention = self.intervention_engine.track_interaction(
            user_id, message, response_time, topic=topic
        )
        
        # 4. Determine if reasoning trace is needed
        needs_reasoning = self._needs_reasoning(message, context)
        reasoning_trace = None
        
        if needs_reasoning:
            reasoning_trace = self.reasoning_engine.generate_with_reasoning(
                message,
                {**context, **personalization}
            )
        
        # 5. Build enhanced context
        enhanced_context = {
            **context,
            **personalization,
            "reasoning_trace": asdict(reasoning_trace) if reasoning_trace else None,
            "intervention": asdict(intervention) if intervention else None,
            "encouragement": self.intervention_engine.get_encouragement(user_id)
        }
        
        return enhanced_context
    
    def _needs_reasoning(self, message: str, context: Dict) -> bool:
        """Determine if message needs step-by-step reasoning"""
        # Complex questions benefit from reasoning
        complexity_indicators = [
            r"why does", r"how does .+ work", r"explain .+ step",
            r"solve", r"calculate", r"prove", r"derive",
            r"compare .+ and", r"what's the difference"
        ]
        
        message_lower = message.lower()
        return any(re.search(p, message_lower) for p in complexity_indicators)
    
    def get_system_prompt_enhancement(self, user_id: str) -> str:
        """Get system prompt enhancement based on student model"""
        personalization = self.student_modeler.get_personalization_context(user_id)
        
        tone = personalization.get("tone_adaptation", {})
        content = personalization.get("content_adaptation", {})
        
        enhancement = f"""
## PERSONALIZATION CONTEXT

### Emotional Adaptation
- Current state: {personalization.get('emotional_state', 'neutral')}
- Tone: {tone.get('tone', 'friendly and helpful')}
- Approach: {tone.get('approach', 'balanced explanation')}
- Use phrases like: {', '.join(tone.get('phrases', [])[:2])}
- Avoid: {', '.join(tone.get('avoid', [])[:2])}

### Learning Style Adaptation
- Primary style: {personalization.get('learning_style', 'multimodal')}
- Format: {content.get('format', 'balanced approach')}
- Structure: {content.get('structure', 'clear organization')}
- Examples: {content.get('examples', 'varied examples')}

### Knowledge Context
- Strengths: {', '.join(personalization.get('strengths', [])[:3]) or 'exploring'}
- Areas to support: {', '.join(personalization.get('knowledge_gaps', [])[:3]) or 'none identified'}
- Engagement level: {personalization.get('engagement_level', 0.5):.0%}

### Behavioral Insights
- Learning streak: {personalization.get('streak_days', 0)} days
- Session interactions: {personalization.get('total_interactions', 0)}
"""
        return enhancement


# ==================== Factory Function ====================

_advanced_ai_system: Optional[AdvancedAISystem] = None

def get_advanced_ai_system(ai_client=None, db_session_factory=None) -> AdvancedAISystem:
    """Get or create the advanced AI system singleton"""
    global _advanced_ai_system
    
    if _advanced_ai_system is None and ai_client:
        _advanced_ai_system = AdvancedAISystem(ai_client, db_session_factory)
    
    return _advanced_ai_system


def initialize_advanced_ai(ai_client, db_session_factory=None) -> AdvancedAISystem:
    """Initialize the advanced AI system"""
    global _advanced_ai_system
    _advanced_ai_system = AdvancedAISystem(ai_client, db_session_factory)
    logger.info("Advanced AI System initialized")
    return _advanced_ai_system
