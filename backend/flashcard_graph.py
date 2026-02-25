from __future__ import annotations

import json
import re
import logging
from typing import Any, Optional, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)

class FlashcardGenState(TypedDict, total=False):
    user_id: str
    topic: str
    content: str
    generation_type: str
    card_count: int
    difficulty: str
    depth_level: str
    additional_specs: str
    student_weaknesses: list[str]
    student_strengths: list[str]
    concept_prerequisites: list[str]
    common_mistakes: list[str]
    rag_context: list[str]
    use_hs_context: bool
    built_prompt: str
    flashcards_json: list[dict]
    _ai_client: Any
    _hs_ai_client: Any
    _db_factory: Any

async def fetch_context(state: FlashcardGenState) -> dict:
    """Fetch student strengths/weaknesses from DB and Neo4j."""
    user_id = state.get("user_id", "")
    db_factory = state.get("_db_factory")
    weaknesses = []
    strengths = []

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
            logger.warning(f"DB context fetch failed: {e}")

    prerequisites: list[str] = []
    mistakes: list[str] = []

    from tutor import neo4j_store
    if neo4j_store.available():
        try:
            concepts = await neo4j_store.get_student_concepts(user_id)
            for c in concepts.get("struggling", []):
                if c not in weaknesses:
                    weaknesses.append(c)
            for c in concepts.get("mastered", []):
                if c not in strengths:
                    strengths.append(c)

            topic = state.get("topic", "")
            topic_concepts = [w for w in topic.split() if len(w) > 3]
            if topic_concepts:
                ctx = await neo4j_store.get_concept_context(topic_concepts[:4])
                prerequisites = ctx.get("prerequisites", [])
                mistakes = ctx.get("mistakes", [])
        except Exception as e:
            logger.warning(f"Neo4j context fetch failed: {e}")

    rag_chunks: list[str] = []
    topic = state.get("topic", "")
    use_hs = state.get("use_hs_context", True)
    logger.info(f"[FLASHCARD RAG] topic='{topic}' use_hs_context={use_hs} user_id={user_id}")
    if topic and use_hs:
        try:
            import context_store
            if context_store.available():
                results = context_store.search_context(
                    query=topic,
                    user_id=user_id,
                    use_hs=True,
                    top_k=5,
                )
                rag_chunks = [r["text"] for r in results]
                if rag_chunks:
                    logger.info(
                        f"[FLASHCARD RAG] *** HS CONTEXT FOUND *** {len(rag_chunks)} chunk(s) retrieved for '{topic}'"
                    )
                    for i, r in enumerate(results):
                        preview = r["text"][:120].replace("\n", " ")
                        logger.info(
                            f"[FLASHCARD RAG]   chunk[{i}] source={r['source']} dist={r['distance']:.4f} | {preview}..."
                        )
                else:
                    logger.info(f"[FLASHCARD RAG] No matching chunks found for '{topic}' in curriculum/docs")
            else:
                logger.info("[FLASHCARD RAG] context_store not available — skipping RAG")
        except Exception as e:
            logger.warning(f"RAG context fetch failed: {e}")
    else:
        if not use_hs:
            logger.info(f"[FLASHCARD RAG] HS Mode OFF — RAG skipped for '{topic}'")

    return {
        "student_weaknesses": weaknesses,
        "student_strengths": strengths,
        "concept_prerequisites": prerequisites,
        "common_mistakes": mistakes,
        "rag_context": rag_chunks,
    }

DIFFICULTY_GUIDES = {
    "easy": (
        "EASY level — basic recall and definitions.\n"
        "- Questions: 'What is...', 'Define...', 'Name the...'\n"
        "- Answers: short, factual, 1-2 sentences\n"
        "- Focus on terminology, key facts, straightforward concepts"
    ),
    "medium": (
        "MEDIUM level — application and understanding.\n"
        "- Questions: 'Why does...', 'How would you...', 'Compare...'\n"
        "- Answers: explanatory, 2-3 sentences with reasoning\n"
        "- Focus on understanding relationships, applying concepts"
    ),
    "hard": (
        "HARD level — analysis, synthesis, and edge cases.\n"
        "- Questions: 'What happens if...', 'Analyze why...', 'Design a...'\n"
        "- Answers: detailed, 3-4 sentences, may include nuances\n"
        "- Focus on tricky distinctions, multi-step reasoning, expert knowledge"
    ),
}

DEPTH_GUIDES = {
    "surface": (
        "SURFACE depth — broad overview.\n"
        "- Cover many different subtopics at a high level\n"
        "- Don't go into detailed mechanisms or edge cases\n"
        "- Good for initial exposure and general awareness"
    ),
    "standard": (
        "STANDARD depth — balanced coverage.\n"
        "- Cover key subtopics with reasonable detail\n"
        "- Include some 'why' and 'how', not just 'what'\n"
        "- Balance breadth and depth"
    ),
    "deep": (
        "DEEP depth — nuanced and thorough.\n"
        "- Go deep into specific subtopics\n"
        "- Include prerequisites, common mistakes, expert insights\n"
        "- Cover edge cases, exceptions, and advanced details"
    ),
}

def build_prompt(state: FlashcardGenState) -> dict:
    """Build a detailed, context-aware generation prompt."""
    topic = state.get("topic", "")
    content = state.get("content", "")
    generation_type = state.get("generation_type", "topic")
    card_count = state.get("card_count", 10)
    difficulty = state.get("difficulty", "medium")
    depth_level = state.get("depth_level", "standard")
    additional_specs = state.get("additional_specs", "")
    if not isinstance(additional_specs, str):
        additional_specs = ""
    weaknesses = state.get("student_weaknesses", [])
    strengths = state.get("student_strengths", [])
    prerequisites = state.get("concept_prerequisites", [])
    mistakes = state.get("common_mistakes", [])

    parts = []

    if generation_type == "chat_history" and content:
        parts.append(
            f"Generate {card_count} flashcards from this conversation/content:\n\n"
            f"{content[:3000]}\n"
        )
    else:
        parts.append(f"Generate {card_count} flashcards about: {topic}\n")

    diff_guide = DIFFICULTY_GUIDES.get(difficulty, DIFFICULTY_GUIDES["medium"])
    parts.append(f"DIFFICULTY:\n{diff_guide}\n")

    depth_guide = DEPTH_GUIDES.get(depth_level, DEPTH_GUIDES["standard"])
    parts.append(f"DEPTH:\n{depth_guide}\n")

    if weaknesses:
        parts.append(
            f"STUDENT WEAKNESSES: {', '.join(weaknesses[:5])}\n"
            "If relevant to the topic, include cards that help address these gaps.\n"
        )
    if strengths:
        parts.append(
            f"STUDENT STRENGTHS: {', '.join(strengths[:5])}\n"
            "Skip overly basic questions on these topics — challenge the student.\n"
        )

    if prerequisites:
        parts.append(
            f"PREREQUISITE CONCEPTS (from knowledge graph): {', '.join(prerequisites[:5])}\n"
            "Include 1-2 cards covering these foundational concepts so the student has the necessary base.\n"
        )

    if mistakes:
        parts.append(
            f"COMMON MISTAKES STUDENTS MAKE: {', '.join(mistakes[:5])}\n"
            "Include cards specifically testing these pitfalls so the student learns to avoid them.\n"
        )

    if additional_specs.strip():
        parts.append(f"ADDITIONAL INSTRUCTIONS FROM STUDENT:\n{additional_specs.strip()}\n")

    rag_context = state.get("rag_context", [])
    if rag_context:
        logger.info(f"[FLASHCARD PROMPT] *** INJECTING {len(rag_context)} RAG chunk(s) into prompt ***")
        context_block = "\n---\n".join(rag_context[:5])
        parts.append(
            f"RELEVANT CURRICULUM CONTEXT (from student's documents and HS curriculum):\n"
            f"{context_block}\n\n"
            "Prioritise this material when relevant to the topic. "
            "Use it to make flashcards more curriculum-aligned and accurate.\n"
        )
    else:
        logger.info("[FLASHCARD PROMPT] No RAG context — generating from model knowledge only")

    parts.append(
        "FORMAT: Return ONLY a valid JSON array. Each object must have:\n"
        '{"question": "...", "answer": "...", "difficulty": "' + difficulty + '", '
        '"wrong_options": ["wrong1", "wrong2", "wrong3"]}\n\n'
        "RULES:\n"
        "- Questions must be clear and specific\n"
        "- Answers: concise (2-4 sentences max)\n"
        "- wrong_options: 3 plausible but incorrect answers for MCQ mode\n"
        "- No duplicate or redundant cards\n"
        "- No markdown fences or extra text — just the JSON array"
    )

    return {"built_prompt": "\n".join(parts)}

def generate_cards(state: FlashcardGenState) -> dict:
    """Call AI and parse the flashcards JSON."""
    rag_active = bool(state.get("rag_context"))
    hs_ai = state.get("_hs_ai_client")
    ai_client = (hs_ai if rag_active and hs_ai else None) or state.get("_ai_client")
    if not ai_client:
        return {"flashcards_json": []}

    if rag_active and hs_ai:
        logger.info("[FLASHCARD GEN] Using HS context AI client (RAG-enriched prompt)")
    else:
        logger.info("[FLASHCARD GEN] Using main AI client")

    prompt = state.get("built_prompt", "")
    difficulty = state.get("difficulty", "medium")
    card_count = state.get("card_count", 10)

    try:
        response = ai_client.generate(prompt, max_tokens=3000, temperature=0.7)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        data = json.loads(cleaned)

        if isinstance(data, dict):
            data = data.get("flashcards", [])

        valid = []
        for card in data[:card_count]:
            if isinstance(card, dict) and "question" in card and "answer" in card:
                answer = card["answer"]
                if len(answer) > 400:
                    answer = answer[:400] + "..."
                wrong_options = card.get("wrong_options", [])
                wrong_options = [
                    opt[:400] + "..." if len(opt) > 400 else opt
                    for opt in wrong_options[:3]
                ]
                valid.append({
                    "question": card["question"].strip(),
                    "answer": answer.strip(),
                    "difficulty": card.get("difficulty", difficulty),
                    "wrong_options": wrong_options,
                })

        return {"flashcards_json": valid}
    except Exception as e:
        logger.error(f"Flashcard generation failed: {e}")
        return {"flashcards_json": []}

class FlashcardGraph:

    def __init__(self, ai_client: Any, db_session_factory: Any = None, hs_ai_client: Any = None):
        self.ai_client = ai_client
        self.hs_ai_client = hs_ai_client
        self.db_factory = db_session_factory
        self._graph = self._build()

    def _build(self):
        g = StateGraph(FlashcardGenState)
        g.add_node("fetch_context", fetch_context)
        g.add_node("build_prompt", build_prompt)
        g.add_node("generate_cards", generate_cards)
        g.set_entry_point("fetch_context")
        g.add_edge("fetch_context", "build_prompt")
        g.add_edge("build_prompt", "generate_cards")
        g.add_edge("generate_cards", END)
        return g.compile()

    async def invoke(
        self,
        user_id: str,
        topic: str = "",
        content: str = "",
        generation_type: str = "topic",
        card_count: int = 10,
        difficulty: str = "medium",
        depth_level: str = "standard",
        additional_specs: str = "",
        use_hs_context: bool = True,
    ) -> list[dict]:
        initial_state: FlashcardGenState = {
            "user_id": user_id,
            "topic": topic,
            "content": content,
            "generation_type": generation_type,
            "card_count": card_count,
            "difficulty": difficulty,
            "depth_level": depth_level,
            "additional_specs": additional_specs,
            "use_hs_context": use_hs_context,
            "_ai_client": self.ai_client,
            "_hs_ai_client": self.hs_ai_client,
            "_db_factory": self.db_factory,
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return result.get("flashcards_json", [])
        except Exception as e:
            logger.error(f"Flashcard graph failed: {e}")
            return []

_flashcard_graph: Optional[FlashcardGraph] = None

def create_flashcard_graph(ai_client: Any, db_session_factory: Any = None, hs_ai_client: Any = None) -> FlashcardGraph:
    global _flashcard_graph
    _flashcard_graph = FlashcardGraph(ai_client, db_session_factory, hs_ai_client=hs_ai_client)
    return _flashcard_graph

def get_flashcard_graph() -> Optional[FlashcardGraph]:
    return _flashcard_graph
