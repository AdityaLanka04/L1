from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class TopicMastery(Base):
    __tablename__ = "topic_mastery"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
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
    __tablename__ = "knowledge_roadmaps"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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
    __tablename__ = "node_exploration_history"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"))
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    roadmap_id = Column(Integer, ForeignKey("knowledge_roadmaps.id"))

    exploration_duration = Column(Integer, default=0)
    questions_asked = Column(Text, nullable=True)
    user_understanding_rating = Column(Integer, nullable=True)

    explored_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class LearningReview(Base):
    __tablename__ = "learning_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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


class LearningReviewSlide(Base):
    __tablename__ = "learning_review_slides"

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("learning_reviews.id"), nullable=False)
    slide_id = Column(Integer, ForeignKey("uploaded_slides.id"), nullable=False)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TopicKnowledgeBase(Base):
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


class GlobalKnowledgeBase(Base):
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
    __tablename__ = "ai_response_improvements"

    id = Column(Integer, primary_key=True, index=True)

    original_question = Column(Text)
    original_response = Column(Text)
    user_rating = Column(Integer)

    improvement_suggestion = Column(Text)
    improvement_type = Column(String(50))
    suggested_by_user_id = Column(Integer, ForeignKey("users.id"), index=True)

    is_implemented = Column(Boolean, default=False)
    implementation_notes = Column(Text, nullable=True)

    times_applied = Column(Integer, default=0)
    effectiveness_score = Column(Float, default=0.0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class CommonMisconceptions(Base):
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
    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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


class ConceptNode(Base):
    __tablename__ = "concept_nodes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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
    __tablename__ = "concept_connections"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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


class LearningPlaylist(Base):
    __tablename__ = "learning_playlists"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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
    __tablename__ = "playlist_followers"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    progress_percentage = Column(Float, default=0.0)
    completed_items = Column(JSON, nullable=True)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])


class PlaylistFork(Base):
    __tablename__ = "playlist_forks"

    id = Column(Integer, primary_key=True, index=True)
    original_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    forked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    forked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    original_playlist = relationship("LearningPlaylist", foreign_keys=[original_playlist_id])
    forked_playlist = relationship("LearningPlaylist", foreign_keys=[forked_playlist_id])
    forked_by = relationship("User", foreign_keys=[forked_by_id])


class PlaylistCollaborator(Base):
    __tablename__ = "playlist_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    permission = Column(String(20), default="edit")

    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    added_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])
    added_by = relationship("User", foreign_keys=[added_by_id])


class PlaylistComment(Base):
    __tablename__ = "playlist_comments"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("learning_playlists.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    comment_text = Column(Text, nullable=False)
    rating = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    playlist = relationship("LearningPlaylist", foreign_keys=[playlist_id])
    user = relationship("User", foreign_keys=[user_id])


class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    goal = Column(String, nullable=False)
    duration_weeks = Column(Integer, default=4)
    plan_data = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="active")

    user = relationship("User")


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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
