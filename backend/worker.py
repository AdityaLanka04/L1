from __future__ import annotations

import logging
import os
import signal
import time
import asyncio
from datetime import datetime, timezone
from typing import Any

from database import SessionLocal
import models
from services.ai_job_queue import AIJobQueueUnavailable, dequeue_ai_job, get_queue_name
from services.ai_semantic_cache import get_semantic_cache, set_semantic_cache

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
        files = []
        for file_info in payload.get("files") or []:
            handle = open(file_info["path"], "rb")
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

        job.status = "running"
        job.started_at = job.started_at or _now()
        job.updated_at = _now()
        job.attempts = (job.attempts or 0) + 1
        db.commit()

        payload = job.input_json or {}
        if job.job_type == "chat_completion":
            result = _process_chat_completion(job, payload, db)
            if result.get("cached"):
                _persist_chat_message(db, job, payload, result)
        elif job.job_type == "legacy_route":
            result = _process_legacy_route(payload)
        elif job.job_type == "legacy_file_route":
            result = _process_legacy_file_route(payload)
        else:
            raise ValueError(f"Unsupported AI job type: {job.job_type}")

        job.status = "completed"
        job.result_json = result
        job.cache_status = result.get("cache_status")
        job.completed_at = _now()
        job.updated_at = _now()
        db.commit()
        logger.info("AI job %s completed (%s)", job.id, job.cache_status or "no_cache")

    except Exception as exc:
        logger.exception("AI job %s failed", job_id)
        try:
            job = db.query(models.AIJob).filter(models.AIJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error = str(exc)
                job.completed_at = _now()
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
