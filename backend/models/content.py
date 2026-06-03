from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone
from database import Base


class MediaFile(Base):
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

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


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    color = Column(String(50), default="#D7B38C")
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    media_file_id = Column(Integer, ForeignKey("media_files.id"), nullable=True)
    title = Column(String(255), default="Untitled Note")
    content = Column(Text, default="")
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    is_favorite = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    custom_font = Column(String(50), default="Inter")
    canvas_data = Column(Text, nullable=True)

    transcript = Column(Text, nullable=True)
    analysis = Column(Text, nullable=True)
    flashcards = Column(Text, nullable=True)
    quiz_questions = Column(Text, nullable=True)
    key_moments = Column(Text, nullable=True)

    user = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")
    media_file = relationship("MediaFile", back_populates="notes")


class UploadedSlide(Base):
    __tablename__ = "uploaded_slides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
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


class NoteBlock(Base):
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
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)


class NoteProperty(Base):
    __tablename__ = "note_properties"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)

    property_name = Column(String(100), nullable=False)
    property_type = Column(String(50), nullable=False)
    property_value = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class NoteTemplate(Base):
    __tablename__ = "note_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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
    __tablename__ = "note_links"

    id = Column(Integer, primary_key=True, index=True)
    source_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    target_note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)

    link_type = Column(String(50), default="reference")
    context = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteComment(Base):
    __tablename__ = "note_comments"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    parent_comment_id = Column(Integer, ForeignKey("note_comments.id"), nullable=True)

    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class NoteVersion(Base):
    __tablename__ = "note_versions"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    version_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    blocks_snapshot = Column(JSON, nullable=True)

    change_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteCollaborator(Base):
    __tablename__ = "note_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    permission = Column(String(20), default="view")
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    last_viewed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteDatabase(Base):
    __tablename__ = "note_databases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    view_type = Column(String(50), default="table")
    view_config = Column(JSON, nullable=True)

    properties_schema = Column(JSON, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class DatabaseEntry(Base):
    __tablename__ = "database_entries"

    id = Column(Integer, primary_key=True, index=True)
    database_id = Column(Integer, ForeignKey("note_databases.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)

    entry_data = Column(JSON, nullable=False)

    position = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class NoteEmbed(Base):
    __tablename__ = "note_embeds"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)

    embed_type = Column(String(50), nullable=False)
    embed_url = Column(Text, nullable=False)
    embed_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteAttachment(Base):
    __tablename__ = "note_attachments"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=False)
    mime_type = Column(String(100), nullable=True)

    preview_url = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteMention(Base):
    __tablename__ = "note_mentions"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("note_blocks.id"), nullable=True)
    mentioned_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mentioned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    context = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NoteActivity(Base):
    __tablename__ = "note_activities"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    activity_type = Column(String(50), nullable=False)
    activity_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
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
