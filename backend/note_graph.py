from __future__ import annotations

import logging
import re
from typing import Any, Optional, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class NoteGenState(TypedDict, total=False):
    user_id: str
    topic: str
    source_content: str      # optional raw content to base notes on
    generation_type: str     # "topic" | "content"
    depth: str               # brief | standard | deep
    tone: str                # professional | academic | casual | concise
    additional_specs: str
    # Personalisation — populated by fetch_context
    student_weaknesses: list[str]
    student_strengths: list[str]
    concept_prerequisites: list[str]
    common_mistakes: list[str]
    # Output
    built_prompt: str
    note_content: str
    _ai_client: Any
    _db_factory: Any


async def fetch_context(state: NoteGenState) -> dict:
    """Fetch personalisation data: DB mastery + Neo4j concept graph for the topic."""
    user_id = state.get("user_id", "")
    topic = state.get("topic", "")
    db_factory = state.get("_db_factory")

    weaknesses: list[str] = []
    strengths: list[str] = []
    prerequisites: list[str] = []
    mistakes: list[str] = []

    # ── SQLite: user's weak areas and mastered topics ─────────────────────────
    if db_factory:
        try:
            from models import UserWeakArea, TopicMastery
            db = db_factory()
            try:
                uid = int(user_id)

                weak_areas = (
                    db.query(UserWeakArea)
                    .filter(UserWeakArea.user_id == uid)
                    .order_by(UserWeakArea.weakness_score.desc())
                    .limit(5)
                    .all()
                )
                for wa in weak_areas:
                    if wa.topic and wa.topic not in weaknesses:
                        weaknesses.append(wa.topic)

                mastery = (
                    db.query(TopicMastery)
                    .filter(TopicMastery.user_id == uid, TopicMastery.mastery_level >= 0.7)
                    .limit(5)
                    .all()
                )
                for tm in mastery:
                    if tm.topic_name and tm.topic_name not in strengths:
                        strengths.append(tm.topic_name)
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"NoteGraph DB context fetch failed: {e}")

    # ── Neo4j: student concept map + topic prerequisites + common mistakes ────
    from tutor import neo4j_store
    if neo4j_store.available():
        try:
            # Get user's known mastered/struggling from graph
            concepts = await neo4j_store.get_student_concepts(user_id)
            for c in concepts.get("struggling", []):
                if c not in weaknesses:
                    weaknesses.append(c)
            for c in concepts.get("mastered", []):
                if c not in strengths:
                    strengths.append(c)

            # Get prerequisites and common mistakes for the topic being noted
            # Split topic into meaningful words to query the concept graph
            topic_concepts = [w for w in topic.split() if len(w) > 3]
            if topic_concepts:
                ctx = await neo4j_store.get_concept_context(topic_concepts[:4])
                prerequisites = ctx.get("prerequisites", [])
                mistakes = ctx.get("mistakes", [])
        except Exception as e:
            logger.warning(f"NoteGraph Neo4j context fetch failed: {e}")

    return {
        "student_weaknesses": weaknesses,
        "student_strengths": strengths,
        "concept_prerequisites": prerequisites,
        "common_mistakes": mistakes,
    }


DEPTH_GUIDES = {
    "brief": (
        "BRIEF — concise summary.\n"
        "- 3-5 bullet points per section, max 2 sections\n"
        "- Only the most important definitions and facts\n"
        "- No deep explanations — think revision cheat-sheet"
    ),
    "standard": (
        "STANDARD — balanced notes.\n"
        "- Clear headers, bullet points, and short explanations\n"
        "- Include key definitions, main concepts, and 1-2 examples\n"
        "- Enough detail to understand and revise from"
    ),
    "deep": (
        "DEEP — comprehensive reference notes.\n"
        "- Full explanations with reasoning and context\n"
        "- Cover prerequisites, edge cases, and common pitfalls\n"
        "- Include multiple worked examples and comparisons\n"
        "- Expert-level nuance and connections between concepts"
    ),
}

TONE_GUIDES = {
    "professional": "Clear, precise, neutral — like a well-written textbook.",
    "academic": "Formal language, citations-style structure, rigorous definitions.",
    "casual": "Conversational and friendly — explain like talking to a classmate.",
    "concise": "Ultra-tight — no fluff, every word earns its place.",
}


def build_prompt(state: NoteGenState) -> dict:
    """Build a personalised note-generation prompt."""
    topic = state.get("topic", "")
    source_content = state.get("source_content", "")
    generation_type = state.get("generation_type", "topic")
    depth = state.get("depth", "standard")
    tone = state.get("tone", "professional")
    additional_specs = (state.get("additional_specs") or "").strip()
    weaknesses = state.get("student_weaknesses", [])
    strengths = state.get("student_strengths", [])
    prerequisites = state.get("concept_prerequisites", [])
    mistakes = state.get("common_mistakes", [])

    if depth not in DEPTH_GUIDES:
        depth = "standard"
    if tone not in TONE_GUIDES:
        tone = "professional"

    parts = []

    # Source material
    if generation_type == "content" and source_content:
        parts.append(
            f"Create detailed study notes summarising this content:\n\n"
            f"{source_content[:4000]}\n\n"
            f"Topic title: {topic}\n"
        )
    else:
        parts.append(f"Create comprehensive study notes on: **{topic}**\n")

    # Depth guide
    parts.append(f"DEPTH:\n{DEPTH_GUIDES[depth]}\n")

    # Tone
    parts.append(f"TONE: {TONE_GUIDES[tone]}\n")

    # Personalisation — weak areas to emphasise
    if weaknesses:
        relevant_weak = [w for w in weaknesses[:5] if any(
            kw.lower() in topic.lower() or topic.lower() in kw.lower()
            for kw in w.split()
        )] or weaknesses[:3]
        if relevant_weak:
            parts.append(
                f"STUDENT WEAK AREAS: {', '.join(relevant_weak)}\n"
                "Emphasise and explain these areas more thoroughly in the notes.\n"
            )

    # Prerequisite concepts — cover them briefly so the student has the foundation
    if prerequisites:
        parts.append(
            f"PREREQUISITE CONCEPTS (from knowledge graph): {', '.join(prerequisites[:5])}\n"
            "Briefly cover or reference these so the student has the necessary foundation.\n"
        )

    # Common mistakes — explicitly include a 'Common Pitfalls' section
    if mistakes:
        parts.append(
            f"COMMON MISTAKES STUDENTS MAKE: {', '.join(mistakes[:5])}\n"
            "Include a 'Common Pitfalls' section explicitly addressing these.\n"
        )

    # Strong areas — don't over-explain what they already know
    if strengths:
        parts.append(
            f"STUDENT STRONG AREAS: {', '.join(strengths[:5])}\n"
            "Don't over-explain these — a brief mention is enough.\n"
        )

    # Additional user instructions
    if additional_specs:
        parts.append(f"ADDITIONAL INSTRUCTIONS:\n{additional_specs}\n")

    # Format requirements
    parts.append(
        "FORMAT REQUIREMENTS:\n"
        "- Use markdown: ## for sections, ### for subsections, **bold** for key terms\n"
        "- Use bullet points for lists, numbered lists for steps\n"
        "- Include a brief intro paragraph, then structured sections\n"
        "- If relevant, include a 'Summary' or 'Key Takeaways' section at the end\n"
        "- Return only the note content — no meta-commentary or preamble"
    )

    return {"built_prompt": "\n".join(parts)}


def generate_note(state: NoteGenState) -> dict:
    """Call AI and return the markdown note content."""
    ai_client = state.get("_ai_client")
    if not ai_client:
        return {"note_content": ""}

    prompt = state.get("built_prompt", "")
    depth = state.get("depth", "standard")

    # Token budget by depth
    max_tokens = {"brief": 800, "standard": 2000, "deep": 3500}.get(depth, 2000)

    try:
        content = ai_client.generate(prompt, max_tokens=max_tokens, temperature=0.65)
        return {"note_content": content.strip()}
    except Exception as e:
        logger.error(f"NoteGraph generation failed: {e}")
        return {"note_content": ""}


class NoteGraph:

    def __init__(self, ai_client: Any, db_session_factory: Any = None):
        self.ai_client = ai_client
        self.db_factory = db_session_factory
        self._graph = self._build()

    def _build(self):
        g = StateGraph(NoteGenState)
        g.add_node("fetch_context", fetch_context)
        g.add_node("build_prompt", build_prompt)
        g.add_node("generate_note", generate_note)
        g.set_entry_point("fetch_context")
        g.add_edge("fetch_context", "build_prompt")
        g.add_edge("build_prompt", "generate_note")
        g.add_edge("generate_note", END)
        return g.compile()

    async def invoke(
        self,
        user_id: str,
        topic: str = "",
        source_content: str = "",
        generation_type: str = "topic",
        depth: str = "standard",
        tone: str = "professional",
        additional_specs: str = "",
    ) -> str:
        initial_state: NoteGenState = {
            "user_id": user_id,
            "topic": topic,
            "source_content": source_content,
            "generation_type": generation_type,
            "depth": depth,
            "tone": tone,
            "additional_specs": additional_specs,
            "_ai_client": self.ai_client,
            "_db_factory": self.db_factory,
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return result.get("note_content", "")
        except Exception as e:
            logger.error(f"NoteGraph failed: {e}")
            return ""


_note_graph: Optional[NoteGraph] = None


def create_note_graph(ai_client: Any, db_session_factory: Any = None) -> NoteGraph:
    global _note_graph
    _note_graph = NoteGraph(ai_client, db_session_factory)
    return _note_graph


def get_note_graph() -> Optional[NoteGraph]:
    return _note_graph
