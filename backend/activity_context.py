"""
Request-scoped activity context for AI usage logging.
"""
from contextvars import ContextVar
from typing import Any, Dict, Optional

_activity_context: ContextVar[Optional[Dict[str, Any]]] = ContextVar("activity_context", default=None)

def set_activity_context(context: Dict[str, Any]):
    """Set the current activity context. Returns token for reset."""
    return _activity_context.set(context)

def get_activity_context() -> Optional[Dict[str, Any]]:
    """Get the current activity context."""
    return _activity_context.get()

def clear_activity_context(token):
    """Reset the activity context to previous value."""
    _activity_context.reset(token)
