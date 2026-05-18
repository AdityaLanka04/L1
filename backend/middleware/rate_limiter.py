"""
Comprehensive request rate-limiting middleware for Brainwave API.

Algorithm: Sliding-window log via Redis sorted sets (ZADD/ZREMRANGEBYSCORE/ZCARD).
           Atomic via Lua script.  Falls back to thread-safe in-memory deques when
           Redis is unavailable.

Tiers (requests / window per identity key):
  auth_login    5  / 60 s    per IP   — /api/token, /api/token_form
  auth_register 3  / 1 h     per IP   — /api/register
  auth_social   10 / 60 s    per IP   — /api/google-auth, /api/firebase-auth
  ai_heavy      20 / 1 h     per user — expensive AI generation endpoints
  ai_light      100 / 1 h    per user — lighter AI / search calls
  file_upload   20 / 1 h     per user — file uploads and media processing
  write         300 / 1 h    per user — POST/PUT/PATCH/DELETE (catch-all)
  read          1000 / 1 h   per user — GET (catch-all)

Response headers set on every request:
  X-RateLimit-Limit      limit for this tier
  X-RateLimit-Remaining  requests remaining in current window
  X-RateLimit-Reset      UTC unix timestamp when the window resets
  X-RateLimit-Window     window size in seconds
  X-RateLimit-Tier       tier name (debugging)
  Retry-After            only on 429 responses
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
import ipaddress
from collections import defaultdict, deque
from typing import Optional, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse
from jose import jwt, JWTError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

logger = logging.getLogger(__name__)

# ─── Tier definitions: (max_requests, window_seconds) ─────────────────────────
TIERS: dict[str, tuple[int, int]] = {
    "auth_login":    (5,    60),
    "auth_register": (3,    3600),
    "auth_social":   (10,   60),
    "ai_heavy":      (20,   3600),
    "ai_light":      (100,  3600),
    "file_upload":   (20,   3600),
    "write":         (300,  3600),
    "read":          (1000, 3600),
}

# Auth tiers always use IP as identity (no JWT required).
_AUTH_TIERS = {"auth_login", "auth_register", "auth_social"}

# ─── Route classification rules ────────────────────────────────────────────────
# Each entry: (methods: frozenset|None, path_prefix: str|None, tier: str|None)
#   methods=None → matches any HTTP method
#   path=None    → catch-all (must be last in its logical group)
#   tier=None    → unlimited (skip rate limiting entirely)
#
# Rules are checked in order; the first match wins.
_RULES: list[tuple[Optional[frozenset], Optional[str], Optional[str]]] = [
    # ── Unlimited ────────────────────────────────────────────────────────────
    (None,                          "/api/health",                      None),

    # ── Auth — IP-based ──────────────────────────────────────────────────────
    (frozenset(["POST"]),           "/api/token",                       "auth_login"),
    (frozenset(["POST"]),           "/api/token_form",                  "auth_login"),
    (frozenset(["POST"]),           "/api/register",                    "auth_register"),
    (frozenset(["POST"]),           "/api/google-auth",                 "auth_social"),
    (frozenset(["POST"]),           "/api/firebase-auth",               "auth_social"),
    (frozenset(["POST"]),           "/api/forgot-password",             "auth_login"),
    (frozenset(["POST"]),           "/api/reset-password",              "auth_login"),

    # ── AI Heavy (20 / hour / user) ───────────────────────────────────────────
    (frozenset(["POST"]),           "/api/chat",                        "ai_heavy"),
    (frozenset(["POST"]),           "/api/send_message",                "ai_heavy"),
    (frozenset(["POST"]),           "/api/save_chat_message",           "ai_heavy"),
    (frozenset(["POST"]),           "/api/generate_flashcards",         "ai_heavy"),
    (frozenset(["POST"]),           "/api/generate_notes",              "ai_heavy"),
    (frozenset(["POST"]),           "/api/generate_practice_questions", "ai_heavy"),
    (frozenset(["POST"]),           "/api/generate_quiz",               "ai_heavy"),
    (frozenset(["POST"]),           "/api/generate_questions",          "ai_heavy"),
    (frozenset(["POST"]),           "/api/convert_to_flashcards",       "ai_heavy"),
    (frozenset(["POST"]),           "/api/convert_to_notes",            "ai_heavy"),
    (None,                          "/api/agents/",                     "ai_heavy"),
    (None,                          "/api/learning-paths/generate",     "ai_heavy"),
    (None,                          "/api/learning-paths/ai",           "ai_heavy"),
    (frozenset(["POST"]),           "/api/summarize_notes",             "ai_heavy"),
    (frozenset(["POST"]),           "/api/create_study_plan",           "ai_heavy"),
    (frozenset(["POST"]),           "/api/roadmaps",                    "ai_heavy"),
    (None,                          "/api/media/process",               "ai_heavy"),
    (None,                          "/api/media/podcast",               "ai_heavy"),
    (None,                          "/api/media/regenerate",            "ai_heavy"),
    (None,                          "/api/media/generate-title",        "ai_heavy"),
    (None,                          "/api/analyze_slide",               "ai_heavy"),
    (None,                          "/api/intelligence/",               "ai_heavy"),
    (None,                          "/api/kt/predict",                  "ai_heavy"),

    # ── AI Light (100 / hour / user) ──────────────────────────────────────────
    (frozenset(["POST"]),           "/api/search_content",              "ai_light"),
    (frozenset(["POST"]),           "/api/natural_language_search",     "ai_light"),
    (frozenset(["POST"]),           "/api/detect_search_intent",        "ai_light"),
    (frozenset(["POST"]),           "/api/generate_topic_description",  "ai_light"),
    (frozenset(["POST"]),           "/api/suggest_subjects",            "ai_light"),
    (frozenset(["POST"]),           "/api/autocomplete",                "ai_light"),
    (frozenset(["POST"]),           "/api/get_personalized_prompts",    "ai_light"),
    (frozenset(["POST"]),           "/api/get_search_suggestion",       "ai_light"),

    # ── File Upload / Processing (20 / hour / user) ───────────────────────────
    (frozenset(["POST"]),           "/api/context",                     "file_upload"),
    (frozenset(["POST"]),           "/api/import",                      "file_upload"),
    (frozenset(["POST"]),           "/api/upload",                      "file_upload"),
    (frozenset(["POST"]),           "/api/upload_media",                "file_upload"),
    (frozenset(["POST"]),           "/api/upload_slide",                "file_upload"),
    (frozenset(["POST"]),           "/api/transcribe_audio",            "file_upload"),

    # ── Write catch-all (300 / hour / user) ───────────────────────────────────
    (frozenset(["POST", "PUT", "PATCH", "DELETE"]), None, "write"),

    # ── Read catch-all (1000 / hour / user) ───────────────────────────────────
    (frozenset(["GET"]),            None,                               "read"),
]

# ─── Lua script for atomic Redis sliding-window check ─────────────────────────
_LUA_SCRIPT = """
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])
local uid    = ARGV[4]

local win_start = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, win_start)
local count = redis.call('ZCARD', key)

if count < limit then
    redis.call('ZADD', key, now, uid)
    redis.call('EXPIRE', key, window * 2)
    local oldest_list = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest = (oldest_list and oldest_list[2]) and tonumber(oldest_list[2]) or now
    return {1, count + 1, oldest}
else
    local oldest_list = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest = (oldest_list and oldest_list[2]) and tonumber(oldest_list[2]) or now
    return {0, count, oldest}
end
"""

# ─── Module-level state ────────────────────────────────────────────────────────
_redis_client = None
_lua_sha: Optional[str] = None
_mem_lock = threading.Lock()
_mem_store: dict[str, deque] = defaultdict(deque)

_SECRET_KEY: str = os.getenv("SECRET_KEY", "")
_ALGORITHM = "HS256"
_JWT_AUDIENCE = "brainwave-client"
_JWT_ISSUER = "brainwave-backend"

# Trust X-Forwarded-For only when the direct peer is a trusted proxy.
_TRUSTED_PROXY_CIDRS_RAW = os.getenv("RATE_LIMIT_TRUSTED_PROXY_CIDRS", "127.0.0.1/32,::1/128")

# Bound in-memory fallback state to avoid unbounded growth.
_MEM_MAX_KEYS = max(1000, int(os.getenv("RATE_LIMIT_MEMORY_MAX_KEYS", "20000")))
_MEM_EVICT_BATCH = max(100, _MEM_MAX_KEYS // 4)

# Routes that must match exact path (not prefix).
_EXACT_MATCH_PATHS = {"/api/health"}


def _parse_cidrs(raw: str) -> list[ipaddress._BaseNetwork]:
    networks: list[ipaddress._BaseNetwork] = []
    for token in (raw or "").split(","):
        token = token.strip()
        if not token:
            continue
        try:
            networks.append(ipaddress.ip_network(token, strict=False))
        except ValueError:
            logger.warning("Rate limiter: ignoring invalid proxy CIDR '%s'", token)
    return networks


_TRUSTED_PROXY_NETWORKS = _parse_cidrs(_TRUSTED_PROXY_CIDRS_RAW)


def init_redis_for_rate_limiter(redis_client) -> None:
    """
    Called from main.py startup to share the already-connected Redis client.
    If not called, the middleware falls back to in-memory tracking.
    """
    global _redis_client, _lua_sha
    _redis_client = redis_client
    if _redis_client is not None:
        try:
            _lua_sha = _redis_client.script_load(_LUA_SCRIPT)
            logger.info("Rate limiter: Redis backend ready (Lua script loaded)")
        except Exception as e:
            logger.warning(f"Rate limiter: Redis Lua load failed ({e}), using in-memory fallback")
            _redis_client = None


# ─── Identity extraction ───────────────────────────────────────────────────────

def _is_from_trusted_proxy(request: Request) -> bool:
    if not _TRUSTED_PROXY_NETWORKS:
        return False
    if not request.client or not request.client.host:
        return False
    try:
        peer_ip = ipaddress.ip_address(request.client.host)
    except ValueError:
        return False
    return any(peer_ip in net for net in _TRUSTED_PROXY_NETWORKS)


def _extract_leftmost_ip(xff: str) -> Optional[str]:
    if not xff:
        return None
    candidate = xff.split(",")[0].strip()
    if not candidate:
        return None
    try:
        ipaddress.ip_address(candidate)
        return candidate
    except ValueError:
        return None


def _get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if _is_from_trusted_proxy(request):
        client_ip = _extract_leftmost_ip(xff)
        if client_ip:
            return client_ip
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def _get_jwt_sub(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token or not _SECRET_KEY:
        return None
    try:
        payload = jwt.decode(
            token,
            _SECRET_KEY,
            algorithms=[_ALGORITHM],
            audience=_JWT_AUDIENCE,
            issuer=_JWT_ISSUER,
        )
        return payload.get("sub")
    except JWTError:
        return None


def _get_identity(request: Request, use_ip: bool) -> str:
    if use_ip:
        return _get_client_ip(request)
    sub = _get_jwt_sub(request)
    if sub:
        return sub
    return _get_client_ip(request)


# ─── Route classification ──────────────────────────────────────────────────────

def _classify(method: str, path: str) -> Optional[str]:
    """Return tier name, or None for unlimited.
    Prefix rules only fire when the rule path is longer than 1 character,
    preventing "/" from accidentally matching every path.
    """
    for rule_methods, rule_path, tier in _RULES:
        if rule_methods is not None and method not in rule_methods:
            continue
        if rule_path is not None:
            if rule_path in _EXACT_MATCH_PATHS:
                if path != rule_path:
                    continue
            elif len(rule_path) > 1:
                if not path.startswith(rule_path):
                    continue
            else:
                if path != rule_path:
                    continue
        return tier
    return None


# ─── Rate limit checks ─────────────────────────────────────────────────────────

def _check_redis(key: str, limit: int, window: int) -> Tuple[bool, int, float]:
    """
    Returns (allowed, current_count, oldest_timestamp_in_window).
    Raises on unexpected Redis errors (caller should fall back to memory).
    """
    now = time.time()
    uid = str(uuid.uuid4())
    result = _redis_client.evalsha(_lua_sha, 1, key, now, window, limit, uid)
    allowed = bool(int(result[0]))
    current = int(result[1])
    oldest = float(result[2])
    return allowed, current, oldest


def _check_memory(key: str, limit: int, window: int) -> Tuple[bool, int, float]:
    """Thread-safe in-memory sliding window."""
    now = time.time()
    cutoff = now - window
    with _mem_lock:
        dq = _mem_store.get(key)
        if dq is None:
            dq = deque()
            _mem_store[key] = dq

        while dq and dq[0] < cutoff:
            dq.popleft()

        if not dq:
            _mem_store.pop(key, None)
            dq = deque()
            _mem_store[key] = dq

        count = len(dq)
        if count < limit:
            dq.append(now)
            _evict_memory_if_needed_locked()
            oldest = dq[0]
            return True, count + 1, oldest

        _evict_memory_if_needed_locked()
        oldest = dq[0] if dq else now
        return False, count, oldest


def _evict_memory_if_needed_locked() -> None:
    """Requires _mem_lock. Evicts stale/old entries when key count grows too large."""
    if len(_mem_store) <= _MEM_MAX_KEYS:
        return

    # Drop empty deques first (they can appear after window trimming).
    empty_keys = [k for k, v in _mem_store.items() if not v]
    for k in empty_keys:
        _mem_store.pop(k, None)
    if len(_mem_store) <= _MEM_MAX_KEYS:
        return

    overage = len(_mem_store) - _MEM_MAX_KEYS
    to_remove = min(len(_mem_store), max(_MEM_EVICT_BATCH, overage))

    # Evict least-recently-seen keys (oldest right edge timestamp).
    oldest_keys = sorted(
        _mem_store.keys(),
        key=lambda k: _mem_store[k][-1] if _mem_store[k] else 0.0,
    )[:to_remove]
    for k in oldest_keys:
        _mem_store.pop(k, None)


def _check(key: str, limit: int, window: int) -> Tuple[bool, int, float]:
    if _redis_client is not None and _lua_sha is not None:
        try:
            return _check_redis(key, limit, window)
        except Exception as e:
            logger.warning(f"Rate limiter Redis error ({e}); falling back to in-memory")
    return _check_memory(key, limit, window)


# ─── Middleware ────────────────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Applies per-tier rate limits to all incoming requests.
    CORS preflight OPTIONS requests are always passed through.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Always allow CORS preflights
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        method = request.method
        tier_name = _classify(method, path)

        # Unlimited path
        if tier_name is None:
            return await call_next(request)

        limit, window = TIERS[tier_name]
        use_ip = tier_name in _AUTH_TIERS
        identity = _get_identity(request, use_ip=use_ip)

        rl_key = f"rl:{tier_name}:{identity}"
        allowed, current, oldest = _check(rl_key, limit, window)

        reset_at = oldest + window
        remaining = max(0, limit - current)

        if not allowed:
            retry_after = max(1, int(reset_at - time.time()))
            logger.warning(
                "Rate limit exceeded | tier=%s identity=%s path=%s method=%s",
                tier_name, identity, path, method,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": (
                        f"Too many requests. You have reached the {tier_name} limit "
                        f"({limit} per {window}s). Please wait {retry_after} second(s)."
                    ),
                    "retry_after": retry_after,
                    "limit": limit,
                    "window_seconds": window,
                    "tier": tier_name,
                },
                headers={
                    "Retry-After":          str(retry_after),
                    "X-RateLimit-Limit":    str(limit),
                    "X-RateLimit-Remaining":"0",
                    "X-RateLimit-Reset":    str(int(reset_at)),
                    "X-RateLimit-Window":   str(window),
                    "X-RateLimit-Tier":     tier_name,
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"]     = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"]     = str(int(reset_at))
        response.headers["X-RateLimit-Window"]    = str(window)
        response.headers["X-RateLimit-Tier"]      = tier_name
        return response
