from __future__ import annotations

import ast
import json
import re
from typing import Any


def _strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", cleaned).strip()
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
    return cleaned


def _iter_balanced_json_arrays(text: str, max_candidates: int = 8) -> list[str]:
    """Extract top-level balanced [...] candidates while respecting quoted strings."""
    s = text or ""
    candidates: list[str] = []
    n = len(s)
    i = 0

    while i < n and len(candidates) < max_candidates:
        if s[i] != "[":
            i += 1
            continue

        start = i
        depth = 0
        in_str = False
        esc = False
        quote_char = ""

        for j in range(i, n):
            ch = s[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == quote_char:
                    in_str = False
            else:
                if ch in ("'", '"'):
                    in_str = True
                    quote_char = ch
                elif ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0:
                        candidates.append(s[start : j + 1])
                        i = j + 1
                        break
        else:
            i += 1
            continue

    return candidates


def _repair_json_like(text: str) -> str:
    repaired = (text or "").strip()
    repaired = repaired.replace("\u201c", '"').replace("\u201d", '"').replace("\u2019", "'")
    repaired = repaired.replace("\r\n", "\n")

    # Remove trailing commas before object/array closure.
    repaired = re.sub(r",(\s*[\]}])", r"\1", repaired)
    # Quote bare keys: { key: ... } -> { "key": ... }
    repaired = re.sub(r'([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)', r'\1"\2"\3', repaired)
    # Python-ish literals -> JSON literals.
    repaired = re.sub(r"\bTrue\b", "true", repaired)
    repaired = re.sub(r"\bFalse\b", "false", repaired)
    repaired = re.sub(r"\bNone\b", "null", repaired)
    return repaired


def _normalize_to_list(value: Any) -> list[dict]:
    if isinstance(value, dict):
        if isinstance(value.get("questions"), list):
            value = value["questions"]
        else:
            value = [value]
    if not isinstance(value, list):
        return []
    return [v for v in value if isinstance(v, dict)]


def _try_parse_candidate(candidate: str) -> list[dict]:
    # 1) strict JSON
    try:
        return _normalize_to_list(json.loads(candidate))
    except Exception:
        pass

    # 2) repaired JSON
    repaired = _repair_json_like(candidate)
    try:
        return _normalize_to_list(json.loads(repaired))
    except Exception:
        pass

    # 3) Python literal
    try:
        return _normalize_to_list(ast.literal_eval(candidate))
    except Exception:
        pass

    # 4) repaired Python literal
    try:
        return _normalize_to_list(ast.literal_eval(repaired))
    except Exception:
        return []


def parse_json_array_response(text: str) -> list[dict]:
    """
    Robustly parse AI output into list[dict].
    Handles:
    - fenced markdown code blocks
    - extra prose around JSON array
    - minor JSON defects (trailing commas, bare keys, Python literals)
    """
    cleaned = _strip_code_fences(text)
    if not cleaned:
        return []

    # First try full text as-is.
    direct = _try_parse_candidate(cleaned)
    if direct:
        return direct

    # Then try balanced array substrings.
    for candidate in _iter_balanced_json_arrays(cleaned):
        parsed = _try_parse_candidate(candidate)
        if parsed:
            return parsed

    # Final permissive regex fallback.
    match = re.search(r"\[[\s\S]*\]", cleaned)
    if match:
        parsed = _try_parse_candidate(match.group(0))
        if parsed:
            return parsed

    return []

