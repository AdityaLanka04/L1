"""
Enhanced Notes API with Notion-level features
- Block-based editing
- Templates
- Backlinks
- Comments
- Version history
- Collaboration
- Database views
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import json
import os

from models import (
    get_db, User, Note, Folder, NoteBlock, NoteProperty, NoteTemplate,
    NoteLink, NoteComment, NoteVersion, NoteCollaborator, NoteDatabase,
    DatabaseEntry, NoteEmbed, NoteAttachment, NoteMention, NoteActivity
)
from auth import get_current_user

router = APIRouter()

# ==================== PYDANTIC MODELS ====================

class BlockCreate(BaseModel):
    block_type: str
    content: str = ""
    properties: Optional[Dict] = None
    parent_block_id: Optional[int] = None
    position: int = 0

class BlockUpdate(BaseModel):
    content: Optional[str] = None
    properties: Optional[Dict] = None
    position: Optional[int] = None
