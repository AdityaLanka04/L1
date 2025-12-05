from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, ForeignKey,
    Boolean, Float, JSON, Date, func  # ✅ ADD func here
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

import os

from question_bank_models import create_question_bank_models

# ==================== DATABASE CONFIG ====================

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()  
UploadedDocument, QuestionSet, Question, QuestionSession, UserPerformanceMetrics = create_question_bank_models(Base)



class DailyGoal(Base):
    __tablename__ = "daily_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    date = Column(Date, default=lambda: datetime.utcnow().date())
    target = Column(Integer, default=20)
    progress = Column(Integer, default=0)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    email = Column(String(100), unique=True, index=True)
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(255))
    age = Column(Integer, nullable=True)
    field_of_study = Column(String(100), nullable=True)
    learning_style = Column(String(50), nullable=True)
    school_university = Column(String(100), nullable=True)
    picture_url = Column(String(255), nullable=True)
    google_user = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow)

    # Relationships
    chat_sessions = relationship("ChatSession", back_populates="user")
    user_stats = relationship("UserStats", back_populates="user", uselist=False)
    notes = relationship("Note", back_populates="user")
    folders = relationship("Folder", back_populates="user")
    chat_folders = relationship("ChatFolder", back_populates="user")
    activities = relationship("Activity", back_populates="user")
    flashcard_sets = relationship("FlashcardSet", back_populates="user")
    flashcard_study_sessions = relationship("FlashcardStudySession", back_populates="user")
    user_profile = relationship("UserPersonalityProfile", back_populates="user", uselist=False)
    learning_patterns = relationship("LearningPattern", back_populates="user")
    user_preferences = relationship("UserPreferences", back_populates="user", uselist=False)
    topic_mastery = relationship("TopicMastery", back_populates="user")
    feedback_entries = relationship("UserFeedback", back_populates="user")
    enhanced_stats = relationship("EnhancedUserStats", back_populates="user", uselist=False)
    daily_metrics = relationship("DailyLearningMetrics", back_populates="user")
    achievements = relationship("UserAchievement", back_populates="user")
    comprehensive_profile = relationship("ComprehensiveUserProfile", back_populates="user", uselist=False)
    uploaded_slides = relationship("UploadedSlide", back_populates="user")
    uploaded_documents = relationship("UploadedDocument", back_populates="user")
    question_sets_new = relationship("QuestionSet", back_populates="user")
    question_sessions_new = relationship("QuestionSession", back_populates="user")
    performance_metrics = relationship("UserPerformanceMetrics", back_populates="user")
    gamification_stats = relationship("UserGamificationStats", back_populates="user", uselist=False)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="New Chat")
    folder_id = Column(Integer, ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="chat_session", cascade="all, delete-orphan")
    folder = relationship("ChatFolder", back_populates="chat_sessions")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_message = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    is_user = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    chat_session = relationship("ChatSession", back_populates="messages")

class KnowledgeNode(Base):
    """Represents a knowledge topic node in the exploration tree"""
    __tablename__ = "knowledge_nodes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    parent_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=True)
    
    # Node content
    topic_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    depth_level = Column(Integer, default=0)  # Root = 0, increases with depth
    
    # AI-generated content
    ai_explanation = Column(Text, nullable=True)
    key_concepts = Column(Text, nullable=True)  # JSON array
    why_important = Column(Text, nullable=True)
    real_world_examples = Column(Text, nullable=True)  # JSON array
    learning_tips = Column(Text, nullable=True)
    generated_subtopics = Column(Text, nullable=True)  # JSON array
    
    # User interaction
    is_explored = Column(Boolean, default=False)
    exploration_count = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0)
    user_notes = Column(Text, nullable=True)
    
    # Visual positioning (for frontend)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    # Status
    expansion_status = Column(String(20), default="unexpanded")  # unexpanded, expanding, expanded
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_explored = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User")
    parent = relationship("KnowledgeNode", remote_side=[id], backref="children")

class KnowledgeRoadmap(Base):
    """Represents a complete learning roadmap/exploration session"""
    __tablename__ = "knowledge_roadmaps"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    title = Column(String(255), nullable=False)
    root_topic = Column(String(200), nullable=False)
    root_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=True)
    
    # Analytics
    total_nodes = Column(Integer, default=1)
    max_depth_reached = Column(Integer, default=0)
    total_exploration_time = Column(Integer, default=0)
    completion_percentage = Column(Float, default=0.0)
    
    # Status
    status = Column(String(20), default="active")  # active, paused, completed
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed = Column(DateTime, nullable=True)
    
    user = relationship("User")

class NodeExplorationHistory(Base):
    """Track detailed exploration history"""
    __tablename__ = "node_exploration_history"
    
    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    roadmap_id = Column(Integer, ForeignKey("knowledge_roadmaps.id"))
    
    # Interaction details
    exploration_duration = Column(Integer, default=0)  # seconds
    questions_asked = Column(Text, nullable=True)  # JSON array
    user_understanding_rating = Column(Integer, nullable=True)  # 1-5
    
    explored_at = Column(DateTime, default=datetime.utcnow)
    
class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Stats fields
    total_lessons = Column(Integer, default=0)
    total_hours = Column(Float, default=0.0)
    day_streak = Column(Integer, default=0)
    accuracy_percentage = Column(Float, default=0.0)
    last_activity = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_stats")

# ... (ChatSession, ChatMessage, UserStats remain the same)

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="Untitled Note")
    content = Column(Text, default="")
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    is_favorite = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)  # ✅ Removed timezone=True
    created_at = Column(DateTime, default=datetime.utcnow)  # ✅ Changed from lambda
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # ✅ Changed from lambda
    custom_font = Column(String(50), default="Inter")
    
    user = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")

class Folder(Base):
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(50), default="#D7B38C")
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder")

class ChatFolder(Base):
    __tablename__ = "chat_folders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(50), default="#D7B38C")
    parent_id = Column(Integer, ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="chat_folders")
    chat_sessions = relationship("ChatSession", back_populates="folder")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    topic = Column(String(200), default="General")
    timestamp = Column(DateTime, default=datetime.utcnow)

    question_type = Column(String(50), nullable=True)
    difficulty_level = Column(String(50), nullable=True)
    user_satisfaction = Column(Integer, nullable=True)
    time_to_understand = Column(Float, nullable=True)
    follow_up_questions = Column(Integer, default=0)

    user = relationship("User", back_populates="activities")

# (⚡ Keep your other ORM classes here: FlashcardSet, Flashcard, FlashcardStudySession, 
# UserPersonalityProfile, LearningPattern, UserPreferences, TopicMastery, 
# ComprehensiveUserProfile, EnhancedUserStats, DailyLearningMetrics, 
# Achievement, UserAchievement, GlobalKnowledgeBase, AIResponseImprovement, 
# CommonMisconceptions, UserFeedback, AILearningMetrics, ConversationMemory, 
# TopicKnowledgeBase, LearningReview, LearningReviewAttempt, LearningReviewHint, LearningReviewStats)

# ==================== PYDANTIC MODELS ====================

class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), default="New Flashcard Set")
    description = Column(Text, default="")
    source_type = Column(String(50), default="manual")
    source_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="flashcard_sets")
    flashcards = relationship("Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan")
    study_sessions = relationship("FlashcardStudySession", back_populates="flashcard_set")

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    difficulty = Column(String(20), default="medium")
    category = Column(String(50), default="general")
    times_reviewed = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")

class FlashcardStudySession(Base):
    __tablename__ = "flashcard_study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    cards_studied = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    session_duration = Column(Integer, nullable=False)
    session_date = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="flashcard_study_sessions")
    flashcard_set = relationship("FlashcardSet", back_populates="study_sessions")

# ==================== ENHANCED USER PROFILE SYSTEM ====================

class UserPersonalityProfile(Base):
    """Individual user personality profile"""
    __tablename__ = "user_personality_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Communication Style
    formality_preference = Column(Float, default=0.5)
    humor_preference = Column(Float, default=0.5)
    detail_preference = Column(Float, default=0.5)
    encouragement_preference = Column(Float, default=0.7)
    
    # Learning Characteristics
    pace_preference = Column(String(50), default="medium")
    question_frequency = Column(Float, default=0.5)
    example_preference = Column(Float, default=0.7)
    repetition_tolerance = Column(Float, default=0.5)
    
    # Cognitive Style
    visual_learner_score = Column(Float, default=0.5)
    auditory_learner_score = Column(Float, default=0.5)
    kinesthetic_learner_score = Column(Float, default=0.5)
    reading_learner_score = Column(Float, default=0.5)
    
    # Interaction Patterns
    session_length_preference = Column(Integer, default=30)
    break_frequency = Column(Integer, default=15)
    preferred_time_of_day = Column(String(50), nullable=True)
    
    # Updated tracking
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    profile_confidence = Column(Float, default=0.1)
    
    user = relationship("User", back_populates="user_profile")

class LearningPattern(Base):
    """Track learning patterns and behaviors over time"""
    __tablename__ = "learning_patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Temporal patterns
    most_active_hour = Column(Integer, nullable=True)
    most_active_day = Column(Integer, nullable=True)
    average_session_length = Column(Float, default=0.0)
    peak_performance_time = Column(String(50), nullable=True)
    
    # Learning efficiency
    questions_per_session = Column(Float, default=0.0)
    concepts_mastered_per_hour = Column(Float, default=0.0)
    retention_rate = Column(Float, default=0.0)
    
    # Behavioral patterns
    help_seeking_frequency = Column(Float, default=0.0)
    topic_jumping_tendency = Column(Float, default=0.0)
    depth_vs_breadth = Column(Float, default=0.5)
    
    # Engagement metrics
    average_response_time = Column(Float, default=0.0)
    session_completion_rate = Column(Float, default=0.0)
    comeback_likelihood = Column(Float, default=0.0)
    
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="learning_patterns")

class UserPreferences(Base):
    """User preferences learned over time"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Response style preferences
    preferred_explanation_style = Column(String(50), default="balanced")
    preferred_example_types = Column(JSON, nullable=True)
    language_complexity = Column(String(50), default="medium")
    
    # Content preferences
    favorite_subjects = Column(JSON, nullable=True)
    avoided_subjects = Column(JSON, nullable=True)
    preferred_difficulty_progression = Column(String(50), default="gradual")
    
    # Interaction preferences
    likes_challenges = Column(Boolean, default=True)
    likes_games = Column(Boolean, default=False)
    likes_storytelling = Column(Boolean, default=True)
    likes_step_by_step = Column(Boolean, default=True)
    
    # Feedback preferences
    wants_progress_updates = Column(Boolean, default=True)
    wants_encouragement = Column(Boolean, default=True)
    wants_constructive_criticism = Column(Boolean, default=True)
    
    # Learning aids
    prefers_visual_aids = Column(Boolean, default=False)
    prefers_mnemonics = Column(Boolean, default=False)
    prefers_analogies = Column(Boolean, default=True)
    prefers_real_examples = Column(Boolean, default=True)
    
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="user_preferences")

class TopicMastery(Base):
    """Track user's mastery level of different topics"""
    __tablename__ = "topic_mastery"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    topic_name = Column(String(100), index=True)
    mastery_level = Column(Float, default=0.0)
    confidence_level = Column(Float, default=0.0)
    last_practiced = Column(DateTime, default=datetime.utcnow)
    
    # Learning metrics
    times_studied = Column(Integer, default=0)
    questions_asked = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_time_spent = Column(Float, default=0.0)
    
    # Difficulty tracking
    struggles_with = Column(JSON, nullable=True)
    excels_at = Column(JSON, nullable=True)
    
    # Prerequisites and relationships
    prerequisite_topics = Column(JSON, nullable=True)
    related_topics = Column(JSON, nullable=True)
    
    last_studied = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="topic_mastery")

# ==================== COMPREHENSIVE USER PROFILE ====================

# ==================== ENHANCED STATS AND ANALYTICS ====================

class EnhancedUserStats(Base):
    """Enhanced user statistics"""
    __tablename__ = "enhanced_user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Performance Metrics
    learning_velocity = Column(Float, default=0.0)
    comprehension_rate = Column(Float, default=0.0)
    retention_score = Column(Float, default=0.0)
    consistency_rating = Column(Float, default=0.0)
    
    # Progress Tracking
    weekly_sessions = Column(Integer, default=0)
    monthly_goal = Column(Integer, default=100)
    achievement_score = Column(Integer, default=0)
    study_level = Column(String(50), default="Beginner")
    favorite_subject = Column(String(100), default="General")
    
    # Activity Metrics
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    average_session_time = Column(Float, default=0.0)
    total_flashcards = Column(Integer, default=0)
    total_notes = Column(Integer, default=0)
    total_chat_sessions = Column(Integer, default=0)
    
    # Timestamps
    last_active_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="enhanced_stats")

class DailyLearningMetrics(Base):
    """Daily learning metrics for analytics"""
    __tablename__ = "daily_learning_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, default=datetime.utcnow().date)
    
    # Daily Activity
    sessions_completed = Column(Integer, default=0)
    time_spent_minutes = Column(Float, default=0.0)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    topics_studied = Column(Text, default="[]")  # JSON string
    
    # Performance
    accuracy_rate = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)
    difficulty_level_attempted = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="daily_metrics")

# ==================== ACHIEVEMENTS SYSTEM ====================

class Achievement(Base):
    """Achievement definitions"""
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    description = Column(Text)
    icon = Column(String(50))
    criteria = Column(JSON)  # Achievement criteria
    points = Column(Integer, default=0)
    category = Column(String(50), default="general")
    rarity = Column(String(20), default="common")  # common, rare, epic, legendary
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user_achievements = relationship("UserAchievement", back_populates="achievement")

class UserAchievement(Base):
    """User achievements earned"""
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_id = Column(Integer, ForeignKey("achievements.id"))
    
    earned_at = Column(DateTime, default=datetime.utcnow)
    progress_data = Column(JSON, nullable=True)  # Additional progress info
    
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")

# Old gamification models removed - see comprehensive models at end of file

# ==================== LEARNING REVIEWS ====================



class GlobalKnowledgeBase(Base):
    """Global knowledge base that improves for all users"""
    __tablename__ = "global_knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Question and answer patterns
    question_pattern = Column(Text)
    response_template = Column(Text)
    topic_category = Column(String(100), index=True)
    difficulty_level = Column(String(50))
    
    # Effectiveness metrics
    success_rate = Column(Float, default=0.0)
    usage_count = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    
    # Learning source
    created_from_feedback = Column(Boolean, default=False)
    original_user_id = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class AIResponseImprovement(Base):
    """Track AI response improvements suggested by users"""
    __tablename__ = "ai_response_improvements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Original interaction
    original_question = Column(Text)
    original_response = Column(Text)
    user_rating = Column(Integer)
    
    # Improvement suggestion
    improvement_suggestion = Column(Text)
    improvement_type = Column(String(50))
    suggested_by_user_id = Column(Integer, ForeignKey("users.id"))
    
    # Implementation status
    is_implemented = Column(Boolean, default=False)
    implementation_notes = Column(Text, nullable=True)
    
    # Global impact
    times_applied = Column(Integer, default=0)
    effectiveness_score = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CommonMisconceptions(Base):
    """Track common misconceptions and how to address them"""
    __tablename__ = "common_misconceptions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    topic = Column(String(100), index=True)
    misconception_text = Column(Text)
    correct_explanation = Column(Text)
    
    # Detection patterns
    trigger_phrases = Column(JSON)
    confusion_indicators = Column(JSON)
    
    # Effectiveness
    detection_accuracy = Column(Float, default=0.0)
    correction_success_rate = Column(Float, default=0.0)
    times_encountered = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserFeedback(Base):
    """User feedback for continuous AI improvement"""
    __tablename__ = "user_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # Feedback content
    feedback_type = Column(String(50))
    feedback_text = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    
    # Context
    related_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    topic_context = Column(String(100), nullable=True)
    session_context = Column(JSON, nullable=True)
    
    # Processing status
    is_processed = Column(Boolean, default=False)
    processing_notes = Column(Text, nullable=True)
    resulted_in_improvement = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="feedback_entries")

class AILearningMetrics(Base):
    """Track AI learning and improvement metrics"""
    __tablename__ = "ai_learning_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Time period
    date = Column(Date, default=datetime.utcnow().date)
    
    # Performance metrics
    average_response_rating = Column(Float, default=0.0)
    total_interactions = Column(Integer, default=0)
    successful_interactions = Column(Integer, default=0)
    
    # Learning metrics
    new_knowledge_entries = Column(Integer, default=0)
    improvements_implemented = Column(Integer, default=0)
    misconceptions_corrected = Column(Integer, default=0)
    
    # User satisfaction
    user_satisfaction_trend = Column(Float, default=0.0)
    repeat_user_percentage = Column(Float, default=0.0)
    
    # Topic-specific performance
    topic_performance_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class ConversationMemory(Base):
    """Enhanced conversation memory for RAG system"""
    __tablename__ = "conversation_memories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(Integer, nullable=True)
    
    # Conversation content
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context_summary = Column(Text, nullable=True)
    
    # Metadata
    topic_tags = Column(JSON, nullable=True)
    question_type = Column(String(50), nullable=True)
    emotional_context = Column(String(50), nullable=True)
    
    # RAG embeddings (stored as hex strings)
    question_embedding = Column(Text, nullable=True)
    answer_embedding = Column(Text, nullable=True)
    combined_embedding = Column(Text, nullable=True)
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime, nullable=True)
    user_feedback_score = Column(Float, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")

class TopicKnowledgeBase(Base):
    """Topic-based knowledge aggregation"""
    __tablename__ = "topic_knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    topic_name = Column(String(100), unique=True, index=True)
    
    # Aggregated knowledge
    key_concepts = Column(JSON, nullable=True)
    common_questions = Column(JSON, nullable=True)
    best_explanations = Column(JSON, nullable=True)
    
    # Topic embedding for similarity search
    topic_embedding = Column(Text, nullable=True)
    
    # Statistics
    total_questions = Column(Integer, default=0)
    average_difficulty = Column(Float, default=0.5)
    success_rate = Column(Float, default=0.8)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ==================== LEARNING REVIEW SYSTEM ====================

class LearningReview(Base):
    __tablename__ = "learning_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    source_sessions = Column(Text)
    source_slides = Column(Text)
    source_content = Column(Text)
    expected_points = Column(Text)
    review_type = Column(String(50), default="comprehensive")
    total_points = Column(Integer, default=0)
    best_score = Column(Float, default=0.0)
    current_attempt = Column(Integer, default=0)
    attempt_count = Column(Integer, default=0)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class LearningReviewAttempt(Base):
    __tablename__ = "learning_review_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    user_response = Column(Text, nullable=False)
    covered_points = Column(Text)  # JSON array of points the user covered
    missing_points = Column(Text)  # JSON array of points the user missed
    completeness_percentage = Column(Float, default=0.0)  # ✅ Percentage score
    feedback = Column(Text)  # ✅ ADD THIS - AI-generated feedback
    submitted_at = Column(DateTime, default=datetime.utcnow)  # ✅ ADD THIS
    created_at = Column(DateTime, default=datetime.utcnow)
    
class LearningReviewHint(Base):
    __tablename__ = "learning_review_hints"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    attempt_id = Column(Integer, ForeignKey("learning_review_attempts.id"), nullable=False)
    missing_point = Column(Text, nullable=False)
    hint_text = Column(Text, nullable=False)
    memory_trigger = Column(String(255))
    guiding_question = Column(Text)
    was_helpful = Column(Boolean, nullable=True)  # User can rate if hint was helpful
    created_at = Column(DateTime, default=datetime.utcnow)

class LearningReviewStats(Base):
    __tablename__ = "learning_review_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_reviews_created = Column(Integer, default=0)
    total_reviews_completed = Column(Integer, default=0)
    total_attempts = Column(Integer, default=0)
    average_completion_score = Column(Float, default=0.0)
    best_completion_score = Column(Float, default=0.0)
    total_study_time_minutes = Column(Float, default=0.0)
    favorite_review_type = Column(String(50), nullable=True)
    last_review_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UploadedSlide(Base):
    __tablename__ = "uploaded_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False)
    page_count = Column(Integer, default=0)
    extracted_text = Column(Text, nullable=True)
    preview_url = Column(String(500), nullable=True)
    processing_status = Column(String(50), default="pending")
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    user = relationship("User")





class QuestionAttempt(Base):
    __tablename__ = "question_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    answers = Column(Text, nullable=False)
    score = Column(Float, default=0.0)
    correct_count = Column(Integer, default=0)
    incorrect_count = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    
    
    user = relationship("User")
    question_set_id = Column(Integer, ForeignKey("question_sets.id"))
    
    question_set = relationship("QuestionSet", back_populates="attempt_records")
    

class QuestionResult(Base):
    __tablename__ = "question_results"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("question_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False)
    time_spent_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LearningReviewSlide(Base):
    __tablename__ = "learning_review_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

class QuestionSetSlide(Base):
    __tablename__ = "question_set_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

# ==================== PYDANTIC MODELS FOR API ====================

class LearningReviewCreate(BaseModel):
    user_id: str
    chat_session_ids: List[int]
    review_title: str = "Learning Review Session"
    review_type: str = "comprehensive"  # comprehensive, key_points, summary

class LearningReviewResponse(BaseModel):
    review_id: int
    user_response: str
    attempt_number: int = 1

class ReviewHintRequest(BaseModel):
    review_id: int
    missing_points: List[str]

class LearningReviewSummary(BaseModel):
    id: int
    title: str
    status: str
    total_points: int
    best_score: float
    current_attempt: int
    attempt_count: int
    session_titles: List[str]
    created_at: str
    completed_at: Optional[str]
    can_continue: bool

class ComprehensiveProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None

    preferred_first_name: Optional[str] = None
    preferred_last_name: Optional[str] = None
    study_goals: Optional[str] = None
    career_goals: Optional[str] = None
    preferred_subjects: Optional[List[str]] = None
    difficulty_level: Optional[str] = None
    study_schedule: Optional[str] = None
    learning_pace: Optional[str] = None
    motivation_factors: Optional[List[str]] = None
    weak_areas: Optional[List[str]] = None
    strong_areas: Optional[List[str]] = None
    time_zone: Optional[str] = None
    study_environment: Optional[str] = None
    preferred_language: Optional[str] = None
    preferred_session_length: Optional[str] = None
    break_frequency: Optional[str] = None
    best_study_times: Optional[List[str]] = None
    preferred_content_types: Optional[List[str]] = None
    learning_challenges: Optional[str] = None
    device_preferences: Optional[List[str]] = None
    accessibility_needs: Optional[List[str]] = None
    notification_preferences: Optional[List[str]] = None
    contact_method: Optional[str] = None
    communication_frequency: Optional[str] = None
    data_consent: Optional[List[str]] = None
    profile_visibility: Optional[str] = None

    class Config:
        extra = "ignore"
        
class ComprehensiveUserProfile(Base):
    __tablename__ = "comprehensive_user_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # New profile quiz fields
    is_college_student = Column(Boolean, default=True)
    college_level = Column(String(100), nullable=True)
    major = Column(String(200), nullable=True)
    main_subject = Column(String(200), nullable=True)
    
    preferred_subjects = Column(Text, nullable=True)
    brainwave_goal = Column(String(100), nullable=True)
    difficulty_level = Column(String(50), default="intermediate")
    learning_pace = Column(String(50), default="moderate")
    best_study_times = Column(Text, nullable=True)
    weak_areas = Column(Text, nullable=True)
    strong_areas = Column(Text, nullable=True)
    
    quiz_responses = Column(Text, nullable=True)
    quiz_completed = Column(Boolean, default=False)
    quiz_skipped = Column(Boolean, default=False)
    
    primary_archetype = Column(String(50), nullable=True)
    secondary_archetype = Column(String(50), nullable=True)
    archetype_scores = Column(Text, nullable=True)
    archetype_description = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="comprehensive_profile")

class Friendship(Base):
    """Represents a friendship between two users"""
    __tablename__ = "friendships"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="active")  # active, blocked
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])

class FriendRequest(Base):
    """Represents a friend request from one user to another"""
    __tablename__ = "friend_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
    
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])

class FriendActivity(Base):
    """Tracks friend achievements and milestones for activity feed"""
    __tablename__ = "friend_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # achievement, milestone, streak, quiz_completed
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)  # Icon name for frontend
    activity_data = Column(Text, nullable=True)  # JSON for additional data (renamed from metadata to avoid SQLAlchemy conflict)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id])

class Kudos(Base):
    """Reactions/kudos for friend achievements"""
    __tablename__ = "kudos"
    
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("friend_activities.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String(20), default="👏")  # emoji reaction
    created_at = Column(DateTime, default=datetime.utcnow)
    
    activity = relationship("FriendActivity", foreign_keys=[activity_id])
    user = relationship("User", foreign_keys=[user_id])

class Leaderboard(Base):
    """Leaderboard entries for different categories"""
    __tablename__ = "leaderboards"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)  # global, friends, subject, archetype
    metric = Column(String(50), nullable=False)  # total_hours, accuracy, streak, lessons
    period = Column(String(20), default="all_time")  # weekly, monthly, all_time
    score = Column(Float, default=0.0)
    rank = Column(Integer, nullable=True)
    subject_filter = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id])

class QuizBattle(Base):
    """1v1 quiz battles between users"""
    __tablename__ = "quiz_battles"
    
    id = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(20), default="intermediate")
    status = Column(String(20), default="pending")  # pending, active, completed, expired
    
    # Battle details
    question_count = Column(Integer, default=10)
    time_limit_seconds = Column(Integer, default=300)  # 5 minutes
    
    # Scores
    challenger_score = Column(Integer, default=0)
    opponent_score = Column(Integer, default=0)
    challenger_completed = Column(Boolean, default=False)
    opponent_completed = Column(Boolean, default=False)
    
    # Store answers as JSON
    challenger_answers = Column(Text, nullable=True)  # JSON array of answers
    opponent_answers = Column(Text, nullable=True)  # JSON array of answers
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    
    challenger = relationship("User", foreign_keys=[challenger_id])
    opponent = relationship("User", foreign_keys=[opponent_id])

class Challenge(Base):
    """Time-limited challenges for users"""
    __tablename__ = "challenges"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    challenge_type = Column(String(50), nullable=False)  # speed, accuracy, topic_mastery, streak
    subject = Column(String(100), nullable=True)
    
    # Challenge parameters
    target_metric = Column(String(50), nullable=False)
    target_value = Column(Float, nullable=False)
    time_limit_minutes = Column(Integer, nullable=True)
    
    # Status
    status = Column(String(20), default="active")  # active, completed, expired
    participant_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    
    creator = relationship("User", foreign_keys=[creator_id])

class ChallengeParticipation(Base):
    """User participation in challenges"""
    __tablename__ = "challenge_participations"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Performance
    score = Column(Float, default=0.0)
    progress = Column(Float, default=0.0)  # Percentage
    completed = Column(Boolean, default=False)
    rank = Column(Integer, nullable=True)
    
    # Timestamps
    joined_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    challenge = relationship("Challenge", foreign_keys=[challenge_id])
    user = relationship("User", foreign_keys=[user_id])

class BattleQuestion(Base):
    __tablename__ = "battle_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("quiz_battles.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    battle = relationship("QuizBattle", foreign_keys=[battle_id])

# Challenge Question Storage Model (add to models.py)
class ChallengeQuestion(Base):
    __tablename__ = "challenge_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    challenge = relationship("Challenge", foreign_keys=[challenge_id])

# User Answer Storage for Battles
class BattleAnswer(Base):
    __tablename__ = "battle_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("quiz_battles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("battle_questions.id"), nullable=False)
    selected_answer = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_taken = Column(Integer, nullable=True)  # seconds
    answered_at = Column(DateTime, default=datetime.utcnow)
    
    battle = relationship("QuizBattle", foreign_keys=[battle_id])
    user = relationship("User", foreign_keys=[user_id])
    question = relationship("BattleQuestion", foreign_keys=[question_id])

# User Answer Storage for Challenges
class ChallengeAnswer(Base):
    __tablename__ = "challenge_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("challenge_questions.id"), nullable=False)
    selected_answer = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime, default=datetime.utcnow)
    
    challenge = relationship("Challenge", foreign_keys=[challenge_id])
    user = relationship("User", foreign_keys=[user_id])
    question = relationship("ChallengeQuestion", foreign_keys=[question_id])


class SharedContent(Base):
    """Tracks content shared between users"""
    __tablename__ = "shared_content"
    
    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String(20), nullable=False)
    content_id = Column(Integer, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(10), default="view")
    message = Column(Text, nullable=True)
    shared_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, nullable=True)
    
    owner = relationship("User", foreign_keys=[owner_id])
    shared_with = relationship("User", foreign_keys=[shared_with_id])

class SharedContentAccess(Base):
    """Tracks access to shared content"""
    __tablename__ = "shared_content_access"
    
    id = Column(Integer, primary_key=True, index=True)
    shared_content_id = Column(Integer, ForeignKey("shared_content.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    accessed_at = Column(DateTime, default=datetime.utcnow)
    action = Column(String(20), nullable=False)
    
    shared_content = relationship("SharedContent", foreign_keys=[shared_content_id])
    user = relationship("User", foreign_keys=[user_id])
class SoloQuiz(Base):
    """Solo practice quizzes"""
    __tablename__ = "solo_quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(20), default="intermediate")
    status = Column(String(20), default="active")  # active, completed
    
    # Quiz details
    question_count = Column(Integer, default=10)
    time_limit_seconds = Column(Integer, default=300)
    
    # Score
    score = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    
    # Store answers as JSON
    answers = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User")

class SoloQuizQuestion(Base):
    """Questions for solo quizzes"""
    __tablename__ = "solo_quiz_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("solo_quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    
    quiz = relationship("SoloQuiz")

# ==================== GAMIFICATION MODELS ====================

class UserGamificationStats(Base):
    """Comprehensive gamification stats for each user"""
    __tablename__ = "user_gamification_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Points and Level
    total_points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)
    
    # Weekly Stats (reset every Monday)
    weekly_points = Column(Integer, default=0)
    weekly_ai_chats = Column(Integer, default=0)
    weekly_notes_created = Column(Integer, default=0)
    weekly_questions_answered = Column(Integer, default=0)
    weekly_quizzes_completed = Column(Integer, default=0)
    weekly_flashcards_created = Column(Integer, default=0)
    weekly_study_minutes = Column(Integer, default=0)
    weekly_battles_won = Column(Integer, default=0)
    
    # All-time Stats
    total_ai_chats = Column(Integer, default=0)
    total_notes_created = Column(Integer, default=0)
    total_questions_answered = Column(Integer, default=0)
    total_quizzes_completed = Column(Integer, default=0)
    total_flashcards_created = Column(Integer, default=0)
    total_study_minutes = Column(Integer, default=0)
    total_battles_won = Column(Integer, default=0)
    
    # Streaks
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime, nullable=True)
    
    # Timestamps
    week_start_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="gamification_stats")

class PointTransaction(Base):
    """Track all point-earning activities"""
    __tablename__ = "point_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)  # ai_chat, note_created, etc.
    points_earned = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    activity_metadata = Column(Text, nullable=True)  # JSON for additional data
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class WeeklyBingoProgress(Base):
    """Track weekly bingo challenge progress"""
    __tablename__ = "weekly_bingo_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start_date = Column(DateTime, nullable=False)
    
    # Bingo task completion
    task_1_completed = Column(Boolean, default=False)  # Chat 50 times
    task_2_completed = Column(Boolean, default=False)  # Answer 20 questions
    task_3_completed = Column(Boolean, default=False)  # Create 5 notes
    task_4_completed = Column(Boolean, default=False)  # Study 5 hours
    task_5_completed = Column(Boolean, default=False)  # Complete 3 quizzes
    task_6_completed = Column(Boolean, default=False)  # Create 10 flashcards
    task_7_completed = Column(Boolean, default=False)  # 7 day streak
    task_8_completed = Column(Boolean, default=False)  # Win 3 battles
    task_9_completed = Column(Boolean, default=False)  # Study 10 hours
    task_10_completed = Column(Boolean, default=False)  # Chat 100 times
    task_11_completed = Column(Boolean, default=False)  # Create 10 notes
    task_12_completed = Column(Boolean, default=False)  # Answer 50 questions
    task_13_completed = Column(Boolean, default=False)  # Complete 5 quizzes
    task_14_completed = Column(Boolean, default=False)  # Win 5 battles
    task_15_completed = Column(Boolean, default=False)  # Study 20 hours
    task_16_completed = Column(Boolean, default=False)  # Master level (level 5)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")

class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50))  # inactivity, quiz_poor_performance, achievement, etc.
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class Reminder(Base):
    """Calendar reminders and events"""
    __tablename__ = "reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    reminder_date = Column(DateTime, nullable=False)
    reminder_type = Column(String(50), default="event")  # event, reminder, deadline, study_session
    priority = Column(String(20), default="medium")  # low, medium, high, urgent
    color = Column(String(20), default="#3b82f6")
    
    is_completed = Column(Boolean, default=False)
    is_notified = Column(Boolean, default=False)
    notify_before_minutes = Column(Integer, default=15)  # Notify X minutes before
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")

class ConceptNode(Base):
    """Concept nodes for knowledge graph"""
    __tablename__ = "concept_nodes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    concept_name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # subject/topic category
    
    # Metadata
    importance_score = Column(Float, default=0.5)  # 0-1 scale
    mastery_level = Column(Float, default=0.0)  # 0-1 scale based on quiz performance
    
    # Visual positioning
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    # Related content counts
    notes_count = Column(Integer, default=0)
    quizzes_count = Column(Integer, default=0)
    flashcards_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User")

class ConceptConnection(Base):
    """Connections between concepts"""
    __tablename__ = "concept_connections"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    source_concept_id = Column(Integer, ForeignKey("concept_nodes.id"))
    target_concept_id = Column(Integer, ForeignKey("concept_nodes.id"))
    
    connection_type = Column(String(50))  # prerequisite, related, opposite, example_of, etc.
    strength = Column(Float, default=0.5)  # 0-1 scale, how strong the connection is
    
    ai_generated = Column(Boolean, default=False)
    user_confirmed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    source = relationship("ConceptNode", foreign_keys=[source_concept_id])
    target = relationship("ConceptNode", foreign_keys=[target_concept_id])

# ==================== NOTION-LEVEL FEATURES ====================

class NoteBlock(Base):
    """Block-based content for notes (like Notion)"""
    __tablename__ = "note_blocks"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    parent_block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    
    # Block properties
    block_type = Column(String(50), nullable=False)  # paragraph, heading1, heading2, heading3, list, code, quote, callout, toggle, divider, image, embed, table, etc.
    content = Column(Text, default="")
    properties = Column(JSON, nullable=True)  # Additional properties (language for code, color for callout, etc.)
    
    # Ordering
    position = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class NoteProperty(Base):
    """Custom properties for notes (tags, status, dates, etc.)"""
    __tablename__ = "note_properties"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    
    property_name = Column(String(100), nullable=False)
    property_type = Column(String(50), nullable=False)  # text, select, multi_select, date, checkbox, number, url, email, phone
    property_value = Column(Text, nullable=True)  # JSON for complex types
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoteTemplate(Base):
    """Note templates"""
    __tablename__ = "note_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # NULL for system templates
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="general")  # meeting, project, personal, study, etc.
    icon = Column(String(50), nullable=True)
    
    # Template content (JSON structure of blocks)
    template_blocks = Column(JSON, nullable=False)
    default_properties = Column(JSON, nullable=True)
    
    is_system = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoteLink(Base):
    """Links between notes (backlinks)"""
    __tablename__ = "note_links"
    
    id = Column(Integer, primary_key=True, index=True)
    source_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    target_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    
    link_type = Column(String(50), default="reference")  # reference, embed, mention
    context = Column(Text, nullable=True)  # Surrounding text for context
    
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteComment(Base):
    """Comments on notes"""
    __tablename__ = "note_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)  # Comment on specific block
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("note_comments.id"), nullable=True)  # For threaded comments
    
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoteVersion(Base):
    """Version history for notes"""
    __tablename__ = "note_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)  # Full content snapshot
    blocks_snapshot = Column(JSON, nullable=True)  # Block structure snapshot
    
    change_summary = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteCollaborator(Base):
    """Collaborators on notes"""
    __tablename__ = "note_collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    permission = Column(String(20), default="view")  # view, comment, edit
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    last_viewed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteDatabase(Base):
    """Database views for notes"""
    __tablename__ = "note_databases"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # View configuration
    view_type = Column(String(50), default="table")  # table, board, calendar, gallery, timeline, list
    view_config = Column(JSON, nullable=True)  # Filters, sorts, groups, etc.
    
    # Properties schema
    properties_schema = Column(JSON, nullable=False)  # Define columns/properties
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DatabaseEntry(Base):
    """Entries in a database"""
    __tablename__ = "database_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    database_id = Column(Integer, ForeignKey("note_databases.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)  # Link to actual note
    
    # Entry data
    entry_data = Column(JSON, nullable=False)  # Property values
    
    position = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class NoteEmbed(Base):
    """Embedded content in notes"""
    __tablename__ = "note_embeds"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    
    embed_type = Column(String(50), nullable=False)  # youtube, twitter, figma, pdf, image, video, audio, etc.
    embed_url = Column(Text, nullable=False)
    embed_data = Column(JSON, nullable=True)  # Metadata, thumbnails, etc.
    
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteAttachment(Base):
    """File attachments in notes"""
    __tablename__ = "note_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=False)
    mime_type = Column(String(100), nullable=True)
    
    preview_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteMention(Base):
    """User mentions in notes"""
    __tablename__ = "note_mentions"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mentioned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    context = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class NoteActivity(Base):
    """Activity log for notes"""
    __tablename__ = "note_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    activity_type = Column(String(50), nullable=False)  # created, edited, commented, shared, viewed, etc.
    activity_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== LEARNING PLAYLISTS ====================

class LearningPlaylist(Base):
    """Learning playlists - curated collections of learning resources"""
    __tablename__ = "learning_playlists"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., "Mathematics", "Programming", etc.
    difficulty_level = Column(String(20), default="intermediate")  # beginner, intermediate, advanced
    estimated_hours = Column(Float, nullable=True)
    is_public = Column(Boolean, default=True)
    is_collaborative = Column(Boolean, default=False)
    cover_color = Column(String(20), default="#4A90E2")
    tags = Column(JSON, nullable=True)  # Array of tags
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Stats
    fork_count = Column(Integer, default=0)
    follower_count = Column(Integer, default=0)
    completion_count = Column(Integer, default=0)
    
    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan")
    
class PlaylistItem(Base):
    """Individual items in a learning playlist"""
    __tablename__ = "playlist_items"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    
    # Item details
    item_type = Column(String(50), nullable=False)  # note, chat, external_link, video, article, quiz
    item_id = Column(Integer, nullable=True)  # Reference to internal content (note_id, chat_id, etc.)
    
    # For external resources
    title = Column(String(300), nullable=True)
    url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    
    # Metadata
    is_required = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)  # Creator's notes about this item
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    playlist = relationship("LearningPlaylist", back_populates="items")

class PlaylistFollower(Base):
    """Users following a playlist"""
    __tablename__ = "playlist_followers"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    progress_percentage = Column(Float, default=0.0)
    completed_items = Column(JSON, nullable=True)  # Array of completed item IDs
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])

class PlaylistFork(Base):
    """Track playlist forks (when someone copies and customizes a playlist)"""
    __tablename__ = "playlist_forks"
    
    id = Column(Integer, primary_key=True, index=True)
    original_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    forked_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    original_playlist = relationship("LearningPlaylist", foreign_keys=[original_playlist_id])
    forked_playlist = relationship("LearningPlaylist", foreign_keys=[forked_playlist_id])
    forked_by = relationship("User", foreign_keys=[forked_by_id])

class PlaylistCollaborator(Base):
    """Collaborators who can edit a playlist"""
    __tablename__ = "playlist_collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(20), default="edit")  # edit, view
    
    added_at = Column(DateTime, default=datetime.utcnow)
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])
    added_by = relationship("User", foreign_keys=[added_by_id])

class PlaylistComment(Base):
    """Comments on playlists"""
    __tablename__ = "playlist_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    comment_text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)  # 1-5 stars
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])

def create_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    create_tables()
    print("✅ Database tables created successfully!")