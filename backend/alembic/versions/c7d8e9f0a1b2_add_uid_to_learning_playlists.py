"""add uid to learning_playlists

Revision ID: c7d8e9f0a1b2
Revises: b6c8d2f4a901
Create Date: 2026-06-29 00:00:00.000000

"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b6c8d2f4a901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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

    if 'learning_playlists' not in existing_tables:
        return

    existing_columns = {c["name"] for c in inspector.get_columns('learning_playlists')}
    if 'uid' not in existing_columns:
        with op.batch_alter_table('learning_playlists', schema=None) as batch_op:
            batch_op.add_column(sa.Column('uid', sa.String(length=32), nullable=True))
        op.create_index('ix_learning_playlists_uid', 'learning_playlists', ['uid'], unique=True)

    rows = bind.execute(
        sa.text("SELECT id FROM learning_playlists WHERE uid IS NULL OR uid = ''")
    ).fetchall()

    if rows:
        existing_tokens = {
            row[0]
            for row in bind.execute(
                sa.text("SELECT uid FROM learning_playlists WHERE uid IS NOT NULL AND uid != ''")
            ).fetchall()
        }
        for (row_id,) in rows:
            token = _generate_unique_token(existing_tokens)
            bind.execute(
                sa.text("UPDATE learning_playlists SET uid = :token WHERE id = :id"),
                {"token": token, "id": row_id},
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if 'learning_playlists' not in existing_tables:
        return
    existing_columns = {c["name"] for c in inspector.get_columns('learning_playlists')}
    if 'uid' in existing_columns:
        op.drop_index('ix_learning_playlists_uid', table_name='learning_playlists')
        with op.batch_alter_table('learning_playlists', schema=None) as batch_op:
            batch_op.drop_column('uid')
