"""Keep full learning requests separate from bounded database display titles."""
import re


def learning_path_title(value, fallback="Learning Path", limit=255):
    title = re.sub(r"\s+", " ", str(value or fallback)).strip() or fallback
    if len(title) <= limit:
        return title
    return title[:limit - 1].rstrip() + "…"
