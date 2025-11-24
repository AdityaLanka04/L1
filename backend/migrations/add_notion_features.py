"""
Migration to add Notion-level features to notes system
- Block-based content
- Templates
- Page properties
- Backlinks
- Comments
- Version history
- Collaboration features
"""

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brainwave_tutor.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
Base = declarative_base()

# ==================== NEW MODELS FOR NOTION FEATURES ====================

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

def upgrade():
    """Create all new tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Notion features tables created successfully!")

def downgrade():
    """Drop all new tables"""
    Base.metadata.drop_all(bind=engine)
    print("✅ Notion features tables dropped!")

if __name__ == "__main__":
    upgrade()
