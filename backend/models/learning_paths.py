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
        
        title = Column(String(255), nullable=False)
        topic_prompt = Column(Text, nullable=False)
        description = Column(Text, nullable=True)
        difficulty = Column(String(20), default="intermediate")
        status = Column(String(20), default="active")
        
        total_nodes = Column(Integer, default=0)
        completed_nodes = Column(Integer, default=0)
        estimated_hours = Column(Float, default=0.0)
        
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        last_accessed = Column(DateTime, nullable=True)
        
        nodes = relationship("LearningPathNode", back_populates="path", cascade="all, delete-orphan", order_by="LearningPathNode.order_index")
        progress = relationship("LearningPathProgress", back_populates="path", uselist=False, cascade="all, delete-orphan")
    
    class LearningPathNode(Base):
        """Individual node/section in a learning path"""
        __tablename__ = "learning_path_nodes"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, index=True)
        
        order_index = Column(Integer, nullable=False)
        title = Column(String(255), nullable=False)
        description = Column(Text, nullable=True)
        
        tags = Column(JSON, nullable=True)
        keywords = Column(JSON, nullable=True)
        bloom_level = Column(String(50), nullable=True)
        cognitive_load = Column(String(20), nullable=True)
        industry_relevance = Column(JSON, nullable=True)
        
        introduction = Column(Text, nullable=True)
        core_sections = Column(JSON, nullable=True)
        summary = Column(JSON, nullable=True)
        connection_map = Column(JSON, nullable=True)
        real_world_applications = Column(JSON, nullable=True)
        
        beginner_content = Column(JSON, nullable=True)
        intermediate_content = Column(JSON, nullable=True)
        advanced_content = Column(JSON, nullable=True)
        
        video_resources = Column(JSON, nullable=True)
        interactive_diagrams = Column(JSON, nullable=True)
        audio_narration = Column(JSON, nullable=True)
        infographics = Column(JSON, nullable=True)
        code_playgrounds = Column(JSON, nullable=True)
        
        objectives = Column(JSON, nullable=True)
        learning_outcomes = Column(JSON, nullable=True)
        prerequisites = Column(JSON, nullable=True)
        prerequisite_nodes = Column(JSON, nullable=True)
        
        resources = Column(JSON, nullable=True)
        primary_resources = Column(JSON, nullable=True)
        supplementary_resources = Column(JSON, nullable=True)
        practice_resources = Column(JSON, nullable=True)
        
        estimated_minutes = Column(Integer, default=30)
        content_plan = Column(JSON, nullable=True)
        
        concept_mapping = Column(JSON, nullable=True)
        scenarios = Column(JSON, nullable=True)
        hands_on_projects = Column(JSON, nullable=True)
        
        prerequisite_quiz = Column(JSON, nullable=True)
        
        unlock_rule = Column(JSON, nullable=True)
        reward = Column(JSON, nullable=True)
        
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        path = relationship("LearningPath", back_populates="nodes")
        progress_records = relationship("LearningNodeProgress", back_populates="node", cascade="all, delete-orphan")
    
    class LearningPathProgress(Base):
        """Overall progress for a learning path"""
        __tablename__ = "learning_path_progress"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        path_id = Column(String(36), ForeignKey("learning_paths.id"), nullable=False, unique=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        current_node_index = Column(Integer, default=0)
        total_xp_earned = Column(Integer, default=0)
        completion_percentage = Column(Float, default=0.0)
        
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        path = relationship("LearningPath", back_populates="progress")
    
    class LearningNodeProgress(Base):
        """Progress for individual nodes"""
        __tablename__ = "learning_node_progress"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        node_id = Column(String(36), ForeignKey("learning_path_nodes.id"), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        status = Column(String(20), default="locked")
        progress_pct = Column(Integer, default=0)
        xp_earned = Column(Integer, default=0)
        
        difficulty_view = Column(String(20), default="intermediate")
        
        evidence = Column(JSON, nullable=True)
        
        time_spent_minutes = Column(Integer, default=0)
        quiz_attempts = Column(JSON, nullable=True)
        concept_mastery = Column(JSON, nullable=True)
        struggle_points = Column(JSON, nullable=True)
        
        resources_completed = Column(JSON, nullable=True)
        resource_ratings = Column(JSON, nullable=True)
        
        activities_completed = Column(JSON, nullable=True)
        
        started_at = Column(DateTime, nullable=True)
        completed_at = Column(DateTime, nullable=True)
        last_accessed = Column(DateTime, nullable=True)
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
        
        node = relationship("LearningPathNode", back_populates="progress_records")
    
    class LearningNodeNote(Base):
        """User notes for individual nodes"""
        __tablename__ = "learning_node_notes"
        
        id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        node_id = Column(String(36), ForeignKey("learning_path_nodes.id"), nullable=False, index=True)
        user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        
        content = Column(Text, nullable=True)
        
        created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
        updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    return LearningPath, LearningPathNode, LearningPathProgress, LearningNodeProgress, LearningNodeNote
