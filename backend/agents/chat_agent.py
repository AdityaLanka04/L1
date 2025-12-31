"""
Advanced AI Chat Agent
High-capacity LangGraph-based agent for intelligent tutoring conversations
with multi-modal reasoning, adaptive responses, and deep memory integration.
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
        ChatMode.TUTORING: """You are an expert tutor. Provide clear, educational responses.
Adapt to the student's level. Use examples when helpful. Encourage questions.""",
        
        ChatMode.SOCRATIC: """Use the Socratic method. Guide the student to discover answers through questions.
Don't give direct answers. Ask probing questions. Build understanding step by step.""",
        
        ChatMode.EXPLANATION: """Provide thorough, clear explanations. Break down complex concepts.
Use analogies and examples. Check understanding. Be patient and supportive.""",
        
        ChatMode.PRACTICE: """Help the student practice. Provide problems and exercises.
Give hints when stuck. Explain solutions step by step. Celebrate progress.""",
        
        ChatMode.REVIEW: """Help review and reinforce learning. Summarize key points.
Connect to previous knowledge. Identify gaps. Suggest areas for more practice.""",
        
        ChatMode.EXPLORATION: """Encourage curiosity and exploration. Share interesting connections.
Suggest related topics. Foster independent thinking. Make learning exciting.""",
        
        ChatMode.DEBUGGING: """Help debug and troubleshoot. Be systematic and methodical.
Ask clarifying questions. Suggest diagnostic steps. Explain the root cause.""",
        
        ChatMode.BRAINSTORM: """Facilitate creative thinking. Build on ideas. Ask "what if" questions.
Encourage unconventional approaches. Connect disparate concepts."""
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
        system_prompt = self._build_system_prompt(mode, style, emotional_state, context)
        user_context = self._build_user_context(context, reasoning_chain)
        
        full_prompt = f"""{system_prompt}

{user_context}

Student's message: {user_input}

Provide a helpful, educational response:"""
        
        try:
            response = self.ai_client.generate(
                full_prompt, 
                max_tokens=1200, 
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
        
        # Recent conversation
        history = context.get("conversation_history", [])[-3:]
        if history:
            conv = "\n".join([
                f"Student: {h.get('user', '')}\nTutor: {h.get('assistant', '')}"
                for h in history
            ])
            sections.append(f"Recent conversation:\n{conv}")
        
        # Knowledge context
        topics = context.get("topics_of_interest", [])[:5]
        if topics:
            sections.append(f"Student's recent topics: {', '.join(topics)}")
        
        # Struggled concepts
        struggled = context.get("struggled_concepts", [])[:3]
        if struggled:
            sections.append(f"Areas needing attention: {', '.join(struggled)}")
        
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
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.analyzer = ConversationAnalyzer(ai_client)
        self.generator = ResponseGenerator(ai_client)
        
        super().__init__(
            agent_type=AgentType.CHAT,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(ChatAgentState)
        
        # Add nodes
        graph.add_node("load_memory", self._load_memory_context)
        graph.add_node("analyze_input", self._analyze_input)
        graph.add_node("determine_mode", self._determine_mode)
        graph.add_node("build_reasoning", self._build_reasoning_chain)
        graph.add_node("generate_response", self._generate_response)
        graph.add_node("enhance_response", self._enhance_response)
        graph.add_node("reflect_and_improve", self._reflect_and_improve)
        graph.add_node("prepare_followups", self._prepare_followups)
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("finalize", self._finalize_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("load_memory")
        
        # Add edges
        graph.add_edge("load_memory", "analyze_input")
        graph.add_edge("analyze_input", "determine_mode")
        graph.add_edge("determine_mode", "build_reasoning")
        graph.add_edge("build_reasoning", "generate_response")
        graph.add_edge("generate_response", "enhance_response")
        graph.add_conditional_edges(
            "enhance_response",
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
        """Load context from unified memory system"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        query = state.get("user_input", "")
        
        state["execution_path"] = ["chat:load_memory"]
        
        if self.memory_manager:
            try:
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
                
                logger.debug(f"Loaded memory context for user {user_id}")
                
            except Exception as e:
                logger.error(f"Memory load failed: {e}")
                state["memory_context"] = {}
                state["errors"] = state.get("errors", []) + [f"Memory load: {str(e)}"]
        
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
    
    async def _generate_response(self, state: ChatAgentState) -> ChatAgentState:
        """Generate the main response"""
        user_input = state.get("user_input", "")
        mode = ChatMode(state.get("chat_mode", "tutoring"))
        style = ResponseStyle(state.get("response_style", "conversational"))
        emotion = EmotionalState(state.get("emotional_state", "neutral"))
        
        context = {
            "conversation_history": state.get("conversation_history", []),
            "user_preferences": state.get("user_preferences", {}),
            "topics_of_interest": state.get("related_concepts", []),
            "struggled_concepts": state.get("knowledge_gaps", [])
        }
        
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
        
        # Ensure response isn't too long
        if len(response) > 2000:
            # Truncate gracefully
            sentences = response.split('. ')
            truncated = []
            length = 0
            for s in sentences:
                if length + len(s) < 1800:
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
                
                improved = self.ai_client.generate(improve_prompt, max_tokens=1000, temperature=0.7)
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
        """Finalize response with metadata"""
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
            "timestamp": datetime.utcnow().isoformat()
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
    memory_manager=None
) -> ChatAgent:
    """Factory function to create and register the chat agent"""
    agent = ChatAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager
    )
    agent_registry.register(agent)
    logger.info(" Advanced Chat Agent registered")
    return agent



