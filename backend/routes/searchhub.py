import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import call_ai, get_db, get_user_by_email, get_user_by_username

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agents/searchhub", tags=["searchhub"])

SESSION_CONTEXT: Dict[str, List[dict]] = {}

class SearchHubRequest(BaseModel):
    user_id: str
    query: str
    session_id: Optional[str] = None
    context: Optional[dict] = None
    use_hs_context: bool = True

class CreateNoteRequest(BaseModel):
    user_id: str
    topic: str
    content: Optional[str] = None
    depth: str = "standard"
    tone: str = "professional"
    use_hs_context: bool = True

class CreateFlashcardsRequest(BaseModel):
    user_id: str
    topic: str
    count: int = 10
    difficulty: str = "medium"
    content: Optional[str] = None

class CreateQuestionsRequest(BaseModel):
    user_id: str
    topic: str
    count: int = 10
    difficulty_mix: Optional[dict] = None
    content: Optional[str] = None
    use_hs_context: bool = True

class ExplainRequest(BaseModel):
    user_id: str
    topic: str
    depth: str = "standard"

class ClearContextRequest(BaseModel):
    user_id: str
    session_id: str

def _resolve_user(db: Session, user_id: str):
    if not user_id or user_id.lower() == "guest":
        return None
    return get_user_by_username(db, user_id) or get_user_by_email(db, user_id)

def _dedupe_preserve(items: List[str]) -> List[str]:
    seen = set()
    output = []
    for item in items:
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output

def _clean_topic(text: str) -> str:
    cleaned = re.sub(r"^(ai generated:|cerbyl:|flashcards?:|notes?:)\s*", "", text, flags=re.IGNORECASE)
    return cleaned.strip()

def _extract_topic(query: str, patterns: List[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, query, flags=re.IGNORECASE)
        if match and match.group(1):
            topic = match.group(1).strip()
            if topic:
                return topic
    return None

def _extract_count(query: str) -> Optional[int]:
    match = re.search(r"\b(\d{1,3})\b", query)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None
    return None

def _extract_difficulty(query: str) -> Optional[str]:
    for level in ("easy", "medium", "hard"):
        if re.search(rf"\b{level}\b", query, flags=re.IGNORECASE):
            return level
    return None

_COMMAND_PREFIXES = ("/", ":", ">", "!")
_PATH_DIFFICULTY_LEVELS = ("beginner", "intermediate", "advanced")
_PATH_LENGTH_LEVELS = ("short", "medium", "long")
_NOTE_DEPTH_LEVELS = ("brief", "standard", "deep")

_COMMAND_CATALOG: List[Dict[str, Any]] = [
    {
        "command": "flashcards",
        "aliases": ["flashcards", "flashcard", "cards", "fc"],
        "action": "create_flashcards",
        "description": "Create flashcards and open the set",
        "syntax": "/flashcards <topic> [--count 10] [--difficulty easy|medium|hard]",
        "examples": [
            "/flashcards photosynthesis",
            "/flashcards photosynthesis --count 20 --difficulty hard",
        ],
        "navigate_to": "/flashcards",
        "requires_topic": True,
        "params": ["topic", "count", "difficulty"],
    },
    {
        "command": "notes",
        "aliases": ["notes", "note", "n"],
        "action": "create_note",
        "description": "Create notes and open the editor",
        "syntax": "/notes <topic> [--depth brief|standard|deep]",
        "examples": [
            "/notes neural networks",
            "/notes neural networks --depth deep",
        ],
        "navigate_to": "/notes/editor/:id",
        "requires_topic": True,
        "params": ["topic", "depth"],
    },
    {
        "command": "questions",
        "aliases": ["questions", "question", "q", "qbank"],
        "action": "create_questions",
        "description": "Create practice questions",
        "syntax": "/questions <topic> [--count 10]",
        "examples": [
            "/questions cellular respiration",
            "/questions cellular respiration --count 15",
        ],
        "navigate_to": "/question-bank",
        "requires_topic": True,
        "params": ["topic", "count"],
    },
    {
        "command": "quiz",
        "aliases": ["quiz", "test"],
        "action": "create_quiz",
        "description": "Start a quiz on a topic",
        "syntax": "/quiz <topic> [--count 10]",
        "examples": [
            "/quiz world history",
            "/quiz world history --count 12",
        ],
        "navigate_to": "/question-bank",
        "requires_topic": True,
        "params": ["topic", "count"],
    },
    {
        "command": "path",
        "aliases": ["path", "learning-path", "learning-paths", "roadmap", "lp"],
        "action": "create_learning_path",
        "description": "Generate a learning path and open it",
        "syntax": "/path <topic> [--difficulty beginner|intermediate|advanced] [--length short|medium|long]",
        "examples": [
            "/path machine learning",
            "/path machine learning --difficulty beginner --length short",
        ],
        "navigate_to": "/learning-paths",
        "requires_topic": True,
        "params": ["topic", "difficulty", "length"],
    },
    {
        "command": "chat",
        "aliases": ["chat", "talk", "discuss"],
        "action": "start_chat",
        "description": "Open AI chat with an initial topic",
        "syntax": "/chat <topic>",
        "examples": [
            "/chat quantum mechanics",
        ],
        "navigate_to": "/ai-chat",
        "requires_topic": False,
        "params": ["topic"],
    },
    {
        "command": "explain",
        "aliases": ["explain", "what", "define", "summarize"],
        "action": "explain",
        "description": "Get a quick explanation",
        "syntax": "/explain <topic> [--depth brief|standard|deep]",
        "examples": [
            "/explain photosynthesis",
        ],
        "navigate_to": None,
        "requires_topic": True,
        "params": ["topic", "depth"],
    },
    {
        "command": "search",
        "aliases": ["search", "find", "lookup", "look"],
        "action": "search",
        "description": "Search your learning content",
        "syntax": "/search <query>",
        "examples": [
            "/search mitochondria notes",
        ],
        "navigate_to": "/search-hub",
        "requires_topic": False,
        "params": ["query"],
    },
    {
        "command": "progress",
        "aliases": ["progress", "stats", "analytics"],
        "action": "show_progress",
        "description": "Open study insights",
        "syntax": "/progress",
        "examples": ["/progress"],
        "navigate_to": "/study-insights",
        "requires_topic": False,
        "params": [],
    },
    {
        "command": "weak",
        "aliases": ["weak", "weakness", "weak-areas", "gaps"],
        "action": "show_weak_areas",
        "description": "Open weak areas",
        "syntax": "/weak",
        "examples": ["/weak"],
        "navigate_to": "/study-insights?tab=weak",
        "requires_topic": False,
        "params": [],
    },
    {
        "command": "achievements",
        "aliases": ["achievements", "badges"],
        "action": "show_achievements",
        "description": "Open achievements",
        "syntax": "/achievements",
        "examples": ["/achievements"],
        "navigate_to": "/study-insights?tab=achievements",
        "requires_topic": False,
        "params": [],
    },
    {
        "command": "learning-paths",
        "aliases": ["learning-paths", "paths", "roadmaps"],
        "action": "show_learning_paths",
        "description": "Open learning paths",
        "syntax": "/learning-paths",
        "examples": ["/learning-paths"],
        "navigate_to": "/learning-paths",
        "requires_topic": False,
        "params": [],
    },
    {
        "command": "review",
        "aliases": ["review", "revise"],
        "action": "review_flashcards",
        "description": "Open flashcards for review",
        "syntax": "/review",
        "examples": ["/review"],
        "navigate_to": "/flashcards",
        "requires_topic": False,
        "params": [],
    },
    {
        "command": "help",
        "aliases": ["help", "commands", "?"],
        "action": "show_help",
        "description": "Show all commands",
        "syntax": "/help",
        "examples": ["/help"],
        "navigate_to": None,
        "requires_topic": False,
        "params": [],
    },
]

_COMMAND_ALIAS_MAP: Dict[str, Dict[str, Any]] = {}
for cmd in _COMMAND_CATALOG:
    for alias in cmd["aliases"]:
        _COMMAND_ALIAS_MAP[alias] = cmd

_ACTION_REQUIRES_TOPIC = {
    "create_note",
    "create_flashcards",
    "create_questions",
    "create_quiz",
    "create_learning_path",
    "explain",
}

def _get_command_catalog() -> List[Dict[str, Any]]:
    return [dict(cmd) for cmd in _COMMAND_CATALOG]

def _get_action_command_examples(action: str, limit: int = 3) -> List[str]:
    for cmd in _COMMAND_CATALOG:
        if cmd["action"] == action:
            examples = cmd.get("examples") or []
            if not examples and cmd.get("syntax"):
                examples = [cmd["syntax"]]
            return examples[:limit]
    return _build_default_command_suggestions()[:limit]

def _normalize_command_token(token: str) -> str:
    return re.sub(r"[^a-z0-9_-]", "", token.lower())

def _parse_command_flags(tokens: List[str]) -> Tuple[Dict[str, str], List[str]]:
    flags: Dict[str, str] = {}
    remaining: List[str] = []
    short_map = {"n": "count", "d": "difficulty", "l": "length", "t": "tone"}
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token.startswith("--"):
            key, value = token[2:], None
            if "=" in key:
                key, value = key.split("=", 1)
            else:
                if i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                    value = tokens[i + 1]
                    i += 1
            if key:
                flags[key.lower()] = (value or "").strip()
        elif token.startswith("-") and len(token) == 2:
            key = short_map.get(token[1])
            if key and i + 1 < len(tokens) and not tokens[i + 1].startswith("-"):
                flags[key] = tokens[i + 1].strip()
                i += 1
            else:
                remaining.append(token)
        else:
            remaining.append(token)
        i += 1
    return flags, remaining

def _parse_command(query: str) -> Optional[Dict[str, Any]]:
    raw = (query or "").strip()
    if not raw:
        return None

    explicit = False
    if raw[0] in _COMMAND_PREFIXES:
        explicit = True
        raw = raw[1:].strip()
    elif raw.lower().startswith("cmd "):
        explicit = True
        raw = raw[4:].strip()
    elif raw.lower().startswith("command "):
        explicit = True
        raw = raw.split(" ", 1)[1].strip()

    if not raw:
        return {"action": "show_help", "confidence": 0.95} if explicit else None

    tokens = raw.split()
    if not tokens:
        return {"action": "show_help", "confidence": 0.95} if explicit else None

    cmd_token = _normalize_command_token(tokens[0])
    cmd_def = _COMMAND_ALIAS_MAP.get(cmd_token)
    if not cmd_def:
        if explicit:
            return {
                "action": "show_help",
                "topic": raw,
                "confidence": 0.45,
                "command_unknown": True,
            }
        return None

    flags, remaining = _parse_command_flags(tokens[1:])

    count = None
    if flags.get("count"):
        try:
            count = int(flags["count"])
        except ValueError:
            count = None

    difficulty = (flags.get("difficulty") or flags.get("level") or "").strip().lower() or None
    length = (flags.get("length") or "").strip().lower() or None
    depth = (flags.get("depth") or "").strip().lower() or None
    tone = (flags.get("tone") or "").strip() or None

    topic_tokens: List[str] = []
    for token in remaining:
        lower = token.lower()
        if count is None and token.isdigit():
            count = int(token)
            continue
        if difficulty is None and lower in ("easy", "medium", "hard", *_PATH_DIFFICULTY_LEVELS):
            difficulty = lower
            continue
        if length is None and lower in _PATH_LENGTH_LEVELS:
            length = lower
            continue
        if depth is None and lower in _NOTE_DEPTH_LEVELS:
            depth = lower
            continue
        topic_tokens.append(token)

    topic = " ".join(topic_tokens).strip()
    if topic:
        topic = re.sub(r"^(on|about|for|to)\s+", "", topic, flags=re.IGNORECASE).strip()

    return {
        "action": cmd_def["action"],
        "topic": topic,
        "count": count,
        "difficulty": difficulty,
        "length": length,
        "depth": depth,
        "tone": tone,
        "command": cmd_def["command"],
        "confidence": 0.93 if explicit else 0.82,
    }

def _infer_action(query: str) -> Dict[str, Any]:
    query_clean = (query or "").strip()
    query_lower = query_clean.lower()

    if not query_clean:
        return {"action": "search", "confidence": 0.3}

    command_intent = _parse_command(query_clean)
    if command_intent:
        return command_intent

    if re.match(r"^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b", query_lower):
        return {"action": "greeting", "confidence": 0.95}

    if "help" in query_lower or "what can you do" in query_lower or "commands" in query_lower:
        return {"action": "show_help", "confidence": 0.9}

    if "weak area" in query_lower or "weakness" in query_lower or "struggle" in query_lower:
        return {"action": "show_weak_areas", "confidence": 0.9}

    if "progress" in query_lower or "stats" in query_lower or "statistics" in query_lower:
        return {"action": "show_progress", "confidence": 0.85}

    if "achievement" in query_lower or "badge" in query_lower:
        return {"action": "show_achievements", "confidence": 0.85}

    if "show my learning paths" in query_lower or "show learning paths" in query_lower:
        return {"action": "show_learning_paths", "confidence": 0.85}

    if "learning path" in query_lower or "roadmap" in query_lower or "study plan" in query_lower:
        topic = _extract_topic(query_clean, [r"(?:path|roadmap|learning path|study plan)\s+(?:on|for|about)\s+(.+)"])
        topic = topic or re.sub(r"^(create|make|generate)\s+", "", query_lower, flags=re.IGNORECASE).strip()
        return {"action": "create_learning_path", "topic": topic or query_clean, "confidence": 0.8}

    if "review flashcards" in query_lower or "review weak flashcards" in query_lower:
        return {"action": "review_flashcards", "confidence": 0.85}

    search_keywords = [
        "search", "find", "show me", "get me", "fetch", "look for", "look up",
        "where is", "where are", "do i have", "my flashcards", "my notes", "my chats",
    ]
    if any(keyword in query_lower for keyword in search_keywords):
        return {"action": "search", "confidence": 0.75}

    if "flashcard" in query_lower:
        if any(keyword in query_lower for keyword in ("create", "make", "generate", "build")):
            topic = _extract_topic(query_clean, [
                r"(?:flashcards?|cards?)\s+(?:on|about|for)\s+(.+)",
                r"(?:create|make|generate|build)\s+(?:flashcards?|cards?)\s+(?:on|about|for)?\s*(.+)",
            ])
            return {"action": "create_flashcards", "topic": topic or query_clean, "confidence": 0.85}
        return {"action": "search", "confidence": 0.7}

    if "note" in query_lower:
        if any(keyword in query_lower for keyword in ("create", "make", "write", "generate")):
            topic = _extract_topic(query_clean, [
                r"(?:notes?|note)\s+(?:on|about|for)\s+(.+)",
                r"(?:create|make|write|generate)\s+(?:notes?|note)\s+(?:on|about|for)?\s*(.+)",
            ])
            return {"action": "create_note", "topic": topic or query_clean, "confidence": 0.85}
        return {"action": "search", "confidence": 0.7}

    if "quiz" in query_lower or "test" in query_lower:
        topic = _extract_topic(query_clean, [
            r"(?:quiz|test)\s+(?:me\s+)?(?:on|about|for)\s+(.+)",
            r"(?:create|make|generate)\s+(?:a\s+)?(?:quiz|test)\s+(?:on|about|for)?\s*(.+)",
        ])
        return {"action": "create_quiz", "topic": topic or query_clean, "confidence": 0.85}

    if "question" in query_lower:
        topic = _extract_topic(query_clean, [
            r"(?:questions?)\s+(?:on|about|for)\s+(.+)",
            r"(?:create|make|generate)\s+(?:questions?)\s+(?:on|about|for)?\s*(.+)",
        ])
        return {"action": "create_questions", "topic": topic or query_clean, "confidence": 0.85}

    if query_lower.startswith(("explain", "what is", "how does", "define", "tell me about", "summarize")):
        topic = re.sub(r"^(explain|what is|how does|define|tell me about|summarize)\s+", "", query_clean, flags=re.IGNORECASE)
        return {"action": "explain", "topic": topic or query_clean, "confidence": 0.8}

    if "chat" in query_lower or "talk" in query_lower or "discuss" in query_lower:
        return {"action": "start_chat", "topic": query_clean, "confidence": 0.75}

    return {"action": "search", "confidence": 0.6}

_JUNK_TOPICS = frozenset({
    "hi", "hello", "hey", "yo", "yoooo", "yoo", "yooo", "sup", "what", "ok", "okay",
    "test", "testing", "lol", "hmm", "hm", "uh", "um", "new chat", "untitled",
    "chat", "session", "help", "bye", "thanks", "thank", "haha", "cool",
})

def _is_valid_topic(text: str) -> bool:
    if not text or len(text.strip()) < 4:
        return False
    words = text.strip().lower().split()
    if len(words) == 1 and words[0] in _JUNK_TOPICS:
        return False
    if len(words) <= 2 and words[0] in _JUNK_TOPICS:
        return False
    if re.match(r'^[\d\s\W]+$', text.strip()):
        return False
    return True

def _build_topic_suggestions(topic: str) -> List[str]:
    return [
        f"/flashcards {topic}",
        f"/notes {topic}",
        f"/quiz {topic}",
        f"/questions {topic}",
        f"/explain {topic}",
        f"/path {topic}",
        f"/chat {topic}",
    ]

def _build_default_command_suggestions() -> List[str]:
    return [
        "/help",
        "/progress",
        "/weak",
        "/review",
        "/learning-paths",
        "/chat",
    ]

def _extract_topic_from_episode(entry: dict) -> Optional[str]:
    meta = entry.get("metadata") or {}
    for key in ("topic", "note_title", "set_title", "concept"):
        value = meta.get(key)
        if value:
            topic = _clean_topic(str(value))
            if _is_valid_topic(topic):
                return topic
    doc = entry.get("document", "")
    match = re.search(r"\"([^\"]+)\"", doc)
    if match:
        topic = _clean_topic(match.group(1))
        if _is_valid_topic(topic):
            return topic
    match = re.search(r"about ([^\.]+)", doc, flags=re.IGNORECASE)
    if match:
        topic = _clean_topic(match.group(1))
        if _is_valid_topic(topic):
            return topic
    return None

def _get_chroma_suggestions(user_id: str, query: Optional[str], limit: int = 8) -> List[str]:
    try:
        from tutor import chroma_store
    except Exception:
        return []

    if not chroma_store.available():
        return []

    episodes: List[dict] = []
    if query:
        episodes = chroma_store.retrieve_episodes_filtered(user_id, query, top_k=limit)
    else:
        for source in ("note_activity", "flashcard_created", "chat", "flashcard_review",
                       "quiz_created", "quiz_completed"):
            episodes.extend(chroma_store.retrieve_recent_by_source(user_id, source, top_k=4))

    suggestions: List[str] = []
    seen_topics: set = set()

    for entry in episodes:
        meta = entry.get("metadata") or {}
        source = meta.get("source", "")
        topic = _extract_topic_from_episode(entry)

        if not topic or topic.lower() in seen_topics:
            continue
        seen_topics.add(topic.lower())

        if source == "note_activity":
            suggestions.append(f"/flashcards {topic}")
            suggestions.append(f"/quiz {topic}")
        elif source == "flashcard_created":
            suggestions.append(f"/quiz {topic}")
            suggestions.append("/review")
        elif source == "flashcard_review":
            was_correct = str(meta.get("was_correct", "")).lower() == "false"
            marked = meta.get("action") == "marked_for_review"
            if was_correct or marked:
                suggestions.append("/review")
            else:
                suggestions.append("/review")
        elif source in ("quiz_created", "quiz_completed"):
            try:
                score = float(meta.get("score", 100))
            except (ValueError, TypeError):
                score = 100.0
            if score < 65:
                suggestions.append(f"/flashcards {topic}")
                suggestions.append("/review")
            elif score < 80:
                suggestions.append(f"/quiz {topic}")
            else:
                suggestions.append(f"/notes {topic}")
        elif source == "chat":
            suggestions.append(f"/flashcards {topic}")

        if len(suggestions) >= limit:
            break

    try:
        weak_topics = chroma_store.get_weak_quiz_topics(user_id, top_k=2)
        for wt in weak_topics:
            if _is_valid_topic(wt):
                suggestions.insert(0, f"/flashcards {wt}")
                suggestions.insert(0, f"/quiz {wt}")
    except Exception:
        pass

    try:
        important_entries = chroma_store.retrieve_important(user_id, top_k=3)
        for entry in important_entries:
            topic = _extract_topic_from_episode(entry)
            if not topic or topic.lower() in seen_topics:
                continue
            seen_topics.add(topic.lower())
            suggestions.append(f"/notes {topic}")
            suggestions.append(f"/explain {topic}")
            if len(suggestions) >= limit:
                break
    except Exception:
        pass

    return _dedupe_preserve(suggestions)[:limit]

async def _create_note_with_ai(
    db: Session,
    user: models.User,
    topic: str,
    content: Optional[str],
    depth: str,
    tone: str,
    use_hs_context: bool = True,
) -> dict:
    note_title = topic.strip() if topic else "New Note"
    logger.info(
        f"[NOTE ROUTE] create note | topic='{note_title}' user={user.id} "
        f"HS_MODE={'ON  <-- curriculum RAG will run' if use_hs_context else 'OFF <-- no RAG, model-only'}"
    )
    if not content:
        try:
            from note_graph import get_note_graph
            note_graph_instance = get_note_graph()
            if note_graph_instance:
                content = await note_graph_instance.invoke(
                    user_id=str(user.id),
                    topic=note_title,
                    generation_type="topic",
                    depth=depth or "standard",
                    tone=tone or "professional",
                    use_hs_context=use_hs_context,
                )
        except Exception as e:
            logger.warning(f"Note graph invoke failed: {e}")

        if not content:
            depth_lower = (depth or "standard").lower()
            depth_guidance = {
                "brief": "Keep it concise with key bullets and short sections.",
                "deep": "Go in depth with detailed explanations and examples.",
            }
            prompt = (
                f"Create study notes on: {note_title}\n\n"
                f"Tone: {tone}\n"
                f"{depth_guidance.get(depth_lower, 'Use clear headers, bullets, and examples when helpful.')}\n"
                f"Format with markdown headers and bullet points."
            )
            try:
                content = call_ai(prompt, max_tokens=2000, temperature=0.7).strip()
            except Exception:
                content = f"# {note_title}\n\n- Key ideas\n- Definitions\n- Examples"

    new_note = models.Note(user_id=user.id, title=note_title, content=content or "")
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    try:
        from gamification_system import award_points
        award_points(db, user.id, "note_created")
        db.commit()
    except Exception:
        pass

    try:
        from tutor import chroma_store
        if chroma_store.available():
            clean_preview = re.sub(r'<[^>]+>', '', content or "")
            clean_preview = re.sub(r'[#*_\[\]()]', '', clean_preview).strip()
            preview = clean_preview[:200]
            summary = (
                f"Note created: \"{note_title}\". Content: {preview}" if preview
                else f"Note created: \"{note_title}\" (empty note)"
            )
            chroma_store.write_episode(
                user_id=str(user.id),
                summary=summary,
                metadata={
                    "source": "note_activity",
                    "action": "created",
                    "note_id": str(new_note.id),
                    "note_title": note_title[:100],
                },
            )
    except Exception as e:
        logger.warning(f"Chroma write failed on searchhub note create: {e}")

    return {
        "id": new_note.id,
        "title": new_note.title,
        "content": new_note.content,
    }

@router.post("")
async def searchhub_agent(request: SearchHubRequest, db: Session = Depends(get_db)):
    query = (request.query or "").strip()
    user = _resolve_user(db, request.user_id)

    if request.session_id:
        history = SESSION_CONTEXT.setdefault(request.session_id, [])
        history.append({"query": query})
        if len(history) > 20:
            history.pop(0)

    intent = None
    try:
        from searchhub_graph import get_searchhub_graph
        graph = get_searchhub_graph()
        if graph:
            intent = await graph.invoke(
                user_id=request.user_id,
                query=query,
                context=request.context,
            )
    except Exception as e:
        logger.warning(f"SearchHub graph invoke failed: {e}")

    if not intent:
        intent = _infer_action(query)
    action = intent.get("action")
    topic = intent.get("topic") or query
    intent_difficulty = intent.get("difficulty")
    difficulty = intent_difficulty if intent_difficulty in ("easy", "medium", "hard") else None
    count = intent.get("count") or _extract_count(query) or 10
    difficulty = difficulty or _extract_difficulty(query) or "medium"
    path_difficulty = intent_difficulty if intent_difficulty in _PATH_DIFFICULTY_LEVELS else None
    path_length = intent.get("length") if intent.get("length") in _PATH_LENGTH_LEVELS else None
    note_depth = intent.get("depth") if intent.get("depth") in _NOTE_DEPTH_LEVELS else None
    note_tone = intent.get("tone") or "professional"

    if action in {"create_note", "create_flashcards", "create_questions", "create_quiz"} and not user:
        return {
            "ai_response": "Please log in to create content. Once you are logged in, I can create notes, flashcards, and quizzes for you.",
            "search_results": [],
            "suggestions": ["log in", "create an account"],
            "metadata": {
                "action": "auth_required",
                "confidence": intent.get("confidence", 0.4),
                "topic": topic,
                "response_type": "chat",
                "chatbot_message": "Log in required to create content.",
            },
        }

    if action in _ACTION_REQUIRES_TOPIC and not (topic and topic.strip()):
        return {
            "ai_response": "Tell me the topic you want to work on so I can continue.",
            "search_results": [],
            "suggestions": _get_action_command_examples(action),
            "metadata": {
                "action": "need_topic",
                "confidence": intent.get("confidence", 0.5),
                "topic": topic,
                "response_type": "chat",
                "chatbot_message": "Which topic should I use?",
            },
        }

    if action == "greeting":
        return {
            "ai_response": "Hi! What would you like to learn or create today?",
            "search_results": [],
            "suggestions": [
                "/flashcards biology",
                "/notes world history",
                "/explain photosynthesis",
                "/quiz calculus",
            ],
            "metadata": {
                "action": "greeting",
                "confidence": intent.get("confidence", 0.95),
                "response_type": "chat",
                "chatbot_message": "Hi! How can I help?",
            },
        }

    if action == "show_help":
        return {
            "ai_response": (
                "SearchHub works like a command terminal. Try:\n"
                "/flashcards <topic> — create flashcards\n"
                "/notes <topic> — create notes\n"
                "/quiz <topic> — start a quiz\n"
                "/path <topic> — generate a learning path\n"
                "/progress — open study insights\n"
                "Type /help anytime to see the full command list."
            ),
            "search_results": [],
            "suggestions": [
                "/flashcards biology",
                "/notes world history",
                "/quiz calculus",
                "/path machine learning",
                "/progress",
                "/weak",
            ],
            "metadata": {
                "action": "show_help",
                "confidence": intent.get("confidence", 0.9),
                "response_type": "chat",
                "chatbot_message": "Here are a few things I can do.",
            },
        }

    if action == "show_progress":
        return {
            "navigate_to": "/study-insights",
            "metadata": {
                "action": "show_progress",
                "confidence": intent.get("confidence", 0.85),
                "response_type": "navigation",
                "chatbot_message": "Opening your study insights.",
            },
        }

    if action == "show_achievements":
        return {
            "navigate_to": "/study-insights?tab=achievements",
            "metadata": {
                "action": "show_achievements",
                "confidence": intent.get("confidence", 0.85),
                "response_type": "navigation",
                "chatbot_message": "Showing your achievements.",
            },
        }

    if action == "show_weak_areas":
        return {
            "navigate_to": "/study-insights?tab=weak",
            "metadata": {
                "action": "show_weak_areas",
                "confidence": intent.get("confidence", 0.85),
                "response_type": "navigation",
                "chatbot_message": "Loading your weak areas.",
            },
        }

    if action == "review_flashcards":
        return {
            "navigate_to": "/flashcards",
            "metadata": {
                "action": "review_flashcards",
                "confidence": intent.get("confidence", 0.85),
                "response_type": "navigation",
                "chatbot_message": "Opening flashcards.",
            },
        }

    if action == "create_learning_path":
        return {
            "navigate_to": "/learning-paths",
            "navigate_params": {
                "autoGenerate": True,
                "topic": topic,
                "difficulty": path_difficulty or "intermediate",
                "length": path_length or "medium",
            },
            "metadata": {
                "action": "create_learning_path",
                "confidence": intent.get("confidence", 0.8),
                "response_type": "navigation",
                "chatbot_message": f"Generating a learning path for {topic}.",
            },
        }

    if action == "show_learning_paths":
        return {
            "navigate_to": "/learning-paths",
            "metadata": {
                "action": "show_learning_paths",
                "confidence": intent.get("confidence", 0.8),
                "response_type": "navigation",
                "chatbot_message": "Showing your learning paths.",
            },
        }

    if action == "start_chat":
        return {
            "navigate_to": "/ai-chat",
            "navigate_params": {"initialMessage": topic},
            "metadata": {
                "action": "start_chat",
                "confidence": intent.get("confidence", 0.75),
                "response_type": "navigation",
                "chatbot_message": "Opening chat.",
            },
        }

    if action == "explain":
        prompt = (
            f"Explain the topic '{topic}' clearly and concisely. "
            f"Use simple language and 2-4 short paragraphs."
        )
        try:
            explanation = call_ai(prompt, max_tokens=400, temperature=0.6).strip()
        except Exception:
            explanation = f"Here is a concise overview of {topic}. I can also create flashcards or notes if you'd like."

        return {
            "ai_response": explanation,
            "search_results": [],
            "suggestions": _build_topic_suggestions(topic),
            "metadata": {
                "action": "explain",
                "confidence": intent.get("confidence", 0.75),
                "topic": topic,
                "response_type": "chat",
                "chatbot_message": "Here is a quick explanation.",
            },
        }

    if action == "create_note":
        note_data = await _create_note_with_ai(
            db,
            user,
            topic,
            None,
            note_depth or "standard",
            note_tone or "professional",
            use_hs_context=request.use_hs_context,
        )
        return {
            "success": True,
            "content_id": note_data["id"],
            "content_title": note_data["title"],
            "navigate_to": f"/notes/editor/{note_data['id']}",
            "metadata": {
                "action": "create_note",
                "confidence": intent.get("confidence", 0.85),
                "topic": topic,
                "response_type": "navigation",
                "chatbot_message": f"Created notes on {note_data['title']}.",
            },
        }

    if action == "create_flashcards":
        from routes import flashcards as flashcard_routes

        generation_type = "topic"
        response = await flashcard_routes.generate_flashcards_endpoint(
            user_id=request.user_id,
            topic=topic,
            generation_type=generation_type,
            card_count=count,
            difficulty=difficulty,
            db=db,
        )
        set_id = response.get("set_id")
        set_title = response.get("set_title") or topic
        return {
            "success": True,
            "content_id": set_id,
            "content_title": set_title,
            "navigate_to": f"/flashcards?set_id={set_id}" if set_id else "/flashcards",
            "metadata": {
                "action": "create_flashcards",
                "confidence": intent.get("confidence", 0.85),
                "topic": topic,
                "response_type": "navigation",
                "chatbot_message": f"Created flashcards on {set_title}.",
            },
        }

    if action in {"create_questions", "create_quiz"}:
        from routes import questions as question_routes

        payload = {
            "user_id": request.user_id,
            "topic": topic,
            "question_count": count,
            "difficulty_mix": {"easy": 3, "medium": 5, "hard": 2},
            "question_types": ["multiple_choice"],
            "title": f"Practice: {topic[:50]}",
        }
        response = await question_routes.generate_practice_questions(payload=payload, db=db)
        content_id = response.get("question_set_id") or response.get("id")
        navigate_to = f"/question-bank?set_id={content_id}" if content_id else "/question-bank"

        return {
            "success": True,
            "content_id": content_id,
            "content_title": response.get("title") or topic,
            "navigate_to": navigate_to,
            "metadata": {
                "action": action,
                "confidence": intent.get("confidence", 0.85),
                "topic": topic,
                "response_type": "navigation",
                "chatbot_message": f"Created questions on {topic}.",
            },
        }

    if user:
        from routes import search as search_routes

        filters = request.context or {}
        content_types = filters.get("content_types", "all")
        sort_by = filters.get("sort_by", "relevance")
        date_from = filters.get("date_from")
        date_to = filters.get("date_to")

        search_result = await search_routes.search_content(
            user_id=request.user_id,
            query=query,
            content_types=content_types,
            sort_by=sort_by,
            date_from=date_from,
            date_to=date_to,
            db=db,
        )

        suggestions = _get_chroma_suggestions(str(user.id), query, limit=6)
        if not suggestions:
            suggestions = search_result.get("related_searches", []) or _build_topic_suggestions(topic)

        ai_response = None
        if not search_result.get("results"):
            try:
                ai_response = call_ai(
                    f"Provide a short, friendly description of '{topic}' in 2-3 sentences.",
                    max_tokens=200,
                    temperature=0.6,
                ).strip()
            except Exception:
                ai_response = (
                    f"I can help you learn about {topic}. "
                    "Ask me to create notes, flashcards, or a quick quiz."
                )

        return {
            "search_results": search_result.get("results", []),
            "ai_response": ai_response,
            "suggestions": suggestions,
            "metadata": {
                "action": "search",
                "confidence": intent.get("confidence", 0.6),
                "topic": topic,
                "response_type": "search",
            },
        }

    ai_response = "I can help explain a topic or create study materials. Log in to search your saved content."
    return {
        "ai_response": ai_response,
        "search_results": [],
        "suggestions": _build_topic_suggestions(topic),
        "metadata": {
            "action": "search",
            "confidence": intent.get("confidence", 0.4),
            "topic": topic,
            "response_type": "chat",
        },
    }

@router.post("/create-note")
async def create_note_endpoint(request: CreateNoteRequest, db: Session = Depends(get_db)):
    user = _resolve_user(db, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    note_data = await _create_note_with_ai(
        db=db,
        user=user,
        topic=request.topic,
        content=request.content,
        depth=request.depth,
        tone=request.tone,
        use_hs_context=request.use_hs_context,
    )

    return {
        "success": True,
        "content_id": note_data["id"],
        "content_title": note_data["title"],
        "navigate_to": f"/notes/editor/{note_data['id']}",
    }

@router.post("/create-flashcards")
async def create_flashcards_endpoint(request: CreateFlashcardsRequest, db: Session = Depends(get_db)):
    user = _resolve_user(db, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from routes import flashcards as flashcard_routes

    generation_type = "chat_history" if request.content else "topic"
    response = await flashcard_routes.generate_flashcards_endpoint(
        user_id=request.user_id,
        topic=request.topic,
        generation_type=generation_type,
        content=request.content,
        card_count=request.count,
        difficulty=request.difficulty,
        db=db,
    )

    set_id = response.get("set_id")
    set_title = response.get("set_title") or request.topic

    return {
        "success": True,
        "content_id": set_id,
        "content_title": set_title,
        "navigate_to": f"/flashcards?set_id={set_id}" if set_id else "/flashcards",
        "flashcards": response.get("flashcards", []),
    }

@router.post("/create-questions")
async def create_questions_endpoint(request: CreateQuestionsRequest, db: Session = Depends(get_db)):
    user = _resolve_user(db, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from routes import questions as question_routes

    payload = {
        "user_id": request.user_id,
        "topic": request.topic,
        "question_count": request.count,
        "difficulty_mix": request.difficulty_mix or {"easy": 3, "medium": 5, "hard": 2},
        "question_types": ["multiple_choice"],
        "title": f"Practice: {request.topic[:50]}",
        "use_hs_context": request.use_hs_context,
    }
    response = await question_routes.generate_practice_questions(payload=payload, db=db)
    content_id = response.get("question_set_id") or response.get("id")

    return {
        "success": True,
        "content_id": content_id,
        "content_title": response.get("title") or request.topic,
        "navigate_to": f"/question-bank?set_id={content_id}" if content_id else "/question-bank",
        "questions": response.get("questions", []),
    }

@router.post("/explain")
async def explain_endpoint(request: ExplainRequest, db: Session = Depends(get_db)):
    topic = request.topic.strip()
    prompt = (
        f"Explain the topic '{topic}' clearly and concisely. "
        f"Use simple language and 2-4 short paragraphs."
    )
    try:
        explanation = call_ai(prompt, max_tokens=400, temperature=0.6).strip()
    except Exception:
        explanation = f"Here is a concise overview of {topic}. I can also create flashcards or notes if you'd like."

    return {
        "success": True,
        "topic": topic,
        "explanation": explanation,
    }

@router.get("/suggestions")
async def suggestions_endpoint(
    query: str = Query("", min_length=0),
    user_id: str = Query("guest"),
    db: Session = Depends(get_db),
):
    user = _resolve_user(db, user_id)
    suggestions: List[str] = []

    if user:
        suggestions.extend(_get_chroma_suggestions(str(user.id), query, limit=8))

    if query:
        suggestions.extend(_build_topic_suggestions(query))

    if not suggestions:
        suggestions = _build_default_command_suggestions()

    return {"success": True, "suggestions": _dedupe_preserve(suggestions)[:8]}

@router.get("/actions")
async def actions_endpoint():
    return {
        "success": True,
        "actions": [
            {"action": "create_note", "label": "Create Note"},
            {"action": "create_flashcards", "label": "Create Flashcards"},
            {"action": "create_questions", "label": "Create Questions"},
            {"action": "create_quiz", "label": "Create Quiz"},
            {"action": "create_learning_path", "label": "Create Learning Path"},
            {"action": "show_progress", "label": "Show Progress"},
            {"action": "show_weak_areas", "label": "Show Weak Areas"},
            {"action": "review_flashcards", "label": "Review Flashcards"},
            {"action": "start_chat", "label": "Start Chat"},
        ],
        "commands": _get_command_catalog(),
    }

@router.get("/commands")
async def commands_endpoint():
    return {
        "success": True,
        "commands": _get_command_catalog(),
    }

@router.post("/clear-context")
async def clear_context_endpoint(request: ClearContextRequest):
    if request.session_id in SESSION_CONTEXT:
        SESSION_CONTEXT.pop(request.session_id, None)
    return {"success": True, "session_id": request.session_id}
