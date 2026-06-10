from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from database import Base


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    job_type = Column(String(64), nullable=False, default="chat_completion", index=True)
    status = Column(String(32), nullable=False, default="queued", index=True)
    input_json = Column(JSON, nullable=False)
    result_json = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    last_error = Column(Text, nullable=True)
    cache_status = Column(String(32), nullable=True)
    redis_job_id = Column(String(128), nullable=True, index=True)
    attempts = Column(Integer, nullable=False, default=0)
    progress_percent = Column(Integer, nullable=False, default=0)
    progress_message = Column(Text, nullable=True)
    timeout_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    queued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    started_at = Column(DateTime, nullable=True)
    retry_after = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User")
