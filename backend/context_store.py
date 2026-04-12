"""
context_store.py — ChromaDB interface for Cerbyl HS Mode.

Two collection types:
  hs_curriculum         — global, shared across all users, seeded from public domain content
  user_docs_{hash}      — per-user private document chunks (hash = sha256(user_id)[:16])

Metadata schema per chunk:
  doc_id, filename, subject, grade_level, scope, user_id,
  chunk_index (str), source_url, timestamp

FREE US High School Curriculum Sources for seeding hs_curriculum
=================================================================
All sources below are freely downloadable and either public domain, CC-BY, or
explicitly free for educational use.

1. OpenStax  — https://openstax.org/subjects
   License: CC-BY 4.0. Subjects: Biology, Chemistry, Physics, Algebra, Precalc,
   Statistics, US History, World History, Psychology, Sociology, Economics.
   Download: PDF available per textbook on the subject page.

2. CK-12  — https://www.ck12.org
   License: Free. All grade levels (K-12). Subjects: Math, Science, English,
   Social Studies, History. Supports PDF/EPUB export per flexbook.

3. LibreTexts  — https://libretexts.org
   Subdomains: math.libretexts.org, chem.libretexts.org, bio.libretexts.org,
               phys.libretexts.org, geosci.libretexts.org
   License: CC-BY. Download individual chapters or full books as PDF.

4. College Board AP Frameworks  — https://collegeboard.org/courses
   License: Public. Each AP course page has a free PDF Course and Exam
   Description (CED). Subjects: AP Bio, AP Chem, AP Physics, AP Calc, AP Stats,
   AP US History, AP World History, AP English Lang, AP English Lit, etc.

5. Common Core Standards  — https://corestandards.org
   License: Public domain. Math and ELA standards K-12 available as PDF.

6. US National Library of Medicine (NLM)
   — https://www.ncbi.nlm.nih.gov/books/
   License: Public domain (PubMed Central open-access books).
   Subjects: Biology, Anatomy, Physiology, Biochemistry.
   Note: Search NBK IDs for specific HS-level books.

Seeding Process:
  1. Download PDFs from sources above.
  2. Call document_processor.process_upload(file_bytes, filename, subject, grade_level, scope="hs_shared")
  3. Call context_store.add_document_chunks(user_id="1", doc_id=..., chunks=..., scope="hs_shared")
  4. Create ContextDocument record in DB with user_id=<admin_id>, scope="hs_shared".
"""

from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timezone
from typing import Optional

import redis_cache

logger = logging.getLogger(__name__)

_client = None
_embed_model = None

HS_CURRICULUM_COLLECTION = "hs_curriculum"

_SUBJECT_ALIASES: list[tuple[str, list[str]]] = [
    ("US History", ["us history", "u.s. history", "us hist", "ush", "american history"]),
    ("World History", ["world history", "world hist"]),
    ("History", ["history", "hist"]),
    ("Pre-Calculus", ["precalculus", "pre-calc", "pre calc", "precalc", "pre calculus"]),
    ("Calculus", ["calculus", "calc"]),
    ("Statistics", ["statistics", "stats", "stat"]),
    ("Algebra", ["algebra", "alg"]),
    ("Geometry", ["geometry", "geom"]),
    ("Biology", ["biology", "bio"]),
    ("Chemistry", ["chemistry", "chem"]),
    ("Physics", ["physics", "phys"]),
    ("Earth Science", ["earth science", "geology", "geoscience", "geosci"]),
    ("Environmental Science", ["environmental science", "environmental", "env sci", "environ"]),
    ("Anatomy", ["anatomy"]),
    ("Psychology", ["psychology", "psych"]),
    ("Sociology", ["sociology", "socio"]),
    ("Economics", ["economics", "econ"]),
    ("Government", ["government", "gov", "civics"]),
    ("English", ["english", "ela", "literature", "lit", "language arts"]),
]

_KNOWN_SUBJECTS = {canon for canon, _ in _SUBJECT_ALIASES}

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "at", "by",
    "from", "about", "as", "is", "are", "was", "were", "be", "been", "being",
    "i", "you", "he", "she", "it", "they", "them", "we", "me", "my", "your", "our", "their",
    "this", "that", "these", "those", "what", "why", "how", "when", "where", "which",
    "do", "does", "did", "can", "could", "should", "would", "will", "just", "need", "want",
    "help", "explain", "again", "please",
}

def _normalize_subject_text(text: str) -> str:
    return re.sub(r"[_\-\/]+", " ", (text or "").lower()).strip()

def _matches_alias(text: str, alias: str) -> bool:
    if not text or not alias:
        return False
    if " " in alias:
        return alias in text
    return re.search(rf"\b{re.escape(alias)}\b", text) is not None

def canonicalize_subject(subject: str) -> str:
    """
    Map a subject string to a canonical HS subject name when possible.
    Returns the input trimmed if no mapping found.
    """
    if not subject:
        return ""
    text = _normalize_subject_text(subject)
    for canonical, aliases in _SUBJECT_ALIASES:
        if _matches_alias(text, canonical.lower()):
            return canonical
        for alias in aliases:
            if _matches_alias(text, alias):
                return canonical
    return subject.strip()

def infer_subject(text: str, default: str = "") -> str:
    """
    Infer a canonical HS subject from free text (query or filename).
    Returns default if nothing matches.
    """
    if not text:
        return default
    normalized = _normalize_subject_text(text)
    for canonical, aliases in _SUBJECT_ALIASES:
        for alias in aliases + [canonical.lower()]:
            if _matches_alias(normalized, alias):
                return canonical
    return default

def _keyword_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS}

def _tokenize_list(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    return [t for t in tokens if len(t) > 2 and t not in _STOPWORDS]

def _overlap_ratio(query_tokens: set[str], doc_text: str) -> float:
    if not query_tokens:
        return 0.0
    doc_tokens = _keyword_tokens(doc_text)
    if not doc_tokens:
        return 0.0
    overlap = len(query_tokens & doc_tokens)
    return overlap / max(1, len(query_tokens))

def _bm25_scores(query_tokens: list[str], corpus: list[str], k1: float = 1.5, b: float = 0.75) -> list[float]:
    """
    BM25 ranking scores for a list of candidate documents.
    Returns one score per document; higher = more relevant.
    k1=1.5, b=0.75 are Robertson 2009 defaults.
    """
    if not query_tokens or not corpus:
        return [0.0] * len(corpus)

    tokenized = [_tokenize_list(doc) for doc in corpus]
    dl = [len(t) for t in tokenized]
    avgdl = sum(dl) / max(1, len(dl))
    N = len(corpus)

    scores: list[float] = []
    for i, doc_tokens in enumerate(tokenized):
        freq: dict[str, int] = {}
        for t in doc_tokens:
            freq[t] = freq.get(t, 0) + 1
        doc_len = dl[i]
        score = 0.0
        for term in query_tokens:
            df = sum(1 for dt in tokenized if term in dt)
            if df == 0:
                continue
            idf = math.log((N - df + 0.5) / (df + 0.5) + 1.0)
            tf = freq.get(term, 0)
            score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / max(1, avgdl)))
        scores.append(score)
    return scores

def initialize(chroma_client, embed_model):
    """
    Called from main.py startup AFTER tutor.chroma_store.initialize().
    Reuses the same chroma client and embedding model — no second load.

    Args:
        chroma_client: the chromadb.PersistentClient already created in chroma_store
        embed_model:   the SentenceTransformer("all-MiniLM-L6-v2") already loaded
    """
    global _client, _embed_model
    _client = chroma_client
    _embed_model = embed_model

def available() -> bool:
    return _client is not None and _embed_model is not None

def _hash(user_id: str) -> str:
    import hashlib
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:16]

def _user_docs_name(user_id: str) -> str:
    return f"user_docs_{_hash(user_id)}"

def _get_collection(name: str):
    return _client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )

def add_document_chunks(
    user_id: str,
    doc_id: str,
    filename: str,
    chunks: list[str],
    subject: str = "",
    grade_level: str = "",
    scope: str = "private",
    source_url: str = "",
    source_name: str = "",
    license: str = "",
    replace_existing: bool = False,
    chunk_pages: list[dict] | None = None,
    curriculum: str = "",
    source_type: str = "",
) -> int:
    """
    Embed and store text chunks into the appropriate ChromaDB collection(s).

    Logic:
      - scope == "private"   → store in user_docs_{hash} only
      - scope == "hs_shared" → store in BOTH user_docs_{hash} AND hs_curriculum
                               (user keeps their own copy, contributes to global)

    Set replace_existing=True to delete existing doc_id chunks before insert.

    Returns the number of chunks successfully stored in the user collection.
    Raises RuntimeError if not available(). Raises ValueError if chunks is empty.
    """
    if not available():
        raise RuntimeError("context_store not initialized")
    if not chunks:
        raise ValueError("No chunks provided")

    timestamp = datetime.now(timezone.utc).isoformat()
    clean_subject = canonicalize_subject(subject) if subject else ""
    clean_grade = (grade_level or "").strip()
    cleaned_chunks = [chunk.strip() for chunk in chunks if chunk and chunk.strip()]
    if not cleaned_chunks:
        raise ValueError("No non-empty chunks provided")

    def _encode_chunks(payload: list[str]) -> list[list[float]]:
        try:
            vectors = _embed_model.encode(payload, batch_size=32, show_progress_bar=False)
        except TypeError:
            vectors = _embed_model.encode(payload)
        if hasattr(vectors, "tolist"):
            vectors = vectors.tolist()
        out: list[list[float]] = []
        for vector in vectors:
            if hasattr(vector, "tolist"):
                out.append(vector.tolist())
            else:
                out.append(list(vector))
        return out

    embeddings = _encode_chunks(cleaned_chunks)

    def _write_to_collection(col_name: str) -> int:
        col = _get_collection(col_name)
        if replace_existing:
            try:
                col.delete(where={"doc_id": doc_id})
            except Exception as e:
                logger.warning(f"replace_existing delete failed for {doc_id} in {col_name}: {e}")
        ids, documents, metadatas = [], [], []

        for i, chunk in enumerate(cleaned_chunks):
            chunk_id = f"{doc_id}_{i}"
            meta: dict = {
                "doc_id": doc_id,
                "filename": filename[:200],
                "subject": clean_subject[:100] if clean_subject else "",
                "grade_level": clean_grade[:50] if clean_grade else "",
                "scope": scope,
                "user_id": str(user_id),
                "chunk_index": str(i),
                "page_number": "",
                "page_start": "",
                "page_end": "",
                "source_url": source_url[:300] if source_url else "",
                "source_name": source_name[:120] if source_name else "",
                "license": license[:60] if license else "",
                "curriculum": curriculum[:20] if curriculum else "",
                "source_type": source_type[:40] if source_type else "",
                "timestamp": timestamp,
            }
            if chunk_pages and i < len(chunk_pages):
                pg = chunk_pages[i]
                meta["page_number"] = str(pg.get("page_label") or pg.get("page_start") or "")
                meta["page_start"] = str(pg.get("page_start") or "")
                meta["page_end"] = str(pg.get("page_end") or "")
            ids.append(chunk_id)
            documents.append(chunk)
            metadatas.append(meta)

        batch_size = 100
        for start in range(0, len(ids), batch_size):
            col.add(
                ids=ids[start:start + batch_size],
                embeddings=embeddings[start:start + batch_size],
                documents=documents[start:start + batch_size],
                metadatas=metadatas[start:start + batch_size],
            )
        return len(ids)

    stored = _write_to_collection(_user_docs_name(user_id))

    if scope == "hs_shared":
        try:
            _write_to_collection(HS_CURRICULUM_COLLECTION)
        except Exception as e:
            logger.warning(f"HS curriculum write failed for doc {doc_id}: {e}")

    # Invalidate cached search results so new doc content is immediately visible
    try:
        redis_cache.invalidate_user_search(str(user_id))
    except Exception:
        pass

    return stored

def search_context(
    query: str,
    user_id: str,
    use_hs: bool = True,
    top_k: int = 5,
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    curriculum: Optional[str] = None,
) -> list[dict]:
    """
    Semantic search across user's private docs and optionally the shared HS curriculum.
    If subject/grade_level are provided (or inferred), HS results are filtered when possible.

    Strategy:
      1. Query user_docs_{hash} (always, if collection has docs)
      2. Query hs_curriculum (if use_hs=True and collection has docs)
      3. Deduplicate by doc_id+chunk_index
      4. Re-rank by cosine distance + keyword overlap (favor direct matches)
      5. Return top_k results

    Returns list of dicts: {"text": str, "metadata": dict, "source": "private"|"hs", "distance": float}
    Falls back to [] on any error or if not available().
    """
    if not available():
        return []

    # --- Cache: search results ---
    _cache_kwargs = dict(use_hs=use_hs, top_k=top_k, subject=subject or "", grade_level=grade_level or "", curriculum=curriculum or "")
    cached = redis_cache.get_search(query, user_id, **_cache_kwargs)
    if cached is not None:
        return cached

    # --- Cache: query embedding ---
    query_embedding: list[float] | None = redis_cache.get_embedding(query)
    if query_embedding is None:
        try:
            query_embedding = _embed_model.encode(query).tolist()
            redis_cache.set_embedding(query, query_embedding)
        except Exception as e:
            logger.warning(f"Query embedding failed: {e}")
            return []

    results: list[dict] = []
    seen_keys: set[str] = set()

    query_tokens = _keyword_tokens(query)
    query_token_list = _tokenize_list(query)
    subject_filter = canonicalize_subject(subject) if subject else ""
    if subject_filter not in _KNOWN_SUBJECTS:
        subject_filter = ""
    if not subject_filter:
        inferred = infer_subject(query, default="")
        subject_filter = inferred if inferred in _KNOWN_SUBJECTS else ""
    if subject_filter == "General":
        subject_filter = ""
    grade_filter = (grade_level or "").strip()

    overlap_boost = 0.20
    bm25_boost    = 0.18
    subject_boost = 0.05

    def _fetch_from(col_name: str, source_label: str, where: Optional[dict] = None, n_multiplier: int = 2):
        try:
            col = _get_collection(col_name)
            if col.count() == 0:
                return

            n = min(max(top_k * n_multiplier, top_k), col.count())
            def _do_query(where_clause: Optional[dict]):
                kwargs = {
                    "query_embeddings": [query_embedding],
                    "n_results": n,
                    "include": ["documents", "metadatas", "distances"],
                }
                if where_clause:
                    kwargs["where"] = where_clause
                return col.query(**kwargs)

            r = _do_query(where)
            docs = r.get("documents", [[]])[0]
            metas = r.get("metadatas", [[]])[0]
            distances = r.get("distances", [[]])[0]
            if where and not docs:
                r = _do_query(None)
                docs = r.get("documents", [[]])[0]
                metas = r.get("metadatas", [[]])[0]
                distances = r.get("distances", [[]])[0]

            for doc, meta, dist in zip(docs, metas, distances):
                meta = meta or {}
                key = f"{meta.get('doc_id', '')}_{meta.get('chunk_index', '')}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    overlap = _overlap_ratio(query_tokens, doc)
                    subject_match = (
                        bool(subject_filter)
                        and canonicalize_subject(meta.get("subject", "")) == subject_filter
                    )
                    results.append({
                        "text": doc,
                        "metadata": meta,
                        "source": source_label,
                        "distance": dist,
                        "_overlap": overlap,
                        "_subject_match": subject_match,
                    })
        except Exception as e:
            logger.warning(f"context_store search failed for {col_name}: {e}")

    _fetch_from(_user_docs_name(user_id), "private", n_multiplier=2)
    if use_hs:
        hs_where: dict = {}
        if subject_filter:
            hs_where["subject"] = subject_filter
        if grade_filter:
            hs_where["grade_level"] = grade_filter
        if curriculum:
            hs_where["curriculum"] = curriculum.strip().lower()[:20]
        if len(hs_where) > 1:
            hs_where = {"$and": [{k: v} for k, v in hs_where.items()]}
        _fetch_from(HS_CURRICULUM_COLLECTION, "hs", where=hs_where or None, n_multiplier=4)

    # BM25 re-rank over all candidates
    if query_token_list and results:
        corpus = [r["text"] for r in results]
        bm25 = _bm25_scores(query_token_list, corpus)
        max_bm25 = max(bm25) if bm25 else 1.0
        for i, r in enumerate(results):
            r["_bm25"] = bm25[i] / max(max_bm25, 1e-9)

    def _score(item: dict) -> float:
        score = item.get("distance", 1.0)
        if query_tokens:
            score -= overlap_boost * item.get("_overlap", 0.0)
        if query_token_list:
            score -= bm25_boost * item.get("_bm25", 0.0)
        if item.get("_subject_match"):
            score -= subject_boost
        return score

    ranked = sorted(results, key=_score)
    if query_tokens:
        with_overlap = [r for r in ranked if r.get("_overlap", 0.0) > 0.0]
        if len(with_overlap) >= top_k:
            ranked = with_overlap

    cleaned = []
    for r in ranked[:top_k]:
        cleaned.append({k: v for k, v in r.items() if not k.startswith("_")})

    # Cache the results for future identical queries
    try:
        redis_cache.set_search(query, user_id, cleaned, **_cache_kwargs)
    except Exception:
        pass

    return cleaned

def list_user_docs(user_id: str) -> list[dict]:
    """
    List unique documents stored in user_docs_{hash}.

    Uses chunk_index=="0" entries as document headers.
    Returns [{"doc_id", "filename", "subject", "grade_level", "scope", "timestamp"}, ...]
    sorted newest first.
    """
    if not available():
        return []

    try:
        col = _get_collection(_user_docs_name(user_id))
        if col.count() == 0:
            return []

        all_results = col.get(
            where={"chunk_index": "0"},
            include=["metadatas"],
        )
        metas = all_results.get("metadatas", [])
        docs = [
            {
                "doc_id": m.get("doc_id", ""),
                "filename": m.get("filename", ""),
                "subject": m.get("subject", ""),
                "grade_level": m.get("grade_level", ""),
                "scope": m.get("scope", "private"),
                "timestamp": m.get("timestamp", ""),
            }
            for m in metas
        ]
        docs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return docs
    except Exception as e:
        logger.warning(f"list_user_docs failed: {e}")
        return []

def list_hs_subjects() -> list[dict]:
    """
    Return a deduplicated list of subjects present in the hs_curriculum collection.

    Returns: [{"subject": str, "grade_level": str, "doc_count": int}, ...]
    sorted by subject name.
    """
    if not available():
        return []

    try:
        hs_col = _get_collection(HS_CURRICULUM_COLLECTION)
        if hs_col.count() == 0:
            return []

        all_results = hs_col.get(
            where={"chunk_index": "0"},
            include=["metadatas"],
        )
        metas = all_results.get("metadatas", [])
        subject_map: dict[str, dict] = {}
        for meta in metas:
            subj = meta.get("subject", "General") or "General"
            grade = meta.get("grade_level", "") or ""
            curric = meta.get("curriculum", "") or ""
            key = f"{subj}|{grade}|{curric}"
            if key not in subject_map:
                subject_map[key] = {
                    "subject": subj,
                    "grade_level": grade,
                    "curriculum": curric,
                    "doc_count": 0,
                }
            subject_map[key]["doc_count"] += 1

        return sorted(subject_map.values(), key=lambda x: (x["curriculum"], x["subject"]))
    except Exception as e:
        logger.warning(f"list_hs_subjects failed: {e}")
        return []


def get_hs_stats() -> dict:
    """
    Return aggregate stats about the hs_curriculum collection.

    Returns:
        {
            "total_chunks": int,
            "total_docs": int,
            "by_curriculum": {"us": int, "uk": int, ...},
            "by_subject": {"Biology": int, ...},
            "by_source_type": {"openstax": int, "gcse_aqa": int, ...},
        }
    """
    if not available():
        return {}
    try:
        col = _get_collection(HS_CURRICULUM_COLLECTION)
        total_chunks = col.count()
        if total_chunks == 0:
            return {
                "total_chunks": 0,
                "total_docs": 0,
                "by_curriculum": {},
                "by_subject": {},
                "by_source_type": {},
            }

        all_results = col.get(
            where={"chunk_index": "0"},
            include=["metadatas"],
        )
        metas = all_results.get("metadatas", [])

        by_curriculum: dict[str, int] = {}
        by_subject: dict[str, int] = {}
        by_source: dict[str, int] = {}

        for meta in metas:
            curric = meta.get("curriculum", "unknown") or "unknown"
            subj = meta.get("subject", "General") or "General"
            src = meta.get("source_type", "user") or "user"
            by_curriculum[curric] = by_curriculum.get(curric, 0) + 1
            by_subject[subj] = by_subject.get(subj, 0) + 1
            by_source[src] = by_source.get(src, 0) + 1

        return {
            "total_chunks": total_chunks,
            "total_docs": len(metas),
            "by_curriculum": dict(sorted(by_curriculum.items())),
            "by_subject": dict(sorted(by_subject.items())),
            "by_source_type": dict(sorted(by_source.items())),
        }
    except Exception as e:
        logger.warning(f"get_hs_stats failed: {e}")
        return {}

def delete_document(user_id: str, doc_id: str, is_admin: bool = False):
    """
    Delete all chunks for a doc_id.

    Always deletes from user_docs_{hash}.
    Deletes from hs_curriculum only if is_admin=True.
    """
    if not available():
        return

    try:
        user_col = _get_collection(_user_docs_name(user_id))
        user_col.delete(where={"doc_id": doc_id})
    except Exception as e:
        logger.warning(f"delete_document user_col failed for {doc_id}: {e}")

    try:
        redis_cache.invalidate_user_search(str(user_id))
    except Exception:
        pass

    if is_admin:
        try:
            hs_col = _get_collection(HS_CURRICULUM_COLLECTION)
            hs_col.delete(where={"doc_id": doc_id})
        except Exception as e:
            logger.warning(f"delete_document hs_col failed for {doc_id}: {e}")
