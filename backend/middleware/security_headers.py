"""
Security headers middleware for Brainwave API.

Adds defensive HTTP headers to every response:
  X-Content-Type-Options    — prevents MIME sniffing
  X-Frame-Options           — clickjacking protection
  X-XSS-Protection          — legacy XSS filter hint
  Referrer-Policy           — controls referrer leakage
  Permissions-Policy        — disables unused browser features
  Strict-Transport-Security — HTTPS-only (production)
  Cache-Control             — prevents caching of API responses

Set ENVIRONMENT=production to enable HSTS.
"""
import os

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

_IS_PROD = os.getenv("ENVIRONMENT", "development") == "production"

_STATIC_HEADERS: dict[str, str] = {
    "X-Content-Type-Options":  "nosniff",
    "X-Frame-Options":         "DENY",
    "X-XSS-Protection":        "1; mode=block",
    "Referrer-Policy":         "strict-origin-when-cross-origin",
    "Permissions-Policy":      "camera=(), microphone=(), geolocation=(), payment=()",
}

if _IS_PROD:
    _STATIC_HEADERS["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

# API responses must never be cached by intermediaries
_CACHE_CONTROL = "no-store, no-cache, must-revalidate, private"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        for name, value in _STATIC_HEADERS.items():
            response.headers[name] = value

        # Only apply strict cache-control to API routes, not static assets
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = _CACHE_CONTROL

        # Strip the Server header to avoid leaking uvicorn version.
        # MutableHeaders does not implement .pop() on some Starlette versions.
        if "server" in response.headers:
            del response.headers["server"]

        return response
