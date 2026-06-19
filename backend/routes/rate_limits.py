from fastapi import APIRouter, Request
from middleware.rate_limiter import TIERS, _AUTH_TIERS, _get_client_ip, _get_jwt_sub, get_subscription_tier
from services.subscription_catalog import get_effective_rate_limit, list_plans

router = APIRouter(prefix="/api", tags=["rate-limits"])

@router.get("/rate-limits/tiers")
def get_rate_limit_tiers():
    plans = list_plans()
    return {
        tier: {
            "limit": limit,
            "base_limit": limit,
            "window_seconds": window,
            "window_label": (
                f"{window // 3600}h" if window >= 3600 else f"{window}s"
            ),
            "identity_basis": "ip" if tier in _AUTH_TIERS else "user",
            "plan_limits": {
                plan["id"]: get_effective_rate_limit(plan["id"], tier, limit)
                for plan in plans
            },
        }
        for tier, (limit, window) in TIERS.items()
    }

@router.get("/rate-limits/status")
def get_rate_limit_status(request: Request):
    sub = _get_jwt_sub(request)
    plan_id = get_subscription_tier(sub)
    ip = _get_client_ip(request)
    identity_user = sub or ip
    identity_ip = ip

    result = {}
    for tier, (base_limit, window) in TIERS.items():
        limit = get_effective_rate_limit(plan_id, tier, base_limit)
        identity = identity_ip if tier in _AUTH_TIERS else identity_user
        rl_key = f"rl:{tier}:{identity}"

        if limit <= 0:
            result[tier] = {
                "limit": "unlimited",
                "used": 0,
                "remaining": "unlimited",
                "reset_at": 0,
                "window_seconds": window,
                "identity": identity if tier in _AUTH_TIERS else ("user" if sub else "ip"),
                "plan": plan_id,
            }
            continue

        import time
        now = time.time()
        cutoff = now - window

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
                "plan": plan_id,
            }
        except Exception:
            result[tier] = {"limit": limit, "used": 0, "remaining": limit, "error": True}

    return {
        "identity": "user" if sub else "ip",
        "plan": plan_id,
        "tiers": result,
    }
