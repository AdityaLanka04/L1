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
        logger.info("Chroma episodic store initialized with SentenceTransformer")
    except ImportError:
        logger.warning("sentence-transformers not installed, Chroma disabled")
        _client = None


def available() -> bool:
    return _client is not None and _embed_model is not None


def _collection_name(user_id: str) -> str:
    import hashlib
    h = hashlib.sha256(str(user_id).encode()).hexdigest()[:16]
    return f"episodic_{h}"


def _get_collection(user_id: str):
    return _client.get_or_create_collection(
        name=_collection_name(user_id),
        metadata={"hnsw:space": "cosine"},
    )


def write_episode(user_id: str, summary: str, metadata: Optional[dict] = None):
    """Write an episodic memory entry with automatic timestamping."""
    if not available():
        return
    import uuid
    col = _get_collection(user_id)
    embedding = _embed_model.encode(summary).tolist()
    doc_id = str(uuid.uuid4())
    meta = metadata or {}
    meta["user_id"] = str(user_id)
    # Always add timestamp for ordering
    if "timestamp" not in meta:
        meta["timestamp"] = datetime.now(timezone.utc).isoformat()
    # Ensure source is set
    if "source" not in meta:
        meta["source"] = "chat"
    col.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[summary],
        metadatas=[meta],
    )


def retrieve_episodes(user_id: str, query: str, top_k: int = 3) -> list[str]:
    """Retrieve episodes by semantic similarity."""
    if not available():
        return []
    col = _get_collection(user_id)
    if col.count() == 0:
        return []
    query_embedding = _embed_model.encode(query).tolist()
    results = col.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, col.count()),
    )
    docs = results.get("documents", [[]])[0]
    return docs


def retrieve_episodes_filtered(
    user_id: str,
    query: str,
    source_filter: Optional[str] = None,
    top_k: int = 5,
) -> list[dict]:
    """Retrieve episodes with optional metadata filtering. Returns docs with metadata."""
    if not available():
        return []
    col = _get_collection(user_id)
    if col.count() == 0:
        return []

    query_embedding = _embed_model.encode(query).tolist()

    where_filter = None
    if source_filter:
        where_filter = {"source": source_filter}

    try:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            where=where_filter,
            include=["documents", "metadatas"],
        )
    except Exception:
        # Fallback without filter if it fails (e.g., no matching source)
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, col.count()),
            include=["documents", "metadatas"],
        )

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    combined = []
    for doc, meta in zip(docs, metas):
        combined.append({"document": doc, "metadata": meta})

    # Sort by timestamp descending (most recent first)
    combined.sort(
        key=lambda x: x.get("metadata", {}).get("timestamp", ""),
        reverse=True,
    )
    return combined


def retrieve_recent_by_source(
    user_id: str,
    source: str,
    top_k: int = 10,
) -> list[dict]:
    """Retrieve the most recent episodes of a given source type.
    Uses a broad query to get all matching source entries.
    """
    if not available():
        return []
    col = _get_collection(user_id)
    if col.count() == 0:
        return []

    try:
        # Use a generic query embedding to get all entries of this source
        generic_query = _embed_model.encode(f"recent {source} activity").tolist()
        results = col.query(
            query_embeddings=[generic_query],
            n_results=min(top_k, col.count()),
            where={"source": source},
            include=["documents", "metadatas"],
        )
    except Exception:
        return []

    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]

    combined = []
    for doc, meta in zip(docs, metas):
        combined.append({"document": doc, "metadata": meta})

    combined.sort(
        key=lambda x: x.get("metadata", {}).get("timestamp", ""),
        reverse=True,
    )
    return combined
