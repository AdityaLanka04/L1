"""
Learning Paths API - REST endpoints for learning path management
"""
import logging
from typing import Optional, Dict, Any, List
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

class GenerateContentRequest(BaseModel):
    activity_type: str  # notes, flashcards, quiz, chat
    count: Optional[int] = None  # For flashcards/quiz question count

class SaveNodeNoteRequest(BaseModel):
    content: str

class UpdateDifficultyViewRequest(BaseModel):
    difficulty_view: str  # beginner/intermediate/advanced

class RateResourceRequest(BaseModel):
    resource_id: str
    rating: int  # 1-5 stars

class MarkResourceCompletedRequest(BaseModel):
    resource_id: str
    time_spent_minutes: int

class UpdateTimeSpentRequest(BaseModel):
    minutes: int

class ExportToNotesRequest(BaseModel):
    node_id: str
    include_resources: bool = True
    include_summary: bool = True

class ExportToFlashcardsRequest(BaseModel):
    node_id: str
    concept_focus: Optional[List[str]] = None

class ExportToCalendarRequest(BaseModel):
    node_id: str
    scheduled_date: str
    duration_minutes: int

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
                "prerequisites": node.prerequisites,
                "resources": node.resources,
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

@router.post("/{path_id}/nodes/{node_id}/completion-quiz")
async def get_completion_quiz(
    path_id: str,
    node_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Generate a completion quiz for the node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get the node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get the path for context
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Generate completion quiz (10 questions)
        agent = get_learning_path_agent()
        context = {
            "action": "generate_content",
            "user_id": user_id,
            "node_id": node_id,
            "activity_type": "quiz",
            "count": 10,
            "node_title": node.title,
            "node_description": node.description,
            "objectives": node.objectives,
            "path_topic": path.topic_prompt,
            "difficulty": path.difficulty
        }
        
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating completion quiz: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/complete")
async def complete_node(
    path_id: str,
    node_id: str,
    request: CompleteNodeRequest = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Mark a node as completed and unlock next node (requires quiz score >= 75%)"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Validate quiz score if provided
        quiz_score = request.evidence.get("quiz_score")
        if quiz_score is None:
            raise HTTPException(
                status_code=400, 
                detail="Quiz completion required. Please take the completion quiz first."
            )
        
        if quiz_score < 75:
            raise HTTPException(
                status_code=400,
                detail=f"Quiz score of {quiz_score}% is below the required 75%. Please review the material and try again."
            )
        
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

@router.post("/{path_id}/nodes/{node_id}/generate-content")
async def generate_node_content(
    path_id: str,
    node_id: str,
    request: GenerateContentRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Generate content (notes, flashcards, quiz) for a specific node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get the node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get the path for context
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Generate content based on activity type
        agent = get_learning_path_agent()
        
        context = {
            "action": "generate_content",
            "user_id": user_id,
            "node_id": node_id,
            "activity_type": request.activity_type,
            "count": request.count,
            "node_title": node.title,
            "node_description": node.description,
            "objectives": node.objectives,
            "path_topic": path.topic_prompt,
            "difficulty": path.difficulty
        }
        
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{path_id}/nodes/{node_id}/note")
async def get_node_note(
    path_id: str,
    node_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get user's note for a specific node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        note = db.query(models.LearningNodeNote).filter(
            models.LearningNodeNote.node_id == node_id,
            models.LearningNodeNote.user_id == user_id
        ).first()
        
        if not note:
            return {"content": "", "exists": False}
        
        return {
            "content": note.content,
            "exists": True,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None
        }
    
    except Exception as e:
        logger.error(f"Error fetching node note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/note")
async def save_node_note(
    path_id: str,
    node_id: str,
    request: SaveNodeNoteRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Save or update user's note for a specific node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Verify node exists and belongs to user's path
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Get or create note
        note = db.query(models.LearningNodeNote).filter(
            models.LearningNodeNote.node_id == node_id,
            models.LearningNodeNote.user_id == user_id
        ).first()
        
        if note:
            note.content = request.content
            note.updated_at = datetime.now(timezone.utc)
        else:
            note = models.LearningNodeNote(
                node_id=node_id,
                user_id=user_id,
                content=request.content
            )
            db.add(note)
        
        db.commit()
        
        return {
            "success": True,
            "message": "Note saved successfully",
            "updated_at": note.updated_at.isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving node note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/difficulty-view")
async def update_difficulty_view(
    path_id: str,
    node_id: str,
    request: UpdateDifficultyViewRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update user's difficulty view preference for a node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            raise HTTPException(status_code=404, detail="Node progress not found")
        
        node_progress.difficulty_view = request.difficulty_view
        db.commit()
        
        return {
            "success": True,
            "difficulty_view": request.difficulty_view
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating difficulty view: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/resources/{resource_id}/rate")
async def rate_resource(
    path_id: str,
    node_id: str,
    resource_id: str,
    request: RateResourceRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Rate a resource (1-5 stars)"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            raise HTTPException(status_code=404, detail="Node progress not found")
        
        # Update resource ratings
        ratings = node_progress.resource_ratings or {}
        ratings[resource_id] = request.rating
        node_progress.resource_ratings = ratings
        
        db.commit()
        
        return {
            "success": True,
            "resource_id": resource_id,
            "rating": request.rating
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rating resource: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/resources/{resource_id}/complete")
async def mark_resource_completed(
    path_id: str,
    node_id: str,
    resource_id: str,
    request: MarkResourceCompletedRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Mark a resource as completed"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            raise HTTPException(status_code=404, detail="Node progress not found")
        
        # Update resources completed
        completed = node_progress.resources_completed or []
        if resource_id not in completed:
            completed.append(resource_id)
        node_progress.resources_completed = completed
        
        # Update time spent
        node_progress.time_spent_minutes += request.time_spent_minutes
        
        db.commit()
        
        return {
            "success": True,
            "resource_id": resource_id,
            "total_time_spent": node_progress.time_spent_minutes
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking resource completed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/time-spent")
async def update_time_spent(
    path_id: str,
    node_id: str,
    request: UpdateTimeSpentRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update time spent on a node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        node_progress = db.query(models.LearningNodeProgress).filter(
            models.LearningNodeProgress.node_id == node_id,
            models.LearningNodeProgress.user_id == user_id
        ).first()
        
        if not node_progress:
            raise HTTPException(status_code=404, detail="Node progress not found")
        
        node_progress.time_spent_minutes += request.minutes
        node_progress.last_accessed = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "success": True,
            "total_time_spent": node_progress.time_spent_minutes
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating time spent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/export-to-notes")
async def export_to_notes(
    path_id: str,
    node_id: str,
    request: ExportToNotesRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Export node content to notes app with rich HTML formatting"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get path
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Build rich HTML note content (matching Knowledge Roadmap format)
        note_content = f'<h1 style="font-weight: 800; font-size: 28px; margin-bottom: 24px; color: var(--accent);">{node.title}</h1>'
        note_content += f'<p style="color: var(--text-secondary); margin-bottom: 32px; font-style: italic;">From Learning Path: {path.title}</p>'
        note_content += '<hr style="border: none; border-top: 2px solid var(--border); margin: 24px 0;">'
        
        # Introduction
        if node.introduction:
            note_content += '<div style="margin-bottom: 24px; padding: 16px; background: var(--panel); border-left: 4px solid var(--accent); border-radius: 4px;">'
            note_content += '<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Introduction</h4>'
            note_content += f'<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">{node.introduction}</p>'
            note_content += '</div>'
        
        # Core Sections
        if node.core_sections:
            for section in node.core_sections:
                note_content += '<div style="margin-bottom: 24px;">'
                note_content += f'<h3 style="font-weight: 700; font-size: 20px; margin-bottom: 12px; color: var(--accent);">{section.get("title", "Section")}</h3>'
                note_content += f'<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px; margin-bottom: 12px;">{section.get("content", "")}</p>'
                
                # Example
                if section.get('example'):
                    note_content += '<div style="padding: 12px; background: color-mix(in srgb, var(--info) 10%, transparent); border-radius: 4px; border: 1px solid var(--info); margin-top: 12px;">'
                    note_content += '<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--info); text-transform: uppercase; letter-spacing: 0.5px;">Example</h4>'
                    note_content += f'<p style="color: var(--text-primary); line-height: 1.7; font-size: 14px;">{section.get("example")}</p>'
                    note_content += '</div>'
                
                note_content += '</div>'
        
        # Key Takeaways / Summary
        if request.include_summary and node.summary:
            note_content += '<div style="margin-bottom: 24px;">'
            note_content += '<h3 style="font-weight: 700; font-size: 20px; margin-bottom: 12px; color: var(--accent);">Key Takeaways</h3>'
            note_content += '<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">'
            for item in node.summary:
                note_content += f'<li style="margin-bottom: 6px; font-size: 14px;">{item}</li>'
            note_content += '</ul></div>'
        
        # Real-World Applications
        if node.real_world_applications:
            note_content += '<div style="margin-bottom: 24px;">'
            note_content += '<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Real-World Applications</h4>'
            note_content += '<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">'
            for app in node.real_world_applications:
                note_content += f'<li style="margin-bottom: 6px; font-size: 14px;">{app}</li>'
            note_content += '</ul></div>'
        
        # Resources
        if request.include_resources and node.primary_resources:
            note_content += '<div style="margin-bottom: 24px; padding: 16px; background: var(--panel); border-radius: 4px;">'
            note_content += '<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 12px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px;">Resources</h4>'
            note_content += '<ul style="margin-left: 20px; color: var(--text-primary); line-height: 1.8;">'
            for resource in node.primary_resources:
                title = resource.get('title', 'Resource')
                url = resource.get('url', '#')
                description = resource.get('description', '')
                note_content += f'<li style="margin-bottom: 8px; font-size: 14px;"><a href="{url}" style="color: var(--accent); text-decoration: none; font-weight: 600;">{title}</a>'
                if description:
                    note_content += f' - {description}'
                note_content += '</li>'
            note_content += '</ul></div>'
        
        # Footer
        note_content += '<hr style="border: none; border-top: 2px solid var(--border); margin: 32px 0;">'
        note_content += '<p style="color: var(--text-secondary); font-size: 12px; text-align: center; margin-top: 24px;">'
        note_content += f'Exported from Learning Path: {path.title}'
        note_content += '</p>'
        
        return {
            "success": True,
            "note_title": f"{path.title} - {node.title}",
            "note_content": note_content,
            "tags": node.tags or []
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting to notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/export-to-flashcards")
async def export_to_flashcards(
    path_id: str,
    node_id: str,
    request: ExportToFlashcardsRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Export node content to flashcards app"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get path
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Generate flashcards from node content
        agent = get_learning_path_agent()
        context = {
            "action": "generate_content",
            "user_id": user_id,
            "node_id": node_id,
            "activity_type": "flashcards",
            "count": 15,
            "node_title": node.title,
            "node_description": node.description,
            "objectives": node.objectives,
            "path_topic": path.topic_prompt,
            "difficulty": path.difficulty,
            "concept_focus": request.concept_focus
        }
        
        result = agent.process("", context, db)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "deck_title": f"{path.title} - {node.title}",
            "flashcards": result.get("flashcards", []),
            "tags": node.tags or []
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting to flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{path_id}/nodes/{node_id}/export-to-calendar")
async def export_to_calendar(
    path_id: str,
    node_id: str,
    request: ExportToCalendarRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Export node as calendar event"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Get path
        path = db.query(models.LearningPath).filter(
            models.LearningPath.id == path_id,
            models.LearningPath.user_id == user_id
        ).first()
        
        if not path:
            raise HTTPException(status_code=404, detail="Path not found")
        
        # Create calendar event data
        event_data = {
            "title": f"Study: {node.title}",
            "description": f"Learning Path: {path.title}\n\nObjectives:\n" + "\n".join([f"- {obj}" for obj in (node.objectives or [])]),
            "scheduled_date": request.scheduled_date,
            "duration_minutes": request.duration_minutes,
            "type": "learning_path_node",
            "metadata": {
                "path_id": path_id,
                "node_id": node_id,
                "estimated_minutes": node.estimated_minutes
            }
        }
        
        return {
            "success": True,
            "event": event_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting to calendar: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{path_id}/nodes/{node_id}/prerequisite-check")
async def check_prerequisites(
    path_id: str,
    node_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Check if user meets prerequisites for a node"""
    try:
        user_id = get_user_id_from_username(username, db)
        
        # Get node
        node = db.query(models.LearningPathNode).filter(
            models.LearningPathNode.id == node_id,
            models.LearningPathNode.path_id == path_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check prerequisite nodes
        prerequisites_met = True
        missing_prerequisites = []
        
        if node.prerequisite_nodes:
            for prereq_node_id in node.prerequisite_nodes:
                prereq_progress = db.query(models.LearningNodeProgress).filter(
                    models.LearningNodeProgress.node_id == prereq_node_id,
                    models.LearningNodeProgress.user_id == user_id
                ).first()
                
                if not prereq_progress or prereq_progress.status != "completed":
                    prerequisites_met = False
                    prereq_node = db.query(models.LearningPathNode).filter(
                        models.LearningPathNode.id == prereq_node_id
                    ).first()
                    if prereq_node:
                        missing_prerequisites.append(prereq_node.title)
        
        # Get prerequisite quiz if available
        prerequisite_quiz = node.prerequisite_quiz or []
        
        return {
            "prerequisites_met": prerequisites_met,
            "missing_prerequisites": missing_prerequisites,
            "prerequisite_quiz": prerequisite_quiz,
            "has_quiz": len(prerequisite_quiz) > 0
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking prerequisites: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def register_learning_paths_api(app, unified_ai=None):
    """Register learning paths API routes"""
    if unified_ai:
        set_ai_client(unified_ai)
    app.include_router(router)
    logger.info("✅ Learning Paths API registered")
