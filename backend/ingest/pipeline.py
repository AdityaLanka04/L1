"""
pipeline.py — Orchestrates overnight curriculum ingestion.

Flow for each catalog entry:
  1. Skip if already ingested (resume mode via state.json)
  2. downloader.resolve_entry() → PDF bytes
  3. document_processor.process_upload() → chunks + page info
  4. context_store.add_document_chunks() → stored in hs_curriculum
  5. DB: upsert ContextDocument record
  6. Every VERIFY_EVERY docs: spot_check_batch() on recent batch

State is persisted to ingest/state.json after each successful doc,
enabling --resume to skip already-ingested entries.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import context_store
import document_processor
import redis_cache
import vector_store
from database import SessionLocal, engine, Base

logger = logging.getLogger(__name__)

STATE_FILE = os.path.join(os.path.dirname(__file__), "state.json")
VERIFY_EVERY = 5
SYSTEM_USER_EMAIL = "system@brainwave.internal"
SYSTEM_USERNAME = "system"


@dataclass
class IngestResult:
    doc_id: str
    slug: str
    title: str
    subject: str
    curriculum: str
    success: bool
    chunk_count: int = 0
    resolved_url: str = ""
    duration_s: float = 0.0
    error: str = ""


@dataclass
class RunStats:
    total: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0
    spot_checks_run: int = 0
    spot_checks_passed: int = 0
    spot_checks_failed: int = 0
    results: list[IngestResult] = field(default_factory=list)


def _load_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_state(state: dict) -> None:
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.warning(f"Failed to save state: {e}")


def _get_or_create_system_user(db) -> int:
    """Return the user_id of the system ingest user, creating it if needed."""
    from models import User
    import hashlib

    user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
    if user:
        return user.id

    locked_hash = "!" + hashlib.sha256(b"system_locked_account").hexdigest()
    user = User(
        first_name="System",
        last_name="Ingest",
        email=SYSTEM_USER_EMAIL,
        username=SYSTEM_USERNAME,
        hashed_password=locked_hash,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"Created system ingest user with id={user.id}")
    return user.id


def _upsert_context_document(
    db,
    user_id: int,
    doc_id: str,
    entry: dict,
    chunk_count: int,
    resolved_url: str,
) -> None:
    from models import ContextDocument

    existing = db.query(ContextDocument).filter(ContextDocument.doc_id == doc_id).first()
    if existing:
        existing.chunk_count = chunk_count
        existing.status = "ready"
        existing.curriculum = entry.get("curriculum", existing.curriculum or "")
        existing.source_type = entry.get("source_type", existing.source_type or "")
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        return

    doc = ContextDocument(
        user_id=user_id,
        doc_id=doc_id,
        filename=entry["title"] + ".pdf",
        file_type="pdf",
        subject=entry.get("subject", ""),
        grade_level=entry.get("grade_level", ""),
        scope="hs_shared",
        chunk_count=chunk_count,
        status="ready",
        source_url=resolved_url[:500] if resolved_url else "",
        source_name=entry.get("source_name", ""),
        license=entry.get("license", ""),
        curriculum=entry.get("curriculum", ""),
        source_type=entry.get("source_type", ""),
    )
    db.add(doc)
    db.commit()


class IngestPipeline:
    def __init__(self, dry_run: bool = False, resume: bool = True):
        self.dry_run = dry_run
        self.resume = resume
        self._system_user_id: Optional[int] = None
        self._state: dict = {}

    def setup(self) -> None:
        """Initialize vector_store (pgvector) + embedding model, context_store, and DB."""
        logger.info("Initializing vector_store + embedding model...")
        try:
            from sentence_transformers import SentenceTransformer
            try:
                _em = SentenceTransformer("BAAI/bge-small-en-v1.5")
            except Exception:
                _em = SentenceTransformer("all-MiniLM-L6-v2")
            vector_store.initialize(_em)
        except Exception as e:
            raise RuntimeError(f"vector_store init failed: {e}") from e
        if not vector_store.available():
            raise RuntimeError("vector_store failed to initialize — check DATABASE_URL and sentence-transformers")
        logger.info("vector_store (pgvector) initialized.")

        try:
            redis_cache.init_redis()
        except Exception:
            logger.info("Redis not available — using in-memory cache fallback.")

        if self.resume:
            self._state = _load_state()
            already = len([k for k, v in self._state.items() if v.get("success")])
            logger.info(f"Loaded state: {already} previously ingested docs will be skipped.")

    def _get_system_user_id(self, db) -> int:
        if self._system_user_id is None:
            self._system_user_id = _get_or_create_system_user(db)
        return self._system_user_id

    def ingest_one(self, entry: dict, db) -> IngestResult:
        """Download, process, and store one catalog entry."""
        from ingest.downloader import resolve_entry, DownloadError

        slug = entry.get("slug", entry.get("title", "unknown"))
        title = entry.get("title", slug)
        subject = entry.get("subject", "")
        curriculum = entry.get("curriculum", "")
        source_type = entry.get("source_type", "direct")

        # Deterministic doc_id from slug so re-runs with replace_existing work cleanly
        doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"brainwave_ingest:{slug}"))

        start = time.time()
        result = IngestResult(
            doc_id=doc_id,
            slug=slug,
            title=title,
            subject=subject,
            curriculum=curriculum,
            success=False,
        )

        if self.dry_run:
            logger.info(f"  [DRY RUN] Would ingest: {title} ({slug})")
            result.success = True
            result.duration_s = 0.0
            return result

        try:
            logger.info(f"  Downloading: {title}")
            pdf_bytes, resolved_url = resolve_entry(entry)
            result.resolved_url = resolved_url
            logger.info(f"  Downloaded {len(pdf_bytes) / 1024:.0f} KB from {resolved_url}")
        except DownloadError as e:
            result.error = f"Download failed: {e}"
            result.duration_s = time.time() - start
            return result

        try:
            logger.info(f"  Processing: {title}")
            proc = document_processor.process_upload(
                file_bytes=pdf_bytes,
                filename=entry["title"] + ".pdf",
                subject=subject,
                grade_level=entry.get("grade_level", ""),
                scope="hs_shared",
                source_url=resolved_url,
            )
            if proc.get("error"):
                result.error = f"Processing failed: {proc['error']}"
                result.duration_s = time.time() - start
                return result

            chunks = proc["chunks"]
            chunk_pages = proc.get("chunk_pages", [])
            if not chunks:
                result.error = "No chunks extracted from document"
                result.duration_s = time.time() - start
                return result

            logger.info(f"  Extracted {len(chunks)} chunks from {proc.get('pdf_page_count', '?')} pages")
        except Exception as e:
            result.error = f"document_processor error: {e}"
            result.duration_s = time.time() - start
            return result

        try:
            logger.info(f"  Embedding + storing: {title}")
            stored = context_store.add_document_chunks(
                user_id=str(self._get_system_user_id(db)),
                doc_id=doc_id,
                filename=entry["title"] + ".pdf",
                chunks=chunks,
                subject=subject,
                grade_level=entry.get("grade_level", ""),
                scope="hs_shared",
                source_url=resolved_url,
                source_name=entry.get("source_name", ""),
                license=entry.get("license", ""),
                replace_existing=True,
                chunk_pages=chunk_pages if chunk_pages else None,
                curriculum=curriculum,
                source_type=source_type,
            )
            result.chunk_count = stored
            logger.info(f"  Stored {stored} chunks for {title}")
        except Exception as e:
            result.error = f"context_store.add_document_chunks error: {e}"
            result.duration_s = time.time() - start
            return result

        try:
            _upsert_context_document(
                db=db,
                user_id=self._get_system_user_id(db),
                doc_id=doc_id,
                entry=entry,
                chunk_count=result.chunk_count,
                resolved_url=resolved_url,
            )
        except Exception as e:
            logger.warning(f"  DB record failed (non-fatal): {e}")

        result.success = True
        result.duration_s = time.time() - start
        return result

    def run(self, catalog: list[dict]) -> RunStats:
        """
        Run the full ingestion pipeline over a catalog.
        Returns RunStats with all results.
        """
        from ingest import verify

        stats = RunStats(total=len(catalog))
        recent_batch: list[dict] = []
        db = SessionLocal()

        try:
            for i, entry in enumerate(catalog, 1):
                slug = entry.get("slug", entry.get("title", "unknown"))
                title = entry.get("title", slug)
                total_label = f"[{i}/{stats.total}]"

                # Resume: skip already-ingested
                if self.resume and self._state.get(slug, {}).get("success"):
                    logger.info(f"{total_label} Skipping (already ingested): {title}")
                    stats.skipped += 1
                    continue

                logger.info(f"{total_label} Ingesting: {title}")
                result = self.ingest_one(entry, db)
                stats.results.append(result)

                if result.success:
                    stats.succeeded += 1
                    logger.info(
                        f"{total_label} OK: {title} — "
                        f"{result.chunk_count} chunks in {result.duration_s:.1f}s"
                    )
                    if not self.dry_run:
                        self._state[slug] = {
                            "success": True,
                            "doc_id": result.doc_id,
                            "chunk_count": result.chunk_count,
                            "ingested_at": datetime.now(timezone.utc).isoformat(),
                        }
                        _save_state(self._state)

                    recent_batch.append({
                        "doc_id": result.doc_id,
                        "title": result.title,
                        "subject": result.subject,
                        "curriculum": result.curriculum,
                    })
                else:
                    stats.failed += 1
                    logger.error(f"{total_label} FAILED: {title} — {result.error}")
                    if not self.dry_run:
                        self._state[slug] = {
                            "success": False,
                            "error": result.error,
                            "attempted_at": datetime.now(timezone.utc).isoformat(),
                        }
                        _save_state(self._state)

                # Spot-check every VERIFY_EVERY successful docs
                if len(recent_batch) >= VERIFY_EVERY:
                    logger.info(f"\n--- Spot-checking batch of {len(recent_batch)} docs ---")
                    check_results = verify.spot_check_batch(recent_batch, sample_rate=0.4, min_checks=2)
                    stats.spot_checks_run += len(check_results)
                    for cr in check_results:
                        if cr.passed:
                            stats.spot_checks_passed += 1
                        elif not cr.skipped:
                            stats.spot_checks_failed += 1
                    recent_batch = []

        finally:
            db.close()

        # Final spot-check on remaining batch
        if recent_batch:
            logger.info(f"\n--- Final spot-check on remaining {len(recent_batch)} docs ---")
            check_results = verify.spot_check_batch(recent_batch, sample_rate=0.5, min_checks=1)
            stats.spot_checks_run += len(check_results)
            for cr in check_results:
                if cr.passed:
                    stats.spot_checks_passed += 1
                elif not cr.skipped:
                    stats.spot_checks_failed += 1

        return stats
