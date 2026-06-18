from __future__ import annotations

import os
import socket
import threading
import time
import uuid
from collections import deque
from typing import Optional

BACKEND_ID: str = os.getenv("BACKEND_ID", socket.gethostname()[:20])

_MAX_ENTRIES = int(os.getenv("REQUEST_TRACKER_MAX_ENTRIES", "2000"))
_RETENTION_SECONDS = int(os.getenv("REQUEST_TRACKER_RETENTION_SECONDS", "7200"))

_lock = threading.Lock()
_entries: deque = deque(maxlen=_MAX_ENTRIES)

_PATH_TRUNCATE = 80


def record(
    *,
    path: str,
    method: str,
    user_id: Optional[str],
    ip: str,
    tier: Optional[str],
    limit: int,
    used: int,
    allowed: bool,
    status_code: int,
    duration_ms: float,
    plan: str,
) -> None:
    entry = {
        "id": str(uuid.uuid4())[:8],
        "ts": time.time(),
        "path": path[:_PATH_TRUNCATE],
        "method": method,
        "user_id": (user_id or ip)[:80],
        "ip": ip[:45],
        "tier": tier,
        "limit": limit,
        "used": used,
        "allowed": allowed,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 1),
        "plan": plan,
        "backend_id": BACKEND_ID,
    }
    with _lock:
        _entries.append(entry)


def _purge_old_locked(now: float) -> None:
    cutoff = now - _RETENTION_SECONDS
    while _entries and _entries[0]["ts"] < cutoff:
        _entries.popleft()


def get_recent(
    limit: int = 250,
    tier_filter: Optional[str] = None,
    user_filter: Optional[str] = None,
    blocked_only: bool = False,
    method_filter: Optional[str] = None,
) -> list[dict]:
    now = time.time()
    with _lock:
        _purge_old_locked(now)
        snapshot = list(_entries)

    results = []
    for e in reversed(snapshot):
        if blocked_only and e["allowed"]:
            continue
        if tier_filter and e.get("tier") != tier_filter:
            continue
        if user_filter:
            uid = (e.get("user_id") or "").lower()
            if user_filter.lower() not in uid:
                continue
        if method_filter and e.get("method") != method_filter.upper():
            continue
        results.append(e)
        if len(results) >= limit:
            break
    return results


def get_stats(window_seconds: int = 300) -> dict:
    now = time.time()
    cutoff = now - window_seconds
    with _lock:
        _purge_old_locked(now)
        snapshot = list(_entries)

    recent = [e for e in snapshot if e["ts"] >= cutoff]
    total = len(recent)
    blocked = sum(1 for e in recent if not e["allowed"])
    by_tier: dict[str, dict] = {}
    by_user: dict[str, int] = {}
    by_backend: dict[str, int] = {}
    durations: list[float] = []

    for e in recent:
        tier = e.get("tier") or "unknown"
        if tier not in by_tier:
            by_tier[tier] = {"total": 0, "blocked": 0}
        by_tier[tier]["total"] += 1
        if not e["allowed"]:
            by_tier[tier]["blocked"] += 1

        uid = e.get("user_id") or "anon"
        by_user[uid] = by_user.get(uid, 0) + 1
        bid = e.get("backend_id") or "unknown"
        by_backend[bid] = by_backend.get(bid, 0) + 1
        if e.get("duration_ms") is not None:
            durations.append(e["duration_ms"])

    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0.0
    p95_duration = 0.0
    if durations:
        s = sorted(durations)
        p95_duration = round(s[int(len(s) * 0.95)], 1)

    top_users = sorted(by_user.items(), key=lambda x: -x[1])[:15]
    top_violators: list[dict] = []
    user_blocks: dict[str, int] = {}
    for e in recent:
        if not e["allowed"]:
            uid = e.get("user_id") or "anon"
            user_blocks[uid] = user_blocks.get(uid, 0) + 1
    top_violators = [
        {"user_id": u, "blocked": c}
        for u, c in sorted(user_blocks.items(), key=lambda x: -x[1])[:10]
    ]

    return {
        "window_seconds": window_seconds,
        "total_requests": total,
        "blocked_requests": blocked,
        "block_rate_pct": round((blocked / total * 100), 1) if total else 0.0,
        "avg_duration_ms": avg_duration,
        "p95_duration_ms": p95_duration,
        "by_tier": by_tier,
        "by_backend": by_backend,
        "top_users": [{"user_id": u, "count": c} for u, c in top_users],
        "top_violators": top_violators,
        "backend_id": BACKEND_ID,
        "tracked_total": len(snapshot),
        "generated_at": now,
    }


def get_live_quotas() -> list[dict]:
    try:
        from middleware.rate_limiter import (
            TIERS,
            _mem_lock,
            _mem_store,
            _redis_client,
        )
    except Exception:
        return []

    now = time.time()
    results: list[dict] = []

    if _redis_client is not None:
        try:
            raw_keys = _redis_client.keys("rl:*")
            for raw_key in raw_keys:
                key_str = raw_key.decode() if isinstance(raw_key, bytes) else raw_key
                parts = key_str.split(":", 2)
                if len(parts) < 3:
                    continue
                tier, identity = parts[1], parts[2]
                if tier not in TIERS:
                    continue
                base_limit, window = TIERS[tier]
                cutoff = now - window
                try:
                    _redis_client.zremrangebyscore(key_str, 0, cutoff)
                    count = int(_redis_client.zcard(key_str) or 0)
                    oldest_list = _redis_client.zrange(key_str, 0, 0, withscores=True)
                    oldest = float(oldest_list[0][1]) if oldest_list else now
                    results.append({
                        "tier": tier,
                        "identity": identity[:80],
                        "used": count,
                        "limit": base_limit,
                        "window_seconds": window,
                        "reset_at": int(oldest + window),
                        "pct": round(count / base_limit * 100, 1) if base_limit else 0,
                        "backend_id": BACKEND_ID,
                        "store": "redis",
                    })
                except Exception:
                    pass
        except Exception:
            pass
    else:
        with _mem_lock:
            snapshot = list(_mem_store.items())

        for key, dq in snapshot:
            parts = key.split(":", 2)
            if len(parts) < 3:
                continue
            tier, identity = parts[1], parts[2]
            if tier not in TIERS:
                continue
            base_limit, window = TIERS[tier]
            cutoff = now - window
            active = [ts for ts in list(dq) if ts > cutoff]
            if not active:
                continue
            results.append({
                "tier": tier,
                "identity": identity[:80],
                "used": len(active),
                "limit": base_limit,
                "window_seconds": window,
                "reset_at": int(active[0] + window),
                "pct": round(len(active) / base_limit * 100, 1) if base_limit else 0,
                "backend_id": BACKEND_ID,
                "store": "memory",
            })

    results.sort(key=lambda x: -x["pct"])
    return results
