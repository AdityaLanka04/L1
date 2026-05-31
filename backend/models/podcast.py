from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


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
