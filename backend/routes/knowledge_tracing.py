"""
Knowledge Tracing API — DKT endpoints.

POST /api/kt/train
    Train (or retrain) the DKT model on all quiz interaction data.
    Long-running — runs in a background thread so the response is immediate.

GET  /api/kt/mastery/{user_id}
    Per-concept mastery probabilities for a user based on their
    interaction history run through the trained LSTM.

GET  /api/kt/predict/{user_id}/{concept}
    P(correct | concept, user's current knowledge state).
    Used for adaptive question selection.

GET  /api/kt/status
    Whether a trained model exists, its n_concepts, and concept list.
"""

from __future__ import annotations

import logging
import os
import threading

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import SessionLocal
from deps import get_current_user, get_db, get_user_by_email, get_user_by_username
import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/kt", tags=["knowledge-tracing"])

_training_lock  = threading.Lock()
_training_active = False


def _run_training_bg(db_session_factory, kwargs: dict):
    global _training_active
    try:
        from dkt.trainer import train
        from dkt.inference import invalidate_cache
        result = train(db_session_factory, **kwargs)
        invalidate_cache()
        logger.info(f"[KT] Background training finished: {result}")
    except Exception as e:
        logger.error(f"[KT] Background training failed: {e}", exc_info=True)
    finally:
        _training_active = False


@router.post("/train")
def train_dkt(
    epochs: int = Query(30, ge=1, le=200),
    current_user: models.User = Depends(get_current_user),
):
    """
    Trigger DKT model training in the background.
    Returns immediately — poll /api/kt/status to know when it finishes.
    """
    global _training_active
    with _training_lock:
        if _training_active:
            return {"status": "already_training", "detail": "Training is already in progress."}
        _training_active = True

    t = threading.Thread(
        target=_run_training_bg,
        args=(SessionLocal, {"epochs": epochs}),
        daemon=True,
    )
    t.start()
    return {"status": "started", "detail": f"DKT training started ({epochs} epochs) in the background."}


@router.get("/status")
def kt_status():
    """Return whether a trained model is available and basic metadata."""
    from dkt.trainer import MODEL_PATH
    from dkt.dataset import load_vocab

    model_exists = os.path.exists(MODEL_PATH)
    vocab        = load_vocab() if model_exists else None

    return {
        "model_trained":   model_exists,
        "training_active": _training_active,
        "n_concepts":      len(vocab) if vocab else 0,
        "concepts":        sorted(vocab.keys()) if vocab else [],
    }


@router.get("/mastery/{user_id}")
def get_mastery(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Per-concept mastery for a user (0 = no mastery, 1 = fully mastered).
    Returns top 10 weakest and top 10 strongest concepts.
    """
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from dkt.inference import get_mastery as _get_mastery
    result = _get_mastery(user.id, SessionLocal)
    return result


@router.get("/predict/{user_id}/{concept:path}")
def predict_concept(
    user_id: str,
    concept: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Predict the probability of the user answering a question on `concept` correctly,
    given their current knowledge state.
    """
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from dkt.inference import predict_next
    return predict_next(user.id, concept, SessionLocal)
