from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_QUEUE_NAME = "bw:ai_jobs:default"


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


def get_redis_client():
    try:
        import redis

        client = redis.Redis.from_url(
            get_redis_url(),
            socket_connect_timeout=2,
            socket_timeout=5,
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
