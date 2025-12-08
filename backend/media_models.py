"""
Media Processing Models for AI-powered note generation
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from models import Base

class MediaUpload(Base):
    """Track uploaded media files"""
    __tablename__ = "media_uploads"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # File info
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(50), nullable=False)  # audio, video, youtube
    mime_type = Column(String(100), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    # Source info
    source_type = Column(String(50), nullable=False)  # upload, youtube, recording, podcast
    source_url = Column(String(500), nullable=True)
    
    # Processing status
    processing_status = Column(String(50), default="pending")  # pending, processing, completed, failed
    processing_progress = Column(Float, default=0.0)
    error_message = Column(Text, nullable=True)
    
    # Transcription
    transcription_text = Column(Text, nullable=True)
    transcription_language = Column(String(10), nullable=True)
    transcription_confidence = Column(Float, nullable=True)
    has_timestamps = Column(Boolean, default=False)
    
    # AI Analysis
    ai_summary = Column(Text, nullable=True)
    key_concepts = Column(JSON, nullable=True)  # Array of concepts
    topics = Column(JSON, nullable=True)  # Array of topics
    difficulty_level = Column(String(20), nullable=True)
    estimated_study_time = Column(Integer, nullable=True)  # minutes
    
    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    
    # Relationships
    transcription_segments = relationship("TranscriptionSegment", back_populates="media_upload", cascade="all, delete-orphan")
    generated_notes = relationship("GeneratedNote", back_populates="media_upload", cascade="all, delete-orphan")
    speaker_segments = relationship("SpeakerSegment", back_populates="media_upload", cascade="all, delete-orphan")

class TranscriptionSegment(Base):
    """Store transcription with timestamps"""
    __tablename__ = "transcription_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    media_upload_id = Column(Integer, ForeignKey("media_uploads.id"), nullable=False)
    
    # Segment info
    start_time = Column(Float, nullable=False)  # seconds
    end_time = Column(Float, nullable=False)  # seconds
    text = Column(Text, nullable=False)
    confidence = Column(Float, nullable=True)
    
    # Speaker info (if diarization available)
    speaker_id = Column(String(50), nullable=True)
    speaker_label = Column(String(100), nullable=True)
    
    # AI Analysis
    is_key_point = Column(Boolean, default=False)
    importance_score = Column(Float, nullable=True)
    concepts_mentioned = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    media_upload = relationship("MediaUpload", back_populates="transcription_segments")

class SpeakerSegment(Base):
    """Track different speakers in media"""
    __tablename__ = "speaker_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    media_upload_id = Column(Integer, ForeignKey("media_uploads.id"), nullable=False)
    
    speaker_id = Column(String(50), nullable=False)
    speaker_label = Column(String(100), nullable=True)  # User-assigned name
    total_speaking_time = Column(Float, default=0.0)  # seconds
    segment_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    media_upload = relationship("MediaUpload", back_populates="speaker_segments")

class GeneratedNote(Base):
    """AI-generated notes from media"""
    __tablename__ = "generated_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    media_upload_id = Column(Integer, ForeignKey("media_uploads.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)  # If saved to notes
    
    # Generation settings
    note_style = Column(String(50), nullable=False)  # detailed, summary, bullet_points, mind_map, cornell, outline, qa
    difficulty_level = Column(String(20), nullable=True)  # beginner, intermediate, advanced
    subject_context = Column(String(200), nullable=True)
    custom_instructions = Column(Text, nullable=True)
    
    # Generated content
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    html_content = Column(Text, nullable=True)
    
    # AI metadata
    key_concepts = Column(JSON, nullable=True)
    action_items = Column(JSON, nullable=True)
    questions = Column(JSON, nullable=True)
    flashcard_suggestions = Column(JSON, nullable=True)
    quiz_suggestions = Column(JSON, nullable=True)
    related_topics = Column(JSON, nullable=True)
    
    # Quality metrics
    completeness_score = Column(Float, nullable=True)
    clarity_score = Column(Float, nullable=True)
    user_rating = Column(Integer, nullable=True)  # 1-5
    
    # Timestamps
    generated_at = Column(DateTime, default=datetime.utcnow)
    saved_at = Column(DateTime, nullable=True)
    
    media_upload = relationship("MediaUpload", back_populates="generated_notes")

class MediaProcessingJob(Base):
    """Track background processing jobs"""
    __tablename__ = "media_processing_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    media_upload_id = Column(Integer, ForeignKey("media_uploads.id"), nullable=False)
    
    job_type = Column(String(50), nullable=False)  # transcription, analysis, note_generation
    status = Column(String(50), default="queued")  # queued, processing, completed, failed
    progress = Column(Float, default=0.0)
    
    # Job details
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Cost tracking (for API usage)
    api_calls = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class BatchProcessing(Base):
    """Batch processing for multiple files"""
    __tablename__ = "batch_processing"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    batch_name = Column(String(255), nullable=True)
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)
    
    status = Column(String(50), default="processing")  # processing, completed, failed
    
    # Settings applied to all files
    note_style = Column(String(50), nullable=True)
    difficulty_level = Column(String(20), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class PodcastSubscription(Base):
    """Track podcast RSS subscriptions"""
    __tablename__ = "podcast_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    podcast_name = Column(String(255), nullable=False)
    rss_url = Column(String(500), nullable=False)
    podcast_description = Column(Text, nullable=True)
    podcast_image = Column(String(500), nullable=True)
    
    auto_process = Column(Boolean, default=False)
    last_checked = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MediaTemplate(Base):
    """Custom templates for note generation"""
    __tablename__ = "media_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    template_name = Column(String(255), nullable=False)
    template_type = Column(String(50), nullable=False)  # cornell, outline, qa, custom
    template_structure = Column(JSON, nullable=False)
    
    # AI instructions
    ai_instructions = Column(Text, nullable=True)
    include_timestamps = Column(Boolean, default=True)
    include_key_concepts = Column(Boolean, default=True)
    include_action_items = Column(Boolean, default=True)
    include_questions = Column(Boolean, default=True)
    
    is_default = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
