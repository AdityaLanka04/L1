"""
Temporal Decay — per-concept forgetting based on elapsed time.

Uses the FSRS retrievability formula applied at the concept level:

    R(t) = 0.9 ^ (t / S)

where:
    t = days since last interaction with the concept
    S = estimated stability (days until R drops to 0.9)

Stability is estimated from interaction history:
    - Positive signals (mastery, extension) increase stability
    - Negative signals (confusion, re_ask) decrease stability
    - More total interactions → higher base stability

This lets the system say "you haven't touched gradient descent in 18 days,
and your last signal was doubt — you've probably forgotten some of it."

Key functions
-------------
get_concept_recency(user_id, db)
    → {concept: {"last_seen_days": int, "last_signal": float, "interaction_count": int}}

compute_decay(mastery: float, days_elapsed: int, stability: float) → float
    → decayed mastery (0–1)

get_decayed_concepts(user_id, db, threshold_days=7)
    → list of {concept, last_seen_days, original_mastery, decayed_mastery}

get_session_gap(user_id, current_chat_id, db)
    → days since the user last had a chat session
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Stability estimates (days until retrievability drops to 0.9)
# These are heuristics — will improve when FSRS is trained per concept.
_BASE_STABILITY = 7.0     # default for a concept seen once positively
_MAX_STABILITY  = 60.0    # mastered concept ceiling
_MIN_STABILITY  = 2.0     # very weak / confusing concept floor

# Decay threshold: concepts with R < this on a new session are surfaced
_DECAY_ALERT_THRESHOLD = 0.75
_NEW_SESSION_GAP_HOURS = 2  # gap in hours that defines a "new session"


def _retrievability(days_elapsed: float, stability: float) -> float:
    """R(t) = 0.9 ^ (t / S)"""
    if stability <= 0 or days_elapsed <= 0:
        return 1.0
    return 0.9 ** (days_elapsed / stability)


def _estimate_stability(interactions: list[dict]) -> float:
    """
    Estimate memory stability from interaction history.
    Each interaction: {"knowledge_signal": float, "days_ago": float}
    """
    if not interactions:
        return _BASE_STABILITY

    pos_weight = 0.0
    neg_weight = 0.0
    count      = len(interactions)

    for ix in interactions:
        ks = float(ix.get("knowledge_signal", 0.0))
        # More recent interactions weighted more
        recency  = max(0.1, 1.0 - ix.get("days_ago", 0) / 90.0)
        if ks > 0:
            pos_weight += ks * recency
        elif ks < 0:
            neg_weight += abs(ks) * recency

    net = pos_weight - neg_weight
    # Scale: net of +1 → stability ≈ 21d, net of -1 → stability ≈ 3d
    stability = _BASE_STABILITY + net * 14.0 + count * 0.5
    return max(_MIN_STABILITY, min(_MAX_STABILITY, stability))


def get_concept_recency(user_id: int, db) -> dict[str, dict]:
    """
    For each concept the user has interacted with, return timing + signal info.

    Returns:
        {
            "gradient descent": {
                "last_seen_days":   4.2,
                "last_signal":      -0.45,
                "interaction_count": 7,
                "stability":        9.3,
                "retrievability":   0.82,
            },
            ...
        }
    """
    from models import ChatConceptSignal, QuestionResult, QuestionAttempt, Question

    now = datetime.now(timezone.utc)

    result: dict[str, dict] = {}

    try:
        chat_rows = (
            db.query(
                ChatConceptSignal.concept,
                ChatConceptSignal.knowledge_signal,
                ChatConceptSignal.created_at,
            )
            .filter(ChatConceptSignal.user_id == user_id)
            .order_by(ChatConceptSignal.created_at)
            .all()
        )

        quiz_rows = (
            db.query(
                Question.topic,
                QuestionResult.is_correct,
                QuestionAttempt.submitted_at,
            )
            .join(QuestionResult, QuestionResult.attempt_id == QuestionAttempt.id)
            .join(Question, QuestionResult.question_id == Question.id)
            .filter(
                QuestionAttempt.user_id == user_id,
                Question.topic != None,
                Question.topic != "",
            )
            .order_by(QuestionAttempt.submitted_at)
            .all()
        )
    except Exception as e:
        logger.warning(f"[DECAY] DB query failed: {e}")
        return {}

    # Aggregate all interactions per concept
    concept_ixs: dict[str, list[dict]] = {}

    for concept, ks, ts in chat_rows:
        if not concept:
            continue
        key = concept.strip().lower()
        ts_aware = ts.replace(tzinfo=timezone.utc) if ts and ts.tzinfo is None else ts
        days_ago = (now - ts_aware).total_seconds() / 86400 if ts_aware else 9999
        concept_ixs.setdefault(key, []).append({
            "knowledge_signal": float(ks or 0.0),
            "days_ago":         days_ago,
            "ts":               ts_aware,
        })

    for topic, is_correct, ts in quiz_rows:
        if not topic:
            continue
        key = topic.strip().lower()
        ts_aware = ts.replace(tzinfo=timezone.utc) if ts and ts.tzinfo is None else ts
        days_ago = (now - ts_aware).total_seconds() / 86400 if ts_aware else 9999
        ks = 0.65 if is_correct else -0.65
        concept_ixs.setdefault(key, []).append({
            "knowledge_signal": ks,
            "days_ago":         days_ago,
            "ts":               ts_aware,
        })

    for concept, ixs in concept_ixs.items():
        ixs_sorted       = sorted(ixs, key=lambda x: x.get("ts") or datetime.min.replace(tzinfo=timezone.utc))
        last_ix          = ixs_sorted[-1]
        last_seen_days   = float(last_ix["days_ago"])
        last_signal      = float(last_ix["knowledge_signal"])
        stability        = _estimate_stability(ixs)
        ret              = _retrievability(last_seen_days, stability)

        result[concept] = {
            "last_seen_days":    round(last_seen_days, 1),
            "last_signal":       round(last_signal, 3),
            "interaction_count": len(ixs),
            "stability":         round(stability, 2),
            "retrievability":    round(ret, 4),
        }

    return result


def compute_decay(mastery: float, days_elapsed: float, stability: float) -> float:
    """Apply temporal decay to a mastery value."""
    r = _retrievability(days_elapsed, stability)
    return round(mastery * r, 4)


def get_decayed_concepts(
    user_id: int,
    db,
    threshold_days: int = 7,
    min_retrievability: float = _DECAY_ALERT_THRESHOLD,
) -> list[dict]:
    """
    Return concepts the student likely needs to review — they haven't
    engaged with them recently and retrievability has dropped.

    Only returns concepts seen at least once AND last seen > threshold_days ago.

    Sorted by retrievability ascending (most forgotten first).
    """
    recency = get_concept_recency(user_id, db)
    decayed = []

    for concept, info in recency.items():
        if info["last_seen_days"] < threshold_days:
            continue
        if info["retrievability"] > min_retrievability:
            continue
        decayed.append({
            "concept":        concept,
            "last_seen_days": info["last_seen_days"],
            "last_signal":    info["last_signal"],
            "retrievability": info["retrievability"],
            "stability":      info["stability"],
        })

    decayed.sort(key=lambda x: x["retrievability"])
    return decayed[:10]


def get_session_gap(user_id: int, current_chat_id: Optional[int], db) -> Optional[float]:
    """
    Days since the user's last chat session (excluding current one).
    Returns None if no previous session exists.
    """
    from models import ChatSession

    try:
        query = db.query(ChatSession).filter(ChatSession.user_id == user_id)
        if current_chat_id:
            query = query.filter(ChatSession.id != current_chat_id)

        last = query.order_by(ChatSession.updated_at.desc()).first()
        if not last or not last.updated_at:
            return None

        now     = datetime.now(timezone.utc)
        last_ts = last.updated_at
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)

        return round((now - last_ts).total_seconds() / 86400, 1)
    except Exception as e:
        logger.warning(f"[DECAY] Session gap query failed: {e}")
        return None
