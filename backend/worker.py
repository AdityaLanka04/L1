from __future__ import annotations

import logging
import os
import signal
import time
import asyncio
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from database import SessionLocal
import models
from services.ai_job_queue import (
    AIJobQueueUnavailable,
    dead_letter_ai_job,
    dequeue_ai_job,
    enqueue_ai_job,
    get_queue_name,
    promote_due_retry_jobs,
    schedule_retry_ai_job,
)
from services.ai_semantic_cache import get_semantic_cache, set_semantic_cache
from services.storage_service import StorageService

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(levelname)s: %(message)s")
logger = logging.getLogger("ai_worker")

_running = True


def _shutdown(signum, frame) -> None:
    global _running
    _running = False
    logger.info("Stopping AI worker after signal %s", signum)


signal.signal(signal.SIGINT, _shutdown)
signal.signal(signal.SIGTERM, _shutdown)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _max_attempts() -> int:
    return int(os.getenv("AI_JOB_MAX_ATTEMPTS", "3"))


def _base_retry_delay_seconds() -> int:
    return int(os.getenv("AI_JOB_RETRY_BASE_DELAY_SECONDS", "10"))


def _max_retry_delay_seconds() -> int:
    return int(os.getenv("AI_JOB_RETRY_MAX_DELAY_SECONDS", "300"))


def _retry_delay_seconds(attempts: int, error: Exception) -> int:
    message = str(error).lower()
    base = _base_retry_delay_seconds()
    if any(token in message for token in ("429", "rate limit", "quota", "too many requests")):
        base = max(base, int(os.getenv("AI_JOB_RATE_LIMIT_RETRY_DELAY_SECONDS", "60")))
    return min(_max_retry_delay_seconds(), base * max(1, 2 ** max(0, attempts - 1)))


def _is_retryable_error(error: Exception) -> bool:
    message = str(error).lower()
    retryable_tokens = (
        "429",
        "rate limit",
        "too many requests",
        "quota",
        "timeout",
        "timed out",
        "temporarily unavailable",
        "connection reset",
        "connection aborted",
        "service unavailable",
        "bad gateway",
        "gateway timeout",
    )
    return any(token in message for token in retryable_tokens)


@contextmanager
def _job_timeout(seconds: int | None):
    if not seconds or seconds <= 0 or not hasattr(signal, "SIGALRM"):
        yield
        return

    def _raise_timeout(signum, frame):
        raise TimeoutError(f"AI job exceeded timeout of {seconds}s")

    previous_handler = signal.getsignal(signal.SIGALRM)
    signal.signal(signal.SIGALRM, _raise_timeout)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous_handler)


def _process_chat_completion(job: models.AIJob, payload: dict[str, Any], db) -> dict[str, Any]:
    prompt = (payload.get("prompt") or payload.get("question") or "").strip()
    if not prompt:
        raise ValueError("AI job prompt is required")

    cache_scope = payload.get("cache_scope")
    use_semantic_cache = bool(payload.get("use_semantic_cache", True))
    has_session_context = bool(
        payload.get("chat_session_id")
        or payload.get("context_doc_ids")
        or payload.get("tutor_mode")
    )
    can_use_semantic_cache = use_semantic_cache and not has_session_context

    if can_use_semantic_cache:
        hit = get_semantic_cache(
            prompt,
            user_id=job.user_id,
            job_type=job.job_type,
            cache_scope=cache_scope,
        )
        if hit:
            job.progress_percent = 95
            job.progress_message = "Serving cached response"
            db.commit()
            return {
                "answer": hit.response,
                "cache_status": "semantic_hit",
                "cached": True,
                "cache_metadata": hit.metadata,
            }

    user = db.query(models.User).filter(models.User.id == job.user_id).first()
    if not user:
        raise ValueError(f"User {job.user_id} not found")

    from routes.chat import ask_simple

    job.progress_percent = 35
    job.progress_message = "Calling AI provider"
    db.commit()

    chat_result = asyncio.run(
        ask_simple(
            user_id=user.username or user.email or str(user.id),
            question=prompt,
            original_question=payload.get("user_message") or prompt,
            chat_id=str(payload["chat_session_id"]) if payload.get("chat_session_id") else None,
            use_hs_context=bool(payload.get("use_hs_context", True)),
            context_doc_ids=payload.get("context_doc_ids"),
            tutor_mode=bool(payload.get("tutor_mode", False)),
            tutor_reply_style=payload.get("tutor_reply_style") or "guided",
            tutor_choice=payload.get("tutor_choice"),
            db=db,
            current_user=user,
        )
    )
    response = chat_result.get("answer") or ""

    if can_use_semantic_cache:
        set_semantic_cache(
            prompt,
            response,
            user_id=job.user_id,
            job_type=job.job_type,
            cache_scope=cache_scope,
        )

    return {
        **chat_result,
        "answer": response,
        "cache_status": "miss",
        "cached": False,
    }


def _persist_chat_message(db, job: models.AIJob, payload: dict[str, Any], result: dict[str, Any]) -> None:
    chat_session_id = payload.get("chat_session_id")
    if not chat_session_id:
        return

    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == int(chat_session_id),
            models.ChatSession.user_id == job.user_id,
        )
        .first()
    )
    if not session:
        logger.warning("AI job %s skipped chat persistence; session not found", job.id)
        return

    db.add(
        models.ChatMessage(
            chat_session_id=session.id,
            user_id=job.user_id,
            user_message=payload.get("user_message") or payload.get("prompt") or "",
            ai_response=result.get("answer") or "",
            timestamp=_now(),
        )
    )
    session.updated_at = _now()


def _process_legacy_route(payload: dict[str, Any]) -> dict[str, Any]:
    from fastapi.testclient import TestClient
    from deps import create_access_token
    from main import app

    method = (payload.get("method") or "POST").upper()
    path = payload.get("path") or ""
    body_type = payload.get("body_type") or "json"
    auth_subject = payload.get("auth_subject")
    if not auth_subject:
        raise ValueError("Legacy AI route job auth_subject is required")

    token = create_access_token({"sub": auth_subject})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)

    if method == "GET":
        response = client.get(path, headers=headers)
    elif body_type == "form":
        response = client.post(path, data=payload.get("form_body") or {}, headers=headers)
    else:
        response = client.post(path, json=payload.get("json_body") or {}, headers=headers)

    if response.status_code >= 400:
        raise RuntimeError(f"Legacy AI route failed: {response.status_code} {response.text[:500]}")

    try:
        result = response.json()
    except Exception:
        result = {"text": response.text}
    return {
        "route_status_code": response.status_code,
        "route_result": result,
        "answer": result.get("answer") if isinstance(result, dict) else None,
    }


def _process_legacy_file_route(payload: dict[str, Any]) -> dict[str, Any]:
    from fastapi.testclient import TestClient
    from deps import create_access_token
    from main import app

    path = payload.get("path") or ""
    auth_subject = payload.get("auth_subject")
    if not auth_subject:
        raise ValueError("Legacy file AI route job auth_subject is required")

    token = create_access_token({"sub": auth_subject})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)
    opened_files = []
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            files = []
            for file_info in payload.get("files") or []:
                source_path = file_info["path"]
                parsed = urlparse(source_path or "")
                if parsed.scheme in {"s3", "r2"}:
                    local_path = Path(temp_dir) / (file_info.get("filename") or Path(parsed.path).name or "upload")
                    StorageService.get_storage().download_file(parsed.path.lstrip("/"), local_path)
                    source_path = str(local_path)
                handle = open(source_path, "rb")
                opened_files.append(handle)
                files.append(
                    (
                        file_info.get("field_name") or "files",
                        (
                            file_info.get("filename") or "upload",
                            handle,
                            file_info.get("content_type") or "application/octet-stream",
                        ),
                    )
                )

            response = client.post(
                path,
                data=payload.get("form_body") or {},
                files=files,
                headers=headers,
            )
    finally:
        for handle in opened_files:
            handle.close()

    if response.status_code >= 400:
        raise RuntimeError(f"Legacy file AI route failed: {response.status_code} {response.text[:500]}")

    try:
        result = response.json()
    except Exception:
        result = {"text": response.text}
    return {
        "route_status_code": response.status_code,
        "route_result": result,
        "answer": result.get("answer") if isinstance(result, dict) else None,
    }


def process_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.query(models.AIJob).filter(models.AIJob.id == job_id).first()
        if not job:
            logger.warning("AI job %s not found", job_id)
            return
        if job.status in {"completed", "cancelled"}:
            logger.info("AI job %s already %s; skipping", job.id, job.status)
            return
        retry_after = _as_aware_utc(job.retry_after)
        if job.status == "retrying" and retry_after and retry_after > _now():
            schedule_retry_ai_job(job.id, run_at=retry_after.timestamp())
            logger.info("AI job %s not ready for retry until %s", job.id, retry_after)
            return

        job.status = "running"
        job.started_at = job.started_at or _now()
        job.updated_at = _now()
        job.attempts = (job.attempts or 0) + 1
        job.progress_percent = max(job.progress_percent or 0, 10)
        job.progress_message = f"Running attempt {job.attempts} of {_max_attempts()}"
        db.commit()

        payload = job.input_json or {}
        with _job_timeout(job.timeout_seconds):
            if job.job_type == "chat_completion":
                result = _process_chat_completion(job, payload, db)
                if result.get("cached"):
                    _persist_chat_message(db, job, payload, result)
            elif job.job_type == "legacy_route":
                job.progress_percent = 35
                job.progress_message = "Executing queued AI route"
                db.commit()
                result = _process_legacy_route(payload)
            elif job.job_type == "legacy_file_route":
                job.progress_percent = 35
                job.progress_message = "Executing queued AI file route"
                db.commit()
                result = _process_legacy_file_route(payload)
            else:
                raise ValueError(f"Unsupported AI job type: {job.job_type}")

        job.status = "completed"
        job.result_json = result
        job.cache_status = result.get("cache_status")
        job.error = None
        job.progress_percent = 100
        job.progress_message = "Completed"
        job.retry_after = None
        job.completed_at = _now()
        job.updated_at = _now()
        db.commit()
        logger.info("AI job %s completed (%s)", job.id, job.cache_status or "no_cache")

    except Exception as exc:
        logger.exception("AI job %s failed", job_id)
        try:
            job = db.query(models.AIJob).filter(models.AIJob.id == job_id).first()
            if job:
                attempts = job.attempts or 0
                error_message = str(exc)
                job.last_error = error_message
                job.error = error_message
                job.updated_at = _now()
                if attempts < _max_attempts() and _is_retryable_error(exc):
                    delay = _retry_delay_seconds(attempts, exc)
                    retry_at = _now().timestamp() + delay
                    job.status = "retrying"
                    job.retry_after = datetime.fromtimestamp(retry_at, tz=timezone.utc)
                    job.progress_percent = min(job.progress_percent or 0, 25)
                    job.progress_message = f"Retrying after provider/backoff delay ({delay}s)"
                    job.completed_at = None
                    schedule_retry_ai_job(job.id, run_at=retry_at)
                    logger.warning("AI job %s scheduled for retry %s/%s in %ss", job.id, attempts, _max_attempts(), delay)
                else:
                    job.status = "failed"
                    job.progress_percent = 100
                    job.progress_message = "Failed"
                    job.completed_at = _now()
                    try:
                        dead_letter_ai_job(job.id, error=error_message, attempts=attempts)
                    except Exception:
                        logger.exception("Failed to dead-letter AI job %s", job.id)
                job.updated_at = _now()
                db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to mark AI job %s failed", job_id)
    finally:
        db.close()


def main() -> None:
    logger.info("AI worker started; queue=%s", get_queue_name())
    while _running:
        try:
            promote_due_retry_jobs()
            message = dequeue_ai_job(timeout=5)
        except AIJobQueueUnavailable as exc:
            logger.warning("%s; retrying in 5s", exc)
            time.sleep(5)
            continue
        except Exception as exc:
            logger.exception("AI worker dequeue failed: %s", exc)
            time.sleep(2)
            continue

        if not message:
            continue
        process_job(message.job_id)

    logger.info("AI worker stopped")


if __name__ == "__main__":
    main()
