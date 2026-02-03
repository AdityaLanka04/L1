"""
Learning Paths API - REST endpoints for learning path management
"""
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import os
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import jwt, JWTError

from database import get_db
import models
from agents.learning_path_agent import LearningPathAgent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/learning-paths", tags=["learning-paths"])
security = HTTPBearer()

# Global reference to AI client (will be set by register function)
_unified_ai_client = None
learning_path_agent = None

def set_ai_client(ai_client):
    """Set the AI client for the learning path agent"""
    global _unified_ai_client
    _unified_ai_client = ai_client
    logger.info("✅ AI client set for Learning Paths API")

def get_learning_path_agent():
    """Get or create learning path agent with AI client"""
    global learning_path_agent, _unified_ai_client
    
    if learning_path_agent is None:
        learning_path_agent = LearningPathAgent(ai_client=_unified_ai_client)
        if _unified_ai_client:
            logger.info("✅ Learning Path Agent initialized WITH AI client")
        else:
            logger.warning("⚠️ Learning Path Agent initialized WITHOUT AI client - will use fallback responses")
    
    return learning_path_agent

# Auth configuration (must match main.py)
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return username"""
    try:
        logger.debug(f"Verifying token: {credentials.credentials[:20]}...")
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            logger.error("Token payload missing 'sub' field")
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        logger.debug(f"Token verified for user: {username}")
        return username
    except JWTError as e:
        logger.error(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except Exception as e:
        logger.error(f"Unexpected error in verify_token: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_user_id_from_username(username: str, db: Session) -> int:
    """Get user ID from username"""
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.id

# ==================== PYDANTIC MODELS ====================

class GeneratePathRequest(BaseModel):
    topicPrompt: str
    difficulty: Optional[str] = "intermediate"
    length: Optional[str] = "medium"
    goals: Optional[list] = []

class StartNodeRequest(BaseModel):
    pass

class CompleteNodeRequest(BaseModel):
    evidence: Optional[Dict[str, Any]] = {}

class UpdateProgressRequest(BaseModel):
    activity_type: str
    completed: bool
    metadata: Optional[Dict[str, Any]] = {}

# ==================== ENDPOINTS ====================

@router.post("/generate")
async def generate_learning_path(
    request: GeneratePathRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Generate a new learning path from a topic prompt"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "generate",
            "user_id": user_id,
            "difficulty": request.difficulty,
            "length": request.length,
            "goals": request.goals
        }
        
        agent = get_learning_path_agent()
        result = agent.process(request.topicPrompt, context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except Exception as e:
        logger.error(f"Error generating learning path: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_learning_paths(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all learning paths for the current user"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "get_paths",
            "user_id": user_id
        }
        
        agent = get_learning_path_agent()
        result = agent.process("", context, db)
        
        return result
    
    except Exception as e:
        logger.error(f"Error fetching learning paths: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{path_id}")
async def get_learning_path(
    path_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific learning path"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "get_path",
            "user_id": user_id,
            "path_id": path_id
        }
        
        agent = get_learning_path_agent()
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching learning path: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{path_id}/nodes")
async def get_path_nodes(
    path_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all nodes for a learning path"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Verify path belongs to user
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Get nodes with progress
        nodes_data = []
        for node in sorted(path.nodes, key=lambda n: n.order_index):
            node_progress = db.query(models.LearningNodeProgress).filter(
                models.LearningNodeProgress.node_id == node.id,
                models.LearningNodeProgress.user_id == user_id
            ).first()
            
            nodes_data.append({
                "id": node.id,
                "order_index": node.order_index,
                "title": node.title,
                "description": node.description,
                "objectives": node.objectives,
                "estimated_minutes": node.estimated_minutes,
                "content_plan": node.content_plan,
                "unlock_rule": node.unlock_rule,
                "reward": node.reward,
                "progress": {
                    "status": node_progress.status if node_progress else "locked",
                    "progress_pct": node_progress.progress_pct if node_progress else 0,
                    "xp_earned": node_progress.xp_earned if node_progress else 0,
                    "evidence": node_progress.evidence if node_progress else {}
                }
            })
        
        return {"nodes": nodes_data}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching path nodes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/start")
async def start_node(
    path_id: str,
    node_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Mark a node as started"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "start_node",
            "user_id": user_id,
            "node_id": node_id
        }
        
        agent = get_learning_path_agent()
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/complete")
async def complete_node(
    path_id: str,
    node_id: str,
    request: CompleteNodeRequest = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Mark a node as completed and unlock next node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "complete_node",
            "user_id": user_id,
            "node_id": node_id,
            "evidence": request.evidence
        }
        
        agent = get_learning_path_agent()
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/evaluate")
async def evaluate_node(
    path_id: str,
    node_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Evaluate if node completion requirements are met"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        context = {
            "action": "evaluate_node",
            "user_id": user_id,
            "node_id": node_id
        }
        
        agent = get_learning_path_agent()
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error evaluating node: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/progress")
async def update_node_progress(
    path_id: str,
    node_id: str,
    request: UpdateProgressRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update progress for a specific activity in a node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get node progress
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            raise HTTPException(status_code=404, detail="Node progress not found")
        
        # Update evidence
        evidence = node_progress.evidence or {}
        evidence[request.activity_type] = {
            "completed": request.completed,
            "metadata": request.metadata,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        node_progress.evidence = evidence
        
        # Recalculate progress percentage
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id
        ).first()
        
        if node and node.content_plan:
            total_activities = len(node.content_plan)
            completed_activities = sum(1 for a in node.content_plan if evidence.get(a.get("type"), {}).get("completed"))
            node_progress.progress_pct = int((completed_activities / total_activities) * 100)
        
        db.commit()
        
        return {
            "success": True,
            "progress_pct": node_progress.progress_pct,
            "evidence": evidence
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating node progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{path_id}/progress")
async def get_path_progress(
    path_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get overall progress for a learning path"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        progress = db.query(models.LearningPathProgress).filter(
            models.LearningPathProgress.path_id == path_id,
            models.LearningPathProgress.user_id == user_id
        ).first()
        
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        return {
            "current_node_index": progress.current_node_index,
            "total_xp_earned": progress.total_xp_earned,
            "completion_percentage": progress.completion_percentage,
            "created_at": progress.created_at.isoformat() if progress.created_at else None,
            "updated_at": progress.updated_at.isoformat() if progress.updated_at else None
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching path progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{path_id}")
async def delete_learning_path(
    path_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Delete a learning path (or archive it)"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Archive instead of delete
        path.status = "archived"
        db.commit()
        
        return {"success": True, "message": "Path archived"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting path: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def register_learning_paths_api(app, unified_ai=None):
    """Register learning paths API routes"""
    if unified_ai:
        set_ai_client(unified_ai)
    app.include_router(router)
    logger.info("✅ Learning Paths API registered")
