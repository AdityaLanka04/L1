import logging

logger = logging.getLogger(__name__)
import json
from datetime import datetime, timezone
from typing import Optional
from threading import Lock
from sqlalchemy import text
from activity_context import get_activity_context
from database import DATABASE_URL, engine
from services.subscription_catalog import get_plan, normalize_plan_id

_ACTIVITY_TABLE_READY = False
_ACTIVITY_TABLE_LOCK = Lock()
_IS_POSTGRES = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL
_TOKEN_WARNING_MIN_REMAINING = 25_000
_TOKEN_CRITICAL_REMAINING = 10_000

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
    logged = log_activity(user_id, effective_tool_name, 'ai_generate', total_tokens, base_metadata)
    if logged:
        _maybe_create_token_usage_notifications(user_id, total_tokens)
    return logged

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

def _format_token_count(value: int) -> str:
    return f"{max(0, int(value or 0)):,}"

def _token_notification_exists(conn, user_id: int, notification_type: str, period_start: datetime) -> bool:
    result = conn.execute(
        text("""
            SELECT id
            FROM notifications
            WHERE user_id = :user_id
              AND notification_type = :notification_type
              AND created_at >= :period_start
            LIMIT 1
        """),
        {
            "user_id": user_id,
            "notification_type": notification_type,
            "period_start": period_start,
        },
    ).first()
    return result is not None

def _insert_token_notification(
    conn,
    user_id: int,
    notification_type: str,
    title: str,
    message: str,
):
    conn.execute(
        text("""
            INSERT INTO notifications
            (user_id, title, message, notification_type, is_read, created_at)
            VALUES (:user_id, :title, :message, :notification_type, :is_read, :created_at)
        """),
        {
            "user_id": user_id,
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "is_read": False,
            "created_at": datetime.now(timezone.utc),
        },
    )

def _maybe_create_token_usage_notifications(user_id, total_tokens):
    try:
        if int(total_tokens or 0) <= 0:
            return

        resolved_user_id = resolve_user_id(user_id)
        if resolved_user_id is None:
            return

        total_used = get_user_token_usage(resolved_user_id, days=30)
        with engine.begin() as conn:
            profile = conn.execute(
                text("""
                    SELECT cp.subscription_tier
                    FROM users u
                    LEFT JOIN comprehensive_user_profiles cp ON cp.user_id = u.id
                    WHERE u.id = :user_id
                    LIMIT 1
                """),
                {"user_id": resolved_user_id},
            ).mappings().first()

            plan_id = normalize_plan_id((profile or {}).get("subscription_tier"))
            plan = get_plan(plan_id)
            if plan.get("unlimited"):
                return

            included_tokens = int(plan.get("included_tokens_monthly") or 0)
            if included_tokens <= 0:
                return

            remaining_tokens = max(0, included_tokens - total_used)
            warning_threshold = max(_TOKEN_WARNING_MIN_REMAINING, int(included_tokens * 0.10))
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            plan_name = plan.get("name") or plan_id.title()

            notifications = []
            if remaining_tokens <= 0:
                notifications.append((
                    "token_usage_exhausted",
                    "AI token limit reached",
                    (
                        f"You've used all {_format_token_count(included_tokens)} monthly AI tokens "
                        f"on {plan_name}. Upgrade now to keep using AI features."
                    ),
                ))
            elif remaining_tokens <= _TOKEN_CRITICAL_REMAINING:
                notifications.append((
                    "token_usage_critical",
                    "Only 10K AI tokens left",
                    (
                        f"You have about {_format_token_count(remaining_tokens)} monthly AI tokens left "
                        f"on {plan_name}. Upgrade now to avoid hitting your limit."
                    ),
                ))
            elif remaining_tokens <= warning_threshold:
                notifications.append((
                    "token_usage_warning",
                    "AI tokens are running low",
                    (
                        f"You've used {_format_token_count(total_used)} of "
                        f"{_format_token_count(included_tokens)} monthly AI tokens on {plan_name}. "
                        f"About {_format_token_count(remaining_tokens)} tokens remain."
                    ),
                ))

            for notification_type, title, message in notifications:
                if _token_notification_exists(conn, resolved_user_id, notification_type, period_start):
                    continue
                _insert_token_notification(
                    conn,
                    resolved_user_id,
                    notification_type,
                    title,
                    message,
                )
    except Exception as e:
        logger.error(f"Error creating token usage notification: {e}")
