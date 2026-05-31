import logging

logger = logging.getLogger(__name__)
import sqlite3
import json
from datetime import datetime, timezone
import os
from typing import Optional
from activity_context import get_activity_context

DB_PATH = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')

def resolve_user_id(user_id) -> Optional[int]:
    if user_id is None:
        return None
    try:
        return int(user_id)
    except (ValueError, TypeError):
        pass

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ? OR username = ?", (user_id, user_id))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else None
    except Exception:
        return None

def log_activity(user_id, tool_name, action, tokens_used=0, metadata=None):
    try:
        resolved_user_id = resolve_user_id(user_id)
        if resolved_user_id is None:
            return False

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        metadata_json = json.dumps(metadata) if metadata else None
        
        cursor.execute("""
            INSERT INTO user_activity_log 
            (user_id, tool_name, action, tokens_used, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (resolved_user_id, tool_name, action, tokens_used, metadata_json, datetime.now(timezone.utc).isoformat()))
        
        conn.commit()
        conn.close()
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
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        from datetime import timedelta
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        cursor.execute("""
            SELECT SUM(tokens_used) as total
            FROM user_activity_log
            WHERE user_id = ? AND timestamp >= ?
        """, (user_id, start_date.isoformat()))
        
        result = cursor.fetchone()
        conn.close()
        
        return result[0] if result[0] else 0
    except Exception as e:
        logger.error(f"Error getting token usage: {e}")
        return 0
