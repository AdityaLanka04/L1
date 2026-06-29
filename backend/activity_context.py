from contextvars import ContextVar
from typing import Any, Dict, Optional

_activity_context: ContextVar[Optional[Dict[str, Any]]] = ContextVar("activity_context", default=None)
_provider_usage_delta: ContextVar[int] = ContextVar("provider_usage_delta", default=0)

def set_activity_context(context: Dict[str, Any]):
    return _activity_context.set(context)

def get_activity_context() -> Optional[Dict[str, Any]]:
    return _activity_context.get()

def clear_activity_context(token):
    _activity_context.reset(token)

def begin_provider_usage_delta():
    return _provider_usage_delta.set(0)

def add_provider_usage_delta(tokens: int) -> None:
    amount = max(0, int(tokens or 0))
    if amount <= 0:
        return
    _provider_usage_delta.set(_provider_usage_delta.get() + amount)

def get_provider_usage_delta() -> int:
    return int(_provider_usage_delta.get() or 0)

def clear_provider_usage_delta(token):
    _provider_usage_delta.reset(token)
