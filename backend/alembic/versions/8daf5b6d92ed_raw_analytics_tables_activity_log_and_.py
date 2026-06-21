"""raw analytics tables: activity log and api key pool usage

Revision ID: 8daf5b6d92ed
Revises: 7b8d046a21ec
Create Date: 2026-06-21 00:56:39.541770

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8daf5b6d92ed'
down_revision: Union[str, Sequence[str], None] = '7b8d046a21ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# These two tables (activity_logger.py, services/api_key_pool.py) are plain
# analytics/usage tables with no SQLAlchemy ORM model, previously created
# ad hoc on first use. Moved here so they're guaranteed to exist before the
# app serves any request, same as the `embeddings` table.


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("""
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
        """)
    else:
        op.execute("""
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
        """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_log(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON user_activity_log(timestamp)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_activity_session ON user_activity_log(session_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS api_key_pool_usage (
            provider VARCHAR(64) NOT NULL,
            key_fingerprint VARCHAR(64) NOT NULL,
            usage_day VARCHAR(10) NOT NULL,
            daily_limit INTEGER NOT NULL,
            used_tokens INTEGER NOT NULL DEFAULT 0,
            exhausted_until VARCHAR(40),
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY (provider, key_fingerprint, usage_day)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS api_key_pool_usage")
    op.execute("DROP TABLE IF EXISTS user_activity_log")
