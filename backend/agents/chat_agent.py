"""
Advanced AI Chat Agent
High-capacity LangGraph-based agent for intelligent tutoring conversations
with multi-modal reasoning, adaptive responses, and deep memory integration.

Enhanced with:
- Reasoning models (step-by-step thinking)
- Proactive interventions
- Long-term student modeling
- Emotional state tracking
- Learning style auto-detection
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, Literal, TypedDict
from datetime import datetime
from dataclasses import dataclass, field, asdict
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .memory.unified_memory import MemoryType

# Import advanced AI features
from .advanced_ai_features import (
    AdvancedAISystem,
    get_advanced_ai_system,
    initialize_advanced_ai,
    ReasoningEngine,
    EmotionalIntelligenceEngine,
    LearningStyleDetector,
    ProactiveInterventionEngine,
    LongTermStudentModeler,
    EmotionalState as AdvancedEmotionalState,
    LearningStyle,
    InterventionType,
    ProactiveIntervention
)

logger = logging.getLogger(__name__)


# ==================== Enums & Types ====================

class ChatMode(str, Enum):
    """Chat interaction modes"""
    TUTORING = "tutoring"           # Standard tutoring
    SOCRATIC = "socratic"           # Question-based learning
    EXPLANATION = "explanation"     # Deep explanations
    PRACTICE = "practice"           # Problem solving
    REVIEW = "review"               # Spaced review
    EXPLORATION = "exploration"     # Free exploration
    DEBUGGING = "debugging"         # Help with errors
    BRAINSTORM = "brainstorm"       # Creative thinking


class ResponseStyle(str, Enum):
    """Response formatting styles"""
    CONCISE = "concise"
    DETAILED = "detailed"
    STEP_BY_STEP = "step_by_step"
    VISUAL = "visual"
    CONVERSATIONAL = "conversational"


class EmotionalState(str, Enum):
    """Detected emotional states"""
    CONFIDENT = "confident"
    CONFUSED = "confused"
    FRUSTRATED = "frustrated"
    CURIOUS = "curious"
    ENGAGED = "engaged"
    BORED = "bored"
    NEUTRAL = "neutral"


# ==================== State Definition ====================

class ChatAgentState(TypedDict, total=False):
    """Extended state for the chat agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Chat-specific
    chat_mode: str
    response_style: str
    emotional_state: str
    
    # Context from memory
    memory_context: Dict[str, Any]
    conversation_history: List[Dict[str, str]]
    user_preferences: Dict[str, Any]
    
    # Analysis
    intent_analysis: Dict[str, Any]
    concept_analysis: Dict[str, Any]
    confusion_indicators: List[str]
    
    # Knowledge
    related_concepts: List[str]
    user_mastery: Dict[str, float]
    knowledge_gaps: List[str]
    
    # Response generation
    reasoning_chain: List[Dict[str, str]]
    draft_response: str
    final_response: str
    
    # Follow-up
    suggested_questions: List[str]
    learning_actions: List[Dict[str, Any]]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Analysis Components ====================

@dataclass
class ConversationAnalysis:
    """Analysis of a conversation turn"""
    intent: str
    concepts: List[str]
    question_type: Optional[str]
    emotional_state: EmotionalState
    confusion_level: float
    engagement_level: float
    complexity_level: float
    requires_clarification: bool
    suggested_mode: ChatMode


class ConversationAnalyzer:
    """Analyzes user messages for intent, emotion, and learning signals"""
    
    CONFUSION_INDICATORS = [
        "don't understand", "confused", "what does", "can you explain",
        "i'm lost", "not sure", "don't get it", "unclear", "help me",
        "what do you mean", "huh", "???", "i thought", "but why"
    ]
    
    FRUSTRATION_INDICATORS = [
        "this is hard", "i give up", "impossible", "hate this",
        "doesn't make sense", "stupid", "ugh", "frustrated"
    ]
    
    CURIOSITY_INDICATORS = [
        "interesting", "tell me more", "what about", "how does",
        "why does", "what if", "curious", "wonder"
    ]
    
    QUESTION_PATTERNS = {
        "definition": ["what is", "define", "meaning of", "what does"],
        "procedural": ["how do", "how to", "steps to", "process of"],
        "conceptual": ["why does", "why is", "reason for", "explain why"],
        "example": ["example of", "show me", "demonstrate", "like what"],
        "comparison": ["difference between", "compare", "versus", "vs"],
        "application": ["how can i use", "when to use", "apply", "practical"],
        "verification": ["is it correct", "am i right", "check this", "verify"]
    }
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def analyze(self, message: str, context: Dict[str, Any] = None) -> ConversationAnalysis:
        """Perform comprehensive analysis of user message"""
        message_lower = message.lower()
        
        # Detect emotional state
        emotional_state = self._detect_emotion(message_lower)
        
        # Calculate confusion level
        confusion_level = self._calculate_confusion(message_lower)
        
        # Calculate engagement
        engagement_level = self._calculate_engagement(message, context)
        
        # Identify question type
        question_type = self._identify_question_type(message_lower)
        
        # Extract concepts
        concepts = self._extract_concepts(message)
        
        # Determine intent
        intent = self._determine_intent(message_lower, question_type)
        
        # Calculate complexity
        complexity = self._calculate_complexity(message)
        
        # Suggest mode based on analysis
        suggested_mode = self._suggest_mode(
            emotional_state, confusion_level, question_type, context
        )
        
        return ConversationAnalysis(
            intent=intent,
            concepts=concepts,
            question_type=question_type,
            emotional_state=emotional_state,
            confusion_level=confusion_level,
            engagement_level=engagement_level,
            complexity_level=complexity,
            requires_clarification=confusion_level > 0.6 or len(concepts) == 0,
            suggested_mode=suggested_mode
        )
    
    def _detect_emotion(self, text: str) -> EmotionalState:
        """Detect emotional state from text"""
        confusion_score = sum(1 for i in self.CONFUSION_INDICATORS if i in text)
        frustration_score = sum(1 for i in self.FRUSTRATION_INDICATORS if i in text)
        curiosity_score = sum(1 for i in self.CURIOSITY_INDICATORS if i in text)
        
        if frustration_score >= 2:
            return EmotionalState.FRUSTRATED
        if confusion_score >= 2:
            return EmotionalState.CONFUSED
        if curiosity_score >= 2:
            return EmotionalState.CURIOUS
        if "thank" in text or "got it" in text or "makes sense" in text:
            return EmotionalState.CONFIDENT
        if "?" in text or curiosity_score >= 1:
            return EmotionalState.ENGAGED
        return EmotionalState.NEUTRAL
    
    def _calculate_confusion(self, text: str) -> float:
        """Calculate confusion level (0-1)"""
        indicators = sum(1 for i in self.CONFUSION_INDICATORS if i in text)
        question_marks = text.count("?")
        
        score = (indicators * 0.3) + (min(question_marks, 3) * 0.1)
        return min(1.0, score)
    
    def _calculate_engagement(self, text: str, context: Dict = None) -> float:
        """Calculate engagement level (0-1)"""
        score = 0.0
        
        # Length indicates effort
        word_count = len(text.split())
        if word_count > 20:
            score += 0.3
        elif word_count > 10:
            score += 0.2
        
        # Questions show engagement
        if "?" in text:
            score += 0.3
        
        # Specific references
        if any(word in text.lower() for word in ["you said", "earlier", "before", "mentioned"]):
            score += 0.2
        
        # Examples or attempts
        if any(word in text.lower() for word in ["i tried", "my attempt", "i think", "for example"]):
            score += 0.2
        
        return min(1.0, score)
    
    def _identify_question_type(self, text: str) -> Optional[str]:
        """Identify the type of question being asked"""
        for q_type, patterns in self.QUESTION_PATTERNS.items():
            if any(p in text for p in patterns):
                return q_type
        return "general" if "?" in text else None
    
    def _extract_concepts(self, text: str) -> List[str]:
        """Extract key concepts from text"""
        # Capitalized phrases (potential proper nouns/concepts)
        caps = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        
        # Technical terms (snake_case, camelCase)
        technical = re.findall(r'\b[a-z]+(?:_[a-z]+)+\b', text.lower())
        technical += re.findall(r'\b[a-z]+[A-Z][a-zA-Z]*\b', text)
        
        # Quoted terms
        quoted = re.findall(r'"([^"]+)"', text)
        quoted += re.findall(r"'([^']+)'", text)
        
        return list(set(caps + technical + quoted))[:10]
    
    def _determine_intent(self, text: str, question_type: str) -> str:
        """Determine user intent"""
        if "help" in text or "stuck" in text:
            return "seek_help"
        if question_type == "definition":
            return "understand_concept"
        if question_type == "procedural":
            return "learn_process"
        if question_type == "example":
            return "see_example"
        if "practice" in text or "exercise" in text:
            return "practice"
        if "review" in text or "remind" in text:
            return "review"
        return "general_inquiry"
    
    def _calculate_complexity(self, text: str) -> float:
        """Calculate text complexity (0-1)"""
        words = text.split()
        if not words:
            return 0.0
        
        avg_word_len = sum(len(w) for w in words) / len(words)
        sentence_count = max(1, text.count('.') + text.count('!') + text.count('?'))
        words_per_sentence = len(words) / sentence_count
        
        return min(1.0, (avg_word_len / 10 + words_per_sentence / 25) / 2)
    
    def _suggest_mode(
        self, 
        emotion: EmotionalState, 
        confusion: float,
        question_type: str,
        context: Dict = None
    ) -> ChatMode:
        """Suggest appropriate chat mode"""
        if emotion == EmotionalState.FRUSTRATED:
            return ChatMode.EXPLANATION  # Slow down, explain clearly
        if emotion == EmotionalState.CONFUSED or confusion > 0.5:
            return ChatMode.SOCRATIC  # Guide with questions
        if question_type == "procedural":
            return ChatMode.PRACTICE
        if question_type == "conceptual":
            return ChatMode.EXPLANATION
        if emotion == EmotionalState.CURIOUS:
            return ChatMode.EXPLORATION
        return ChatMode.TUTORING


# ==================== Response Generator ====================

class ResponseGenerator:
    """Generates adaptive, personalized responses"""
    
    MODE_PROMPTS = {
        ChatMode.TUTORING: """You are an expert tutor with 20+ years of teaching experience across multiple subjects.

ROLE: Provide clear, educational responses that adapt to the student's level and learning style.

APPROACH:
- Explain concepts clearly with relevant examples
- Check understanding with questions
- Build on prior knowledge
- Encourage curiosity and questions
- Provide context for why concepts matter
- Use analogies when helpful
- Break down complex ideas into digestible parts

CRITICAL - MATHEMATICAL NOTATION:
- Display math (large, centered): $$\\int x^2 dx = \\frac{x^3}{3} + C$$
- Inline math (small): $x^2$, $f(x)$, $\\theta$
- ALWAYS use $$ or $ for math - NEVER plain text like "x^2" or "sqrt(x)"
- Examples: "The integral $$\\int x^2 dx$$ equals..." or "When $x = 5$..."

TONE: Patient, encouraging, knowledgeable but approachable""",
        
        ChatMode.SOCRATIC: """You are a master of the Socratic method, guiding students to discover answers through questioning.

ROLE: Guide the student to discover answers through carefully crafted questions rather than direct answers.

APPROACH:
- Ask probing questions that lead to understanding
- Build on their responses with follow-up questions
- Help them identify gaps in their reasoning
- Guide them to make connections
- Encourage them to think critically
- Only provide direct answers after they've explored thoroughly
- Celebrate their insights and reasoning

CRITICAL - MATHEMATICAL NOTATION:
- Display math: $$\\int x^2 dx = \\frac{x^3}{3} + C$$
- Inline math: $x^2$, $f(x)$
- ALWAYS use $$ or $ - NEVER plain text

QUESTIONS TO ASK:
- "What do you already know about this?"
- "What do you think might happen if...?"
- "How does this relate to...?"
- "Can you think of an example?"
- "What would you try first?"
- "Why do you think that is?"

TONE: Curious, patient, thought-provoking""",
        
        ChatMode.EXPLANATION: """You are an expert explainer who makes complex concepts accessible and clear.

ROLE: Provide thorough, clear explanations that break down complex concepts into understandable parts.

APPROACH:
- Start with the big picture, then dive into details
- Use multiple representations (verbal, visual, analogies)
- Provide concrete examples and real-world applications
- Break down complex ideas into steps
- Check understanding at each stage
- Address common misconceptions
- Use formatting (bold, lists, code blocks) for clarity
- Connect to concepts they already understand

CRITICAL - MATHEMATICAL NOTATION:
- Display math (large, centered): $$\\int x^2 dx = \\frac{x^3}{3} + C$$
- Inline math (small): $x^2$, $f(x)$, $\\theta$
- Fractions: $$\\frac{a}{b}$$, Powers: $x^n$, Roots: $$\\sqrt{x}$$
- ALWAYS use $$ or $ - NEVER plain text

STRUCTURE:
1. Simple definition/overview
2. Detailed explanation with examples
3. Common misconceptions or pitfalls
4. Practical applications
5. Check understanding

TONE: Clear, patient, thorough, supportive""",
        
        ChatMode.PRACTICE: """You are a practice coach who helps students apply knowledge through problem-solving.

ROLE: Help the student practice and apply concepts through exercises, problems, and hands-on work.

APPROACH:
- Provide appropriate practice problems
- Give hints when stuck (not full answers)
- Explain solutions step-by-step
- Identify patterns in their mistakes
- Celebrate progress and correct attempts
- Gradually increase difficulty
- Provide immediate, constructive feedback
- Suggest additional practice when needed

CRITICAL - MATHEMATICAL NOTATION:
- Display math: $$\\int x^2 dx = \\frac{x^3}{3} + C$$
- Inline math: $x^2$, $f(x)$
- ALWAYS use $$ or $ - NEVER plain text

FEEDBACK STYLE:
- Specific: Point out exactly what was right/wrong
- Constructive: Explain how to improve
- Encouraging: Acknowledge effort and progress
- Actionable: Give clear next steps

TONE: Encouraging, constructive, motivating""",
        
        ChatMode.REVIEW: """You are a review specialist who helps students consolidate and reinforce learning.

ROLE: Help review and reinforce learning by summarizing key points and identifying gaps.

APPROACH:
- Summarize key concepts clearly
- Connect to previous learning
- Identify knowledge gaps
- Suggest areas for more practice
- Use spaced repetition principles
- Test understanding with questions
- Provide memory aids and mnemonics
- Highlight most important points

CRITICAL - MATHEMATICAL NOTATION:
- Display math: $$\\int x^2 dx = \\frac{x^3}{3} + C$$
- Inline math: $x^2$, $f(x)$
- ALWAYS use $$ or $ - NEVER plain text

REVIEW STRUCTURE:
1. What we've covered
2. Key takeaways
3. Connections to other concepts
4. Areas that need more work
5. Suggested next steps

TONE: Organized, clear, supportive""",
        
        ChatMode.EXPLORATION: """You are an enthusiastic guide who encourages curiosity and exploration of ideas.

ROLE: Encourage curiosity and exploration by sharing interesting connections and fostering independent thinking.

APPROACH:
- Share fascinating insights and connections
- Suggest related topics to explore
- Ask "what if" questions
- Encourage creative thinking
- Make learning exciting and engaging
- Connect to real-world applications
- Introduce advanced concepts when appropriate
- Foster a love of learning

EXPLORATION TECHNIQUES:
- "Have you ever wondered...?"
- "This connects to..."
- "An interesting application is..."
- "What if we tried...?"
- "This reminds me of..."

TONE: Enthusiastic, curious, inspiring, engaging""",
        
        ChatMode.DEBUGGING: """You are a systematic debugging expert who helps identify and fix problems.

ROLE: Help debug and troubleshoot issues through systematic, methodical problem-solving.

APPROACH:
- Ask clarifying questions about the problem
- Suggest diagnostic steps
- Help isolate the issue
- Explain the root cause
- Provide solutions with explanations
- Teach debugging strategies
- Prevent similar issues in the future
- Be patient with trial and error

DEBUGGING PROCESS:
1. Understand the problem clearly
2. Reproduce the issue
3. Isolate the cause
4. Explain what's wrong
5. Provide solution
6. Verify the fix
7. Explain how to prevent it

TONE: Systematic, patient, methodical, supportive""",
        
        ChatMode.BRAINSTORM: """You are a creative facilitator who helps generate and develop ideas.

ROLE: Facilitate creative thinking and idea generation through open-ended exploration.

APPROACH:
- Build on their ideas
- Ask "what if" questions
- Encourage unconventional thinking
- Connect disparate concepts
- Suspend judgment during ideation
- Help refine and develop ideas
- Explore multiple possibilities
- Make thinking visible

BRAINSTORMING TECHNIQUES:
- "What if we combined...?"
- "How might we...?"
- "What are all the ways to...?"
- "What would happen if...?"
- "Let's think outside the box..."

TONE: Creative, open-minded, encouraging, playful"""
    }
    
    STYLE_INSTRUCTIONS = {
        ResponseStyle.CONCISE: "Be brief and to the point. Use short sentences.",
        ResponseStyle.DETAILED: "Provide comprehensive explanations with depth.",
        ResponseStyle.STEP_BY_STEP: "Break down into numbered steps. Be methodical.",
        ResponseStyle.VISUAL: "Use formatting, bullet points, and structure for clarity.",
        ResponseStyle.CONVERSATIONAL: "Be warm and conversational. Use natural language."
    }
    
    EMOTION_ADAPTATIONS = {
        EmotionalState.CONFUSED: "The student is confused. Be extra clear and patient. Use simpler language.",
        EmotionalState.FRUSTRATED: "The student is frustrated. Be encouraging. Acknowledge difficulty. Simplify.",
        EmotionalState.CURIOUS: "The student is curious. Feed their curiosity. Share interesting details.",
        EmotionalState.CONFIDENT: "The student is confident. You can be more challenging. Push their thinking.",
        EmotionalState.ENGAGED: "The student is engaged. Maintain momentum. Be interactive.",
        EmotionalState.BORED: "The student seems bored. Make it more interesting. Use engaging examples.",
        EmotionalState.NEUTRAL: "Maintain a balanced, helpful approach."
    }
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def generate(
        self,
        user_input: str,
        mode: ChatMode,
        style: ResponseStyle,
        emotional_state: EmotionalState,
        context: Dict[str, Any],
        reasoning_chain: List[Dict] = None
    ) -> str:
        """Generate an adaptive response"""
        # Check if we have an enhanced system prompt with comprehensive context
        enhanced_prompt = context.get("enhanced_system_prompt")
        
        if enhanced_prompt:
            # Use the comprehensive system prompt
            system_prompt = enhanced_prompt
            # Add mode and emotion adaptations
            system_prompt += f"\n\n## CURRENT INTERACTION MODE\n{self.MODE_PROMPTS.get(mode, self.MODE_PROMPTS[ChatMode.TUTORING])}"
            system_prompt += f"\n\n## RESPONSE STYLE\n{self.STYLE_INSTRUCTIONS.get(style, '')}"
            system_prompt += f"\n\n## EMOTIONAL ADAPTATION\n{self.EMOTION_ADAPTATIONS.get(emotional_state, '')}"
        else:
            # Fall back to standard prompt building
            system_prompt = self._build_system_prompt(mode, style, emotional_state, context)
        
        user_context = self._build_user_context(context, reasoning_chain)
        
        full_prompt = f"""{system_prompt}

{user_context}

Student's message: {user_input}

Provide a helpful, educational response. Be interactive and engaging. Reference their specific learning materials when relevant. If they're asking about a topic they struggle with, provide extra support. If it's a strength, challenge them further."""
        
        try:
            response = self.ai_client.generate(
                full_prompt, 
                max_tokens=4000,  # Increased to allow detailed explanations
                temperature=0.7
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            return self._fallback_response(user_input, mode)
    
    def _build_system_prompt(
        self,
        mode: ChatMode,
        style: ResponseStyle,
        emotion: EmotionalState,
        context: Dict
    ) -> str:
        """Build the system prompt"""
        parts = [
            self.MODE_PROMPTS.get(mode, self.MODE_PROMPTS[ChatMode.TUTORING]),
            self.STYLE_INSTRUCTIONS.get(style, ""),
            self.EMOTION_ADAPTATIONS.get(emotion, "")
        ]
        
        # Add user preferences
        prefs = context.get("user_preferences", {})
        if prefs.get("learning_style"):
            parts.append(f"Student's learning style: {prefs['learning_style']}")
        if prefs.get("difficulty_level"):
            parts.append(f"Student's level: {prefs['difficulty_level']}")
        
        return "\n\n".join(filter(None, parts))
    
    def _build_user_context(self, context: Dict, reasoning: List[Dict] = None) -> str:
        """Build context section of prompt"""
        sections = []
        
        # Session history summary (cross-session memory)
        session_summary = context.get("session_history_summary", "")
        if session_summary:
            sections.append(f"Memory from previous sessions: {session_summary}")
        
        # Recent conversation
        history = context.get("conversation_history", [])[-3:]
        if history:
            conv = "\n".join([
                f"Student: {h.get('user', '')}\nTutor: {h.get('assistant', '')}"
                for h in history
            ])
            sections.append(f"Recent conversation:\n{conv}")
        
        # ==================== WEAK CONCEPTS (HIGH PRIORITY) ====================
        # Add weak concepts from state (passed from ask_simple)
        weak_concepts = context.get("weak_concepts", [])
        if weak_concepts:
            weak_info = "\n".join([
                f"- {wc.get('topic', 'Unknown')}: {wc.get('accuracy', 0)}% accuracy, "
                f"{wc.get('incorrect_count', 0)} wrong answers, "
                f"priority {wc.get('priority', 0)}/10"
                for wc in weak_concepts[:5]
            ])
            sections.append(f"⚠️ STUDENT'S WEAK AREAS (provide extra support on these):\n{weak_info}")
        
        # Also check user_weaknesses format (from comprehensive context)
        user_weaknesses = context.get("user_weaknesses", [])
        if user_weaknesses and not weak_concepts:
            weakness_list = [f"{w.get('topic', 'Unknown')} ({w.get('mastery', 0)}%)" for w in user_weaknesses[:3]]
            sections.append(f"⚠️ Areas to focus on: {', '.join(weakness_list)}")
        
        # Topics needing review
        topics_needing_review = context.get("topics_needing_review", [])
        if topics_needing_review:
            sections.append(f"📚 Topics needing review: {', '.join(topics_needing_review[:5])}")
        
        # ==================== RAG CONTEXT (USER'S CONTENT) ====================
        rag_context = context.get("rag_context", "")
        rag_count = context.get("rag_results_count", 0)
        if rag_context and rag_count > 0:
            sections.append(f"📖 Relevant content from student's materials ({rag_count} items):\n{rag_context[:800]}...")
        
        # Knowledge context
        topics = context.get("topics_of_interest", [])[:5]
        if topics:
            sections.append(f"Student's recent topics: {', '.join(topics)}")
        
        # Struggled concepts (from memory)
        struggled = context.get("struggled_concepts", [])[:3]
        if struggled:
            sections.append(f"Areas needing attention: {', '.join(struggled)}")
        
        # Add comprehensive context if available
        user_strengths = context.get("user_strengths", [])
        if user_strengths:
            strength_list = [f"{s.get('topic', 'Unknown')} ({s.get('mastery', 0)}%)" for s in user_strengths[:3]]
            sections.append(f"Student's strengths: {', '.join(strength_list)}")
        
        # Notes context
        notes_ctx = context.get("notes_context", {})
        if notes_ctx.get("relevant_notes"):
            relevant = notes_ctx["relevant_notes"][:2]
            notes_info = "\n".join([f"- {n.get('title', 'Note')}: {n.get('content_preview', '')[:150]}..." for n in relevant])
            sections.append(f"Relevant notes the student has:\n{notes_info}")
        
        # Flashcard context
        fc_ctx = context.get("flashcards_context", {})
        if fc_ctx.get("struggling_cards"):
            struggling = fc_ctx["struggling_cards"][:2]
            fc_info = "\n".join([f"- {c.get('question', '')[:80]}... (accuracy: {c.get('accuracy', 0)}%)" for c in struggling])
            sections.append(f"Flashcards they struggle with:\n{fc_info}")
        
        # Quiz context
        quiz_ctx = context.get("quiz_context", {})
        if quiz_ctx.get("weak_quiz_topics"):
            weak_topics = quiz_ctx["weak_quiz_topics"][:3]
            quiz_info = ", ".join([f"{t.get('topic', '')} ({t.get('avg_score', 0)}%)" for t in weak_topics])
            sections.append(f"Quiz topics needing work: {quiz_info}")
        
        # Reasoning chain
        if reasoning:
            thoughts = "\n".join([f"- {r.get('thought', '')}" for r in reasoning[-3:]])
            sections.append(f"Analysis:\n{thoughts}")
        
        return "\n\n".join(sections) if sections else "No additional context."
    
    def _fallback_response(self, user_input: str, mode: ChatMode) -> str:
        """Generate fallback when AI fails"""
        return f"I'd be happy to help you with that. Could you tell me more about what you're trying to understand about: {user_input[:100]}?"


# ==================== Main Chat Agent ====================

class ChatAgent(BaseAgent):
    """
    High-capacity AI Chat Agent with:
    - Multi-modal conversation analysis
    - Adaptive response generation
    - Deep memory integration
    - Emotional intelligence
    - Learning path awareness
    - Self-improvement through reflection
    
    Enhanced with Advanced AI Features:
    - Reasoning models (step-by-step thinking for complex problems)
    - Proactive interventions (real-time help triggers)
    - Long-term student modeling (cross-session patterns)
    - Emotional state tracking (adaptive tone)
    - Learning style auto-detection (real-time adaptation)
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        checkpointer: Optional[MemorySaver] = None,
        db_session_factory: Optional[Any] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.analyzer = ConversationAnalyzer(ai_client)
        self.generator = ResponseGenerator(ai_client)
        self.db_session_factory = db_session_factory
        
        # Initialize Advanced AI System
        self.advanced_ai = initialize_advanced_ai(ai_client, db_session_factory)
        logger.info("🧠 Advanced AI features initialized (reasoning, emotions, learning styles)")
        
        super().__init__(
            agent_type=AgentType.CHAT,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine with advanced AI features"""
        graph = StateGraph(ChatAgentState)
        
        # Add nodes
        graph.add_node("load_memory", self._load_memory_context)
        graph.add_node("analyze_input", self._analyze_input)
        graph.add_node("advanced_ai_processing", self._advanced_ai_processing)  # NEW
        graph.add_node("determine_mode", self._determine_mode)
        graph.add_node("build_reasoning", self._build_reasoning_chain)
        graph.add_node("generate_response", self._generate_response)
        graph.add_node("enhance_response", self._enhance_response)
        graph.add_node("check_intervention", self._check_proactive_intervention)  # NEW
        graph.add_node("reflect_and_improve", self._reflect_and_improve)
        graph.add_node("prepare_followups", self._prepare_followups)
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("finalize", self._finalize_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("load_memory")
        
        # Add edges with advanced AI processing
        graph.add_edge("load_memory", "analyze_input")
        graph.add_edge("analyze_input", "advanced_ai_processing")  # NEW
        graph.add_edge("advanced_ai_processing", "determine_mode")
        graph.add_edge("determine_mode", "build_reasoning")
        graph.add_edge("build_reasoning", "generate_response")
        graph.add_edge("generate_response", "enhance_response")
        graph.add_edge("enhance_response", "check_intervention")  # NEW
        graph.add_conditional_edges(
            "check_intervention",
            self._should_reflect,
            {"reflect": "reflect_and_improve", "continue": "prepare_followups"}
        )
        graph.add_edge("reflect_and_improve", "prepare_followups")
        graph.add_edge("prepare_followups", "update_memory")
        graph.add_edge("update_memory", "finalize")
        graph.add_edge("finalize", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        
    
    # ==================== Graph Nodes ====================
    
    async def _load_memory_context(self, state: ChatAgentState) -> ChatAgentState:
        """Load context from unified memory system including cross-session history"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        query = state.get("user_input", "")
        
        state["execution_path"] = ["chat:load_memory"]
        
        if self.memory_manager:
            try:
                logger.info(f"🧠 Loading memory context for user {user_id}, session {session_id}")
                
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="chat",
                    query=query,
                    session_id=session_id
                )
                
                state["memory_context"] = context
                state["conversation_history"] = context.get("recent_conversations", [])
                state["user_preferences"] = context.get("user_preferences", {})
                state["related_concepts"] = context.get("topics_of_interest", [])
                state["knowledge_gaps"] = context.get("struggled_concepts", [])
                
                # Store session history summary for cross-session context
                state["_session_history_summary"] = context.get("session_history_summary", "")
                state["_has_previous_sessions"] = context.get("has_previous_sessions", False)
                
                logger.info(f"✅ Memory loaded: {len(state['conversation_history'])} conversations")
                logger.info(f"   Session history: {state['_session_history_summary'][:100] if state['_session_history_summary'] else 'None'}")
                logger.info(f"   Has previous sessions: {state['_has_previous_sessions']}")
                
            except Exception as e:
                logger.error(f"❌ Memory load failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                state["memory_context"] = {}
                state["errors"] = state.get("errors", []) + [f"Memory load: {str(e)}"]
        else:
            logger.warning("⚠️ No memory manager available")
        
        # ==================== ENHANCED RAG RETRIEVAL ====================
        # Retrieve relevant user content with query enhancement and compression
        user_id = state.get("user_id")
        user_input = state.get("user_input", "")
        
        # Convert user_id to integer if it's an email/username
        user_id_int = None
        if user_id:
            try:
                user_id_int = int(user_id)
            except (ValueError, TypeError):
                # It's an email or username, need to look it up
                try:
                    from .agent_api import get_user_id_from_identifier
                    user_id_int = get_user_id_from_identifier(user_id)
                except Exception:
                    pass
        
        if user_id_int and user_input:
            try:
                # Try enhanced RAG first
                from .rag.rag_helper import get_rag_system, smart_retrieve
                rag_system = get_rag_system()
                
                if rag_system:
                    logger.info(f"🔍 Using ENHANCED RAG for chat context")
                    
                    # Build user context for personalized retrieval
                    user_context = {
                        "weak_topics": state.get("knowledge_gaps", []),
                        "topics_of_interest": state.get("related_concepts", []),
                        "difficulty_level": state.get("user_preferences", {}).get("difficulty_level", "intermediate")
                    }
                    
                    # Use smart retrieve with all enhancements
                    rag_result = await smart_retrieve(
                        query=user_input,
                        user_id=str(user_id_int),
                        user_context=user_context,
                        top_k=5,
                        max_context_length=1500  # Compressed context
                    )
                    
                    if rag_result and rag_result.get("results"):
                        # Build context from enhanced results
                        rag_context_parts = []
                        for r in rag_result["results"]:
                            content_text = r.content[:300]
                            source = r.metadata.get("title", r.source)
                            rag_context_parts.append(f"[{source}] {content_text}")
                        
                        state["rag_context"] = "\n\n".join(rag_context_parts)
                        state["rag_results_count"] = len(rag_result["results"])
                        state["rag_enhanced"] = rag_result.get("metadata", {}).get("enhanced", False)
                        state["rag_compressed"] = rag_result.get("metadata", {}).get("compressed", False)
                        
                        logger.info(f"✅ Enhanced RAG retrieved {len(rag_result['results'])} items")
                        logger.info(f"   Enhanced: {state['rag_enhanced']}, Compressed: {state['rag_compressed']}")
                    else:
                        logger.info("ℹ️ No relevant content found in enhanced RAG")
                        state["rag_context"] = ""
                        state["rag_results_count"] = 0
                else:
                    # Fallback to basic RAG
                    logger.info("⚠️ Enhanced RAG not available, using basic RAG")
                    from .rag.user_rag_manager import get_user_rag_manager
                    user_rag = get_user_rag_manager()
                    
                    if user_rag:
                        rag_results = await user_rag.retrieve_for_user(
                            user_id=str(user_id_int),
                            query=user_input,
                            top_k=5,
                            content_types=["note", "flashcard", "chat", "question_bank"]
                        )
                        
                        if rag_results:
                            rag_context_parts = []
                            for r in rag_results:
                                content_text = r.get("content", "")[:300]
                                content_type = r.get("metadata", {}).get("type", "content")
                                rag_context_parts.append(f"[{content_type}] {content_text}")
                            
                            state["rag_context"] = "\n\n".join(rag_context_parts)
                            state["rag_results_count"] = len(rag_results)
                            logger.info(f"✅ Basic RAG retrieved {len(rag_results)} items")
                        else:
                            state["rag_context"] = ""
                            state["rag_results_count"] = 0
                    
            except Exception as e:
                logger.error(f"❌ RAG retrieval failed: {e}")
                import traceback
                logger.error(traceback.format_exc())
                state["rag_context"] = ""
                state["rag_results_count"] = 0
                state["rag_context"] = ""
                state["rag_results_count"] = 0
        else:
            if not user_id_int:
                logger.warning(f"⚠️ Could not convert user_id '{user_id}' to integer for RAG retrieval")
        
        return state
    
    async def _analyze_input(self, state: ChatAgentState) -> ChatAgentState:
        """Analyze user input for intent, emotion, and concepts"""
        user_input = state.get("user_input", "")
        context = state.get("memory_context", {})
        
        analysis = self.analyzer.analyze(user_input, context)
        
        state["intent_analysis"] = {
            "intent": analysis.intent,
            "question_type": analysis.question_type,
            "requires_clarification": analysis.requires_clarification
        }
        
        state["concept_analysis"] = {
            "concepts": analysis.concepts,
            "complexity": analysis.complexity_level
        }
        
        state["emotional_state"] = analysis.emotional_state.value
        state["confusion_indicators"] = (
            self.analyzer.CONFUSION_INDICATORS 
            if analysis.confusion_level > 0.5 else []
        )
        
        # Store suggested mode for next step
        state["_suggested_mode"] = analysis.suggested_mode.value
        state["_engagement"] = analysis.engagement_level
        
        state["execution_path"].append("chat:analyze")
        logger.debug(f"Analysis: intent={analysis.intent}, emotion={analysis.emotional_state.value}")
        
        return state
    
    async def _determine_mode(self, state: ChatAgentState) -> ChatAgentState:
        """Determine chat mode and response style"""
        # Get suggested mode from analysis
        suggested = state.get("_suggested_mode", ChatMode.TUTORING.value)
        
        # Check user preferences
        prefs = state.get("user_preferences", {})
        preferred_style = prefs.get("response_style", ResponseStyle.CONVERSATIONAL.value)
        
        # Adjust based on emotional state
        emotion = EmotionalState(state.get("emotional_state", "neutral"))
        
        if emotion == EmotionalState.FRUSTRATED:
            state["response_style"] = ResponseStyle.STEP_BY_STEP.value
        elif emotion == EmotionalState.CONFUSED:
            state["response_style"] = ResponseStyle.DETAILED.value
        elif state.get("_engagement", 0) > 0.7:
            state["response_style"] = ResponseStyle.CONVERSATIONAL.value
        else:
            state["response_style"] = preferred_style
        
        state["chat_mode"] = suggested
        state["execution_path"].append(f"chat:mode:{suggested}")
        
        return state
    
    async def _build_reasoning_chain(self, state: ChatAgentState) -> ChatAgentState:
        """Build reasoning chain for response generation"""
        user_input = state.get("user_input", "")
        intent = state.get("intent_analysis", {}).get("intent", "general")
        concepts = state.get("concept_analysis", {}).get("concepts", [])
        knowledge_gaps = state.get("knowledge_gaps", [])
        
        reasoning = []
        
        # Step 1: Understand the question
        reasoning.append({
            "step": "understand",
            "thought": f"User intent: {intent}. Key concepts: {', '.join(concepts[:3]) or 'general topic'}"
        })
        
        # Step 2: Check for knowledge gaps
        relevant_gaps = [g for g in knowledge_gaps if any(c.lower() in g.lower() for c in concepts)]
        if relevant_gaps:
            reasoning.append({
                "step": "gaps",
                "thought": f"User has struggled with related concepts: {', '.join(relevant_gaps[:2])}"
            })
        
        # Step 3: Determine approach
        mode = state.get("chat_mode", "tutoring")
        emotion = state.get("emotional_state", "neutral")
        reasoning.append({
            "step": "approach",
            "thought": f"Using {mode} mode. Student emotion: {emotion}. Will adapt accordingly."
        })
        
        # Step 4: Plan response structure
        question_type = state.get("intent_analysis", {}).get("question_type")
        if question_type == "definition":
            reasoning.append({
                "step": "structure",
                "thought": "Will provide clear definition with examples"
            })
        elif question_type == "procedural":
            reasoning.append({
                "step": "structure", 
                "thought": "Will break down into steps with explanations"
            })
        elif question_type == "conceptual":
            reasoning.append({
                "step": "structure",
                "thought": "Will explain the 'why' with underlying principles"
            })
        else:
            reasoning.append({
                "step": "structure",
                "thought": "Will provide helpful, educational response"
            })
        
        state["reasoning_chain"] = reasoning
        state["execution_path"].append("chat:reasoning")
        
        return state
    
    async def _advanced_ai_processing(self, state: ChatAgentState) -> ChatAgentState:
        """
        Process with advanced AI features:
        - Update long-term student model
        - Detect emotional state with high accuracy
        - Auto-detect learning style
        - Check for reasoning needs
        - Get personalization context
        """
        user_id = state.get("user_id")
        user_input = state.get("user_input", "")
        
        state["execution_path"].append("chat:advanced_ai")
        
        try:
            # Get topic from concept analysis
            concepts = state.get("concept_analysis", {}).get("concepts", [])
            topic = concepts[0] if concepts else None
            
            # Process with advanced AI system
            advanced_context = await self.advanced_ai.process_with_advanced_features(
                user_id=user_id,
                message=user_input,
                context=state.get("memory_context", {}),
                topic=topic
            )
            
            # Update state with advanced AI insights
            state["_advanced_emotional_state"] = advanced_context.get("emotional_state", "neutral")
            state["_frustration_level"] = advanced_context.get("frustration_level", 0.0)
            state["_engagement_level"] = advanced_context.get("engagement_level", 0.5)
            state["_learning_style"] = advanced_context.get("learning_style", "multimodal")
            state["_style_confidence"] = advanced_context.get("style_confidence", 0.3)
            
            # Store reasoning trace if generated
            if advanced_context.get("reasoning_trace"):
                state["_reasoning_trace"] = advanced_context["reasoning_trace"]
            
            # Store intervention if triggered
            if advanced_context.get("intervention"):
                state["_proactive_intervention"] = advanced_context["intervention"]
            
            # Store encouragement if available
            if advanced_context.get("encouragement"):
                state["_encouragement"] = advanced_context["encouragement"]
            
            # Get system prompt enhancement
            prompt_enhancement = self.advanced_ai.get_system_prompt_enhancement(user_id)
            state["_personalization_prompt"] = prompt_enhancement
            
            # Store tone and content adaptations
            state["_tone_adaptation"] = advanced_context.get("tone_adaptation", {})
            state["_content_adaptation"] = advanced_context.get("content_adaptation", {})
            
            # Update knowledge gaps and strengths from student model
            state["knowledge_gaps"] = advanced_context.get("knowledge_gaps", state.get("knowledge_gaps", []))
            state["_strengths"] = advanced_context.get("strengths", [])
            
            logger.info(f"🧠 Advanced AI: emotion={state['_advanced_emotional_state']}, "
                       f"style={state['_learning_style']}, "
                       f"frustration={state['_frustration_level']:.2f}")
            
        except Exception as e:
            logger.error(f"Advanced AI processing failed: {e}")
            # Continue with defaults
            state["_advanced_emotional_state"] = "neutral"
            state["_learning_style"] = "multimodal"
        
        return state
    
    async def _check_proactive_intervention(self, state: ChatAgentState) -> ChatAgentState:
        """
        Check if proactive intervention should be added to response.
        Interventions help students before they explicitly ask for help.
        """
        state["execution_path"].append("chat:intervention_check")
        
        intervention = state.get("_proactive_intervention")
        encouragement = state.get("_encouragement")
        
        if intervention:
            # Add intervention message to response
            intervention_msg = intervention.get("message", "")
            intervention_type = intervention.get("intervention_type", "")
            
            logger.info(f"🎯 Proactive intervention triggered: {intervention_type}")
            
            # Store for metadata
            state["_intervention_triggered"] = True
            state["_intervention_type"] = intervention_type
            state["_intervention_message"] = intervention_msg
            
            # Optionally prepend intervention to response
            if intervention_type in ["frustration_support", "confusion_help"]:
                current_response = state.get("final_response", "")
                state["final_response"] = f"{intervention_msg}\n\n{current_response}"
        
        elif encouragement:
            # Add encouragement to response
            current_response = state.get("final_response", "")
            state["final_response"] = f"{current_response}\n\n{encouragement}"
            state["_encouragement_added"] = True
        
        return state
    
    async def _generate_response(self, state: ChatAgentState) -> ChatAgentState:
        """Generate the main response with advanced AI personalization"""
        user_input = state.get("user_input", "")
        mode = ChatMode(state.get("chat_mode", "tutoring"))
        style = ResponseStyle(state.get("response_style", "conversational"))
        
        # Use advanced emotional state if available
        advanced_emotion = state.get("_advanced_emotional_state", "neutral")
        emotion = EmotionalState(advanced_emotion) if advanced_emotion in [e.value for e in EmotionalState] else EmotionalState.NEUTRAL
        
        # Check if we have enhanced system prompt from comprehensive context
        enhanced_prompt = state.get("enhanced_system_prompt")
        
        # Build context with advanced AI insights
        context = {
            "conversation_history": state.get("conversation_history", []),
            "user_preferences": state.get("user_preferences", {}),
            "topics_of_interest": state.get("related_concepts", []),
            "struggled_concepts": state.get("knowledge_gaps", []),
            "session_history_summary": state.get("_session_history_summary", ""),
            "has_previous_sessions": state.get("_has_previous_sessions", False),
            # Add comprehensive context data
            "user_strengths": state.get("user_strengths", []) or state.get("_strengths", []),
            "user_weaknesses": state.get("user_weaknesses", []),
            "topics_needing_review": state.get("topics_needing_review", []),
            "notes_context": state.get("notes_context", {}),
            "flashcards_context": state.get("flashcards_context", {}),
            "quiz_context": state.get("quiz_context", {}),
            # Advanced AI context
            "learning_style": state.get("_learning_style", "multimodal"),
            "frustration_level": state.get("_frustration_level", 0.0),
            "engagement_level": state.get("_engagement_level", 0.5),
            "tone_adaptation": state.get("_tone_adaptation", {}),
            "content_adaptation": state.get("_content_adaptation", {}),
            # RAG context - user's relevant content
            "rag_context": state.get("rag_context", ""),
            "rag_results_count": state.get("rag_results_count", 0),
            # WEAK CONCEPTS - from ask_simple endpoint
            "weak_concepts": state.get("weak_concepts", []),
        }
        
        # Use enhanced prompt if available, otherwise use standard generation
        if enhanced_prompt:
            context["enhanced_system_prompt"] = enhanced_prompt
        
        # Add personalization prompt from advanced AI
        personalization_prompt = state.get("_personalization_prompt", "")
        if personalization_prompt:
            if context.get("enhanced_system_prompt"):
                context["enhanced_system_prompt"] += f"\n\n{personalization_prompt}"
            else:
                context["enhanced_system_prompt"] = personalization_prompt
        
        # Check if we have a reasoning trace to use
        reasoning_trace = state.get("_reasoning_trace")
        if reasoning_trace and reasoning_trace.get("final_answer"):
            # Use the reasoning model's answer directly
            response = reasoning_trace["final_answer"]
            state["_used_reasoning_model"] = True
            logger.info("🧠 Using reasoning model response")
        else:
            # Generate with standard method
            response = self.generator.generate(
                user_input=user_input,
                mode=mode,
                style=style,
                emotional_state=emotion,
                context=context,
                reasoning_chain=state.get("reasoning_chain", [])
            )
        
        state["draft_response"] = response
        state["execution_path"].append("chat:generate")
        
        return state
    
    async def _enhance_response(self, state: ChatAgentState) -> ChatAgentState:
        """Enhance response with formatting and structure"""
        response = state.get("draft_response", "")
        style = state.get("response_style", "conversational")
        
        # Add structure based on style
        if style == ResponseStyle.STEP_BY_STEP.value:
            # Ensure numbered steps if not present
            if not re.search(r'^\d+\.', response, re.MULTILINE):
                # Try to add structure
                pass  # Keep as-is if already structured
        
        # Ensure response isn't excessively long (allow up to 8000 chars for detailed explanations)
        if len(response) > 8000:
            # Truncate gracefully at sentence boundaries
            sentences = response.split('. ')
            truncated = []
            length = 0
            for s in sentences:
                if length + len(s) < 7500:
                    truncated.append(s)
                    length += len(s)
                else:
                    break
            response = '. '.join(truncated) + '.'
        
        state["final_response"] = response
        state["execution_path"].append("chat:enhance")
        
        return state
    
    async def _reflect_and_improve(self, state: ChatAgentState) -> ChatAgentState:
        """Self-reflect on response quality and improve if needed"""
        response = state.get("final_response", "")
        user_input = state.get("user_input", "")
        emotion = state.get("emotional_state", "neutral")
        
        # Quick quality check
        prompt = f"""Rate this tutoring response (1-10) and suggest ONE improvement if needed:

Student question: {user_input[:200]}
Student emotion: {emotion}
Response: {response[:500]}

Return JSON: {{"score": 1-10, "improvement": "suggestion or null"}}"""
        
        try:
            result = self.ai_client.generate(prompt, max_tokens=100, temperature=0.3)
            
            json_str = result.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            reflection = json.loads(json_str)
            score = reflection.get("score", 7)
            
            # If score is low, try to improve
            if score < 6 and reflection.get("improvement"):
                improve_prompt = f"""Improve this response based on feedback: {reflection['improvement']}

Original: {response[:800]}

Improved response:"""
                
                improved = self.ai_client.generate(improve_prompt, max_tokens=4000, temperature=0.7)
                state["final_response"] = improved.strip()
                state["_reflection_improved"] = True
            
            state["_quality_score"] = score / 10.0
            
        except Exception as e:
            logger.error(f"Reflection failed: {e}")
            state["_quality_score"] = 0.7
        
        state["execution_path"].append("chat:reflect")
        return state
    
    async def _prepare_followups(self, state: ChatAgentState) -> ChatAgentState:
        """Prepare follow-up questions and learning actions"""
        user_input = state.get("user_input", "")
        response = state.get("final_response", "")
        concepts = state.get("concept_analysis", {}).get("concepts", [])
        
        # Generate follow-up questions
        prompt = f"""Based on this tutoring exchange, suggest 2-3 natural follow-up questions the student might ask next.

Student asked: {user_input[:200]}
Tutor responded about: {response[:200]}...

Return ONLY a JSON array of strings, nothing else:
["question 1?", "question 2?"]"""
        
        try:
            result = self.ai_client.generate(prompt, max_tokens=150, temperature=0.7)
            
            json_str = result.strip()
            
            # Try to extract JSON from various formats
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
            
            # Try to find array in response
            if not json_str.startswith("["):
                # Look for array pattern
                import re
                match = re.search(r'\[.*?\]', json_str, re.DOTALL)
                if match:
                    json_str = match.group()
            
            if json_str:
                questions = json.loads(json_str)
                state["suggested_questions"] = questions if isinstance(questions, list) else []
            else:
                state["suggested_questions"] = []
            
        except Exception as e:
            logger.debug(f"Follow-up generation skipped: {e}")
            # Generate simple fallback questions based on concepts
            fallback_questions = []
            if concepts:
                fallback_questions.append(f"Can you explain more about {concepts[0]}?")
                if len(concepts) > 1:
                    fallback_questions.append(f"How does {concepts[0]} relate to {concepts[1]}?")
            state["suggested_questions"] = fallback_questions
        
        # Suggest learning actions
        actions = []
        if concepts:
            actions.append({
                "type": "create_flashcards",
                "description": f"Create flashcards for: {', '.join(concepts[:2])}"
            })
        
        if state.get("knowledge_gaps"):
            actions.append({
                "type": "review",
                "description": f"Review: {state['knowledge_gaps'][0]}"
            })
        
        state["learning_actions"] = actions
        state["execution_path"].append("chat:followups")
        
        return state
    
    async def _update_memory(self, state: ChatAgentState) -> ChatAgentState:
        """Update memory with this interaction"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        
        if self.memory_manager:
            try:
                # Store conversation
                concepts = state.get("concept_analysis", {}).get("concepts", [])
                
                await self.memory_manager.remember_conversation(
                    user_id=user_id,
                    user_message=state.get("user_input", ""),
                    ai_response=state.get("final_response", ""),
                    session_id=session_id,
                    agent_type="chat",
                    topics=concepts
                )
                
                # Learn from interaction
                await self.memory_manager.learn_from_interaction(
                    user_id=user_id,
                    interaction_data={
                        "response_length": len(state.get("final_response", "")),
                        "topics": concepts,
                        "quality_score": state.get("_quality_score", 0.7),
                        "emotional_state": state.get("emotional_state"),
                        "chat_mode": state.get("chat_mode")
                    }
                )
                
                # Update session context
                self.memory_manager.set_session_context(
                    session_id, "last_chat_mode", state.get("chat_mode")
                )
                self.memory_manager.set_session_context(
                    session_id, "last_emotion", state.get("emotional_state")
                )
                
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("chat:memory")
        return state
    
    async def _finalize_response(self, state: ChatAgentState) -> ChatAgentState:
        """Finalize response with metadata including advanced AI insights"""
        state["response_metadata"] = {
            "success": True,
            "chat_mode": state.get("chat_mode"),
            "response_style": state.get("response_style"),
            "emotional_state": state.get("emotional_state"),
            "quality_score": state.get("_quality_score", 0.7),
            "concepts_discussed": state.get("concept_analysis", {}).get("concepts", []),
            "suggested_questions": state.get("suggested_questions", []),
            "learning_actions": state.get("learning_actions", []),
            "reflection_improved": state.get("_reflection_improved", False),
            "execution_path": state.get("execution_path", []),
            "has_previous_sessions": state.get("_has_previous_sessions", False),
            "session_history_summary": state.get("_session_history_summary", ""),
            "timestamp": datetime.utcnow().isoformat(),
            
            # RAG metadata
            "rag_results_count": state.get("rag_results_count", 0),
            "rag_context_available": bool(state.get("rag_context")),
            
            # Confusion indicators
            "confusion_indicators": state.get("confusion_indicators", []),
            
            # Advanced AI metadata
            "advanced_ai": {
                "emotional_state": state.get("_advanced_emotional_state", "neutral"),
                "frustration_level": state.get("_frustration_level", 0.0),
                "engagement_level": state.get("_engagement_level", 0.5),
                "learning_style": state.get("_learning_style", "multimodal"),
                "style_confidence": state.get("_style_confidence", 0.3),
                "used_reasoning_model": state.get("_used_reasoning_model", False),
                "intervention_triggered": state.get("_intervention_triggered", False),
                "intervention_type": state.get("_intervention_type"),
                "encouragement_added": state.get("_encouragement_added", False),
                "knowledge_gaps": state.get("knowledge_gaps", [])[:5],
                "strengths": state.get("_strengths", [])[:5],
            }
        }
        
        return state
    
    # ==================== Conditional Edges ====================
    
    def _should_reflect(self, state: ChatAgentState) -> Literal["reflect", "continue"]:
        """Decide if response needs reflection"""
        # Reflect if student is confused or frustrated
        emotion = state.get("emotional_state", "neutral")
        if emotion in ["confused", "frustrated"]:
            return "reflect"
        
        # Reflect on complex questions
        complexity = state.get("concept_analysis", {}).get("complexity", 0)
        if complexity > 0.7:
            return "reflect"
        
        return "continue"
    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process input - handled by analyze_input"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Core logic - handled by generate_response"""
        return state
    
    async def _format_response(self, state: AgentState) -> AgentState:
        """Format response - handled by finalize"""
        return state


# ==================== Factory Function ====================

def create_chat_agent(
    ai_client,
    knowledge_graph=None,
    memory_manager=None,
    db_session_factory=None
) -> ChatAgent:
    """Factory function to create and register the chat agent with advanced AI features"""
    agent = ChatAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
    agent_registry.register(agent)
    logger.info("🧠 Advanced Chat Agent registered with reasoning, emotions, and learning style detection")
    return agent



