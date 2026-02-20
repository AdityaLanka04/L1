"""
Helpers to extract token usage from AI responses.
"""
from typing import Any, Dict, Optional


def _get_attr(obj: Any, *names) -> Optional[Any]:
    for name in names:
        if isinstance(obj, dict) and name in obj:
            return obj.get(name)
        if hasattr(obj, name):
            return getattr(obj, name)
    return None


def extract_usage_from_openai_like(response: Any) -> Optional[Dict[str, int]]:
    if response is None:
        return None
    usage = _get_attr(response, "usage")
    if not usage:
        return None

    prompt_tokens = _get_attr(usage, "prompt_tokens", "promptTokens")
    completion_tokens = _get_attr(usage, "completion_tokens", "completionTokens")
    total_tokens = _get_attr(usage, "total_tokens", "totalTokens")

    if prompt_tokens is None and completion_tokens is None and total_tokens is None:
        return None

    return {
        "prompt_tokens": int(prompt_tokens or 0),
        "completion_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or (prompt_tokens or 0) + (completion_tokens or 0)),
    }


def extract_usage_from_gemini_payload(payload: Any) -> Optional[Dict[str, int]]:
    if payload is None:
        return None

    usage_meta = None
    if isinstance(payload, dict):
        usage_meta = payload.get("usageMetadata") or payload.get("usage_metadata")
    else:
        usage_meta = _get_attr(payload, "usage_metadata", "usageMetadata")

    if not usage_meta:
        return None

    prompt_tokens = _get_attr(usage_meta, "promptTokenCount", "prompt_tokens")
    completion_tokens = _get_attr(usage_meta, "candidatesTokenCount", "completion_tokens")
    total_tokens = _get_attr(usage_meta, "totalTokenCount", "total_tokens")

    if prompt_tokens is None and completion_tokens is None and total_tokens is None:
        return None

    return {
        "prompt_tokens": int(prompt_tokens or 0),
        "completion_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or (prompt_tokens or 0) + (completion_tokens or 0)),
    }
