import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


async def _update_weak_areas(db: Session, user_id: int, results: List[Dict], models):
    try:
        for result in results:
            topic = str(result.get("topic") or "General").strip() or "General"
            is_correct = result.get("is_correct", False)
            question_id = result.get("question_id")

            weak_area = db.query(models.UserWeakArea).filter(
                models.UserWeakArea.user_id == user_id,
                models.UserWeakArea.topic == topic
            ).first()

            if not weak_area:
                weak_area = models.UserWeakArea(
                    user_id=user_id,
                    topic=topic,
                    total_questions=0,
                    correct_count=0,
                    incorrect_count=0,
                    first_identified=datetime.now(timezone.utc)
                )
                db.add(weak_area)
                db.flush()

            weak_area.total_questions += 1

            if is_correct:
                weak_area.correct_count += 1
                weak_area.consecutive_wrong = 0
            else:
                weak_area.incorrect_count += 1
                weak_area.consecutive_wrong += 1
                weak_area.last_wrong_streak = max(weak_area.last_wrong_streak, weak_area.consecutive_wrong)

                wrong_log = models.WrongAnswerLog(
                    user_id=user_id,
                    question_id=question_id,
                    question_set_id=result.get("question_set_id"),
                    question_text=result.get("question_text", ""),
                    topic=topic,
                    difficulty=result.get("difficulty"),
                    correct_answer=result.get("correct_answer", ""),
                    user_answer=result.get("user_answer", ""),
                    answered_at=datetime.now(timezone.utc)
                )
                db.add(wrong_log)

            if weak_area.total_questions > 0:
                weak_area.accuracy = (weak_area.correct_count / weak_area.total_questions) * 100

            accuracy_factor = 100 - weak_area.accuracy
            streak_factor = min(weak_area.consecutive_wrong * 10, 30)
            volume_factor = min(weak_area.incorrect_count * 2, 20)

            weak_area.weakness_score = min(100, accuracy_factor * 0.5 + streak_factor + volume_factor)

            if weak_area.accuracy < 30:
                weak_area.priority = 10
            elif weak_area.accuracy < 50:
                weak_area.priority = 8
            elif weak_area.accuracy < 70:
                weak_area.priority = 6
            elif weak_area.accuracy < 85:
                weak_area.priority = 4
            else:
                weak_area.priority = 2

            if weak_area.consecutive_wrong >= 3:
                weak_area.priority = min(10, weak_area.priority + 2)

            if weak_area.accuracy >= 90 and weak_area.total_questions >= 5:
                weak_area.status = "mastered"
            elif weak_area.accuracy >= 70:
                weak_area.status = "improving"
            else:
                weak_area.status = "needs_practice"

            weak_area.last_updated = datetime.now(timezone.utc)

        db.commit()
        logger.info(f"Updated weak areas for user {user_id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Error updating weak areas: {e}")


def _compute_topic_performance_from_sessions(sessions) -> List[Dict[str, Any]]:
    topic_stats: Dict[str, Dict[str, int]] = {}

    for session in sessions:
        if not session or not session.results:
            continue
        try:
            results = json.loads(session.results) if session.results else []
        except Exception:
            continue

        for result in results:
            topic = result.get("topic") or "General"
            is_correct = result.get("is_correct", False)

            if topic not in topic_stats:
                topic_stats[topic] = {"total": 0, "correct": 0}

            topic_stats[topic]["total"] += 1
            if is_correct:
                topic_stats[topic]["correct"] += 1

    topic_performance = []
    for topic, stats in topic_stats.items():
        total = stats.get("total", 0)
        correct = stats.get("correct", 0)
        accuracy = (correct / total) * 100 if total > 0 else 0
        topic_performance.append({
            "topic": topic,
            "accuracy": round(accuracy, 1),
            "total_questions": total,
            "correct_answers": correct
        })

    return topic_performance


def _merge_topics(*topic_lists: List[str], limit: int = 8) -> List[str]:
    merged: List[str] = []
    seen = set()
    for topics in topic_lists:
        if not topics:
            continue
        for topic in topics:
            if not topic:
                continue
            clean = str(topic).strip()
            if not clean:
                continue
            key = clean.lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(clean)
            if limit and len(merged) >= limit:
                return merged
    return merged


def _topic_in_text(topic: str, text: str) -> bool:
    if not topic or not text:
        return False
    t = str(topic).lower().strip()
    if not t:
        return False
    return t in str(text).lower()


def _filter_analysis_by_topics(analysis: Dict[str, Any], topics: List[str]) -> Dict[str, Any]:
    if not topics:
        return analysis

    def _matches(item: Any) -> bool:
        if not item:
            return False
        if isinstance(item, str):
            return any(_topic_in_text(t, item) for t in topics)
        if isinstance(item, dict):
            for v in item.values():
                if _matches(v):
                    return True
        if isinstance(item, list):
            return any(_matches(v) for v in item)
        return False

    filtered = dict(analysis)
    for key in [
        "key_facts",
        "definitions",
        "relationships",
        "processes",
        "comparisons",
        "cause_effects",
        "numerical_data",
        "examples"
    ]:
        items = analysis.get(key, [])
        if isinstance(items, list):
            filtered[key] = [item for item in items if _matches(item)]

    filtered["subtopics"] = [t for t in analysis.get("subtopics", []) if _matches(t)] if isinstance(analysis.get("subtopics", []), list) else analysis.get("subtopics", [])
    return filtered


def _parse_text_list(raw_value: Any, limit: int = 10) -> List[str]:
    if raw_value is None:
        return []

    if isinstance(raw_value, list):
        return [str(v).strip() for v in raw_value if str(v).strip()][:limit]

    text = str(raw_value).strip()
    if not text:
        return []

    parsed = None
    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None

    if isinstance(parsed, list):
        return [str(v).strip() for v in parsed if str(v).strip()][:limit]

    parts = re.split(r"[,;\n|]", text)
    return [p.strip() for p in parts if p and p.strip()][:limit]


def _collect_universal_personalization(db: Session, user, models, max_topics: int = 8) -> Dict[str, Any]:
    weak_topics_db: List[str] = []
    weak_topics_profile: List[str] = []
    weak_topics_analytics: List[str] = []
    weak_topics_wrong_logs: List[str] = []
    weak_topics_chroma: List[str] = []
    strong_topics_db: List[str] = []
    strong_topics_profile: List[str] = []
    preferred_topics: List[str] = []
    recent_context: List[str] = []
    profile_hints: Dict[str, Any] = {}

    try:
        weak_rows = db.query(models.UserWeakArea).filter(
            models.UserWeakArea.user_id == user.id,
            models.UserWeakArea.status != "mastered"
        ).order_by(
            models.UserWeakArea.priority.desc(),
            models.UserWeakArea.weakness_score.desc()
        ).limit(10).all()
        weak_topics_db = [wa.topic for wa in weak_rows if getattr(wa, "topic", None)]
    except Exception as e:
        logger.warning(f"Could not load UserWeakArea topics for personalization: {e}")

    try:
        wrong_topic_rows = db.query(
            models.WrongAnswerLog.topic,
            func.count(models.WrongAnswerLog.id).label("cnt")
        ).filter(
            models.WrongAnswerLog.user_id == user.id,
            models.WrongAnswerLog.topic.isnot(None),
            models.WrongAnswerLog.topic != ""
        ).group_by(
            models.WrongAnswerLog.topic
        ).order_by(
            func.count(models.WrongAnswerLog.id).desc()
        ).limit(10).all()
        weak_topics_wrong_logs = [row[0] for row in wrong_topic_rows if row[0]]
    except Exception as e:
        logger.warning(f"Could not load WrongAnswerLog topics for personalization: {e}")

    try:
        sessions = db.query(models.QuestionSession).filter(
            models.QuestionSession.user_id == user.id
        ).order_by(models.QuestionSession.completed_at.desc()).limit(60).all()
        topic_performance = _compute_topic_performance_from_sessions(sessions)
        weak_topics_analytics = [t["topic"] for t in topic_performance if t.get("accuracy", 100) < 60][:8]
        strong_topics_db = [
            t["topic"] for t in sorted(topic_performance, key=lambda x: -x.get("accuracy", 0))
            if t.get("accuracy", 0) >= 80 and t.get("total_questions", 0) >= 3
        ][:8]
    except Exception as e:
        logger.warning(f"Could not load QuestionSession topic stats for personalization: {e}")

    try:
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        if profile:
            weak_topics_profile = _parse_text_list(getattr(profile, "weak_areas", None), limit=10)
            strong_topics_profile = _parse_text_list(getattr(profile, "strong_areas", None), limit=10)
            preferred_subjects = _parse_text_list(getattr(profile, "preferred_subjects", None), limit=10)
            main_subject = getattr(profile, "main_subject", None)
            major = getattr(profile, "major", None)
            preferred_topics = _merge_topics(preferred_subjects, [main_subject, major], limit=10)
            profile_hints = {
                "difficulty_level": getattr(profile, "difficulty_level", None),
                "learning_pace": getattr(profile, "learning_pace", None),
                "preferred_content_types": _parse_text_list(getattr(profile, "preferred_content_types", None), limit=6)
            }
    except Exception as e:
        logger.warning(f"Could not load ComprehensiveUserProfile for personalization: {e}")

    try:
        from tutor import chroma_store
        if chroma_store.available():
            weak_topics_chroma = chroma_store.get_weak_quiz_topics(str(user.id), top_k=8) or []
    except Exception as e:
        logger.warning(f"Could not load Chroma weak topics for personalization: {e}")

    try:
        recent_chats = db.query(models.ChatSession.title).filter(
            models.ChatSession.user_id == user.id
        ).order_by(models.ChatSession.updated_at.desc()).limit(3).all()
        recent_notes = db.query(models.Note.title).filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == False
        ).order_by(models.Note.updated_at.desc()).limit(3).all()
        recent_flash_sets = db.query(models.FlashcardSet.title).filter(
            models.FlashcardSet.user_id == user.id
        ).order_by(models.FlashcardSet.updated_at.desc()).limit(3).all()
        recent_context = _merge_topics(
            [r[0] for r in recent_chats if r and r[0]],
            [r[0] for r in recent_notes if r and r[0]],
            [r[0] for r in recent_flash_sets if r and r[0]],
            limit=6
        )
    except Exception as e:
        logger.warning(f"Could not load recent cross-tool context for personalization: {e}")

    weak_topics = _merge_topics(
        weak_topics_db,
        weak_topics_profile,
        weak_topics_wrong_logs,
        weak_topics_analytics,
        weak_topics_chroma,
        limit=max_topics
    )

    strong_topics = _merge_topics(
        strong_topics_db,
        strong_topics_profile,
        limit=max_topics
    )
    strong_topics = [t for t in strong_topics if t.lower() not in {w.lower() for w in weak_topics}]

    focus_topics = _merge_topics(weak_topics, preferred_topics, limit=max_topics)
    universal_topics = _merge_topics(focus_topics, strong_topics, limit=max_topics + 2)

    return {
        "weak_topics": weak_topics,
        "strong_topics": strong_topics,
        "preferred_topics": preferred_topics,
        "focus_topics": focus_topics,
        "universal_topics": universal_topics,
        "profile_hints": profile_hints,
        "recent_context": recent_context
    }


def _merge_request_topics(request_topics: Optional[List[str]], personalization: Dict[str, Any], limit: int = 10) -> List[str]:
    return _merge_topics(
        request_topics or [],
        personalization.get("universal_topics", []),
        limit=limit
    )


def _build_universal_personalization_prompt(
    custom_prompt: Optional[str],
    personalization: Dict[str, Any],
    context_label: str
) -> str:
    weak_topics = personalization.get("weak_topics", [])
    strong_topics = personalization.get("strong_topics", [])
    preferred_topics = personalization.get("preferred_topics", [])
    recent_context = personalization.get("recent_context", [])
    hints = personalization.get("profile_hints", {}) or {}

    lines = []
    if custom_prompt:
        lines.append(custom_prompt.strip())

    lines.append(f"Universal personalization context ({context_label}):")
    if weak_topics:
        lines.append(f"- Prioritize weak topics first: {', '.join(weak_topics[:6])}")
    if strong_topics:
        lines.append(f"- Use stronger topics for challenge/transfer questions: {', '.join(strong_topics[:4])}")
    if preferred_topics:
        lines.append(f"- Keep examples aligned with preferred subjects when relevant: {', '.join(preferred_topics[:5])}")
    if recent_context:
        lines.append(f"- Maintain continuity with recent learning context: {', '.join(recent_context[:4])}")

    difficulty_level = hints.get("difficulty_level")
    learning_pace = hints.get("learning_pace")
    if difficulty_level:
        lines.append(f"- Student profile difficulty level: {difficulty_level}")
    if learning_pace:
        lines.append(f"- Student learning pace: {learning_pace}")

    lines.append("- Avoid repeating identical questions from prior sessions; vary framing and application.")
    lines.append("- If weak topics conflict with source material coverage, still prioritize what is supported by the source.")

    return "\n".join(lines).strip()
