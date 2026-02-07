"""
Learning Progress Tracking API
Endpoints for automatic progress tracking across all study activities
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List
from jose import jwt, JWTError
import logging
import os

from database import get_db
from agents.learning_progress_tracker import get_progress_tracker

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBearer()

# Auth configuration (must match main.py)
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user data"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        username = payload.get("username")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        return {"id": int(user_id), "username": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")


class TrackActivityRequest(BaseModel):
    activity_type: str  # 'note', 'flashcard', 'quiz', 'chat', 'slide', 'practice'
    content: str
    title: Optional[str] = ""
    metadata: Optional[Dict] = None


class AnalyzeContentRequest(BaseModel):
    content: str
    content_type: str
    title: Optional[str] = ""


@router.post("/track-activity")
async def track_learning_activity(
    request: TrackActivityRequest,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Track any learning activity and automatically update relevant learning path nodes
    
    This endpoint:
    1. Analyzes the content using AI
    2. Matches it to relevant learning path nodes
    3. Updates progress for matched nodes
    4. Awards XP and tracks evidence
    """
    try:
        tracker = get_progress_tracker(db)
        
        result = await tracker.track_activity(
            user_id=current_user["id"],
            activity_type=request.activity_type,
            content=request.content,
            title=request.title,
            metadata=request.metadata
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error tracking activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-content")
async def analyze_content_mapping(
    request: AnalyzeContentRequest,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Analyze content and see which learning path nodes it maps to
    (Preview mode - doesn't update progress)
    """
    try:
        tracker = get_progress_tracker(db)
        
        matches = await tracker.analyze_content_and_map_to_nodes(
            user_id=current_user["id"],
            content=request.content,
            content_type=request.content_type,
            content_title=request.title
        )
        
        return {
            "success": True,
            "matches": matches,
            "count": len(matches)
        }
        
    except Exception as e:
        logger.error(f"Error analyzing content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual-progress-update")
async def manual_progress_update(
    node_id: str,
    path_id: str,
    progress_delta: int,
    activity_type: str = "manual",
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Manually update progress for a specific node
    """
    try:
        tracker = get_progress_tracker(db)
        
        result = await tracker.update_node_progress(
            user_id=current_user["id"],
            node_id=node_id,
            path_id=path_id,
            progress_delta=progress_delta,
            activity_type=activity_type,
            evidence={"manual_update": True}
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/node-progress/{node_id}")
async def get_node_progress(
    node_id: str,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get detailed progress information for a specific node
    """
    try:
        from learning_paths_models import create_learning_paths_models
        from database import Base
        from sqlalchemy import and_
        
        _, _, _, LearningNodeProgress, _ = create_learning_paths_models(Base)
        
        progress = db.query(LearningNodeProgress).filter(
            and_(
                LearningNodeProgress.node_id == node_id,
                LearningNodeProgress.user_id == current_user["id"]
            )
        ).first()
        
        if not progress:
            return {
                "node_id": node_id,
                "progress_pct": 0,
                "status": "locked",
                "activities_completed": [],
                "xp_earned": 0
            }
        
        return {
            "node_id": progress.node_id,
            "progress_pct": progress.progress_pct,
            "status": progress.status,
            "activities_completed": progress.activities_completed or [],
            "xp_earned": progress.xp_earned or 0,
            "time_spent_minutes": progress.time_spent_minutes or 0,
            "started_at": progress.started_at.isoformat() if progress.started_at else None,
            "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
            "last_accessed": progress.last_accessed.isoformat() if progress.last_accessed else None
        }
        
    except Exception as e:
        logger.error(f"Error getting node progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/path-progress/{path_id}")
async def get_path_progress_summary(
    path_id: str,
    current_user: dict = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """
    Get overall progress summary for a learning path
    """
    try:
        from learning_paths_models import create_learning_paths_models
        from database import Base
        from sqlalchemy import and_
        
        _, LearningPathNode, _, LearningNodeProgress, _ = create_learning_paths_models(Base)
        
        # Get all nodes in path
        nodes = db.query(LearningPathNode).filter(
            LearningPathNode.path_id == path_id
        ).all()
        
        # Get progress for each node
        node_progress = []
        total_progress = 0
        completed_count = 0
        
        for node in nodes:
            progress = db.query(LearningNodeProgress).filter(
                and_(
                    LearningNodeProgress.node_id == node.id,
                    LearningNodeProgress.user_id == current_user["id"]
                )
            ).first()
            
            progress_pct = progress.progress_pct if progress else 0
            status = progress.status if progress else "locked"
            
            total_progress += progress_pct
            if status == "completed":
                completed_count += 1
            
            node_progress.append({
                "node_id": node.id,
                "node_title": node.title,
                "progress_pct": progress_pct,
                "status": status
            })
        
        overall_progress = int(total_progress / len(nodes)) if nodes else 0
        
        return {
            "path_id": path_id,
            "total_nodes": len(nodes),
            "completed_nodes": completed_count,
            "overall_progress": overall_progress,
            "nodes": node_progress
        }
        
    except Exception as e:
        logger.error(f"Error getting path progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))
