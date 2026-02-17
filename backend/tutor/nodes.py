from __future__ import annotations

import re
import logging
from typing import Any

from tutor.state import TutorState, StudentState, Neo4jInsights, EvalResult
from tutor import neo4j_store, chroma_store
from tutor.prompt import build_tutor_prompt
from tutor.evaluator import evaluate

logger = logging.getLogger(__name__)

CONFUSION_PATTERNS = [
    r"\bi\s*don'?t\s*(get|understand)\b",
    r"\bwhat\s*do\s*you\s*mean\b",
    r"\bconfus",
    r"\bwait\s+what\b",
    r"\bhuh\b",
    r"\bstill\s*(don'?t|confused)\b",
    r"\bcan\s*you\s*(explain|clarify)\b",
    r"\bi'?m\s*lost\b",
]

GREETING_PATTERNS = [
    r"^(hi|hello|hey|good\s*(morning|afternoon|evening))\b",
    r"^(what'?s\s*up|sup|yo)\b",
]

FOLLOWUP_PATTERNS = [
    r"\bwhat\s*about\b",
    r"\band\s+(what|how|why)\b",
    r"\bcan\s*you\s*(also|additionally)\b",
    r"\bfollow\s*up\b",
    r"\bmore\s*(on|about)\b",
    r"\bbut\s+(what|how|why)\b",
]

RECALL_PATTERNS = [
    r"\bwhat\s*did\s*(i|we)\s*(ask|discuss|talk|study|learn|cover|do|work)\b",
    r"\bdo\s*you\s*remember\b",
    r"\blast\s*(time|session|chat|conversation)\b",
    r"\bprevious(ly)?\s*(session|chat|conversation|topic)?\b",
    r"\bwhat\s*were\s*we\b",
    r"\bwhere\s*did\s*we\s*(leave|stop)\b",
    r"\bcontinue\s*(from)?\s*(where|last)\b",
    r"\bremember\s*(what|when|our)\b",
    r"\bwhat\s*(have\s*)?we\s*(been|covered)\b",
]


def _is_repetitive(text: str, chat_history: list[dict]) -> bool:
    """Check if the user is sending the same or very similar messages repeatedly."""
    if not chat_history:
        return False
    text_lower = text.lower().strip()
    recent = chat_history[-5:]  # check last 5 messages
    repeat_count = sum(
        1 for msg in recent
        if msg.get("user", "").lower().strip() == text_lower
    )
    return repeat_count >= 2


def detect_intent(state: TutorState) -> dict:
    text = state.get("user_input", "").lower().strip()
    chat_history = state.get("chat_history", [])

    # Detect repetitive/spam messages
    if _is_repetitive(text, chat_history):
        return {"intent": "repetitive"}

    if any(re.search(p, text) for p in GREETING_PATTERNS):
        # If user already greeted before in this chat, treat as continuation
        if chat_history:
            return {"intent": "returning_greeting"}
        return {"intent": "greeting"}

    if any(re.search(p, text) for p in RECALL_PATTERNS):
        return {"intent": "recall"}

    if any(re.search(p, text) for p in CONFUSION_PATTERNS):
        return {"intent": "confusion"}

    if any(re.search(p, text) for p in FOLLOWUP_PATTERNS):
        return {"intent": "followup"}

    if not any(c.isalpha() for c in text) or len(text) < 3:
        return {"intent": "off_topic"}

    return {"intent": "question"}


async def fetch_student_state(state: TutorState) -> dict:
    user_id = state.get("user_id", "")
    db_factory = state.get("_db_factory")
    student = StudentState(user_id=user_id)

    if db_factory:
        try:
            from models import ComprehensiveUserProfile, TopicMastery, UserWeakArea, User
            db = db_factory()
            try:
                uid = int(user_id)

                # Fetch user's first name
                user_record = db.query(User).filter(User.id == uid).first()
                if user_record and user_record.first_name:
                    student.first_name = user_record.first_name

                profile = db.query(ComprehensiveUserProfile).filter(
                    ComprehensiveUserProfile.user_id == uid
                ).first()
                if profile:
                    student.difficulty_level = profile.difficulty_level or "intermediate"
                    student.current_subject = profile.main_subject or ""
                    if profile.strong_areas:
                        student.strengths = [s.strip() for s in profile.strong_areas.split(",") if s.strip()]
                    if profile.weak_areas:
                        student.weaknesses = [s.strip() for s in profile.weak_areas.split(",") if s.strip()]

                weak_areas = db.query(UserWeakArea).filter(
                    UserWeakArea.user_id == uid
                ).order_by(UserWeakArea.weakness_score.desc()).limit(5).all()
                for wa in weak_areas:
                    topic = wa.topic or ""
                    if topic and topic not in student.weaknesses:
                        student.weaknesses.append(topic)

                mastery = db.query(TopicMastery).filter(
                    TopicMastery.user_id == uid,
                    TopicMastery.mastery_level >= 0.7,
                ).limit(5).all()
                for tm in mastery:
                    topic = tm.topic_name or ""
                    if topic and topic not in student.strengths:
                        student.strengths.append(topic)
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"DB fetch failed: {e}")

    if neo4j_store.available():
        try:
            concepts = await neo4j_store.get_student_concepts(user_id)
            for c in concepts.get("mastered", []):
                if c not in student.strengths:
                    student.strengths.append(c)
            for c in concepts.get("struggling", []):
                if c not in student.weaknesses:
                    student.weaknesses.append(c)
        except Exception as e:
            logger.warning(f"Neo4j student fetch failed: {e}")

    return {"student_state": student}


async def reason_from_graph(state: TutorState) -> dict:
    user_input = state.get("user_input", "")
    user_id = state.get("user_id", "")
    insights = Neo4jInsights()

    words = set(re.findall(r"\b[a-zA-Z]{3,}\b", user_input.lower()))
    concepts = list(words)[:10]
    insights.relevant_concepts = concepts

    if neo4j_store.available() and concepts:
        try:
            context = await neo4j_store.get_concept_context(concepts)
            insights.prerequisites = context.get("prerequisites", [])
            insights.common_mistakes = context.get("mistakes", [])

            strategies = await neo4j_store.get_effective_strategies(user_id, concepts[0])
            insights.effective_strategies = strategies
        except Exception as e:
            logger.warning(f"Neo4j reasoning failed: {e}")

    return {"neo4j_insights": insights}


def gate_and_retrieve(state: TutorState) -> dict:
    intent = state.get("intent", "")
    user_input = state.get("user_input", "")
    student = state.get("student_state")

    # Always retrieve for recall, confusion, followup, and regular questions
    should_retrieve = intent in ("recall", "confusion", "followup", "question")

    if not should_retrieve and student and student.weaknesses:
        input_lower = user_input.lower()
        for w in student.weaknesses:
            if w.lower() in input_lower:
                should_retrieve = True
                break

    memories = []
    if should_retrieve and chroma_store.available():
        try:
            top_k = 5 if intent == "recall" else 3
            memories = chroma_store.retrieve_episodes(
                state.get("user_id", ""), user_input, top_k=top_k
            )
        except Exception as e:
            logger.warning(f"Chroma retrieval failed: {e}")

    return {
        "retrieval_gated": should_retrieve,
        "episodic_memories": memories,
    }


def _build_instructional_task(state: TutorState) -> str:
    intent = state.get("intent", "")
    student = state.get("student_state")

    if intent == "greeting":
        return (
            "Respond warmly and briefly. Address the student by name if available. "
            "If the student has known weaknesses, gently suggest a topic to work on."
        )

    if intent == "returning_greeting":
        return (
            "The student has greeted again in the same conversation. Don't repeat your welcome. "
            "Acknowledge them briefly and naturally continue the conversation. "
            "Reference what you discussed before or suggest something new. Address them by name."
        )

    if intent == "repetitive":
        return (
            "The student is sending the same message repeatedly. Acknowledge this politely. "
            "Ask if they need help with something specific or if something isn't working. "
            "Don't repeat your previous response - give a fresh, shorter reply. Address them by name."
        )

    if intent == "recall":
        return (
            "The student is asking about previous sessions or past conversations. "
            "Use the RELEVANT HISTORY section below to recall what you've worked on together. "
            "If there is relevant history, summarize what you covered and suggest continuing from there. "
            "If there is no history available, honestly say you're still building up your memory "
            "of their learning journey and ask what they'd like to revisit."
        )

    if intent == "confusion":
        return (
            "The student is confused. Re-explain the concept using a different approach. "
            "Be patient, use analogies or step-by-step breakdowns. "
            "Check their understanding at the end."
        )

    if intent == "off_topic":
        return "Gently redirect the student toward a learning topic."

    style = student.preferred_style if student else "balanced"
    difficulty = student.difficulty_level if student else "intermediate"

    return (
        f"Answer the student's question clearly at a {difficulty} level. "
        f"Use a {style} explanation style. "
        "If the topic has common mistakes listed above, proactively address them. "
        "End with a brief check or follow-up question to confirm understanding."
    )


def build_prompt_and_respond(state: TutorState) -> dict:
    ai_client = state.get("_ai_client")
    if not ai_client:
        return {"response": "AI client not available.", "error": "no_ai_client"}

    task = _build_instructional_task(state)
    state_with_task = {**state, "instructional_task": task}
    prompt = build_tutor_prompt(state_with_task)

    student = state.get("student_state")
    student_name = student.first_name if student and student.first_name else ""

    system = (
        "You are Cerbyl, an expert tutor. You adapt your teaching to each student's level "
        "and learning style. You never dump information; you teach with intention. "
        "Be concise but thorough. Use markdown formatting for clarity."
    )
    if student_name:
        system += f"\n\nThe student's name is {student_name}. Address them by name naturally (not every sentence)."

    full_prompt = f"{system}\n\n{prompt}"

    try:
        response = ai_client.generate(full_prompt, max_tokens=2000, temperature=0.7)
        return {"response": response, "instructional_task": task}
    except Exception as e:
        logger.error(f"LLM generation failed: {e}")
        return {"response": "I'm having trouble responding right now. Please try again.", "error": str(e)}


def evaluate_response(state: TutorState) -> dict:
    ai_client = state.get("_ai_client")
    if not ai_client or state.get("intent") in ("greeting", "returning_greeting", "off_topic", "repetitive"):
        return {"evaluation": EvalResult()}

    result = evaluate(
        ai_client=ai_client,
        user_input=state.get("user_input", ""),
        response=state.get("response", ""),
        student_state=state.get("student_state"),
        neo4j_insights=state.get("neo4j_insights"),
    )
    return {"evaluation": result}


async def persist_updates(state: TutorState) -> dict:
    evaluation = state.get("evaluation")
    if not evaluation:
        return {"neo4j_updates": [], "chroma_writes": []}

    user_id = state.get("user_id", "")
    insights = state.get("neo4j_insights")
    neo4j_updates = []
    chroma_writes = []

    concepts = insights.relevant_concepts if insights else []
    primary_concept = concepts[0] if concepts else None

    if neo4j_store.available() and primary_concept:
        try:
            if evaluation.mastery_confirmed:
                await neo4j_store.update_mastery(user_id, primary_concept)
                neo4j_updates.append({"action": "mastered", "concept": primary_concept})

            if evaluation.new_struggle:
                await neo4j_store.update_struggle(user_id, primary_concept)
                neo4j_updates.append({"action": "struggle", "concept": primary_concept})

            if evaluation.strategy_worked:
                task = state.get("instructional_task", "")
                if task:
                    await neo4j_store.record_strategy_success(user_id, task[:200])
                    neo4j_updates.append({"action": "strategy_success"})
        except Exception as e:
            logger.warning(f"Neo4j persistence failed: {e}")

    # Determine what to save to episodic memory
    intent = state.get("intent", "")
    user_input = state.get("user_input", "")
    response_text = state.get("response", "")

    memory_summary = None
    if evaluation and evaluation.distilled_memory:
        memory_summary = evaluation.distilled_memory
    elif intent not in ("greeting", "off_topic", "repetitive", "recall"):
        # Fallback: save a basic summary for any substantive interaction
        truncated_resp = response_text[:150] + "..." if len(response_text) > 150 else response_text
        memory_summary = f"Student asked: {user_input[:100]}. Cerbyl covered: {truncated_resp}"

    if memory_summary and chroma_store.available():
        try:
            chroma_store.write_episode(
                user_id=user_id,
                summary=memory_summary,
                metadata={
                    "intent": intent,
                    "concept": primary_concept or "",
                },
            )
            chroma_writes.append({"summary": memory_summary})
        except Exception as e:
            logger.warning(f"Chroma persistence failed: {e}")

    return {"neo4j_updates": neo4j_updates, "chroma_writes": chroma_writes}
