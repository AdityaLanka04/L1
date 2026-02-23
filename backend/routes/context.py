"""
routes/context.py — Cerbyl HS Mode document management API.

Endpoints:
  POST   /api/context/upload                    — upload a document (PDF/TXT/MD)
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

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

import models
import context_store
from deps import get_db, get_current_user
from document_processor import process_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/context", tags=["context"])

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(""),
    grade_level: str = Form(""),
    scope: str = Form("private"),
    source_url: str = Form(""),
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

    Returns:
      { success, doc_id, filename, chunk_count, scope, message }
    """
    # Validate scope
    if scope not in ("private", "hs_shared"):
        raise HTTPException(status_code=400, detail="scope must be 'private' or 'hs_shared'")

    # Validate file extension
    lower_name = (file.filename or "").lower()
    if not lower_name.endswith((".pdf", ".txt", ".md")):
        raise HTTPException(
            status_code=400,
            detail="Only .pdf, .txt, and .md files are supported",
        )

    # Read file and check size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    doc_id = str(uuid.uuid4())
    clean_subject = context_store.canonicalize_subject(subject) if subject else ""
    clean_grade = (grade_level or "").strip()

    # Create DB record (status="processing")
    doc_record = models.ContextDocument(
        user_id=current_user.id,
        doc_id=doc_id,
        filename=(file.filename or "upload")[:255],
        file_type=lower_name.rsplit(".", 1)[-1],
        subject=clean_subject[:100] if clean_subject else "",
        grade_level=clean_grade[:20] if clean_grade else "",
        scope=scope,
        source_url=source_url[:500] if source_url else "",
        status="processing",
        chunk_count=0,
    )
    db.add(doc_record)
    db.commit()

    # Process document
    try:
        result = process_upload(
            file_bytes=file_bytes,
            filename=file.filename or "upload",
            subject=clean_subject,
            grade_level=clean_grade,
            scope=scope,
            source_url=source_url,
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

        # Store in ChromaDB
        if not context_store.available():
            doc_record.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=503,
                detail="Context store unavailable. Please try again later.",
            )

        stored = context_store.add_document_chunks(
            user_id=str(current_user.id),
            doc_id=doc_id,
            filename=file.filename or "upload",
            chunks=result["chunks"],
            subject=clean_subject,
            grade_level=clean_grade,
            scope=scope,
            source_url=source_url,
        )

        doc_record.chunk_count = stored
        doc_record.status = "ready"
        db.commit()

        return {
            "success": True,
            "doc_id": doc_id,
            "filename": file.filename or "upload",
            "chunk_count": stored,
            "scope": scope,
            "message": f"Document processed into {stored} searchable chunks.",
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


# ── List documents ────────────────────────────────────────────────────────────

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
    # User documents from SQLite (authoritative source for status/chunk_count)
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
            "created_at":  d.created_at.isoformat() + "Z" if d.created_at else "",
        }
        for d in user_docs_db
    ]

    # HS curriculum summary from ChromaDB
    hs_subjects = []
    try:
        hs_subjects = context_store.list_hs_subjects()
    except Exception as e:
        logger.warning(f"list_hs_subjects failed: {e}")

    return {
        "user_docs": user_docs,
        "hs_summary": {
            "total_subjects": len(hs_subjects),
            "subjects": hs_subjects,
        },
        "hs_mode_available": context_store.available(),
    }


# ── Delete ────────────────────────────────────────────────────────────────────

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

    # Delete from ChromaDB
    try:
        context_store.delete_document(
            user_id=str(doc.user_id),
            doc_id=doc_id,
            is_admin=is_admin,
        )
    except Exception as e:
        logger.warning(f"ChromaDB delete failed for doc {doc_id}: {e}")

    # Delete from SQLite
    db.delete(doc)
    db.commit()

    return {"success": True, "doc_id": doc_id}


# ── Search (test RAG retrieval) ───────────────────────────────────────────────

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
        # Strip internal distance metric from response
        cleaned = [
            {"text": r["text"], "metadata": r["metadata"], "source": r["source"]}
            for r in results
        ]
        return {"query": query, "results": cleaned, "chunk_count": len(cleaned)}
    except Exception as e:
        logger.error(f"context search endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── HS Subjects ───────────────────────────────────────────────────────────────

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
