from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_NAME = "bw:ai_jobs:default"
DEFAULT_RETRY_QUEUE_SUFFIX = ":retry"
DEFAULT_DEAD_LETTER_SUFFIX = ":dead"


class AIJobQueueUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class QueueMessage:
    job_id: int
    queued_at: float


def get_redis_url() -> str:
    url = os.getenv("REDIS_URL")
    if url:
        return url

    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    db = int(os.getenv("REDIS_DB", "0"))
    password = os.getenv("REDIS_PASSWORD")
    auth = f":{password}@" if password else ""
    return f"redis://{auth}{host}:{port}/{db}"


def get_queue_name() -> str:
    return os.getenv("AI_JOB_QUEUE_NAME", DEFAULT_QUEUE_NAME)


def get_retry_queue_name() -> str:
    return os.getenv("AI_JOB_RETRY_QUEUE_NAME", f"{get_queue_name()}{DEFAULT_RETRY_QUEUE_SUFFIX}")


def get_dead_letter_queue_name() -> str:
    return os.getenv("AI_JOB_DEAD_LETTER_QUEUE_NAME", f"{get_queue_name()}{DEFAULT_DEAD_LETTER_SUFFIX}")


def get_redis_client():
    try:
        import redis

        socket_timeout = int(os.getenv("AI_JOB_REDIS_SOCKET_TIMEOUT_SECONDS", "30"))
        client = redis.Redis.from_url(
            get_redis_url(),
            socket_connect_timeout=2,
            socket_timeout=socket_timeout,
            decode_responses=True,
        )
        client.ping()
        return client
    except Exception as exc:
        raise AIJobQueueUnavailable(f"Redis queue unavailable: {exc}") from exc


def enqueue_ai_job(job_id: int, *, queue_name: str | None = None) -> str:
    client = get_redis_client()
    redis_job_id = f"ai-job:{job_id}"
    payload = {
        "job_id": job_id,
        "redis_job_id": redis_job_id,
        "queued_at": time.time(),
    }
    client.rpush(queue_name or get_queue_name(), json.dumps(payload))
    return redis_job_id


def schedule_retry_ai_job(
    job_id: int,
    *,
    run_at: float,
    retry_queue_name: str | None = None,
) -> str:
    client = get_redis_client()
    redis_job_id = f"ai-job:{job_id}"
    payload = {
        "job_id": job_id,
        "redis_job_id": redis_job_id,
        "queued_at": time.time(),
        "run_at": run_at,
    }
    client.zadd(retry_queue_name or get_retry_queue_name(), {json.dumps(payload): run_at})
    return redis_job_id


def promote_due_retry_jobs(
    *,
    retry_queue_name: str | None = None,
    queue_name: str | None = None,
    limit: int = 100,
) -> int:
    client = get_redis_client()
    retry_queue = retry_queue_name or get_retry_queue_name()
    ready_items = client.zrangebyscore(retry_queue, min=0, max=time.time(), start=0, num=limit)
    promoted = 0
    for raw_payload in ready_items:
        removed = client.zrem(retry_queue, raw_payload)
        if not removed:
            continue
        try:
            payload: dict[str, Any] = json.loads(raw_payload)
            client.rpush(queue_name or get_queue_name(), json.dumps(payload))
            promoted += 1
        except Exception:
            logger.warning("Discarding malformed AI retry queue payload: %s", raw_payload)
    return promoted


def dead_letter_ai_job(
    job_id: int,
    *,
    error: str,
    attempts: int,
    queue_name: str | None = None,
) -> str:
    client = get_redis_client()
    redis_job_id = f"ai-job:{job_id}"
    payload = {
        "job_id": job_id,
        "redis_job_id": redis_job_id,
        "error": error,
        "attempts": attempts,
        "failed_at": time.time(),
    }
    client.rpush(queue_name or get_dead_letter_queue_name(), json.dumps(payload))
    return redis_job_id


def dequeue_ai_job(
    *,
    queue_name: str | None = None,
    timeout: int = 5,
) -> QueueMessage | None:
    client = get_redis_client()
    item = client.blpop(queue_name or get_queue_name(), timeout=timeout)
    if not item:
        return None

    _, raw_payload = item
    try:
        payload: dict[str, Any] = json.loads(raw_payload)
        return QueueMessage(
            job_id=int(payload["job_id"]),
            queued_at=float(payload.get("queued_at") or time.time()),
        )
    except Exception:
        logger.warning("Discarding malformed AI job queue payload: %s", raw_payload)
        return None


def queue_depth(*, queue_name: str | None = None) -> int:
    client = get_redis_client()
    return int(client.llen(queue_name or get_queue_name()))


def retry_queue_depth(*, queue_name: str | None = None) -> int:
    client = get_redis_client()
    return int(client.zcard(queue_name or get_retry_queue_name()))


def dead_letter_depth(*, queue_name: str | None = None) -> int:
    client = get_redis_client()
    return int(client.llen(queue_name or get_dead_letter_queue_name()))
