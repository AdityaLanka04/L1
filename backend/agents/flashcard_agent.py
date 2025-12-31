"""
Advanced Flashcard Agent
LangGraph-based agent for intelligent flashcard generation, spaced repetition,
and adaptive learning with knowledge graph integration.
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, Literal, TypedDict
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .memory.unified_memory import MemoryType

logger = logging.getLogger(__name__)


# ==================== Enums & Types ====================

class FlashcardAction(str, Enum):
    """Actions the flashcard agent can perform"""
    GENERATE = "generate"           # Generate new flashcards
    REVIEW = "review"               # Review/study session
    ANALYZE = "analyze"             # Analyze performance
    RECOMMEND = "recommend"         # Recommend cards to study
    EXPLAIN = "explain"             # Explain a card's concept
    IMPROVE = "improve"             # Improve existing cards
    SCHEDULE = "schedule"           # Schedule review sessions


class DifficultyLevel(str, Enum):
    """Flashcard difficulty levels"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class CardQuality(str, Enum):
    """Quality rating for spaced repetition"""
    AGAIN = "again"       # Complete blackout, wrong response
    HARD = "hard"         # Correct but with difficulty
    GOOD = "good"         # Correct with some hesitation
    EASY = "easy"         # Perfect, instant recall


# ==================== State Definition ====================

class FlashcardAgentState(TypedDict, total=False):
    """State for the flashcard agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Action context
    action: str
    action_params: Dict[str, Any]
    
    # Content
    source_content: str
    topic: str
    
    # Generation
    generated_cards: List[Dict[str, str]]
    card_count: int
    difficulty: str
    depth_level: str  # surface, standard, deep
    
    # Review session
    current_card: Dict[str, Any]
    review_results: List[Dict[str, Any]]
    session_stats: Dict[str, Any]
    
    # Analysis
    performance_analysis: Dict[str, Any]
    weak_areas: List[str]
    strong_areas: List[str]
    
    # Recommendations
    recommended_cards: List[Dict[str, Any]]
    study_schedule: Dict[str, Any]
    
    # Memory context
    memory_context: Dict[str, Any]
    user_mastery: Dict[str, float]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Spaced Repetition Engine ====================

@dataclass
class CardReviewData:
    """Data for spaced repetition calculations"""
    card_id: int
    ease_factor: float = 2.5
    interval_days: int = 1
    repetitions: int = 0
    last_review: Optional[datetime] = None
    next_review: Optional[datetime] = None


class SpacedRepetitionEngine:
    """
    SM-2 based spaced repetition algorithm with enhancements.
    Calculates optimal review intervals based on performance.
    """
    
    MIN_EASE = 1.3
    MAX_EASE = 3.0
    
    def calculate_next_review(
        self,
        card_data: CardReviewData,
        quality: CardQuality
    ) -> CardReviewData:
        """Calculate next review date using modified SM-2 algorithm"""
        quality_map = {
            CardQuality.AGAIN: 0,
            CardQuality.HARD: 2,
            CardQuality.GOOD: 3,
            CardQuality.EASY: 5
        }
        q = quality_map[quality]
        
        # Update ease factor
        new_ease = card_data.ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ease = max(self.MIN_EASE, min(self.MAX_EASE, new_ease))
        
        # Calculate interval
        if quality == CardQuality.AGAIN:
            # Reset on failure
            new_interval = 1
            new_reps = 0
        else:
            new_reps = card_data.repetitions + 1
            
            if new_reps == 1:
                new_interval = 1
            elif new_reps == 2:
                new_interval = 6
            else:
                new_interval = int(card_data.interval_days * new_ease)
            
            # Bonus for easy
            if quality == CardQuality.EASY:
                new_interval = int(new_interval * 1.3)
        
        # Calculate next review date
        next_review = datetime.utcnow() + timedelta(days=new_interval)
        
        return CardReviewData(
            card_id=card_data.card_id,
            ease_factor=new_ease,
            interval_days=new_interval,
            repetitions=new_reps,
            last_review=datetime.utcnow(),
            next_review=next_review
        )
    
    def get_due_cards(
        self,
        cards: List[CardReviewData],
        limit: int = 20
    ) -> List[CardReviewData]:
        """Get cards due for review"""
        now = datetime.utcnow()
        due = [c for c in cards if c.next_review is None or c.next_review <= now]
        
        # Sort by urgency (most overdue first)
        due.sort(key=lambda c: c.next_review or datetime.min)
        
        return due[:limit]
    
    def calculate_retention_rate(self, review_history: List[Dict]) -> float:
        """Calculate overall retention rate"""
        if not review_history:
            return 0.0
        
        correct = sum(1 for r in review_history if r.get("quality") in ["good", "easy"])
        return correct / len(review_history)


# ==================== Flashcard Generator ====================

class FlashcardGenerator:
    """Generates high-quality flashcards using AI"""
    
    # Depth level descriptions for prompt customization
    DEPTH_DESCRIPTIONS = {
        "surface": {
            "description": "Basic recall and simple definitions",
            "question_style": "simple, direct questions testing basic recall",
            "answer_style": "brief, 1-2 sentence answers with key facts only",
            "focus": "terminology, basic definitions, simple facts"
        },
        "standard": {
            "description": "Balanced understanding and application",
            "question_style": "clear questions testing understanding and basic application",
            "answer_style": "concise 2-3 sentence answers with explanations",
            "focus": "concepts, relationships, and practical understanding"
        },
        "deep": {
            "description": "Advanced analysis and synthesis",
            "question_style": "thought-provoking questions requiring analysis, comparison, or synthesis",
            "answer_style": "detailed 3-5 sentence answers with reasoning and examples",
            "focus": "underlying principles, edge cases, connections between concepts, and real-world applications"
        }
    }
    
    GENERATION_PROMPT = """Generate {count} high-quality flashcards about: {topic}

Difficulty level: {difficulty}
Depth level: {depth} - {depth_description}

DEPTH REQUIREMENTS:
- Question style: {question_style}
- Answer style: {answer_style}
- Focus on: {focus}
{context}

RULES:
1. Questions should be clear, specific, and testable
2. Match the depth level requirements exactly
3. Cover key concepts progressively
4. Avoid redundancy
5. For {depth} depth: {depth_specific_rule}

Return ONLY valid JSON:
{{
  "flashcards": [
    {{"question": "...", "answer": "...", "difficulty": "{difficulty}", "concept": "main concept"}},
    ...
  ]
}}"""

    CONTENT_PROMPT = """Extract {count} flashcards from this content:

CONTENT:
{content}

Difficulty: {difficulty}
Depth level: {depth} - {depth_description}

DEPTH REQUIREMENTS:
- Question style: {question_style}
- Answer style: {answer_style}
- Focus on: {focus}

RULES:
1. Focus on key facts, definitions, and concepts
2. Match the depth level requirements exactly
3. Answers must be accurate to the source
4. For {depth} depth: {depth_specific_rule}

Return ONLY valid JSON:
{{
  "flashcards": [
    {{"question": "...", "answer": "...", "difficulty": "{difficulty}", "concept": "main concept"}},
    ...
  ]
}}"""

    IMPROVE_PROMPT = """Improve this flashcard:

Original Question: {question}
Original Answer: {answer}

Issues to address:
{issues}

Return improved version as JSON:
{{"question": "improved question", "answer": "improved answer", "improvements": ["what was improved"]}}"""

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def _get_depth_specific_rule(self, depth: str) -> str:
        """Get depth-specific generation rule"""
        rules = {
            "surface": "Keep questions simple - test recognition and basic recall only",
            "standard": "Balance recall with understanding - include 'why' and 'how' questions",
            "deep": "Challenge critical thinking - include analysis, comparison, and application questions"
        }
        return rules.get(depth, rules["standard"])
    
    def generate_from_topic(
        self,
        topic: str,
        count: int = 10,
        difficulty: str = "medium",
        depth: str = "standard",
        context: str = ""
    ) -> List[Dict[str, str]]:
        """Generate flashcards from a topic with depth customization"""
        context_str = f"\nAdditional context: {context}" if context else ""
        
        depth_info = self.DEPTH_DESCRIPTIONS.get(depth, self.DEPTH_DESCRIPTIONS["standard"])
        
        prompt = self.GENERATION_PROMPT.format(
            count=count,
            topic=topic,
            difficulty=difficulty,
            depth=depth,
            depth_description=depth_info["description"],
            question_style=depth_info["question_style"],
            answer_style=depth_info["answer_style"],
            focus=depth_info["focus"],
            depth_specific_rule=self._get_depth_specific_rule(depth),
            context=context_str
        )
        
        return self._generate_and_parse(prompt, count)
    
    def generate_from_content(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium",
        depth: str = "standard"
    ) -> List[Dict[str, str]]:
        """Generate flashcards from content/text with depth customization"""
        depth_info = self.DEPTH_DESCRIPTIONS.get(depth, self.DEPTH_DESCRIPTIONS["standard"])
        
        prompt = self.CONTENT_PROMPT.format(
            count=count,
            content=content[:3000],
            difficulty=difficulty,
            depth=depth,
            depth_description=depth_info["description"],
            question_style=depth_info["question_style"],
            answer_style=depth_info["answer_style"],
            focus=depth_info["focus"],
            depth_specific_rule=self._get_depth_specific_rule(depth)
        )
        
        return self._generate_and_parse(prompt, count)
    
    def improve_card(
        self,
        question: str,
        answer: str,
        issues: List[str]
    ) -> Dict[str, Any]:
        """Improve an existing flashcard"""
        prompt = self.IMPROVE_PROMPT.format(
            question=question,
            answer=answer,
            issues="\n".join(f"- {i}" for i in issues)
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=300, temperature=0.5)
            return self._parse_json(response)
        except Exception as e:
            logger.error(f"Card improvement failed: {e}")
            return {"question": question, "answer": answer, "improvements": []}
    
    def _generate_and_parse(self, prompt: str, count: int) -> List[Dict[str, str]]:
        """Generate and parse flashcards"""
        try:
            response = self.ai_client.generate(prompt, max_tokens=1500, temperature=0.7)
            data = self._parse_json(response)
            
            cards = data.get("flashcards", [])
            
            # Validate and clean
            valid_cards = []
            for card in cards[:count]:
                if "question" in card and "answer" in card:
                    # Trim long answers
                    answer = card["answer"]
                    if len(answer) > 400:
                        answer = answer[:400] + "..."
                    
                    valid_cards.append({
                        "question": card["question"].strip(),
                        "answer": answer.strip(),
                        "difficulty": card.get("difficulty", "medium"),
                        "concept": card.get("concept", "")
                    })
            
            return valid_cards
            
        except Exception as e:
            logger.error(f"Flashcard generation failed: {e}")
            return []
    
    def _parse_json(self, response: str) -> Dict:
        """Parse JSON from AI response"""
        json_str = response.strip()
        
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        # Try to find JSON object
        match = re.search(r'\{[\s\S]*\}', json_str)
        if match:
            return json.loads(match.group())
        
        return {}


# ==================== Performance Analyzer ====================

class PerformanceAnalyzer:
    """Analyzes flashcard study performance"""
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def analyze_session(
        self,
        review_results: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze a study session"""
        if not review_results:
            return {"status": "no_data"}
        
        total = len(review_results)
        correct = sum(1 for r in review_results if r.get("correct", False))
        
        # Calculate by difficulty
        by_difficulty = {}
        for result in review_results:
            diff = result.get("difficulty", "medium")
            if diff not in by_difficulty:
                by_difficulty[diff] = {"total": 0, "correct": 0}
            by_difficulty[diff]["total"] += 1
            if result.get("correct"):
                by_difficulty[diff]["correct"] += 1
        
        # Calculate accuracy per difficulty
        difficulty_accuracy = {}
        for diff, stats in by_difficulty.items():
            difficulty_accuracy[diff] = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        
        # Identify weak concepts
        weak_concepts = []
        concept_performance = {}
        for result in review_results:
            concept = result.get("concept", "general")
            if concept not in concept_performance:
                concept_performance[concept] = {"total": 0, "correct": 0}
            concept_performance[concept]["total"] += 1
            if result.get("correct"):
                concept_performance[concept]["correct"] += 1
        
        for concept, stats in concept_performance.items():
            accuracy = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            if accuracy < 0.6 and stats["total"] >= 2:
                weak_concepts.append({
                    "concept": concept,
                    "accuracy": accuracy,
                    "attempts": stats["total"]
                })
        
        # Calculate average response time
        times = [r.get("response_time_ms", 0) for r in review_results if r.get("response_time_ms")]
        avg_time = sum(times) / len(times) if times else 0
        
        return {
            "total_cards": total,
            "correct": correct,
            "accuracy": correct / total if total > 0 else 0,
            "difficulty_breakdown": difficulty_accuracy,
            "weak_concepts": weak_concepts,
            "average_response_time_ms": avg_time,
            "session_duration_minutes": sum(times) / 60000 if times else 0
        }
    
    def get_study_recommendations(
        self,
        performance: Dict[str, Any],
        user_mastery: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Generate study recommendations"""
        recommendations = []
        
        # Recommend weak concepts
        for weak in performance.get("weak_concepts", []):
            recommendations.append({
                "type": "review_concept",
                "concept": weak["concept"],
                "reason": f"Low accuracy ({weak['accuracy']:.0%}) on {weak['attempts']} attempts",
                "priority": "high"
            })
        
        # Recommend based on difficulty performance
        diff_breakdown = performance.get("difficulty_breakdown", {})
        if diff_breakdown.get("hard", 1) < 0.5:
            recommendations.append({
                "type": "practice_difficulty",
                "difficulty": "medium",
                "reason": "Struggling with hard cards - practice medium first",
                "priority": "medium"
            })
        
        # Recommend based on mastery
        low_mastery = [c for c, m in user_mastery.items() if m < 0.5]
        if low_mastery:
            recommendations.append({
                "type": "focus_area",
                "concepts": low_mastery[:3],
                "reason": "These concepts need more practice",
                "priority": "high"
            })
        
        return recommendations


# ==================== Main Flashcard Agent ====================

class FlashcardAgent(BaseAgent):
    """
    Advanced Flashcard Agent with:
    - AI-powered card generation from topics or content
    - Spaced repetition scheduling (SM-2 algorithm)
    - Performance analysis and weak area detection
    - Knowledge graph integration for concept relationships
    - Memory-aware personalization
    - Study recommendations
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.generator = FlashcardGenerator(ai_client)
        self.sr_engine = SpacedRepetitionEngine()
        self.analyzer = PerformanceAnalyzer(ai_client)
        
        super().__init__(
            agent_type=AgentType.FLASHCARD,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(FlashcardAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("generate_cards", self._generate_cards)
        graph.add_node("process_review", self._process_review)
        graph.add_node("analyze_performance", self._analyze_performance)
        graph.add_node("get_recommendations", self._get_recommendations)
        graph.add_node("explain_concept", self._explain_concept)
        
        # Finalization
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing based on action
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "generate": "generate_cards",
                "review": "process_review",
                "analyze": "analyze_performance",
                "recommend": "get_recommendations",
                "explain": "explain_concept",
                "error": "handle_error"
            }
        )
        
        # All actions lead to memory update
        graph.add_edge("generate_cards", "update_memory")
        graph.add_edge("process_review", "update_memory")
        graph.add_edge("analyze_performance", "update_memory")
        graph.add_edge("get_recommendations", "update_memory")
        graph.add_edge("explain_concept", "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        
    
    # ==================== Graph Nodes ====================
    
    async def _parse_request(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Parse the user request to determine action"""
        user_input = state.get("user_input", "").lower()
        action_params = state.get("action_params", {})
        
        state["execution_path"] = ["flashcard:parse"]
        
        # If action is explicitly provided
        if state.get("action"):
            return state
        
        # Detect action from natural language
        if any(word in user_input for word in ["generate", "create", "make", "new"]):
            state["action"] = FlashcardAction.GENERATE.value
        elif any(word in user_input for word in ["review", "study", "practice", "quiz"]):
            state["action"] = FlashcardAction.REVIEW.value
        elif any(word in user_input for word in ["analyze", "performance", "stats", "progress"]):
            state["action"] = FlashcardAction.ANALYZE.value
        elif any(word in user_input for word in ["recommend", "suggest", "what should"]):
            state["action"] = FlashcardAction.RECOMMEND.value
        elif any(word in user_input for word in ["explain", "help me understand", "what is"]):
            state["action"] = FlashcardAction.EXPLAIN.value
        else:
            state["action"] = FlashcardAction.GENERATE.value  # Default
        
        # Extract topic if generating
        if state["action"] == FlashcardAction.GENERATE.value:
            # Try to extract topic from input
            topic_patterns = [
                r"about (.+?)(?:\.|$)",
                r"on (.+?)(?:\.|$)",
                r"for (.+?)(?:\.|$)",
                r"flashcards? (?:on |about |for )?(.+?)(?:\.|$)"
            ]
            for pattern in topic_patterns:
                match = re.search(pattern, user_input, re.IGNORECASE)
                if match:
                    state["topic"] = match.group(1).strip()
                    break
            
            if not state.get("topic"):
                state["topic"] = action_params.get("topic", user_input)
        
        # Set defaults
        state["card_count"] = action_params.get("card_count", 10)
        state["difficulty"] = action_params.get("difficulty", "medium")
        
        return state
    
    async def _load_context(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Load context from memory and knowledge graph"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        topic = state.get("topic", "")
        
        if self.memory_manager:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="flashcard",
                    query=topic,
                    session_id=session_id
                )
                
                state["memory_context"] = context
                state["user_mastery"] = {}
                
                # Extract mastery from memory
                for concept in context.get("strong_concepts", []):
                    state["user_mastery"][concept] = 0.8
                for concept in context.get("struggled_concepts", []):
                    state["user_mastery"][concept] = 0.3
                
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        # Load from knowledge graph
        if self.knowledge_graph and topic:
            try:
                related = await self.knowledge_graph.get_related_concepts(topic)
                state["memory_context"]["related_concepts"] = related
            except Exception as e:
                logger.debug(f"KG lookup failed: {e}")
        
        state["execution_path"].append("flashcard:context")
        return state
    
    def _get_action_route(self, state: FlashcardAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "generate")
        
        if action == FlashcardAction.GENERATE.value:
            return "generate"
        elif action == FlashcardAction.REVIEW.value:
            return "review"
        elif action == FlashcardAction.ANALYZE.value:
            return "analyze"
        elif action == FlashcardAction.RECOMMEND.value:
            return "recommend"
        elif action == FlashcardAction.EXPLAIN.value:
            return "explain"
        else:
            return "generate"
    
    async def _route_action(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"flashcard:route:{state.get('action')}")
        return state
    
    async def _generate_cards(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Generate flashcards"""
        topic = state.get("topic", "")
        content = state.get("source_content", "")
        count = state.get("card_count", 10)
        difficulty = state.get("difficulty", "medium")
        depth_level = state.get("depth_level", "standard")  # surface, standard, deep
        
        # Build context from memory
        context_parts = []
        memory_ctx = state.get("memory_context", {})
        
        if memory_ctx.get("related_concepts"):
            context_parts.append(f"Related concepts: {', '.join(memory_ctx['related_concepts'][:5])}")
        
        if state.get("user_mastery"):
            weak = [c for c, m in state["user_mastery"].items() if m < 0.5]
            if weak:
                context_parts.append(f"Focus on: {', '.join(weak[:3])}")
        
        context = "\n".join(context_parts)
        
        # Generate cards with depth level
        if content:
            cards = self.generator.generate_from_content(content, count, difficulty, depth_level)
        else:
            cards = self.generator.generate_from_topic(topic, count, difficulty, depth_level, context)
        
        state["generated_cards"] = cards
        state["response_data"] = {
            "action": "generate",
            "cards": cards,
            "count": len(cards),
            "topic": topic,
            "difficulty": difficulty,
            "depth_level": depth_level
        }
        
        state["execution_path"].append("flashcard:generate")
        logger.info(f"Generated {len(cards)} flashcards on '{topic}'")
        
        return state
    
    async def _process_review(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Process a review session result"""
        review_results = state.get("review_results", [])
        action_params = state.get("action_params", {})
        
        # If we have review results, analyze them
        if review_results:
            analysis = self.analyzer.analyze_session(review_results)
            state["session_stats"] = analysis
            
            # Update spaced repetition data
            for result in review_results:
                card_id = result.get("card_id")
                quality = result.get("quality", "good")
                
                try:
                    quality_enum = CardQuality(quality)
                except ValueError:
                    quality_enum = CardQuality.GOOD
                
                # Calculate next review (would save to DB in production)
                card_data = CardReviewData(card_id=card_id)
                updated = self.sr_engine.calculate_next_review(card_data, quality_enum)
                
                result["next_review"] = updated.next_review.isoformat() if updated.next_review else None
            
            state["response_data"] = {
                "action": "review",
                "session_stats": analysis,
                "cards_reviewed": len(review_results),
                "accuracy": analysis.get("accuracy", 0)
            }
        else:
            # Return cards due for review
            state["response_data"] = {
                "action": "review",
                "message": "Ready to start review session",
                "cards_due": action_params.get("cards_due", 0)
            }
        
        state["execution_path"].append("flashcard:review")
        return state
    
    async def _analyze_performance(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Analyze overall flashcard performance"""
        user_id = state.get("user_id")
        memory_ctx = state.get("memory_context", {})
        
        # Get performance data from memory
        analysis = {
            "strong_areas": memory_ctx.get("strong_concepts", []),
            "weak_areas": memory_ctx.get("struggled_concepts", []),
            "topics_studied": memory_ctx.get("topics_of_interest", []),
            "mastery_levels": state.get("user_mastery", {})
        }
        
        # Generate insights
        insights = []
        if analysis["weak_areas"]:
            insights.append(f"Focus on improving: {', '.join(analysis['weak_areas'][:3])}")
        if analysis["strong_areas"]:
            insights.append(f"You're doing well with: {', '.join(analysis['strong_areas'][:3])}")
        
        state["performance_analysis"] = analysis
        state["weak_areas"] = analysis["weak_areas"]
        state["strong_areas"] = analysis["strong_areas"]
        
        state["response_data"] = {
            "action": "analyze",
            "analysis": analysis,
            "insights": insights
        }
        
        state["execution_path"].append("flashcard:analyze")
        return state
    
    async def _get_recommendations(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Get study recommendations"""
        performance = state.get("performance_analysis", {})
        user_mastery = state.get("user_mastery", {})
        
        if not performance:
            # Run analysis first
            state = await self._analyze_performance(state)
            performance = state.get("performance_analysis", {})
        
        recommendations = self.analyzer.get_study_recommendations(performance, user_mastery)
        
        # Add time-based recommendations
        now = datetime.utcnow()
        hour = now.hour
        
        if 6 <= hour < 12:
            recommendations.append({
                "type": "timing",
                "message": "Morning is great for learning new concepts!",
                "priority": "low"
            })
        elif 14 <= hour < 18:
            recommendations.append({
                "type": "timing",
                "message": "Afternoon is ideal for review sessions",
                "priority": "low"
            })
        
        state["recommended_cards"] = recommendations
        state["response_data"] = {
            "action": "recommend",
            "recommendations": recommendations,
            "count": len(recommendations)
        }
        
        state["execution_path"].append("flashcard:recommend")
        return state
    
    async def _explain_concept(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Explain a concept from a flashcard"""
        topic = state.get("topic", "")
        user_input = state.get("user_input", "")
        
        prompt = f"""Explain this concept clearly for a student:

Concept: {topic or user_input}

Provide:
1. A clear definition
2. Why it's important
3. A simple example
4. How it connects to related concepts

Keep the explanation concise but thorough."""
        
        try:
            explanation = self.ai_client.generate(prompt, max_tokens=500, temperature=0.7)
            
            state["response_data"] = {
                "action": "explain",
                "concept": topic or user_input,
                "explanation": explanation
            }
        except Exception as e:
            logger.error(f"Explanation failed: {e}")
            state["response_data"] = {
                "action": "explain",
                "error": str(e)
            }
        
        state["execution_path"].append("flashcard:explain")
        return state
    
    async def _update_memory(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Update memory with interaction data"""
        user_id = state.get("user_id")
        action = state.get("action")
        
        if self.memory_manager and user_id:
            try:
                # Store flashcard interaction
                topics = []
                if state.get("topic"):
                    topics.append(state["topic"])
                if state.get("generated_cards"):
                    for card in state["generated_cards"][:3]:
                        if card.get("concept"):
                            topics.append(card["concept"])
                
                await self.memory_manager.memory.store(
                    user_id=user_id,
                    memory_type=MemoryType.FLASHCARD,
                    content=f"Flashcard {action}: {state.get('topic', 'session')}",
                    metadata={
                        "action": action,
                        "cards_count": len(state.get("generated_cards", [])),
                        "topic": state.get("topic"),
                        "accuracy": state.get("session_stats", {}).get("accuracy")
                    },
                    importance=0.6,
                    source_agent="flashcard",
                    tags=topics
                )
                
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("flashcard:memory")
        return state
    
    async def _format_response(self, state: FlashcardAgentState) -> FlashcardAgentState:
        """Format the final response"""
        action = state.get("action")
        response_data = state.get("response_data", {})
        
        # Generate natural language response
        if action == FlashcardAction.GENERATE.value:
            cards = response_data.get("cards", [])
            topic = response_data.get("topic", "the topic")
            state["final_response"] = f"Generated {len(cards)} flashcards on '{topic}'. Ready to study!"
            
        elif action == FlashcardAction.REVIEW.value:
            stats = response_data.get("session_stats", {})
            if stats:
                accuracy = stats.get("accuracy", 0) * 100
                state["final_response"] = f"Review session complete! Accuracy: {accuracy:.0f}%"
            else:
                state["final_response"] = "Ready to start your review session."
                
        elif action == FlashcardAction.ANALYZE.value:
            insights = response_data.get("insights", [])
            state["final_response"] = " ".join(insights) if insights else "Analysis complete."
            
        elif action == FlashcardAction.RECOMMEND.value:
            recs = response_data.get("recommendations", [])
            if recs:
                top_rec = recs[0]
                state["final_response"] = f"Recommendation: {top_rec.get('reason', 'Keep studying!')}"
            else:
                state["final_response"] = "You're on track! Keep up the good work."
                
        elif action == FlashcardAction.EXPLAIN.value:
            state["final_response"] = response_data.get("explanation", "")
        
        state["response_metadata"] = {
            "success": True,
            "action": action,
            "execution_path": state.get("execution_path", []),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return state
    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        return state
    
    async def _format_response(self, state: AgentState) -> AgentState:
        return state


# ==================== Factory Function ====================

def create_flashcard_agent(
    ai_client,
    knowledge_graph=None,
    memory_manager=None,
    db_session_factory=None
) -> FlashcardAgent:
    """Factory function to create and register the flashcard agent"""
    agent = FlashcardAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
    agent_registry.register(agent)
    logger.info(" Flashcard Agent registered")
    return agent



