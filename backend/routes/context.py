"""
routes/context.py — Cerbyl HS Mode document management API.

Endpoints:
  POST   /api/context/upload                    — upload a document (PDF/TXT/MD)
  POST   /api/context/import_url                — import a document by URL
  GET    /api/context/documents                 — list user's docs + HS summary
  DELETE /api/context/documents/{doc_id}        — delete (own only; admin can delete HS)
  GET    /api/context/search                    — test RAG retrieval
  GET    /api/context/hs/subjects               — list subjects in shared HS DB

All routes require Bearer token via get_current_user.
File upload uses multipart/form-data (FastAPI UploadFile + Form).
"""

from __future__ import annotations

import logging
import uuid
import json
from pathlib import Path
from urllib.parse import urlparse, unquote
import ipaddress
import re
import requests

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import context_store
from deps import get_db, get_current_user, call_ai
from document_processor import process_upload, CHUNK_SIZE, CHUNK_OVERLAP

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/context", tags=["context"])

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

class RelatedTopicsRequest(BaseModel):
    topics: list[str]
    use_hs: bool = True
    top_k: int = 5
    max_related: int = 8

def _clean_topic_text(text: str) -> str:
    cleaned = re.sub(r"\.[a-zA-Z0-9]{1,5}$", "", text or "")
    cleaned = re.sub(r"[_\-\/]+", " ", cleaned)
    cleaned = re.sub(r"\b(chapter|unit|lesson|notes?|doc|document|slides?)\b", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned

def _title_case_topic(text: str) -> str:
    return " ".join(word.capitalize() for word in (text or "").split())

def _extract_topic_from_result(result: dict) -> str:
    meta = result.get("metadata") or {}
    subject = (meta.get("subject") or "").strip()
    if subject and subject.lower() != "general":
        return context_store.canonicalize_subject(subject) or subject

    filename = (meta.get("filename") or "").strip()
    if filename:
        cleaned = _clean_topic_text(filename)
        if cleaned:
            return _title_case_topic(cleaned)

    text = (result.get("text") or "").strip()
    if not text:
        return ""
    first_line = text.splitlines()[0].strip()
    tokens = re.findall(r"[A-Za-z][A-Za-z'\-]+", first_line.lower())
    stopwords = context_store._STOPWORDS if hasattr(context_store, "_STOPWORDS") else set()
    generic = {
        "flashcards", "flashcard", "notes", "note", "quiz", "quizzes",
        "roadmap", "path", "plan", "study", "learning", "guide",
        "review", "overview", "summary", "explain", "practice"
    }
    keywords = [t for t in tokens if t not in stopwords and t not in generic]
    if not keywords:
        return ""
    return _title_case_topic(" ".join(keywords[:3]))

def _parse_ai_topics(raw: str) -> list[str]:
    if not raw:
        return []
    cleaned = raw.strip()
    cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip("`\n ")
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            topics = data.get("topics") or data.get("related_topics") or data.get("data") or []
        elif isinstance(data, list):
            topics = data
        else:
            topics = []
    except Exception:
        topics = []
        match = re.search(r"\[[\s\S]*\]", cleaned)
        if match:
            try:
                topics = json.loads(match.group(0))
            except Exception:
                topics = []
        if not topics:
            lines = [re.sub(r"^[\s\-*\d.]+", "", line).strip() for line in cleaned.splitlines()]
            topics = [line for line in lines if line]
    return [str(t).strip() for t in topics if str(t).strip()]

def _is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        host = parsed.hostname or ""
        if host in {"localhost", "127.0.0.1", "::1"}:
            return False
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False

_DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    "Accept": "application/pdf,application/octet-stream,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
}

def _filename_from_disposition(value: str) -> str:
    if not value:
        return ""
    match = re.search(r"filename\\*=UTF-8''([^;]+)", value, re.IGNORECASE)
    if match:
        return unquote(match.group(1)).strip().strip('"')
    match = re.search(r'filename="?([^";]+)"?', value, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""

def _download_url(url: str) -> tuple[bytes, str, str]:
    try:
        resp = requests.get(url, stream=True, timeout=30, headers=_DEFAULT_HEADERS)
        if resp.status_code in (401, 403, 406):
            resp = requests.get(url, stream=True, timeout=30, headers={**_DEFAULT_HEADERS, "Referer": url})
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    if resp.status_code >= 400:
        if resp.status_code == 403:
            raise HTTPException(
                status_code=400,
                detail="URL blocked by host (403). Download locally and upload the file instead.",
            )
        raise HTTPException(status_code=400, detail=f"URL returned status {resp.status_code}")

    content_length = resp.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_FILE_SIZE_BYTES:
                raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")
        except ValueError:
            pass

    content = bytearray()
    for chunk in resp.iter_content(chunk_size=1024 * 256):
        if not chunk:
            continue
        content.extend(chunk)
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")

    if not content:
        raise HTTPException(status_code=400, detail="Downloaded file is empty.")

    content_type = resp.headers.get("content-type", "")
    filename_hint = _filename_from_disposition(resp.headers.get("content-disposition", ""))
    return bytes(content), content_type, filename_hint

class ImportUrlRequest(BaseModel):
    url: str
    subject: str = ""
    grade_level: str = ""
    scope: str = "private"
    source_name: str = ""
    license: str = ""

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(""),
    grade_level: str = Form(""),
    scope: str = Form("private"),
    source_url: str = Form(""),
    source_name: str = Form(""),
    license: str = Form(""),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Upload and process a PDF or text document for HS Mode context.

    Form fields:
      file        — the document file (.pdf, .txt, or .md)
      subject     — e.g. "Biology", "Algebra II" (optional)
      grade_level — e.g. "Grade 10", "AP" (optional)
      scope       — "private" (default) or "hs_shared" (contributes to global HS curriculum)
      source_url  — original URL if this is admin-seeded content (optional)
      source_name — provenance label (optional)
      license     — license string (optional)

    Returns:
      { success, doc_id, filename, chunk_count, scope, message }
    """
    if scope not in ("private", "hs_shared"):
        raise HTTPException(status_code=400, detail="scope must be 'private' or 'hs_shared'")

    lower_name = (file.filename or "").lower()
    if not lower_name.endswith((".pdf", ".txt", ".md")):
        raise HTTPException(
            status_code=400,
            detail="Only .pdf, .txt, and .md files are supported",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    doc_id = str(uuid.uuid4())
    clean_subject = context_store.canonicalize_subject(subject) if subject else ""
    clean_grade = (grade_level or "").strip()
    clean_source = (source_name or "").strip() or "User upload"
    clean_license = (license or "").strip() or "Unspecified"
    clean_chunk_size = CHUNK_SIZE
    clean_chunk_overlap = CHUNK_OVERLAP
    clean_toc_aware = True

    doc_record = models.ContextDocument(
        user_id=current_user.id,
        doc_id=doc_id,
        filename=(file.filename or "upload")[:255],
        file_type=lower_name.rsplit(".", 1)[-1],
        subject=clean_subject[:100] if clean_subject else "",
        grade_level=clean_grade[:20] if clean_grade else "",
        scope=scope,
        source_url=source_url[:500] if source_url else "",
        source_name=clean_source[:200],
        license=clean_license[:80],
        status="processing",
        chunk_count=0,
    )
    db.add(doc_record)
    db.commit()

    try:
        result = process_upload(
            file_bytes=file_bytes,
            filename=file.filename or "upload",
            subject=clean_subject,
            grade_level=clean_grade,
            scope=scope,
            source_url=source_url,
            chunk_size=clean_chunk_size,
            chunk_overlap=clean_chunk_overlap,
            toc_aware=clean_toc_aware,
        )

        if result.get("error") and not result.get("chunks"):
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(status_code=422, detail=result["error"])

        if not result["chunks"]:
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=422,
                detail="No text could be extracted from the file.",
            )

        if not context_store.available():
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=503,
                detail="Context store unavailable. Please try again later.",
            )

        final_subject = result.get("subject", clean_subject)
        final_grade = result.get("grade_level", clean_grade)

        stored = context_store.add_document_chunks(
            user_id=str(current_user.id),
            doc_id=doc_id,
            filename=file.filename or "upload",
            chunks=result["chunks"],
            subject=final_subject,
            grade_level=final_grade,
            scope=scope,
            source_url=source_url,
            source_name=clean_source,
            license=clean_license,
        )

        doc_record.chunk_count = stored
        doc_record.subject = final_subject[:100] if final_subject else ""
        doc_record.grade_level = final_grade[:20] if final_grade else ""
        doc_record.status = "ready"
        db.commit()

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": file.filename or "upload",
            "chunk_count": stored,
            "scope": scope,
            "message": f"Document processed into {stored} searchable chunks.",
            "subject": final_subject,
            "grade_level": final_grade,
            "detected_subject": result.get("detected_subject", ""),
            "detected_grade": result.get("detected_grade", ""),
            "chapters": result.get("chapters", []),
            "chunk_size": clean_chunk_size,
            "chunk_overlap": clean_chunk_overlap,
            "toc_aware": clean_toc_aware,
            "source_name": clean_source,
            "license": clean_license,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed for doc_id={doc_id}: {e}")
        try:
            doc_record.status = "failed"
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Document processing failed: {e}")

@router.post("/import_url")
def import_document_url(
    payload: ImportUrlRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.scope not in ("private", "hs_shared"):
        raise HTTPException(status_code=400, detail="scope must be 'private' or 'hs_shared'")

    url = (payload.url or "").strip()
    if not url or not _is_safe_url(url):
        raise HTTPException(status_code=400, detail="URL must be http(s) and not a private address")

    clean_subject = context_store.canonicalize_subject(payload.subject) if payload.subject else ""
    clean_grade = (payload.grade_level or "").strip()
    clean_source = (payload.source_name or "").strip() or "URL import"
    clean_license = (payload.license or "").strip() or "Unspecified"
    clean_chunk_size = CHUNK_SIZE
    clean_chunk_overlap = CHUNK_OVERLAP
    clean_toc_aware = True

    file_bytes, content_type, filename_hint = _download_url(url)

    parsed = urlparse(url)
    filename = Path(parsed.path).name or filename_hint or "imported"
    lower_name = filename.lower()
    if not lower_name.endswith((".pdf", ".txt", ".md")):
        if "pdf" in (content_type or "").lower():
            filename = f"{filename}.pdf"
        elif (content_type or "").lower().startswith("text/"):
            filename = f"{filename}.txt"
        else:
            raise HTTPException(status_code=400, detail="URL must point to a .pdf, .txt, or .md file")

    doc_id = str(uuid.uuid4())
    doc_record = models.ContextDocument(
        user_id=current_user.id,
        doc_id=doc_id,
        filename=filename[:255],
        file_type=filename.rsplit(".", 1)[-1].lower(),
        subject=clean_subject[:100] if clean_subject else "",
        grade_level=clean_grade[:20] if clean_grade else "",
        scope=payload.scope,
        source_url=url[:500],
        source_name=clean_source[:200],
        license=clean_license[:80],
        status="processing",
        chunk_count=0,
    )
    db.add(doc_record)
    db.commit()

    try:
        result = process_upload(
            file_bytes=file_bytes,
            filename=filename,
            subject=clean_subject,
            grade_level=clean_grade,
            scope=payload.scope,
            source_url=url,
            chunk_size=clean_chunk_size,
            chunk_overlap=clean_chunk_overlap,
            toc_aware=clean_toc_aware,
        )

        if result.get("error") and not result.get("chunks"):
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(status_code=422, detail=result["error"])

        if not result["chunks"]:
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(status_code=422, detail="No text could be extracted from the URL.")

        if not context_store.available():
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(status_code=503, detail="Context store unavailable. Please try again later.")

        final_subject = result.get("subject", clean_subject)
        final_grade = result.get("grade_level", clean_grade)

        stored = context_store.add_document_chunks(
            user_id=str(current_user.id),
            doc_id=doc_id,
            filename=filename,
            chunks=result["chunks"],
            subject=final_subject,
            grade_level=final_grade,
            scope=payload.scope,
            source_url=url,
            source_name=clean_source,
            license=clean_license,
        )

        doc_record.chunk_count = stored
        doc_record.subject = final_subject[:100] if final_subject else ""
        doc_record.grade_level = final_grade[:20] if final_grade else ""
        doc_record.status = "ready"
        db.commit()

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": filename,
            "chunk_count": stored,
            "scope": payload.scope,
            "message": f"Document processed into {stored} searchable chunks.",
            "subject": final_subject,
            "grade_level": final_grade,
            "detected_subject": result.get("detected_subject", ""),
            "detected_grade": result.get("detected_grade", ""),
            "chapters": result.get("chapters", []),
            "chunk_size": clean_chunk_size,
            "chunk_overlap": clean_chunk_overlap,
            "toc_aware": clean_toc_aware,
            "source_name": clean_source,
            "license": clean_license,
            "source_url": url,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"URL import failed for doc_id={doc_id}: {e}")
        try:
            doc_record.status = "failed"
            db.commit()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"URL import failed: {e}")

@router.get("/documents")
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List user's uploaded documents and the HS curriculum summary.

    Returns:
    {
        "user_docs": [
            {
                "doc_id", "filename", "subject", "grade_level",
                "scope", "chunk_count", "status", "created_at"
            }, ...
        ],
        "hs_summary": {
            "total_subjects": int,
            "subjects": [{"subject", "grade_level", "doc_count"}, ...]
        },
        "hs_mode_available": bool
    }
    """
    user_docs_db = (
        db.query(models.ContextDocument)
        .filter(models.ContextDocument.user_id == current_user.id)
        .order_by(models.ContextDocument.created_at.desc())
        .all()
    )

    user_docs = [
        {
            "doc_id":      d.doc_id,
            "filename":    d.filename,
            "subject":     d.subject or "",
            "grade_level": d.grade_level or "",
            "scope":       d.scope,
            "chunk_count": d.chunk_count,
            "status":      d.status,
            "source_url":  d.source_url or "",
            "source_name": d.source_name or "",
            "license":     d.license or "",
            "created_at":  d.created_at.isoformat() + "Z" if d.created_at else "",
        }
        for d in user_docs_db
    ]

    hs_subjects = []
    try:
        hs_subjects = context_store.list_hs_subjects()
    except Exception as e:
        logger.warning(f"list_hs_subjects failed: {e}")

    hs_total_docs = 0
    hs_last_updated = ""
    try:
        hs_total_docs, hs_last_updated_dt = (
            db.query(
                func.count(models.ContextDocument.id),
                func.max(models.ContextDocument.updated_at),
            )
            .filter(models.ContextDocument.scope == "hs_shared")
            .one()
        )
        hs_last_updated = hs_last_updated_dt.isoformat() + "Z" if hs_last_updated_dt else ""
    except Exception as e:
        logger.warning(f"hs_stats failed: {e}")

    return {
        "user_docs": user_docs,
        "hs_summary": {
            "total_subjects": len(hs_subjects),
            "total_docs": hs_total_docs,
            "last_updated": hs_last_updated,
            "subjects": hs_subjects,
        },
        "hs_mode_available": context_store.available(),
    }

@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Delete a document by doc_id.

    Regular users can delete their own documents.
    Admins (is_admin=True or role="admin") can also remove the doc from hs_curriculum.

    Returns: { success: True, doc_id: str }
    """
    doc = (
        db.query(models.ContextDocument)
        .filter(models.ContextDocument.doc_id == doc_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    is_admin = (
        getattr(current_user, "is_admin", False)
        or getattr(current_user, "role", "") == "admin"
    )

    if doc.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own documents")

    try:
        context_store.delete_document(
            user_id=str(doc.user_id),
            doc_id=doc_id,
            is_admin=is_admin,
        )
    except Exception as e:
        logger.warning(f"ChromaDB delete failed for doc {doc_id}: {e}")

    db.delete(doc)
    db.commit()

    return {"success": True, "doc_id": doc_id}

@router.get("/search")
def search_context_endpoint(
    query: str = Query(..., min_length=2, description="Search query"),
    use_hs: bool = Query(True, description="Include shared HS curriculum in results"),
    subject: str = Query("", description="Optional HS subject filter (e.g., Biology)"),
    grade_level: str = Query("", description="Optional grade level filter (e.g., 9-12, AP)"),
    top_k: int = Query(5, ge=1, le=20, description="Number of results to return"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Test RAG retrieval for a query. Useful for verifying documents were indexed correctly.

    Returns:
    {
        "query": str,
        "results": [{"text": str, "metadata": dict, "source": "private"|"hs"}],
        "chunk_count": int
    }
    """
    try:
        results = context_store.search_context(
            query=query,
            user_id=str(current_user.id),
            use_hs=use_hs,
            top_k=top_k,
            subject=subject or None,
            grade_level=grade_level or None,
        )
        cleaned = [
            {"text": r["text"], "metadata": r["metadata"], "source": r["source"]}
            for r in results
        ]
        return {"query": query, "results": cleaned, "chunk_count": len(cleaned)}
    except Exception as e:
        logger.error(f"context search endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/related-topics")
def related_topics_endpoint(
    payload: RelatedTopicsRequest,
    current_user: models.User = Depends(get_current_user),
):
    topics = [t.strip() for t in (payload.topics or []) if t and t.strip()]
    if not topics:
        return {"topics": [], "seed_topics": [], "source_counts": {}}
    if not context_store.available():
        return {"topics": [], "seed_topics": topics, "source_counts": {}}

    topics = topics[:6]
    top_k = max(1, min(payload.top_k or 5, 10))
    max_related = max(1, min(payload.max_related or 8, 12))

    results = []
    seen = set()
    for topic in topics:
        try:
            search_results = context_store.search_context(
                query=topic,
                user_id=str(current_user.id),
                use_hs=payload.use_hs,
                top_k=top_k,
            )
        except Exception as e:
            logger.warning(f"related-topics context search failed: {e}")
            search_results = []

        for res in search_results:
            meta = res.get("metadata") or {}
            key = f"{meta.get('doc_id', '')}:{meta.get('chunk_index', '')}:{res.get('source', '')}"
            if key in seen:
                continue
            seen.add(key)
            results.append(res)

    candidate_counts: dict[str, int] = {}
    candidate_sources: dict[str, set[str]] = {}
    snippets: list[str] = []
    for res in results:
        topic = _extract_topic_from_result(res)
        if topic:
            key = topic.lower()
            candidate_counts[key] = candidate_counts.get(key, 0) + 1
            candidate_sources.setdefault(key, set()).add(res.get("source", ""))

        text = (res.get("text") or "").strip()
        if text and len(snippets) < 12:
            cleaned = re.sub(r"\s+", " ", text).strip()
            if cleaned:
                snippets.append(cleaned[:240])

    seed_set = {t.lower() for t in topics}
    sorted_candidates = sorted(candidate_counts.items(), key=lambda item: item[1], reverse=True)
    candidate_list = [f"{topic} ({count})" for topic, count in sorted_candidates[:20]]
    candidate_str = ", ".join(candidate_list) if candidate_list else "none"

    prompt = (
        "You are a study assistant. Return related study topics based on the user's context.\n"
        "Output must be valid JSON: {\"topics\": [\"Topic 1\", \"Topic 2\", ...]}.\n"
        "Rules:\n"
        "- 2-4 words per topic\n"
        "- Avoid repeating seed topics\n"
        "- Prefer concrete academic topics, not generic actions\n\n"
        f"Seed topics: {', '.join(topics)}\n"
        f"Candidate topics from context: {candidate_str}\n"
        "Context snippets:\n"
        + "\n".join([f"- {s}" for s in snippets[:10]])
    )

    ai_topics = []
    try:
        raw = call_ai(prompt, max_tokens=200, temperature=0.3)
        ai_topics = _parse_ai_topics(raw)
    except Exception as e:
        logger.warning(f"related-topics AI call failed: {e}")

    cleaned_ai = []
    seen_ai = set()
    for topic in ai_topics:
        cleaned = _clean_topic_text(topic)
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seed_set or key in seen_ai:
            continue
        seen_ai.add(key)
        cleaned_ai.append(_title_case_topic(cleaned))
        if len(cleaned_ai) >= max_related:
            break

    if not cleaned_ai:
        for topic, _ in sorted_candidates:
            if topic in seed_set:
                continue
            cleaned_ai.append(_title_case_topic(topic))
            if len(cleaned_ai) >= max_related:
                break

    source_counts = {}
    for sources in candidate_sources.values():
        for src in sources:
            source_counts[src] = source_counts.get(src, 0) + 1

    return {
        "topics": cleaned_ai,
        "seed_topics": topics,
        "source_counts": source_counts,
    }

@router.get("/hs/subjects")
def get_hs_subjects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return all subject areas available in the shared hs_curriculum ChromaDB collection.

    Returns:
    {
        "subjects": [{"subject": str, "grade_level": str, "doc_count": int}],
        "total": int
    }
    """
    try:
        subjects = context_store.list_hs_subjects()
        return {"subjects": subjects, "total": len(subjects)}
    except Exception as e:
        logger.warning(f"get_hs_subjects failed: {e}")
        return {"subjects": [], "total": 0}
