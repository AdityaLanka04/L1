from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

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
for _cmd in _COMMAND_CATALOG:
    for _alias in _cmd["aliases"]:
        _COMMAND_ALIAS_MAP[_alias] = _cmd

ACTION_REQUIRES_TOPIC = {
    "create_note",
    "create_flashcards",
    "create_questions",
    "create_quiz",
    "create_learning_path",
    "explain",
}


def get_command_catalog() -> List[Dict[str, Any]]:
    return [dict(cmd) for cmd in _COMMAND_CATALOG]


def get_action_command_examples(action: str, limit: int = 3) -> List[str]:
    for cmd in _COMMAND_CATALOG:
        if cmd["action"] == action:
            examples = cmd.get("examples") or []
            if not examples and cmd.get("syntax"):
                examples = [cmd["syntax"]]
            return examples[:limit]
    return build_default_command_suggestions()[:limit]


def build_topic_suggestions(topic: str) -> List[str]:
    return [
        f"/flashcards {topic}",
        f"/notes {topic}",
        f"/quiz {topic}",
        f"/questions {topic}",
        f"/explain {topic}",
        f"/path {topic}",
        f"/chat {topic}",
    ]


def build_default_command_suggestions() -> List[str]:
    return [
        "/help",
        "/progress",
        "/weak",
        "/review",
        "/learning-paths",
        "/chat",
    ]


def _extract_topic(query: str, patterns: List[str]) -> Optional[str]:
    for pattern in patterns:
        match = re.search(pattern, query, flags=re.IGNORECASE)
        if match and match.group(1):
            topic = match.group(1).strip()
            if topic:
                return topic
    return None


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


def infer_action(query: str) -> Dict[str, Any]:
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
