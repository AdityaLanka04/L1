"""
Slide Explorer Agent
LangGraph-based agent for intelligent slide content extraction,
analysis, summarization, and interactive exploration.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager

logger = logging.getLogger(__name__)


class SlideExplorerAgentState(AgentState):
    """State for slide explorer agent"""
    action: str
    slide_id: Optional[int]
    slide_ids: List[int]
    slide_content: str
    query: str
    extraction_type: str
    analysis_depth: str
    extracted_data: Dict[str, Any]
    summary: str
    key_points: List[str]
    questions: List[Dict[str, Any]]


class SlideExplorerAgent(BaseAgent):
    """
    Slide Explorer Agent for:
    - Intelligent slide content extraction
    - Automatic summarization
    - Key point identification
    - Question generation from slides
    - Concept extraction
    - Interactive slide navigation
    - Content linking to notes/flashcards
    """
    
    def __init__(
        self,
        ai_client: Any,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        
        super().__init__(
            agent_type=AgentType.SLIDE_EXPLORER,
            ai_client=ai_client,
            checkpointer=checkpointer or MemorySaver()
        )
        
        self._build_graph()
        logger.info("Slide Explorer Agent initialized")
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(SlideExplorerAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("extract_content", self._extract_content)
        graph.add_node("summarize_slides", self._summarize_slides)
        graph.add_node("extract_key_points", self._extract_key_points)
        graph.add_node("generate_questions", self._generate_questions)
        graph.add_node("extract_concepts", self._extract_concepts)
        graph.add_node("analyze_slides", self._analyze_slides)
        graph.add_node("link_content", self._link_content)
        
        # Finalization
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("format_response", self._format_response)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "extract": "extract_content",
                "summarize": "summarize_slides",
                "key_points": "extract_key_points",
                "questions": "generate_questions",
                "concepts": "extract_concepts",
                "analyze": "analyze_slides",
                "link": "link_content"
            }
        )
        
        # All actions lead to memory update
        for action_node in ["extract_content", "summarize_slides", "extract_key_points",
                           "generate_questions", "extract_concepts", "analyze_slides", "link_content"]:
            graph.add_edge(action_node, "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        logger.info("Slide Explorer Agent graph compiled")
    
    def _get_action_route(self, state: SlideExplorerAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "extract")
        action_map = {
            "extract": "extract",
            "summarize": "summarize",
            "key_points": "key_points",
            "questions": "questions",
            "concepts": "concepts",
            "analyze": "analyze",
            "link": "link"
        }
        return action_map.get(action, "extract")
    
    async def _parse_request(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Parse the user request"""
        user_input = state.get("user_input", "").lower()
        
        # Detect action from natural language
        if any(word in user_input for word in ["extract", "get", "pull", "retrieve"]):
            state["action"] = "extract"
        elif any(word in user_input for word in ["summarize", "summary", "brief", "overview"]):
            state["action"] = "summarize"
        elif any(word in user_input for word in ["key point", "main idea", "important", "highlight"]):
            state["action"] = "key_points"
        elif any(word in user_input for word in ["question", "quiz", "test", "generate"]):
            state["action"] = "questions"
        elif any(word in user_input for word in ["concept", "topic", "idea", "extract concept"]):
            state["action"] = "concepts"
        elif any(word in user_input for word in ["analyze", "analysis", "deep dive", "understand"]):
            state["action"] = "analyze"
        elif any(word in user_input for word in ["link", "connect", "relate", "associate"]):
            state["action"] = "link"
        else:
            state["action"] = "extract"
        
        state["execution_path"] = ["se:parse"]
        return state
    
    async def _load_context(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Load context from memory and RAG"""
        user_id = state.get("user_id")
        
        if self.memory_manager and user_id:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="slide_explorer",
                    query=state.get("query", "")
                )
                state["memory_context"] = context
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        # ==================== RAG RETRIEVAL ====================
        # Retrieve relevant user content for slide analysis
        if user_id and state.get("slide_content"):
            try:
                from .rag.user_rag_manager import get_user_rag_manager
                user_rag = get_user_rag_manager()
                
                if user_rag:
                    # Use slide content as query to find related materials
                    query = state.get("slide_content", "")[:500]
                    logger.info(f"Retrieving relevant content from user's RAG for slide analysis")
                    
                    rag_results = await user_rag.retrieve_for_user(
                        user_id=str(user_id),
                        query=query,
                        top_k=5,
                        content_types=["note", "flashcard"]
                    )
                    
                    if rag_results:
                        rag_context_parts = []
                        for r in rag_results:
                            content_text = r.get("content", "")[:300]
                            content_type = r.get("metadata", {}).get("type", "content")
                            rag_context_parts.append(f"[{content_type}] {content_text}")
                        
                        state["rag_context"] = "\n\n".join(rag_context_parts)
                        state["rag_results_count"] = len(rag_results)
                        logger.info(f"RAG retrieved {len(rag_results)} related items for slide analysis")
                    else:
                        state["rag_context"] = ""
                        state["rag_results_count"] = 0
                        
            except Exception as e:
                logger.error(f"RAG retrieval failed: {e}")
                state["rag_context"] = ""
                state["rag_results_count"] = 0
        
        state["execution_path"].append("se:context")
        return state
    
    async def _route_action(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"se:route:{state.get('action')}")
        return state
    
    async def _extract_content(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Extract structured content from slides"""
        slide_content = state.get("slide_content", "")
        extraction_type = state.get("extraction_type", "full")
        
        prompt = f"""Extract {extraction_type} content from this slide:

Slide Content:
{slide_content[:2000]}

Extract:
1. Main title/heading
2. Body text
3. Key terms/definitions
4. Data/statistics
5. Visual descriptions
6. Relationships between concepts
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.5)
            state["extracted_data"] = json.loads(response) if response.startswith("{") else {"content": response}
            state["response_data"] = {
                "action": "extract",
                "extraction_type": extraction_type,
                "extracted_data": state["extracted_data"]
            }
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            state["response_data"] = {"action": "extract", "error": str(e)}
        
        state["execution_path"].append("se:extract")
        return state
    
    async def _summarize_slides(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Summarize slide content"""
        slide_content = state.get("slide_content", "")
        
        prompt = f"""Summarize this slide content concisely:

Slide Content:
{slide_content[:2000]}

Provide:
1. One-sentence summary
2. 3-5 bullet point summary
3. Key takeaway
4. Difficulty level (beginner/intermediate/advanced)
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=600, temperature=0.7)
            state["summary"] = response
            state["response_data"] = {
                "action": "summarize",
                "summary": response
            }
        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            state["response_data"] = {"action": "summarize", "error": str(e)}
        
        state["execution_path"].append("se:summarize")
        return state
    
    async def _extract_key_points(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Extract key points from slides"""
        slide_content = state.get("slide_content", "")
        
        prompt = f"""Extract key points from this slide:

Slide Content:
{slide_content[:2000]}

Identify:
1. Main concepts (5-7 points)
2. Supporting details
3. Important definitions
4. Critical facts
5. Learning objectives
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=700, temperature=0.6)
            # Parse response into list
            lines = response.split('\n')
            state["key_points"] = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            state["response_data"] = {
                "action": "key_points",
                "key_points": state["key_points"]
            }
        except Exception as e:
            logger.error(f"Key point extraction failed: {e}")
            state["response_data"] = {"action": "key_points", "error": str(e)}
        
        state["execution_path"].append("se:key_points")
        return state
    
    async def _generate_questions(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Generate questions from slide content"""
        slide_content = state.get("slide_content", "")
        
        prompt = f"""Generate 5 multiple choice questions from this slide:

Slide Content:
{slide_content[:2000]}

For each question:
1. Question text
2. 4 options (A, B, C, D)
3. Correct answer
4. Explanation
5. Difficulty level

Return as JSON array."""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=1000, temperature=0.7)
            # Try to parse as JSON
            try:
                state["questions"] = json.loads(response)
            except:
                state["questions"] = [{"question": response}]
            
            state["response_data"] = {
                "action": "questions",
                "questions": state["questions"],
                "count": len(state["questions"])
            }
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            state["response_data"] = {"action": "questions", "error": str(e)}
        
        state["execution_path"].append("se:questions")
        return state
    
    async def _extract_concepts(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Extract and map concepts from slides"""
        slide_content = state.get("slide_content", "")
        
        prompt = f"""Extract and map concepts from this slide:

Slide Content:
{slide_content[:2000]}

Identify:
1. Core concepts
2. Related concepts
3. Concept relationships
4. Prerequisites
5. Applications
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
            state["response_data"] = {
                "action": "concepts",
                "concepts": response
            }
        except Exception as e:
            logger.error(f"Concept extraction failed: {e}")
            state["response_data"] = {"action": "concepts", "error": str(e)}
        
        state["execution_path"].append("se:concepts")
        return state
    
    async def _analyze_slides(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Deep analysis of slide content"""
        slide_content = state.get("slide_content", "")
        analysis_depth = state.get("analysis_depth", "standard")
        
        prompt = f"""Perform {analysis_depth} analysis of this slide:

Slide Content:
{slide_content[:2000]}

Analyze:
1. Content structure
2. Learning objectives
3. Pedagogical approach
4. Clarity and completeness
5. Connections to other topics
6. Potential misconceptions
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=1000, temperature=0.6)
            state["response_data"] = {
                "action": "analyze",
                "analysis": response,
                "depth": analysis_depth
            }
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            state["response_data"] = {"action": "analyze", "error": str(e)}
        
        state["execution_path"].append("se:analyze")
        return state
    
    async def _link_content(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Link slide content to notes, flashcards, etc."""
        slide_content = state.get("slide_content", "")
        
        prompt = f"""Suggest how to link this slide content to other learning materials:

Slide Content:
{slide_content[:2000]}

Suggest:
1. Flashcard topics
2. Note-taking structure
3. Related quiz topics
4. Study group discussion points
5. Real-world applications
"""
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=800, temperature=0.7)
            state["response_data"] = {
                "action": "link",
                "linking_suggestions": response
            }
        except Exception as e:
            logger.error(f"Linking failed: {e}")
            state["response_data"] = {"action": "link", "error": str(e)}
        
        state["execution_path"].append("se:link")
        return state
    
    async def _update_memory(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Update memory with slide exploration"""
        user_id = state.get("user_id")
        action = state.get("action")
        
        if self.memory_manager and user_id:
            try:
                # Store the interaction as a memory
                await self.memory_manager.store(
                    user_id=user_id,
                    memory_type="slide_explorer_action",  # Custom type
                    content=f"Slide Explorer {action}: {json.dumps(state.get('response_data', {}))}",
                    metadata={
                        "action": action,
                        "response_data": state.get("response_data", {})
                    },
                    source_agent="slide_explorer"
                )
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("se:memory")
        return state
    
    async def _format_response(self, state: SlideExplorerAgentState) -> SlideExplorerAgentState:
        """Format the final response"""
        action = state.get("action", "extract")
        response_data = state.get("response_data", {})
        
        if action == "extract":
            state["final_response"] = "Content extracted from slide."
        elif action == "summarize":
            state["final_response"] = "Slide summarized successfully."
        elif action == "key_points":
            state["final_response"] = f"Extracted {len(state.get('key_points', []))} key points."
        elif action == "questions":
            state["final_response"] = f"Generated {response_data.get('count', 0)} questions from slide."
        elif action == "concepts":
            state["final_response"] = "Concepts extracted and mapped."
        elif action == "analyze":
            state["final_response"] = "Slide analysis complete."
        elif action == "link":
            state["final_response"] = "Content linking suggestions provided."
        else:
            state["final_response"] = "Slide exploration completed."
        
        state["response_metadata"] = {
            "action": action,
            "success": True,
            "response_data": response_data
        }
        
        state["execution_path"].append("se:format")
        return state
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process and validate input"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute main logic"""
        return state


def create_slide_explorer_agent(
    ai_client,
    memory_manager=None,
    db_session_factory=None
) -> SlideExplorerAgent:
    """Factory function to create slide explorer agent"""
    return SlideExplorerAgent(
        ai_client=ai_client,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
