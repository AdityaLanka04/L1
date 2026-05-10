from __future__ import annotations

import re
from typing import List, Optional

from services.topic_utils import is_valid_topic


def _clean_topic(text: str) -> str:
    cleaned = re.sub(r"^(ai generated:|cerbyl:|flashcards?:|notes?:|practice:\s*)\s*", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\*+", "", cleaned)
    return cleaned.strip()


def _dedupe_preserve(items: List[str]) -> List[str]:
    seen = set()
    output = []
    for item in items:
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(item)
    return output


def extract_topic_from_episode(entry: dict) -> Optional[str]:
    meta = entry.get("metadata") or {}
    for key in ("topic", "note_title", "set_title", "concept"):
        value = meta.get(key)
        if value:
            topic = _clean_topic(str(value))
            if is_valid_topic(topic):
                return topic
    doc = entry.get("document", "")
    match = re.search(r'"([^"]+)"', doc)
    if match:
        topic = _clean_topic(match.group(1))
        if is_valid_topic(topic):
            return topic
    match = re.search(r"about ([^\.]+)", doc, flags=re.IGNORECASE)
    if match:
        topic = _clean_topic(match.group(1))
        if is_valid_topic(topic):
            return topic
    return None


def build_chroma_prompts(user_id: str) -> list:
    try:
        from tutor import chroma_store
    except Exception:
        return []

    if not chroma_store.available():
        return []

    episodes = []
    for source in ("note_activity", "flashcard_created", "chat", "flashcard_review", "quiz_created", "quiz_completed"):
        episodes.extend(chroma_store.retrieve_recent_by_source(user_id, source, top_k=5))

    prompts = []
    for entry in episodes:
        topic = extract_topic_from_episode(entry)
        meta = entry.get("metadata") or {}
        source = meta.get("source", "")

        if source == "note_activity":
            if not topic:
                continue
            prompts.append({"text": f"create flashcards on {topic}", "reason": "Turn recent notes into active recall", "priority": "high"})
            prompts.append({"text": f"quiz me on {topic}", "reason": "Test what you just studied", "priority": "medium"})
        elif source == "flashcard_created":
            if not topic:
                continue
            prompts.append({"text": f"quiz me on {topic}", "reason": "Test your flashcard knowledge", "priority": "high"})
        elif source == "flashcard_review":
            was_correct = str(meta.get("was_correct", "")).lower() == "false"
            marked = meta.get("action") == "marked_for_review"
            if was_correct or marked:
                prompts.append({"text": "review weak flashcards", "reason": "Focus on difficult cards", "priority": "high"})
            elif topic:
                prompts.append({"text": f"quiz me on {topic}", "reason": "Reinforce recent topics", "priority": "medium"})
        elif source == "quiz_created":
            if not topic:
                continue
            score = meta.get("score")
            if score is not None and float(score) < 60:
                prompts.append({"text": f"create flashcards on {topic}", "reason": f"Reinforce — you scored {score}% on this quiz", "priority": "high"})
            else:
                prompts.append({"text": f"quiz me on {topic}", "reason": "Practice this topic again", "priority": "medium"})
        elif source == "quiz_completed":
            if not topic:
                continue
            score = meta.get("score")
            if score is not None and float(score) < 70:
                prompts.append({"text": f"review flashcards on {topic}", "reason": f"Scored {score}% — review will help", "priority": "high"})
            elif topic:
                prompts.append({"text": f"create questions on {topic}", "reason": "Ready for the next level", "priority": "medium"})
        elif source == "chat":
            if not topic:
                continue
            prompts.append({"text": f"create notes on {topic}", "reason": "Document what you discussed", "priority": "medium"})
            prompts.append({"text": f"create flashcards on {topic}", "reason": "Turn the discussion into practice", "priority": "medium"})

    try:
        weak_topics = chroma_store.get_weak_quiz_topics(user_id, top_k=3)
        for wt in weak_topics:
            if is_valid_topic(wt):
                prompts.append({"text": f"quiz me on {wt}", "reason": "Focus on weaker areas", "priority": "high"})
                prompts.append({"text": f"create flashcards on {wt}", "reason": "Rebuild retention", "priority": "high"})
    except Exception:
        pass

    try:
        important_entries = chroma_store.retrieve_important(user_id, top_k=3)
        for entry in important_entries:
            topic = extract_topic_from_episode(entry)
            if not topic:
                continue
            prompts.append({"text": f"create notes on {topic}", "reason": "Pinned as important", "priority": "medium"})
    except Exception:
        pass

    return prompts


def get_chroma_suggestions(user_id: str, query: Optional[str], limit: int = 8) -> List[str]:
    try:
        from tutor import chroma_store
    except Exception:
        return []

    if not chroma_store.available():
        return []

    episodes: List[dict] = []
    if query:
        episodes = chroma_store.retrieve_episodes_filtered(user_id, query, top_k=limit)
    else:
        for source in ("note_activity", "flashcard_created", "chat", "flashcard_review", "quiz_created", "quiz_completed"):
            episodes.extend(chroma_store.retrieve_recent_by_source(user_id, source, top_k=4))

    suggestions: List[str] = []
    seen_topics: set = set()

    for entry in episodes:
        meta = entry.get("metadata") or {}
        source = meta.get("source", "")
        topic = extract_topic_from_episode(entry)

        if not topic or topic.lower() in seen_topics:
            continue
        seen_topics.add(topic.lower())

        if source == "note_activity":
            suggestions.append(f"/flashcards {topic}")
            suggestions.append(f"/quiz {topic}")
        elif source == "flashcard_created":
            suggestions.append(f"/quiz {topic}")
            suggestions.append("/review")
        elif source == "flashcard_review":
            suggestions.append("/review")
        elif source in ("quiz_created", "quiz_completed"):
            try:
                score = float(meta.get("score", 100))
            except (ValueError, TypeError):
                score = 100.0
            if score < 65:
                suggestions.append(f"/flashcards {topic}")
                suggestions.append("/review")
            elif score < 80:
                suggestions.append(f"/quiz {topic}")
            else:
                suggestions.append(f"/notes {topic}")
        elif source == "chat":
            suggestions.append(f"/flashcards {topic}")

        if len(suggestions) >= limit:
            break

    try:
        weak_topics = chroma_store.get_weak_quiz_topics(user_id, top_k=2)
        for wt in weak_topics:
            if is_valid_topic(wt):
                suggestions.insert(0, f"/flashcards {wt}")
                suggestions.insert(0, f"/quiz {wt}")
    except Exception:
        pass

    try:
        important_entries = chroma_store.retrieve_important(user_id, top_k=3)
        for entry in important_entries:
            topic = extract_topic_from_episode(entry)
            if not topic or topic.lower() in seen_topics:
                continue
            seen_topics.add(topic.lower())
            suggestions.append(f"/notes {topic}")
            suggestions.append(f"/explain {topic}")
            if len(suggestions) >= limit:
                break
    except Exception:
        pass

    return _dedupe_preserve(suggestions)[:limit]
