"""
Advanced Note Agent
LangGraph-based agent for intelligent note-taking, content generation,
writing assistance, and adaptive learning with knowledge graph integration.
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, Literal, TypedDict
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .memory.unified_memory import MemoryType

logger = logging.getLogger(__name__)


# ==================== Enums & Types ====================

class NoteAction(str, Enum):
    """Actions the note agent can perform"""
    GENERATE = "generate"           # Generate new content from topic
    IMPROVE = "improve"             # Improve existing text
    EXPAND = "expand"               # Expand text with more details
    SIMPLIFY = "simplify"           # Simplify complex text
    SUMMARIZE = "summarize"         # Summarize content
    CONTINUE = "continue"           # Continue writing
    EXPLAIN = "explain"             # Explain a concept
    KEY_POINTS = "key_points"       # Extract key points
    GRAMMAR = "grammar"             # Fix grammar and spelling
    TONE_CHANGE = "tone_change"     # Change writing tone
    OUTLINE = "outline"             # Create an outline
    ANALYZE = "analyze"             # Analyze note content
    SUGGEST = "suggest"             # Suggest improvements
    ORGANIZE = "organize"           # Organize/restructure content
    CODE_EXPLAIN = "code_explain"   # Explain code snippets


class WritingTone(str, Enum):
    """Writing tone options"""
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    ACADEMIC = "academic"
    FRIENDLY = "friendly"
    FORMAL = "formal"
    CREATIVE = "creative"
    TECHNICAL = "technical"
    SIMPLE = "simple"


class ContentDepth(str, Enum):
    """Content depth levels"""
    SURFACE = "surface"       # Brief overview
    STANDARD = "standard"     # Balanced detail
    DEEP = "deep"             # Comprehensive
    EXPERT = "expert"         # Advanced/technical


# ==================== State Definition ====================

class NoteAgentState(TypedDict, total=False):
    """State for the note agent"""
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
    context: str
    
    # Writing parameters
    tone: str
    depth: str
    target_length: int
    
    # Generation
    generated_content: str
    content_type: str
    
    # Analysis
    content_analysis: Dict[str, Any]
    suggestions: List[Dict[str, Any]]
    key_concepts: List[str]
    
    # Memory context
    memory_context: Dict[str, Any]
    related_notes: List[Dict[str, Any]]
    user_preferences: Dict[str, Any]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Content Generator ====================

class NoteContentGenerator:
    """Generates and transforms note content using AI"""
    
    # Depth level configurations
    DEPTH_CONFIG = {
        "surface": {
            "description": "Brief overview with key facts",
            "max_tokens": 500,
            "instruction": "Keep it brief and focused on essentials"
        },
        "standard": {
            "description": "Balanced explanation with examples",
            "max_tokens": 1000,
            "instruction": "Provide clear explanations with relevant examples"
        },
        "deep": {
            "description": "Comprehensive coverage with details",
            "max_tokens": 1500,
            "instruction": "Cover the topic thoroughly with detailed explanations, examples, and connections"
        },
        "expert": {
            "description": "Advanced technical depth",
            "max_tokens": 2000,
            "instruction": "Provide expert-level analysis with technical details, edge cases, and advanced concepts"
        }
    }
    
    # Action-specific prompts
    ACTION_PROMPTS = {
        "generate": """Write a detailed, comprehensive article explaining this topic in depth.

Topic: {content}
Depth: {depth} - {depth_description}
Tone: {tone}
{context_section}

Write a complete article with:
1. An introduction paragraph explaining what the topic is
2. 2-3 body paragraphs with detailed explanations, examples, and facts
3. A conclusion paragraph

{depth_instruction}
Use HTML formatting (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>).
Start writing now:""",

        "continue": """Continue writing this text naturally and coherently.

RULES:
- Match the existing style and tone ({tone})
- Continue logically from where it ends
- Add 2-3 more sentences or paragraphs
- Do NOT repeat what's already written
- {depth_instruction}

Text to continue:
{content}

Continue writing:""",

        "improve": """Improve and enhance this text while keeping the same meaning.

RULES:
- Make it more clear and {tone}
- Fix awkward phrasing
- Improve word choice
- Keep the same structure and meaning
- Do NOT add new information
- Use HTML formatting where appropriate

Original text:
{content}

Improved version:""",

        "simplify": """Simplify this text to make it easier to understand.

RULES:
- Use simpler words and shorter sentences
- Explain technical terms
- Break down complex ideas
- Keep all important information
- Make it accessible to a general audience
- Use HTML formatting for structure

Text to simplify:
{content}

Simplified version:""",

        "expand": """Expand this text with more details, examples, and explanations.

RULES:
- Add relevant details and context
- Include practical examples
- Explain concepts more thoroughly
- Increase depth without redundancy
- Maintain the {tone} tone
- {depth_instruction}
- Use HTML formatting

Text to expand:
{content}

Expanded version:""",

        "summarize": """Create a concise summary of this text.

RULES:
- Extract only the most important points
- Keep it brief but complete
- Maintain key information
- Use clear, simple language
- Use HTML formatting (<h2>Summary</h2>, <ul>, <li>)

Text to summarize:
{content}

Summary:""",

        "explain": """Explain this concept clearly for someone learning about it.

Concept: {content}
Level: {depth}
Tone: {tone}
{context_section}

RULES:
- Start with a clear definition
- Explain why it's important
- Provide practical examples
- Connect to related concepts
- {depth_instruction}
- Use HTML formatting

Explanation:""",

        "key_points": """Extract the key points from this content.

RULES:
- Identify 5-10 most important points
- Present as a clear list
- Include brief explanations for each
- Prioritize by importance
- Use HTML formatting (<h2>Key Points</h2>, <ul>, <li>)

Content:
{content}

Key Points:""",

        "grammar": """Fix all grammar and spelling errors in this text.

RULES:
- Correct spelling mistakes
- Fix grammatical errors
- Improve punctuation
- Do NOT change the meaning or style
- Keep the same tone and voice

Text to correct:
{content}

Corrected version:""",

        "tone_change": """Rewrite this text in a {tone} tone.

RULES:
- Change the tone to be {tone}
- Keep the same information
- Adjust language and style appropriately
- Maintain clarity
- Use HTML formatting where appropriate

Original text:
{content}

Rewritten in {tone} tone:""",

        "outline": """Create a structured outline for this topic.

Topic: {content}
Depth: {depth}
{context_section}

RULES:
- Create a hierarchical outline
- Include main sections and subsections
- Add brief descriptions for each section
- {depth_instruction}
- Use HTML formatting (<h2>, <h3>, <ul>, <li>)

Outline:""",

        "organize": """Reorganize and structure this content for better clarity.

RULES:
- Group related information together
- Create logical sections
- Add appropriate headings
- Improve flow and readability
- Use HTML formatting (<h2>, <h3>, <p>, <ul>)

Content to organize:
{content}

Organized version:""",

        "code_explain": """Explain this code clearly.

RULES:
- Explain what the code does
- Break down key parts
- Mention any important patterns or techniques
- Suggest improvements if relevant
- Use HTML formatting with <pre><code> for code blocks

Code:
{content}

Explanation:"""
    }

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def generate(
        self,
        action: str,
        content: str,
        tone: str = "professional",
        depth: str = "standard",
        context: str = "",
        user_preferences: Dict[str, Any] = None
    ) -> str:
        """Generate or transform content based on action"""
        
        # Get depth configuration
        depth_config = self.DEPTH_CONFIG.get(depth, self.DEPTH_CONFIG["standard"])
        
        # Get prompt template
        prompt_template = self.ACTION_PROMPTS.get(action, self.ACTION_PROMPTS["improve"])
        
        # Build context section
        context_section = f"\nContext: {context}" if context else ""
        
        # Apply user preferences
        if user_preferences:
            if user_preferences.get("difficulty_level"):
                depth = user_preferences["difficulty_level"]
            if user_preferences.get("preferred_tone"):
                tone = user_preferences["preferred_tone"]
        
        # Format prompt
        prompt = prompt_template.format(
            content=content[:3000],  # Limit content length
            tone=tone,
            depth=depth,
            depth_description=depth_config["description"],
            depth_instruction=depth_config["instruction"],
            context_section=context_section
        )
        
        try:
            response = self.ai_client.generate(
                prompt,
                max_tokens=depth_config["max_tokens"],
                temperature=0.7
            )
            
            # Clean up response
            result = self._clean_response(response, action)
            return result
            
        except Exception as e:
            logger.error(f"Content generation failed: {e}")
            return f"<p>Error generating content: {str(e)}</p>"
    
    def _clean_response(self, response: str, action: str) -> str:
        """Clean and format the AI response"""
        result = response.strip()
        
        # Remove common AI prefixes
        prefixes_to_remove = [
            "Here's", "Here is", "Sure!", "Certainly!", "Of course!",
            "I'd be happy to", "Let me", "Absolutely!"
        ]
        for prefix in prefixes_to_remove:
            if result.lower().startswith(prefix.lower()):
                # Find the first newline or period after the prefix
                idx = result.find('\n')
                if idx > 0 and idx < 100:
                    result = result[idx:].strip()
                break
        
        # Ensure HTML formatting for certain actions
        if action in ["generate", "explain", "expand", "outline", "organize"]:
            if not result.strip().startswith('<'):
                result = f"<p>{result}</p>"
        
        return result


# ==================== Content Analyzer ====================

class NoteContentAnalyzer:
    """Analyzes note content for insights and suggestions"""
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def analyze(self, content: str) -> Dict[str, Any]:
        """Analyze note content"""
        if not content:
            return {"status": "empty", "suggestions": []}
        
        # Basic metrics
        word_count = len(content.split())
        char_count = len(content)
        
        # Extract structure
        headings = re.findall(r'<h[1-6][^>]*>(.*?)</h[1-6]>', content, re.IGNORECASE)
        paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', content, re.IGNORECASE | re.DOTALL)
        lists = re.findall(r'<[uo]l[^>]*>(.*?)</[uo]l>', content, re.IGNORECASE | re.DOTALL)
        code_blocks = re.findall(r'<pre[^>]*>(.*?)</pre>', content, re.IGNORECASE | re.DOTALL)
        
        # Calculate readability (simple metric)
        sentences = re.split(r'[.!?]+', content)
        avg_sentence_length = word_count / max(len(sentences), 1)
        
        # Identify potential issues
        issues = []
        suggestions = []
        
        if word_count < 50:
            issues.append("Content is very short")
            suggestions.append({
                "type": "expand",
                "message": "Consider expanding with more details",
                "priority": "medium"
            })
        
        if not headings and word_count > 200:
            issues.append("No headings found")
            suggestions.append({
                "type": "organize",
                "message": "Add headings to improve structure",
                "priority": "high"
            })
        
        if avg_sentence_length > 25:
            issues.append("Sentences may be too long")
            suggestions.append({
                "type": "simplify",
                "message": "Consider breaking up long sentences",
                "priority": "medium"
            })
        
        if not lists and word_count > 300:
            suggestions.append({
                "type": "organize",
                "message": "Consider using bullet points for key information",
                "priority": "low"
            })
        
        return {
            "word_count": word_count,
            "char_count": char_count,
            "heading_count": len(headings),
            "paragraph_count": len(paragraphs),
            "list_count": len(lists),
            "code_block_count": len(code_blocks),
            "avg_sentence_length": round(avg_sentence_length, 1),
            "headings": headings[:10],
            "issues": issues,
            "suggestions": suggestions,
            "readability_score": self._calculate_readability(avg_sentence_length, word_count)
        }
    
    def _calculate_readability(self, avg_sentence_length: float, word_count: int) -> str:
        """Calculate simple readability score"""
        if avg_sentence_length < 15:
            return "easy"
        elif avg_sentence_length < 20:
            return "moderate"
        elif avg_sentence_length < 25:
            return "challenging"
        else:
            return "complex"
    
    def extract_concepts(self, content: str) -> List[str]:
        """Extract key concepts from content"""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', content)
        
        # Extract capitalized phrases (potential concepts)
        concepts = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        
        # Extract technical terms (snake_case, camelCase)
        technical = re.findall(r'\b[a-z]+(?:_[a-z]+)+\b', text.lower())
        technical += re.findall(r'\b[a-z]+[A-Z][a-zA-Z]*\b', text)
        
        # Combine and deduplicate
        all_concepts = list(set(concepts + technical))
        
        # Filter common words
        stop_words = {'The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'How', 'Why'}
        filtered = [c for c in all_concepts if c not in stop_words and len(c) > 2]
        
        return filtered[:20]
    
    async def get_ai_suggestions(self, content: str, user_context: Dict = None) -> List[Dict[str, Any]]:
        """Get AI-powered suggestions for improvement"""
        if not self.ai_client or not content:
            return []
        
        prompt = f"""Analyze this note content and provide 3-5 specific suggestions for improvement.

Content:
{content[:2000]}

Return JSON array:
[
    {{"type": "suggestion_type", "message": "specific suggestion", "priority": "high/medium/low"}}
]

Focus on:
- Content clarity
- Structure and organization
- Missing information
- Potential expansions"""

        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.5)
            
            # Parse JSON from response
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            # Find JSON array
            match = re.search(r'\[[\s\S]*\]', json_str)
            if match:
                suggestions = json.loads(match.group())
                return suggestions if isinstance(suggestions, list) else []
            
            return []
            
        except Exception as e:
            logger.error(f"AI suggestions failed: {e}")
            return []


# ==================== Main Note Agent ====================

class NoteAgent(BaseAgent):
    """
    Advanced Note Agent with:
    - AI-powered content generation and transformation
    - Multiple writing actions (improve, expand, simplify, etc.)
    - Content analysis and suggestions
    - Knowledge graph integration for concept relationships
    - Memory-aware personalization
    - Writing style adaptation
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
        self.generator = NoteContentGenerator(ai_client)
        self.analyzer = NoteContentAnalyzer(ai_client)
        
        super().__init__(
            agent_type=AgentType.NOTES,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(NoteAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("generate_content", self._generate_content)
        graph.add_node("transform_content", self._transform_content)
        graph.add_node("analyze_content", self._analyze_content)
        graph.add_node("get_suggestions", self._get_suggestions)
        
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
                "generate": "generate_content",
                "transform": "transform_content",
                "analyze": "analyze_content",
                "suggest": "get_suggestions",
                "error": "handle_error"
            }
        )
        
        # All actions lead to memory update
        graph.add_edge("generate_content", "update_memory")
        graph.add_edge("transform_content", "update_memory")
        graph.add_edge("analyze_content", "update_memory")
        graph.add_edge("get_suggestions", "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        

    # ==================== Graph Nodes ====================
    
    async def _parse_request(self, state: NoteAgentState) -> NoteAgentState:
        """Parse the user request to determine action"""
        user_input = state.get("user_input", "").lower()
        action_params = state.get("action_params", {})
        
        state["execution_path"] = ["note:parse"]
        
        # If action is explicitly provided
        if state.get("action"):
            return state
        
        # Detect action from natural language
        if any(word in user_input for word in ["generate", "create", "write about", "explain"]):
            if "explain" in user_input:
                state["action"] = NoteAction.EXPLAIN.value
            else:
                state["action"] = NoteAction.GENERATE.value
        elif any(word in user_input for word in ["improve", "enhance", "better", "polish"]):
            state["action"] = NoteAction.IMPROVE.value
        elif any(word in user_input for word in ["expand", "elaborate", "more detail", "add more"]):
            state["action"] = NoteAction.EXPAND.value
        elif any(word in user_input for word in ["simplify", "simpler", "easier", "basic"]):
            state["action"] = NoteAction.SIMPLIFY.value
        elif any(word in user_input for word in ["summarize", "summary", "brief", "tldr"]):
            state["action"] = NoteAction.SUMMARIZE.value
        elif any(word in user_input for word in ["continue", "keep writing", "more"]):
            state["action"] = NoteAction.CONTINUE.value
        elif any(word in user_input for word in ["key points", "main points", "bullet"]):
            state["action"] = NoteAction.KEY_POINTS.value
        elif any(word in user_input for word in ["grammar", "spelling", "fix errors", "proofread"]):
            state["action"] = NoteAction.GRAMMAR.value
        elif any(word in user_input for word in ["tone", "rewrite", "make it"]):
            state["action"] = NoteAction.TONE_CHANGE.value
        elif any(word in user_input for word in ["outline", "structure", "plan"]):
            state["action"] = NoteAction.OUTLINE.value
        elif any(word in user_input for word in ["organize", "restructure", "arrange"]):
            state["action"] = NoteAction.ORGANIZE.value
        elif any(word in user_input for word in ["analyze", "analysis", "review"]):
            state["action"] = NoteAction.ANALYZE.value
        elif any(word in user_input for word in ["suggest", "recommendation", "advice"]):
            state["action"] = NoteAction.SUGGEST.value
        elif any(word in user_input for word in ["code", "function", "script"]):
            state["action"] = NoteAction.CODE_EXPLAIN.value
        else:
            state["action"] = NoteAction.IMPROVE.value  # Default
        
        # Extract topic if generating
        if state["action"] in [NoteAction.GENERATE.value, NoteAction.EXPLAIN.value, NoteAction.OUTLINE.value]:
            topic_patterns = [
                r"about (.+?)(?:\.|$)",
                r"on (.+?)(?:\.|$)",
                r"explain (.+?)(?:\.|$)",
                r"generate (.+?)(?:\.|$)"
            ]
            for pattern in topic_patterns:
                match = re.search(pattern, user_input, re.IGNORECASE)
                if match:
                    state["topic"] = match.group(1).strip()
                    break
            
            if not state.get("topic"):
                state["topic"] = action_params.get("topic", user_input)
        
        # Set defaults from action_params
        state["tone"] = action_params.get("tone", "professional")
        state["depth"] = action_params.get("depth", "standard")
        state["source_content"] = action_params.get("content", "")
        state["context"] = action_params.get("context", "")
        
        return state
    
    async def _load_context(self, state: NoteAgentState) -> NoteAgentState:
        """Load context from memory, knowledge graph, and RAG"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        topic = state.get("topic", "")
        content = state.get("source_content", "")
        
        if self.memory_manager:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="notes",
                    query=topic or content[:200],
                    session_id=session_id
                )
                
                state["memory_context"] = context
                state["user_preferences"] = context.get("user_preferences", {})
                state["related_notes"] = context.get("agent_context", {}).get("related_notes", [])
                
                # Apply user preferences
                if context.get("user_preferences", {}).get("difficulty_level"):
                    state["depth"] = context["user_preferences"]["difficulty_level"]
                
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        # Load from knowledge graph for related concepts
        if self.knowledge_graph and (topic or content):
            try:
                query = topic or content[:200]
                related = await self.knowledge_graph.get_related_concepts(query)
                state["key_concepts"] = related[:10]
            except Exception as e:
                logger.debug(f"KG lookup failed: {e}")
                state["key_concepts"] = []
        
        # ==================== RAG RETRIEVAL ====================
        # Retrieve relevant user content for note generation/improvement
        if user_id and (topic or content):
            try:
                from .rag.user_rag_manager import get_user_rag_manager
                user_rag = get_user_rag_manager()
                
                if user_rag:
                    query = topic or content[:300]
                    logger.info(f"🔍 Retrieving relevant content from user's RAG for note generation")
                    
                    rag_results = await user_rag.retrieve_for_user(
                        user_id=str(user_id),
                        query=query,
                        top_k=8,
                        content_types=["note", "flashcard", "chat"]
                    )
                    
                    if rag_results:
                        rag_context_parts = []
                        for r in rag_results:
                            content_text = r.get("content", "")[:350]
                            content_type = r.get("metadata", {}).get("type", "content")
                            rag_context_parts.append(f"[{content_type}] {content_text}")
                        
                        state["rag_context"] = "\n\n".join(rag_context_parts)
                        state["rag_results_count"] = len(rag_results)
                        logger.info(f"✅ RAG retrieved {len(rag_results)} relevant items for note generation")
                    else:
                        state["rag_context"] = ""
                        state["rag_results_count"] = 0
                        
            except Exception as e:
                logger.error(f"❌ RAG retrieval failed: {e}")
                state["rag_context"] = ""
                state["rag_results_count"] = 0
        
        state["execution_path"].append("note:context")
        return state
    
    def _get_action_route(self, state: NoteAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "improve")
        
        # Generation actions
        if action in [NoteAction.GENERATE.value, NoteAction.EXPLAIN.value, 
                      NoteAction.OUTLINE.value, NoteAction.KEY_POINTS.value]:
            return "generate"
        
        # Transformation actions
        elif action in [NoteAction.IMPROVE.value, NoteAction.EXPAND.value,
                        NoteAction.SIMPLIFY.value, NoteAction.SUMMARIZE.value,
                        NoteAction.CONTINUE.value, NoteAction.GRAMMAR.value,
                        NoteAction.TONE_CHANGE.value, NoteAction.ORGANIZE.value,
                        NoteAction.CODE_EXPLAIN.value]:
            return "transform"
        
        # Analysis actions
        elif action == NoteAction.ANALYZE.value:
            return "analyze"
        
        # Suggestion actions
        elif action == NoteAction.SUGGEST.value:
            return "suggest"
        
        else:
            return "transform"
    
    async def _route_action(self, state: NoteAgentState) -> NoteAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"note:route:{state.get('action')}")
        return state
    
    async def _generate_content(self, state: NoteAgentState) -> NoteAgentState:
        """Generate new content from topic or prompt"""
        action = state.get("action", NoteAction.GENERATE.value)
        topic = state.get("topic", "")
        content = state.get("source_content", "") or topic
        tone = state.get("tone", "professional")
        depth = state.get("depth", "standard")
        context = state.get("context", "")
        
        # Add related concepts to context
        if state.get("key_concepts"):
            context += f"\nRelated concepts: {', '.join(state['key_concepts'][:5])}"
        
        # Add related notes context
        if state.get("related_notes"):
            context += f"\nUser has notes on: {', '.join(state['related_notes'][:3])}"
        
        # Generate content
        generated = self.generator.generate(
            action=action,
            content=content,
            tone=tone,
            depth=depth,
            context=context,
            user_preferences=state.get("user_preferences", {})
        )
        
        state["generated_content"] = generated
        state["response_data"] = {
            "action": action,
            "content": generated,
            "topic": topic,
            "tone": tone,
            "depth": depth,
            "word_count": len(generated.split())
        }
        
        state["execution_path"].append(f"note:generate:{action}")
        logger.info(f"Generated {action} content: {len(generated)} chars")
        
        return state
    
    async def _transform_content(self, state: NoteAgentState) -> NoteAgentState:
        """Transform existing content (improve, expand, simplify, etc.)"""
        action = state.get("action", NoteAction.IMPROVE.value)
        content = state.get("source_content", "")
        tone = state.get("tone", "professional")
        depth = state.get("depth", "standard")
        context = state.get("context", "")
        
        if not content:
            state["errors"] = state.get("errors", []) + ["No content provided to transform"]
            state["response_data"] = {
                "action": action,
                "error": "No content provided"
            }
            return state
        
        # Transform content
        transformed = self.generator.generate(
            action=action,
            content=content,
            tone=tone,
            depth=depth,
            context=context,
            user_preferences=state.get("user_preferences", {})
        )
        
        state["generated_content"] = transformed
        state["response_data"] = {
            "action": action,
            "content": transformed,
            "original_length": len(content),
            "new_length": len(transformed),
            "tone": tone
        }
        
        state["execution_path"].append(f"note:transform:{action}")
        logger.info(f"Transformed content with {action}: {len(content)} -> {len(transformed)} chars")
        
        return state
    
    async def _analyze_content(self, state: NoteAgentState) -> NoteAgentState:
        """Analyze note content"""
        content = state.get("source_content", "")
        
        if not content:
            state["response_data"] = {
                "action": "analyze",
                "error": "No content to analyze"
            }
            return state
        
        # Perform analysis
        analysis = self.analyzer.analyze(content)
        concepts = self.analyzer.extract_concepts(content)
        
        state["content_analysis"] = analysis
        state["key_concepts"] = concepts
        state["response_data"] = {
            "action": "analyze",
            "analysis": analysis,
            "concepts": concepts
        }
        
        state["execution_path"].append("note:analyze")
        logger.info(f"Analyzed content: {analysis.get('word_count')} words, {len(concepts)} concepts")
        
        return state
    
    async def _get_suggestions(self, state: NoteAgentState) -> NoteAgentState:
        """Get improvement suggestions for content"""
        content = state.get("source_content", "")
        
        if not content:
            state["response_data"] = {
                "action": "suggest",
                "suggestions": []
            }
            return state
        
        # Get basic analysis suggestions
        analysis = self.analyzer.analyze(content)
        suggestions = analysis.get("suggestions", [])
        
        # Get AI-powered suggestions
        ai_suggestions = await self.analyzer.get_ai_suggestions(
            content,
            state.get("memory_context", {})
        )
        
        # Combine suggestions
        all_suggestions = suggestions + ai_suggestions
        
        state["suggestions"] = all_suggestions
        state["response_data"] = {
            "action": "suggest",
            "suggestions": all_suggestions,
            "analysis_summary": {
                "word_count": analysis.get("word_count"),
                "readability": analysis.get("readability_score"),
                "issues": analysis.get("issues", [])
            }
        }
        
        state["execution_path"].append("note:suggest")
        logger.info(f"Generated {len(all_suggestions)} suggestions")
        
        return state
    
    async def _update_memory(self, state: NoteAgentState) -> NoteAgentState:
        """Update memory with interaction data"""
        user_id = state.get("user_id")
        action = state.get("action")
        
        if self.memory_manager and user_id:
            try:
                # Extract topics from content
                topics = state.get("key_concepts", [])[:5]
                if state.get("topic"):
                    topics.insert(0, state["topic"])
                
                # Store note interaction
                await self.memory_manager.memory.store(
                    user_id=user_id,
                    memory_type=MemoryType.NOTE,
                    content=f"Note {action}: {state.get('topic', 'content transformation')}",
                    metadata={
                        "action": action,
                        "topic": state.get("topic"),
                        "tone": state.get("tone"),
                        "depth": state.get("depth"),
                        "content_length": len(state.get("generated_content", ""))
                    },
                    importance=0.6,
                    source_agent="notes",
                    tags=topics
                )
                
                # Learn from interaction
                await self.memory_manager.learn_from_interaction(
                    user_id=user_id,
                    interaction_data={
                        "response_length": len(state.get("generated_content", "")),
                        "topics": topics,
                        "action": action,
                        "tone_used": state.get("tone"),
                        "depth_used": state.get("depth")
                    }
                )
                
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("note:memory")
        return state
    
    async def _format_response(self, state: NoteAgentState) -> NoteAgentState:
        """Format the final response"""
        action = state.get("action")
        response_data = state.get("response_data", {})
        
        # Generate natural language response
        if action in [NoteAction.GENERATE.value, NoteAction.EXPLAIN.value]:
            topic = response_data.get("topic", "the topic")
            word_count = response_data.get("word_count", 0)
            state["final_response"] = f"Generated content about '{topic}' ({word_count} words)"
            
        elif action in [NoteAction.IMPROVE.value, NoteAction.EXPAND.value, 
                        NoteAction.SIMPLIFY.value, NoteAction.GRAMMAR.value,
                        NoteAction.TONE_CHANGE.value, NoteAction.ORGANIZE.value]:
            original = response_data.get("original_length", 0)
            new = response_data.get("new_length", 0)
            state["final_response"] = f"Content {action}d successfully ({original} → {new} chars)"
            
        elif action == NoteAction.SUMMARIZE.value:
            state["final_response"] = "Summary generated successfully"
            
        elif action == NoteAction.CONTINUE.value:
            state["final_response"] = "Content continued successfully"
            
        elif action == NoteAction.KEY_POINTS.value:
            state["final_response"] = "Key points extracted successfully"
            
        elif action == NoteAction.OUTLINE.value:
            state["final_response"] = "Outline created successfully"
            
        elif action == NoteAction.ANALYZE.value:
            analysis = response_data.get("analysis", {})
            state["final_response"] = f"Analysis complete: {analysis.get('word_count', 0)} words, {analysis.get('readability_score', 'unknown')} readability"
            
        elif action == NoteAction.SUGGEST.value:
            suggestions = response_data.get("suggestions", [])
            state["final_response"] = f"Generated {len(suggestions)} improvement suggestions"
            
        elif action == NoteAction.CODE_EXPLAIN.value:
            state["final_response"] = "Code explanation generated"
        
        else:
            state["final_response"] = response_data.get("content", "")
        
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

def create_note_agent(
    ai_client,
    knowledge_graph=None,
    memory_manager=None,
    db_session_factory=None
) -> NoteAgent:
    """Factory function to create and register the note agent"""
    agent = NoteAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
    agent_registry.register(agent)
    logger.info(" Note Agent registered")
    return agent



