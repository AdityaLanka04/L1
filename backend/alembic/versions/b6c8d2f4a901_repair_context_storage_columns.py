"""repair missing document storage columns

Revision ID: b6c8d2f4a901
Revises: a3f9c1d6b2e4
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b6c8d2f4a901"
down_revision: Union[str, Sequence[str], None] = "a3f9c1d6b2e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STORAGE_COLUMNS = {
    "storage_path": sa.Column("storage_path", sa.String(length=500), nullable=True),
    "storage_type": sa.Column("storage_type", sa.String(length=30), nullable=True),
    "storage_url": sa.Column("storage_url", sa.String(length=1000), nullable=True),
}
_STORAGE_TABLES = ("context_documents", "uploaded_documents")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table in _STORAGE_TABLES:
        if table not in existing_tables:
            continue
        existing_columns = {column["name"] for column in inspector.get_columns(table)}
        missing_columns = [
            column.copy()
            for name, column in _STORAGE_COLUMNS.items()
            if name not in existing_columns
        ]
        if not missing_columns:
            continue
        with op.batch_alter_table(table, schema=None) as batch_op:
            for column in missing_columns:
                batch_op.add_column(column)


def downgrade() -> None:
    pass
