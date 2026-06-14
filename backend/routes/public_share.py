import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from deps import get_current_user, get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["public_share"])


def _unique_token(db: Session, model, length: int = 12) -> str:
    token = secrets.token_urlsafe(length)
    while db.query(model).filter(model.public_token == token).first():
        token = secrets.token_urlsafe(length)
    return token


@router.get("/chat/{session_id}/share-link")
def get_chat_share_link(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if not session.public_token:
        session.public_token = _unique_token(db, models.ChatSession)
        db.commit()

    return {"public_token": session.public_token}


@router.get("/public/flashcards/{token}")
def get_public_flashcard_set(token: str, db: Session = Depends(get_db)):
    fs = db.query(models.FlashcardSet).filter(models.FlashcardSet.public_token == token).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Shared flashcard set not found")

    cards = db.query(models.Flashcard).filter(models.Flashcard.set_id == fs.id).all()

    return {
        "set_title": fs.title,
        "description": fs.description or "",
        "created_at": fs.created_at.isoformat() + "Z",
        "flashcards": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "difficulty": c.difficulty or "medium",
            }
            for c in cards
        ],
    }


@router.get("/public/chat/{token}")
def get_public_chat_session(token: str, db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.public_token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Shared chat not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == session.id)
        .order_by(models.ChatMessage.timestamp.asc())
        .all()
    )

    return {
        "title": session.title,
        "created_at": session.created_at.isoformat() + "Z",
        "messages": [
            {
                "user_message": m.user_message,
                "ai_response": m.ai_response,
                "timestamp": m.timestamp.isoformat() + "Z",
            }
            for m in messages
        ],
    }
