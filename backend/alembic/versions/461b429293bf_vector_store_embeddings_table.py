"""vector store embeddings table

Revision ID: 461b429293bf
Revises: 1f7b7b570da8
Create Date: 2026-06-21 00:47:34.753113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '461b429293bf'
down_revision: Union[str, Sequence[str], None] = '1f7b7b570da8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# services/vector_store.py owns this table (not a mapped ORM model) because the
# pgvector `vector` column type and HNSW index have no SQLAlchemy model
# equivalent. Schema is created here, once, instead of on every app startup.


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                id          TEXT        NOT NULL,
                collection  TEXT        NOT NULL,
                user_id     TEXT,
                content     TEXT        NOT NULL,
                embedding   TEXT,
                metadata    TEXT        DEFAULT '{}',
                created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (collection, id)
            )
        """)
        op.execute("CREATE INDEX IF NOT EXISTS idx_emb_col_user ON embeddings (collection, user_id)")
        return

    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            id          TEXT        NOT NULL,
            collection  TEXT        NOT NULL,
            user_id     TEXT,
            content     TEXT        NOT NULL,
            embedding   vector(384),
            metadata    JSONB       DEFAULT '{}',
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (collection, id)
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_embeddings_collection_id ON embeddings (collection, id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_emb_col_user ON embeddings (collection, user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_emb_metadata ON embeddings USING GIN (metadata)")

    # Run in a SAVEPOINT: pgvector < 0.5.0 doesn't support HNSW, and a failure
    # here must not abort the outer transaction that created the table above.
    nested = bind.begin_nested()
    try:
        bind.execute(sa.text("""
            CREATE INDEX IF NOT EXISTS idx_emb_hnsw
                ON embeddings USING hnsw (embedding vector_cosine_ops)
                WITH (m=16, ef_construction=64)
        """))
        nested.commit()
    except Exception:
        nested.rollback()


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS embeddings")
