"""
Episodic memory store — backed by pgvector via vector_store.

Collections (all scoped by user_id):
  episodic     — main episodic memory (notes, flashcards, chats, quizzes)
  important    — explicitly pinned / high-importance content
  quiz_history — granular quiz performance records for adaptive logic

Public API is identical to the original ChromaDB version.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import vector_store as vs

logger = logging.getLogger(__name__)


def initialize(*args, **kwargs):
    """No-op: initialization handled by vector_store.initialize() in main.py."""
    pass


def available() -> bool:
    return vs.available()


def write_episode(user_id: str, summary: str, metadata: Optional[dict] = None):
    if not available():
        return
    import uuid
    embedding = vs.embed(summary)
    meta = dict(metadata or {})
    meta["user_id"] = str(user_id)
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    meta.setdefault("source", "chat")
    vs.upsert("episodic", str(uuid.uuid4()), summary, embedding, meta, user_id=str(user_id))


def retrieve_episodes(user_id: str, query: str, top_k: int = 3) -> list[str]:
    if not available():
        return []
    if vs.count("episodic", user_id=str(user_id)) == 0:
        return []
    rows = vs.search("episodic", vs.embed(query), top_k, user_id=str(user_id))
    return [r["content"] for r in rows]


def retrieve_episodes_filtered(
    user_id: str,
    query: str,
    source_filter: Optional[str] = None,
    top_k: int = 5,
) -> list[dict]:
    if not available():
        return []
    if vs.count("episodic", user_id=str(user_id)) == 0:
        return []
    where = {"source": source_filter} if source_filter else None
    rows = vs.search("episodic", vs.embed(query), top_k, user_id=str(user_id), where=where)
    combined = [{"document": r["content"], "metadata": r["metadata"]} for r in rows]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined


def retrieve_recent_by_source(user_id: str, source: str, top_k: int = 10) -> list[dict]:
    if not available():
        return []
    if vs.count("episodic", user_id=str(user_id)) == 0:
        return []
    rows = vs.search(
        "episodic",
        vs.embed(f"recent {source} activity"),
        top_k,
        user_id=str(user_id),
        where={"source": source},
    )
    combined = [{"document": r["content"], "metadata": r["metadata"]} for r in rows]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined


def write_important(user_id: str, summary: str, metadata: Optional[dict] = None):
    if not available():
        return
    import uuid
    embedding = vs.embed(summary)
    meta = dict(metadata or {})
    meta["user_id"] = str(user_id)
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    meta.setdefault("source", "important")
    vs.upsert("important", str(uuid.uuid4()), summary, embedding, meta, user_id=str(user_id))


def retrieve_important(user_id: str, query: str = "", top_k: int = 10) -> list[dict]:
    if not available():
        return []
    if vs.count("important", user_id=str(user_id)) == 0:
        return []
    rows = vs.search(
        "important",
        vs.embed(query or "important content"),
        top_k,
        user_id=str(user_id),
    )
    combined = [{"document": r["content"], "metadata": r["metadata"]} for r in rows]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined


def write_quiz_result(
    user_id: str,
    topic: str,
    score: float,
    correct: int,
    total: int,
    metadata: Optional[dict] = None,
):
    if not available():
        return
    import uuid
    status = "excellent" if score >= 85 else ("passed" if score >= 60 else "struggled")
    summary = f'Quiz on "{topic}": scored {score:.1f}% ({correct}/{total}). Status: {status}.'
    embedding = vs.embed(summary)
    meta = dict(metadata or {})
    meta.update({
        "user_id": str(user_id),
        "topic": topic[:100],
        "score": str(round(score, 1)),
        "correct": str(correct),
        "total": str(total),
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "quiz_result",
    })
    vs.upsert("quiz_history", str(uuid.uuid4()), summary, embedding, meta, user_id=str(user_id))


def retrieve_quiz_history(user_id: str, query: str = "", top_k: int = 10) -> list[dict]:
    if not available():
        return []
    if vs.count("quiz_history", user_id=str(user_id)) == 0:
        return []
    rows = vs.search(
        "quiz_history",
        vs.embed(query or "recent quiz performance"),
        top_k,
        user_id=str(user_id),
    )
    combined = [{"document": r["content"], "metadata": r["metadata"]} for r in rows]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined


def get_weak_quiz_topics(user_id: str, score_threshold: float = 65.0, top_k: int = 5) -> list[str]:
    if not available():
        return []
    history = retrieve_quiz_history(user_id, top_k=20)
    topic_scores: dict[str, list[float]] = {}
    for entry in history:
        meta = entry.get("metadata", {})
        topic = meta.get("topic", "")
        try:
            score = float(meta.get("score", 100))
        except (ValueError, TypeError):
            continue
        if topic:
            topic_scores.setdefault(topic, []).append(score)

    weak = []
    for topic, scores in topic_scores.items():
        avg = sum(scores) / len(scores)
        if avg < score_threshold:
            weak.append((topic, avg))

    weak.sort(key=lambda x: x[1])
    return [t for t, _ in weak[:top_k]]
