"""
Enhanced Memory API
Exposes endpoints for the enhanced memory system.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .enhanced_memory import (
    EnhancedMemorySystem,
    MemoryPriority
)
from .memory_manager import get_memory_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/memory", tags=["memory"])

# Global enhanced memory instance
_enhanced_memory: Optional[EnhancedMemorySystem] = None


def get_enhanced_memory() -> Optional[EnhancedMemorySystem]:
    """Get the global enhanced memory instance"""
    return _enhanced_memory


async def initialize_enhanced_memory(
    ai_client=None,
    knowledge_graph=None,
    vector_store=None,
    db_session_factory=None
) -> EnhancedMemorySystem:
    """Initialize the global enhanced memory system"""
    global _enhanced_memory
    
    _enhanced_memory = EnhancedMemorySystem(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        vector_store=vector_store,
        db_session_factory=db_session_factory
    )
    
    logger.info("Enhanced memory system initialized")
    return _enhanced_memory


# ==================== Request/Response Models ====================

class StoreMemoryRequest(BaseModel):
    """Request to store a memory"""
    user_id: str
    memory_type: str = Field(..., description="Type: conversation, concept, preference, episode")
    content: str
    importance: float = Field(0.5, ge=0.0, le=1.0)
    priority: str = Field("medium", description="Priority: critical, high, medium, low, ephemeral")
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    session_id: Optional[str] = None


class RecallMemoryRequest(BaseModel):
    """Request to recall memories"""
    user_id: str
    query: Optional[str] = None
    memory_types: Optional[List[str]] = None
    limit: int = Field(10, ge=1, le=100)
    min_importance: float = Field(0.0, ge=0.0, le=1.0)
    session_id: Optional[str] = None


class StoreConceptRequest(BaseModel):
    """Request to store a learned concept"""
    user_id: str
    concept_name: str
    description: str
    related_concepts: List[str] = Field(default_factory=list)
    mastery_level: float = Field(0.0, ge=0.0, le=1.0)


class StorePreferenceRequest(BaseModel):
    """Request to store a user preference"""
    user_id: str
    preference_key: str
    preference_value: Any
    confidence: float = Field(0.5, ge=0.0, le=1.0)


class CrossSessionSummaryRequest(BaseModel):
    """Request for cross-session summary"""
    user_id: str
    limit: int = Field(20, ge=1, le=100)


# ==================== API Endpoints ====================

@router.post("/store")
async def store_memory(request: StoreMemoryRequest):
    """
    Store a memory with enhanced metadata.
    
    Memory types:
    - conversation: Chat exchanges
    - concept: Learned concepts
    - preference: User preferences
    - episode: Specific events/interactions
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    # Map priority string to enum
    priority_map = {
        "critical": MemoryPriority.CRITICAL,
        "high": MemoryPriority.HIGH,
        "medium": MemoryPriority.MEDIUM,
        "low": MemoryPriority.LOW,
        "ephemeral": MemoryPriority.EPHEMERAL
    }
    priority = priority_map.get(request.priority.lower(), MemoryPriority.MEDIUM)
    
    entry = await memory.store(
        user_id=request.user_id,
        memory_type=request.memory_type,
        content=request.content,
        importance=request.importance,
        priority=priority,
        tags=request.tags,
        metadata=request.metadata,
        session_id=request.session_id
    )
    
    return {
        "status": "stored",
        "memory_id": entry.id,
        "importance": entry.importance
    }


@router.post("/recall")
async def recall_memories(request: RecallMemoryRequest):
    """
    Recall memories with filtering and relevance scoring.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    # Load user memories if not already loaded
    await memory.load_user_memories(request.user_id)
    
    entries = await memory.recall(
        user_id=request.user_id,
        query=request.query,
        memory_types=request.memory_types,
        limit=request.limit,
        min_importance=request.min_importance,
        session_id=request.session_id
    )
    
    return {
        "memories": [e.to_dict() for e in entries],
        "count": len(entries)
    }


@router.post("/concept")
async def store_concept(request: StoreConceptRequest):
    """
    Store a learned concept in semantic memory.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    entry = memory.semantic.store_concept(
        user_id=request.user_id,
        concept_name=request.concept_name,
        description=request.description,
        related_concepts=request.related_concepts,
        mastery_level=request.mastery_level
    )
    
    return {
        "status": "stored",
        "concept": request.concept_name,
        "memory_id": entry.id
    }


@router.get("/concept/{user_id}/{concept_name}")
async def get_concept(user_id: str, concept_name: str):
    """
    Get a specific concept from semantic memory.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    entry = memory.semantic.get_concept(user_id, concept_name)
    
    if not entry:
        raise HTTPException(status_code=404, detail="Concept not found")
    
    related = memory.semantic.get_related_concepts(user_id, concept_name)
    
    return {
        "concept": concept_name,
        "description": entry.content,
        "mastery_level": entry.metadata.get("mastery_level", 0.0),
        "related_concepts": related,
        "importance": entry.get_current_importance()
    }


@router.post("/preference")
async def store_preference(request: StorePreferenceRequest):
    """
    Store a user preference in procedural memory.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    memory.procedural.store_preference(
        user_id=request.user_id,
        preference_key=request.preference_key,
        preference_value=request.preference_value,
        confidence=request.confidence
    )
    
    return {
        "status": "stored",
        "preference": request.preference_key
    }


@router.get("/preferences/{user_id}")
async def get_preferences(user_id: str):
    """
    Get all preferences for a user.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    preferences = memory.procedural.get_all_preferences(user_id)
    
    return {
        "user_id": user_id,
        "preferences": preferences
    }


@router.post("/consolidate/{user_id}")
async def consolidate_memories(user_id: str):
    """
    Consolidate and compress memories for a user.
    
    This merges similar memories, extracts insights,
    and manages memory lifecycle.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    await memory.consolidate_user_memories(user_id)
    
    return {
        "status": "consolidated",
        "user_id": user_id
    }


@router.get("/insights/{user_id}")
async def get_user_insights(user_id: str):
    """
    Get insights extracted from user's memories.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    # Load memories first
    await memory.load_user_memories(user_id)
    
    insights = await memory.get_user_insights(user_id)
    
    return {
        "user_id": user_id,
        "insights": insights
    }


@router.post("/cross-session-summary")
async def get_cross_session_summary(request: CrossSessionSummaryRequest):
    """
    Get a summary of memories across all sessions.
    
    Useful for providing context in new sessions.
    """
    # Use the standard memory manager for this
    manager = get_memory_manager()
    if not manager:
        raise HTTPException(status_code=503, detail="Memory manager not initialized")
    
    summary = await manager.get_cross_session_summary(
        request.user_id,
        request.limit
    )
    
    return summary


@router.get("/stats/{user_id}")
async def get_memory_stats(user_id: str):
    """
    Get memory statistics for a user.
    """
    memory = get_enhanced_memory()
    if not memory:
        raise HTTPException(status_code=503, detail="Enhanced memory not initialized")
    
    stats = memory.get_stats(user_id)
    
    return {
        "user_id": user_id,
        **stats,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/status")
async def get_memory_status():
    """Get status of the memory system"""
    memory = get_enhanced_memory()
    manager = get_memory_manager()
    
    return {
        "enhanced_memory": "healthy" if memory else "not_initialized",
        "memory_manager": "healthy" if manager else "not_initialized",
        "capabilities": [
            "episodic_memory",
            "semantic_memory",
            "procedural_memory",
            "memory_consolidation",
            "cross_session_persistence",
            "importance_decay",
            "insight_extraction"
        ],
        "timestamp": datetime.utcnow().isoformat()
    }
