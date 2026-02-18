import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from deps import call_ai, get_db, get_user_by_email, get_user_by_username, unified_ai

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["flashcards"])


class FlashcardReviewRequest(BaseModel):
    user_id: str
    card_id: str
    was_correct: bool
    mode: str = "preview"


@router.get("/get_flashcards")
def get_flashcards(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.created_at.desc()).all()

    result = []
    for fs in sets:
        cards = db.query(models.Flashcard).filter(models.Flashcard.set_id == fs.id).all()
        for card in cards:
            result.append({
                "id": card.id,
                "set_id": fs.id,
                "set_title": fs.title,
                "question": card.question,
                "answer": card.answer,
                "difficulty": card.difficulty,
                "created_at": (card.created_at or fs.created_at).isoformat() + "Z",
            })
    return result


@router.get("/get_flashcards_in_set")
def get_flashcards_in_set(set_id: int = Query(...), db: Session = Depends(get_db)):
    fs = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == set_id).first()
    if not fs:
        raise HTTPException(status_code=404, detail="Flashcard set not found")

    cards = db.query(models.Flashcard).filter(models.Flashcard.set_id == set_id).all()

    return {
        "set_id": fs.id,
        "set_title": fs.title,
        "share_code": getattr(fs, "share_code", None),
        "description": fs.description or "",
        "flashcards": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "difficulty": c.difficulty or "medium",
                "times_reviewed": c.times_reviewed or 0,
                "correct_count": c.correct_count or 0,
                "marked_for_review": bool(getattr(c, "marked_for_review", False)),
                "is_edited": bool(getattr(c, "is_edited", False)),
            }
            for c in cards
        ],
    }


@router.get("/get_flashcard_history")
def get_flashcard_history(
    user_id: str = Query(...),
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    total_count = db.query(func.count(models.FlashcardSet.id)).filter(
        models.FlashcardSet.user_id == user.id
    ).scalar() or 0

    sets = (
        db.query(models.FlashcardSet)
        .filter(models.FlashcardSet.user_id == user.id)
        .order_by(models.FlashcardSet.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    result = []
    for fs in sets:
        cards = db.query(models.Flashcard).filter(models.Flashcard.set_id == fs.id).all()
        total_cards = len(cards)
        mastery_sum = 0
        for c in cards:
            if (c.correct_count or 0) > 0:
                mastery_sum += 10 if not c.marked_for_review else 5
        mastery = min(mastery_sum, 100)

        result.append({
            "id": fs.id,
            "share_code": getattr(fs, "share_code", None),
            "title": fs.title,
            "description": fs.description or "",
            "card_count": total_cards,
            "accuracy_percentage": round(mastery, 1),
            "source_type": fs.source_type or "manual",
            "is_public": getattr(fs, "is_public", False),
            "created_at": fs.created_at.isoformat() + "Z" if fs.created_at else None,
            "updated_at": fs.updated_at.isoformat() + "Z" if fs.updated_at else None,
        })

    return {
        "flashcard_history": result,
        "total_count": total_count,
        "has_more": (offset + len(result)) < total_count,
        "offset": offset,
        "limit": limit,
    }


@router.get("/get_flashcard_statistics")
def get_flashcard_statistics(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        return {"total_sets": 0, "total_cards": 0, "cards_mastered": 0, "average_accuracy": 0}

    total_sets = db.query(func.count(models.FlashcardSet.id)).filter(
        models.FlashcardSet.user_id == user.id
    ).scalar() or 0

    total_cards = (
        db.query(func.count(models.Flashcard.id))
        .join(models.FlashcardSet)
        .filter(models.FlashcardSet.user_id == user.id)
        .scalar() or 0
    )

    cards_mastered = (
        db.query(func.count(models.Flashcard.id))
        .join(models.FlashcardSet)
        .filter(models.FlashcardSet.user_id == user.id, models.Flashcard.correct_count >= 3)
        .scalar() or 0
    )

    cards = (
        db.query(models.Flashcard)
        .join(models.FlashcardSet)
        .filter(models.FlashcardSet.user_id == user.id)
        .all()
    )
    total_reviews = sum(c.times_reviewed or 0 for c in cards)
    total_correct = sum(c.correct_count or 0 for c in cards)
    avg = (total_correct / total_reviews * 100) if total_reviews > 0 else 0

    return {
        "total_sets": total_sets,
        "total_cards": total_cards,
        "cards_mastered": cards_mastered,
        "average_accuracy": round(avg, 1),
    }


@router.get("/get_flashcards_for_review")
@router.post("/get_flashcards_for_review")
def get_flashcards_for_review(user_id: str = Query(None), db: Session = Depends(get_db)):
    if not user_id:
        return {"total_cards": 0, "sets": []}

    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        return {"total_cards": 0, "sets": []}

    cards = (
        db.query(models.Flashcard)
        .join(models.FlashcardSet)
        .filter(models.FlashcardSet.user_id == user.id, models.Flashcard.marked_for_review == True)
        .all()
    )

    sets_dict = {}
    for card in cards:
        if card.set_id not in sets_dict:
            fs = db.query(models.FlashcardSet).filter(models.FlashcardSet.id == card.set_id).first()
            sets_dict[card.set_id] = {
                "set_id": card.set_id,
                "set_title": fs.title if fs else "Unknown",
                "cards": [],
            }
        sets_dict[card.set_id]["cards"].append({
            "id": card.id,
            "question": card.question,
            "answer": card.answer,
            "difficulty": card.difficulty or "medium",
            "times_reviewed": card.times_reviewed or 0,
            "correct_count": card.correct_count or 0,
        })

    return {"total_cards": len(cards), "sets": list(sets_dict.values())}


@router.post("/generate_flashcards")
async def generate_flashcards_endpoint(
    user_id: str = Form(...),
    topic: str = Form(None),
    generation_type: str = Form("topic"),
    chat_data: str = Form(None),
    content: str = Form(None),
    card_count: int = Form(10),
    difficulty: str = Form("medium"),
    depth_level: str = Form("standard"),
    additional_specs: str = Form(""),
    set_title: str = Form(None),
    is_public: bool = Form(False),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Resolve content for chat_history mode
    chat_content = ""
    if generation_type == "chat_history":
        if content:
            chat_content = content
        elif chat_data:
            try:
                chat_history = json.loads(chat_data)
                chat_content = "\n".join(
                    [f"Q: {m.get('question', '')}\nA: {m.get('answer', '')}" for m in chat_history[:10]]
                )
            except Exception:
                chat_content = chat_data
        if not chat_content:
            raise HTTPException(status_code=400, detail="Provide content or chat_data")
    elif generation_type == "topic" and not topic:
        raise HTTPException(status_code=400, detail="Provide topic")

    # Use the LangGraph-based flashcard generator
    from flashcard_graph import get_flashcard_graph

    graph = get_flashcard_graph()
    if graph:
        flashcards_data = await graph.invoke(
            user_id=str(user.id),
            topic=topic or "",
            content=chat_content,
            generation_type=generation_type,
            card_count=card_count,
            difficulty=difficulty,
            depth_level=depth_level,
            additional_specs=additional_specs,
        )
    else:
        # Fallback: direct AI call if graph not initialized
        prompt = (
            f"Generate {card_count} flashcards about: {topic or chat_content[:500]}\n"
            f"Difficulty: {difficulty}\n\n"
            f"Return ONLY a valid JSON array. Each object: "
            f'{{"question": "...", "answer": "...", "difficulty": "{difficulty}"}}\n'
            f"No other text."
        )
        ai_response = unified_ai.generate(prompt, max_tokens=2000, temperature=0.7)
        try:
            cleaned = ai_response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0]
            flashcards_data = json.loads(cleaned)
            if isinstance(flashcards_data, dict):
                flashcards_data = flashcards_data.get("flashcards", [])
        except json.JSONDecodeError:
            flashcards_data = [{"question": "Error parsing", "answer": ai_response[:500], "difficulty": difficulty}]

    if not flashcards_data:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

    title = set_title or (f"Flashcards: {topic[:30]}" if topic else "Generated Flashcards")
    new_set = models.FlashcardSet(
        user_id=user.id,
        title=title,
        description=f"Generated from {generation_type}",
        source_type=generation_type,
        is_public=is_public,
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)

    saved_cards = []
    for card_data in flashcards_data:
        card = models.Flashcard(
            set_id=new_set.id,
            question=card_data.get("question", ""),
            answer=card_data.get("answer", ""),
            difficulty=card_data.get("difficulty", difficulty),
        )
        db.add(card)
        db.commit()
        db.refresh(card)
        saved_cards.append({
            **card_data,
            "id": card.id,
        })

    try:
        from gamification_system import award_points
        award_points(db, user.id, "flashcard_created")
    except Exception:
        pass

    db.commit()

    # Write to ChromaDB so the AI agent knows about flashcard creation
    try:
        from tutor import chroma_store
        if chroma_store.available():
            card_topics = [c.get("question", "")[:50] for c in saved_cards[:5]]
            summary = (
                f"Flashcard set created: \"{title}\" with {len(saved_cards)} cards "
                f"on topic \"{topic or 'chat history'}\". "
                f"Difficulty: {difficulty}. "
                f"Sample questions: {'; '.join(card_topics)}"
            )
            chroma_store.write_episode(
                user_id=str(user.id),
                summary=summary,
                metadata={
                    "source": "flashcard_created",
                    "set_id": str(new_set.id),
                    "set_title": title,
                    "topic": topic or "",
                    "card_count": str(len(saved_cards)),
                    "difficulty": difficulty,
                },
            )
    except Exception as e:
        logger.warning(f"Chroma write failed on flashcard creation: {e}")

    return {
        "success": True,
        "status": "success",
        "set_id": new_set.id,
        "set_title": new_set.title,
        "cards": saved_cards,
        "flashcards": saved_cards,
        "total_generated": len(saved_cards),
    }


@router.post("/mark_flashcard_for_review")
async def mark_flashcard_for_review(
    card_id: int = Form(...),
    marked: bool = Form(True),
    db: Session = Depends(get_db),
):
    card = db.query(models.Flashcard).filter(models.Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    card.marked_for_review = marked
    db.commit()

    # Write struggle to Neo4j and ChromaDB when marking as "I don't know"
    if marked:
        flashcard_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == card.set_id
        ).first()
        if flashcard_set:
            from tutor import neo4j_store
            if neo4j_store.available():
                try:
                    concept = flashcard_set.title.replace("Flashcards: ", "") if flashcard_set.title else ""
                    if concept:
                        await neo4j_store.update_struggle(
                            str(flashcard_set.user_id), concept
                        )
                except Exception as e:
                    logger.warning(f"Neo4j struggle write on mark_for_review failed: {e}")

            # Also track in ChromaDB
            from tutor import chroma_store
            if chroma_store.available():
                try:
                    summary = (
                        f"Student marked flashcard for review (doesn't know): "
                        f"Q: {card.question[:100]} from set \"{flashcard_set.title}\""
                    )
                    chroma_store.write_episode(
                        user_id=str(flashcard_set.user_id),
                        summary=summary,
                        metadata={
                            "source": "flashcard_review",
                            "card_id": str(card.id),
                            "set_id": str(card.set_id),
                            "was_correct": "False",
                            "topic": flashcard_set.title or "",
                            "action": "marked_for_review",
                        },
                    )
                except Exception as e:
                    logger.warning(f"Chroma write failed on mark_for_review: {e}")

    return {"status": "success", "card_id": card_id, "marked_for_review": marked}


@router.post("/flashcards/review")
async def update_flashcard_review(request: FlashcardReviewRequest, db: Session = Depends(get_db)):
    card = db.query(models.Flashcard).filter(models.Flashcard.id == int(request.card_id)).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    card.times_reviewed = (card.times_reviewed or 0) + 1
    if request.was_correct:
        card.correct_count = (card.correct_count or 0) + 1
    card.last_reviewed = datetime.now(timezone.utc)
    db.commit()

    # Get set info for context
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == card.set_id
    ).first()
    set_title = flashcard_set.title if flashcard_set else ""
    owner_id = str(flashcard_set.user_id) if flashcard_set else ""

    # Write to Chroma episodic memory (shared with AI chat)
    from tutor import chroma_store
    if chroma_store.available() and owner_id:
        try:
            outcome = "correctly" if request.was_correct else "incorrectly"
            summary = (
                f"Flashcard review in set \"{set_title}\": Student answered {outcome}. "
                f"Q: {card.question[:100]} A: {card.answer[:100]}. "
                f"Total reviews: {card.times_reviewed}, Correct: {card.correct_count}."
            )
            chroma_store.write_episode(
                user_id=owner_id,
                summary=summary,
                metadata={
                    "source": "flashcard_review",
                    "card_id": str(card.id),
                    "set_id": str(card.set_id),
                    "was_correct": str(request.was_correct),
                    "topic": set_title,
                    "mode": request.mode,
                },
            )
        except Exception as e:
            logger.warning(f"Chroma write failed on flashcard review: {e}")

    # Write struggle to Neo4j on incorrect answers
    if not request.was_correct and owner_id:
        from tutor import neo4j_store
        if neo4j_store.available():
            try:
                concept = set_title.replace("Flashcards: ", "") if set_title else ""
                if concept:
                    await neo4j_store.update_struggle(owner_id, concept)
            except Exception as e:
                logger.warning(f"Neo4j struggle write failed: {e}")

    return {
        "status": "success",
        "card_id": card.id,
        "times_reviewed": card.times_reviewed,
        "correct_count": card.correct_count,
    }
