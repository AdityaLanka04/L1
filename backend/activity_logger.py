import logging

logger = logging.getLogger(__name__)
import json
from datetime import datetime, timezone
from typing import Optional
from threading import Lock
from sqlalchemy import text
from activity_context import get_activity_context
from database import DATABASE_URL, engine

_ACTIVITY_TABLE_READY = False
_ACTIVITY_TABLE_LOCK = Lock()
_IS_POSTGRES = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL

def ensure_activity_log_table() -> bool:
    global _ACTIVITY_TABLE_READY
    if _ACTIVITY_TABLE_READY:
        return True

    with _ACTIVITY_TABLE_LOCK:
        if _ACTIVITY_TABLE_READY:
            return True
        try:
            with engine.begin() as conn:
                if _IS_POSTGRES:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS user_activity_log (
                            id BIGSERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            tool_name TEXT NOT NULL,
                            action TEXT,
                            tokens_used INTEGER DEFAULT 0,
                            timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                            metadata TEXT,
                            session_id TEXT,
                            duration_seconds DOUBLE PRECISION
                        )
                    """))
                else:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS user_activity_log (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            tool_name TEXT NOT NULL,
                            action TEXT,
                            tokens_used INTEGER DEFAULT 0,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                            metadata TEXT,
                            session_id TEXT,
                            duration_seconds REAL,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_activity_user
                    ON user_activity_log(user_id)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_activity_timestamp
                    ON user_activity_log(timestamp)
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_activity_session
                    ON user_activity_log(session_id)
                """))
            _ACTIVITY_TABLE_READY = True
            return True
        except Exception as e:
            logger.error(f"Failed to ensure activity log table: {e}")
            return False

def resolve_user_id(user_id) -> Optional[int]:
    if user_id is None:
        return None
    try:
        return int(user_id)
    except (ValueError, TypeError):
        pass

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT id FROM users WHERE email = :subject OR username = :subject LIMIT 1"),
                {"subject": str(user_id)},
            ).first()
        return int(result[0]) if result else None
    except Exception:
        return None

def log_activity(user_id, tool_name, action, tokens_used=0, metadata=None):
    try:
        if not ensure_activity_log_table():
            return False
        resolved_user_id = resolve_user_id(user_id)
        if resolved_user_id is None:
            return False

        metadata_json = json.dumps(metadata) if metadata else None

        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO user_activity_log
                    (user_id, tool_name, action, tokens_used, metadata, timestamp)
                    VALUES (:user_id, :tool_name, :action, :tokens_used, :metadata, :timestamp)
                """),
                {
                    "user_id": resolved_user_id,
                    "tool_name": tool_name,
                    "action": action,
                    "tokens_used": int(tokens_used or 0),
                    "metadata": metadata_json,
                    "timestamp": datetime.now(timezone.utc),
                },
            )
        return True
    except Exception as e:
        logger.error(f"Error logging activity: {e}")
        return False

def log_ai_tokens(
    user_id,
    tool_name,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    model=None,
    metadata: Optional[dict] = None,
):
    ctx = get_activity_context() or {}

    base_metadata = {
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'model': model or 'unknown',
        'token_source': 'model_usage',
        'event_type': 'ai_usage'
    }
    if ctx.get('endpoint'):
        base_metadata['endpoint'] = ctx.get('endpoint')
    if ctx.get('method'):
        base_metadata['method'] = ctx.get('method')
    if ctx.get('action'):
        base_metadata['source_action'] = ctx.get('action')
    if metadata:
        base_metadata.update(metadata)
    effective_tool_name = tool_name or ctx.get('tool_name') or 'ai_unknown'
    return log_activity(user_id, effective_tool_name, 'ai_generate', total_tokens, base_metadata)

def get_user_token_usage(user_id, days=30):
    try:
        if not ensure_activity_log_table():
            return 0
        resolved_user_id = resolve_user_id(user_id)
        if resolved_user_id is None:
            return 0

        from datetime import timedelta
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT COALESCE(SUM(tokens_used), 0) as total
                    FROM user_activity_log
                    WHERE user_id = :user_id AND timestamp >= :start_date
                """),
                {"user_id": resolved_user_id, "start_date": start_date},
            ).mappings().first()

        return int((result or {}).get("total") or 0)
    except Exception as e:
        logger.error(f"Error getting token usage: {e}")
        return 0
