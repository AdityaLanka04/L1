import base64
import logging
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Iterator, List, Optional

DEFAULT_YTDLP_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

_TRUTHY = {"1", "true", "yes", "on"}

def _is_truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _TRUTHY

def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        return default

def get_ytdlp_common_args() -> List[str]:
    args: List[str] = []

    extractor_args = os.getenv("YTDLP_EXTRACTOR_ARGS", "youtube:player_client=android,web,ios").strip()
    if extractor_args:
        args.extend(["--extractor-args", extractor_args])

    user_agent = os.getenv("YTDLP_USER_AGENT", DEFAULT_YTDLP_USER_AGENT).strip()
    if user_agent:
        args.extend(["--user-agent", user_agent])

    proxy_url = os.getenv("YTDLP_PROXY_URL", "").strip()
    if proxy_url:
        args.extend(["--proxy", proxy_url])

    if _is_truthy(os.getenv("YTDLP_FORCE_IPV4"), default=True):
        args.append("--force-ipv4")

    if _is_truthy(os.getenv("YTDLP_GEO_BYPASS"), default=True):
        args.append("--geo-bypass")

    if _is_truthy(os.getenv("YTDLP_NO_CHECK_CERTIFICATE"), default=False):
        args.append("--no-check-certificate")

    retries = _env_int("YTDLP_RETRIES", 3)
    extractor_retries = _env_int("YTDLP_EXTRACTOR_RETRIES", retries)
    fragment_retries = _env_int("YTDLP_FRAGMENT_RETRIES", retries)
    socket_timeout = _env_int("YTDLP_SOCKET_TIMEOUT", 30)
    sleep_requests = _env_int("YTDLP_SLEEP_REQUESTS", 1)

    args.extend(
        [
            "--retries",
            str(retries),
            "--extractor-retries",
            str(extractor_retries),
            "--fragment-retries",
            str(fragment_retries),
            "--socket-timeout",
            str(socket_timeout),
        ]
    )
    if sleep_requests > 0:
        args.extend(["--sleep-requests", str(sleep_requests)])

    return args

@contextmanager
def ytdlp_auth_args(logger: Optional[logging.Logger] = None) -> Iterator[List[str]]:
    args: List[str] = []
    temp_cookie_path: Optional[str] = None
    log = logger or logging.getLogger(__name__)

    cookies_file = os.getenv("YTDLP_COOKIES_FILE", "").strip()
    cookies_b64 = os.getenv("YTDLP_COOKIES_B64", "").strip()
    cookies_raw = os.getenv("YTDLP_COOKIES", "").strip()
    cookies_from_browser = os.getenv("YTDLP_COOKIES_FROM_BROWSER", "").strip()

    try:
        if cookies_file:
            cookie_path = Path(cookies_file)
            if cookie_path.exists():
                args.extend(["--cookies", str(cookie_path)])
            else:
                log.warning("YTDLP_COOKIES_FILE is set but file does not exist: %s", cookie_path)
        elif cookies_b64 or cookies_raw:
            try:
                if cookies_b64:
                    padded = cookies_b64 + ("=" * (-len(cookies_b64) % 4))
                    cookie_text = base64.b64decode(padded).decode("utf-8")
                else:
                    cookie_text = cookies_raw
            except Exception:
                log.warning("Failed to decode YTDLP_COOKIES_B64; ignoring cookie config", exc_info=True)
                cookie_text = ""

            if cookie_text:
                with tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt", encoding="utf-8") as tmp:
                    tmp.write(cookie_text)
                    temp_cookie_path = tmp.name
                args.extend(["--cookies", temp_cookie_path])
        elif cookies_from_browser:
            args.extend(["--cookies-from-browser", cookies_from_browser])

        yield args
    finally:
        if temp_cookie_path:
            try:
                os.remove(temp_cookie_path)
            except OSError:
                pass

def summarize_ytdlp_error(error_text: str, max_len: int = 280) -> str:
    cleaned = " ".join((error_text or "").split())
    if not cleaned:
        return "yt-dlp failed with no stderr output"
    if len(cleaned) > max_len:
        return cleaned[: max_len - 3] + "..."
    return cleaned

def classify_ytdlp_error(error_text: str) -> Dict[str, str]:
    raw = (error_text or "").strip()
    lowered = raw.lower()
    detail = summarize_ytdlp_error(raw)

    def has(*needles: str) -> bool:
        return any(n in lowered for n in needles)

    if has("confirm your age", "age-restricted", "age restricted"):
        return {
            "code": "age_restricted",
            "message": "Video is age-restricted and requires signed-in YouTube cookies on the server.",
            "detail": detail,
        }

    if has("not a bot", "protect our community", "unusual traffic"):
        return {
            "code": "bot_challenge",
            "message": (
                "YouTube blocked this server IP with a bot/sign-in challenge. "
                "Configure YTDLP_COOKIES_FILE or YTDLP_COOKIES_B64, or use a different egress IP/proxy."
            ),
            "detail": detail,
        }

    if has("sign in", "cookies-from-browser", "use --cookies", "authentication required"):
        return {
            "code": "signin_required",
            "message": (
                "YouTube requires authenticated access from this environment. "
                "Configure YTDLP_COOKIES_FILE or YTDLP_COOKIES_B64."
            ),
            "detail": detail,
        }

    if has("429", "too many requests", "rate limit"):
        return {
            "code": "rate_limited",
            "message": "YouTube rate-limited this server IP (429). Retry later or use a different egress IP/proxy.",
            "detail": detail,
        }

    if has("video unavailable", "private video", "video is private", "is unavailable", "members-only"):
        return {
            "code": "video_unavailable",
            "message": "Video is unavailable, private, deleted, or restricted in this region.",
            "detail": detail,
        }

    if has("not available in your country", "blocked in your country"):
        return {
            "code": "geo_restricted",
            "message": "Video is geo-restricted from this server location.",
            "detail": detail,
        }

    if has("http error 403", "forbidden"):
        return {
            "code": "forbidden",
            "message": "YouTube denied access from this server (HTTP 403).",
            "detail": detail,
        }

    if has("unable to extract", "nsig", "signature extraction"):
        return {
            "code": "extractor_error",
            "message": "yt-dlp extractor failed. Upgrade yt-dlp to the latest version and retry.",
            "detail": detail,
        }

    if has(
        "timed out",
        "timeout",
        "name or service not known",
        "temporary failure in name resolution",
        "network is unreachable",
        "connection refused",
    ):
        return {
            "code": "network_error",
            "message": "Network/DNS timeout while contacting YouTube from the server.",
            "detail": detail,
        }

    return {
        "code": "unknown",
        "message": f"yt-dlp failed: {detail}",
        "detail": detail,
    }
