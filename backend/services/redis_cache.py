"""
redis_cache.py — Redis-backed cache with in-memory fallback for Brainwave.

Two cache namespaces:
  1. emb  — query/text embedding vectors (TTL 24h)
             Avoids re-running SentenceTransformer for repeated queries.
  2. search — context_store search results (TTL 15min)
              Avoids re-embedding + re-querying ChromaDB for repeated searches.

How it saves API costs
======================
The AI (Gemini/Groq) is called AFTER context retrieval.  The context fed into
the prompt comes from search_context().  If the search result is cached:

  - No re-embedding of the query (CPU + latency saved)
  - No ChromaDB round-trip (latency saved)
  - The same high-quality RAG context is reused for identical queries
  - The AI call itself is NOT cached here (see note below)

For AI-level caching, integrate with your AI call layer separately.

Fallback behaviour
==================
When Redis is unreachable, an in-memory LRU dict is used automatically.
This still improves intra-process performance (e.g. same user refreshes page).
No configuration change is needed to run without Redis.

Initialisation
==============
Call init_redis() once at startup (e.g. in main.py lifespan):

    import redis_cache
    redis_cache.init_redis(host="localhost", port=6379)

Or load connection params from env:
    REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

EMBEDDING_TTL: int = 86_400   # 24 hours
SEARCH_TTL: int = 900         # 15 minutes
FALLBACK_MAX_SIZE: int = 2_000

_redis_client = None
_fallback: dict[str, tuple[Any, float]] = {}
_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Stats counters (in-process, for test reporting)
# ---------------------------------------------------------------------------
_stats: dict[str, int] = {
    "emb_hits": 0, "emb_misses": 0,
    "search_hits": 0, "search_misses": 0,
}


def init_redis(
    host: str | None = None,
    port: int | None = None,
    db: int | None = None,
    password: str | None = None,
) -> bool:
    """
    Connect to Redis.  Parameters default to env vars then localhost:6379/0.
    Returns True if connected, False if unavailable (fallback activates silently).
    """
    global _redis_client
    _host = host or os.getenv("REDIS_HOST", "localhost")
    _port = int(port or os.getenv("REDIS_PORT", 6379))
    _db = int(db if db is not None else os.getenv("REDIS_DB", 0))
    _pw = password or os.getenv("REDIS_PASSWORD") or None

    try:
        import redis as _redis
        client = _redis.Redis(
            host=_host, port=_port, db=_db, password=_pw,
            socket_connect_timeout=2, socket_timeout=2,
            decode_responses=True,
        )
        client.ping()
        _redis_client = client
        logger.info("Redis cache connected: %s:%d/db%d", _host, _port, _db)
        return True
    except Exception as e:
        logger.info("Redis unavailable (%s) — using in-memory fallback cache", e)
        _redis_client = None
        return False


def is_redis_available() -> bool:
    return _redis_client is not None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _make_key(prefix: str, *parts: str) -> str:
    combined = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(combined.encode()).hexdigest()[:24]
    return f"bw:{prefix}:{digest}"


def _evict_fallback() -> None:
    """Remove oldest 10% of entries when the fallback dict is full."""
    if len(_fallback) >= FALLBACK_MAX_SIZE:
        oldest = sorted(_fallback.keys(), key=lambda k: _fallback[k][1])[: FALLBACK_MAX_SIZE // 10]
        for k in oldest:
            del _fallback[k]


def _fallback_get(key: str) -> Any | None:
    with _lock:
        item = _fallback.get(key)
        if item is None:
            return None
        value, expiry = item
        if time.monotonic() > expiry:
            del _fallback[key]
            return None
        return value


def _fallback_set(key: str, value: Any, ttl: int) -> None:
    with _lock:
        _evict_fallback()
        _fallback[key] = (value, time.monotonic() + ttl)


def _redis_get(key: str) -> Any | None:
    try:
        raw = _redis_client.get(key)  # type: ignore[union-attr]
        return json.loads(raw) if raw is not None else None
    except Exception as e:
        logger.debug("Redis GET failed for %s: %s", key, e)
        return None


def _redis_set(key: str, value: Any, ttl: int) -> None:
    try:
        _redis_client.setex(key, ttl, json.dumps(value))  # type: ignore[union-attr]
    except Exception as e:
        logger.debug("Redis SET failed for %s: %s", key, e)


# ---------------------------------------------------------------------------
# Public API: embedding cache
# ---------------------------------------------------------------------------

def get_embedding(text: str) -> list[float] | None:
    """Return cached embedding vector for text, or None on cache miss."""
    key = _make_key("emb", text[:300])
    value = _redis_get(key) if _redis_client else _fallback_get(key)
    if value is not None:
        _stats["emb_hits"] += 1
    else:
        _stats["emb_misses"] += 1
    return value


def set_embedding(text: str, vector: list[float]) -> None:
    """Cache an embedding vector for text."""
    key = _make_key("emb", text[:300])
    if _redis_client:
        _redis_set(key, vector, EMBEDDING_TTL)
    else:
        _fallback_set(key, vector, EMBEDDING_TTL)


def get_embeddings_batch(texts: list[str]) -> dict[str, list[float]]:
    """
    Batch embedding lookup.
    Returns {text: vector} for all cache hits.
    """
    hits: dict[str, list[float]] = {}
    for text in texts:
        cached = get_embedding(text)
        if cached is not None:
            hits[text] = cached
    return hits


def set_embeddings_batch(text_vector_pairs: list[tuple[str, list[float]]]) -> None:
    """Batch-store multiple embedding vectors."""
    for text, vector in text_vector_pairs:
        set_embedding(text, vector)


# ---------------------------------------------------------------------------
# Public API: search result cache
# ---------------------------------------------------------------------------

def _search_key(query: str, user_id: str, **kwargs: Any) -> str:
    params = json.dumps(kwargs, sort_keys=True)
    return _make_key("search", query, str(user_id), params)


def get_search(query: str, user_id: str, **kwargs: Any) -> list[dict] | None:
    """Return cached search results, or None on miss."""
    key = _search_key(query, user_id, **kwargs)
    value = _redis_get(key) if _redis_client else _fallback_get(key)
    if value is not None:
        _stats["search_hits"] += 1
    else:
        _stats["search_misses"] += 1
    return value


def set_search(query: str, user_id: str, results: list[dict], **kwargs: Any) -> None:
    """Cache search results."""
    key = _search_key(query, user_id, **kwargs)
    if _redis_client:
        _redis_set(key, results, SEARCH_TTL)
    else:
        _fallback_set(key, results, SEARCH_TTL)


def invalidate_user_search(user_id: str) -> None:
    """
    Invalidate all search cache entries for a user.
    Called after a user uploads or deletes a document so stale results are cleared.

    With Redis: uses SCAN + DELETE (non-blocking, pattern-based).
    With fallback: removes all search entries (can't filter by user_id in the key hash).
    """
    if _redis_client:
        try:
            pattern = "bw:search:*"
            keys = list(_redis_client.scan_iter(pattern, count=200))  # type: ignore[union-attr]
            if keys:
                _redis_client.delete(*keys)  # type: ignore[union-attr]
            logger.debug("Invalidated %d search cache entries for user %s", len(keys), user_id)
        except Exception as e:
            logger.debug("Cache invalidate_user_search failed: %s", e)
    else:
        with _lock:
            search_keys = [k for k in list(_fallback.keys()) if k.startswith("bw:search:")]
            for k in search_keys:
                del _fallback[k]


# ---------------------------------------------------------------------------
# Stats & diagnostics
# ---------------------------------------------------------------------------

def cache_stats() -> dict:
    """
    Return cache hit/miss counts and backend info.

    Example output:
        {
            "backend": "redis",
            "emb_hits": 12, "emb_misses": 3,
            "search_hits": 5, "search_misses": 8,
            "redis_connected": True,
            "redis_keyspace_hits": 17,
            "redis_keyspace_misses": 11,
        }
    """
    stats: dict[str, Any] = {
        "backend": "redis" if _redis_client else "memory",
        **_stats,
    }
    if _redis_client:
        try:
            info = _redis_client.info("stats")  # type: ignore[union-attr]
            stats["redis_connected"] = True
            stats["redis_keyspace_hits"] = info.get("keyspace_hits", 0)
            stats["redis_keyspace_misses"] = info.get("keyspace_misses", 0)
        except Exception:
            stats["redis_connected"] = False
    else:
        with _lock:
            stats["fallback_size"] = len(_fallback)
            stats["fallback_max"] = FALLBACK_MAX_SIZE
    return stats


def reset_stats() -> None:
    """Reset in-process hit/miss counters (useful between test runs)."""
    global _stats
    _stats = {"emb_hits": 0, "emb_misses": 0, "search_hits": 0, "search_misses": 0}
