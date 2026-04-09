"""
reset_db.py — Wipe all tables and recreate them fresh.

Usage:
  python reset_db.py              # uses DATABASE_URL from .env (SQLite or Postgres)
  python reset_db.py --confirm    # skip the confirmation prompt
"""

import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")


def confirm():
    print("\n⚠️  WARNING: This will DELETE ALL DATA in the database.")
    print(f"   Target: {DATABASE_URL[:60]}{'...' if len(DATABASE_URL) > 60 else ''}")
    ans = input("\n   Type YES to continue: ").strip()
    if ans != "YES":
        print("Aborted.")
        sys.exit(0)


def reset():
    from sqlalchemy import create_engine, text
    import models

    engine = create_engine(DATABASE_URL)

    print("\n[1/3] Dropping all tables...")
    models.Base.metadata.drop_all(bind=engine)
    print("      Done.")

    print("[2/3] Recreating all tables...")
    models.Base.metadata.create_all(bind=engine)
    print("      Done.")

    if "sqlite" in DATABASE_URL:
        _apply_sqlite_migrations(engine)

    print("[3/3] Reset complete. Database is clean.\n")


def _apply_sqlite_migrations(engine):
    from sqlalchemy import text

    print("[SQLite] Applying column migrations...")

    sr_cols = {
        "ease_factor": "FLOAT DEFAULT 2.5",
        "interval": "FLOAT DEFAULT 0",
        "repetitions": "INTEGER DEFAULT 0",
        "next_review_date": "DATETIME",
        "lapses": "INTEGER DEFAULT 0",
        "sr_state": "VARCHAR(20) DEFAULT 'new'",
        "learning_step": "INTEGER DEFAULT 0",
        "fsrs_stability": "FLOAT DEFAULT 0.0",
    }
    with engine.connect() as conn:
        existing = {r[1] for r in conn.execute(text("PRAGMA table_info(flashcards)"))}
        for col, typ in sr_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE flashcards ADD COLUMN {col} {typ}"))
        conn.commit()

    gamification_cols = {
        "weekly_chat_goal": "INTEGER DEFAULT 10",
        "weekly_note_goal": "INTEGER DEFAULT 5",
        "weekly_flashcard_goal": "INTEGER DEFAULT 20",
        "weekly_quiz_goal": "INTEGER DEFAULT 5",
    }
    with engine.connect() as conn:
        existing = {r[1] for r in conn.execute(text("PRAGMA table_info(user_gamification_stats)"))}
        for col, typ in gamification_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE user_gamification_stats ADD COLUMN {col} {typ}"))
        conn.commit()

    ctx_cols = {
        "source_name": "VARCHAR(200)",
        "license": "VARCHAR(80)",
        "curriculum": "VARCHAR(20)",
        "source_type": "VARCHAR(40)",
    }
    with engine.connect() as conn:
        existing = {r[1] for r in conn.execute(text("PRAGMA table_info(context_documents)"))}
        for col, typ in ctx_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE context_documents ADD COLUMN {col} {typ}"))
        conn.commit()

    with engine.connect() as conn:
        profile_cols = {r[1] for r in conn.execute(text("PRAGMA table_info(comprehensive_user_profiles)"))}
        if "notifications_enabled" not in profile_cols:
            conn.execute(text("ALTER TABLE comprehensive_user_profiles ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1"))
        conn.commit()

    print("[SQLite] Column migrations done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()

    if not args.confirm:
        confirm()

    reset()
