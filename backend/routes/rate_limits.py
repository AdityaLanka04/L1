"""
Public read-only endpoint that exposes the current rate limit tier definitions.
Useful for frontend to display limits to users and for debugging.
"""
from fastapi import APIRouter, Depends, Request
from jose import jwt, JWTError

from deps import SECRET_KEY, ALGORITHM
from middleware.rate_limiter import TIERS, _AUTH_TIERS, _classify, _check, _get_client_ip, _get_jwt_sub

router = APIRouter(prefix="/api", tags=["rate-limits"])


@router.get("/rate-limits/tiers")
def get_rate_limit_tiers():
    """Return the rate limit tier definitions (public)."""
    return {
        tier: {
            "limit": limit,
            "window_seconds": window,
            "window_label": (
                f"{window // 3600}h" if window >= 3600 else f"{window}s"
            ),
            "identity_basis": "ip" if tier in _AUTH_TIERS else "user",
        }
        for tier, (limit, window) in TIERS.items()
    }


@router.get("/rate-limits/status")
def get_rate_limit_status(request: Request):
    """
    Return current rate limit counters for the calling user across all tiers.
    Reads current sliding-window counts without incrementing them.
    """
    sub = _get_jwt_sub(request)
    ip = _get_client_ip(request)
    identity_user = sub or ip
    identity_ip = ip

    result = {}
    for tier, (limit, window) in TIERS.items():
        identity = identity_ip if tier in _AUTH_TIERS else identity_user
        rl_key = f"rl:{tier}:{identity}"

        import time
        now = time.time()
        cutoff = now - window

        # Read-only check: peek at current count without adding an entry.
        try:
            from middleware.rate_limiter import _redis_client, _lua_sha, _mem_store, _mem_lock
            if _redis_client is not None:
                try:
                    _redis_client.zremrangebyscore(rl_key, 0, cutoff)
                    current = _redis_client.zcard(rl_key)
                    oldest_list = _redis_client.zrange(rl_key, 0, 0, withscores=True)
                    oldest = oldest_list[0][1] if oldest_list else now
                except Exception:
                    current = 0
                    oldest = now
            else:
                with _mem_lock:
                    dq = _mem_store.get(rl_key)
                    if dq:
                        while dq and dq[0] < cutoff:
                            dq.popleft()
                        current = len(dq)
                        oldest = dq[0] if dq else now
                    else:
                        current = 0
                        oldest = now

            reset_at = oldest + window
            result[tier] = {
                "limit": limit,
                "used": current,
                "remaining": max(0, limit - current),
                "reset_at": int(reset_at),
                "window_seconds": window,
                "identity": identity if tier in _AUTH_TIERS else ("user" if sub else "ip"),
            }
        except Exception:
            result[tier] = {"limit": limit, "used": 0, "remaining": limit, "error": True}

    return {
        "identity": "user" if sub else "ip",
        "tiers": result,
    }
