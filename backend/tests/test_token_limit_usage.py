import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from services.token_limits import get_user_token_usage


def test_token_limit_counts_exact_model_usage_not_estimates():
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE user_activity_log (
                    user_id INTEGER NOT NULL,
                    tool_name TEXT NOT NULL,
                    action TEXT,
                    tokens_used INTEGER DEFAULT 0,
                    timestamp DATETIME,
                    metadata TEXT
                )
                """
            )
        )
        now = datetime.now(timezone.utc)
        rows = [
            {
                "user_id": 1,
                "tool_name": "media_notes_ai",
                "action": "ai_generate",
                "tokens_used": 6023,
                "timestamp": now,
                "metadata": json.dumps({"event_type": "ai_usage", "token_source": "model_usage"}),
            },
            {
                "user_id": 1,
                "tool_name": "media_notes_ai",
                "action": "ai_generate",
                "tokens_used": 4350,
                "timestamp": now,
                "metadata": json.dumps({"event_type": "ai_usage", "token_source": "estimated"}),
            },
            {
                "user_id": 1,
                "tool_name": "media_notes_ai",
                "action": "create",
                "tokens_used": 0,
                "timestamp": now,
                "metadata": json.dumps({"event_type": "request", "token_source": "none"}),
            },
        ]
        for row in rows:
            conn.execute(
                text(
                    """
                    INSERT INTO user_activity_log
                    (user_id, tool_name, action, tokens_used, timestamp, metadata)
                    VALUES (:user_id, :tool_name, :action, :tokens_used, :timestamp, :metadata)
                    """
                ),
                row,
            )

    db = Session()
    try:
        assert get_user_token_usage(db, 1, days=30) == 6023
    finally:
        db.close()

