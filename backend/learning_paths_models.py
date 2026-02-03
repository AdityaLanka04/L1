"""
Learning Paths Models - Duolingo-style Learning Path System
Defines database models for structured learning journeys
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
import uuid

def create_learning_paths_models(Base):
    """Create Learning Paths models with the provided Base"""
    
    class DifficultyLevel(str, enum.Enum):
        BEGINNER = "beginner"
        INTERMEDIATE = "intermediate"
        ADVANCED = "advanced"
    
    class PathStatus(str, enum.Enum):
        ACTIVE = "active"
        COMPLETED = "completed"
        ARCHIVED = "archived"
    
    class NodeStatus(str, enum.Enum):
        LOCKED = "locked"
        UNLOCKED = "unlocked"
        IN_PROGRESS = "in_progress"
        COMPLETED = "completed"
    
    class LearningPath(Base):
        """Main learning path entity - represents a complete learning journey"""
        __tablename__ = "learning_paths"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        # Path metadata
        title = Column(String(255), nullable=False)
        topic_prompt = Column(Text, nullable=False)  # Original user prompt
        description = Column(Text, nullable=True)
        difficulty = Column(String(20), default="intermediate")  # beginner/intermediate/advanced
        status = Column(String(20), default="active")  # active/completed/archived
        
        # Progress tracking
        total_nodes = Column(Integer, default=0)
        completed_nodes = Column(Integer, default=0)
        estimated_hours = Column(Float, default=0.0)
        
        # Timestamps
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        last_accessed = Column(DateTime, nullable=True)
        
        # Relationships
        nodes = relationship("LearningPathNode", back_populates="path", cascade="all, delete-orphan", order_by="LearningPathNode.order_index")
        progress = relationship("LearningPathProgress", back_populates="path", uselist=False, cascade="all, delete-orphan")
    
    class LearningPathNode(Base):
        """Individual node/section in a learning path"""
        __tablename__ = "learning_path_nodes"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, index=True)
        
        # Node metadata
        order_index = Column(Integer, nullable=False)  # Position in path (0-based)
        title = Column(String(255), nullable=False)
        description = Column(Text, nullable=True)
        
        # Learning content
        objectives = Column(JSON, nullable=True)  # List of learning objectives
        estimated_minutes = Column(Integer, default=30)
        content_plan = Column(JSON, nullable=True)  # Activities: notes, flashcards, quiz, chat
        
        # Unlock and completion rules
        unlock_rule = Column(JSON, nullable=True)  # Conditions to unlock this node
        reward = Column(JSON, nullable=True)  # XP and other rewards
        
        # Timestamps
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        # Relationships
        path = relationship("LearningPath", back_populates="nodes")
        progress_records = relationship("LearningNodeProgress", back_populates="node", cascade="all, delete-orphan")
    
    class LearningPathProgress(Base):
        """Overall progress for a learning path"""
        __tablename__ = "learning_path_progress"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, unique=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        # Progress metrics
        current_node_index = Column(Integer, default=0)  # Index of current/next node
        total_xp_earned = Column(Integer, default=0)
        completion_percentage = Column(Float, default=0.0)
        
        # Timestamps
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        # Relationships
        path = relationship("LearningPath", back_populates="progress")
    
    class LearningNodeProgress(Base):
        """Progress for individual nodes"""
        __tablename__ = "learning_node_progress"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        node_id = Column(String(36), ForeignKey("learning_path_nodes.id"), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        # Status and progress
        status = Column(String(20), default="locked")  # locked/unlocked/in_progress/completed
        progress_pct = Column(Integer, default=0)  # 0-100
        xp_earned = Column(Integer, default=0)
        
        # Completion evidence
        evidence = Column(JSON, nullable=True)  # Stores completion proofs
        
        # Timestamps
        started_at = Column(DateTime, nullable=True)
        completed_at = Column(DateTime, nullable=True)
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        # Relationships
        node = relationship("LearningPathNode", back_populates="progress_records")
    
    return LearningPath, LearningPathNode, LearningPathProgress, LearningNodeProgress
