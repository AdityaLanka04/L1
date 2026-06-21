"""backfill legacy storage columns and widen picture_url

Revision ID: d221672e81ec
Revises: 8daf5b6d92ed
Create Date: 2026-06-21 01:15:55.581635

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd221672e81ec'
down_revision: Union[str, Sequence[str], None] = '8daf5b6d92ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Databases created before storage_service.py existed (or before
# users.picture_url was widened in the model) predate the baseline revision
# and won't have these — the old per-request lazy-ALTER code in
# routes/context.py, question_bank/routes.py used to patch this in on first
# use. Fresh databases created from the baseline already have all of this
# from the CREATE TABLE statements, so these checks are no-ops there.
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
        existing_columns = {c["name"] for c in inspector.get_columns(table)}
        with op.batch_alter_table(table, schema=None) as batch_op:
            for name, column in _STORAGE_COLUMNS.items():
                if name not in existing_columns:
                    batch_op.add_column(column.copy())

    # SQLite has no real column type enforcement (VARCHAR(255) and TEXT are
    # both TEXT-affinity, unbounded) so widening there would just be a risky
    # full-table rebuild — `users` has many FK-dependent child tables — for
    # zero behavioral change. Postgres actually enforces the bound, so only
    # widen there, same as the original migration.py logic.
    if bind.dialect.name != "sqlite" and "users" in existing_tables:
        users_columns = {c["name"]: c for c in inspector.get_columns("users")}
        picture_url = users_columns.get("picture_url")
        if picture_url is not None and not isinstance(picture_url["type"], sa.Text):
            op.execute("ALTER TABLE users ALTER COLUMN picture_url TYPE TEXT")


def downgrade() -> None:
    # Widening a column / adding nullable columns is not worth reverting;
    # narrowing picture_url back could truncate data written since upgrade.
    pass
