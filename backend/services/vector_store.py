
from __future__ import annotations

import json
import logging
import os
import math
import threading
from typing import Optional

from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)

_engine = None
_embed_model = None
_lazy_init_lock = threading.Lock()
_lazy_init_attempted = False

_UPSERT_SQL_PG = text("""
    INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
    VALUES (:id, :col, :uid, :content, CAST(:emb AS vector), CAST(:meta AS jsonb))
    ON CONFLICT (collection, id) DO UPDATE
        SET content    = EXCLUDED.content,
            embedding  = EXCLUDED.embedding,
            metadata   = EXCLUDED.metadata,
            user_id    = EXCLUDED.user_id,
            created_at = NOW()
""")

_UPSERT_SQL_SQLITE = text("""
    INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
    VALUES (:id, :col, :uid, :content, :emb, :meta)
    ON CONFLICT (collection, id) DO UPDATE
        SET content    = excluded.content,
            embedding  = excluded.embedding,
            metadata   = excluded.metadata,
            user_id    = excluded.user_id,
            created_at = CURRENT_TIMESTAMP
""")

def _is_sqlite() -> bool:
    return _engine is not None and _engine.dialect.name == "sqlite"

def _sanitize_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    text_value = str(value).replace("\x00", "")
    return text_value.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")

def _sanitize_embedding(values: list[float]) -> list[float]:
    cleaned: list[float] = []
    for raw in values or []:
        try:
            number = float(raw)
        except Exception:
            number = 0.0
        if not math.isfinite(number):
            number = 0.0
        cleaned.append(number)
    if len(cleaned) < 384:
        cleaned.extend([0.0] * (384 - len(cleaned)))
    elif len(cleaned) > 384:
        cleaned = cleaned[:384]
    return cleaned

def _row_params(row: dict) -> dict:
    metadata = row.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    return {
        "id": _sanitize_text(row.get("id", "")),
        "col": _sanitize_text(row.get("collection", "")),
        "uid": _sanitize_text(row.get("user_id", "")) or None,
        "content": _sanitize_text(row.get("content", "")),
        "emb": json.dumps(_sanitize_embedding(row.get("embedding") or [])),
        "meta": json.dumps(metadata),
    }

def _parse_metadata(value) -> dict:
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    try:
        if isinstance(value, (bytes, bytearray)):
            value = value.decode("utf-8", errors="ignore")
        if isinstance(value, str):
            return json.loads(value or "{}")
    except Exception:
        return {}
    return {}

def _parse_embedding(value) -> list[float]:
    if isinstance(value, list):
        return _sanitize_embedding(value)
    if value is None:
        return [0.0] * 384
    try:
        if isinstance(value, (bytes, bytearray)):
            value = value.decode("utf-8", errors="ignore")
        if isinstance(value, str):
            return _sanitize_embedding(json.loads(value or "[]"))
    except Exception:
        return [0.0] * 384
    return [0.0] * 384

def _cosine_distance(a: list[float], b: list[float]) -> float:
    va = _sanitize_embedding(a)
    vb = _sanitize_embedding(b)
    dot = sum(x * y for x, y in zip(va, vb))
    na = math.sqrt(sum(x * x for x in va))
    nb = math.sqrt(sum(y * y for y in vb))
    if na == 0.0 or nb == 0.0:
        return 1.0
    cos_sim = dot / (na * nb)
    cos_sim = max(-1.0, min(1.0, cos_sim))
    return 1.0 - cos_sim

def _where_matches(where: Optional[dict], metadata: dict) -> bool:
    if not where:
        return True
    if "$and" in where:
        return all(_where_matches(clause, metadata) for clause in where.get("$and", []))
    for key, val in where.items():
        if str(metadata.get(key, "")) != str(val):
            return False
    return True

def _execute_upsert(conn, params: dict) -> None:
    upsert_sql = _UPSERT_SQL_SQLITE if _is_sqlite() else _UPSERT_SQL_PG
    try:
        conn.execute(upsert_sql, params)
    except Exception as e:
        msg = str(e).lower()
        if "no unique or exclusion constraint matching the on conflict specification" in msg:
            conn.execute(
                text("DELETE FROM embeddings WHERE collection = :col AND id = :id"),
                {"col": params["col"], "id": params["id"]},
            )
            if _is_sqlite():
                conn.execute(
                    text("""
                        INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
                        VALUES (:id, :col, :uid, :content, :emb, :meta)
                    """),
                    params,
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO embeddings (id, collection, user_id, content, embedding, metadata)
                        VALUES (:id, :col, :uid, :content, CAST(:emb AS vector), CAST(:meta AS jsonb))
                    """),
                    params,
                )
            return
        raise

def initialize(embed_model, db_url: str | None = None) -> None:
    global _engine, _embed_model
    resolved_url = db_url or os.environ.get("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
    if not resolved_url:
        raise RuntimeError("DATABASE_URL not set — cannot initialize vector_store")

    sync_url = resolved_url
    if "+asyncpg" in sync_url:
        sync_url = sync_url.replace("+asyncpg", "+psycopg2")
    elif sync_url.startswith("postgres://"):
        sync_url = "postgresql+psycopg2://" + sync_url[len("postgres://"):]
    elif sync_url.startswith("postgresql://") and "+psycopg2" not in sync_url:
        sync_url = "postgresql+psycopg2://" + sync_url[len("postgresql://"):]

    if "sqlite" in sync_url:
        _engine = create_engine(sync_url, connect_args={"check_same_thread": False})
    else:
        _engine = create_engine(sync_url, pool_size=5, max_overflow=10, pool_pre_ping=True)
    _embed_model = embed_model
    try:
        _verify_schema()
    except Exception:
        _engine = None
        _embed_model = None
        raise
    if _is_sqlite():
        logger.info("vector_store initialized (sqlite fallback)")
    else:
        logger.info("vector_store initialized (pgvector)")

def _lazy_init() -> None:
    """Initialize on first real use if startup didn't already do it.

    Startup skips eager loading in production (ENABLE_STARTUP_EMBEDDINGS=false,
    see main.py) to keep boot fast, which otherwise leaves uploads/RAG permanently
    disabled. This loads the embedding model + DB engine once, on demand, instead.
    """
    global _engine, _embed_model, _lazy_init_attempted
    with _lazy_init_lock:
        if _engine is not None and _embed_model is not None:
            return
        if _lazy_init_attempted:
            return
        _lazy_init_attempted = True
        try:
            from sentence_transformers import SentenceTransformer
            try:
                embed_model = SentenceTransformer("BAAI/bge-small-en-v1.5")
            except Exception:
                embed_model = SentenceTransformer("all-MiniLM-L6-v2")
            initialize(embed_model)
            logger.info("vector_store lazily initialized on first use")
        except Exception as e:
            logger.warning(f"vector_store lazy init failed: {e}")

def available() -> bool:
    if _engine is None or _embed_model is None:
        _lazy_init()
    return _engine is not None and _embed_model is not None

def _verify_schema() -> None:
    """Confirm the `embeddings` table exists. Schema is owned by Alembic
    (see alembic/versions/461b429293bf_vector_store_embeddings_table.py),
    not created here, so this just fails fast with a clear message if
    migrations haven't been run yet."""
    with _engine.connect() as conn:
        try:
            conn.execute(text("SELECT 1 FROM embeddings LIMIT 1"))
        except Exception as e:
            raise RuntimeError(
                "embeddings table not found — run `alembic upgrade head` before "
                "initializing vector_store"
            ) from e

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
        _execute_upsert(
            conn,
            _row_params(
                {
                    "id": id_,
                    "collection": collection,
                    "user_id": user_id,
                    "content": content,
                    "embedding": embedding,
                    "metadata": metadata,
                }
            ),
        )

def bulk_upsert(rows: list[dict]) -> int:
    if not rows:
        return 0
    batch_size = 200
    inserted = 0
    with _engine.begin() as conn:
        upsert_sql = _UPSERT_SQL_SQLITE if _is_sqlite() else _UPSERT_SQL_PG
        for start in range(0, len(rows), batch_size):
            batch = rows[start: start + batch_size]
            params_batch = [_row_params(r) for r in batch]
            try:
                conn.execute(upsert_sql, params_batch)
                inserted += len(params_batch)
            except Exception as batch_error:
                logger.warning(
                    "bulk_upsert batch failed at start=%s size=%s; retrying row-wise. error=%s",
                    start,
                    len(params_batch),
                    batch_error,
                )
                for p in params_batch:
                    try:
                        _execute_upsert(conn, p)
                        inserted += 1
                    except Exception as row_error:
                        logger.warning(
                            "bulk_upsert row failed id=%s collection=%s error=%s",
                            p.get("id"),
                            p.get("col"),
                            row_error,
                        )
    return inserted

def search(
    collection: str,
    query_embedding: list[float],
    top_k: int,
    user_id: Optional[str] = None,
    where: Optional[dict] = None,
) -> list[dict]:
    if _is_sqlite():
        params: dict = {"col": collection}
        sql = "SELECT id, content, embedding, metadata FROM embeddings WHERE collection = :col"
        if user_id is not None:
            sql += " AND user_id = :uid"
            params["uid"] = user_id
        with _engine.connect() as conn:
            rows = conn.execute(text(sql), params).fetchall()

        query_vec = _sanitize_embedding(query_embedding)
        scored: list[dict] = []
        for r in rows:
            meta = _parse_metadata(r[3])
            if not _where_matches(where, meta):
                continue
            dist = _cosine_distance(query_vec, _parse_embedding(r[2]))
            scored.append({
                "id": r[0],
                "content": r[1],
                "metadata": meta,
                "distance": float(dist),
            })
        scored.sort(key=lambda x: x["distance"])
        return scored[:top_k]

    where_clause, params = _build_where(collection, user_id, where)
    params["emb"] = json.dumps(_sanitize_embedding(query_embedding))
    params["top_k"] = top_k

    sql = f"""
        SELECT id, content, metadata,
               (embedding <=> CAST(:emb AS vector)) AS distance
        FROM embeddings
        {where_clause}
        ORDER BY embedding <=> CAST(:emb AS vector)
        LIMIT :top_k
    """
    with _engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    return [
        {
            "id": r[0],
            "content": r[1],
            "metadata": _parse_metadata(r[2]),
            "distance": float(r[3]),
        }
        for r in rows
    ]

def get_by_metadata(
    collection: str,
    filters: Optional[dict] = None,
    user_id: Optional[str] = None,
) -> list[dict]:
    if _is_sqlite():
        params: dict = {"col": collection}
        sql = "SELECT id, content, metadata FROM embeddings WHERE collection = :col"
        if user_id is not None:
            sql += " AND user_id = :uid"
            params["uid"] = user_id
        with _engine.connect() as conn:
            rows = conn.execute(text(sql), params).fetchall()
        out: list[dict] = []
        for r in rows:
            meta = _parse_metadata(r[2])
            if _where_matches(filters, meta):
                out.append({"id": r[0], "content": r[1], "metadata": meta})
        return out

    where_clause, params = _build_where(collection, user_id, filters)
    sql = f"SELECT id, content, metadata FROM embeddings {where_clause}"
    with _engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()
    return [
        {
            "id": r[0],
            "content": r[1],
            "metadata": _parse_metadata(r[2]),
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
    if _is_sqlite():
        conditions = ["collection = :col"]
        params: dict = {"col": collection}
        if user_id is not None:
            conditions.append("user_id = :uid")
            params["uid"] = user_id
        base_where = " AND ".join(conditions)
        with _engine.begin() as conn:
            if ids is not None:
                if not ids:
                    return
                placeholders = ", ".join([f":id_{i}" for i in range(len(ids))])
                id_params = {f"id_{i}": ids[i] for i in range(len(ids))}
                conn.execute(
                    text(f"DELETE FROM embeddings WHERE {base_where} AND id IN ({placeholders})"),
                    {**params, **id_params},
                )
                return

            if doc_id is not None:
                rows = conn.execute(
                    text(f"SELECT id, metadata FROM embeddings WHERE {base_where}"),
                    params,
                ).fetchall()
                to_delete = [r[0] for r in rows if str(_parse_metadata(r[1]).get("doc_id", "")) == str(doc_id)]
                if not to_delete:
                    return
                placeholders = ", ".join([f":did_{i}" for i in range(len(to_delete))])
                del_params = {f"did_{i}": to_delete[i] for i in range(len(to_delete))}
                conn.execute(
                    text(f"DELETE FROM embeddings WHERE {base_where} AND id IN ({placeholders})"),
                    {**params, **del_params},
                )
                return

            logger.warning("delete called with no ids/doc_id for sqlite — skipping to avoid full wipe")
            return

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
    if "$and" in where:
        for i, clause in enumerate(where["$and"]):
            _apply_where(clause, conditions, params, prefix=f"{prefix}a{i}")
        return

    for i, (key, val) in enumerate(where.items()):
        p = f"{prefix}_{i}"
        conditions.append(f"metadata->>'{key}' = :{p}")
        params[p] = str(val)
