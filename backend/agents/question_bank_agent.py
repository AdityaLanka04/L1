"""
Enhanced Question Bank Agent
LangGraph-based agent for intelligent question generation with:
- Agentic multi-step pipeline (Analyze → Plan → Generate → Validate)
- Master Agent integration for user context
- Unified memory system
- Adaptive difficulty based on user performance
- Quality scoring and Bloom's taxonomy tagging
- RAG-enhanced context retrieval for better question generation
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .memory.unified_memory import MemoryType
from .rag.advanced_rag import AdvancedRAGSystem, SearchMode

logger = logging.getLogger(__name__)


class QuestionBankAgentState(TypedDict, total=False):
    """State for the enhanced question bank agent"""
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    action: str
    action_params: Dict[str, Any]
    
    # Source content
    source_type: str
    source_id: Optional[Any]
    sources: List[Dict[str, Any]]
    content: str
    title: str
    
    # Generation parameters
    question_count: int
    question_types: List[str]
    difficulty_mix: Dict[str, int]
    topics: List[str]
    custom_prompt: str
    reference_document_id: Optional[int]
    use_rag: bool  # Whether to use RAG for context enhancement

    # User context from Master Agent
    user_profile: Dict[str, Any]
    weak_topics: List[str]
    strong_topics: List[str]
    mastery_levels: Dict[str, float]
    
    # RAG-enhanced context
    rag_context: str
    rag_related_concepts: List[str]
    rag_learning_path: List[Dict[str, Any]]
    
    # Agentic pipeline state
    content_analysis: Dict[str, Any]
    question_blueprint: List[Dict[str, Any]]
    generated_questions: List[Dict[str, Any]]
    validated_questions: List[Dict[str, Any]]
    
    # Search/filter
    search_query: str
    filters: Dict[str, Any]
    
    # Results
    questions: List[Dict[str, Any]]
    response_data: Dict[str, Any]
    final_response: str
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


class QuestionBankAgent(BaseAgent):
    """
    Enhanced Question Bank Agent with:
    - Agentic question generation pipeline
    - Master Agent integration for personalization
    - Unified memory for cross-agent learning
    - Quality validation and Bloom's taxonomy
    - RAG-enhanced context retrieval for better questions
    """
    
    def __init__(
        self,
        ai_client: Any,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        master_agent: Optional[Any] = None,
        rag_system: Optional[AdvancedRAGSystem] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.master_agent = master_agent
        self.rag_system = rag_system  # RAG system for context-aware generation
        
        super().__init__(
            agent_type=AgentType.QUESTION_BANK,
            ai_client=ai_client,
            checkpointer=checkpointer or MemorySaver()
        )
        
        logger.info("Enhanced Question Bank Agent initialized with RAG support")

    def set_rag_system(self, rag_system: AdvancedRAGSystem) -> None:
        """Set or update the RAG system (useful for late initialization)"""
        self.rag_system = rag_system
        logger.info("RAG system connected to Question Bank Agent")

    def _build_graph(self) -> None:
        """Build the LangGraph state machine with agentic pipeline"""
        graph = StateGraph(QuestionBankAgentState)
        
        # Core nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_user_context", self._load_user_context)
        graph.add_node("retrieve_rag_context", self._retrieve_rag_context)  # NEW: RAG context retrieval
        graph.add_node("route_action", self._route_action)
        
        # Agentic generation pipeline
        graph.add_node("analyze_content", self._analyze_content)
        graph.add_node("create_blueprint", self._create_blueprint)
        graph.add_node("generate_questions", self._generate_from_blueprint)
        graph.add_node("validate_questions", self._validate_questions)
        graph.add_node("save_questions", self._save_questions)
        
        # Other actions
        graph.add_node("search_questions", self._search_questions)
        graph.add_node("analyze_performance", self._analyze_performance)
        graph.add_node("get_recommendations", self._get_recommendations)
        graph.add_node("adaptive_generate", self._adaptive_generate)
        
        # Finalization
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("format_response", self._format_response)
        
        # Entry point
        graph.set_entry_point("parse_request")
        
        # Edges - now includes RAG context retrieval
        graph.add_edge("parse_request", "load_user_context")
        graph.add_edge("load_user_context", "retrieve_rag_context")
        graph.add_edge("retrieve_rag_context", "route_action")
        
        # Conditional routing based on action
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "generate": "analyze_content",
                "smart_generate": "analyze_content",
                "adaptive": "adaptive_generate",
                "search": "search_questions",
                "analyze": "analyze_performance",
                "recommend": "get_recommendations"
            }
        )
        
        # Agentic pipeline flow
        graph.add_edge("analyze_content", "create_blueprint")
        graph.add_edge("create_blueprint", "generate_questions")
        graph.add_edge("generate_questions", "validate_questions")
        graph.add_edge("validate_questions", "save_questions")
        graph.add_edge("save_questions", "update_memory")
        
        # Other actions to memory
        graph.add_edge("adaptive_generate", "update_memory")
        graph.add_edge("search_questions", "update_memory")
        graph.add_edge("analyze_performance", "update_memory")
        graph.add_edge("get_recommendations", "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        logger.info("Question Bank Agent graph compiled with RAG integration")

    def _get_action_route(self, state: QuestionBankAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "generate")
        routes = {
            "generate": "generate",
            "smart_generate": "smart_generate",
            "adaptive_generate": "adaptive",
            "search": "search",
            "analyze": "analyze",
            "recommend": "recommend"
        }
        return routes.get(action, "generate")
    
    async def _parse_request(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Parse and validate the request"""
        state["execution_path"] = ["qb:parse"]
        state["response_data"] = state.get("response_data") or {}
        state["errors"] = []
        
        # Set defaults
        state.setdefault("question_count", 10)
        state.setdefault("question_types", ["multiple_choice"])
        state.setdefault("difficulty_mix", {"easy": 30, "medium": 50, "hard": 20})
        state.setdefault("topics", [])
        state.setdefault("custom_prompt", "")
        state.setdefault("use_rag", True)  # Enable RAG by default
        
        # Initialize RAG context fields
        state.setdefault("rag_context", "")
        state.setdefault("rag_related_concepts", [])
        state.setdefault("rag_learning_path", [])
        
        logger.info(f"Parsed request: action={state.get('action')}, count={state.get('question_count')}, use_rag={state.get('use_rag')}")
        return state
    
    async def _load_user_context(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Load user context from Master Agent and Memory"""
        user_id = state.get("user_id")
        state["execution_path"].append("qb:load_context")
        
        # Initialize defaults
        state["user_profile"] = {}
        state["weak_topics"] = []
        state["strong_topics"] = []
        state["mastery_levels"] = {}
        
        # Try to get context from Master Agent
        if self.master_agent and user_id:
            try:
                master_state = {
                    "user_id": user_id,
                    "action": "get_full_context",
                    "user_input": "get_full_context"
                }
                result = await self.master_agent.invoke(master_state)
                
                if result.success:
                    data = result.metadata.get("response_data", {})
                    learning_state = data.get("learning_state", {})
                    
                    state["user_profile"] = data.get("profile", {})
                    state["weak_topics"] = learning_state.get("weak_topics", [])
                    state["strong_topics"] = learning_state.get("strong_topics", [])
                    state["mastery_levels"] = learning_state.get("mastery_levels", {})
                    
                    logger.info(f"Loaded user context: {len(state['weak_topics'])} weak, {len(state['strong_topics'])} strong topics")
            except Exception as e:
                logger.warning(f"Could not load Master Agent context: {e}")
        
        # Also get from memory manager
        if self.memory_manager and user_id:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="question_bank",
                    query=state.get("content", "")[:500]
                )
                state["memory_context"] = context
            except Exception as e:
                logger.warning(f"Memory context load failed: {e}")
        
        return state

    async def _route_action(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"qb:route:{state.get('action')}")
        return state

    async def _retrieve_rag_context(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """
        NEW: Retrieve relevant context using the RAG system.
        This enhances question generation with related content from notes, flashcards, etc.
        """
        user_id = state.get("user_id")
        content = state.get("content", "")
        topics = state.get("topics", [])
        weak_topics = state.get("weak_topics", [])
        use_rag = state.get("use_rag", True)
        
        state["execution_path"].append("qb:rag_context")
        
        # Skip RAG if disabled or no RAG system available
        if not use_rag or not self.rag_system:
            logger.info("RAG context retrieval skipped (disabled or unavailable)")
            return state
        
        try:
            # Build a query for RAG based on content and topics
            rag_query_parts = []
            
            # Add topics to query
            if topics:
                rag_query_parts.append(f"Topics: {', '.join(topics[:5])}")
            
            # Add weak topics for targeted retrieval
            if weak_topics:
                rag_query_parts.append(f"Focus areas: {', '.join(weak_topics[:3])}")
            
            # Add content summary if available
            if content:
                # Extract key terms from content for better RAG retrieval
                content_preview = content[:1000]
                rag_query_parts.append(f"Content context: {content_preview}")
            
            if not rag_query_parts:
                logger.info("No query context for RAG retrieval")
                return state
            
            rag_query = " | ".join(rag_query_parts)
            
            # Use Agentic RAG for intelligent retrieval
            logger.info(f"Retrieving RAG context for query: {rag_query[:100]}...")
            
            rag_result = await self.rag_system.retrieve(
                query=rag_query,
                user_id=user_id,
                mode=SearchMode.AGENTIC,
                top_k=10,
                use_cache=True,
                context={
                    "topics_of_interest": topics,
                    "weak_topics": weak_topics,
                    "purpose": "question_generation"
                }
            )
            
            # Extract and format RAG results
            rag_results = rag_result.get("results", [])
            
            if rag_results:
                # Build context string from RAG results
                context_parts = []
                related_concepts = set()
                
                for r in rag_results[:7]:  # Limit to top 7 results
                    if hasattr(r, 'content'):
                        content_text = r.content[:500]
                        source = r.source if hasattr(r, 'source') else "unknown"
                        context_parts.append(f"[{source}] {content_text}")
                        
                        # Collect related concepts from graph results
                        if hasattr(r, 'related_concepts') and r.related_concepts:
                            related_concepts.update(r.related_concepts)
                    elif isinstance(r, dict):
                        content_text = r.get("content", "")[:500]
                        source = r.get("source", "unknown")
                        context_parts.append(f"[{source}] {content_text}")
                        
                        if r.get("related_concepts"):
                            related_concepts.update(r["related_concepts"])
                
                state["rag_context"] = "\n\n".join(context_parts)
                state["rag_related_concepts"] = list(related_concepts)[:10]
                
                logger.info(f"RAG context retrieved: {len(context_parts)} items, {len(related_concepts)} related concepts")
            
            # Try to get learning path from GraphRAG if available
            if self.rag_system.graph_rag and topics:
                try:
                    learning_path = await self.rag_system.graph_rag.get_learning_path(
                        target_concept=topics[0],
                        user_id=user_id
                    )
                    state["rag_learning_path"] = learning_path[:5] if learning_path else []
                except Exception as e:
                    logger.warning(f"Learning path retrieval failed: {e}")
            
            # Log RAG strategy used
            strategy = rag_result.get("strategy", {})
            logger.info(f"RAG strategy used: {strategy.get('method', 'unknown')}, reasoning: {strategy.get('reasoning', 'N/A')}")
            
        except Exception as e:
            logger.error(f"RAG context retrieval failed: {e}")
            # Don't fail the pipeline, just continue without RAG context
            state["errors"].append(f"RAG context retrieval warning: {str(e)}")
        
        return state
    
    # ==================== AGENTIC GENERATION PIPELINE ====================
    
    async def _analyze_content(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """STEP 1: Analyze content to extract testable elements, enhanced with RAG context"""
        content = state.get("content", "")
        rag_context = state.get("rag_context", "")
        rag_related_concepts = state.get("rag_related_concepts", [])
        state["execution_path"].append("qb:analyze")
        
        if not content:
            # Try to fetch content from sources
            content = await self._fetch_content_from_sources(state)
            state["content"] = content
        
        if not content or len(content) < 50:
            state["errors"].append("Insufficient content for question generation")
            state["content_analysis"] = {}
            return state
        
        # Truncate for analysis prompt
        analysis_content = content[:8000]
        
        # Build RAG-enhanced analysis prompt
        rag_section = ""
        if rag_context:
            rag_section = f"""
ADDITIONAL CONTEXT FROM USER'S LEARNING MATERIALS (RAG-retrieved):
{rag_context[:3000]}

RELATED CONCEPTS FROM KNOWLEDGE GRAPH:
{', '.join(rag_related_concepts) if rag_related_concepts else 'None identified'}

Use this additional context to:
1. Identify connections between the main content and user's existing knowledge
2. Find opportunities for questions that bridge concepts
3. Prioritize testable elements that relate to the user's learning path
"""
        
        analysis_prompt = f"""Analyze this educational content and extract ALL testable elements.

CONTENT:
{analysis_content}
{rag_section}
Extract and categorize testable information. Return JSON:
{{
    "main_topic": "Primary subject",
    "subtopics": ["List of subtopics"],
    "key_facts": [
        {{"fact": "Specific testable fact", "complexity": "simple|moderate|complex"}}
    ],
    "definitions": [
        {{"term": "Term", "definition": "Meaning"}}
    ],
    "relationships": [
        {{"concept1": "First", "relationship": "relates to", "concept2": "Second", "complexity": "simple|moderate|complex"}}
    ],
    "processes": [
        {{"name": "Process name", "steps": ["step1", "step2"], "complexity": "simple|moderate|complex"}}
    ],
    "cause_effects": [
        {{"cause": "Cause", "effect": "Effect", "complexity": "simple|moderate|complex"}}
    ],
    "numerical_data": [
        {{"value": "Number/stat", "context": "What it represents"}}
    ],
    "cross_concept_connections": [
        {{"from_concept": "Concept from content", "to_concept": "Related concept from RAG context", "connection_type": "prerequisite|extension|application"}}
    ]
}}

Extract at least 15-20 testable elements. Be specific with names, dates, numbers.
{"Include cross-concept connections if RAG context was provided." if rag_context else ""}
Return ONLY valid JSON."""

        try:
            response = self.ai_client.generate(analysis_prompt, max_tokens=3000, temperature=0.3)
            
            # Clean and parse
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            analysis = json.loads(response)
            state["content_analysis"] = analysis
            
            total_elements = (
                len(analysis.get("key_facts", [])) +
                len(analysis.get("definitions", [])) +
                len(analysis.get("relationships", [])) +
                len(analysis.get("processes", [])) +
                len(analysis.get("cause_effects", []))
            )
            logger.info(f"Content analysis: {total_elements} testable elements extracted")
            
        except Exception as e:
            logger.error(f"Content analysis failed: {e}")
            state["content_analysis"] = {"main_topic": "Unknown", "key_facts": [], "definitions": []}
        
        return state

    async def _create_blueprint(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """STEP 2: Create question blueprint based on analysis and user context"""
        analysis = state.get("content_analysis", {})
        question_count = state.get("question_count", 10)
        difficulty_mix = state.get("difficulty_mix", {"easy": 30, "medium": 50, "hard": 20})
        question_types = state.get("question_types", ["multiple_choice"])
        weak_topics = state.get("weak_topics", [])
        
        state["execution_path"].append("qb:blueprint")
        
        # Calculate counts per difficulty (percentages)
        total = sum(difficulty_mix.values())
        if total > 0 and question_count >= 3:
            easy_count = max(1, round(question_count * difficulty_mix.get("easy", 30) / total))
            medium_count = max(1, round(question_count * difficulty_mix.get("medium", 50) / total))
            hard_count = max(0, question_count - easy_count - medium_count)
        elif question_count == 2:
            easy_count, medium_count, hard_count = 1, 1, 0
        elif question_count == 1:
            easy_count, medium_count, hard_count = 0, 1, 0
        else:
            easy_count = question_count // 3
            medium_count = question_count // 3
            hard_count = question_count - easy_count - medium_count
        
        blueprint = []
        
        # Categorize sources by complexity
        easy_sources = []
        medium_sources = []
        hard_sources = []
        
        for fact in analysis.get("key_facts", []):
            complexity = fact.get("complexity", "moderate")
            entry = {"type": "fact", "data": fact}
            if complexity == "simple":
                easy_sources.append(entry)
            elif complexity == "complex":
                hard_sources.append(entry)
            else:
                medium_sources.append(entry)
        
        for defn in analysis.get("definitions", []):
            easy_sources.append({"type": "definition", "data": defn})
        
        for rel in analysis.get("relationships", []):
            complexity = rel.get("complexity", "moderate")
            entry = {"type": "relationship", "data": rel}
            if complexity == "simple":
                medium_sources.append(entry)
            else:
                hard_sources.append(entry)
        
        for ce in analysis.get("cause_effects", []):
            complexity = ce.get("complexity", "moderate")
            entry = {"type": "cause_effect", "data": ce}
            if complexity == "simple":
                medium_sources.append(entry)
            else:
                hard_sources.append(entry)
        
        # Prioritize weak topics if available
        def prioritize_weak(sources):
            if not weak_topics:
                return sources
            prioritized = []
            others = []
            for s in sources:
                data_str = json.dumps(s.get("data", {})).lower()
                if any(wt.lower() in data_str for wt in weak_topics):
                    prioritized.append(s)
                else:
                    others.append(s)
            return prioritized + others
        
        easy_sources = prioritize_weak(easy_sources)
        medium_sources = prioritize_weak(medium_sources)
        hard_sources = prioritize_weak(hard_sources)
        
        # Build blueprint
        for i in range(easy_count):
            source = easy_sources[i % max(len(easy_sources), 1)] if easy_sources else {"type": "general", "data": {}}
            blueprint.append({
                "difficulty": "easy",
                "question_type": question_types[i % len(question_types)],
                "source": source,
                "bloom_level": "remember",
                "instruction": "Direct recall of fact or definition"
            })
        
        for i in range(medium_count):
            source = medium_sources[i % max(len(medium_sources), 1)] if medium_sources else {"type": "general", "data": {}}
            blueprint.append({
                "difficulty": "medium",
                "question_type": question_types[i % len(question_types)],
                "source": source,
                "bloom_level": "understand/apply",
                "instruction": "Understanding relationships or application"
            })
        
        for i in range(hard_count):
            source = hard_sources[i % max(len(hard_sources), 1)] if hard_sources else {"type": "general", "data": {}}
            blueprint.append({
                "difficulty": "hard",
                "question_type": question_types[i % len(question_types)],
                "source": source,
                "bloom_level": "analyze/evaluate",
                "instruction": "Analysis, comparison, or evaluation"
            })
        
        state["question_blueprint"] = blueprint
        logger.info(f"Blueprint created: {easy_count} easy, {medium_count} medium, {hard_count} hard")
        
        return state

    async def _generate_from_blueprint(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """STEP 3: Generate questions following the blueprint, enhanced with RAG context"""
        blueprint = state.get("question_blueprint", [])
        content = state.get("content", "")[:10000]
        custom_prompt = state.get("custom_prompt", "")
        rag_context = state.get("rag_context", "")
        rag_related_concepts = state.get("rag_related_concepts", [])
        rag_learning_path = state.get("rag_learning_path", [])
        
        state["execution_path"].append("qb:generate")
        
        if not blueprint:
            state["generated_questions"] = []
            return state
        
        # Build blueprint text
        blueprint_text = ""
        for i, bp in enumerate(blueprint, 1):
            source = bp.get("source", {})
            source_data = source.get("data", {})
            
            if source.get("type") == "fact":
                target = f"Fact: {source_data.get('fact', 'N/A')}"
            elif source.get("type") == "definition":
                target = f"Definition: {source_data.get('term', '')} - {source_data.get('definition', '')}"
            elif source.get("type") == "relationship":
                target = f"Relationship: {source_data.get('concept1', '')} {source_data.get('relationship', '')} {source_data.get('concept2', '')}"
            elif source.get("type") == "cause_effect":
                target = f"Cause-Effect: {source_data.get('cause', '')} → {source_data.get('effect', '')}"
            else:
                target = "General concept from content"
            
            blueprint_text += f"""
Question {i}: {bp['difficulty'].upper()} ({bp['question_type']})
- Bloom's: {bp['bloom_level']}
- Target: {target}
"""
        
        custom_section = f"\nUSER INSTRUCTIONS:\n{custom_prompt}\n" if custom_prompt else ""
        
        # Build RAG-enhanced context section
        rag_section = ""
        if rag_context or rag_related_concepts:
            rag_section = f"""
ADDITIONAL CONTEXT FROM USER'S LEARNING MATERIALS (RAG-retrieved):
{rag_context[:2000] if rag_context else 'None'}

RELATED CONCEPTS TO CONSIDER:
{', '.join(rag_related_concepts) if rag_related_concepts else 'None'}

LEARNING PATH CONTEXT:
{json.dumps(rag_learning_path[:3], indent=2) if rag_learning_path else 'None'}

Use this context to:
1. Create questions that connect to concepts the user has studied before
2. Include distractors based on common misconceptions from related materials
3. Reference real examples from the user's learning history where appropriate
"""
        
        generation_prompt = f"""Generate questions following this EXACT blueprint.

SOURCE CONTENT:
{content}
{custom_section}{rag_section}
BLUEPRINT:
{blueprint_text}

DIFFICULTY CALIBRATION:
EASY (Remember): Direct recall, single fact, explicitly stated
MEDIUM (Understand/Apply): Connecting concepts, explaining why, application
HARD (Analyze/Evaluate): Analysis, comparison, evaluation, synthesis

FORMAT REQUIREMENTS:
- multiple_choice: 4 options, one correct
- true_false: True/False options
- short_answer: 1-5 word answer
- fill_blank: Single word/phrase blank

Return JSON array with {len(blueprint)} questions:
[
  {{
    "question_text": "Clear question",
    "question_type": "multiple_choice",
    "difficulty": "easy",
    "topic": "Specific topic",
    "correct_answer": "The full text of the correct answer",
    "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"],
    "explanation": "Why correct, why others wrong",
    "points": 1,
    "bloom_level": "remember",
    "rag_enhanced": {"true if this question leverages RAG context" if rag_context else "false"}
  }}
]

CRITICAL: Each option in the "options" array MUST contain the FULL ANSWER TEXT, not just letter labels like "A", "B", "C", "D". The correct_answer must exactly match one of the options.

Return ONLY valid JSON array."""

        try:
            response = self.ai_client.generate(generation_prompt, max_tokens=6000, temperature=0.4)
            
            # Clean response
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            questions = self._parse_questions_json(response)
            state["generated_questions"] = questions
            logger.info(f"Generated {len(questions)} questions from blueprint")
            
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            state["generated_questions"] = []
            state["errors"].append(f"Generation failed: {str(e)}")
        
        return state

    async def _validate_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """STEP 4: Validate and refine generated questions"""
        questions = state.get("generated_questions", [])
        target_count = state.get("question_count", 10)
        
        state["execution_path"].append("qb:validate")
        
        validated = []
        for q in questions:
            if not q.get("question_text"):
                continue
            
            # Ensure required fields
            q.setdefault("question_type", "multiple_choice")
            q.setdefault("difficulty", "medium")
            q.setdefault("topic", "General")
            q.setdefault("correct_answer", "")
            q.setdefault("options", [])
            q.setdefault("explanation", "")
            q.setdefault("points", 1)
            
            # Validate difficulty
            if q["difficulty"] not in ["easy", "medium", "hard"]:
                q["difficulty"] = "medium"
            
            # Ensure options is list
            if not isinstance(q["options"], list):
                q["options"] = []
            
            # Fix options that are just letter labels (A, B, C, D)
            letter_only_options = {"a", "b", "c", "d", "A", "B", "C", "D"}
            if q["options"]:
                has_letter_only = any(opt.strip() in letter_only_options for opt in q["options"])
                if has_letter_only:
                    # Options are just letters - this is a generation error
                    if q["correct_answer"] and q["correct_answer"].strip() not in letter_only_options:
                        q["options"] = [q["correct_answer"]]
                        for i in range(3):
                            q["options"].append(f"Alternative answer {i + 1}")
                        logger.warning(f"Fixed letter-only options for question: {q['question_text'][:50]}...")
            
            # Fix multiple choice
            if q["question_type"] == "multiple_choice":
                if q["options"] and q["correct_answer"] not in q["options"]:
                    # Try case-insensitive match
                    found = False
                    for i, opt in enumerate(q["options"]):
                        if opt.lower().strip() == q["correct_answer"].lower().strip():
                            q["correct_answer"] = opt
                            found = True
                            break
                    if not found and q["options"]:
                        q["options"][0] = q["correct_answer"]
                
                # Ensure 4 options
                while len(q["options"]) < 4:
                    q["options"].append(f"Option {len(q['options']) + 1}")
            
            # Fix true/false
            if q["question_type"] == "true_false":
                q["options"] = ["True", "False"]
                if q["correct_answer"].lower() not in ["true", "false"]:
                    q["correct_answer"] = "True"
                else:
                    q["correct_answer"] = q["correct_answer"].capitalize()
            
            validated.append(q)
        
        state["validated_questions"] = validated[:target_count]
        logger.info(f"Validated {len(state['validated_questions'])} questions")
        
        return state
    
    async def _save_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """STEP 5: Save questions to database"""
        questions = state.get("validated_questions", [])
        user_id = state.get("user_id")
        title = state.get("title", "Generated Questions")
        source_type = state.get("source_type", "custom")
        
        state["execution_path"].append("qb:save")
        
        if not questions or not self.db_session_factory:
            state["response_data"] = {
                "action": state.get("action"),
                "questions": questions,
                "question_count": len(questions),
                "saved": False
            }
            return state
        
        try:
            from sqlalchemy import text
            session = self.db_session_factory()
            
            # Get numeric user ID
            try:
                numeric_user_id = int(user_id)
            except (ValueError, TypeError):
                get_user = text("SELECT id FROM users WHERE email = :email OR username = :email LIMIT 1")
                result = session.execute(get_user, {"email": user_id})
                numeric_user_id = result.scalar()
                if not numeric_user_id:
                    raise ValueError(f"User not found: {user_id}")
            
            # Create question set
            insert_set = text("""
                INSERT INTO question_sets (user_id, title, description, source_type, total_questions, best_score, attempts, created_at, updated_at)
                VALUES (:user_id, :title, :description, :source_type, :total_questions, 0, 0, datetime('now'), datetime('now'))
            """)
            
            session.execute(insert_set, {
                "user_id": numeric_user_id,
                "title": title,
                "description": f"Generated from {source_type}",
                "source_type": source_type,
                "total_questions": len(questions)
            })
            session.commit()
            
            # Get set ID
            get_id = text("SELECT last_insert_rowid()")
            result = session.execute(get_id)
            set_id = result.scalar()
            
            if not set_id:
                get_id = text("SELECT id FROM question_sets WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1")
                result = session.execute(get_id, {"user_id": numeric_user_id})
                set_id = result.scalar()
            
            # Insert questions
            for idx, q in enumerate(questions):
                insert_q = text("""
                    INSERT INTO questions (question_set_id, question_text, question_type, difficulty, topic, correct_answer, options, explanation, order_index)
                    VALUES (:set_id, :question_text, :question_type, :difficulty, :topic, :correct_answer, :options, :explanation, :order_index)
                """)
                
                session.execute(insert_q, {
                    "set_id": set_id,
                    "question_text": q.get("question_text", ""),
                    "question_type": q.get("question_type", "multiple_choice"),
                    "difficulty": q.get("difficulty", "medium"),
                    "topic": q.get("topic", "General"),
                    "correct_answer": q.get("correct_answer", ""),
                    "options": json.dumps(q.get("options", [])),
                    "explanation": q.get("explanation", ""),
                    "order_index": idx
                })
            
            session.commit()
            logger.info(f"Saved {len(questions)} questions to set {set_id}")
            
            state["response_data"] = {
                "action": state.get("action"),
                "questions": questions,
                "question_count": len(questions),
                "question_set_id": set_id,
                "saved": True
            }
            
        except Exception as e:
            logger.error(f"Save failed: {e}")
            state["response_data"] = {
                "action": state.get("action"),
                "questions": questions,
                "question_count": len(questions),
                "saved": False,
                "error": str(e)
            }
        
        return state

    # ==================== OTHER ACTIONS ====================
    
    async def _adaptive_generate(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Generate questions focused on user's weak areas"""
        weak_topics = state.get("weak_topics", [])
        mastery_levels = state.get("mastery_levels", {})
        content = state.get("content", "")
        question_count = state.get("question_count", 10)
        
        state["execution_path"].append("qb:adaptive")
        
        if not weak_topics:
            # Fall back to regular generation
            state["action"] = "generate"
            return await self._analyze_content(state)
        
        # Focus on weak topics
        weak_focus = weak_topics[:5]
        
        prompt = f"""Generate {question_count} questions focused on these WEAK AREAS that need practice:

WEAK TOPICS (prioritize these):
{json.dumps(weak_focus)}

MASTERY LEVELS:
{json.dumps(mastery_levels)}

CONTENT:
{content[:6000]}

Generate questions that:
1. Focus heavily on the weak topics listed
2. Start with easier questions to build confidence
3. Gradually increase difficulty
4. Include detailed explanations

Return JSON array:
[{{"question_text": "...", "question_type": "multiple_choice", "difficulty": "easy|medium|hard", "topic": "...", "correct_answer": "Full text of correct answer", "options": ["First option with full answer text", "Second option with full answer text", "Third option with full answer text", "Fourth option with full answer text"], "explanation": "...", "points": 1, "targets_weakness": true}}]

CRITICAL: Each option MUST contain the FULL ANSWER TEXT, not just letter labels like "A", "B", "C", "D". The correct_answer must exactly match one of the options.

Return ONLY valid JSON."""

        try:
            response = self.ai_client.generate(prompt, max_tokens=4000, temperature=0.5)
            
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response)
                response = re.sub(r'\n?```$', '', response).strip()
            
            questions = self._parse_questions_json(response)
            
            state["response_data"] = {
                "action": "adaptive_generate",
                "questions": questions,
                "question_count": len(questions),
                "weak_topics_targeted": weak_focus,
                "saved": False
            }
            
        except Exception as e:
            logger.error(f"Adaptive generation failed: {e}")
            state["response_data"] = {"action": "adaptive_generate", "error": str(e), "questions": []}
        
        return state
    
    async def _search_questions(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Search questions by query and filters"""
        search_query = state.get("search_query", "")
        filters = state.get("filters", {})
        user_id = state.get("user_id")
        
        state["execution_path"].append("qb:search")
        
        if not self.db_session_factory:
            state["response_data"] = {"action": "search", "results": [], "error": "No database"}
            return state
        
        try:
            from sqlalchemy import text
            session = self.db_session_factory()
            
            # Build query
            query = """
                SELECT q.*, qs.title as set_title 
                FROM questions q
                JOIN question_sets qs ON q.question_set_id = qs.id
                WHERE qs.user_id = :user_id
            """
            params = {"user_id": int(user_id)}
            
            if search_query:
                query += " AND (q.question_text LIKE :search OR q.topic LIKE :search)"
                params["search"] = f"%{search_query}%"
            
            if filters.get("difficulty"):
                query += " AND q.difficulty = :difficulty"
                params["difficulty"] = filters["difficulty"]
            
            if filters.get("topic"):
                query += " AND q.topic LIKE :topic"
                params["topic"] = f"%{filters['topic']}%"
            
            query += " ORDER BY q.id DESC LIMIT 50"
            
            result = session.execute(text(query), params)
            rows = result.fetchall()
            
            questions = []
            for row in rows:
                questions.append({
                    "id": row[0],
                    "question_text": row[2],
                    "question_type": row[3],
                    "difficulty": row[4],
                    "topic": row[5],
                    "set_title": row[-1]
                })
            
            state["response_data"] = {
                "action": "search",
                "query": search_query,
                "filters": filters,
                "results": questions,
                "count": len(questions)
            }
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            state["response_data"] = {"action": "search", "error": str(e), "results": []}
        
        return state
    
    async def _analyze_performance(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Analyze user's question bank performance"""
        user_id = state.get("user_id")
        state["execution_path"].append("qb:analyze")
        
        if not self.db_session_factory:
            state["response_data"] = {"action": "analyze", "error": "No database"}
            return state
        
        try:
            from sqlalchemy import text
            session = self.db_session_factory()
            
            # Get performance stats
            stats_query = text("""
                SELECT 
                    q.difficulty,
                    q.topic,
                    COUNT(*) as total,
                    SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as correct
                FROM questions q
                LEFT JOIN question_attempts qa ON q.id = qa.question_id
                JOIN question_sets qs ON q.question_set_id = qs.id
                WHERE qs.user_id = :user_id
                GROUP BY q.difficulty, q.topic
            """)
            
            result = session.execute(stats_query, {"user_id": int(user_id)})
            rows = result.fetchall()
            
            by_difficulty = {}
            by_topic = {}
            
            for row in rows:
                diff, topic, total, correct = row
                correct = correct or 0
                
                if diff not in by_difficulty:
                    by_difficulty[diff] = {"total": 0, "correct": 0}
                by_difficulty[diff]["total"] += total
                by_difficulty[diff]["correct"] += correct
                
                if topic and topic not in by_topic:
                    by_topic[topic] = {"total": 0, "correct": 0}
                if topic:
                    by_topic[topic]["total"] += total
                    by_topic[topic]["correct"] += correct
            
            # Calculate accuracy
            for d in by_difficulty.values():
                d["accuracy"] = round(d["correct"] / max(d["total"], 1) * 100, 1)
            for t in by_topic.values():
                t["accuracy"] = round(t["correct"] / max(t["total"], 1) * 100, 1)
            
            # Find weak topics
            weak_topics = [t for t, v in by_topic.items() if v["accuracy"] < 60]
            strong_topics = [t for t, v in by_topic.items() if v["accuracy"] >= 80]
            
            state["response_data"] = {
                "action": "analyze",
                "by_difficulty": by_difficulty,
                "by_topic": by_topic,
                "weak_topics": weak_topics,
                "strong_topics": strong_topics
            }
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            state["response_data"] = {"action": "analyze", "error": str(e)}
        
        return state
    
    async def _get_recommendations(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Get personalized recommendations"""
        weak_topics = state.get("weak_topics", [])
        mastery_levels = state.get("mastery_levels", {})
        
        state["execution_path"].append("qb:recommend")
        
        recommendations = []
        
        # Recommend based on weak topics
        for topic in weak_topics[:5]:
            recommendations.append({
                "type": "practice",
                "topic": topic,
                "reason": "Low mastery - needs more practice",
                "suggested_action": f"Generate 10 questions on {topic}"
            })
        
        # Recommend based on mastery levels
        for topic, level in mastery_levels.items():
            if isinstance(level, dict):
                level = level.get("level", 0.5)
            if level < 0.5:
                recommendations.append({
                    "type": "review",
                    "topic": topic,
                    "mastery": level,
                    "reason": "Below 50% mastery",
                    "suggested_action": f"Review {topic} fundamentals"
                })
        
        state["response_data"] = {
            "action": "recommend",
            "recommendations": recommendations[:10]
        }
        
        return state

    # ==================== HELPER METHODS ====================
    
    async def _fetch_content_from_sources(self, state: QuestionBankAgentState) -> str:
        """Fetch content from various sources"""
        source_type = state.get("source_type", "custom")
        source_id = state.get("source_id")
        sources = state.get("sources", [])
        
        if not self.db_session_factory:
            return ""
        
        from sqlalchemy import text
        session = self.db_session_factory()
        all_content = []
        
        try:
            if source_type == "pdf" and source_id:
                result = session.execute(
                    text("SELECT content FROM uploaded_documents WHERE id = :id"),
                    {"id": source_id}
                )
                content = result.scalar()
                if content:
                    all_content.append(content)
            
            elif source_type == "multiple" and sources:
                for src in sources:
                    src_type = src.get("type")
                    src_id = src.get("id")
                    src_title = src.get("title", "Unknown")
                    
                    if src_type == "chat":
                        result = session.execute(
                            text("SELECT user_message, ai_response FROM chat_messages WHERE chat_session_id = :id ORDER BY timestamp"),
                            {"id": src_id}
                        )
                        messages = result.fetchall()
                        if messages:
                            chat_content = "\n".join([f"Q: {m[0]}\nA: {m[1]}" for m in messages if m[0] or m[1]])
                            all_content.append(f"=== Chat: {src_title} ===\n{chat_content}")
                    
                    elif src_type == "slide":
                        result = session.execute(
                            text("SELECT extracted_text FROM uploaded_slides WHERE id = :id"),
                            {"id": src_id}
                        )
                        text_content = result.scalar()
                        if text_content:
                            all_content.append(f"=== Slide: {src_title} ===\n{text_content}")
                    
                    elif src_type == "note":
                        result = session.execute(
                            text("SELECT content FROM notes WHERE id = :id"),
                            {"id": src_id}
                        )
                        note_content = result.scalar()
                        if note_content:
                            all_content.append(f"=== Note: {src_title} ===\n{note_content}")
            
            elif source_type == "slide" and source_id:
                result = session.execute(
                    text("SELECT extracted_text FROM uploaded_slides WHERE id = :id"),
                    {"id": source_id}
                )
                content = result.scalar()
                if content:
                    all_content.append(content)
            
        except Exception as e:
            logger.error(f"Content fetch failed: {e}")
        
        return "\n\n".join(all_content)
    
    def _parse_questions_json(self, content: str) -> List[Dict[str, Any]]:
        """Robust JSON parsing with fallbacks"""
        # Strategy 1: Direct parse
        try:
            return json.loads(content)
        except:
            pass
        
        # Strategy 2: Extract JSON array
        try:
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
        
        # Strategy 3: Fix common issues
        try:
            fixed = content
            fixed = re.sub(r',(\s*[\]\}])', r'\1', fixed)
            fixed = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', fixed)
            
            match = re.search(r'\[.*\]', fixed, re.DOTALL)
            if match:
                return json.loads(match.group())
        except:
            pass
        
        # Strategy 4: Parse individual objects
        try:
            questions = []
            pattern = r'\{[^{}]*"question_text"[^{}]*\}'
            matches = re.findall(pattern, content, re.DOTALL)
            
            for m in matches:
                try:
                    cleaned = re.sub(r',(\s*\})', r'\1', m)
                    q = json.loads(cleaned)
                    if 'question_text' in q:
                        questions.append(q)
                except:
                    continue
            
            if questions:
                return questions
        except:
            pass
        
        logger.error(f"JSON parsing failed. Preview: {content[:300]}")
        return []
    
    async def _update_memory(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Update memory with interaction"""
        user_id = state.get("user_id")
        action = state.get("action")
        response_data = state.get("response_data", {})
        
        state["execution_path"].append("qb:memory")
        
        if self.memory_manager and user_id:
            try:
                questions = response_data.get("questions", [])
                topics = list(set(q.get("topic", "") for q in questions if q.get("topic")))
                
                await self.memory_manager.store(
                    user_id=user_id,
                    memory_type="question_bank",
                    content=f"Generated {len(questions)} questions on: {', '.join(topics[:5])}",
                    metadata={
                        "action": action,
                        "question_count": len(questions),
                        "topics": topics
                    },
                    source_agent="question_bank"
                )
            except Exception as e:
                logger.warning(f"Memory update failed: {e}")
        
        return state
    
    async def _format_response(self, state: QuestionBankAgentState) -> QuestionBankAgentState:
        """Format final response with RAG enhancement info"""
        action = state.get("action", "generate")
        response_data = state.get("response_data", {})
        rag_context = state.get("rag_context", "")
        rag_related_concepts = state.get("rag_related_concepts", [])
        
        state["execution_path"].append("qb:format")
        
        # Add RAG info to response
        rag_enhanced = bool(rag_context or rag_related_concepts)
        
        if action in ["generate", "smart_generate"]:
            count = response_data.get("question_count", 0)
            rag_note = " (RAG-enhanced)" if rag_enhanced else ""
            state["final_response"] = f"Generated {count} questions successfully{rag_note}."
        elif action == "adaptive_generate":
            count = response_data.get("question_count", 0)
            weak = response_data.get("weak_topics_targeted", [])
            rag_note = " with RAG context" if rag_enhanced else ""
            state["final_response"] = f"Generated {count} adaptive questions{rag_note} targeting: {', '.join(weak)}"
        elif action == "search":
            count = response_data.get("count", 0)
            state["final_response"] = f"Found {count} matching questions."
        elif action == "analyze":
            state["final_response"] = "Performance analysis complete."
        elif action == "recommend":
            count = len(response_data.get("recommendations", []))
            state["final_response"] = f"Generated {count} recommendations."
        else:
            state["final_response"] = "Question bank action completed."
        
        state["response_metadata"] = {
            "action": action,
            "success": not state.get("errors"),
            "response_data": response_data,
            "rag_enhanced": rag_enhanced,
            "rag_concepts_used": len(rag_related_concepts) if rag_related_concepts else 0
        }
        
        return state
    
    # Required abstract methods
    async def _process_input(self, state: AgentState) -> AgentState:
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        return state


def create_question_bank_agent(
    ai_client,
    memory_manager=None,
    db_session_factory=None,
    master_agent=None,
    rag_system=None
) -> QuestionBankAgent:
    """Factory function to create question bank agent with optional RAG integration"""
    return QuestionBankAgent(
        ai_client=ai_client,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory,
        master_agent=master_agent,
        rag_system=rag_system
    )
