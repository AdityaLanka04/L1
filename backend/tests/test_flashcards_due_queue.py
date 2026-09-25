"""Study Queue endpoint: true counts, review-before-new ordering, FSRS previews, set scope."""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import models  # noqa: E402
from database import Base  # noqa: E402
from routes import flashcards as fr  # noqa: E402


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    assert engine.url.get_backend_name() == "sqlite"
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture()
def seeded(db):
    user = models.User(username="queue_user", email="q@example.com", hashed_password="x")
    db.add(user)
    db.commit()
    bio = models.FlashcardSet(user_id=user.id, title="Bio")
    chem = models.FlashcardSet(user_id=user.id, title="Chem")
    db.add_all([bio, chem])
    db.commit()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    C = models.Flashcard
    db.add_all([
        C(set_id=bio.id, question="new1", answer="a"),
        C(set_id=bio.id, question="new2", answer="a"),
        C(set_id=bio.id, question="overdue", answer="a", sr_state="review", repetitions=3,
          fsrs_stability=5, ease_factor=6, next_review_date=now - timedelta(days=2),
          last_reviewed=now - timedelta(days=7)),
        C(set_id=chem.id, question="future", answer="a", sr_state="review", repetitions=2,
          fsrs_stability=9, ease_factor=3, next_review_date=now + timedelta(days=3)),
        C(set_id=chem.id, question="relearn", answer="a", sr_state="relearning", repetitions=2,
          fsrs_stability=1, ease_factor=8, next_review_date=now - timedelta(minutes=5),
          last_reviewed=now - timedelta(days=1)),
    ])
    db.commit()
    return bio, chem


def test_counts_cover_the_whole_queue_not_just_the_returned_slice(db, seeded):
    result = fr.get_due_flashcards(user_id="queue_user", limit=2, set_id=None, db=db)
    assert result["due_count"] == 4
    assert result["new_count"] == 2
    assert result["review_count"] == 1
    assert result["relearning_count"] == 1
    assert result["total_cards"] == 5
    assert len(result["cards"]) == 2
    assert result["next_due_date"] is not None


def test_reviews_come_before_new_cards(db, seeded):
    result = fr.get_due_flashcards(user_id="queue_user", limit=50, set_id=None, db=db)
    order = [card["sr_state"] for card in result["cards"]]
    assert order.index("new") > max(i for i, s in enumerate(order) if s != "new")


def test_interval_previews_come_from_the_fsrs_scheduler(db, seeded):
    result = fr.get_due_flashcards(user_id="queue_user", limit=50, set_id=None, db=db)
    overdue = next(c for c in result["cards"] if c["question"] == "overdue")
    # A mature card scheduled by FSRS returns after days, never the SM-2 fixed "1m/6m/1d/4d".
    assert overdue["interval_preview"]["again"].endswith("m")
    assert overdue["interval_preview"]["good"] != "1d"


def test_set_scope_and_breakdown(db, seeded):
    _, chem = seeded
    result = fr.get_due_flashcards(user_id="queue_user", limit=50, set_id=chem.id, db=db)
    assert [c["question"] for c in result["cards"]] == ["relearn"]
    breakdown = fr.get_due_flashcards(user_id="queue_user", limit=50, set_id=None, db=db)["set_breakdown"]
    assert {row["title"]: row["due_count"] for row in breakdown} == {"Bio": 3, "Chem": 1}


def test_difficulty_distribution_ignores_unreviewed_cards(db, seeded):
    stats = fr.get_sr_stats(user_id="queue_user", db=db)
    assert stats["difficulty_total"] == 3
    assert sum(b["count"] for b in stats["ease_distribution"]) == 3
