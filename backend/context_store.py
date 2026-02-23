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
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Module-level references — shared with tutor/chroma_store via initialize()
_client = None
_embed_model = None

HS_CURRICULUM_COLLECTION = "hs_curriculum"


# ── Initialisation ────────────────────────────────────────────────────────────

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


# ── Collection name helpers ───────────────────────────────────────────────────

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


# ── Document ingestion ────────────────────────────────────────────────────────

def add_document_chunks(
    user_id: str,
    doc_id: str,
    filename: str,
    chunks: list[str],
    subject: str = "",
    grade_level: str = "",
    scope: str = "private",          # "private" | "hs_shared"
    source_url: str = "",
) -> int:
    """
    Embed and store text chunks into the appropriate ChromaDB collection(s).

    Logic:
      - scope == "private"   → store in user_docs_{hash} only
      - scope == "hs_shared" → store in BOTH user_docs_{hash} AND hs_curriculum
                               (user keeps their own copy, contributes to global)

    Returns the number of chunks successfully stored.
    Raises RuntimeError if not available(). Raises ValueError if chunks is empty.
    """
    if not available():
        raise RuntimeError("context_store not initialized")
    if not chunks:
        raise ValueError("No chunks provided")

    timestamp = datetime.now(timezone.utc).isoformat()

    def _write_to_collection(col_name: str) -> int:
        col = _get_collection(col_name)
        ids, embeddings, documents, metadatas = [], [], [], []

        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_{i}"
            embedding = _embed_model.encode(chunk).tolist()
            meta = {
                "doc_id": doc_id,
                "filename": filename[:200],
                "subject": subject[:100] if subject else "",
                "grade_level": grade_level[:50] if grade_level else "",
                "scope": scope,
                "user_id": str(user_id),
                "chunk_index": str(i),
                "source_url": source_url[:300] if source_url else "",
                "timestamp": timestamp,
            }
            ids.append(chunk_id)
            embeddings.append(embedding)
            documents.append(chunk)
            metadatas.append(meta)

        # Batch writes to avoid memory spikes
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

    return stored


# ── Retrieval ─────────────────────────────────────────────────────────────────

def search_context(
    query: str,
    user_id: str,
    use_hs: bool = True,
    top_k: int = 5,
) -> list[dict]:
    """
    Semantic search across user's private docs and optionally the shared HS curriculum.

    Strategy:
      1. Query user_docs_{hash} (always, if collection has docs)
      2. Query hs_curriculum (if use_hs=True and collection has docs)
      3. Deduplicate by doc_id+chunk_index
      4. Re-rank by cosine distance (lower = more similar)
      5. Return top_k results

    Returns list of dicts: {"text": str, "metadata": dict, "source": "private"|"hs", "distance": float}
    Falls back to [] on any error or if not available().
    """
    if not available():
        return []

    try:
        query_embedding = _embed_model.encode(query).tolist()
    except Exception as e:
        logger.warning(f"Query embedding failed: {e}")
        return []

    results = []
    seen_keys: set[str] = set()

    def _fetch_from(col_name: str, source_label: str):
        try:
            col = _get_collection(col_name)
            if col.count() == 0:
                return
            n = min(top_k, col.count())
            r = col.query(
                query_embeddings=[query_embedding],
                n_results=n,
                include=["documents", "metadatas", "distances"],
            )
            docs = r.get("documents", [[]])[0]
            metas = r.get("metadatas", [[]])[0]
            distances = r.get("distances", [[]])[0]
            for doc, meta, dist in zip(docs, metas, distances):
                key = f"{meta.get('doc_id', '')}_{meta.get('chunk_index', '')}"
                if key not in seen_keys:
                    seen_keys.add(key)
                    results.append({
                        "text": doc,
                        "metadata": meta,
                        "source": source_label,
                        "distance": dist,
                    })
        except Exception as e:
            logger.warning(f"context_store search failed for {col_name}: {e}")

    _fetch_from(_user_docs_name(user_id), "private")
    if use_hs:
        _fetch_from(HS_CURRICULUM_COLLECTION, "hs")

    results.sort(key=lambda x: x.get("distance", 1.0))
    return results[:top_k]


# ── Listing ───────────────────────────────────────────────────────────────────

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
            key = f"{subj}|{grade}"
            if key not in subject_map:
                subject_map[key] = {"subject": subj, "grade_level": grade, "doc_count": 0}
            subject_map[key]["doc_count"] += 1

        return sorted(subject_map.values(), key=lambda x: x["subject"])
    except Exception as e:
        logger.warning(f"list_hs_subjects failed: {e}")
        return []


# ── Deletion ──────────────────────────────────────────────────────────────────

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

    if is_admin:
        try:
            hs_col = _get_collection(HS_CURRICULUM_COLLECTION)
            hs_col.delete(where={"doc_id": doc_id})
        except Exception as e:
            logger.warning(f"delete_document hs_col failed for {doc_id}: {e}")
