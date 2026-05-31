from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone
from database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50))
    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class ReminderList(Base):
    __tablename__ = "reminder_lists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

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
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
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
