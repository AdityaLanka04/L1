"""ChromaDB episodic memory store.

Collections per user (all keyed by a short SHA-256 hash of user_id):

  episodic_{hash}     – main episodic memory (notes, flashcards, chats, quizzes)
  important_{hash}    – explicitly pinned / high-importance content
  quiz_history_{hash} – granular quiz performance records for adaptive logic

Sources tracked inside episodic collection:
  chat              – AI tutor chat turns
  note_activity     – note creation / update
  flashcard_created – new flashcard set generated
  flashcard_review  – individual card reviews
  quiz_created      – quiz set generated
  quiz_completed    – quiz session finished with score
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_client = None
_embed_model = None

def initialize(persist_dir: Optional[str] = None):
    global _client, _embed_model
    import chromadb
    from chromadb.config import Settings

    settings = Settings(anonymized_telemetry=False, allow_reset=True)
    if persist_dir:
        _client = chromadb.PersistentClient(path=persist_dir, settings=settings)
    else:
        _client = chromadb.Client(settings)

    try:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Chroma store initialised with SentenceTransformer")
    except ImportError:
        logger.warning("sentence-transformers not installed — Chroma disabled")
        _client = None

def available() -> bool:
    return _client is not None and _embed_model is not None

def _hash(user_id: str) -> str:
    import hashlib
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:16]

def _episodic_name(user_id: str) -> str:
    return f"episodic_{_hash(user_id)}"

def _important_name(user_id: str) -> str:
    return f"important_{_hash(user_id)}"

def _quiz_history_name(user_id: str) -> str:
    return f"quiz_history_{_hash(user_id)}"

def _get_collection(name: str):
    return _client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )

def write_episode(user_id: str, summary: str, metadata: Optional[dict] = None):
    """Write an episodic memory entry with automatic timestamping."""
    if not available():
        return
    import uuid
    col = _get_collection(_episodic_name(user_id))
    embedding = _embed_model.encode(summary).tolist()
    meta = dict(metadata or {})
    meta["user_id"] = str(user_id)
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    meta.setdefault("source", "chat")
    col.add(
        ids=[str(uuid.uuid4())],
        embeddings=[embedding],
        documents=[summary],
        metadatas=[meta],
    )

def retrieve_episodes(user_id: str, query: str, top_k: int = 3) -> list[str]:
    """Retrieve episodes by semantic similarity. Returns plain document strings."""
    if not available():
        return []
    col = _get_collection(_episodic_name(user_id))
    if col.count() == 0:
        return []
    query_embedding = _embed_model.encode(query).tolist()
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, col.count()),
    )
    return results.get("documents", [[]])[0]

def retrieve_episodes_filtered(
    user_id: str,
    query: str,
    source_filter: Optional[str] = None,
    top_k: int = 5,
) -> list[dict]:
    """Retrieve episodes with optional source filter. Returns dicts with document + metadata."""
    if not available():
        return []
    col = _get_collection(_episodic_name(user_id))
    if col.count() == 0:
        return []

    query_embedding = _embed_model.encode(query).tolist()
    where_filter = {"source": source_filter} if source_filter else None

    try:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            where=where_filter,
            include=["documents", "metadatas"],
        )
    except Exception:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            include=["documents", "metadatas"],
        )

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    combined = [{"document": d, "metadata": m} for d, m in zip(docs, metas)]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined

def retrieve_recent_by_source(
    user_id: str,
    source: str,
    top_k: int = 10,
) -> list[dict]:
    """Retrieve the most recent episodes of a given source type."""
    if not available():
        return []
    col = _get_collection(_episodic_name(user_id))
    if col.count() == 0:
        return []

    try:
        generic_embedding = _embed_model.encode(f"recent {source} activity").tolist()
        results = col.query(
            query_embeddings=[generic_embedding],
            n_results=min(top_k, col.count()),
            where={"source": source},
            include=["documents", "metadatas"],
        )
    except Exception:
        return []

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    combined = [{"document": d, "metadata": m} for d, m in zip(docs, metas)]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined

def write_important(user_id: str, summary: str, metadata: Optional[dict] = None):
    """Pin an important piece of content to the user's important collection."""
    if not available():
        return
    import uuid
    col = _get_collection(_important_name(user_id))
    embedding = _embed_model.encode(summary).tolist()
    meta = dict(metadata or {})
    meta["user_id"] = str(user_id)
    meta.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    meta.setdefault("source", "important")
    col.add(
        ids=[str(uuid.uuid4())],
        embeddings=[embedding],
        documents=[summary],
        metadatas=[meta],
    )

def retrieve_important(user_id: str, query: str = "", top_k: int = 10) -> list[dict]:
    """Retrieve important entries semantically (or all recents if no query given)."""
    if not available():
        return []
    col = _get_collection(_important_name(user_id))
    if col.count() == 0:
        return []

    q = query or "important content"
    query_embedding = _embed_model.encode(q).tolist()
    try:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            include=["documents", "metadatas"],
        )
    except Exception:
        return []

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    combined = [{"document": d, "metadata": m} for d, m in zip(docs, metas)]
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
    """Record a completed quiz session in the dedicated quiz-history collection."""
    if not available():
        return
    import uuid
    col = _get_collection(_quiz_history_name(user_id))
    status = "excellent" if score >= 85 else ("passed" if score >= 60 else "struggled")
    summary = (
        f"Quiz on \"{topic}\": scored {score:.1f}% ({correct}/{total}). Status: {status}."
    )
    embedding = _embed_model.encode(summary).tolist()
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
    col.add(
        ids=[str(uuid.uuid4())],
        embeddings=[embedding],
        documents=[summary],
        metadatas=[meta],
    )

def retrieve_quiz_history(user_id: str, query: str = "", top_k: int = 10) -> list[dict]:
    """Retrieve past quiz results for a user, optionally filtered by topic similarity."""
    if not available():
        return []
    col = _get_collection(_quiz_history_name(user_id))
    if col.count() == 0:
        return []

    q = query or "recent quiz performance"
    query_embedding = _embed_model.encode(q).tolist()
    try:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            include=["documents", "metadatas"],
        )
    except Exception:
        return []

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    combined = [{"document": d, "metadata": m} for d, m in zip(docs, metas)]
    combined.sort(key=lambda x: x.get("metadata", {}).get("timestamp", ""), reverse=True)
    return combined

def get_weak_quiz_topics(user_id: str, score_threshold: float = 65.0, top_k: int = 5) -> list[str]:
    """Return topics where the user consistently scores below the threshold."""
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
