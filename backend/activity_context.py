from contextvars import ContextVar
from typing import Any, Dict, Optional

_activity_context: ContextVar[Optional[Dict[str, Any]]] = ContextVar("activity_context", default=None)

def set_activity_context(context: Dict[str, Any]):
    return _activity_context.set(context)

def get_activity_context() -> Optional[Dict[str, Any]]:
    return _activity_context.get()

def clear_activity_context(token):
    _activity_context.reset(token)
