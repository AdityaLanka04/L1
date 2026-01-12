"""
Streamlined Flashcard API Integration
Replaces complex multi-file system with simple, efficient endpoints
"""

import logging
import random
import string
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from flashcard_minimal import (
    generate_flashcards_minimal,
    get_agent,
    FlashcardGenerationRequest
)
import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flashcards", tags=["Flashcards"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_share_code(length: int = 6) -> str:
    """Generate a random 6-character alphanumeric code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


def get_unique_share_code(db: Session, length: int = 6) -> str:
    """Generate a unique share code that doesn't exist in the database"""
    for _ in range(10):  # Try up to 10 times
        code = generate_share_code(length)
        existing = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.share_code == code
        ).first()
        if not existing:
            return code
    # Fallback: use longer code
    return generate_share_code(8)


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class FlashcardSetCreate(BaseModel):
    user_id: str
    title: str = "New Flashcard Set"
    description: str = ""
    is_public: bool = False


class FlashcardCreate(BaseModel):
    set_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"


class CardReview(BaseModel):
    user_id: str
    card_id: str
    was_correct: bool


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_db():
    """Dependency to get database session"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_user(db: Session, user_identifier: str):
    """Get user by username or email"""
    user = db.query(models.User).filter(
        (models.User.username == user_identifier) | 
        (models.User.email == user_identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ============================================================================
# FLASHCARD GENERATION
# ============================================================================

@router.post("/generate")
async def generate_flashcards(payload: FlashcardGenerationRequest, db: Session = Depends(get_db)):
    """Generate flashcards with minimal prompting"""
    
    try:
        user = get_user(db, payload.user_id)
        
        # Import unified AI
        from main import unified_ai
        
        # Determine content source
        if payload.topic:
            flashcards = generate_flashcards_minimal(
                unified_ai,
                payload.topic,
                payload.card_count,
                payload.difficulty_level,
                is_topic=True
            )
        elif payload.chat_data:
            flashcards = generate_flashcards_minimal(
                unified_ai,
                payload.chat_data,
                payload.card_count,
                payload.difficulty_level,
                is_topic=False
            )
        else:
            raise HTTPException(status_code=400, detail="Provide topic or chat_data")
        
        # Save to database if requested
        if payload.save_to_set and flashcards:
            set_title = payload.set_title or f"Generated - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            
            # Generate unique share code
            share_code = get_unique_share_code(db)
            
            flashcard_set = models.FlashcardSet(
                user_id=user.id,
                title=set_title,
                description=f"Generated {len(flashcards)} cards",
                source_type="ai_generated",
                share_code=share_code,
                is_public=payload.is_public  # Use the is_public parameter from frontend
            )
            db.add(flashcard_set)
            db.commit()
            db.refresh(flashcard_set)
            
            # Add cards to set
            for card in flashcards:
                db_card = models.Flashcard(
                    set_id=flashcard_set.id,
                    question=card["question"],
                    answer=card["answer"],
                    difficulty=card.get("difficulty", "medium")
                )
                db.add(db_card)
                
                # Track in agent
                agent = get_agent(payload.user_id)
                agent.add_card(str(db_card.id))
            
            db.commit()
            
            return {
                "success": True,
                "flashcards": flashcards,
                "set_id": flashcard_set.id,
                "share_code": share_code,
                "set_title": set_title
            }
        
        return {
            "success": True,
            "flashcards": flashcards
        }
        
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CARD REVIEW TRACKING
# ============================================================================

@router.post("/review")
async def review_card(payload: CardReview, db: Session = Depends(get_db)):
    """Track card review and update mastery in database"""
    
    try:
        # Update card in database
        card = db.query(models.Flashcard).filter(
            models.Flashcard.id == int(payload.card_id)
        ).first()
        
        if card:
            card.times_reviewed = (card.times_reviewed or 0) + 1
            if payload.was_correct:
                card.correct_count = (card.correct_count or 0) + 1
            card.last_reviewed = datetime.utcnow()
            db.commit()
            
            # Recalculate set accuracy
            flashcard_set = db.query(models.FlashcardSet).filter(
                models.FlashcardSet.id == card.set_id
            ).first()
            
            if flashcard_set:
                # Get all cards in the set
                all_cards = db.query(models.Flashcard).filter(
                    models.Flashcard.set_id == flashcard_set.id
                ).all()
                
                total_reviews = sum(c.times_reviewed or 0 for c in all_cards)
                total_correct = sum(c.correct_count or 0 for c in all_cards)
                
                # Calculate accuracy percentage
                if total_reviews > 0:
                    accuracy = (total_correct / total_reviews) * 100
                else:
                    accuracy = 0.0
                
                # Store accuracy in set (we'll need to add this to the response)
                set_accuracy = accuracy
            else:
                set_accuracy = 0.0
        else:
            set_accuracy = 0.0
        
        # Also track in agent
        agent = get_agent(payload.user_id)
        result = agent.review_card(payload.card_id, payload.was_correct)
        
        return {
            "success": True,
            "data": result,
            "set_accuracy": set_accuracy
        }
        
    except Exception as e:
        logger.error(f"Review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics(user_id: str = Query(...)):
    """Get user flashcard statistics"""
    
    try:
        agent = get_agent(user_id)
        stats = agent.get_statistics()
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"Statistics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/weak-cards")
async def get_weak_cards(user_id: str = Query(...)):
    """Get cards that need review (< 70% retention)"""
    
    try:
        agent = get_agent(user_id)
        weak_cards = agent.get_weak_cards()
        
        return {
            "success": True,
            "data": {
                "weak_cards": weak_cards,
                "count": len(weak_cards)
            }
        }
        
    except Exception as e:
        logger.error(f"Weak cards error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CRUD OPERATIONS (Keep existing functionality)
# ============================================================================

@router.post("/sets/create")
async def create_set(payload: FlashcardSetCreate, db: Session = Depends(get_db)):
    """Create new flashcard set"""
    
    user = get_user(db, payload.user_id)
    
    # Generate unique share code
    share_code = get_unique_share_code(db)
    
    flashcard_set = models.FlashcardSet(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        is_public=payload.is_public,
        share_code=share_code
    )
    
    db.add(flashcard_set)
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "success": True,
        "set_id": flashcard_set.id,
        "share_code": share_code,
        "title": flashcard_set.title
    }


@router.post("/cards/create")
async def create_card(payload: FlashcardCreate, db: Session = Depends(get_db)):
    """Create individual flashcard"""
    
    flashcard = models.Flashcard(
        set_id=payload.set_id,
        question=payload.question,
        answer=payload.answer,
        difficulty=payload.difficulty
    )
    
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)
    
    return {
        "success": True,
        "card_id": flashcard.id
    }


@router.get("/sets/user")
async def get_user_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all flashcard sets for user with accuracy"""
    
    user = get_user(db, user_id)
    
    sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).all()
    
    result = []
    for s in sets:
        # Calculate accuracy for this set
        cards = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == s.id
        ).all()
        
        total_reviews = sum(c.times_reviewed or 0 for c in cards)
        total_correct = sum(c.correct_count or 0 for c in cards)
        
        if total_reviews > 0:
            accuracy = (total_correct / total_reviews) * 100
        else:
            accuracy = 0.0
        
        result.append({
            "id": s.id,
            "share_code": s.share_code,
            "title": s.title,
            "description": s.description,
            "card_count": len(cards),
            "accuracy_percentage": round(accuracy, 1),
            "created_at": s.created_at.isoformat()
        })
    
    return {
        "success": True,
        "sets": result
    }


@router.get("/sets/{set_id}/cards")
async def get_set_cards(set_id: int, db: Session = Depends(get_db)):
    """Get all cards in a set"""
    
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
    
    return {
        "success": True,
        "share_code": flashcard_set.share_code,
        "cards": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "difficulty": c.difficulty
            }
            for c in flashcard_set.flashcards
        ]
    }


@router.get("/by-code/{share_code}")
async def get_set_by_code(share_code: str, db: Session = Depends(get_db)):
    """Get flashcard set by share code for preview/study URLs"""
    
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.share_code == share_code.upper()
    ).first()
    
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Calculate accuracy
    cards = db.query(models.Flashcard).filter(
        models.Flashcard.set_id == flashcard_set.id
    ).all()
    
    total_reviews = sum(c.times_reviewed or 0 for c in cards)
    total_correct = sum(c.correct_count or 0 for c in cards)
    accuracy = (total_correct / total_reviews * 100) if total_reviews > 0 else 0.0
    
    return {
        "success": True,
        "set": {
            "id": flashcard_set.id,
            "share_code": flashcard_set.share_code,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "card_count": len(cards),
            "accuracy_percentage": round(accuracy, 1),
            "created_at": flashcard_set.created_at.isoformat()
        },
        "flashcards": [
            {
                "id": c.id,
                "question": c.question,
                "answer": c.answer,
                "difficulty": c.difficulty,
                "times_reviewed": c.times_reviewed or 0,
                "correct_count": c.correct_count or 0
            }
            for c in cards
        ]
    }


@router.delete("/sets/{set_id}")
async def delete_set(set_id: int, db: Session = Depends(get_db)):
    """Delete flashcard set"""
    
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Set not found")
    
    # Delete all cards
    db.query(models.Flashcard).filter(
        models.Flashcard.set_id == set_id
    ).delete()
    
    db.delete(flashcard_set)
    db.commit()
    
    return {
        "success": True,
        "message": "Set deleted"
    }


@router.post("/toggle_visibility")
async def toggle_flashcard_set_visibility(
    set_id: int = Query(...),
    is_public: bool = Query(...),
    db: Session = Depends(models.get_db)
):
    """
    Toggle flashcard set visibility (public/private)
    """
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Update visibility
    flashcard_set.is_public = is_public
    db.commit()
    
    logger.info(f" Flashcard set {set_id} visibility changed to {'public' if is_public else 'private'}")
    
    return {
        "success": True,
        "message": f"Flashcard set is now {'public' if is_public else 'private'}",
        "is_public": is_public
    }


# ============================================================================
# PUBLIC FLASHCARDS ENDPOINTS
# ============================================================================

@router.get("/public")
async def get_public_flashcards(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Get all public flashcard sets"""
    
    try:
        sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.is_public == True
        ).order_by(models.FlashcardSet.created_at.desc()).offset(offset).limit(limit).all()
        
        result = []
        for s in sets:
            # Get creator username
            user = db.query(models.User).filter(models.User.id == s.user_id).first()
            creator = user.username if user else 'Anonymous'
            
            # Count cards
            card_count = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == s.id
            ).count()
            
            result.append({
                "id": s.id,
                "share_code": s.share_code,
                "title": s.title,
                "description": s.description,
                "card_count": card_count,
                "creator": creator,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        
        return {
            "success": True,
            "sets": result,
            "total": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error fetching public flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public/search")
async def search_public_flashcards(
    query: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Search public flashcard sets by title or description"""
    
    try:
        from sqlalchemy import or_, func
        
        search_term = f"%{query.lower()}%"
        
        sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.is_public == True,
            or_(
                func.lower(models.FlashcardSet.title).like(search_term),
                func.lower(models.FlashcardSet.description).like(search_term)
            )
        ).order_by(models.FlashcardSet.created_at.desc()).limit(limit).all()
        
        result = []
        for s in sets:
            # Get creator username
            user = db.query(models.User).filter(models.User.id == s.user_id).first()
            creator = user.username if user else 'Anonymous'
            
            # Count cards
            card_count = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == s.id
            ).count()
            
            result.append({
                "id": s.id,
                "share_code": s.share_code,
                "title": s.title,
                "description": s.description,
                "card_count": card_count,
                "creator": creator,
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        
        return {
            "success": True,
            "sets": result,
            "total": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error searching public flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CopySetRequest(BaseModel):
    user_id: str
    source_set_id: int


@router.post("/public/copy")
async def copy_public_flashcard_set(
    payload: CopySetRequest,
    db: Session = Depends(get_db)
):
    """Copy a public flashcard set to user's own collection"""
    
    try:
        user = get_user(db, payload.user_id)
        
        # Get source set
        source_set = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.id == payload.source_set_id,
            models.FlashcardSet.is_public == True
        ).first()
        
        if not source_set:
            raise HTTPException(status_code=404, detail="Public flashcard set not found")
        
        # Get source cards
        source_cards = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == source_set.id
        ).all()
        
        # Create new set for user
        new_share_code = get_unique_share_code(db)
        new_set = models.FlashcardSet(
            user_id=user.id,
            title=f"{source_set.title} (Copy)",
            description=source_set.description,
            source_type="copied",
            share_code=new_share_code,
            is_public=False  # Copied sets are private by default
        )
        db.add(new_set)
        db.commit()
        db.refresh(new_set)
        
        # Copy all cards
        for card in source_cards:
            new_card = models.Flashcard(
                set_id=new_set.id,
                question=card.question,
                answer=card.answer,
                difficulty=card.difficulty,
                category=card.category
            )
            db.add(new_card)
        
        db.commit()
        
        return {
            "success": True,
            "set_id": new_set.id,
            "share_code": new_share_code,
            "title": new_set.title,
            "card_count": len(source_cards)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error copying flashcard set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CARD CRUD OPERATIONS
# ============================================================================

class CardUpdate(BaseModel):
    question: str
    answer: str
    difficulty: Optional[str] = "medium"


@router.put("/cards/{card_id}")
async def update_card(card_id: int, payload: CardUpdate, db: Session = Depends(get_db)):
    """Update an existing flashcard"""
    
    card = db.query(models.Flashcard).filter(
        models.Flashcard.id == card_id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card.question = payload.question
    card.answer = payload.answer
    card.difficulty = payload.difficulty
    card.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "success": True,
        "card_id": card.id
    }


@router.delete("/cards/{card_id}")
async def delete_card(card_id: int, db: Session = Depends(get_db)):
    """Delete a flashcard"""
    
    card = db.query(models.Flashcard).filter(
        models.Flashcard.id == card_id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    db.delete(card)
    db.commit()
    
    return {
        "success": True,
        "message": "Card deleted"
    }


def register_flashcard_api_minimal(app):
    """Register streamlined flashcard routes"""
    app.include_router(router)
    logger.info(" Minimal Flashcard API registered")
