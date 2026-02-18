"""
Spaced Repetition Algorithm (SM-2 variant)

Based on the SuperMemo 2 algorithm with Anki-style enhancements:
- 4-grade system: Again (0), Hard (1), Good (2), Easy (3)
- Card states: new → learning → review (graduated). On lapse: review → relearning → review
- Per-card ease factor that adapts over time
- Learning steps for new/relearning cards
- Fuzz factor to prevent review clustering
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Optional

# --- Card States ---
STATE_NEW = "new"
STATE_LEARNING = "learning"
STATE_REVIEW = "review"
STATE_RELEARNING = "relearning"

# --- Grades ---
GRADE_AGAIN = 0
GRADE_HARD = 1
GRADE_GOOD = 2
GRADE_EASY = 3

GRADE_MAP = {"again": GRADE_AGAIN, "hard": GRADE_HARD, "good": GRADE_GOOD, "easy": GRADE_EASY}

# --- Configuration ---
DEFAULT_EASE = 2.5
MIN_EASE = 1.3
LEARNING_STEPS_MINUTES = [1, 10]       # minutes between learning steps
RELEARNING_STEPS_MINUTES = [10]        # minutes for relearning
GRADUATING_INTERVAL_DAYS = 1           # interval when card graduates from learning
EASY_INTERVAL_DAYS = 4                 # interval when Easy is pressed on a learning card
HARD_INTERVAL_MULTIPLIER = 1.2         # multiplier for Hard on review cards
EASY_BONUS = 1.3                       # extra multiplier for Easy on review cards
LAPSE_INTERVAL_PERCENT = 0.0           # on lapse, new interval = old * this (0 = reset)
LAPSE_MIN_INTERVAL_DAYS = 1            # minimum interval after lapse
MAX_INTERVAL_DAYS = 365 * 2            # cap at 2 years


def _apply_fuzz(interval_days: float) -> float:
    """Add ±5% random fuzz to intervals > 2 days to prevent clustering."""
    if interval_days <= 2:
        return interval_days
    fuzz = interval_days * 0.05
    return max(1, interval_days + random.uniform(-fuzz, fuzz))


def _clamp_ease(ease: float) -> float:
    return max(MIN_EASE, round(ease, 2))


def _minutes_to_days(minutes: float) -> float:
    return minutes / (60 * 24)


def calculate_next_review(
    sr_state: str,
    ease_factor: float,
    interval: float,
    repetitions: int,
    lapses: int,
    grade: int,
    learning_step: int = 0,
) -> dict:
    """
    Calculate the next review schedule based on the SM-2 algorithm.

    Args:
        sr_state: Current card state (new/learning/review/relearning)
        ease_factor: Current ease factor (default 2.5)
        interval: Current interval in days
        repetitions: Consecutive correct answers in review state
        lapses: Number of times card lapsed from review
        grade: Review grade (0=again, 1=hard, 2=good, 3=easy)
        learning_step: Current position in learning/relearning steps

    Returns:
        dict with: new_state, new_ease, new_interval, new_repetitions,
                   new_lapses, new_learning_step, next_review_date
    """
    now = datetime.now(timezone.utc)
    new_ease = ease_factor
    new_interval = interval
    new_reps = repetitions
    new_lapses = lapses
    new_step = learning_step
    new_state = sr_state

    if sr_state in (STATE_NEW, STATE_LEARNING):
        new_state, new_ease, new_interval, new_reps, new_step = _handle_learning(
            ease_factor, grade, learning_step, LEARNING_STEPS_MINUTES
        )

    elif sr_state == STATE_REVIEW:
        new_state, new_ease, new_interval, new_reps, new_lapses, new_step = _handle_review(
            ease_factor, interval, repetitions, lapses, grade
        )

    elif sr_state == STATE_RELEARNING:
        new_state, new_ease, new_interval, new_reps, new_step = _handle_relearning(
            ease_factor, interval, grade, learning_step
        )

    # Clamp values
    new_ease = _clamp_ease(new_ease)
    new_interval = min(new_interval, MAX_INTERVAL_DAYS)
    if new_interval < 0:
        new_interval = 0

    # Calculate next review datetime
    if new_interval < 1:
        # Sub-day interval (learning steps) - add minutes
        minutes = new_interval * 24 * 60
        next_review = now + timedelta(minutes=max(1, minutes))
    else:
        # Day-level interval - apply fuzz
        fuzzed = _apply_fuzz(new_interval)
        next_review = now + timedelta(days=fuzzed)

    return {
        "new_state": new_state,
        "new_ease": new_ease,
        "new_interval": round(new_interval, 4),
        "new_repetitions": new_reps,
        "new_lapses": new_lapses,
        "new_learning_step": new_step,
        "next_review_date": next_review,
    }


def _handle_learning(
    ease: float, grade: int, step: int, steps: list[int]
) -> tuple[str, float, float, int, int]:
    """Handle learning/new card review."""
    if grade == GRADE_AGAIN:
        # Reset to first step
        return STATE_LEARNING, ease, _minutes_to_days(steps[0]), 0, 0

    if grade == GRADE_HARD:
        # Stay at current step, use average of current and next
        if step < len(steps) - 1:
            avg_minutes = (steps[step] + steps[step + 1]) / 2
        else:
            avg_minutes = steps[step] * 1.5
        return STATE_LEARNING, ease, _minutes_to_days(avg_minutes), 0, step

    if grade == GRADE_GOOD:
        # Advance to next step, or graduate
        next_step = step + 1
        if next_step >= len(steps):
            # Graduate to review
            return STATE_REVIEW, ease, GRADUATING_INTERVAL_DAYS, 1, 0
        return STATE_LEARNING, ease, _minutes_to_days(steps[next_step]), 0, next_step

    if grade == GRADE_EASY:
        # Graduate immediately with easy interval
        return STATE_REVIEW, ease + 0.15, EASY_INTERVAL_DAYS, 1, 0

    return STATE_LEARNING, ease, _minutes_to_days(steps[0]), 0, 0


def _handle_review(
    ease: float, interval: float, reps: int, lapses: int, grade: int
) -> tuple[str, float, float, int, int, int]:
    """Handle review card grading."""
    if grade == GRADE_AGAIN:
        # Lapse: go to relearning
        new_ease = ease - 0.20
        new_interval = max(LAPSE_MIN_INTERVAL_DAYS, interval * LAPSE_INTERVAL_PERCENT)
        return STATE_RELEARNING, new_ease, new_interval, 0, lapses + 1, 0

    if grade == GRADE_HARD:
        new_ease = ease - 0.15
        new_interval = max(1, interval * HARD_INTERVAL_MULTIPLIER)
        return STATE_REVIEW, new_ease, new_interval, reps + 1, lapses, 0

    if grade == GRADE_GOOD:
        new_interval = max(1, interval * ease)
        return STATE_REVIEW, ease, new_interval, reps + 1, lapses, 0

    if grade == GRADE_EASY:
        new_ease = ease + 0.15
        new_interval = max(1, interval * ease * EASY_BONUS)
        return STATE_REVIEW, new_ease, new_interval, reps + 1, lapses, 0

    return STATE_REVIEW, ease, interval, reps, lapses, 0


def _handle_relearning(
    ease: float, interval: float, grade: int, step: int
) -> tuple[str, float, float, int, int]:
    """Handle relearning card review."""
    steps = RELEARNING_STEPS_MINUTES

    if grade == GRADE_AGAIN:
        # Reset to first relearning step
        return STATE_RELEARNING, ease, _minutes_to_days(steps[0]), 0, 0

    if grade == GRADE_HARD:
        if step < len(steps) - 1:
            avg = (steps[step] + steps[step + 1]) / 2
        else:
            avg = steps[step] * 1.5
        return STATE_RELEARNING, ease, _minutes_to_days(avg), 0, step

    if grade == GRADE_GOOD:
        next_step = step + 1
        if next_step >= len(steps):
            # Return to review with the lapsed interval (min 1 day)
            return STATE_REVIEW, ease, max(LAPSE_MIN_INTERVAL_DAYS, interval), 1, 0
        return STATE_RELEARNING, ease, _minutes_to_days(steps[next_step]), 0, next_step

    if grade == GRADE_EASY:
        # Return to review immediately with a boosted interval
        new_interval = max(LAPSE_MIN_INTERVAL_DAYS, interval) * 1.5
        return STATE_REVIEW, ease + 0.15, new_interval, 1, 0

    return STATE_RELEARNING, ease, _minutes_to_days(steps[0]), 0, 0


def preview_intervals(
    sr_state: str,
    ease_factor: float,
    interval: float,
    repetitions: int,
    lapses: int,
    learning_step: int = 0,
) -> dict[str, str]:
    """
    Calculate what interval each grade would produce, returning human-readable strings.
    Used to show "1m / 10m / 1d / 4d" on the grade buttons.
    """
    previews = {}
    for grade_name, grade_val in GRADE_MAP.items():
        result = calculate_next_review(
            sr_state, ease_factor, interval, repetitions, lapses, grade_val, learning_step
        )
        previews[grade_name] = _format_interval(result["new_interval"], result["new_state"])
    return previews


def _format_interval(interval_days: float, state: str) -> str:
    """Convert interval in days to human-readable string."""
    if interval_days <= 0:
        return "<1m"

    total_minutes = interval_days * 24 * 60

    if total_minutes < 60:
        m = max(1, round(total_minutes))
        return f"{m}m"
    if total_minutes < 24 * 60:
        h = round(total_minutes / 60, 1)
        if h == int(h):
            return f"{int(h)}h"
        return f"{h}h"
    if interval_days < 30:
        d = round(interval_days, 1)
        if d == int(d):
            return f"{int(d)}d"
        return f"{d}d"
    if interval_days < 365:
        mo = round(interval_days / 30, 1)
        if mo == int(mo):
            return f"{int(mo)}mo"
        return f"{mo}mo"

    y = round(interval_days / 365, 1)
    if y == int(y):
        return f"{int(y)}y"
    return f"{y}y"
