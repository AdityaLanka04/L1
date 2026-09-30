"""Model-backed weakness score (services/weakness_model.py) and its wiring into
flashcards, question-bank practice, chat and the Weaknesses analysis.

Run:  cd backend && python -m pytest tests/test_weakness_model.py -v
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
_scratch = tempfile.TemporaryDirectory(prefix="cerbyl-weakness-model-")
os.environ["DATABASE_URL"] = f"sqlite:///{_scratch.name}/test.db"
os.environ.setdefault("SECRET_KEY", "test-only-secret-not-used-to-contact-any-service")

import models  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from services import weakness_model  # noqa: E402
from services.adaptive_quiz import _apply_answer_to_weak_area, _get_or_create_weak_area, record_flashcard_review  # noqa: E402
from services.comprehensive_weakness_analyzer import get_comprehensive_weakness_analysis  # noqa: E402
from question_bank.utils import _update_weak_areas  # noqa: E402
from tutor.prompt import _student_section  # noqa: E402
from tutor.state import StudentState  # noqa: E402

SET_TOPIC = "Flashcards: implicit differentiation"
KEY = "implicit_differentiation"


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def user(db):
    u = models.User(username="learner", email="learner@example.invalid", hashed_password="test")
    db.add(u)
    db.commit()
    return u


def review(db, user, correct, topic=SET_TOPIC, question="How would you compute $\\frac{d^2y}{dx^2}$ for $x^3+y^3=6$?"):
    record_flashcard_review(
        db, user.id, topic, is_correct=correct, question_text=question,
        correct_answer="Differentiate $dy/dx$ implicitly again", flashcard_id=1,
    )
    db.commit()
    return db.query(models.UserWeakArea).filter_by(user_id=user.id, topic=topic).one()


def state_for(db, user, key=KEY):
    return db.query(models.StudentKnowledgeState).filter_by(user_id=user.id, concept_id=key).one()


def test_topic_label_and_key_strip_set_prefixes():
    assert weakness_model.topic_label("Flashcards: implicit differentiation") == "implicit differentiation"
    assert weakness_model.topic_label("AI Generated: Flashcards:  Chain  Rule") == "Chain Rule"
    assert weakness_model.concept_key("Flashcards: Implicit Differentiation") == KEY


def test_bkt_step_moves_the_right_way():
    assert weakness_model.bkt_step(0.4, True, 0.09, 0.1, 0.2) > 0.4
    assert weakness_model.bkt_step(0.4, False, 0.09, 0.1, 0.2) < 0.4


def test_flashcard_reviews_train_the_model_and_drive_the_score(db, user):
    area = review(db, user, False)
    after_miss = area.weakness_score
    assert state_for(db, user).interaction_count == 1
    assert after_miss >= 75  # prior 0.1 mastery, then a miss

    area = review(db, user, True)
    area = review(db, user, True)
    assert area.weakness_score < after_miss - 40
    assert state_for(db, user).interaction_count == 3
    assert area.total_questions == 3 and area.correct_count == 2

    area = review(db, user, False)
    assert area.weakness_score > weakness_model.score_from_mastery(0.9)
    assert area.consecutive_wrong == 1
    # Stored score is exactly the model's current belief.
    assert area.weakness_score == weakness_model.score_from_mastery(
        weakness_model.combined_mastery(state_for(db, user), area.correct_count, area.total_questions)
    )


def test_repeated_success_eventually_marks_topic_mastered(db, user):
    for _ in range(6):
        area = review(db, user, True)
    assert area.status == "mastered"
    assert weakness_model.ranked_weaknesses(db, user.id) == []
    assert weakness_model.ranked_weaknesses(db, user.id, include_mastered=True)[0]["label"] == "implicit differentiation"


def test_forgetting_raises_the_live_score(db, user):
    for _ in range(3):
        area = review(db, user, True)
    stored = area.weakness_score
    state = state_for(db, user)
    state.last_updated = datetime.now(timezone.utc) - timedelta(days=45)
    db.commit()
    live = weakness_model.ranked_weaknesses(db, user.id)[0]["weakness_score"]
    assert live > stored


def test_message_matching_uses_stems_not_exact_titles():
    assert weakness_model.matches_message("implicit differentiation", "can you help me implicitly differentiate x^2 + y^2 = 1")
    assert weakness_model.matches_message("implicit differentiation", "Explain implicit differentiation")
    assert not weakness_model.matches_message("implicit differentiation", "how do I differentiate sin(x)?")
    assert not weakness_model.matches_message("implicit differentiation", "what is photosynthesis")
    assert weakness_model.matches_message("Photosynthesis", "photosynthesis in C4 plants")


def test_weaknesses_for_message_returns_score_and_the_missed_cards(db, user):
    review(db, user, False)
    review(db, user, False)
    matched = weakness_model.weaknesses_for_message(db, user.id, "I'm stuck on implicit differentiation")
    assert len(matched) == 1
    item = matched[0]
    assert item["label"] == "implicit differentiation"
    assert item["weakness_score"] >= 75
    assert item["sources"] == ["flashcard"]
    assert "frac{d^2y}" in item["recent_misses"][0]["question"]
    assert weakness_model.weaknesses_for_message(db, user.id, "tell me about photosynthesis") == []


def test_tutor_prompt_cites_score_and_missed_items(db, user):
    review(db, user, False)
    student = StudentState(user_id=str(user.id))
    student.weakness_scores = weakness_model.ranked_weaknesses(db, user.id)
    student.matched_weaknesses = weakness_model.weaknesses_for_message(db, user.id, "implicit differentiation please")
    student.weaknesses = [item["label"] for item in student.weakness_scores]

    text = _student_section(student, intent="question")
    score = round(student.matched_weaknesses[0]["weakness_score"])
    assert f"implicit differentiation (weakness {score}/100)" in text
    assert "[TRACKED WEAKNESSES" in text
    assert "missed: How would you compute" in text
    assert "0/1 correct across flashcards" in text

    # Greetings and context-only answers stay free of weakness talk.
    assert "[TRACKED WEAKNESSES" not in _student_section(student, intent="greeting")
    assert "[TRACKED WEAKNESSES" not in _student_section(student, intent="question", context_only=True)


def test_chat_path_does_not_double_count_a_fresh_graph_update(db, user):
    area = _get_or_create_weak_area(db, user.id, "implicit differentiation")
    # tutor graph's own BKT update for this answer, moments ago
    weakness_model.observe(db, user.id, "implicit differentiation", False)
    db.commit()
    _apply_answer_to_weak_area(area, False, already_modelled=True)
    db.commit()
    assert state_for(db, user).interaction_count == 1
    assert area.total_questions == 1
    assert area.weakness_score == weakness_model.score_from_mastery(
        weakness_model.combined_mastery(state_for(db, user), area.correct_count, area.total_questions)
    )


def test_question_bank_practice_uses_the_same_model(db, user):
    results = [
        {"topic": "Implicit Differentiation", "is_correct": False, "question_text": "d/dx of y^2?", "correct_answer": "2y y'"},
        {"topic": "Implicit Differentiation", "is_correct": True, "question_text": "q2"},
    ]
    asyncio.run(_update_weak_areas(db, user.id, results, models))
    area = db.query(models.UserWeakArea).filter_by(user_id=user.id, topic="Implicit Differentiation").one()
    state = state_for(db, user)
    assert state.interaction_count == 2
    assert area.weakness_score == weakness_model.score_from_mastery(
        weakness_model.combined_mastery(state, area.correct_count, area.total_questions)
    )
    assert db.query(models.WrongAnswerLog).filter_by(user_id=user.id).count() == 1


def test_flashcards_and_quiz_on_the_same_topic_share_one_model_row(db, user):
    review(db, user, False)  # "Flashcards: implicit differentiation"
    asyncio.run(_update_weak_areas(db, user.id, [{"topic": "implicit differentiation", "is_correct": False}], models))
    assert db.query(models.StudentKnowledgeState).filter_by(user_id=user.id).count() == 1
    assert state_for(db, user).interaction_count == 2


def test_model_failure_falls_back_to_formula_without_losing_the_answer(db, user, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("model down")

    monkeypatch.setattr(weakness_model, "observe", boom)
    area = review(db, user, False)
    assert area.total_questions == 1 and area.incorrect_count == 1
    assert area.weakness_score == pytest.approx(62.0)  # 100*0.5 + streak 10 + volume 2


def test_weakness_analysis_reports_live_model_score(db, user):
    review(db, user, False)
    review(db, user, False)
    result = get_comprehensive_weakness_analysis(db, user.id, models)
    areas = [a for group in result["weak_areas"].values() for a in group]
    assert len(areas) == 1
    area = areas[0]
    assert area["label"] == "implicit differentiation"
    assert area["score_model"] == "bkt"
    assert area["category"] == "critical"
    assert area["sources"] == ["flashcard"]
    assert area["weakness_score"] == weakness_model.ranked_weaknesses(db, user.id)[0]["weakness_score"]


# --- Smarter score function -------------------------------------------------

def test_quiz_evidence_counts_more_than_self_graded_flashcards():
    p = 0.3
    flashcard = weakness_model.bkt_step(p, 1.0, 0.09, *weakness_model.evidence_params("flashcard", None))
    quiz = weakness_model.bkt_step(p, 1.0, 0.09, *weakness_model.evidence_params("quiz", None))
    chat = weakness_model.bkt_step(p, 1.0, 0.09, *weakness_model.evidence_params("chat", None))
    assert flashcard < quiz < chat


def test_hard_correct_beats_easy_correct_and_easy_miss_hurts_more():
    p = 0.4
    hard_right = weakness_model.bkt_step(p, 1.0, 0.09, *weakness_model.evidence_params("quiz", "hard"))
    easy_right = weakness_model.bkt_step(p, 1.0, 0.09, *weakness_model.evidence_params("quiz", "easy"))
    assert hard_right > easy_right
    hard_miss = weakness_model.bkt_step(p, 0.0, 0.09, *weakness_model.evidence_params("quiz", "hard"))
    easy_miss = weakness_model.bkt_step(p, 0.0, 0.09, *weakness_model.evidence_params("quiz", "easy"))
    assert easy_miss < hard_miss


def test_partial_credit_sits_between_a_miss_and_a_full_hit():
    params = weakness_model.evidence_params("flashcard", None)
    miss = weakness_model.bkt_step(0.4, 0.0, 0.09, *params)
    hard = weakness_model.bkt_step(0.4, weakness_model.GRADE_CREDIT["hard"], 0.09, *params)
    good = weakness_model.bkt_step(0.4, weakness_model.GRADE_CREDIT["good"], 0.09, *params)
    easy = weakness_model.bkt_step(0.4, 1.0, 0.09, *params)
    assert miss < hard < good < easy


def test_a_short_lucky_streak_cannot_erase_a_pattern_of_misses(db, user):
    for _ in range(3):
        review(db, user, False)
    area = review(db, user, True)
    area = review(db, user, True)
    # 2/5 correct: still clearly weak, not "improving".
    assert area.weakness_score >= 40
    assert area.status == "needs_practice"
    bkt_only = weakness_model.score_from_mastery(weakness_model.decayed_mastery(state_for(db, user)))
    assert area.weakness_score > bkt_only


def test_sr_grades_feed_partial_credit(db, user):
    record_flashcard_review(db, user.id, SET_TOPIC, is_correct=False, question_text="q", correct_answer="a",
                            flashcard_id=1, credit=weakness_model.GRADE_CREDIT["hard"])
    db.commit()
    hard_state = state_for(db, user).p_mastery
    assert weakness_model.P_MASTERY_PRIOR < hard_state  # "hard" is partial success, not a full miss


def test_ranked_weaknesses_reports_confidence_and_trend(db, user):
    review(db, user, False)
    item = weakness_model.ranked_weaknesses(db, user.id)[0]
    assert item["confidence"] == "low" and item["trend"] == "new"
    for _ in range(3):
        review(db, user, True)
    item = weakness_model.ranked_weaknesses(db, user.id, include_mastered=True)[0]
    assert item["confidence"] == "medium"
    assert item["trend"] == "improving"


# --- Notes on a weak topic --------------------------------------------------

def test_note_focus_finds_the_weak_topic_from_note_html(db, user):
    review(db, user, False)
    items, block = weakness_model.note_focus(
        db, user.id, "Calc 1 notes", "<h2>Implicit differentiation</h2><p>Differentiate both sides...</p>",
    )
    assert [i["label"] for i in items] == ["implicit differentiation"]
    assert "STUDENT WEAK SPOT" in block
    assert "missed: How would you compute" in block
    assert "## Check yourself" in block
    assert weakness_model.note_focus(db, user.id, "Photosynthesis", "<p>Light reactions</p>") == ([], "")


def test_note_agent_prompt_has_a_weak_spot_action():
    from routes.notes import NoteAgentRequest, _build_note_agent_prompt

    prompt = _build_note_agent_prompt(NoteAgentRequest(
        user_id="learner", action="weak_spot", content="<p>implicit differentiation notes</p>",
        context="<p>implicit differentiation notes</p>",
    ))
    assert "Write ONE new section" in prompt
    assert "Context:" not in prompt  # the note itself is already the input


def test_a_miss_right_after_a_good_run_reads_as_slipping(db, user):
    for correct in (False, False, True, False):
        review(db, user, correct)
    assert weakness_model.ranked_weaknesses(db, user.id)[0]["trend"] == "slipping"
