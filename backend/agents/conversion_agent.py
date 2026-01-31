"""
Conversion Agent
LangGraph-based agent for intelligent content conversion between different formats:
- Notes to Flashcards
- Notes to Questions
- Flashcards to Notes
- Flashcards to Questions
- Questions to Flashcards
- Questions to Notes
- Media to Questions
- Playlist to Notes/Flashcards
- Chat to Notes
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

class ConversionAction(str, Enum):
    """Actions the conversion agent can perform"""
    NOTES_TO_FLASHCARDS = "notes_to_flashcards"
    NOTES_TO_QUESTIONS = "notes_to_questions"
    FLASHCARDS_TO_NOTES = "flashcards_to_notes"
    FLASHCARDS_TO_QUESTIONS = "flashcards_to_questions"
    QUESTIONS_TO_FLASHCARDS = "questions_to_flashcards"
    QUESTIONS_TO_NOTES = "questions_to_notes"
    MEDIA_TO_QUESTIONS = "media_to_questions"
    PLAYLIST_TO_NOTES = "playlist_to_notes"
    PLAYLIST_TO_FLASHCARDS = "playlist_to_flashcards"
    CHAT_TO_NOTES = "chat_to_notes"
    EXPORT_CSV = "export_csv"
    EXPORT_PDF = "export_pdf"


class FormatStyle(str, Enum):
    """Format styles for note conversion"""
    STRUCTURED = "structured"
    QA = "qa"
    SUMMARY = "summary"


class DifficultyLevel(str, Enum):
    """Difficulty levels for generated content"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ==================== State Definition ====================

class ConversionAgentState(TypedDict, total=False):
    """State for the conversion agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Action context
    action: str
    action_params: Dict[str, Any]
    
    # Source data
    source_type: str  # notes, flashcards, questions, media, playlist, chat
    source_ids: List[int]
    source_content: List[Dict[str, Any]]
    
    # Destination
    destination_type: str  # notes, flashcards, questions, csv, pdf
    
    # Generation options
    card_count: int
    question_count: int
    difficulty: str
    format_style: str
    depth_level: str
    
    # Results
    generated_content: Dict[str, Any]
    conversion_result: Dict[str, Any]
    
    # Memory context
    memory_context: Dict[str, Any]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Content Converter ====================

class ContentConverter:
    """Handles AI-powered content conversion between formats"""
    
    FLASHCARD_PROMPT = """Generate {count} high-quality flashcards from this content.
Difficulty: {difficulty}
Depth: {depth}

Content:
{content}

RULES:
1. Questions should be clear, specific, and testable
2. Answers should be concise but complete
3. Cover key concepts progressively
4. Match the difficulty level

Return ONLY valid JSON:
{{
  "flashcards": [
    {{"question": "...", "answer": "...", "difficulty": "{difficulty}", "concept": "main concept"}},
    ...
  ]
}}"""

    QUESTION_PROMPT = """Generate {count} multiple-choice questions from this content.
Difficulty: {difficulty}

Content:
{content}

RULES:
1. Questions should test understanding, not just recall
2. All options should be plausible
3. Include clear explanations
4. Match the difficulty level

Return ONLY valid JSON:
[{{
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_answer": "A",
  "explanation": "..."
}}]"""

    NOTE_PROMPT = """Create comprehensive study notes from this content.
Format style: {format_style}
Depth: {depth}

Content:
{content}

RULES:
1. Organize information logically
2. Use clear headings and structure
3. Include key concepts and explanations
4. Use HTML formatting (<h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>)

Write detailed educational content:"""

    def __init__(self, ai_client, db_session_factory=None):
        self.ai_client = ai_client
        self.db_session_factory = db_session_factory
    
    def _parse_json(self, response: str) -> Any:
        """Parse JSON from AI response"""
        json_str = response.strip()
        
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        # Try to find JSON object or array
        match = re.search(r'[\[{][\s\S]*[\]}]', json_str)
        if match:
            return json.loads(match.group())
        
        return {}
    
    def generate_flashcards(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium",
        depth: str = "standard"
    ) -> List[Dict[str, str]]:
        """Generate flashcards from content"""
        prompt = self.FLASHCARD_PROMPT.format(
            count=count,
            difficulty=difficulty,
            depth=depth,
            content=content[:4000]
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
            data = self._parse_json(response)
            
            cards = data.get("flashcards", []) if isinstance(data, dict) else data
            
            valid_cards = []
            for card in cards[:count]:
                if "question" in card and "answer" in card:
                    valid_cards.append({
                        "question": card["question"].strip(),
                        "answer": card["answer"].strip()[:400],
                        "difficulty": card.get("difficulty", difficulty),
                        "concept": card.get("concept", "")
                    })
            
            return valid_cards
        except Exception as e:
            logger.error(f"Flashcard generation failed: {e}")
            return []
    
    def generate_questions(
        self,
        content: str,
        count: int = 10,
        difficulty: str = "medium"
    ) -> List[Dict[str, Any]]:
        """Generate multiple-choice questions from content"""
        prompt = self.QUESTION_PROMPT.format(
            count=count,
            difficulty=difficulty,
            content=content[:4000]
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=3000, temperature=0.7)
            questions = self._parse_json(response)
            
            if isinstance(questions, dict):
                questions = questions.get("questions", [])
            
            valid_questions = []
            for q in questions[:count]:
                if "question" in q and "options" in q and "correct_answer" in q:
                    valid_questions.append({
                        "question": q["question"].strip(),
                        "options": q["options"],
                        "correct_answer": q["correct_answer"],
                        "explanation": q.get("explanation", ""),
                        "difficulty": difficulty
                    })
            
            return valid_questions
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            return []
    
    def generate_notes(
        self,
        content: str,
        format_style: str = "structured",
        depth: str = "standard"
    ) -> str:
        """Generate study notes from content"""
        prompt = self.NOTE_PROMPT.format(
            format_style=format_style,
            depth=depth,
            content=content[:4000]
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
            
            # Clean up response
            result = response.strip()
            if "```html" in result:
                result = result.split("```html")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            
            if not result.startswith("<"):
                result = f"<div>{result}</div>"
            
            return result
        except Exception as e:
            logger.error(f"Note generation failed: {e}")
            return f"<p>Error generating notes: {str(e)}</p>"


# ==================== Main Conversion Agent ====================

class ConversionAgent(BaseAgent):
    """
    Conversion Agent for transforming content between different formats.
    Supports:
    - Notes ↔ Flashcards ↔ Questions
    - Media → Questions
    - Playlist → Notes/Flashcards
    - Chat → Notes
    - Export to CSV/PDF
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
        self.converter = ContentConverter(ai_client, db_session_factory)
        
        super().__init__(
            agent_type=AgentType.CONVERSION,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
    
    def _generate_crisp_title(self, source_content: List[Dict], content_type: str) -> str:
        """Generate a crisp, efficient title (MAXIMUM 4 words, prefer 2-3 if possible)"""
        try:
            # Extract key topics from source content
            topics = []
            for item in source_content[:3]:  # Use first 3 items max
                if 'title' in item:
                    topics.append(item['title'])
                if 'content' in item:
                    # Extract first meaningful sentence
                    content_preview = item['content'][:200]
                    topics.append(content_preview)
            
            combined_text = " ".join(topics)[:500]  # Limit to 500 chars
            
            # Use AI to generate crisp title
            prompt = f"""Generate a crisp, efficient title for this {content_type} content.

RULES:
- MAXIMUM 4 words
- Prefer 2-3 words if possible
- Focus on the MAIN TOPIC only
- NO generic words like "Study Guide", "Notes on", "Flashcards about"
- Be specific and descriptive
- Use title case

Content preview:
{combined_text}

Examples of GOOD titles:
- "Photosynthesis Process"
- "World War II"
- "Machine Learning Basics"
- "Quantum Mechanics Fundamentals"

Generate ONLY the title (no quotes, no explanation):"""

            title = self.ai_client.generate(prompt, max_tokens=20, temperature=0.3)
            title = title.strip().strip('"').strip("'")
            
            # Enforce word limit
            words = title.split()
            if len(words) > 4:
                title = " ".join(words[:4])
            
            return title
            
        except Exception as e:
            logger.error(f"Error generating crisp title: {e}")
            # Fallback to simple extraction
            if source_content and 'title' in source_content[0]:
                fallback = source_content[0]['title']
                words = fallback.split()[:4]
                return " ".join(words)
            return "Converted Content"
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(ConversionAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_source_content", self._load_source_content)
        graph.add_node("route_conversion", self._route_conversion)
        
        # Conversion nodes
        graph.add_node("convert_to_flashcards", self._convert_to_flashcards)
        graph.add_node("convert_to_questions", self._convert_to_questions)
        graph.add_node("convert_to_notes", self._convert_to_notes)
        graph.add_node("export_content", self._export_content)
        
        # Finalization
        graph.add_node("save_result", self._save_result)
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "load_source_content")
        graph.add_edge("load_source_content", "route_conversion")
        
        # Conditional routing based on destination type
        graph.add_conditional_edges(
            "route_conversion",
            self._get_conversion_route,
            {
                "flashcards": "convert_to_flashcards",
                "questions": "convert_to_questions",
                "notes": "convert_to_notes",
                "export": "export_content",
                "error": "handle_error"
            }
        )
        
        # All conversions lead to save
        graph.add_edge("convert_to_flashcards", "save_result")
        graph.add_edge("convert_to_questions", "save_result")
        graph.add_edge("convert_to_notes", "save_result")
        graph.add_edge("export_content", "format_response")
        
        graph.add_edge("save_result", "format_response")
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
    
    # ==================== Graph Nodes ====================
    
    async def _parse_request(self, state: ConversionAgentState) -> ConversionAgentState:
        """Parse the conversion request"""
        action_params = state.get("action_params", {})
        
        state["execution_path"] = ["conversion:parse"]
        
        # Extract conversion parameters
        state["source_type"] = action_params.get("source_type", "notes")
        state["source_ids"] = action_params.get("source_ids", [])
        state["destination_type"] = action_params.get("destination_type", "flashcards")
        
        # Generation options
        state["card_count"] = action_params.get("card_count", 10)
        state["question_count"] = action_params.get("question_count", 10)
        state["difficulty"] = action_params.get("difficulty", "medium")
        state["format_style"] = action_params.get("format_style", "structured")
        state["depth_level"] = action_params.get("depth_level", "standard")
        
        # Determine action from source and destination
        source = state["source_type"]
        dest = state["destination_type"]
        
        action_map = {
            ("notes", "flashcards"): ConversionAction.NOTES_TO_FLASHCARDS,
            ("notes", "questions"): ConversionAction.NOTES_TO_QUESTIONS,
            ("flashcards", "notes"): ConversionAction.FLASHCARDS_TO_NOTES,
            ("flashcards", "questions"): ConversionAction.FLASHCARDS_TO_QUESTIONS,
            ("questions", "flashcards"): ConversionAction.QUESTIONS_TO_FLASHCARDS,
            ("questions", "notes"): ConversionAction.QUESTIONS_TO_NOTES,
            ("media", "questions"): ConversionAction.MEDIA_TO_QUESTIONS,
            ("playlist", "notes"): ConversionAction.PLAYLIST_TO_NOTES,
            ("playlist", "flashcards"): ConversionAction.PLAYLIST_TO_FLASHCARDS,
            ("chat", "notes"): ConversionAction.CHAT_TO_NOTES,
            ("flashcards", "csv"): ConversionAction.EXPORT_CSV,
            ("questions", "pdf"): ConversionAction.EXPORT_PDF,
        }
        
        state["action"] = action_map.get((source, dest), ConversionAction.NOTES_TO_FLASHCARDS).value
        
        return state
    
    async def _load_source_content(self, state: ConversionAgentState) -> ConversionAgentState:
        """Load source content from database"""
        source_type = state.get("source_type")
        source_ids = state.get("source_ids", [])
        user_id = state.get("user_id")
        
        state["execution_path"].append("conversion:load_source")
        
        if not self.db_session_factory:
            state["errors"] = ["Database not available"]
            return state
        
        try:
            db = self.db_session_factory()
            source_content = []
            
            # Convert username to user_id if needed
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                from models import User
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    logger.warning(f"User not found for username: {user_id}")
                    state["errors"] = ["User not found"]
                    db.close()
                    return state
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            logger.info(f"Loading {source_type} content for user_id={actual_user_id}, source_ids={source_ids}")
            
            if source_type == "notes":
                from models import Note
                notes = db.query(Note).filter(
                    Note.id.in_(source_ids),
                    Note.user_id == actual_user_id
                ).all()
                logger.info(f"Found {len(notes)} notes")
                source_content = [{"id": n.id, "title": n.title, "content": n.content} for n in notes]
                
            elif source_type == "flashcards":
                from models import FlashcardSet, Flashcard
                sets = db.query(FlashcardSet).filter(
                    FlashcardSet.id.in_(source_ids),
                    FlashcardSet.user_id == actual_user_id
                ).all()
                logger.info(f"Found {len(sets)} flashcard sets")
                for fset in sets:
                    cards = db.query(Flashcard).filter(Flashcard.set_id == fset.id).all()
                    source_content.append({
                        "id": fset.id,
                        "title": fset.title,
                        "cards": [{"question": c.question, "answer": c.answer} for c in cards]
                    })
                    
            elif source_type == "questions":
                from models import QuestionSet, Question
                sets = db.query(QuestionSet).filter(
                    QuestionSet.id.in_(source_ids),
                    QuestionSet.user_id == actual_user_id
                ).all()
                logger.info(f"Found {len(sets)} question sets")
                for qset in sets:
                    questions = db.query(Question).filter(Question.set_id == qset.id).all()
                    source_content.append({
                        "id": qset.id,
                        "title": qset.title,
                        "questions": [{
                            "question": q.question_text,
                            "options": json.loads(q.options) if q.options else [],
                            "correct_answer": q.correct_answer,
                            "explanation": q.explanation
                        } for q in questions]
                    })
                    
            elif source_type == "media":
                from models import MediaFile
                media_files = db.query(MediaFile).filter(
                    MediaFile.id.in_(source_ids),
                    MediaFile.user_id == actual_user_id
                ).all()
                logger.info(f"Found {len(media_files)} media files")
                source_content = [{
                    "id": m.id,
                    "filename": m.original_filename,
                    "transcript": m.transcript or ""
                } for m in media_files]
                
            elif source_type == "playlist":
                from models import LearningPlaylist, PlaylistItem
                playlist = db.query(LearningPlaylist).filter(
                    LearningPlaylist.id == source_ids[0] if source_ids else 0
                ).first()
                if playlist:
                    items = db.query(PlaylistItem).filter(
                        PlaylistItem.playlist_id == playlist.id
                    ).order_by(PlaylistItem.order_index).all()
                    logger.info(f"Found playlist with {len(items)} items")
                    source_content = [{
                        "id": playlist.id,
                        "title": playlist.title,
                        "description": playlist.description,
                        "items": [{
                            "title": item.title,
                            "description": item.description,
                            "notes": item.notes,
                            "url": item.url
                        } for item in items]
                    }]
                    
            elif source_type == "chat":
                from models import ChatSession, ChatMessage
                sessions = db.query(ChatSession).filter(
                    ChatSession.id.in_(source_ids),
                    ChatSession.user_id == actual_user_id
                ).all()
                logger.info(f"Found {len(sessions)} chat sessions")
                for session in sessions:
                    messages = db.query(ChatMessage).filter(
                        ChatMessage.chat_session_id == session.id
                    ).order_by(ChatMessage.timestamp).all()
                    # Format messages as conversation pairs
                    formatted_messages = []
                    for m in messages:
                        formatted_messages.append({"role": "user", "content": m.user_message})
                        formatted_messages.append({"role": "assistant", "content": m.ai_response})
                    source_content.append({
                        "id": session.id,
                        "title": session.title or "Chat Session",
                        "messages": formatted_messages
                    })
            
            db.close()
            state["source_content"] = source_content
            logger.info(f"Total source content items: {len(source_content)}")
            
            if not source_content:
                state["errors"] = state.get("errors", []) + ["No source content found"]
                
        except Exception as e:
            logger.error(f"Error loading source content: {e}")
            state["errors"] = state.get("errors", []) + [str(e)]
        
        return state
    
    def _get_conversion_route(self, state: ConversionAgentState) -> str:
        """Route to appropriate conversion handler"""
        if state.get("errors"):
            return "error"
        
        dest = state.get("destination_type", "flashcards")
        
        if dest in ["flashcards"]:
            return "flashcards"
        elif dest in ["questions"]:
            return "questions"
        elif dest in ["notes"]:
            return "notes"
        elif dest in ["csv", "pdf"]:
            return "export"
        else:
            return "flashcards"
    
    async def _route_conversion(self, state: ConversionAgentState) -> ConversionAgentState:
        """Prepare for conversion routing"""
        state["execution_path"].append(f"conversion:route:{state.get('destination_type')}")
        return state

    
    async def _convert_to_flashcards(self, state: ConversionAgentState) -> ConversionAgentState:
        """Convert source content to flashcards"""
        source_content = state.get("source_content", [])
        source_type = state.get("source_type")
        card_count = state.get("card_count", 10)
        difficulty = state.get("difficulty", "medium")
        depth = state.get("depth_level", "standard")
        
        state["execution_path"].append("conversion:to_flashcards")
        
        # Build combined content based on source type
        combined_content = ""
        
        if source_type == "notes":
            combined_content = "\n\n".join([
                f"# {item['title']}\n{item['content']}" for item in source_content
            ])
        elif source_type == "questions":
            for item in source_content:
                combined_content += f"\n# {item['title']}\n"
                for q in item.get("questions", []):
                    combined_content += f"Q: {q['question']}\n"
                    combined_content += f"A: {q['correct_answer']} - {q.get('explanation', '')}\n\n"
        elif source_type == "media":
            combined_content = "\n\n".join([
                f"# {item['filename']}\n{item['transcript']}" for item in source_content
            ])
        elif source_type == "playlist":
            for item in source_content:
                combined_content += f"# {item['title']}\n{item.get('description', '')}\n"
                for pi in item.get("items", []):
                    combined_content += f"## {pi['title']}\n{pi.get('description', '')}\n{pi.get('notes', '')}\n"
        elif source_type == "chat":
            for item in source_content:
                combined_content += f"# {item['title']}\n"
                for msg in item.get("messages", []):
                    if msg["role"] == "assistant":
                        combined_content += f"{msg['content']}\n\n"
        
        # Generate flashcards
        cards = self.converter.generate_flashcards(combined_content, card_count, difficulty, depth)
        
        state["generated_content"] = {
            "type": "flashcards",
            "cards": cards,
            "count": len(cards)
        }
        
        return state
    
    async def _convert_to_questions(self, state: ConversionAgentState) -> ConversionAgentState:
        """Convert source content to questions"""
        source_content = state.get("source_content", [])
        source_type = state.get("source_type")
        question_count = state.get("question_count", 10)
        difficulty = state.get("difficulty", "medium")
        
        state["execution_path"].append("conversion:to_questions")
        
        # Build combined content
        combined_content = ""
        
        if source_type == "notes":
            combined_content = "\n\n".join([
                f"# {item['title']}\n{item['content']}" for item in source_content
            ])
        elif source_type == "flashcards":
            for item in source_content:
                combined_content += f"\n# {item['title']}\n"
                for card in item.get("cards", []):
                    combined_content += f"Q: {card['question']}\nA: {card['answer']}\n\n"
        elif source_type == "media":
            combined_content = "\n\n".join([
                f"# {item['filename']}\n{item['transcript']}" for item in source_content
            ])
        
        # Generate questions
        questions = self.converter.generate_questions(combined_content, question_count, difficulty)
        
        state["generated_content"] = {
            "type": "questions",
            "questions": questions,
            "count": len(questions)
        }
        
        return state
    
    async def _convert_to_notes(self, state: ConversionAgentState) -> ConversionAgentState:
        """Convert source content to notes"""
        source_content = state.get("source_content", [])
        source_type = state.get("source_type")
        format_style = state.get("format_style", "structured")
        depth = state.get("depth_level", "standard")
        
        state["execution_path"].append("conversion:to_notes")
        
        # Build combined content
        combined_content = ""
        title_parts = []
        
        if source_type == "flashcards":
            for item in source_content:
                title_parts.append(item['title'])
                combined_content += f"\n# {item['title']}\n"
                for card in item.get("cards", []):
                    combined_content += f"**{card['question']}**\n{card['answer']}\n\n"
        elif source_type == "questions":
            for item in source_content:
                title_parts.append(item['title'])
                combined_content += f"\n# {item['title']}\n"
                for q in item.get("questions", []):
                    combined_content += f"**{q['question']}**\n"
                    combined_content += f"Answer: {q['correct_answer']}\n"
                    if q.get('explanation'):
                        combined_content += f"Explanation: {q['explanation']}\n\n"
        elif source_type == "playlist":
            for item in source_content:
                title_parts.append(item['title'])
                combined_content += f"# {item['title']}\n{item.get('description', '')}\n"
                for pi in item.get("items", []):
                    combined_content += f"## {pi['title']}\n{pi.get('description', '')}\n{pi.get('notes', '')}\n"
        elif source_type == "chat":
            for item in source_content:
                title_parts.append(item['title'])
                for msg in item.get("messages", []):
                    if msg["role"] == "assistant":
                        combined_content += f"{msg['content']}\n\n"
        
        # Generate notes
        notes_content = self.converter.generate_notes(combined_content, format_style, depth)
        
        state["generated_content"] = {
            "type": "notes",
            "content": notes_content,
            "title": f"Study Guide from {', '.join(title_parts[:3])}"
        }
        
        return state
    
    async def _export_content(self, state: ConversionAgentState) -> ConversionAgentState:
        """Export content to CSV or PDF"""
        source_content = state.get("source_content", [])
        source_type = state.get("source_type")
        dest_type = state.get("destination_type")
        
        state["execution_path"].append(f"conversion:export_{dest_type}")
        
        if dest_type == "csv" and source_type == "flashcards":
            # Generate CSV content
            csv_lines = ["Question,Answer"]
            for item in source_content:
                for card in item.get("cards", []):
                    q = card['question'].replace('"', '""')
                    a = card['answer'].replace('"', '""')
                    csv_lines.append(f'"{q}","{a}"')
            
            state["generated_content"] = {
                "type": "csv",
                "content": "\n".join(csv_lines),
                "filename": "flashcards_export.csv"
            }
            
        elif dest_type == "pdf" and source_type == "questions":
            # Generate HTML for PDF (simplified)
            html_content = "<html><head><style>body{font-family:Arial;padding:20px;}</style></head><body>"
            html_content += "<h1>Question Bank Export</h1>"
            
            for item in source_content:
                html_content += f"<h2>{item['title']}</h2>"
                for idx, q in enumerate(item.get("questions", []), 1):
                    html_content += f"<p><strong>{idx}. {q['question']}</strong></p>"
                    html_content += "<ul>"
                    for opt in q.get("options", []):
                        html_content += f"<li>{opt}</li>"
                    html_content += "</ul>"
                    html_content += f"<p><em>Answer: {q['correct_answer']}</em></p><hr>"
            
            html_content += "</body></html>"
            
            state["generated_content"] = {
                "type": "pdf",
                "content": html_content,
                "filename": "questions_export.html"
            }
        
        state["response_data"] = state["generated_content"]
        return state

    
    async def _save_result(self, state: ConversionAgentState) -> ConversionAgentState:
        """Save the converted content to database"""
        generated = state.get("generated_content", {})
        user_id = state.get("user_id")
        content_type = generated.get("type")
        
        state["execution_path"].append("conversion:save")
        
        if not self.db_session_factory:
            state["errors"] = state.get("errors", []) + ["Database not available"]
            return state
        
        try:
            db = self.db_session_factory()
            
            # Convert username to user_id if needed
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                from models import User
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    logger.warning(f"User not found for username: {user_id}")
                    state["errors"] = state.get("errors", []) + ["User not found"]
                    db.close()
                    return state
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            if content_type == "flashcards":
                from models import FlashcardSet, Flashcard
                
                cards = generated.get("cards", [])
                source_type = state.get("source_type")
                source_content = state.get("source_content", [])
                
                # Generate crisp 4-word title using AI
                set_title = self._generate_crisp_title(source_content, "flashcards")
                
                flashcard_set = FlashcardSet(
                    user_id=actual_user_id,
                    title=set_title,
                    description=f"Generated from {source_type} via conversion agent"
                )
                db.add(flashcard_set)
                db.flush()
                
                # Create flashcards
                for card_data in cards:
                    flashcard = Flashcard(
                        set_id=flashcard_set.id,
                        question=card_data["question"],
                        answer=card_data["answer"]
                    )
                    db.add(flashcard)
                
                db.commit()
                
                state["conversion_result"] = {
                    "success": True,
                    "set_id": flashcard_set.id,
                    "set_title": set_title,
                    "card_count": len(cards),
                    "flashcards": cards
                }
                
            elif content_type == "questions":
                from models import QuestionSet, Question
                
                questions = generated.get("questions", [])
                source_type = state.get("source_type")
                source_content = state.get("source_content", [])
                
                # Generate crisp 4-word title using AI
                set_title = self._generate_crisp_title(source_content, "questions")
                
                question_set = QuestionSet(
                    user_id=actual_user_id,
                    title=set_title,
                    description=f"Generated from {source_type} via conversion agent",
                    source_type=source_type,
                    total_questions=len(questions)
                )
                db.add(question_set)
                db.flush()
                
                # Create questions
                for idx, q_data in enumerate(questions):
                    question = Question(
                        question_set_id=question_set.id,
                        question_text=q_data["question"],
                        question_type="multiple_choice",
                        options=json.dumps(q_data["options"]),
                        correct_answer=q_data["correct_answer"],
                        explanation=q_data.get("explanation", ""),
                        difficulty=q_data.get("difficulty", "medium"),
                        order_index=idx
                    )
                    db.add(question)
                
                db.commit()
                
                state["conversion_result"] = {
                    "success": True,
                    "set_id": question_set.id,
                    "set_title": set_title,
                    "question_count": len(questions),
                    "questions": questions
                }
                
            elif content_type == "notes":
                from models import Note
                
                content = generated.get("content", "")
                source_content = state.get("source_content", [])
                
                # Generate crisp 4-word title using AI
                title = self._generate_crisp_title(source_content, "notes")
                
                # Create note
                note = Note(
                    user_id=actual_user_id,
                    title=title,
                    content=content
                )
                db.add(note)
                db.commit()
                
                state["conversion_result"] = {
                    "success": True,
                    "note_id": note.id,
                    "note_title": title,
                    "word_count": len(content.split())
                }
            
            db.close()
            
        except Exception as e:
            logger.error(f"Error saving conversion result: {e}")
            state["errors"] = state.get("errors", []) + [str(e)]
            state["conversion_result"] = {"success": False, "error": str(e)}
        
        return state
    
    async def _format_response(self, state: ConversionAgentState) -> ConversionAgentState:
        """Format the final response"""
        result = state.get("conversion_result", state.get("generated_content", {}))
        source_type = state.get("source_type")
        dest_type = state.get("destination_type")
        
        state["execution_path"].append("conversion:format")
        
        if result.get("success", True):
            if dest_type == "flashcards":
                state["final_response"] = f"Successfully converted {source_type} to {result.get('card_count', 0)} flashcards"
            elif dest_type == "questions":
                state["final_response"] = f"Successfully converted {source_type} to {result.get('question_count', 0)} questions"
            elif dest_type == "notes":
                state["final_response"] = f"Successfully converted {source_type} to notes"
            elif dest_type in ["csv", "pdf"]:
                state["final_response"] = f"Successfully exported to {dest_type.upper()}"
            else:
                state["final_response"] = "Conversion completed successfully"
        else:
            state["final_response"] = f"Conversion failed: {result.get('error', 'Unknown error')}"
        
        state["response_data"] = result
        state["response_metadata"] = {
            "action": state.get("action"),
            "source_type": source_type,
            "destination_type": dest_type,
            "response_data": result
        }
        
        return state
    
    async def _handle_error(self, state: ConversionAgentState) -> ConversionAgentState:
        """Handle errors gracefully"""
        errors = state.get("errors", [])
        
        state["final_response"] = f"Conversion failed: {'; '.join(errors)}"
        state["response_data"] = {
            "success": False,
            "errors": errors
        }
        state["response_metadata"] = {
            "success": False,
            "errors": errors
        }
        
        return state
    
    # Required abstract methods from BaseAgent
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process and validate input"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute the main agent logic"""
        return state
    
    async def _format_response(self, state: AgentState) -> AgentState:
        """Format the final response"""
        return state


# ==================== Factory Function ====================

def create_conversion_agent(
    ai_client: Any,
    knowledge_graph: Optional[Any] = None,
    memory_manager: Optional[MemoryManager] = None,
    db_session_factory: Optional[Any] = None
) -> ConversionAgent:
    """Factory function to create a ConversionAgent instance"""
    agent = ConversionAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )
    agent_registry.register(agent)
    return agent
