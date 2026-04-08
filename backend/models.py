from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, ForeignKey,
    Boolean, Float, JSON, Date, func
)
from sqlalchemy.orm import relationship, sessionmaker, backref
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

import logging

logger = logging.getLogger(__name__)
import os

from question_bank_models import create_question_bank_models
from learning_paths_models import create_learning_paths_models

from database import Base, engine, SessionLocal

class DailyGoal(Base):
    __tablename__ = "daily_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    date = Column(Date, default=lambda: datetime.now(timezone.utc).date())
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    podcast_sessions = relationship("PodcastSessionMemory", back_populates="user")
    podcast_bookmarks = relationship("PodcastBookmark", back_populates="user")
    uploaded_slides = relationship("UploadedSlide", back_populates="user")
    uploaded_documents = relationship("UploadedDocument", back_populates="user")
    question_sets_new = relationship("QuestionSet", back_populates="user")
    question_sessions_new = relationship("QuestionSession", back_populates="user")
    performance_metrics = relationship("UserPerformanceMetrics", back_populates="user")
    gamification_stats = relationship("UserGamificationStats", back_populates="user", uselist=False)
    media_files = relationship("MediaFile", back_populates="user")
    learning_paths = relationship("LearningPath", backref="user")
    learning_path_progress = relationship("LearningPathProgress", backref="user")
    learning_node_progress = relationship("LearningNodeProgress", backref="user")

UploadedDocument, QuestionSet, Question, QuestionSession, UserPerformanceMetrics = create_question_bank_models(Base)
LearningPath, LearningPathNode, LearningPathProgress, LearningNodeProgress, LearningNodeNote = create_learning_paths_models(Base)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="New Chat")
    folder_id = Column(Integer, ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
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
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    chat_session = relationship("ChatSession", back_populates="messages")

class KnowledgeNode(Base):
    """Represents a knowledge topic node in the exploration tree"""
    __tablename__ = "knowledge_nodes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    parent_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=True)
    roadmap_id = Column(Integer, ForeignKey("knowledge_roadmaps.id"), nullable=True)
    
    topic_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    depth_level = Column(Integer, default=0)
    
    ai_explanation = Column(Text, nullable=True)
    key_concepts = Column(Text, nullable=True)
    why_important = Column(Text, nullable=True)
    real_world_examples = Column(Text, nullable=True)
    learning_tips = Column(Text, nullable=True)
    generated_subtopics = Column(Text, nullable=True)
    
    is_explored = Column(Boolean, default=False)
    exploration_count = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0)
    user_notes = Column(Text, nullable=True)
    is_manual = Column(Boolean, default=False)
    
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    expansion_status = Column(String(20), default="unexpanded")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_explored = Column(DateTime, nullable=True)
    
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
    
    total_nodes = Column(Integer, default=1)
    max_depth_reached = Column(Integer, default=0)
    total_exploration_time = Column(Integer, default=0)
    completion_percentage = Column(Float, default=0.0)
    
    status = Column(String(20), default="active")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, nullable=True)
    
    user = relationship("User")

class NodeExplorationHistory(Base):
    """Track detailed exploration history"""
    __tablename__ = "node_exploration_history"
    
    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    roadmap_id = Column(Integer, ForeignKey("knowledge_roadmaps.id"))
    
    exploration_duration = Column(Integer, default=0)
    questions_asked = Column(Text, nullable=True)
    user_understanding_rating = Column(Integer, nullable=True)
    
    explored_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    total_lessons = Column(Integer, default=0)
    total_hours = Column(Float, default=0.0)
    day_streak = Column(Integer, default=0)
    accuracy_percentage = Column(Float, default=0.0)
    last_activity = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="user_stats")

class MediaFile(Base):
    __tablename__ = "media_files"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    file_type = Column(String(20))
    original_filename = Column(String(255))
    file_size = Column(Integer, nullable=True)
    
    storage_path = Column(String(500), nullable=True)
    storage_type = Column(String(20), nullable=True)
    
    extracted_text = Column(Text)
    
    language = Column(String(10), nullable=True)
    duration = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    word_count = Column(Integer)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="media_files")
    notes = relationship("Note", back_populates="media_file")

class Note(Base):
    __tablename__ = "notes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    media_file_id = Column(Integer, ForeignKey("media_files.id"), nullable=True)
    title = Column(String(255), default="Untitled Note")
    content = Column(Text, default="")
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    is_favorite = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    custom_font = Column(String(50), default="Inter")
    
    transcript = Column(Text, nullable=True)
    analysis = Column(Text, nullable=True)
    flashcards = Column(Text, nullable=True)
    quiz_questions = Column(Text, nullable=True)
    key_moments = Column(Text, nullable=True)
    
    user = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")
    media_file = relationship("MediaFile", back_populates="notes")


class PodcastSessionMemory(Base):
    __tablename__ = "podcast_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), default="Media Podcast")
    source_type = Column(String(50), default="media")
    voice_mode = Column(String(50), default="coach")
    voice_persona = Column(String(50), default="mentor")
    difficulty = Column(String(20), default="intermediate")
    answer_language = Column(String(20), default="en")

    transcript = Column(Text, default="")
    analysis = Column(Text, default="{}")
    key_takeaways = Column(Text, default="[]")
    chapters = Column(Text, default="[]")
    conversation = Column(Text, default="[]")
    mcq_state = Column(Text, default="{}")
    session_options = Column(Text, default="{}")

    current_index = Column(Integer, default=-1)
    is_active = Column(Boolean, default=True)
    is_ended = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_accessed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="podcast_sessions")


class PodcastBookmark(Base):
    __tablename__ = "podcast_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), ForeignKey("podcast_sessions.session_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    chapter_index = Column(Integer, default=0)
    timestamp_seconds = Column(Integer, default=0)
    label = Column(String(255), default="Bookmarked moment")
    excerpt = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="podcast_bookmarks")

class Folder(Base):
    __tablename__ = "folders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(50), default="#D7B38C")
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder")

class ChatFolder(Base):
    __tablename__ = "chat_folders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(50), default="#D7B38C")
    parent_id = Column(Integer, ForeignKey("chat_folders.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_folders")
    chat_sessions = relationship("ChatSession", back_populates="folder")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    topic = Column(String(200), default="General")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    question_type = Column(String(50), nullable=True)
    difficulty_level = Column(String(50), nullable=True)
    user_satisfaction = Column(Integer, nullable=True)
    time_to_understand = Column(Float, nullable=True)
    follow_up_questions = Column(Integer, default=0)

    user = relationship("User", back_populates="activities")

class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    share_code = Column(String(6), unique=True, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200), default="New Flashcard Set")
    description = Column(Text, default="")
    source_type = Column(String(50), default="manual")
    source_id = Column(Integer, nullable=True)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
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
    marked_for_review = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime, nullable=True)
    ease_factor = Column(Float, default=2.5)
    interval = Column(Float, default=0)
    repetitions = Column(Integer, default=0)
    next_review_date = Column(DateTime, nullable=True)
    lapses = Column(Integer, default=0)
    sr_state = Column(String(20), default="new")
    learning_step = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    flashcard_set = relationship("FlashcardSet", back_populates="flashcards")

class FlashcardStudySession(Base):
    __tablename__ = "flashcard_study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    set_id = Column(Integer, ForeignKey("flashcard_sets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    cards_studied = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    session_duration = Column(Integer, nullable=False)
    session_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="flashcard_study_sessions")
    flashcard_set = relationship("FlashcardSet", back_populates="study_sessions")

class UserPersonalityProfile(Base):
    """Individual user personality profile"""
    __tablename__ = "user_personality_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    formality_preference = Column(Float, default=0.5)
    humor_preference = Column(Float, default=0.5)
    detail_preference = Column(Float, default=0.5)
    encouragement_preference = Column(Float, default=0.7)
    
    pace_preference = Column(String(50), default="medium")
    question_frequency = Column(Float, default=0.5)
    example_preference = Column(Float, default=0.7)
    repetition_tolerance = Column(Float, default=0.5)
    
    visual_learner_score = Column(Float, default=0.5)
    auditory_learner_score = Column(Float, default=0.5)
    kinesthetic_learner_score = Column(Float, default=0.5)
    reading_learner_score = Column(Float, default=0.5)
    
    session_length_preference = Column(Integer, default=30)
    break_frequency = Column(Integer, default=15)
    preferred_time_of_day = Column(String(50), nullable=True)
    
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    profile_confidence = Column(Float, default=0.1)
    
    user = relationship("User", back_populates="user_profile")

class LearningPattern(Base):
    """Track learning patterns and behaviors over time"""
    __tablename__ = "learning_patterns"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    most_active_hour = Column(Integer, nullable=True)
    most_active_day = Column(Integer, nullable=True)
    average_session_length = Column(Float, default=0.0)
    peak_performance_time = Column(String(50), nullable=True)
    
    questions_per_session = Column(Float, default=0.0)
    concepts_mastered_per_hour = Column(Float, default=0.0)
    retention_rate = Column(Float, default=0.0)
    
    help_seeking_frequency = Column(Float, default=0.0)
    topic_jumping_tendency = Column(Float, default=0.0)
    depth_vs_breadth = Column(Float, default=0.5)
    
    average_response_time = Column(Float, default=0.0)
    session_completion_rate = Column(Float, default=0.0)
    comeback_likelihood = Column(Float, default=0.0)
    
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="learning_patterns")

class UserPreferences(Base):
    """User preferences learned over time"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    preferred_explanation_style = Column(String(50), default="balanced")
    preferred_example_types = Column(JSON, nullable=True)
    language_complexity = Column(String(50), default="medium")
    
    favorite_subjects = Column(JSON, nullable=True)
    avoided_subjects = Column(JSON, nullable=True)
    preferred_difficulty_progression = Column(String(50), default="gradual")
    
    likes_challenges = Column(Boolean, default=True)
    likes_games = Column(Boolean, default=False)
    likes_storytelling = Column(Boolean, default=True)
    likes_step_by_step = Column(Boolean, default=True)
    
    wants_progress_updates = Column(Boolean, default=True)
    wants_encouragement = Column(Boolean, default=True)
    wants_constructive_criticism = Column(Boolean, default=True)
    
    prefers_visual_aids = Column(Boolean, default=False)
    prefers_mnemonics = Column(Boolean, default=False)
    prefers_analogies = Column(Boolean, default=True)
    prefers_real_examples = Column(Boolean, default=True)
    
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="user_preferences")

class TopicMastery(Base):
    """Track user's mastery level of different topics"""
    __tablename__ = "topic_mastery"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    topic_name = Column(String(100), index=True)
    mastery_level = Column(Float, default=0.0)
    confidence_level = Column(Float, default=0.0)
    last_practiced = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    times_studied = Column(Integer, default=0)
    questions_asked = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_time_spent = Column(Float, default=0.0)
    
    struggles_with = Column(JSON, nullable=True)
    excels_at = Column(JSON, nullable=True)
    
    prerequisite_topics = Column(JSON, nullable=True)
    related_topics = Column(JSON, nullable=True)
    
    last_studied = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="topic_mastery")

class EnhancedUserStats(Base):
    """Enhanced user statistics"""
    __tablename__ = "enhanced_user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    learning_velocity = Column(Float, default=0.0)
    comprehension_rate = Column(Float, default=0.0)
    retention_score = Column(Float, default=0.0)
    consistency_rating = Column(Float, default=0.0)
    
    weekly_sessions = Column(Integer, default=0)
    monthly_goal = Column(Integer, default=100)
    achievement_score = Column(Integer, default=0)
    study_level = Column(String(50), default="Beginner")
    favorite_subject = Column(String(100), default="General")
    
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    average_session_time = Column(Float, default=0.0)
    total_flashcards = Column(Integer, default=0)
    total_notes = Column(Integer, default=0)
    total_chat_sessions = Column(Integer, default=0)
    
    last_active_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="enhanced_stats")

class DailyLearningMetrics(Base):
    """Daily learning metrics for analytics"""
    __tablename__ = "daily_learning_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(Date, default=datetime.now(timezone.utc).date)
    
    sessions_completed = Column(Integer, default=0)
    time_spent_minutes = Column(Float, default=0.0)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    topics_studied = Column(Text, default="[]")
    
    accuracy_rate = Column(Float, default=0.0)
    engagement_score = Column(Float, default=0.0)
    difficulty_level_attempted = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="daily_metrics")

class Achievement(Base):
    """Achievement definitions"""
    __tablename__ = "achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    description = Column(Text)
    icon = Column(String(50))
    criteria = Column(JSON)
    points = Column(Integer, default=0)
    category = Column(String(50), default="general")
    rarity = Column(String(20), default="common")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user_achievements = relationship("UserAchievement", back_populates="achievement")

class UserAchievement(Base):
    """User achievements earned"""
    __tablename__ = "user_achievements"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    achievement_id = Column(Integer, ForeignKey("achievements.id"))
    
    earned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    progress_data = Column(JSON, nullable=True)
    
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")

class GlobalKnowledgeBase(Base):
    """Global knowledge base that improves for all users"""
    __tablename__ = "global_knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    
    question_pattern = Column(Text)
    response_template = Column(Text)
    topic_category = Column(String(100), index=True)
    difficulty_level = Column(String(50))
    
    success_rate = Column(Float, default=0.0)
    usage_count = Column(Integer, default=0)
    average_rating = Column(Float, default=0.0)
    
    created_from_feedback = Column(Boolean, default=False)
    original_user_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

class AIResponseImprovement(Base):
    """Track AI response improvements suggested by users"""
    __tablename__ = "ai_response_improvements"
    
    id = Column(Integer, primary_key=True, index=True)
    
    original_question = Column(Text)
    original_response = Column(Text)
    user_rating = Column(Integer)
    
    improvement_suggestion = Column(Text)
    improvement_type = Column(String(50))
    suggested_by_user_id = Column(Integer, ForeignKey("users.id"))
    
    is_implemented = Column(Boolean, default=False)
    implementation_notes = Column(Text, nullable=True)
    
    times_applied = Column(Integer, default=0)
    effectiveness_score = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class CommonMisconceptions(Base):
    """Track common misconceptions and how to address them"""
    __tablename__ = "common_misconceptions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    topic = Column(String(100), index=True)
    misconception_text = Column(Text)
    correct_explanation = Column(Text)
    
    trigger_phrases = Column(JSON)
    confusion_indicators = Column(JSON)
    
    detection_accuracy = Column(Float, default=0.0)
    correction_success_rate = Column(Float, default=0.0)
    times_encountered = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class UserFeedback(Base):
    """User feedback for continuous AI improvement"""
    __tablename__ = "user_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    feedback_type = Column(String(50))
    feedback_text = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    
    related_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    topic_context = Column(String(100), nullable=True)
    session_context = Column(JSON, nullable=True)
    
    is_processed = Column(Boolean, default=False)
    processing_notes = Column(Text, nullable=True)
    resulted_in_improvement = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="feedback_entries")

class AILearningMetrics(Base):
    """Track AI learning and improvement metrics"""
    __tablename__ = "ai_learning_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    
    date = Column(Date, default=datetime.now(timezone.utc).date)
    
    average_response_rating = Column(Float, default=0.0)
    total_interactions = Column(Integer, default=0)
    successful_interactions = Column(Integer, default=0)
    
    new_knowledge_entries = Column(Integer, default=0)
    improvements_implemented = Column(Integer, default=0)
    misconceptions_corrected = Column(Integer, default=0)
    
    user_satisfaction_trend = Column(Float, default=0.0)
    repeat_user_percentage = Column(Float, default=0.0)
    
    topic_performance_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ConversationMemory(Base):
    """Enhanced conversation memory for RAG system"""
    __tablename__ = "conversation_memories"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_id = Column(Integer, nullable=True)
    
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    context_summary = Column(Text, nullable=True)
    
    topic_tags = Column(JSON, nullable=True)
    question_type = Column(String(50), nullable=True)
    emotional_context = Column(String(50), nullable=True)
    
    question_embedding = Column(Text, nullable=True)
    answer_embedding = Column(Text, nullable=True)
    combined_embedding = Column(Text, nullable=True)
    
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime, nullable=True)
    user_feedback_score = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class TopicKnowledgeBase(Base):
    """Topic-based knowledge aggregation"""
    __tablename__ = "topic_knowledge_base"
    
    id = Column(Integer, primary_key=True, index=True)
    topic_name = Column(String(100), unique=True, index=True)
    
    key_concepts = Column(JSON, nullable=True)
    common_questions = Column(JSON, nullable=True)
    best_explanations = Column(JSON, nullable=True)
    
    topic_embedding = Column(Text, nullable=True)
    
    total_questions = Column(Integer, default=0)
    average_difficulty = Column(Float, default=0.5)
    success_rate = Column(Float, default=0.8)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

class LearningReviewAttempt(Base):
    __tablename__ = "learning_review_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    user_response = Column(Text, nullable=False)
    covered_points = Column(Text)
    missing_points = Column(Text)
    completeness_percentage = Column(Float, default=0.0)
    feedback = Column(Text)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
class LearningReviewHint(Base):
    __tablename__ = "learning_review_hints"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    attempt_id = Column(Integer, ForeignKey("learning_review_attempts.id"), nullable=False)
    missing_point = Column(Text, nullable=False)
    hint_text = Column(Text, nullable=False)
    memory_trigger = Column(String(255))
    guiding_question = Column(Text)
    was_helpful = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

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
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)
    
    user = relationship("User")

class SlideAnalysis(Base):
    __tablename__ = "slide_analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False, unique=True)
    analysis_data = Column(Text, nullable=False)
    analyzed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    slide = relationship("UploadedSlide", backref="analysis")

class UserWeakArea(Base):
    """Track user's weak areas based on wrong answers"""
    __tablename__ = "user_weak_areas"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String(255), nullable=False, index=True)
    subtopic = Column(String(255), nullable=True)
    
    total_questions = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    incorrect_count = Column(Integer, default=0)
    accuracy = Column(Float, default=0.0)
    
    weakness_score = Column(Float, default=0.0)
    consecutive_wrong = Column(Integer, default=0)
    last_wrong_streak = Column(Integer, default=0)
    
    practice_sessions = Column(Integer, default=0)
    last_practiced = Column(DateTime, nullable=True)
    improvement_rate = Column(Float, default=0.0)
    
    status = Column(String(50), default="needs_practice")
    priority = Column(Integer, default=5)
    
    first_identified = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class WrongAnswerLog(Base):
    """Detailed log of wrong answers for analysis"""
    __tablename__ = "wrong_answer_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    attempt_id = Column(Integer, ForeignKey("question_attempts.id"), nullable=True)
    
    question_text = Column(Text, nullable=False)
    topic = Column(String(255), nullable=True, index=True)
    difficulty = Column(String(20), nullable=True)
    
    correct_answer = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=False)
    
    mistake_type = Column(String(100), nullable=True)
    confidence_before = Column(Integer, nullable=True)
    
    reviewed = Column(Boolean, default=False)
    reviewed_at = Column(DateTime, nullable=True)
    understood_after_review = Column(Boolean, nullable=True)
    
    answered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")
    question = relationship("Question")

class PracticeRecommendation(Base):
    """AI-generated practice recommendations based on weak areas"""
    __tablename__ = "practice_recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    recommendation_type = Column(String(50), nullable=False)
    topic = Column(String(255), nullable=False)
    reason = Column(Text, nullable=True)
    priority = Column(Integer, default=5)
    
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=True)
    suggested_question_count = Column(Integer, default=5)
    suggested_difficulty = Column(String(20), default="medium")
    
    status = Column(String(50), default="pending")
    completed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)
    
    user = relationship("User")

class StudentStyleModel(Base):
    """
    Per-user NeuralUCB bandit state + per-student signal classifier.
    One row per user. Updated after every chat interaction.
    """
    __tablename__ = "student_style_models"

    id                       = Column(Integer, primary_key=True, index=True)
    user_id                  = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    bandit_state             = Column(Text, nullable=True)   # JSON: NeuralArm state_dicts per style
    pending_style            = Column(String(40), nullable=True)   # last selected style awaiting reward
    pending_context          = Column(Text, nullable=True)         # JSON: context vector for pending_style
    student_classifier_state = Column(Text, nullable=True)         # JSON: per-student W, b for signal head
    updated_at               = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class ChatConceptSignal(Base):
    """
    Per-message language analysis signal.
    Written after every non-trivial chat message, used by DKT and the weakness engine.
    """
    __tablename__ = "chat_concept_signals"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    chat_session_id  = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    concept          = Column(String(255), nullable=False, index=True)
    signal_type      = Column(String(40), nullable=False)
    knowledge_signal = Column(Float, nullable=False)
    message_snippet  = Column(String(300), nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

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
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class LearningReviewSlide(Base):
    __tablename__ = "learning_review_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class QuestionSetSlide(Base):
    __tablename__ = "question_set_slides"
    
    id = Column(Integer, primary_key=True, index=True)
    question_set_id = Column(Integer, ForeignKey("question_sets.id"), nullable=False)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class LearningReviewCreate(BaseModel):
    user_id: str
    chat_session_ids: List[int]
    review_title: str = "Learning Review Session"
    review_type: str = "comprehensive"

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
    
    show_study_insights = Column(Boolean, default=True)
    notifications_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="comprehensive_profile")

class Friendship(Base):
    """Represents a friendship between two users"""
    __tablename__ = "friendships"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])

class FriendRequest(Base):
    """Represents a friend request from one user to another"""
    __tablename__ = "friend_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    responded_at = Column(DateTime, nullable=True)
    
    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])

class FriendActivity(Base):
    """Tracks friend achievements and milestones for activity feed"""
    __tablename__ = "friend_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    activity_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", foreign_keys=[user_id])

class Kudos(Base):
    """Reactions/kudos for friend achievements"""
    __tablename__ = "kudos"
    
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("friend_activities.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String(20), default="👏")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    activity = relationship("FriendActivity", foreign_keys=[activity_id])
    user = relationship("User", foreign_keys=[user_id])

class Leaderboard(Base):
    """Leaderboard entries for different categories"""
    __tablename__ = "leaderboards"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False)
    metric = Column(String(50), nullable=False)
    period = Column(String(20), default="all_time")
    score = Column(Float, default=0.0)
    rank = Column(Integer, nullable=True)
    subject_filter = Column(String(100), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", foreign_keys=[user_id])

class QuizBattle(Base):
    """1v1 quiz battles between users"""
    __tablename__ = "quiz_battles"
    
    id = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opponent_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(100), nullable=False)
    difficulty = Column(String(20), default="intermediate")
    status = Column(String(20), default="pending")
    
    question_count = Column(Integer, default=10)
    time_limit_seconds = Column(Integer, default=300)
    
    challenger_score = Column(Integer, default=0)
    opponent_score = Column(Integer, default=0)
    challenger_completed = Column(Boolean, default=False)
    opponent_completed = Column(Boolean, default=False)
    
    challenger_answers = Column(Text, nullable=True)
    opponent_answers = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
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
    challenge_type = Column(String(50), nullable=False)
    subject = Column(String(100), nullable=True)
    
    target_metric = Column(String(50), nullable=False)
    target_value = Column(Float, nullable=False)
    time_limit_minutes = Column(Integer, nullable=True)
    
    status = Column(String(20), default="active")
    participant_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    
    creator = relationship("User", foreign_keys=[creator_id])

class ChallengeParticipation(Base):
    """User participation in challenges"""
    __tablename__ = "challenge_participations"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    score = Column(Float, default=0.0)
    progress = Column(Float, default=0.0)
    completed = Column(Boolean, default=False)
    rank = Column(Integer, nullable=True)
    
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
    challenge = relationship("Challenge", foreign_keys=[challenge_id])
    user = relationship("User", foreign_keys=[user_id])

class BattleQuestion(Base):
    __tablename__ = "battle_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("quiz_battles.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    battle = relationship("QuizBattle", foreign_keys=[battle_id])

class ChallengeQuestion(Base):
    __tablename__ = "challenge_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    challenge = relationship("Challenge", foreign_keys=[challenge_id])

class BattleAnswer(Base):
    __tablename__ = "battle_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("quiz_battles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("battle_questions.id"), nullable=False)
    selected_answer = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_taken = Column(Integer, nullable=True)
    answered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    battle = relationship("QuizBattle", foreign_keys=[battle_id])
    user = relationship("User", foreign_keys=[user_id])
    question = relationship("BattleQuestion", foreign_keys=[question_id])

class ChallengeAnswer(Base):
    __tablename__ = "challenge_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("challenge_questions.id"), nullable=False)
    selected_answer = Column(Integer, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
    shared_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, nullable=True)
    
    owner = relationship("User", foreign_keys=[owner_id])
    shared_with = relationship("User", foreign_keys=[shared_with_id])

class SharedContentAccess(Base):
    """Tracks access to shared content"""
    __tablename__ = "shared_content_access"
    
    id = Column(Integer, primary_key=True, index=True)
    shared_content_id = Column(Integer, ForeignKey("shared_content.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    accessed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
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
    status = Column(String(20), default="active")
    
    question_count = Column(Integer, default=10)
    time_limit_seconds = Column(Integer, default=300)
    
    score = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    
    answers = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User")

class SoloQuizQuestion(Base):
    """Questions for solo quizzes"""
    __tablename__ = "solo_quiz_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("solo_quizzes.id"), nullable=False)
    question = Column(Text, nullable=False)
    options = Column(Text, nullable=False)
    correct_answer = Column(Integer, nullable=False)
    explanation = Column(Text, nullable=True)
    
    quiz = relationship("SoloQuiz")

class UserGamificationStats(Base):
    """Comprehensive gamification stats for each user"""
    __tablename__ = "user_gamification_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    total_points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    experience = Column(Integer, default=0)
    
    weekly_points = Column(Integer, default=0)
    weekly_ai_chats = Column(Integer, default=0)
    weekly_notes_created = Column(Integer, default=0)
    weekly_questions_answered = Column(Integer, default=0)
    weekly_quizzes_completed = Column(Integer, default=0)
    weekly_flashcards_created = Column(Integer, default=0)
    weekly_study_minutes = Column(Integer, default=0)
    weekly_battles_won = Column(Integer, default=0)
    
    total_ai_chats = Column(Integer, default=0)
    total_notes_created = Column(Integer, default=0)
    total_questions_answered = Column(Integer, default=0)
    total_quizzes_completed = Column(Integer, default=0)
    total_flashcards_created = Column(Integer, default=0)
    total_study_minutes = Column(Integer, default=0)
    total_battles_won = Column(Integer, default=0)
    total_solo_quizzes = Column(Integer, default=0)
    total_flashcards_reviewed = Column(Integer, default=0)
    total_flashcards_mastered = Column(Integer, default=0)
    
    weekly_solo_quizzes = Column(Integer, default=0)
    weekly_flashcards_reviewed = Column(Integer, default=0)
    weekly_flashcards_mastered = Column(Integer, default=0)

    weekly_chat_goal = Column(Integer, default=10)
    weekly_note_goal = Column(Integer, default=5)
    weekly_flashcard_goal = Column(Integer, default=20)
    weekly_quiz_goal = Column(Integer, default=5)

    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(DateTime, nullable=True)
    
    week_start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="gamification_stats")

class PointTransaction(Base):
    """Track all point-earning activities"""
    __tablename__ = "point_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    points_earned = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    activity_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class WeeklyBingoProgress(Base):
    """Track weekly bingo challenge progress"""
    __tablename__ = "weekly_bingo_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start_date = Column(DateTime, nullable=False)
    
    task_1_completed = Column(Boolean, default=False)
    task_2_completed = Column(Boolean, default=False)
    task_3_completed = Column(Boolean, default=False)
    task_4_completed = Column(Boolean, default=False)
    task_5_completed = Column(Boolean, default=False)
    task_6_completed = Column(Boolean, default=False)
    task_7_completed = Column(Boolean, default=False)
    task_8_completed = Column(Boolean, default=False)
    task_9_completed = Column(Boolean, default=False)
    task_10_completed = Column(Boolean, default=False)
    task_11_completed = Column(Boolean, default=False)
    task_12_completed = Column(Boolean, default=False)
    task_13_completed = Column(Boolean, default=False)
    task_14_completed = Column(Boolean, default=False)
    task_15_completed = Column(Boolean, default=False)
    task_16_completed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class Notification(Base):
    """User notifications"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50))
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class ReminderList(Base):
    """Lists for organizing reminders (like Apple Reminders lists)"""
    __tablename__ = "reminder_lists"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    name = Column(String(100), nullable=False)
    color = Column(String(20), default="#3b82f6")
    icon = Column(String(50), default="list")
    is_smart_list = Column(Boolean, default=False)
    smart_list_type = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")
    reminders = relationship("Reminder", back_populates="list", cascade="all, delete-orphan")

class Reminder(Base):
    """Calendar reminders and events - Apple Reminders style"""
    __tablename__ = "reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    list_id = Column(Integer, ForeignKey("reminder_lists.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("reminders.id"), nullable=True)
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    
    reminder_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    reminder_type = Column(String(50), default="reminder")
    priority = Column(String(20), default="none")
    color = Column(String(20), default="#3b82f6")
    
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    is_flagged = Column(Boolean, default=False)
    is_notified = Column(Boolean, default=False)
    notify_before_minutes = Column(Integer, default=15)
    
    recurring = Column(String(20), default="none")
    recurring_interval = Column(Integer, default=1)
    recurring_end_date = Column(DateTime, nullable=True)
    recurring_days = Column(String(50), nullable=True)
    
    location = Column(String(200), nullable=True)
    location_reminder = Column(Boolean, default=False)
    
    tags = Column(Text, nullable=True)
    
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")
    list = relationship("ReminderList", back_populates="reminders")
    subtasks = relationship("Reminder", backref=backref("parent", remote_side=[id]), cascade="all, delete-orphan")

class ConceptNode(Base):
    """Concept nodes for knowledge graph"""
    __tablename__ = "concept_nodes"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    concept_name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    
    importance_score = Column(Float, default=0.5)
    mastery_level = Column(Float, default=0.0)
    
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    notes_count = Column(Integer, default=0)
    quizzes_count = Column(Integer, default=0)
    flashcards_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")

class ConceptConnection(Base):
    """Connections between concepts"""
    __tablename__ = "concept_connections"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    source_concept_id = Column(Integer, ForeignKey("concept_nodes.id"))
    target_concept_id = Column(Integer, ForeignKey("concept_nodes.id"))
    
    connection_type = Column(String(50))
    strength = Column(Float, default=0.5)
    
    ai_generated = Column(Boolean, default=False)
    user_confirmed = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User")
    source = relationship("ConceptNode", foreign_keys=[source_concept_id])
    target = relationship("ConceptNode", foreign_keys=[target_concept_id])

class NoteBlock(Base):
    """Block-based content for notes (like Notion)"""
    __tablename__ = "note_blocks"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    parent_block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    
    block_type = Column(String(50), nullable=False)
    content = Column(Text, default="")
    properties = Column(JSON, nullable=True)
    
    position = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class NoteProperty(Base):
    """Custom properties for notes (tags, status, dates, etc.)"""
    __tablename__ = "note_properties"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    
    property_name = Column(String(100), nullable=False)
    property_type = Column(String(50), nullable=False)
    property_value = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class NoteTemplate(Base):
    """Note templates"""
    __tablename__ = "note_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), default="general")
    icon = Column(String(50), nullable=True)
    
    template_blocks = Column(JSON, nullable=False)
    default_properties = Column(JSON, nullable=True)
    
    is_system = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class NoteLink(Base):
    """Links between notes (backlinks)"""
    __tablename__ = "note_links"
    
    id = Column(Integer, primary_key=True, index=True)
    source_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    target_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    
    link_type = Column(String(50), default="reference")
    context = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class NoteComment(Base):
    """Comments on notes"""
    __tablename__ = "note_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(Integer, ForeignKey("note_comments.id"), nullable=True)
    
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class NoteVersion(Base):
    """Version history for notes"""
    __tablename__ = "note_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    blocks_snapshot = Column(JSON, nullable=True)
    
    change_summary = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class NoteCollaborator(Base):
    """Collaborators on notes"""
    __tablename__ = "note_collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    permission = Column(String(20), default="view")
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    last_viewed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class NoteDatabase(Base):
    """Database views for notes"""
    __tablename__ = "note_databases"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    view_type = Column(String(50), default="table")
    view_config = Column(JSON, nullable=True)
    
    properties_schema = Column(JSON, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class DatabaseEntry(Base):
    """Entries in a database"""
    __tablename__ = "database_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    database_id = Column(Integer, ForeignKey("note_databases.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    
    entry_data = Column(JSON, nullable=False)
    
    position = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class NoteEmbed(Base):
    """Embedded content in notes"""
    __tablename__ = "note_embeds"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    
    embed_type = Column(String(50), nullable=False)
    embed_url = Column(Text, nullable=False)
    embed_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class NoteActivity(Base):
    """Activity log for notes"""
    __tablename__ = "note_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    activity_type = Column(String(50), nullable=False)
    activity_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class LearningPlaylist(Base):
    """Learning playlists - curated collections of learning resources"""
    __tablename__ = "learning_playlists"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    difficulty_level = Column(String(20), default="intermediate")
    estimated_hours = Column(Float, nullable=True)
    is_public = Column(Boolean, default=True)
    is_collaborative = Column(Boolean, default=False)
    cover_color = Column(String(20), default="#4A90E2")
    tags = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    fork_count = Column(Integer, default=0)
    follower_count = Column(Integer, default=0)
    completion_count = Column(Integer, default=0)
    
    creator = relationship("User", foreign_keys=[creator_id])
    items = relationship("PlaylistItem", back_populates="playlist", cascade="all, delete-orphan")
    
class PlaylistItem(Base):
    """Individual items in a learning playlist"""
    __tablename__ = "playlist_items"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    order_index = Column(Integer, nullable=False)
    
    item_type = Column(String(50), nullable=False)
    item_id = Column(Integer, nullable=True)
    
    title = Column(String(300), nullable=True)
    url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    platform = Column(String(100), nullable=True)
    
    is_required = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    playlist = relationship("LearningPlaylist", back_populates="items")

class PlaylistFollower(Base):
    """Users following a playlist"""
    __tablename__ = "playlist_followers"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    progress_percentage = Column(Float, default=0.0)
    completed_items = Column(JSON, nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    
    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])

class PlaylistFork(Base):
    """Track playlist forks (when someone copies and customizes a playlist)"""
    __tablename__ = "playlist_forks"
    
    id = Column(Integer, primary_key=True, index=True)
    original_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    forked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    original_playlist = relationship("LearningPlaylist", foreign_keys=[original_playlist_id])
    forked_playlist = relationship("LearningPlaylist", foreign_keys=[forked_playlist_id])
    forked_by = relationship("User", foreign_keys=[forked_by_id])

class PlaylistCollaborator(Base):
    """Collaborators who can edit a playlist"""
    __tablename__ = "playlist_collaborators"
    
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String(20), default="edit")
    
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
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
    rating = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])

class ImportExportHistory(Base):
    """Track all import/export operations"""
    __tablename__ = "import_export_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    operation_type = Column(String(20), nullable=False)
    source_type = Column(String(50), nullable=False)
    destination_type = Column(String(50), nullable=False)
    
    source_ids = Column(JSON, nullable=True)
    destination_ids = Column(JSON, nullable=True)
    
    item_count = Column(Integer, default=0)
    status = Column(String(20), default="completed")
    error_message = Column(Text, nullable=True)
    
    operation_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", foreign_keys=[user_id])

class ExportedFile(Base):
    """Track exported files (PDF, CSV, etc.)"""
    __tablename__ = "exported_files"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    history_id = Column(Integer, ForeignKey("import_export_history.id"), nullable=True)
    
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(20), nullable=False)
    file_size = Column(Integer, nullable=True)
    
    content_type = Column(String(50), nullable=False)
    download_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime, nullable=True)
    
    user = relationship("User", foreign_keys=[user_id])
    history = relationship("ImportExportHistory", foreign_keys=[history_id])

class BatchOperation(Base):
    """Track batch operations (merge, combine, etc.)"""
    __tablename__ = "batch_operations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    operation_name = Column(String(100), nullable=False)
    source_type = Column(String(50), nullable=False)
    source_ids = Column(JSON, nullable=False)
    
    result_id = Column(Integer, nullable=True)
    result_type = Column(String(50), nullable=True)
    
    status = Column(String(20), default="pending")
    progress = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", foreign_keys=[user_id])

class ExternalImport(Base):
    """Track imports from external sources"""
    __tablename__ = "external_imports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    source_platform = Column(String(50), nullable=False)
    source_url = Column(String(500), nullable=True)
    source_file_name = Column(String(255), nullable=True)
    
    import_type = Column(String(50), nullable=False)
    items_imported = Column(Integer, default=0)
    
    status = Column(String(20), default="pending")
    error_message = Column(Text, nullable=True)
    
    import_metadata = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
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
    logger.info(" Database tables created successfully!")

class PracticeSession(Base):
    """Practice session for weakness improvement"""
    __tablename__ = "practice_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic = Column(String, nullable=False)
    difficulty = Column(String, default="intermediate")
    target_question_count = Column(Integer, default=10)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    accuracy = Column(Float, default=0.0)
    max_streak = Column(Integer, default=0)
    avg_response_time = Column(Float, default=0.0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="active")
    
    user = relationship("User")
    answers = relationship("PracticeAnswer", back_populates="session", cascade="all, delete-orphan")

class PracticeAnswer(Base):
    """Individual answer in a practice session"""
    __tablename__ = "practice_answers"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("practice_sessions.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    user_answer = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, default=False)
    time_taken = Column(Integer, default=0)
    answered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    session = relationship("PracticeSession", back_populates="answers")

class StudyPlan(Base):
    """Personalized study plan"""
    __tablename__ = "study_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    goal = Column(String, nullable=False)
    duration_weeks = Column(Integer, default=4)
    plan_data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="active")
    
    user = relationship("User")

class ContextDocument(Base):
    """
    Tracks uploaded curriculum documents for Cerbyl HS Mode.
    scope: 'private' (user only) | 'hs_shared' (contributes to global hs_curriculum ChromaDB collection)

    FREE US HS Curriculum Sources for seeding hs_curriculum:
      OpenStax (CC-BY):   https://openstax.org/subjects
      CK-12 (free):       https://www.ck12.org
      LibreTexts:         math/chem/bio.libretexts.org
      AP Frameworks:      https://collegeboard.org/courses  (free PDF CED per course)
      Common Core:        https://corestandards.org
      NCBI Bookshelf:     https://www.ncbi.nlm.nih.gov/books/ (bio/anatomy, public domain)
    """
    __tablename__ = "context_documents"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    doc_id       = Column(String(36), unique=True, index=True, nullable=False)
    filename     = Column(String(255), nullable=False)
    file_type    = Column(String(10), nullable=False, default="pdf")
    subject      = Column(String(100), nullable=True)
    grade_level  = Column(String(20), nullable=True)
    scope        = Column(String(20), nullable=False, default="private")
    chunk_count  = Column(Integer, default=0)
    status       = Column(String(20), default="processing")
    source_url   = Column(String(500), nullable=True)
    source_name  = Column(String(200), nullable=True)
    license      = Column(String(80), nullable=True)
    curriculum   = Column(String(20), nullable=True)
    source_type  = Column(String(40), nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", backref="context_documents")

class GeneratedQuestion(Base):
    """AI-generated questions for practice"""
    __tablename__ = "generated_questions"
    
    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String, nullable=False)
    subtopic = Column(String, nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String, nullable=False)
    options = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    hints = Column(Text, nullable=True)
    difficulty = Column(String, default="intermediate")
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    times_used = Column(Integer, default=0)
    avg_accuracy = Column(Float, default=0.0)
