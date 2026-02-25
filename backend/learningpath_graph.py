from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional, TypedDict

try:
    from langgraph.graph import StateGraph, END
except Exception:
    StateGraph = None
    END = None

logger = logging.getLogger(__name__)

class LearningPathState(TypedDict, total=False):
    user_id: str
    topic: str
    difficulty: str
    length: str
    goals: list[str]
    title: str
    description: str
    estimated_hours: float
    nodes: list[dict]
    _ai_client: Any

_LENGTH_TO_COUNT = {
    "short": 6,
    "medium": 8,
    "long": 10,
}

def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())

def _safe_list(value) -> list:
    if not value:
        return []
    if isinstance(value, list):
        return [v for v in value if v]
    return [value]

def _topic_keywords(topic: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]+", topic.lower())
    stop = {"and", "or", "the", "of", "to", "in", "for", "with", "on", "a"}
    keywords = [w for w in words if w not in stop and len(w) > 2]
    seen = set()
    ordered = []
    for w in keywords:
        if w not in seen:
            seen.add(w)
            ordered.append(w)
    return ordered[:8]

def _default_node_titles(topic: str, count: int, difficulty: str) -> list[str]:
    core = [
        f"Foundations of {topic}",
        f"Core Concepts in {topic}",
        f"Essential Techniques for {topic}",
        f"Working with {topic} in Practice",
        f"Patterns and Pitfalls in {topic}",
        f"Applied Projects in {topic}",
        f"Advanced {topic} Strategies",
        f"Capstone and Next Steps in {topic}",
        f"Optimization and Scaling for {topic}",
        f"Real-World Systems with {topic}",
        f"Evaluation and Improvement in {topic}",
        f"Portfolio-Ready {topic} Workflows",
    ]
    if difficulty == "beginner":
        core[0] = f"Orientation to {topic}"
        core[1] = f"Fundamentals of {topic}"
    if difficulty == "advanced":
        core[0] = f"Advanced Foundations of {topic}"
    return core[:count]

def _default_content_plan(node_title: str, difficulty: str, length: str) -> list[dict]:
    flashcard_count = 6
    quiz_count = 5
    if length == "long":
        flashcard_count = 10
        quiz_count = 8
    if difficulty == "advanced":
        quiz_count += 2

    return [
        {
            "type": "notes",
            "description": f"Summarize key ideas from {node_title} into structured notes.",
        },
        {
            "type": "flashcards",
            "description": "Lock in vocabulary and key facts with spaced repetition cards.",
            "count": flashcard_count,
        },
        {
            "type": "quiz",
            "description": "Check your understanding with scenario-based questions.",
            "question_count": quiz_count,
        },
        {
            "type": "chat",
            "description": "Ask follow-up questions and explore edge cases with the tutor.",
        },
    ]

def _default_core_sections(node_title: str, topic: str) -> list[dict]:
    return [
        {
            "title": "Why this matters",
            "content": f"{node_title} anchors your understanding of {topic}. It sets the mental model used in later chapters.",
            "example": f"Example: identify how {node_title.lower()} appears in a real {topic} workflow.",
        },
        {
            "title": "Key ideas",
            "content": f"Break {node_title} into 3-5 key ideas and link each to a practical outcome.",
            "example": f"Example: map each idea to a quick checklist you can apply.",
        },
        {
            "title": "Common pitfalls",
            "content": "Spot the usual mistakes early so your practice is efficient and accurate.",
            "example": "Example: track where assumptions fail and how to validate them.",
        },
    ]

def _default_summary(node_title: str) -> list[str]:
    return [
        f"Define and explain the core components of {node_title}.",
        "Apply the ideas to a realistic mini-task.",
        "Identify typical mistakes and how to avoid them.",
    ]

def _default_applications(topic: str) -> list[str]:
    return [
        f"Improve real-world projects that involve {topic}.",
        f"Communicate {topic} concepts clearly to teammates.",
        f"Evaluate tradeoffs when applying {topic} in production.",
    ]

def _default_scenarios(topic: str, node_title: str) -> list[dict]:
    return [
        {
            "title": f"{node_title} quick check",
            "description": f"You are asked to explain a {topic} decision to a teammate.",
            "question": "Which option best supports your explanation?",
            "options": [
                "State the decision without context",
                "Link the decision to constraints and expected outcomes",
                "Avoid specifics to keep it short",
                "Focus only on tools, not reasoning",
            ],
            "correct": 1,
            "explanation": "Strong explanations connect constraints, reasoning, and outcomes.",
        }
    ]

def _default_concept_map(topic: str) -> dict:
    concepts = [topic, "Foundations", "Applications", "Evaluation"]
    return {
        "concepts": concepts,
        "relationships": [
            {"from": "Foundations", "to": topic, "label": "supports"},
            {"from": topic, "to": "Applications", "label": "enables"},
            {"from": "Applications", "to": "Evaluation", "label": "validated by"},
        ],
    }

def _default_outline(topic: str, difficulty: str, length: str, goals: list[str] | None) -> dict:
    topic = _clean_text(topic) or "Learning Path"
    difficulty = difficulty or "intermediate"
    length = length or "medium"
    goals = goals or []

    count = _LENGTH_TO_COUNT.get(length, 8)
    titles = _default_node_titles(topic, count, difficulty)

    nodes = []
    for idx, title in enumerate(titles):
        objectives = [
            f"Explain the core ideas in {title}.",
            f"Apply {title} concepts to a focused practice task.",
            "Identify risks, pitfalls, and quality checks.",
        ]
        if goals:
            objectives.append(f"Connect {title} to your goal: {goals[0]}")

        prerequisites = []
        if idx > 0:
            prerequisites.append(titles[idx - 1])

        nodes.append(
            {
                "title": title,
                "description": f"Build practical intuition for {title} and how it fits into the larger {topic} journey.",
                "objectives": objectives,
                "prerequisites": prerequisites,
                "estimated_minutes": 35 if length == "medium" else (30 if length == "short" else 45),
                "content_plan": _default_content_plan(title, difficulty, length),
                "introduction": f"This chapter focuses on {title} so you can move from concepts to confident application.",
                "core_sections": _default_core_sections(title, topic),
                "summary": _default_summary(title),
                "real_world_applications": _default_applications(topic),
                "tags": _topic_keywords(topic),
                "keywords": _topic_keywords(topic),
                "connection_map": {
                    "builds_on": prerequisites,
                    "leads_to": [titles[idx + 1]] if idx + 1 < len(titles) else [],
                    "related_topics": _topic_keywords(topic)[:3],
                },
                "scenarios": _default_scenarios(topic, title),
                "concept_mapping": _default_concept_map(topic),
                "reward": {"xp": 50 + idx * 5},
            }
        )

    total_minutes = sum(n.get("estimated_minutes", 30) for n in nodes)
    return {
        "title": topic,
        "description": f"A structured, goal-driven path to master {topic} with checkpoints, practice, and applied projects.",
        "estimated_hours": round(total_minutes / 60, 1),
        "nodes": nodes,
    }

def _build_prompt(topic: str, difficulty: str, length: str, goals: list[str]) -> str:
    goals_text = ", ".join(goals) if goals else "(none)"
    return (
        "You are designing an advanced learning path.\n"
        "Return ONLY valid JSON.\n"
        "Schema: {title, description, estimated_hours, nodes:[{title, description, objectives, prerequisites, estimated_minutes, "
        "introduction, core_sections, summary, real_world_applications, content_plan, tags, keywords}]}\n"
        "core_sections is a list of objects with {title, content, example}.\n"
        "content_plan is a list of objects with {type, description, count?, question_count?}.\n"
        f"Topic: {topic}\nDifficulty: {difficulty}\nLength: {length}\nGoals: {goals_text}\n"
        "Ensure 6-10 nodes depending on length."
    )

def _parse_json_payload(raw: str) -> Optional[dict]:
    if not raw:
        return None
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except Exception:
        return None

def build_outline(state: LearningPathState) -> dict:
    topic = _clean_text(state.get("topic", ""))
    difficulty = state.get("difficulty", "intermediate")
    length = state.get("length", "medium")
    goals = _safe_list(state.get("goals"))
    ai_client = state.get("_ai_client")

    if not ai_client:
        return _default_outline(topic, difficulty, length, goals)

    try:
        prompt = _build_prompt(topic, difficulty, length, goals)
        response = ai_client.generate(prompt, max_tokens=1800, temperature=0.4)
        parsed = _parse_json_payload(response)
        if parsed and parsed.get("nodes"):
            return parsed
    except Exception as e:
        logger.warning(f"Learning path AI outline failed: {e}")

    return _default_outline(topic, difficulty, length, goals)

def normalize_outline(state: LearningPathState) -> dict:
    topic = _clean_text(state.get("topic", ""))
    difficulty = state.get("difficulty", "intermediate")
    length = state.get("length", "medium")
    goals = _safe_list(state.get("goals"))

    outline = state.get("nodes")
    if outline is None or not isinstance(outline, list):
        outline_data = _default_outline(topic, difficulty, length, goals)
    else:
        outline_data = {
            "title": _clean_text(state.get("title", topic)) or topic,
            "description": _clean_text(state.get("description", "")),
            "estimated_hours": state.get("estimated_hours"),
            "nodes": outline,
        }

    if not outline_data.get("description"):
        outline_data["description"] = f"A structured learning plan to master {topic}."

    nodes = []
    for idx, node in enumerate(outline_data.get("nodes", [])):
        if not isinstance(node, dict):
            continue
        title = _clean_text(node.get("title", "")) or f"Chapter {idx + 1}"
        description = _clean_text(node.get("description", ""))
        objectives = _safe_list(node.get("objectives"))
        prerequisites = _safe_list(node.get("prerequisites"))
        estimated_minutes = node.get("estimated_minutes") or node.get("estimatedMinutes") or 35
        try:
            estimated_minutes = int(estimated_minutes)
        except (TypeError, ValueError):
            estimated_minutes = 35
        intro = _clean_text(node.get("introduction", "")) or f"Focus on {title} within {topic}."

        core_sections = node.get("core_sections") or _default_core_sections(title, topic)
        if not isinstance(core_sections, list):
            core_sections = _default_core_sections(title, topic)

        summary = _safe_list(node.get("summary")) or _default_summary(title)
        real_world = _safe_list(node.get("real_world_applications")) or _default_applications(topic)
        content_plan = node.get("content_plan") or _default_content_plan(title, difficulty, length)

        nodes.append(
            {
                "title": title,
                "description": description or f"Build mastery in {title}.",
                "objectives": objectives,
                "prerequisites": prerequisites,
                "estimated_minutes": estimated_minutes,
                "content_plan": content_plan,
                "introduction": intro,
                "core_sections": core_sections,
                "summary": summary,
                "real_world_applications": real_world,
                "tags": node.get("tags") or _topic_keywords(topic),
                "keywords": node.get("keywords") or _topic_keywords(topic),
                "connection_map": node.get("connection_map") or {
                    "builds_on": prerequisites,
                    "leads_to": [],
                    "related_topics": _topic_keywords(topic)[:3],
                },
                "scenarios": node.get("scenarios") or _default_scenarios(topic, title),
                "concept_mapping": node.get("concept_mapping") or _default_concept_map(topic),
                "reward": node.get("reward") or {"xp": 50 + idx * 5},
                "primary_resources": node.get("primary_resources") or [],
                "supplementary_resources": node.get("supplementary_resources") or [],
                "practice_resources": node.get("practice_resources") or [],
            }
        )

    if not nodes:
        nodes = _default_outline(topic, difficulty, length, goals)["nodes"]

    total_minutes = sum(n.get("estimated_minutes", 30) for n in nodes)
    estimated_hours = outline_data.get("estimated_hours") or round(total_minutes / 60, 1)

    return {
        "title": outline_data.get("title") or topic,
        "description": outline_data.get("description"),
        "estimated_hours": estimated_hours,
        "nodes": nodes,
    }

class LearningPathGraph:
    def __init__(self, ai_client: Any, db_session_factory: Any = None):
        self.ai_client = ai_client
        self.db_factory = db_session_factory
        self._graph = self._build() if StateGraph else None

    def _build(self):
        g = StateGraph(LearningPathState)
        g.add_node("outline", build_outline)
        g.add_node("normalize", normalize_outline)
        g.set_entry_point("outline")
        g.add_edge("outline", "normalize")
        g.add_edge("normalize", END)
        return g.compile()

    def invoke(
        self,
        user_id: str,
        topic: str,
        difficulty: str = "intermediate",
        length: str = "medium",
        goals: Optional[list[str]] = None,
    ) -> dict:
        state: LearningPathState = {
            "user_id": str(user_id),
            "topic": topic,
            "difficulty": difficulty,
            "length": length,
            "goals": goals or [],
            "_ai_client": self.ai_client,
        }
        try:
            if self._graph:
                result = self._graph.invoke(state)
            else:
                result = normalize_outline({**state, **build_outline(state)})
            return {
                "title": result.get("title", topic),
                "description": result.get("description", ""),
                "estimated_hours": result.get("estimated_hours", 0.0),
                "nodes": result.get("nodes", []),
            }
        except Exception as e:
            logger.warning(f"LearningPath graph failed: {e}")
            fallback = _default_outline(topic, difficulty, length, goals or [])
            return {
                "title": fallback.get("title", topic),
                "description": fallback.get("description", ""),
                "estimated_hours": fallback.get("estimated_hours", 0.0),
                "nodes": fallback.get("nodes", []),
            }

_learningpath_graph: Optional[LearningPathGraph] = None

def create_learningpath_graph(ai_client: Any, db_session_factory: Any = None) -> LearningPathGraph:
    global _learningpath_graph
    _learningpath_graph = LearningPathGraph(ai_client, db_session_factory)
    return _learningpath_graph

def get_learningpath_graph() -> Optional[LearningPathGraph]:
    return _learningpath_graph
