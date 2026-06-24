"""add public uids for notes/quizzes and backfill chat/flashcard tokens

Revision ID: a3f9c1d6b2e4
Revises: d221672e81ec
Create Date: 2026-06-23 00:00:00.000000

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f9c1d6b2e4'
down_revision: Union[str, Sequence[str], None] = 'd221672e81ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Gives notes and solo_quizzes the same kind of long opaque public id that
# chat_sessions.public_token / flashcard_sets.public_token already had, so
# frontend URLs can use a non-sequential identifier instead of the raw
# integer PK. New rows get one automatically (model-level default); this
# migration adds the column for existing tables and backfills existing rows.

_NEW_UID_TABLES = ("notes", "solo_quizzes")
_EXISTING_TOKEN_COLUMNS = {
    "chat_sessions": "public_token",
    "flashcard_sets": "public_token",
}


def _generate_unique_token(existing: set) -> str:
    while True:
        token = secrets.token_urlsafe(16)
        if token not in existing:
            existing.add(token)
            return token


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in _NEW_UID_TABLES:
        if table not in existing_tables:
            continue
        existing_columns = {c["name"] for c in inspector.get_columns(table)}
        if "uid" not in existing_columns:
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.add_column(sa.Column("uid", sa.String(length=32), nullable=True))
            op.create_index(f"ix_{table}_uid", table, ["uid"], unique=True)

    backfill_targets = list(_NEW_UID_TABLES) + list(_EXISTING_TOKEN_COLUMNS.keys())
    for table in backfill_targets:
        if table not in existing_tables:
            continue
        column = _EXISTING_TOKEN_COLUMNS.get(table, "uid")
        rows = bind.execute(sa.text(f"SELECT id FROM {table} WHERE {column} IS NULL OR {column} = ''")).fetchall()
        if not rows:
            continue
        existing_tokens = {
            row[0]
            for row in bind.execute(sa.text(f"SELECT {column} FROM {table} WHERE {column} IS NOT NULL")).fetchall()
        }
        for (row_id,) in rows:
            token = _generate_unique_token(existing_tokens)
            bind.execute(
                sa.text(f"UPDATE {table} SET {column} = :token WHERE id = :id"),
                {"token": token, "id": row_id},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table in _NEW_UID_TABLES:
        if table not in existing_tables:
            continue
        existing_columns = {c["name"] for c in inspector.get_columns(table)}
        if "uid" in existing_columns:
            op.drop_index(f"ix_{table}_uid", table_name=table)
            with op.batch_alter_table(table, schema=None) as batch_op:
                batch_op.drop_column("uid")
