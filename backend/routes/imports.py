import io
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import models
from database import get_db
from deps import call_ai, get_current_user, get_user_by_email, get_user_by_username
from import_export_service import ImportExportService

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["imports"])

_MAX_IMPORT_SIZE = 20 * 1024 * 1024  # 20 MB
_ALLOWED_IMPORT_EXTENSIONS = {'pdf', 'docx', 'doc'}
_ALLOWED_IMPORT_MIMES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream',
}

@router.post("/import_document")
async def import_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user = current_user

        content = await file.read()

        if len(content) > _MAX_IMPORT_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum 20 MB.")

        filename = file.filename or ""
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if file_extension not in _ALLOWED_IMPORT_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file type. Supported: PDF, DOCX")

        extracted_text = ""

        if file_extension == 'pdf':
            if content[:4] != b'%PDF':
                raise HTTPException(status_code=400, detail="Invalid PDF file")
            if PyPDF2 is None:
                raise HTTPException(status_code=500, detail="PyPDF2 not installed")
            pdf_file = io.BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n\n"

        elif file_extension in ['docx', 'doc']:
            try:
                import docx
                docx_file = io.BytesIO(content)
                doc = docx.Document(docx_file)
                for paragraph in doc.paragraphs:
                    extracted_text += paragraph.text + "\n"
            except ImportError:
                raise HTTPException(
                    status_code=500,
                    detail="python-docx not installed. Install with: pip install python-docx"
                )

        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Supported: PDF, DOCX")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")

        paragraphs = extracted_text.strip().split('\n')
        html_content = ""

        for para in paragraphs:
            para = para.strip()
            if para:
                if len(para) < 50 and (para.isupper() or para.endswith(':')):
                    html_content += f"<h2>{para}</h2>"
                else:
                    html_content += f"<p>{para}</p>"

        note_title = file.filename.rsplit('.', 1)[0]
        new_note = models.Note(
            user_id=user.id,
            title=note_title,
            content=html_content
        )

        db.add(new_note)
        db.commit()
        db.refresh(new_note)

        logger.info(f"Imported {file_extension.upper()} file as note {new_note.id} for user {user.email}")

        return {
            "status": "success",
            "note_id": new_note.id,
            "title": note_title,
            "extracted_length": len(extracted_text),
            "message": f"Successfully imported {file.filename}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing document: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to import document")

@router.post("/upload-attachment")
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        filename = file.filename or ""
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if file_extension not in _ALLOWED_IMPORT_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file type. Supported: PDF, DOCX")

        content = await file.read()
        if len(content) > _MAX_IMPORT_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum 20 MB.")

        attachments_dir = Path("backend/attachments").resolve()
        attachments_dir.mkdir(exist_ok=True)

        import secrets as _sec
        safe_stem = "".join(c for c in (filename.rsplit('.', 1)[0] if '.' in filename else filename) if c.isalnum() or c in ('_', '-'))[:60]
        unique_filename = f"{current_user.id}_{_sec.token_hex(8)}_{safe_stem}.{file_extension}"
        file_path = attachments_dir / unique_filename

        with open(file_path, "wb") as f:
            f.write(content)

        file_size = len(content)
        file_url = f"/api/attachments/{unique_filename}"

        logger.info(f"Uploaded attachment: {unique_filename} ({file_size} bytes)")

        return {
            "status": "success",
            "filename": file.filename,
            "url": file_url,
            "size": file_size,
            "type": file_extension
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading attachment: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload attachment")

@router.get("/attachments/{filename:path}")
async def get_attachment(
    filename: str,
    current_user: models.User = Depends(get_current_user),
):
    try:
        attachments_dir = Path("backend/attachments").resolve()
        requested = (attachments_dir / filename).resolve()

        if not str(requested).startswith(str(attachments_dir)):
            raise HTTPException(status_code=400, detail="Invalid filename")

        if not requested.exists() or not requested.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        file_extension = requested.suffix.lstrip('.').lower()
        if file_extension not in _ALLOWED_IMPORT_EXTENSIONS:
            raise HTTPException(status_code=400, detail="File type not allowed")

        content_types = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword'
        }
        content_type = content_types.get(file_extension, 'application/octet-stream')

        return FileResponse(path=requested, media_type=content_type, filename=requested.name)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving attachment: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to serve attachment")

@router.post("/import_export/notes_to_flashcards")
async def convert_notes_to_flashcards(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        note_ids = payload.get("note_ids", [])
        card_count = payload.get("card_count", 10)
        difficulty = payload.get("difficulty", "medium")

        service = ImportExportService(db)
        result = await service.notes_to_flashcards(
            note_ids=note_ids,
            user_id=current_user.id,
            card_count=card_count,
            difficulty=difficulty
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="notes",
                destination_type="flashcards",
                source_ids=json.dumps(note_ids),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["card_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in notes_to_flashcards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/notes_to_questions")
async def convert_notes_to_questions(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        note_ids = payload.get("note_ids", [])
        question_count = payload.get("question_count", 10)
        difficulty = payload.get("difficulty", "medium")

        service = ImportExportService(db)
        result = await service.notes_to_questions(
            note_ids=note_ids,
            user_id=current_user.id,
            question_count=question_count,
            difficulty=difficulty
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="notes",
                destination_type="questions",
                source_ids=json.dumps(note_ids),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["question_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in notes_to_questions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/flashcards_to_notes")
async def convert_flashcards_to_notes(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])
        format_style = payload.get("format_style", "structured")

        service = ImportExportService(db)
        result = await service.flashcards_to_notes(
            set_ids=set_ids,
            user_id=current_user.id,
            format_style=format_style
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="flashcards",
                destination_type="notes",
                source_ids=json.dumps(set_ids),
                destination_ids=json.dumps([result["note_id"]]),
                item_count=result["card_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in flashcards_to_notes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/flashcards_to_questions")
async def convert_flashcards_to_questions(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])

        service = ImportExportService(db)
        result = await service.flashcards_to_questions(
            set_ids=set_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="flashcards",
                destination_type="questions",
                source_ids=json.dumps(set_ids),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["question_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in flashcards_to_questions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/questions_to_flashcards")
async def convert_questions_to_flashcards(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])

        service = ImportExportService(db)
        result = await service.questions_to_flashcards(
            set_ids=set_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="questions",
                destination_type="flashcards",
                source_ids=json.dumps(set_ids),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["card_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in questions_to_flashcards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/questions_to_notes")
async def convert_questions_to_notes(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])

        service = ImportExportService(db)
        result = await service.questions_to_notes(
            set_ids=set_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="questions",
                destination_type="notes",
                source_ids=json.dumps(set_ids),
                destination_ids=json.dumps([result["note_id"]]),
                item_count=1,
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in questions_to_notes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/media_to_questions")
async def convert_media_to_questions(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        media_ids = payload.get("media_ids", [])
        question_count = payload.get("question_count", 10)

        service = ImportExportService(db)
        result = await service.media_to_questions(
            media_ids=media_ids,
            user_id=current_user.id,
            question_count=question_count
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="media",
                destination_type="questions",
                source_ids=json.dumps(media_ids),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["question_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in media_to_questions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/playlist_to_notes")
async def convert_playlist_to_notes(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        playlist_id = int(payload.get("playlist_id"))

        service = ImportExportService(db)
        result = await service.playlist_to_notes(
            playlist_id=playlist_id,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="playlist",
                destination_type="notes",
                source_ids=json.dumps([playlist_id]),
                destination_ids=json.dumps([result["note_id"]]),
                item_count=result["items_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in playlist_to_notes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/playlist_to_flashcards")
async def convert_playlist_to_flashcards(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        playlist_id = int(payload.get("playlist_id"))
        card_count = int(payload.get("card_count", 15))

        service = ImportExportService(db)
        result = await service.playlist_to_flashcards(
            playlist_id=playlist_id,
            user_id=current_user.id,
            card_count=card_count
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="import",
                source_type="playlist",
                destination_type="flashcards",
                source_ids=json.dumps([playlist_id]),
                destination_ids=json.dumps([result["set_id"]]),
                item_count=result["card_count"],
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in playlist_to_flashcards: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/merge_notes")
async def merge_multiple_notes(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        note_ids = payload.get("note_ids", [])
        new_title = payload.get("title")

        service = ImportExportService(db)
        result = await service.merge_notes(
            note_ids=note_ids,
            user_id=current_user.id,
            new_title=new_title
        )

        if result["success"]:
            history = models.BatchOperation(
                user_id=current_user.id,
                operation_name="merge_notes",
                source_type="notes",
                source_ids=json.dumps(note_ids),
                result_id=result["note_id"],
                result_type="note",
                status="completed",
                progress=100,
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error in merge_notes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/export_flashcards_csv")
async def export_flashcards_csv(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])

        service = ImportExportService(db)
        result = service.export_flashcards_to_csv(
            set_ids=set_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="export",
                source_type="flashcards",
                destination_type="csv",
                source_ids=json.dumps(set_ids),
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error exporting flashcards to CSV: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/export_questions_pdf")
async def export_questions_pdf(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        set_ids = payload.get("set_ids", [])

        service = ImportExportService(db)
        result = service.export_questions_to_pdf(
            set_ids=set_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="export",
                source_type="questions",
                destination_type="pdf",
                source_ids=json.dumps(set_ids),
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error exporting questions to PDF: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/import_export/export_notes_markdown")
async def export_notes_markdown(
    payload: dict = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        note_ids = payload.get("note_ids", [])

        service = ImportExportService(db)
        result = service.export_notes_to_markdown(
            note_ids=note_ids,
            user_id=current_user.id
        )

        if result["success"]:
            history = models.ImportExportHistory(
                user_id=current_user.id,
                operation_type="export",
                source_type="notes",
                destination_type="markdown",
                source_ids=json.dumps(note_ids),
                status="completed",
                completed_at=datetime.now(timezone.utc)
            )
            db.add(history)
            db.commit()

        return result
    except Exception as e:
        logger.error(f"Error exporting notes to markdown: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/import_export/history")
async def get_import_export_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50
):
    try:
        history = db.query(models.ImportExportHistory).filter(
            models.ImportExportHistory.user_id == current_user.id
        ).order_by(models.ImportExportHistory.created_at.desc()).limit(limit).all()

        return {
            "history": [
                {
                    "id": h.id,
                    "operation_type": h.operation_type,
                    "source_type": h.source_type,
                    "destination_type": h.destination_type,
                    "item_count": h.item_count,
                    "status": h.status,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                    "completed_at": h.completed_at.isoformat() if h.completed_at else None
                }
                for h in history
            ]
        }
    except Exception as e:
        logger.error(f"Error getting import/export history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
