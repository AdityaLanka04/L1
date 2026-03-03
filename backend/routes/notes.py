import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from deps import call_ai, get_current_user, get_db, get_user_by_email, get_user_by_username, unified_ai

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["notes"])

class NoteCreate(BaseModel):
    user_id: str
    title: str = "New Note"
    content: str = ""

class NoteUpdate(BaseModel):
    note_id: int
    title: str
    content: str

class FolderCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = "#D7B38C"
    parent_id: Optional[int] = None

class NoteUpdateFolder(BaseModel):
    note_id: int
    folder_id: Optional[int] = None

class NoteFavorite(BaseModel):
    note_id: int
    is_favorite: bool

class AIWritingAssistRequest(BaseModel):
    user_id: str
    content: str
    action: str
    tone: Optional[str] = "professional"

class NoteAgentRequest(BaseModel):
    user_id: str
    action: str
    content: Optional[str] = None
    topic: Optional[str] = None
    tone: Optional[str] = "professional"
    depth: Optional[str] = "standard"
    context: Optional[str] = None

def _trim(text: Optional[str], limit: int) -> str:
    if not text:
        return ""
    return text[:limit]

def _build_note_agent_prompt(req: NoteAgentRequest) -> str:
    content = req.content or ""
    topic = req.topic or ""
    tone = req.tone or "professional"
    depth = req.depth or "standard"
    context = req.context or ""

    base = topic or content

    action_prompts = {
        "generate": f"Create comprehensive study notes about: {base}\n\nTone: {tone}\nDepth: {depth}\n",
        "explain": f"Explain this clearly and concisely:\n\n{_trim(content, 2000)}",
        "key_points": f"Extract 5-8 key points from:\n\n{_trim(content, 2000)}",
        "summarize": f"Summarize this:\n\n{_trim(content, 2000)}",
        "grammar": f"Fix grammar and spelling while preserving meaning:\n\n{_trim(content, 2000)}",
        "improve": f"Improve clarity and style:\n\n{_trim(content, 2000)}",
        "simplify": f"Simplify this for easier understanding:\n\n{_trim(content, 2000)}",
        "expand": f"Expand with more detail and examples:\n\n{_trim(content, 2000)}",
        "continue": f"Continue writing from where this text ends:\n\n{_trim(content, 1200)}",
        "tone_change": f"Rewrite in a {tone} tone:\n\n{_trim(content, 2000)}",
        "outline": f"Create a structured outline about: {base}\n\nTone: {tone}\nDepth: {depth}\n",
        "code": f"Help with this code or request:\n\n{_trim(content or topic, 2000)}",
    }

    prompt = action_prompts.get(req.action, f"Help with this request:\n\n{_trim(content or topic, 2000)}")

    if context:
        prompt += f"\n\nContext:\n{_trim(context, 2000)}"

    return prompt

@router.get("/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    notes = (
        db.query(models.Note)
        .filter(models.Note.user_id == user.id, models.Note.is_deleted == False)
        .order_by(models.Note.updated_at.desc())
        .all()
    )

    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
            "updated_at": n.updated_at.isoformat() + "Z" if n.updated_at else None,
            "is_favorite": getattr(n, "is_favorite", False),
            "folder_id": getattr(n, "folder_id", None),
            "custom_font": getattr(n, "custom_font", "Inter"),
            "is_deleted": False,
        }
        for n in notes
        if not n.is_deleted
    ]

@router.post("/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, note_data.user_id) or get_user_by_email(db, note_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_note = models.Note(user_id=user.id, title=note_data.title, content=note_data.content)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    try:
        from gamification_system import award_points
        award_points(db, user.id, "note_created")
        db.commit()
    except Exception:
        pass

    try:
        from tutor import chroma_store
        if chroma_store.available():
            import re as _re
            content_preview = ""
            if note_data.content:
                clean = _re.sub(r'<[^>]+>', '', note_data.content)
                clean = _re.sub(r'[#*_\[\]()]', '', clean).strip()
                content_preview = clean[:200]
            summary = (
                f"Note created: \"{note_data.title}\". "
                f"Content: {content_preview}" if content_preview else f"Note created: \"{note_data.title}\" (empty note)"
            )
            chroma_store.write_episode(
                user_id=str(user.id),
                summary=summary,
                metadata={
                    "source": "note_activity",
                    "action": "created",
                    "note_id": str(new_note.id),
                    "note_title": note_data.title[:100],
                },
            )
    except Exception as e:
        logger.warning(f"Chroma write failed on note create: {e}")

    return {
        "id": new_note.id,
        "title": new_note.title,
        "content": new_note.content,
        "user_id": user.id,
        "created_at": new_note.created_at.isoformat() + "Z",
        "updated_at": new_note.updated_at.isoformat() + "Z",
        "status": "success",
    }

@router.put("/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if note.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot update a deleted note")

    note.title = note_data.title
    note.content = note_data.content
    note.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(note)

    try:
        from tutor import chroma_store
        if chroma_store.available():
            import re as _re
            content_preview = ""
            if note_data.content:
                clean = _re.sub(r'<[^>]+>', '', note_data.content)
                clean = _re.sub(r'[#*_\[\]()]', '', clean).strip()
                content_preview = clean[:200]
            summary = (
                f"Note updated: \"{note_data.title}\". "
                f"Content: {content_preview}" if content_preview else f"Note updated: \"{note_data.title}\""
            )
            chroma_store.write_episode(
                user_id=str(note.user_id),
                summary=summary,
                metadata={
                    "source": "note_activity",
                    "action": "updated",
                    "note_id": str(note.id),
                    "note_title": note_data.title[:100],
                },
            )
    except Exception as e:
        logger.warning(f"Chroma write failed on note update: {e}")

    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "updated_at": note.updated_at.isoformat() + "Z",
        "status": "success",
    }

@router.delete("/delete_note/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted successfully"}

@router.get("/get_note/{note_id}")
def get_single_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "created_at": note.created_at.isoformat() + "Z" if note.created_at else None,
        "updated_at": note.updated_at.isoformat() + "Z" if note.updated_at else None,
        "is_favorite": getattr(note, "is_favorite", False),
        "folder_id": getattr(note, "folder_id", None),
        "custom_font": getattr(note, "custom_font", "Inter"),
    }

@router.put("/soft_delete_note/{note_id}")
def soft_delete_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    note.is_deleted = True
    note.deleted_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": "Note moved to trash", "note_id": note.id, "status": "success"}

@router.put("/restore_note/{note_id}")
def restore_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    note.is_deleted = False
    note.deleted_at = None
    db.commit()

    return {"message": "Note restored", "note_id": note.id, "status": "success"}

@router.delete("/permanent_delete_note/{note_id}")
def permanent_delete_note(note_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(note)
    db.commit()
    return {"message": "Note permanently deleted", "status": "success"}

@router.get("/get_trash")
def get_trash(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    notes = (
        db.query(models.Note)
        .filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == True,
            models.Note.deleted_at != None,
            models.Note.deleted_at >= thirty_days_ago,
        )
        .order_by(models.Note.deleted_at.desc())
        .all()
    )

    result = []
    for note in notes:
        deleted_at = note.deleted_at
        if deleted_at and deleted_at.tzinfo is None:
            deleted_at = deleted_at.replace(tzinfo=timezone.utc)
        days_remaining = max(0, 30 - (datetime.now(timezone.utc) - deleted_at).days) if deleted_at else 0

        result.append({
            "id": note.id,
            "title": note.title,
            "content": note.content[:200] if note.content else "",
            "deleted_at": deleted_at.isoformat() + "Z" if deleted_at else None,
            "days_remaining": days_remaining,
        })

    return {"trash": result, "total": len(result)}

@router.get("/get_folders")
def get_folders(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    folders = (
        db.query(models.Folder)
        .filter(models.Folder.user_id == user.id)
        .order_by(models.Folder.name.asc())
        .all()
    )

    return {
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "color": f.color,
                "parent_id": f.parent_id,
                "note_count": db.query(models.Note)
                .filter(models.Note.folder_id == f.id, models.Note.is_deleted == False)
                .count(),
                "created_at": f.created_at.isoformat() + "Z",
            }
            for f in folders
        ]
    }

@router.post("/create_folder")
def create_folder(folder_data: FolderCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, folder_data.user_id) or get_user_by_email(db, folder_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    folder = models.Folder(
        user_id=user.id,
        name=folder_data.name,
        color=folder_data.color,
        parent_id=folder_data.parent_id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    return {"id": folder.id, "name": folder.name, "color": folder.color, "status": "success"}

@router.delete("/delete_folder/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.query(models.Note).filter(models.Note.folder_id == folder_id).update({"folder_id": None})
    db.delete(folder)
    db.commit()

    return {"status": "success"}

@router.put("/move_note_to_folder")
def move_note_to_folder(data: NoteUpdateFolder, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    note.folder_id = data.folder_id
    db.commit()

    return {"status": "success"}

@router.put("/toggle_favorite")
def toggle_favorite(data: NoteFavorite, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    note = db.query(models.Note).filter(models.Note.id == data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if note.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    note.is_favorite = data.is_favorite
    db.commit()

    return {"status": "success", "is_favorite": note.is_favorite}

@router.get("/get_favorite_notes")
def get_favorite_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    notes = (
        db.query(models.Note)
        .filter(
            models.Note.user_id == user.id,
            models.Note.is_favorite == True,
            models.Note.is_deleted == False,
        )
        .order_by(models.Note.updated_at.desc())
        .all()
    )

    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
            "updated_at": n.updated_at.isoformat() + "Z" if n.updated_at else None,
            "is_favorite": True,
            "folder_id": getattr(n, "folder_id", None),
        }
        for n in notes
    ]

@router.post("/generate_note_content/")
async def generate_note_content(
    user_id: str = Form(...),
    topic: str = Form(...),
    db: Session = Depends(get_db),
):
    prompt = (
        f"Create comprehensive study notes on: {topic}\n\n"
        f"Format with markdown headers, bullet points, and key concepts. "
        f"Include examples where helpful."
    )
    try:
        content = call_ai(prompt, max_tokens=2000, temperature=0.7)
        return {"content": content.strip(), "status": "success"}
    except Exception as e:
        return {"content": "", "status": "error", "error": str(e)}

@router.post("/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db),
):
    if import_mode == "exam_prep":
        prompt = (
            f"Create an exam preparation guide from this conversation. Include:\n"
            f"1. Key Concepts\n2. Study Strategy\n3. Review Checklist\n\n"
            f"Conversation: {conversation_data[:3000]}"
        )
    else:
        prompt = (
            f"Create study notes from this conversation. "
            f"Format with headers, bullet points, and key concepts.\n\n"
            f"Conversation: {conversation_data[:3000]}"
        )

    try:
        content = call_ai(prompt, max_tokens=2000, temperature=0.5)
        return {"content": content.strip(), "title": session_titles, "status": "success"}
    except Exception as e:
        return {"content": conversation_data[:500], "title": session_titles, "status": "fallback"}

@router.post("/expand_note_content/")
async def expand_note_content(
    user_id: str = Form(...),
    content: str = Form(...),
    db: Session = Depends(get_db),
):
    prompt = (
        f"Expand and enrich these study notes with more detail, examples, and explanations:\n\n"
        f"{content[:3000]}\n\nExpanded notes:"
    )
    try:
        expanded = call_ai(prompt, max_tokens=2000, temperature=0.7)
        return {"content": expanded.strip(), "status": "success"}
    except Exception as e:
        return {"content": content, "status": "error"}

@router.post("/ai_writing_assistant/")
async def ai_writing_assistant(
    request: AIWritingAssistRequest,
    db: Session = Depends(get_db),
):
    action_prompts = {
        "continue": f"Continue writing from where this text left off:\n\n{request.content[-1000:]}",
        "improve": f"Improve the clarity and quality of this text:\n\n{request.content[:2000]}",
        "simplify": f"Simplify this text for easier understanding:\n\n{request.content[:2000]}",
        "expand": f"Expand on the ideas in this text with more detail:\n\n{request.content[:2000]}",
        "tone_change": f"Rewrite this text in a {request.tone} tone:\n\n{request.content[:2000]}",
    }

    prompt = action_prompts.get(request.action, f"Help with this text:\n\n{request.content[:2000]}")

    try:
        result = call_ai(prompt, max_tokens=1500, temperature=0.7)
        return {"content": result.strip(), "status": "success", "action": request.action}
    except Exception as e:
        return {"content": "", "status": "error", "error": str(e)}

@router.post("/agents/notes")
async def notes_agent(
    request: NoteAgentRequest,
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, request.user_id) or get_user_by_email(db, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        prompt = _build_note_agent_prompt(request)
        result = call_ai(prompt, max_tokens=1500, temperature=0.7)
        return {"success": True, "content": result.strip(), "action": request.action}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.put("/update_shared_note/{note_id}")
def update_shared_note(note_id: int, data: dict, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if "title" in data:
        note.title = data["title"]
    if "content" in data:
        note.content = data["content"]
    note.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success"}
