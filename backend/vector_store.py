"""
vector_store.py — pgvector abstraction replacing ChromaDB.

Single 'embeddings' table with collection + user_id partitioning.
Collections:
  episodic       + user_id  — episodic memory (chroma_store)
  important      + user_id  — pinned content (chroma_store)
  quiz_history   + user_id  — quiz performance (chroma_store)
  hs_curriculum  (no uid)   — global shared curriculum (context_store)
  user_docs      + user_id  — private uploaded docs (context_store)
  memories       + user_id  — long-term student memories (memory_service)
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)

_engine = None
_embed_model = None


def initialize(embed_model) -> None:
    global _engine, _embed_model
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set — cannot initialize vector_store")

    sync_url = db_url
    if "+asyncpg" in sync_url:
        sync_url = sync_url.replace("+asyncpg", "+psycopg2")
    elif sync_url.startswith("postgres://"):
        sync_url = "postgresql+psycopg2://" + sync_url[len("postgres://"):]
    elif sync_url.startswith("postgresql://") and "+psycopg2" not in sync_url:
        sync_url = "postgresql+psycopg2://" + sync_url[len("postgresql://"):]

    _engine = create_engine(sync_url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    _embed_model = embed_model
    _ensure_schema()
    logger.info("vector_store initialized (pgvector)")


def available() -> bool:
    return _engine is not None and _embed_model is not None


def _ensure_schema() -> None:
    with _engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id          TEXT        NOT NULL,
                collection  TEXT        NOT NULL,
                user_id     TEXT,
                content     TEXT        NOT NULL,
                embedding   vector(384),
                metadata    JSONB       DEFAULT '{}',
                created_at  TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (collection, id)
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emb_col_user
                ON embeddings (collection, user_id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emb_metadata
                ON embeddings USING GIN (metadata)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_emb_hnsw
                ON embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m=16, ef_construction=64)
        """))


def embed(text_: str) -> list[float]:
    if _embed_model is None:
        return [0.0] * 384
    try:
        vec = _embed_model.encode(text_)
        return vec.tolist() if hasattr(vec, "tolist") else list(vec)
    except Exception as e:
        logger.warning(f"embed failed: {e}")
        return [0.0] * 384


def upsert(
    collection: str,
    id_: str,
    content: str,
    embedding: list[float],
    metadata: dict,
    user_id: Optional[str] = None,
) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
                VALUES (:id, :col, :uid, :content, :emb::vector, :meta::jsonb)
                ON CONFLICT (collection, id) DO UPDATE
                    SET content    = EXCLUDED.content,
                        embedding  = EXCLUDED.embedding,
                        metadata   = EXCLUDED.metadata,
                        user_id    = EXCLUDED.user_id,
                        created_at = NOW()
            """),
            {
                "id": id_,
                "col": collection,
                "uid": user_id,
                "content": content,
                "emb": json.dumps(embedding),
                "meta": json.dumps(metadata),
            },
        )


def bulk_upsert(rows: list[dict]) -> None:
    """
    rows: list of {id, collection, user_id?, content, embedding, metadata}
    Inserts in batches of 200.
    """
    if not rows:
        return
    batch_size = 200
    with _engine.begin() as conn:
        for start in range(0, len(rows), batch_size):
            batch = rows[start: start + batch_size]
            conn.execute(
                text("""
                    INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
                    VALUES (:id, :col, :uid, :content, :emb::vector, :meta::jsonb)
                    ON CONFLICT (collection, id) DO UPDATE
                        SET content    = EXCLUDED.content,
                            embedding  = EXCLUDED.embedding,
                            metadata   = EXCLUDED.metadata,
                            user_id    = EXCLUDED.user_id,
                            created_at = NOW()
                """),
                [
                    {
                        "id": r["id"],
                        "col": r["collection"],
                        "uid": r.get("user_id"),
                        "content": r["content"],
                        "emb": json.dumps(r["embedding"]),
                        "meta": json.dumps(r["metadata"]),
                    }
                    for r in batch
                ],
            )


def search(
    collection: str,
    query_embedding: list[float],
    top_k: int,
    user_id: Optional[str] = None,
    where: Optional[dict] = None,
) -> list[dict]:
    """
    ANN cosine search. Returns [{id, content, metadata, distance}, ...].
    distance: 0 = identical, 2 = opposite (pgvector cosine distance).
    where: {key: value} or {"$and": [{k: v}, ...]} — JSONB containment filter.
    """
    where_clause, params = _build_where(collection, user_id, where)
    params["emb"] = json.dumps(query_embedding)
    params["top_k"] = top_k

    sql = f"""
        SELECT id, content, metadata,
               (embedding <=> :emb::vector) AS distance
        FROM embeddings
        {where_clause}
        ORDER BY embedding <=> :emb::vector
        LIMIT :top_k
    """
    with _engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    return [
        {
            "id": r[0],
            "content": r[1],
            "metadata": r[2] if isinstance(r[2], dict) else json.loads(r[2] or "{}"),
            "distance": float(r[3]),
        }
        for r in rows
    ]


def get_by_metadata(
    collection: str,
    filters: Optional[dict] = None,
    user_id: Optional[str] = None,
) -> list[dict]:
    """Retrieve rows by metadata filter without vector similarity."""
    where_clause, params = _build_where(collection, user_id, filters)
    sql = f"SELECT id, content, metadata FROM embeddings {where_clause}"
    with _engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [
        {
            "id": r[0],
            "content": r[1],
            "metadata": r[2] if isinstance(r[2], dict) else json.loads(r[2] or "{}"),
        }
        for r in rows
    ]


def count(collection: str, user_id: Optional[str] = None) -> int:
    where_clause, params = _build_where(collection, user_id)
    sql = f"SELECT COUNT(*) FROM embeddings {where_clause}"
    with _engine.connect() as conn:
        return conn.execute(text(sql), params).scalar() or 0


def delete(
    collection: str,
    ids: Optional[list[str]] = None,
    user_id: Optional[str] = None,
    doc_id: Optional[str] = None,
) -> None:
    """Delete by explicit ID list, metadata doc_id, or both. user_id scopes the delete."""
    conditions = ["collection = :col"]
    params: dict = {"col": collection}

    if user_id is not None:
        conditions.append("user_id = :uid")
        params["uid"] = user_id

    if ids is not None:
        conditions.append("id = ANY(:ids)")
        params["ids"] = ids

    if doc_id is not None:
        conditions.append("metadata->>'doc_id' = :doc_id")
        params["doc_id"] = doc_id

    if len(conditions) <= 1:
        logger.warning("delete called with no filters beyond collection — skipping to avoid full wipe")
        return

    sql = f"DELETE FROM embeddings WHERE {' AND '.join(conditions)}"
    with _engine.begin() as conn:
        conn.execute(text(sql), params)


def _build_where(
    collection: str,
    user_id: Optional[str] = None,
    where: Optional[dict] = None,
) -> tuple[str, dict]:
    conditions = ["collection = :col"]
    params: dict = {"col": collection}

    if user_id is not None:
        conditions.append("user_id = :uid")
        params["uid"] = user_id

    if where:
        _apply_where(where, conditions, params)

    return f"WHERE {' AND '.join(conditions)}", params


def _apply_where(where: dict, conditions: list, params: dict, prefix: str = "w") -> None:
    """
    Translate ChromaDB-style filter dict to JSONB conditions.
    Handles: {key: value} and {"$and": [{k: v}, ...]}
    """
    if "$and" in where:
        for i, clause in enumerate(where["$and"]):
            _apply_where(clause, conditions, params, prefix=f"{prefix}a{i}")
        return

    for i, (key, val) in enumerate(where.items()):
        p = f"{prefix}_{i}"
        conditions.append(f"metadata->>'{key}' = :{p}")
        params[p] = str(val)
