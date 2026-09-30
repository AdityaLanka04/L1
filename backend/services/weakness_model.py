"""Model-backed weakness score shared by every graded surface.

Every graded answer (flashcard review, spaced-repetition review, solo quiz,
question bank, weakness practice, verified chat answer) updates one Bayesian
Knowledge Tracing state per topic (StudentKnowledgeState), and chat, the
Weaknesses page, note generation and flashcard/quiz generation all read the
same score back from here.

The score is built in four steps:

1. Evidence-aware BKT update. Each answer is an observation whose reliability
   depends on where it came from and how hard it was:
     - source: self-graded flashcards are the noisiest evidence (students
       over-credit themselves, so a "correct" is more likely a guess), server-
       graded quiz/practice answers are cleaner, tutor-verified free-response
       answers are the hardest to guess.
     - difficulty: getting a hard item right is stronger evidence of mastery
       than an easy one; missing an easy item is stronger evidence against.
     - partial credit: spaced-repetition grades are soft observations
       (again=0, hard=0.35, good=0.85, easy=1), folded into the likelihood
       instead of rounded to right/wrong.
2. Forgetting. The BKT belief decays with time since the last answer, on the
   same retrievability curve BKT and DKT already share (dkt/temporal_decay.py),
   so an unpractised topic drifts back up.
3. Streak damping. BKT is deliberately recency-heavy -- two lucky answers
   after a run of misses can swing it a long way. The final mastery blends it
   with a Beta(1+correct, 1+wrong) posterior on the topic's whole history, so
   a long-running pattern can't be erased by one streak.
4. weakness_score = 100 * (1 - blended mastery), with a confidence level
   (how much evidence backs it) and a trend (direction of the last updates).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Iterable, Optional

logger = logging.getLogger(__name__)

# BKT priors -- identical to StudentKnowledgeState's column defaults and
# ml_pipeline._layer2_bkt_update, so a topic first seen in chat and one first
# seen in a flashcard review start from the same belief.
P_MASTERY_PRIOR = 0.1
P_LEARN_BY_ARCHETYPE = {"Logicor": 0.12, "Kinetiq": 0.08, "Flowist": 0.10}
P_LEARN_DEFAULT = 0.09

# (slip, guess) per evidence source.
SOURCE_PARAMS = {
    "flashcard": (0.10, 0.30),  # self-graded: "I knew it" is often a guess
    "quiz": (0.08, 0.22),       # server-graded, mostly 4-option MCQ
    "practice": (0.08, 0.22),
    "chat": (0.10, 0.15),       # tutor-verified free response
}
DEFAULT_SOURCE = "quiz"

# (slip delta, guess delta) by item difficulty.
DIFFICULTY_ADJUST = {
    "easy": (-0.03, 0.08),
    "medium": (0.0, 0.0),
    "hard": (0.05, -0.07),
}

# Spaced-repetition grades as partial credit.
GRADE_CREDIT = {"again": 0.0, "hard": 0.35, "good": 0.85, "easy": 1.0}

# Weight of the BKT (recent-learning) estimate vs the whole-history Beta
# posterior in the final mastery.
BKT_WEIGHT = 0.65

MASTERED_AT = 0.85
MASTERED_MIN_ATTEMPTS = 5
IMPROVING_AT = 0.6

# Chat's graph (tutor/nodes.py::persist_updates) already runs its own BKT update
# for a verified answer; routes/chat.py then records the same answer against
# UserWeakArea. A state touched this recently is treated as already counted.
CHAT_DEDUPE_SECONDS = 120

_TOPIC_PREFIX_RE = re.compile(
    r"^\s*(?:cerbyl|ai generated|flashcards?|flashcard set|review|quiz|notes?|study notes)\s*:\s*",
    re.IGNORECASE,
)
_STOPWORDS = {
    "about", "after", "again", "also", "and", "basic", "basics", "between", "chapter",
    "concept", "concepts", "from", "general", "into", "intro", "introduction", "notes",
    "part", "practice", "review", "set", "the", "this", "topic", "unit", "what", "with",
}


def topic_label(topic: Optional[str]) -> str:
    """Human label for a weak-area topic: strips the "Flashcards: " / "AI
    Generated: " style prefixes set titles carry, collapses whitespace."""
    text = re.sub(r"\s+", " ", str(topic or "")).strip()
    previous = None
    while previous != text:
        previous = text
        text = _TOPIC_PREFIX_RE.sub("", text).strip()
    return text[:255]


def concept_key(topic: Optional[str]) -> str:
    """StudentKnowledgeState.concept_id convention (lowercase, spaces ->
    underscores), the same one ml_pipeline._load_concept_cache seeds from
    UserWeakArea topics -- so chat's BKT rows and these share one row."""
    return topic_label(topic).lower().replace(" ", "_")[:255]


def evidence_params(source: Optional[str], difficulty: Optional[str]) -> tuple[float, float]:
    """(slip, guess) for one observation, from its source and difficulty."""
    slip, guess = SOURCE_PARAMS.get((source or DEFAULT_SOURCE).lower(), SOURCE_PARAMS[DEFAULT_SOURCE])
    d_slip, d_guess = DIFFICULTY_ADJUST.get((difficulty or "medium").strip().lower(), (0.0, 0.0))
    return min(max(slip + d_slip, 0.02), 0.3), min(max(guess + d_guess, 0.05), 0.45)


def bkt_step(p_mastery: float, credit: float, p_learn: float, p_slip: float, p_guess: float) -> float:
    """One BKT observation with soft evidence. `credit` is 1.0 for a correct
    answer, 0.0 for a miss, or anything in between for partial credit; the
    likelihood of the observation under each hidden state is the credit-
    weighted mix of the correct/incorrect likelihoods."""
    p = min(max(p_mastery, 0.0), 1.0)
    c = min(max(float(credit), 0.0), 1.0)
    like_known = c * (1 - p_slip) + (1 - c) * p_slip
    like_unknown = c * p_guess + (1 - c) * (1 - p_guess)
    denom = p * like_known + (1 - p) * like_unknown
    posterior = (p * like_known) / denom if denom else p
    p_next = posterior + (1 - posterior) * p_learn
    return min(max(p_next, 0.01), 0.99)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def decayed_mastery(state) -> float:
    """BKT p_mastery with forgetting applied since the last observation."""
    from services.ml_pipeline import MessageMLPipeline

    return MessageMLPipeline._decayed_mastery(
        state.p_mastery if state.p_mastery is not None else P_MASTERY_PRIOR,
        _as_utc(state.last_updated),
        state.interaction_count or 0,
    )


def history_mastery(correct: int, attempts: int) -> float:
    """Beta(1 + correct, 1 + wrong) posterior mean over the topic's whole history."""
    attempts = max(int(attempts or 0), 0)
    correct = min(max(int(correct or 0), 0), attempts)
    return (1 + correct) / (2 + attempts)


def combined_mastery(state, correct: int, attempts: int) -> float:
    """Final mastery: recent-learning BKT belief (with forgetting) damped by
    the whole-history accuracy posterior."""
    return BKT_WEIGHT * decayed_mastery(state) + (1 - BKT_WEIGHT) * history_mastery(correct, attempts)


def score_from_mastery(mastery: float) -> float:
    return round(max(0.0, min(100.0, (1.0 - mastery) * 100.0)), 1)


def confidence_label(observations: int) -> str:
    if observations >= 8:
        return "high"
    if observations >= 3:
        return "medium"
    return "low"


def trend_label(state) -> str:
    """Direction of the BKT belief over the last few updates."""
    history = [h for h in (state.mastery_history or []) if isinstance(h, (int, float))]
    if len(history) < 2:
        return "new"
    # The latest move dominates (a miss right after a good run reads as
    # slipping), with the last few updates as context.
    last_step = history[-1] - history[-2]
    window = history[-1] - history[max(0, len(history) - 4)]
    delta = 0.6 * last_step + 0.4 * window
    if delta >= 0.05:
        return "improving"
    if delta <= -0.05:
        return "slipping"
    return "steady"


def _archetype_p_learn(db, user_id: int) -> float:
    try:
        import models

        profile = db.query(models.ComprehensiveUserProfile).filter_by(user_id=user_id).first()
        if profile and profile.primary_archetype:
            return P_LEARN_BY_ARCHETYPE.get(profile.primary_archetype, P_LEARN_DEFAULT)
    except Exception:
        pass
    return P_LEARN_DEFAULT


def get_state(db, user_id: int, topic: str):
    import models

    key = concept_key(topic)
    if not key:
        return None
    return db.query(models.StudentKnowledgeState).filter_by(user_id=user_id, concept_id=key).first()


def observe(
    db,
    user_id: int,
    topic: str,
    credit: float,
    *,
    source: Optional[str] = None,
    difficulty: Optional[str] = None,
    skip_if_recent: bool = False,
):
    """Feeds one graded answer into the topic's BKT state (creating it on
    first sight) and returns the state. Caller commits."""
    import models

    key = concept_key(topic)
    if not key:
        return None

    state = db.query(models.StudentKnowledgeState).filter_by(user_id=user_id, concept_id=key).first()
    now = datetime.now(timezone.utc)

    if state is not None and skip_if_recent:
        last = _as_utc(state.last_updated)
        if last and (now - last).total_seconds() < CHAT_DEDUPE_SECONDS:
            return state

    if state is None:
        state = models.StudentKnowledgeState(
            user_id=user_id,
            concept_id=key,
            concept_name=topic_label(topic) or key,
            p_mastery=P_MASTERY_PRIOR,
            p_learn=_archetype_p_learn(db, user_id),
            mastery_history=[],
            interaction_count=0,
        )
        db.add(state)
        db.flush()

    slip, guess = evidence_params(source, difficulty)
    before = decayed_mastery(state)
    after = bkt_step(
        before,
        float(credit),
        state.p_learn if state.p_learn is not None else P_LEARN_DEFAULT,
        slip,
        guess,
    )
    state.p_mastery = after
    state.interaction_count = (state.interaction_count or 0) + 1
    state.last_updated = now
    # Reassign (not append) so the JSON column is marked dirty.
    state.mastery_history = ((state.mastery_history or []) + [round(after, 3)])[-30:]

    logger.info(
        "[WEAKNESS] BKT user=%s concept=%s source=%s difficulty=%s credit=%.2f %.3f -> %.3f",
        user_id, key, source or DEFAULT_SOURCE, difficulty or "medium", float(credit), before, after,
    )
    return state


def apply_score(weak_area, state) -> None:
    """Writes the model's score/status/priority onto a UserWeakArea row."""
    attempts = weak_area.total_questions or 0
    mastery = combined_mastery(state, weak_area.correct_count or 0, attempts)
    score = score_from_mastery(mastery)
    weak_area.weakness_score = score

    if mastery >= MASTERED_AT and attempts >= MASTERED_MIN_ATTEMPTS:
        weak_area.status = "mastered"
    elif mastery >= IMPROVING_AT:
        weak_area.status = "improving"
    else:
        weak_area.status = "needs_practice"

    if score >= 80:
        priority = 10
    elif score >= 65:
        priority = 8
    elif score >= 50:
        priority = 6
    elif score >= 35:
        priority = 4
    else:
        priority = 2
    if (weak_area.consecutive_wrong or 0) >= 3:
        priority = min(10, priority + 2)
    weak_area.priority = priority


# ---------------------------------------------------------------------------
# Read side: one ranked, live-decayed view for chat, notes and the Weaknesses page.
# ---------------------------------------------------------------------------

def _source_counts(db, user_id: int, topics: Iterable[str]) -> dict[str, dict]:
    """Recent misses per topic (from WrongAnswerLog) so callers can say where
    the evidence came from and cite the actual items that were missed."""
    import models

    topics = [t for t in topics if t]
    if not topics:
        return {}
    rows = (
        db.query(models.WrongAnswerLog)
        .filter(models.WrongAnswerLog.user_id == user_id, models.WrongAnswerLog.topic.in_(topics))
        .order_by(models.WrongAnswerLog.answered_at.desc())
        .limit(200)
        .all()
    )
    out: dict[str, dict] = {}
    for row in rows:
        entry = out.setdefault(row.topic, {"sources": [], "recent_misses": [], "_seen": set()})
        source = row.source or "question_bank"
        if source not in entry["sources"]:
            entry["sources"].append(source)
        question = (row.question_text or "").strip()
        if question and question not in entry["_seen"] and len(entry["recent_misses"]) < 3:
            entry["_seen"].add(question)
            entry["recent_misses"].append({
                "question": question[:220],
                "correct_answer": (row.correct_answer or "")[:220],
                "user_answer": (row.user_answer or "")[:160],
                "source": source,
            })
    for entry in out.values():
        entry.pop("_seen", None)
    return out


def ranked_weaknesses(db, user_id: int, *, limit: Optional[int] = 5, include_mastered: bool = False) -> list[dict]:
    """Weak areas with their live model score, highest (weakest) first."""
    import models

    areas = db.query(models.UserWeakArea).filter(
        models.UserWeakArea.user_id == user_id,
        models.UserWeakArea.total_questions > 0,
    ).all()
    if not areas:
        return []

    states = {
        s.concept_id: s
        for s in db.query(models.StudentKnowledgeState).filter(
            models.StudentKnowledgeState.user_id == user_id,
            models.StudentKnowledgeState.concept_id.in_([concept_key(a.topic) for a in areas]),
        ).all()
    }
    evidence = _source_counts(db, user_id, [a.topic for a in areas])

    items: list[dict] = []
    for area in areas:
        attempts = area.total_questions or 0
        correct = area.correct_count or 0
        state = states.get(concept_key(area.topic))
        if state is not None:
            mastery = combined_mastery(state, correct, attempts)
            score = score_from_mastery(mastery)
            model = "bkt"
            observations = state.interaction_count or 0
            trend = trend_label(state)
        else:
            # Legacy row that predates the model and has had no answer since.
            score = round(float(area.weakness_score or 0.0), 1)
            mastery = None
            model = "legacy"
            observations = attempts
            trend = "new"
        is_mastered = (
            mastery >= MASTERED_AT and attempts >= MASTERED_MIN_ATTEMPTS
            if mastery is not None
            else area.status == "mastered"
        )
        if is_mastered and not include_mastered:
            continue
        ev = evidence.get(area.topic, {})
        items.append({
            "topic": area.topic,
            "label": topic_label(area.topic) or area.topic,
            "weakness_score": score,
            "mastery": round(mastery, 3) if mastery is not None else None,
            "model": model,
            "observations": observations,
            "confidence": confidence_label(observations),
            "trend": trend,
            "attempts": attempts,
            "correct": correct,
            "accuracy": round(float(area.accuracy or 0.0), 1),
            "consecutive_wrong": area.consecutive_wrong or 0,
            "status": area.status,
            "sources": ev.get("sources", []),
            "recent_misses": ev.get("recent_misses", []),
            "last_practiced": _as_utc(area.last_practiced).isoformat() if area.last_practiced else None,
        })

    items.sort(key=lambda item: (-item["weakness_score"], -item["attempts"]))
    return items[:limit] if limit else items


def _stem_tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z][a-z0-9]+", (text or "").lower())
    return {w[:6] for w in words if len(w) >= 4 and w not in _STOPWORDS}


def matches_message(label: str, message: str) -> bool:
    """True when the text is about this topic. Compares 6-letter stems so
    "implicitly differentiate" matches "implicit differentiation"; multi-word
    topics need at least two of their stems to appear."""
    label_l = (label or "").strip().lower()
    message_l = (message or "").lower()
    if not label_l or not message_l:
        return False
    if len(label_l) >= 4 and label_l in message_l:
        return True
    topic_stems = _stem_tokens(label_l)
    if not topic_stems:
        return False
    hits = topic_stems & _stem_tokens(message_l)
    needed = 1 if len(topic_stems) == 1 else 2
    return len(hits) >= needed


def weaknesses_for_message(db, user_id: int, message: str, *, limit: int = 3) -> list[dict]:
    """Tracked weak areas the text is about, weakest first."""
    if not (message or "").strip():
        return []
    items = ranked_weaknesses(db, user_id, limit=None)
    matched = [item for item in items if matches_message(item["label"], message)]
    return matched[:limit]


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def note_text(*parts: Optional[str], max_chars: int = 6000) -> str:
    """Plain text from note title/topic/content (HTML stripped) for matching."""
    text = " ".join(_HTML_TAG_RE.sub(" ", p or "") for p in parts if p)
    return re.sub(r"\s+", " ", text).strip()[:max_chars]


def focus_summary(items: list[dict]) -> list[dict]:
    """Small client-facing view of matched weak spots."""
    return [
        {
            "topic": item["label"],
            "weakness_score": item["weakness_score"],
            "confidence": item.get("confidence"),
            "trend": item.get("trend"),
            "missed": len(item.get("recent_misses") or []),
        }
        for item in items
    ]


def note_focus_block(items: list[dict]) -> str:
    """Prompt block telling a note generator which weak spot this note is
    about and exactly what the student has been getting wrong."""
    if not items:
        return ""
    lines = [
        "STUDENT WEAK SPOT — THIS NOTE IS ON A TOPIC THE STUDENT KEEPS GETTING WRONG",
        "(weakness score 0-100 from a knowledge-tracing model over their graded answers; higher = weaker)",
    ]
    for item in items:
        lines.append(
            f"- {item['label']}: weakness {item['weakness_score']:.0f}/100, "
            f"{item.get('correct', 0)}/{item.get('attempts', 0)} correct, trend {item.get('trend', 'new')}"
        )
        for miss in (item.get("recent_misses") or [])[:3]:
            detail = f" — correct answer: {miss['correct_answer']}" if miss.get("correct_answer") else ""
            wrong = f" — they answered: {miss['user_answer']}" if miss.get("user_answer") else ""
            lines.append(f"    missed: {miss['question']}{detail}{wrong}")
    lines.append(
        "Adjust the note for this: slow down and fully explain the parts behind the missed items above "
        "(show every step of worked examples), call out the likely misconception directly, and finish with a "
        "section titled '## Check yourself' containing 2-3 short questions on exactly those points with answers "
        "under an 'Answer:' line. Always include that section, even if it means trimming elsewhere. Keep everything else at the requested depth. Do not mention scores, "
        "tracking or the word 'weakness' in the note itself."
    )
    return "\n".join(lines)


def note_focus(db, user_id: int, *parts: Optional[str], limit: int = 2) -> tuple[list[dict], str]:
    """(matched weak spots, prompt block) for a note built from these parts."""
    text = note_text(*parts)
    if not text:
        return [], ""
    items = weaknesses_for_message(db, user_id, text, limit=limit)
    return items, note_focus_block(items)
