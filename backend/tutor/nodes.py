from __future__ import annotations

import re
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from tutor.state import TutorState, StudentState, Neo4jInsights, EvalResult
from tutor import neo4j_store, chroma_store
from tutor.prompt import build_tutor_prompt
from tutor.evaluator import evaluate

logger = logging.getLogger(__name__)

_dkt_vocab: dict | None = None
_lang_embedding_cache: dict = {}   # user_id → last message embedding (cleared after use)

def _get_vocab() -> dict | None:
    global _dkt_vocab
    if _dkt_vocab is None:
        try:
            from dkt.language_analyzer import load_vocab_if_available
            _dkt_vocab = load_vocab_if_available() or {}
        except Exception:
            _dkt_vocab = {}
    return _dkt_vocab or None

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
    r"^(hi+|hello+|hey+|hiya|howdy|good\s*(morning|afternoon|evening|day))\b",
    r"^(what'?s\s*up|sup|yo+|hola+|hoi+|hai+|heya|ello|helo+)\b",
    r"^(greetings|salut|bonjour|namaste|ciao|hallo+)\b",
    r"^\W*(hi+|hello+|hey+|hola+)\W*$",   # catches "hoiii!", "hola!!", etc.
]


def _detect_greeting_energy(text: str) -> str:
    """
    Classify the student's greeting energy so Cerbyl can mirror it.
    Returns 'high', 'medium', or 'calm'.
    """
    t = text.strip()
    # High energy: yo repeated, extended vowels, caps run, multi-exclamation
    if re.search(
        r'(yo[\s!]*){2,}|y[o]{3,}|h[e]{3,}y+|h[i]{3,}|s[u]{2,}p|!{2,}|[A-Z]{4,}|heyyyy|suuup',
        t, re.IGNORECASE
    ):
        return "high"
    # Medium: casual slang with mild energy
    if re.search(r'\byo\b|sup\b|heya|hiya|heyy+|hiii+|wazzup|wassup', t, re.IGNORECASE):
        return "medium"
    return "calm"

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


def analyze_message(state: TutorState) -> dict:
    """
    Run language analysis on the student's raw message.
    Detects which concept they're asking about and what confidence signal
    they're sending (confusion, doubt, mastery, etc.).
    Stored in state["language_analysis"] — used by prompt builder and persist_updates.
    """
    intent = state.get("intent", "")
    if intent in ("greeting", "returning_greeting", "off_topic", "recall"):
        return {"language_analysis": {}}

    text       = state.get("user_input", "")
    vocab      = _get_vocab()
    user_id    = state.get("user_id", "")
    db_factory = state.get("_db_factory")

    try:
        from dkt.language_analyzer import analyze
        db = db_factory() if db_factory else None
        try:
            uid    = int(user_id) if user_id else None
            result = analyze(text, vocab, user_id=uid, db=db)
        finally:
            if db is not None:
                db.close()

        analysis = result.to_dict()
        logger.info(
            f"[LANG] signal={analysis['signal_type']} ({result.classification_method}) "
            f"score={analysis['knowledge_signal']:+.2f} "
            f"concept={analysis['primary_concept']!r}"
        )
        # Store embedding on state so persist_updates can reuse it (avoid re-embedding)
        _lang_embedding_cache[user_id] = result.embedding
        return {"language_analysis": analysis}
    except Exception as e:
        logger.warning(f"Language analysis failed: {e}")
        return {"language_analysis": {}}

async def fetch_student_state(state: TutorState) -> dict:
    user_id    = state.get("user_id", "")
    db_factory = state.get("_db_factory")
    chat_id    = state.get("chat_id")
    chat_history = state.get("chat_history", [])
    student    = StudentState(user_id=user_id)

    is_new_session    = len(chat_history) == 0
    session_gap_days  = None
    decayed_concepts  = []

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
                    student.current_subject  = profile.main_subject or ""
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

                if is_new_session:
                    try:
                        from dkt.temporal_decay import get_session_gap, get_decayed_concepts
                        session_gap_days = get_session_gap(uid, chat_id, db)
                        decayed_concepts = get_decayed_concepts(uid, db, threshold_days=7)
                        if decayed_concepts:
                            logger.info(
                                f"[DECAY] user={uid} session_gap={session_gap_days}d "
                                f"decayed={[c['concept'] for c in decayed_concepts[:3]]}"
                            )
                    except Exception as e:
                        logger.warning(f"Temporal decay fetch failed: {e}")

            finally:
                db.close()
        except Exception as e:
            logger.warning(f"DB fetch failed: {e}")

    last_session_summary = None
    if is_new_session:
        last_session_summary = _fetch_last_session_summary(db_factory, user_id, current_chat_id=chat_id)

    return {
        "student_state":        student,
        "session_gap_days":     session_gap_days,
        "decayed_concepts":     decayed_concepts,
        "is_new_session":       is_new_session,
        "last_session_summary": last_session_summary,
    }

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

# ── Time-range classification for recall queries ──────────────────────────────

_TIME_RANGE_PATTERNS = [
    (r'\b(just now|right now|this (moment|second)|past hour|last hour)\b',              "last_hour",   1),
    (r'\b(today|this (morning|afternoon|evening|day)|past (few hours|2|3|4|5) hours)\b', "today",      24),
    (r'\b(recent(ly)?|lately|just|just now)\b',                                          "recent",     24),
    (r'\byesterday\b',                                                                    "yesterday",  48),
    (r'\b(this week|past (2|3|4|5|6) days|few days)\b',                                 "this_week", 168),
    (r'\b(last week|past week|7 days|seven days)\b',                                     "last_week", 336),
    (r'\b(last month|past month|30 days|thirty days)\b',                                 "last_month",720),
    (r'\b(ever|all time|always|everything|from the start|since I (started|joined))\b',  "all_time",  8760),
]


def _classify_recall_time_range(text: str) -> tuple[str, int]:
    """
    Return (label, hours) from the student's recall phrasing.
    hours=0 means 'last session only' (no time bound).
    """
    t = text.lower()
    for pattern, label, hours in _TIME_RANGE_PATTERNS:
        if re.search(pattern, t):
            return label, hours
    return "last_session", 0


def _store_recall_signal(db_factory, user_id: str, user_input: str,
                          time_label: str, time_hours: int,
                          is_correction: bool = False) -> None:
    """
    Persist each recall query as a labeled training example in StudentMemory.
    Corrections (student refining after an initial recall) are flagged so they
    can be weighted higher during future fine-tuning.
    """
    if not db_factory:
        return
    try:
        from models import StudentMemory
        db = db_factory()
        try:
            uid = int(user_id)
            content = (
                f"{'[CORRECTION] ' if is_correction else ''}"
                f"Query: '{user_input[:200]}' → range: {time_label} ({time_hours}h)"
            )
            mem = StudentMemory(
                user_id=uid,
                memory_type="recall_query",
                concept_name=time_label,
                source="recall",
                content=content,
                importance_score=0.8 if is_correction else 0.4,
            )
            db.add(mem)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Recall signal store failed: {e}")


def _fetch_activity_in_range(db_factory, user_id: str, hours: int) -> list[str]:
    """
    Fetch all recorded activity within the past `hours` hours.
    Queries: ChatSession/ChatMessage, Note, FlashcardSet, Activity log.
    Returns formatted lines ready for structured_context.
    """
    if not db_factory:
        return [f"No activity data available."]
    try:
        from datetime import timedelta
        from models import ChatSession, ChatMessage, Note, FlashcardSet, Activity
        db = db_factory()
        try:
            uid = int(user_id)
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            label = {1: "last hour", 24: "last 24 hours", 48: "yesterday + today",
                     168: "this week", 336: "last week", 720: "last month",
                     8760: "all time"}.get(hours, f"past {hours} hours")
            lines = [f"Your activity — {label}:"]
            found = False

            # Chat sessions active in window
            sessions = (
                db.query(ChatSession)
                .filter(ChatSession.user_id == uid, ChatSession.updated_at >= cutoff)
                .order_by(ChatSession.updated_at.desc())
                .all()
            )
            for sess in sessions:
                msgs = (
                    db.query(ChatMessage)
                    .filter(ChatMessage.chat_session_id == sess.id,
                            ChatMessage.timestamp >= cutoff)
                    .order_by(ChatMessage.timestamp.asc())
                    .all()
                )
                if not msgs:
                    continue
                topics = _extract_message_topics(msgs, max_msgs=6)
                ts = sess.updated_at.strftime("%b %d %H:%M") if sess.updated_at else ""
                title = (sess.title or "Chat")[:40]
                topic_str = "; ".join(topics[:4]) if topics else f"{len(msgs)} messages"
                lines.append(f"  [Chat '{title}' {ts}]: {topic_str}")
                found = True

            # Notes created/updated in window
            notes = (
                db.query(Note)
                .filter(Note.user_id == uid, Note.updated_at >= cutoff,
                        Note.is_deleted == False)
                .order_by(Note.updated_at.desc())
                .all()
            )
            for note in notes:
                ts = note.updated_at.strftime("%b %d %H:%M") if note.updated_at else ""
                lines.append(f"  [Note '{note.title}' {ts}]")
                found = True

            # Flashcard sets created in window
            fc_sets = (
                db.query(FlashcardSet)
                .filter(FlashcardSet.user_id == uid, FlashcardSet.created_at >= cutoff)
                .order_by(FlashcardSet.created_at.desc())
                .all()
            )
            for fc in fc_sets:
                ts = fc.created_at.strftime("%b %d %H:%M") if fc.created_at else ""
                lines.append(f"  [Flashcards '{fc.title}' created {ts}]")
                found = True

            # Activity log entries in window
            activities = (
                db.query(Activity)
                .filter(Activity.user_id == uid, Activity.timestamp >= cutoff)
                .order_by(Activity.timestamp.desc())
                .limit(10)
                .all()
            )
            for act in activities:
                ts = act.timestamp.strftime("%b %d %H:%M") if act.timestamp else ""
                lines.append(f"  [Quiz/Practice '{act.topic}' {ts}]: {act.question[:60]}")
                found = True

            if not found:
                return [f"No activity found in the {label}."]
            return lines
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"_fetch_activity_in_range failed: {e}")
        return []


def _extract_message_topics(messages: list, max_msgs: int = 8) -> list[str]:
    """
    Pull short topic-hints from raw user messages when no concept signals exist.
    Delegates junk detection to topic_utils.is_valid_topic.
    """
    from topic_utils import is_valid_topic
    topics = []
    seen_lower = set()
    for msg in messages[:max_msgs]:
        raw = (msg.user_message or "").strip()
        snippet = raw[:70].rstrip()
        low = snippet.lower()
        if low in seen_lower or not is_valid_topic(snippet):
            continue
        seen_lower.add(low)
        topics.append(snippet)
    return topics


def _days_ago(dt: Optional[datetime]) -> Optional[int]:
    """Return how many full days ago a datetime was, or None."""
    if not dt:
        return None
    now = datetime.now(timezone.utc)
    aware = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    return max(0, (now - aware).days)


def _fetch_last_session_summary(db_factory, user_id: str, current_chat_id=None) -> Optional[dict]:
    """
    Return a concise dict summarising the most recent past chat session that had
    real topics (concept signals or substantive messages).
    Scans up to 5 recent sessions; skips greeting-only sessions.
    Returns: {title, date_str, days_ago, topics, message_count} or None.
    """
    if not db_factory:
        return None
    try:
        from models import ChatMessage, ChatSession, ChatConceptSignal
        db = db_factory()
        try:
            uid = int(user_id)
            q = db.query(ChatSession).filter(ChatSession.user_id == uid)
            if current_chat_id:
                q = q.filter(ChatSession.id != current_chat_id)
            candidates = q.order_by(ChatSession.created_at.desc()).limit(5).all()
            if not candidates:
                return None

            for sess in candidates:
                # Prefer ChatConceptSignal (ML-detected topics) — deduplicated
                signals = (
                    db.query(ChatConceptSignal)
                    .filter(
                        ChatConceptSignal.user_id == uid,
                        ChatConceptSignal.chat_session_id == sess.id,
                    )
                    .order_by(ChatConceptSignal.created_at.asc())
                    .all()
                )
                seen: set = set()
                topics = []
                for s in signals:
                    c = (s.concept or "").strip()
                    cl = c.lower()
                    if c and cl not in seen:
                        seen.add(cl)
                        topics.append(c)
                topics = topics[:8]

                msg_count = (
                    db.query(ChatMessage)
                    .filter(ChatMessage.chat_session_id == sess.id)
                    .count()
                )

                # Only surface sessions where ML explicitly detected user-driven concepts
                if not topics:
                    continue

                date_str = sess.created_at.strftime("%b %d") if sess.created_at else "recently"
                title = (sess.title or "Chat session")[:60]
                ago = _days_ago(sess.created_at)

                return {
                    "title":         title,
                    "date_str":      date_str,
                    "days_ago":      ago,
                    "topics":        topics,
                    "message_count": msg_count,
                }

            return None
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"_fetch_last_session_summary failed: {e}")
        return None


def _fetch_last_session_topics(db_factory, user_id: str, current_chat_id=None) -> list[str]:
    """
    Return structured context lines for the recall intent.
    Pulls from ChatConceptSignal first; falls back to raw ChatMessage content.
    """
    if not db_factory:
        return []
    try:
        from models import ChatConceptSignal, ChatSession, ChatMessage
        db = db_factory()
        try:
            uid = int(user_id)
            sessions_q = db.query(ChatSession).filter(ChatSession.user_id == uid)
            if current_chat_id:
                sessions_q = sessions_q.filter(ChatSession.id != current_chat_id)
            recent_sessions = sessions_q.order_by(ChatSession.created_at.desc()).limit(3).all()

            if not recent_sessions:
                return ["No previous sessions found."]

            lines = ["What you worked on in recent sessions:"]
            found_any = False
            for sess in recent_sessions:
                date_str = sess.created_at.strftime("%b %d") if sess.created_at else "recently"
                title = (sess.title or "Untitled")[:40]

                # Try concept signals
                signals = (
                    db.query(ChatConceptSignal)
                    .filter(
                        ChatConceptSignal.user_id == uid,
                        ChatConceptSignal.chat_session_id == sess.id,
                        ChatConceptSignal.knowledge_signal != 0,
                    )
                    .order_by(ChatConceptSignal.created_at.asc())
                    .all()
                )
                seen: set = set()
                concepts = []
                for s in signals:
                    c = (s.concept or "").strip()
                    if c and c.lower() not in seen:
                        seen.add(c.lower())
                        concepts.append(c)

                # Fallback: use raw user messages
                if not concepts:
                    msgs = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.chat_session_id == sess.id)
                        .order_by(ChatMessage.timestamp.asc())
                        .limit(10)
                        .all()
                    )
                    concepts = _extract_message_topics(msgs, max_msgs=5)

                if concepts:
                    lines.append(f"  [{date_str}] '{title}': {'; '.join(concepts[:6])}")
                    found_any = True
                else:
                    lines.append(f"  [{date_str}] '{title}': (no topics detected)")

            if not found_any:
                return ["No specific topics recorded in recent sessions yet."]
            return lines
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"_fetch_last_session_topics failed: {e}")
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

    # Always retrieve student preferences from the important_ collection.
    # This runs regardless of intent — preferences must survive greetings too.
    if chroma_store.available():
        try:
            prefs = chroma_store.retrieve_important(user_id, query="student preferences instructions", top_k=5)
            for p in prefs:
                if p.get("metadata", {}).get("source") == "preference":
                    memories.insert(0, f"[STUDENT PREFERENCE] {p['document']}")
        except Exception as e:
            logger.warning(f"Preference retrieval failed: {e}")

    domains = _detect_query_domain(user_input)

    if should_retrieve:
        # For recall: use DB only (ground truth). ChromaDB episode summaries are noisy.
        # For specific domain questions (flashcard/note): use DB + filtered ChromaDB.
        if intent != "recall":
            if "flashcard" in domains:
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

            if "note" in domains:
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

        # General ChromaDB retrieval — only for non-recall question/confusion intents.
        # Recall uses DB-structured data only (reliable). ChromaDB general summaries are
        # truncated and cause hallucination ("we discussed organic chemistry") for recall.
        if chroma_store.available() and intent not in ("recall",):
            try:
                general_memories = chroma_store.retrieve_episodes(
                    user_id, user_input, top_k=3
                )
                for m in general_memories:
                    if m not in memories:
                        memories.append(m)
            except Exception as e:
                logger.warning(f"Chroma retrieval failed: {e}")

        if intent == "recall":
            time_label, time_hours = _classify_recall_time_range(user_input)

            # Detect correction: previous AI turn was also a recall → student is refining
            chat_history = state.get("chat_history", [])
            is_correction = False
            if chat_history and len(chat_history) >= 2:
                prev_user = chat_history[-2].get("content", "") if len(chat_history) >= 2 else ""
                _, prev_hours = _classify_recall_time_range(prev_user)
                is_correction = (prev_hours != time_hours) and bool(prev_user)

            # Store as labeled training example (async-safe: fire-and-forget pattern)
            _store_recall_signal(db_factory, user_id, user_input, time_label, time_hours, is_correction)
            logger.info(f"[RECALL] user={user_id} range={time_label}({time_hours}h) correction={is_correction}")

            if time_hours > 0:
                # Time-ranged: query all activity tables within the window
                ranged = _fetch_activity_in_range(db_factory, user_id, time_hours)
                structured_context.extend(ranged)
            else:
                # Last-session: use session topics + full flashcard/note/activity context
                chat_id = state.get("chat_id")
                session_topics = _fetch_last_session_topics(db_factory, user_id, current_chat_id=chat_id)
                structured_context.extend(session_topics)

            fc_context = _fetch_flashcard_context(db_factory, user_id, top_k=5)
            structured_context.extend(fc_context)
            note_context = _fetch_notes_context(db_factory, user_id, top_k=5)
            structured_context.extend(note_context)
            activity_context = _fetch_activity_summary(db_factory, user_id)
            structured_context.extend(activity_context)

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

def select_teaching_style(state: TutorState) -> dict:
    """
    NeuralUCB contextual bandit node.

    Reads the per-user NeuralArm state from DB, builds the d=12 context
    vector (including full mastery dict from AKT), and selects the optimal
    teaching style via MC Dropout UCB.
    Explicit student style requests override the bandit selection — the
    bandit still receives the reward next turn.
    """
    intent     = state.get("intent", "")
    db_factory = state.get("_db_factory")
    user_id    = state.get("user_id", "")
    analysis   = state.get("language_analysis") or {}

    if intent in ("greeting", "returning_greeting", "off_topic", "recall", "repetitive"):
        return {"selected_style": "conceptual", "style_context": [], "style_scores": {}}

    if not db_factory:
        return {"selected_style": "example_first", "style_context": [], "style_scores": {}}

    try:
        from dkt.style_bandit import (
            StyleBandit, build_context, load_bandit,
            get_recent_signals, STYLES,
        )

        uid      = int(user_id)
        db       = db_factory()
        try:
            bandit         = load_bandit(uid, db)
            recent_signals = get_recent_signals(uid, db)
        finally:
            db.close()

        student          = state.get("student_state")
        difficulty       = (student.difficulty_level if student else None) or "intermediate"
        session_gap      = state.get("session_gap_days")
        n_interactions   = len(recent_signals)

        primary_concept  = analysis.get("primary_concept")
        concept_mastery  = 0.5
        mastery_dict     = None
        n_decayed        = len(state.get("decayed_concepts") or [])
        try:
            from dkt.inference import get_mastery
            m            = get_mastery(uid, db_factory, apply_decay=True)
            mastery_dict = m.get("effective_mastery") or {}
            if primary_concept and primary_concept in mastery_dict:
                concept_mastery = mastery_dict[primary_concept]
        except Exception:
            pass

        context = build_context(
            difficulty_level = difficulty,
            recent_signals   = recent_signals,
            session_gap_days = session_gap,
            n_interactions   = n_interactions,
            concept_mastery  = concept_mastery,
            mastery_dict     = mastery_dict,
            n_decayed        = n_decayed,
        )

        explicit_style   = analysis.get("explicit_style")
        selected, scores = bandit.select(context, forced=explicit_style)

        logger.info(
            f"[BANDIT] user={uid} selected={selected!r} "
            f"{'(explicit override)' if explicit_style else ''} "
            f"scores={{{', '.join(f'{k}: {v:.3f}' for k, v in scores.items())}}}"
        )

        return {
            "selected_style": selected,
            "style_context":  context.tolist(),
            "style_scores":   scores,
        }

    except Exception as e:
        logger.warning(f"[BANDIT] style selection failed: {e}")
        return {"selected_style": "example_first", "style_context": [], "style_scores": {}}


def _build_instructional_task(state: TutorState) -> str:
    intent   = state.get("intent", "")
    student  = state.get("student_state")
    domains  = _detect_query_domain(state.get("user_input", ""))
    analysis = state.get("language_analysis") or {}

    signal_type = analysis.get("signal_type", "neutral")
    hint        = analysis.get("instructional_hint", "")

    if intent == "greeting":
        gap                  = state.get("session_gap_days")
        decayed              = state.get("decayed_concepts") or []
        last_summary         = state.get("last_session_summary")
        student_name         = student.first_name if student else ""

        energy = _detect_greeting_energy(state.get("user_input", ""))
        energy_tone = {
            "high":   "[TONE: high energy — be hyped, casual, match their vibe]",
            "medium": "[TONE: warm and upbeat]",
            "calm":   "[TONE: warm, grounded]",
        }[energy]

        name_part = f"Address them as {student_name}. " if student_name else ""

        # Build a session recap block from real DB data — no hallucination possible.
        recap = ""
        if last_summary and last_summary.get("topics"):
            topics_str = "; ".join(last_summary["topics"][:3])
            ago = last_summary.get("days_ago")
            if ago is None:
                time_hint = f"on {last_summary['date_str']}"
            elif ago == 0:
                time_hint = "earlier today"
            elif ago == 1:
                time_hint = "yesterday"
            else:
                time_hint = f"about {ago} days ago"
            recap = (
                f"Most recent substantive session ({time_hint}, {last_summary['message_count']} messages): "
                f"student worked on: {topics_str}. "
                f"Naturally mention this — e.g. 'Last time we covered [topic] — {time_hint}. Want to continue or start something new?' "
                f"Keep it 1-2 sentences, conversational. "
            )
        # If last_summary exists but has no topics, it was a brief check-in — don't reference it

        no_invent = "Do NOT invent or guess topics not listed above."

        if gap is None or gap < 1:
            # Same session day — just greet, recap if we have data
            if recap:
                return f"{energy_tone} {name_part}{recap}{no_invent}"
            return f"{energy_tone} {name_part}Ask what they'd like to work on. Keep it short."

        if decayed:
            top      = decayed[0]
            days_str = f"{int(top['last_seen_days'])} days"
            ret_pct  = int(top['retrievability'] * 100)
            decay_hint = (
                f"It has been {days_str} since they studied '{top['concept']}' "
                f"(estimated recall: {ret_pct}%). Weave this in naturally. "
            )
            return f"{energy_tone} {name_part}{recap}{decay_hint}{no_invent}"

        if gap > 7:
            gap_hint = f"They haven't been here in {int(gap)} days — acknowledge warmly. "
            return f"{energy_tone} {name_part}{recap}{gap_hint}{no_invent}"

        return f"{energy_tone} {name_part}{recap}{no_invent}" if recap else \
               f"{energy_tone} {name_part}Ask what they'd like to work on. Keep it short."

    if intent == "returning_greeting":
        energy = _detect_greeting_energy(state.get("user_input", ""))
        energy_tone = {
            "high":   "[TONE: high energy — be hyped, casual]",
            "medium": "[TONE: warm and friendly]",
            "calm":   "[TONE: warm, grounded]",
        }[energy]
        student_name = student.first_name if student else ""
        name_part = f"Address them as {student_name}. " if student_name else ""
        return (
            f"Student greeted again. {energy_tone} {name_part}"
            "1 sentence, ask what they want to work on. No topic suggestions."
        )

    if intent == "repetitive":
        return (
            "The student is sending the same message repeatedly. Acknowledge this politely. "
            "Ask if they need help with something specific or if something isn't working. "
            "Don't repeat your previous response - give a fresh, shorter reply. Address them by name."
        )

    if intent == "recall":
        time_label, time_hours = _classify_recall_time_range(state.get("user_input", ""))
        time_desc = {
            "last_hour": "the last hour",
            "today": "today",
            "recent": "recently (last 24 hours)",
            "yesterday": "yesterday",
            "this_week": "this week",
            "last_week": "last week",
            "last_month": "last month",
            "all_time": "all time",
            "last_session": "the last session",
        }.get(time_label, "recently")

        if "flashcard" in domains:
            domain_hints = (
                "The student is asking about FLASHCARD activity. "
                "Report actual set names, card counts, accuracy from STRUCTURED LEARNING DATA. "
            )
        elif "note" in domains:
            domain_hints = (
                "The student is asking about their NOTES. "
                "Report actual note titles and dates from STRUCTURED LEARNING DATA. "
            )
        else:
            domain_hints = (
                f"The student is asking what they did — time range: {time_desc}. "
                "STRUCTURED LEARNING DATA below contains their real activity for that period. "
                "Give a warm, specific summary like a tutor recap: "
                "'In the last 24 hours you asked about X, created a flashcard set on Y, and made a note on Z.' "
                "Use exact titles/topics from the data. Treat short user message snippets as questions they asked. "
            )

        return (
            f"{domain_hints}"
            "Only use what is in STRUCTURED LEARNING DATA. "
            "Never invent topics. If truly nothing is there, say so honestly and ask what they'd like to start."
        )

    if intent == "off_topic":
        return "Gently redirect the student toward a learning topic."

    if hint:
        style      = student.preferred_style if student else "balanced"
        difficulty = student.difficulty_level if student else "intermediate"
        return (
            f"{hint}\n"
            f"Adjust complexity to {difficulty} level using a {style} style."
        )

    style      = student.preferred_style if student else "balanced"
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

    intent = state.get("intent", "")

    system = (
        "You are Cerbyl, an expert tutor and central learning agent. "
        "You are genuinely enthusiastic about teaching and learning — your energy is warm, encouraging, and upbeat. "
        "You celebrate student progress, make learning feel exciting, and bring positive energy to every response. "
        "You adapt your teaching to each student's level and learning style. "
        "You never dump information; you teach with intention. "
        "Be concise but thorough. Use markdown formatting for clarity. "
        "CRITICAL: Never narrate your internal reasoning, planning, or approach. "
        "Do NOT write things like 'Common mistakes to address:', 'For the style he prefers, I will:', "
        "'Let me think about this:', or any meta-commentary about how you are structuring your answer. "
        "Go directly to the answer — no preamble, no self-narration. "
        "When reporting on the student's activity, always use the STRUCTURED LEARNING DATA provided — "
        "never fabricate or guess information about past conversations. "
        "MATH FORMATTING — THIS IS MANDATORY: Every mathematical expression MUST be wrapped in LaTeX delimiters. "
        "Use \\( ... \\) for inline math and \\[ ... \\] for display/block equations. "
        "NEVER write bare math like: ax^2 + bx + c = 0. ALWAYS write: \\(ax^2 + bx + c = 0\\). "
        "This applies to ALL variables, equations, formulas, and expressions — no exceptions."
    )
    if student_name:
        system += f"\n\nThe student's name is {student_name}. Address them by name naturally (not every sentence)."

    # Only inject ML intelligence context for non-greeting intents.
    # Injecting it during greetings causes the LLM to hallucinate topic suggestions,
    # equations, and worked examples even though GREETING MODE rules come after.
    intelligence_ctx = state.get("intelligence_context", "")
    if intelligence_ctx and intent not in ("greeting", "returning_greeting"):
        system = intelligence_ctx + "\n\n" + system

    if intent in ("greeting", "returning_greeting"):
        system += (
            "\n\nGREETING MODE — HARD RULES:\n"
            "1. Do NOT suggest any subject, topic, concept, equation, or example whatsoever.\n"
            "2. Do NOT say things like 'we could explore math' or 'perhaps quadratic equations'.\n"
            "3. Do NOT reference any past conversations or behaviors you think you remember.\n"
            "4. ONLY greet the student and ask what THEY want to work on.\n"
            "5. Keep the response to 1-2 sentences maximum.\n"
            "6. Honor the [TONE: ...] tag in the prompt exactly.\n"
            "Violating any of these rules is a critical failure."
        )

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
    user_id       = state.get("user_id", "")
    intent        = state.get("intent", "")
    user_input    = state.get("user_input", "")
    response_text = state.get("response", "")
    evaluation    = state.get("evaluation")
    analysis      = state.get("language_analysis") or {}
    chat_id       = state.get("chat_id")
    db_factory    = state.get("_db_factory")
    neo4j_updates = []
    chroma_writes = []

    signal_type      = analysis.get("signal_type", "neutral")
    knowledge_signal = float(analysis.get("knowledge_signal", 0.0))
    primary_concept  = analysis.get("primary_concept")
    matched_concepts = analysis.get("matched_concepts", [])

    if primary_concept and db_factory and intent not in ("greeting", "returning_greeting", "off_topic", "recall"):
        try:
            from models import ChatConceptSignal, UserWeakArea
            from datetime import datetime, timezone
            db = db_factory()
            try:
                uid = int(user_id)

                sig = ChatConceptSignal(
                    user_id         = uid,
                    chat_session_id = chat_id,
                    concept         = primary_concept[:255],
                    signal_type     = signal_type,
                    knowledge_signal= round(knowledge_signal, 4),
                    message_snippet = user_input[:300],
                )
                db.add(sig)

                if knowledge_signal < -0.3:
                    existing = db.query(UserWeakArea).filter(
                        UserWeakArea.user_id == uid,
                        UserWeakArea.topic   == primary_concept,
                    ).first()
                    now = datetime.now(timezone.utc)
                    if existing:
                        existing.weakness_score  = min(1.0, (existing.weakness_score or 0.0) + abs(knowledge_signal) * 0.15)
                        existing.incorrect_count = (existing.incorrect_count or 0) + 1
                        existing.total_questions = (existing.total_questions or 0) + 1
                        accuracy = (existing.correct_count or 0) / max(existing.total_questions, 1)
                        existing.accuracy        = round(accuracy, 4)
                        existing.status          = "needs_practice" if existing.weakness_score > 0.4 else existing.status
                        existing.last_updated    = now
                    else:
                        wa = UserWeakArea(
                            user_id          = uid,
                            topic            = primary_concept[:255],
                            subtopic         = signal_type,
                            total_questions  = 1,
                            correct_count    = 0,
                            incorrect_count  = 1,
                            accuracy         = 0.0,
                            weakness_score   = abs(knowledge_signal),
                            status           = "needs_practice",
                            priority         = int(abs(knowledge_signal) * 10),
                            first_identified = now,
                            last_updated     = now,
                        )
                        db.add(wa)

                elif knowledge_signal > 0.4:
                    existing = db.query(UserWeakArea).filter(
                        UserWeakArea.user_id == uid,
                        UserWeakArea.topic   == primary_concept,
                    ).first()
                    if existing:
                        existing.weakness_score  = max(0.0, (existing.weakness_score or 0.0) - knowledge_signal * 0.1)
                        existing.correct_count   = (existing.correct_count or 0) + 1
                        existing.total_questions = (existing.total_questions or 0) + 1
                        accuracy = existing.correct_count / max(existing.total_questions, 1)
                        existing.accuracy        = round(accuracy, 4)
                        if existing.weakness_score < 0.2:
                            existing.status = "improving"
                        existing.last_updated = datetime.now(timezone.utc)

                db.commit()
                logger.info(
                    f"[LANG PERSIST] user={uid} concept={primary_concept!r} "
                    f"signal={signal_type} score={knowledge_signal:+.2f}"
                )

                if signal_type not in ("neutral", "neutral_question"):
                    try:
                        from dkt.language_analyzer import update_student_head
                        cached_emb = _lang_embedding_cache.pop(user_id, None)
                        update_student_head(uid, user_input, signal_type, db, embedding=cached_emb)
                    except Exception as _e:
                        logger.debug(f"[LANG] head update skipped: {_e}")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"ChatConceptSignal persist failed: {e}")

    selected_style = state.get("selected_style", "")
    style_context  = state.get("style_context") or []

    if db_factory and intent not in ("greeting", "returning_greeting", "off_topic", "recall", "repetitive"):
        try:
            import numpy as np
            from dkt.style_bandit import (
                load_bandit, save_bandit,
                get_pending_update, set_pending_update,
            )
            uid = int(user_id)
            db  = db_factory()
            try:
                pending = get_pending_update(uid, db)
                if pending and knowledge_signal != 0.0:
                    bandit = load_bandit(uid, db)
                    reward = float(np.clip(knowledge_signal, -1.0, 1.0))
                    bandit.update(pending["style"], pending["context"], reward)
                    save_bandit(uid, bandit, db)
                    logger.info(
                        f"[BANDIT] reward loop closed: style={pending['style']!r} "
                        f"reward={reward:+.3f} user={uid}"
                    )

                if selected_style and style_context:
                    ctx = np.array(style_context, dtype=np.float64)
                    set_pending_update(uid, selected_style, ctx, db)
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[BANDIT] reward update failed: {e}")

    # Detect and persist student preferences (e.g. "don't suggest topics")
    # These go to the important_ collection so they survive across sessions.
    if chroma_store.available() and user_input:
        try:
            _PREF_PATTERNS = [
                r"\bdon'?t\b.{0,40}\b(suggest|recommend|tell|show|give)\b",
                r"\bstop\b.{0,40}\b(suggest|recommend|telling|showing)\b",
                r"\bnever\b.{0,40}\b(suggest|recommend|tell|show|give)\b",
                r"\bplease\s+(don'?t|stop|never)\b",
                r"\bi\s+(prefer|want|like|hate|dislike)\b.{0,60}",
                r"\balways\b.{0,40}\b(do|use|give|start)\b",
                r"\buntil\s+i\s+(ask|tell|say)\b",
            ]
            import re as _re
            is_preference = any(_re.search(p, user_input, _re.I) for p in _PREF_PATTERNS)
            if is_preference:
                chroma_store.write_important(
                    user_id  = user_id,
                    summary  = user_input[:300],
                    metadata = {
                        "source":    "preference",
                        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
                    },
                )
                logger.info(f"[PREF] Stored student preference: {user_input[:80]!r}")
        except Exception as e:
            logger.warning(f"Preference detection failed: {e}")

    if chroma_store.available() and intent not in ("greeting", "returning_greeting", "off_topic", "repetitive", "recall"):
        try:
            truncated_resp = response_text[:150] + "..." if len(response_text) > 150 else response_text
            memory_summary = (
                (evaluation.distilled_memory if evaluation and evaluation.distilled_memory else None)
                or f"Student asked: {user_input[:100]}. Cerbyl covered: {truncated_resp}"
            )
            chroma_store.write_episode(
                user_id  = user_id,
                summary  = memory_summary,
                metadata = {
                    "intent":           intent,
                    "concept":          primary_concept or "",
                    "signal_type":      signal_type,
                    "knowledge_signal": str(round(knowledge_signal, 2)),
                    "teaching_style":   selected_style or "",
                    "source":           "chat",
                },
            )
            chroma_writes.append({"summary": memory_summary})
        except Exception as e:
            logger.warning(f"Chroma persistence failed: {e}")

    return {"neo4j_updates": neo4j_updates, "chroma_writes": chroma_writes}
