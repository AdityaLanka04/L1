from __future__ import annotations

import json
import logging
from typing import Any, Optional, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class QuizGenState(TypedDict, total=False):
    user_id: str
    topic: str
    content: str
    generation_type: str        # "topic" | "chat_history" | "weak_areas"
    question_count: int
    difficulty: str             # easy | medium | hard | mixed
    question_types: list[str]   # multiple_choice, true_false, short_answer
    additional_specs: str
    student_weaknesses: list[str]
    student_strengths: list[str]
    quiz_history: list[dict]    # recent quiz topics + scores
    concept_prerequisites: list[str]
    common_mistakes: list[str]
    built_prompt: str
    questions_json: list[dict]
    _ai_client: Any
    _db_factory: Any


async def fetch_context(state: QuizGenState) -> dict:
    """Fetch student context: strengths, weaknesses, and recent quiz history."""
    user_id = state.get("user_id", "")
    db_factory = state.get("_db_factory")
    weaknesses = []
    strengths = []
    quiz_history = []

    if db_factory:
        try:
            from models import UserWeakArea, TopicMastery, QuestionSet, QuestionAttempt
            db = db_factory()
            try:
                uid = int(user_id)

                # Weaknesses
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

                # Strengths (topics with mastery >= 70%)
                mastery = (
                    db.query(TopicMastery)
                    .filter(TopicMastery.user_id == uid, TopicMastery.mastery_level >= 0.7)
                    .limit(5)
                    .all()
                )
                for tm in mastery:
                    if tm.topic_name and tm.topic_name not in strengths:
                        strengths.append(tm.topic_name)

                # Recent quiz performance — last 5 attempts with their question sets
                recent_attempts = (
                    db.query(QuestionAttempt, QuestionSet)
                    .join(QuestionSet, QuestionAttempt.question_set_id == QuestionSet.id)
                    .filter(QuestionAttempt.user_id == uid)
                    .order_by(QuestionAttempt.submitted_at.desc())
                    .limit(5)
                    .all()
                )
                for attempt, qset in recent_attempts:
                    raw_title = qset.title or ""
                    clean_topic = raw_title.replace("Practice: ", "").strip()
                    quiz_history.append({
                        "topic": clean_topic,
                        "score": round(attempt.score, 1),
                        "correct": attempt.correct_count,
                        "total": attempt.total_questions,
                    })

            finally:
                db.close()
        except Exception as e:
            logger.warning(f"DB context fetch failed in quiz graph: {e}")

    concept_prerequisites: list[str] = []
    common_mistakes: list[str] = []

    # Augment with Neo4j knowledge graph
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

            # Get prerequisites and common mistakes for the topic
            topic = state.get("topic", "")
            topic_concepts = [w for w in topic.split() if len(w) > 3]
            if topic_concepts:
                ctx = await neo4j_store.get_concept_context(topic_concepts[:4])
                concept_prerequisites = ctx.get("prerequisites", [])
                common_mistakes = ctx.get("mistakes", [])
        except Exception as e:
            logger.warning(f"Neo4j context fetch failed in quiz graph: {e}")

    return {
        "student_weaknesses": weaknesses,
        "student_strengths": strengths,
        "quiz_history": quiz_history,
        "concept_prerequisites": concept_prerequisites,
        "common_mistakes": common_mistakes,
    }


DIFFICULTY_GUIDES = {
    "easy": (
        "EASY level — basic recall and recognition.\n"
        "- Questions: 'What is...', 'Which of the following...', 'True or False:'\n"
        "- Test fundamental terminology, key facts, and basic definitions\n"
        "- Distractors: clearly wrong but plausible; student can eliminate by knowing basics"
    ),
    "medium": (
        "MEDIUM level — application and comprehension.\n"
        "- Questions: 'Why does...', 'How would you...', 'What happens when...'\n"
        "- Test understanding of relationships, cause/effect, applied concepts\n"
        "- Distractors: subtly wrong; require real understanding to eliminate"
    ),
    "hard": (
        "HARD level — analysis, synthesis, and edge cases.\n"
        "- Questions: 'Which best explains...', 'Analyze why...', 'Under what conditions...'\n"
        "- Test nuanced distinctions, multi-step reasoning, expert knowledge\n"
        "- Distractors: sophisticated; require deep understanding to distinguish from correct answer"
    ),
    "mixed": (
        "MIXED difficulty — balanced spread across all levels.\n"
        "- ~30% easy (recall/recognition), ~50% medium (application), ~20% hard (analysis)\n"
        "- Questions should progress naturally from foundational to advanced\n"
        "- Each question's distractors scaled to match its individual difficulty"
    ),
}


def build_prompt(state: QuizGenState) -> dict:
    """Build a context-aware, personalized quiz generation prompt."""
    topic = state.get("topic", "")
    content = state.get("content", "")
    generation_type = state.get("generation_type", "topic")
    question_count = state.get("question_count", 10)
    difficulty = state.get("difficulty", "mixed")
    question_types = state.get("question_types") or ["multiple_choice"]
    additional_specs = (state.get("additional_specs") or "").strip()
    weaknesses = state.get("student_weaknesses", [])
    strengths = state.get("student_strengths", [])
    quiz_history = state.get("quiz_history", [])
    prerequisites = state.get("concept_prerequisites", [])
    mistakes = state.get("common_mistakes", [])

    # Normalize difficulty
    if difficulty not in DIFFICULTY_GUIDES:
        difficulty = "mixed"

    parts = []

    # Source material
    if generation_type == "chat_history" and content:
        parts.append(
            f"Generate {question_count} quiz questions from this content:\n\n"
            f"{content[:3000]}\n"
        )
    elif generation_type == "weak_areas" and weaknesses:
        focus = weaknesses[:3]
        parts.append(
            f"Generate {question_count} quiz questions targeting these weak areas:\n"
            f"{', '.join(focus)}\n"
            f"(Topic context: {topic})\n"
        )
    else:
        parts.append(f"Generate {question_count} quiz questions about: {topic}\n")

    # Difficulty guide
    diff_guide = DIFFICULTY_GUIDES[difficulty]
    parts.append(f"DIFFICULTY:\n{diff_guide}\n")

    # Question type instructions
    type_instructions = []
    if "multiple_choice" in question_types:
        type_instructions.append("multiple choice with 4 options (exactly one correct)")
    if "true_false" in question_types:
        type_instructions.append("true/false")
    if "short_answer" in question_types:
        type_instructions.append("short answer (concise phrase, not full sentence)")
    if type_instructions:
        parts.append(f"QUESTION TYPES: {', '.join(type_instructions)}\n")

    # Student personalisation
    if weaknesses:
        parts.append(
            f"STUDENT WEAK AREAS: {', '.join(weaknesses[:5])}\n"
            "If relevant to the topic, include questions that target these gaps.\n"
        )
    if strengths:
        parts.append(
            f"STUDENT STRONG AREAS: {', '.join(strengths[:5])}\n"
            "Avoid trivially simple questions on these — challenge the student appropriately.\n"
        )

    # Quiz history context — help the AI adapt
    if quiz_history:
        history_lines = []
        for h in quiz_history[:3]:
            status = "struggled" if h["score"] < 60 else ("passed" if h["score"] < 80 else "excelled")
            history_lines.append(f"{h['topic']} — {h['score']}% ({status})")
        parts.append(
            f"RECENT QUIZ PERFORMANCE:\n" + "\n".join(f"  • {l}" for l in history_lines) + "\n"
            "Use this to calibrate question difficulty and focus.\n"
        )

    # Concept prerequisites — include a foundational question or two
    if prerequisites:
        parts.append(
            f"PREREQUISITE CONCEPTS (from knowledge graph): {', '.join(prerequisites[:5])}\n"
            "Include 1-2 questions testing these foundational concepts before the main topic.\n"
        )

    # Common mistakes — design questions to expose and correct them
    if mistakes:
        parts.append(
            f"COMMON MISTAKES STUDENTS MAKE: {', '.join(mistakes[:5])}\n"
            "Include questions specifically designed to surface and correct these pitfalls.\n"
        )

    # Additional user specs
    if additional_specs:
        parts.append(f"ADDITIONAL INSTRUCTIONS FROM STUDENT:\n{additional_specs}\n")

    # Output format — strict JSON schema
    parts.append(
        "FORMAT: Return ONLY a valid JSON array. Each object must have:\n"
        '{"question_text": "Clear, specific question?", '
        '"question_type": "multiple_choice|true_false|short_answer", '
        '"correct_answer": "Full text of the correct answer (NOT A/B/C/D labels)", '
        '"options": ["Option 1", "Option 2", "Option 3", "Option 4"], '
        '"difficulty": "easy|medium|hard", '
        '"explanation": "1-2 sentence explanation of why this answer is correct", '
        f'"topic": "{(topic[:50] or "General")}"' + "}\n\n"
        "RULES:\n"
        "- For multiple_choice: exactly 4 options; correct_answer must be the FULL TEXT of the correct option\n"
        "- For true_false: options = ['True', 'False']; correct_answer is 'True' or 'False'\n"
        "- For short_answer: options = []; correct_answer is a short phrase\n"
        "- No duplicate or semantically redundant questions\n"
        "- explanations must be genuinely educational\n"
        "- No markdown fences or extra text — return only the JSON array"
    )

    return {"built_prompt": "\n".join(parts)}


def generate_questions_node(state: QuizGenState) -> dict:
    """Call AI and parse the quiz questions JSON."""
    ai_client = state.get("_ai_client")
    if not ai_client:
        return {"questions_json": []}

    prompt = state.get("built_prompt", "")
    difficulty = state.get("difficulty", "mixed")
    question_count = state.get("question_count", 10)
    topic = state.get("topic", "")

    try:
        response = ai_client.generate(prompt, max_tokens=4000, temperature=0.7)
        cleaned = response.strip()

        # Strip markdown code fences if present
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        data = json.loads(cleaned)

        # Handle both array and {"questions": [...]} wrapper formats
        if isinstance(data, dict):
            data = data.get("questions", [])

        valid = []
        for q in data[:question_count]:
            if not isinstance(q, dict):
                continue
            question_text = q.get("question_text", "").strip()
            if not question_text:
                continue

            q_type = q.get("question_type", "multiple_choice")
            correct = str(q.get("correct_answer", "")).strip()
            options = q.get("options", [])
            if isinstance(options, list):
                options = [str(o)[:300] for o in options[:4]]
            explanation = (q.get("explanation") or "")[:500]

            # Validate multiple_choice has usable options
            if q_type == "multiple_choice" and len(options) < 2:
                continue

            # Determine difficulty label
            q_difficulty = q.get("difficulty", "")
            if q_difficulty not in ("easy", "medium", "hard"):
                q_difficulty = difficulty if difficulty != "mixed" else "medium"

            valid.append({
                "question_text": question_text,
                "question_type": q_type,
                "correct_answer": correct,
                "options": options,
                "difficulty": q_difficulty,
                "explanation": explanation,
                "topic": (q.get("topic") or topic)[:100],
            })

        return {"questions_json": valid}

    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
        return {"questions_json": []}


class QuizGraph:

    def __init__(self, ai_client: Any, db_session_factory: Any = None):
        self.ai_client = ai_client
        self.db_factory = db_session_factory
        self._graph = self._build()

    def _build(self):
        g = StateGraph(QuizGenState)
        g.add_node("fetch_context", fetch_context)
        g.add_node("build_prompt", build_prompt)
        g.add_node("generate_questions", generate_questions_node)
        g.set_entry_point("fetch_context")
        g.add_edge("fetch_context", "build_prompt")
        g.add_edge("build_prompt", "generate_questions")
        g.add_edge("generate_questions", END)
        return g.compile()

    async def invoke(
        self,
        user_id: str,
        topic: str = "",
        content: str = "",
        generation_type: str = "topic",
        question_count: int = 10,
        difficulty: str = "mixed",
        question_types: Optional[list] = None,
        additional_specs: str = "",
    ) -> list[dict]:
        initial_state: QuizGenState = {
            "user_id": user_id,
            "topic": topic,
            "content": content,
            "generation_type": generation_type,
            "question_count": question_count,
            "difficulty": difficulty,
            "question_types": question_types or ["multiple_choice"],
            "additional_specs": additional_specs,
            "_ai_client": self.ai_client,
            "_db_factory": self.db_factory,
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return result.get("questions_json", [])
        except Exception as e:
            logger.error(f"Quiz graph failed: {e}")
            return []


_quiz_graph: Optional[QuizGraph] = None


def create_quiz_graph(ai_client: Any, db_session_factory: Any = None) -> QuizGraph:
    global _quiz_graph
    _quiz_graph = QuizGraph(ai_client, db_session_factory)
    return _quiz_graph


def get_quiz_graph() -> Optional[QuizGraph]:
    return _quiz_graph
