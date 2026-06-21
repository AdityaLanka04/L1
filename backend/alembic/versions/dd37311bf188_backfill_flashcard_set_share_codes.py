"""backfill flashcard set share codes

Revision ID: dd37311bf188
Revises: 461b429293bf
Create Date: 2026-06-21 00:48:36.563922

"""
import random
import string
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd37311bf188'
down_revision: Union[str, Sequence[str], None] = '461b429293bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# One-time data backfill: every flashcard_sets row needs a share_code for the
# share-link feature to work. New rows get one at creation time (app code);
# this only covers rows that existed before that field was introduced.


def upgrade() -> None:
    bind = op.get_bind()

    rows = bind.execute(
        sa.text("SELECT id FROM flashcard_sets WHERE share_code IS NULL OR share_code = ''")
    ).fetchall()
    if not rows:
        return

    existing_codes = {
        row[0]
        for row in bind.execute(
            sa.text("SELECT share_code FROM flashcard_sets WHERE share_code IS NOT NULL")
        ).fetchall()
    }

    alphabet = string.ascii_uppercase + string.digits
    for (set_id,) in rows:
        while True:
            code = ''.join(random.choices(alphabet, k=6))
            if code not in existing_codes:
                existing_codes.add(code)
                break
        bind.execute(
            sa.text("UPDATE flashcard_sets SET share_code = :code WHERE id = :id"),
            {"code": code, "id": set_id},
        )


def downgrade() -> None:
    # Data-only migration; no schema to revert. Leaving generated share codes
    # in place on downgrade is intentional (they're harmless, and other rows
    # may already be relying on them for shared links).
    pass
