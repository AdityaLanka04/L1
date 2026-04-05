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

FLASHCARD_PATTERNS = [
    r"\bflashcard",
    r"\bflash\s*card",
    r"\bcards?\s*(i|we)\s*(stud|review|learn|creat|made|did)",
    r"\b(stud|review|learn|practic)\w*\s*(card|flashcard)",
    r"\bquiz\s*me\b",
    r"\bmy\s*cards?\b",
]

NOTE_PATTERNS = [
    r"\bnotes?\b",
    r"\bwhat\s*(did\s*)?(i|we)\s*(write|note|jot)",
    r"\bmy\s*notes?\b",
    r"\bstudy\s*notes?\b",
    r"\bnote\s*i\s*(took|made|wrote|created)",
]

ACTIVITY_PATTERNS = [
    r"\bwhat\s*(did|have)\s*(i|we)\s*(done|do|study|learn|work|cover)\b",
    r"\bmy\s*(progress|activity|history|learning)\b",
    r"\bhow\s*(am\s*i|have\s*i)\s*(doing|progressing)\b",
    r"\bsummar(y|ize)\s*(my|of)\b",
]

def _is_repetitive(text: str, chat_history: list[dict]) -> bool:
    if not chat_history:
        return False
    text_lower = text.lower().strip()
    recent = chat_history[-5:]
    repeat_count = sum(
        1 for msg in recent
        if msg.get("user", "").lower().strip() == text_lower
    )
    return repeat_count >= 2

def _detect_query_domain(text: str) -> list[str]:
    """Detect what domains/sources the user is asking about."""
    text_lower = text.lower()
    domains = []
    if any(re.search(p, text_lower) for p in FLASHCARD_PATTERNS):
        domains.append("flashcard")
    if any(re.search(p, text_lower) for p in NOTE_PATTERNS):
        domains.append("note")
    if any(re.search(p, text_lower) for p in ACTIVITY_PATTERNS):
        domains.append("activity")
    return domains

def detect_intent(state: TutorState) -> dict:
    text = state.get("user_input", "").lower().strip()
    chat_history = state.get("chat_history", [])

    if _is_repetitive(text, chat_history):
        return {"intent": "repetitive"}

    if any(re.search(p, text) for p in GREETING_PATTERNS):
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

def _fetch_flashcard_context(db_factory, user_id: str, top_k: int = 10) -> list[str]:
    """Query the actual database for recent flashcard activity."""
    if not db_factory:
        return []
    try:
        from models import FlashcardSet, Flashcard, FlashcardStudySession
        db = db_factory()
        try:
            uid = int(user_id)
            context_lines = []

            sets = (
                db.query(FlashcardSet)
                .filter(FlashcardSet.user_id == uid)
                .order_by(FlashcardSet.created_at.desc())
                .limit(top_k)
                .all()
            )
            if sets:
                context_lines.append(f"You have {len(sets)} recent flashcard sets:")
                for fs in sets:
                    card_count = db.query(Flashcard).filter(Flashcard.set_id == fs.id).count()
                    reviewed_cards = (
                        db.query(Flashcard)
                        .filter(Flashcard.set_id == fs.id, Flashcard.times_reviewed > 0)
                        .all()
                    )
                    total_reviewed = sum(c.times_reviewed or 0 for c in reviewed_cards)
                    total_correct = sum(c.correct_count or 0 for c in reviewed_cards)
                    accuracy = (
                        round(total_correct / total_reviewed * 100, 1)
                        if total_reviewed > 0
                        else 0
                    )
                    created = fs.created_at.strftime("%b %d, %Y") if fs.created_at else "unknown"
                    status = f"studied {total_reviewed} times, {accuracy}% accuracy" if total_reviewed > 0 else "not yet studied"
                    context_lines.append(
                        f"  - \"{fs.title}\" ({card_count} cards, created {created}, {status})"
                    )

            struggling_cards = (
                db.query(Flashcard)
                .join(FlashcardSet)
                .filter(
                    FlashcardSet.user_id == uid,
                    Flashcard.marked_for_review == True,
                )
                .limit(5)
                .all()
            )
            if struggling_cards:
                context_lines.append(f"\nCards marked for review ({len(struggling_cards)} cards you're struggling with):")
                for c in struggling_cards:
                    context_lines.append(f"  - Q: {c.question[:80]}")

            recent_reviewed = (
                db.query(Flashcard)
                .join(FlashcardSet)
                .filter(
                    FlashcardSet.user_id == uid,
                    Flashcard.last_reviewed != None,
                )
                .order_by(Flashcard.last_reviewed.desc())
                .limit(10)
                .all()
            )
            if recent_reviewed:
                context_lines.append(f"\nRecently reviewed flashcards:")
                for c in recent_reviewed:
                    outcome = "correct" if (c.correct_count or 0) > (c.times_reviewed or 0) / 2 else "needs practice"
                    reviewed_date = c.last_reviewed.strftime("%b %d") if c.last_reviewed else ""
                    context_lines.append(
                        f"  - Q: {c.question[:60]} ({outcome}, last reviewed {reviewed_date})"
                    )

            return context_lines
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Failed to fetch flashcard context: {e}")
        return []

def _fetch_notes_context(db_factory, user_id: str, top_k: int = 10) -> list[str]:
    """Query the actual database for recent notes activity."""
    if not db_factory:
        return []
    try:
        from models import Note
        db = db_factory()
        try:
            uid = int(user_id)
            context_lines = []

            notes = (
                db.query(Note)
                .filter(Note.user_id == uid, Note.is_deleted == False)
                .order_by(Note.updated_at.desc())
                .limit(top_k)
                .all()
            )
            if notes:
                context_lines.append(f"You have {len(notes)} recent notes:")
                for n in notes:
                    updated = n.updated_at.strftime("%b %d, %Y") if n.updated_at else ""
                    content_preview = ""
                    if n.content:
                        clean = re.sub(r'<[^>]+>', '', n.content)
                        clean = re.sub(r'[#*_\[\]()]', '', clean).strip()
                        content_preview = f" - {clean[:100]}..." if len(clean) > 100 else f" - {clean}"
                    context_lines.append(
                        f"  - \"{n.title}\" (updated {updated}){content_preview}"
                    )

            return context_lines
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Failed to fetch notes context: {e}")
        return []

def _fetch_activity_summary(db_factory, user_id: str) -> list[str]:
    """Get a summary of recent learning activity across all features."""
    if not db_factory:
        return []
    try:
        from models import FlashcardSet, Flashcard, Note, ChatMessage, FlashcardStudySession
        from sqlalchemy import func
        db = db_factory()
        try:
            uid = int(user_id)
            context_lines = ["Here's a summary of your recent learning activity:"]

            total_sets = db.query(func.count(FlashcardSet.id)).filter(
                FlashcardSet.user_id == uid
            ).scalar() or 0
            total_cards = (
                db.query(func.count(Flashcard.id))
                .join(FlashcardSet)
                .filter(FlashcardSet.user_id == uid)
                .scalar() or 0
            )
            cards_mastered = (
                db.query(func.count(Flashcard.id))
                .join(FlashcardSet)
                .filter(FlashcardSet.user_id == uid, Flashcard.correct_count >= 3)
                .scalar() or 0
            )
            context_lines.append(
                f"  - Flashcards: {total_sets} sets, {total_cards} total cards, {cards_mastered} mastered"
            )

            total_notes = db.query(func.count(Note.id)).filter(
                Note.user_id == uid, Note.is_deleted == False
            ).scalar() or 0
            context_lines.append(f"  - Notes: {total_notes} notes")

            total_chats = db.query(func.count(ChatMessage.id)).filter(
                ChatMessage.user_id == uid
            ).scalar() or 0
            context_lines.append(f"  - Chat interactions: {total_chats} messages")

            return context_lines
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Failed to fetch activity summary: {e}")
        return []

def gate_and_retrieve(state: TutorState) -> dict:
    intent = state.get("intent", "")
    user_input = state.get("user_input", "")
    student = state.get("student_state")
    db_factory = state.get("_db_factory")
    user_id = state.get("user_id", "")

    should_retrieve = intent in ("recall", "confusion", "followup", "question")

    if not should_retrieve and student and student.weaknesses:
        input_lower = user_input.lower()
        for w in student.weaknesses:
            if w.lower() in input_lower:
                should_retrieve = True
                break

    memories = []
    structured_context = []

    domains = _detect_query_domain(user_input)

    if should_retrieve:
        if "flashcard" in domains or (intent == "recall" and not domains):
            fc_context = _fetch_flashcard_context(db_factory, user_id)
            if fc_context:
                structured_context.extend(fc_context)

            if chroma_store.available():
                try:
                    fc_memories = chroma_store.retrieve_episodes_filtered(
                        user_id, user_input, source_filter="flashcard_review", top_k=5
                    )
                    for m in fc_memories:
                        memories.append(m["document"])

                    fc_created = chroma_store.retrieve_episodes_filtered(
                        user_id, user_input, source_filter="flashcard_created", top_k=5
                    )
                    for m in fc_created:
                        memories.append(m["document"])
                except Exception as e:
                    logger.warning(f"Chroma flashcard retrieval failed: {e}")

        if "note" in domains or (intent == "recall" and not domains):
            note_context = _fetch_notes_context(db_factory, user_id)
            if note_context:
                structured_context.extend(note_context)

            if chroma_store.available():
                try:
                    note_memories = chroma_store.retrieve_episodes_filtered(
                        user_id, user_input, source_filter="note_activity", top_k=5
                    )
                    for m in note_memories:
                        memories.append(m["document"])
                except Exception as e:
                    logger.warning(f"Chroma note retrieval failed: {e}")

        if "activity" in domains:
            activity_context = _fetch_activity_summary(db_factory, user_id)
            if activity_context:
                structured_context.extend(activity_context)

        if chroma_store.available():
            try:
                top_k = 5 if intent == "recall" else 3
                general_memories = chroma_store.retrieve_episodes(
                    user_id, user_input, top_k=top_k
                )
                for m in general_memories:
                    if m not in memories:
                        memories.append(m)
            except Exception as e:
                logger.warning(f"Chroma retrieval failed: {e}")

        if intent == "recall" and not structured_context and not domains:
            fc_context = _fetch_flashcard_context(db_factory, user_id, top_k=5)
            note_context = _fetch_notes_context(db_factory, user_id, top_k=5)
            activity_context = _fetch_activity_summary(db_factory, user_id)
            structured_context.extend(activity_context)
            structured_context.extend(fc_context)
            structured_context.extend(note_context)

    rag_chunks: list[str] = []
    use_hs = state.get("use_hs_context", True)
    logger.info(f"[TUTOR RAG] query='{user_input[:80]}' use_hs_context={use_hs} user_id={user_id}")
    if use_hs:
        try:
            import context_store
            if context_store.available():
                rag_results = context_store.search_context(
                    query=user_input,
                    user_id=user_id,
                    use_hs=True,
                    top_k=5,
                )
                rag_chunks = [r["text"] for r in rag_results]
                if rag_chunks:
                    logger.info(
                        f"[TUTOR RAG] *** HS CONTEXT FOUND *** {len(rag_chunks)} chunk(s) retrieved"
                    )
                    for i, r in enumerate(rag_results):
                        preview = r["text"][:120].replace("\n", " ")
                        logger.info(
                            f"[TUTOR RAG]   chunk[{i}] source={r['source']} dist={r['distance']:.4f} | {preview}..."
                        )
                else:
                    logger.info(f"[TUTOR RAG] No matching chunks found for query in curriculum/docs")
            else:
                logger.info("[TUTOR RAG] context_store not available — skipping RAG")
        except Exception as e:
            logger.warning(f"RAG context fetch failed in tutor: {e}")
    else:
        logger.info(f"[TUTOR RAG] HS Mode OFF — RAG skipped")

    return {
        "retrieval_gated": should_retrieve,
        "episodic_memories": memories,
        "structured_context": structured_context,
        "rag_context": rag_chunks,
    }

def _build_instructional_task(state: TutorState) -> str:
    intent = state.get("intent", "")
    student = state.get("student_state")
    domains = _detect_query_domain(state.get("user_input", ""))

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
        domain_hints = ""
        if "flashcard" in domains:
            domain_hints = (
                "The student is specifically asking about their FLASHCARD activity. "
                "Use the STRUCTURED LEARNING DATA section below which contains their actual flashcard sets, "
                "study progress, and review history from the database. "
                "Give specific details: set names, card counts, accuracy percentages, what topics they studied. "
            )
        elif "note" in domains:
            domain_hints = (
                "The student is specifically asking about their NOTES. "
                "Use the STRUCTURED LEARNING DATA section below which contains their actual notes "
                "from the database. Give specific details: note titles, content previews, dates. "
            )
        elif "activity" in domains:
            domain_hints = (
                "The student is asking about their overall learning progress/activity. "
                "Use the STRUCTURED LEARNING DATA section below which contains a summary of all "
                "their activity across flashcards, notes, and chat. Give a comprehensive overview. "
            )
        else:
            domain_hints = (
                "The student is asking about previous sessions or past conversations. "
                "Use BOTH the STRUCTURED LEARNING DATA and RELEVANT HISTORY sections below. "
                "Give specific details about their flashcards, notes, and study activity. "
            )

        return (
            f"{domain_hints}"
            "If structured data is available, use it to give accurate, specific answers. "
            "NEVER make up or guess information. Only report what is in the data. "
            "If there is no data available, honestly say you don't have records of that activity yet."
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
    rag_active = bool(state.get("rag_context"))
    hs_ai = state.get("_hs_ai_client")
    ai_client = (hs_ai if rag_active and hs_ai else None) or state.get("_ai_client")

    if not ai_client:
        return {"response": "AI client not available.", "error": "no_ai_client"}

    if rag_active and hs_ai:
        logger.info("[TUTOR GEN] *** Using HS context AI client (RAG-enriched prompt) ***")
    else:
        logger.info("[TUTOR GEN] Using main AI client (no RAG or HS client unavailable)")

    task = _build_instructional_task(state)
    state_with_task = {**state, "instructional_task": task}
    prompt = build_tutor_prompt(state_with_task)

    student = state.get("student_state")
    student_name = student.first_name if student and student.first_name else ""

    system = (
        "You are Cerbyl, an expert tutor and central learning agent. You have access to the student's "
        "complete learning history including their flashcards, notes, study sessions, and chat history. "
        "You adapt your teaching to each student's level and learning style. "
        "You never dump information; you teach with intention. "
        "Be concise but thorough. Use markdown formatting for clarity. "
        "CRITICAL: Never narrate your internal reasoning, planning, or approach. "
        "Do NOT write things like 'Common mistakes to address:', 'For the style he prefers, I will:', "
        "'Let me think about this:', or any meta-commentary about how you are structuring your answer. "
        "Go directly to the answer — no preamble, no self-narration. "
        "When reporting on the student's activity, always use the STRUCTURED LEARNING DATA provided - "
        "never fabricate or guess information. "
        "MATH FORMATTING — THIS IS MANDATORY: Every mathematical expression MUST be wrapped in LaTeX delimiters. "
        "Use \\( ... \\) for inline math and \\[ ... \\] for display/block equations. "
        "EXAMPLES — inline: 'The equation is \\(ax^2 + bx + c = 0\\) where \\(a \\neq 0\\).' "
        "EXAMPLES — display: 'Solving gives:\\[x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\]' "
        "NEVER write bare math like: ax^2 + bx + c = 0 or x = -b/2a. "
        "ALWAYS write: \\(ax^2 + bx + c = 0\\) and \\(x = \\frac{-b}{2a}\\). "
        "This applies to ALL variables, equations, formulas, and expressions — no exceptions."
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

    intent = state.get("intent", "")
    user_input = state.get("user_input", "")
    response_text = state.get("response", "")

    memory_summary = None
    if evaluation and evaluation.distilled_memory:
        memory_summary = evaluation.distilled_memory
    elif intent not in ("greeting", "off_topic", "repetitive", "recall"):
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
                    "source": "chat",
                },
            )
            chroma_writes.append({"summary": memory_summary})
        except Exception as e:
            logger.warning(f"Chroma persistence failed: {e}")

    return {"neo4j_updates": neo4j_updates, "chroma_writes": chroma_writes}
