import io
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

import models
from deps import (
    call_ai,
    get_current_user,
    get_db,
)

CHAT_UPLOAD_DIR = Path("uploads/chat_images")
CHAT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_BYTES = 20 * 1024 * 1024
_MAX_IMAGES_PER_MESSAGE = 10

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])

def _assert_user_matches_request(user_id: Optional[str], current_user: models.User) -> None:
    if user_id is None:
        return
    requested = str(user_id).strip().lower()
    allowed = {
        (current_user.username or "").strip().lower(),
        (current_user.email or "").strip().lower(),
    }
    if requested and requested not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")

def _context_only_fallback_answer(user_id: str, question: str, context_doc_ids: list[str]) -> str:
    selected_ids = [str(d).strip() for d in (context_doc_ids or []) if str(d).strip()]
    if not selected_ids:
        return call_ai(question)

    try:
        from services import context_store
        if not context_store.available():
            return (
                "Selected context retrieval is unavailable right now, so I can't answer "
                "strictly from the chosen context documents."
            )

        q = (question or "").strip() or "Summarize the selected context."
        results = context_store.search_context(
            query=q,
            user_id=str(user_id),
            use_hs=False,
            top_k=8,
            doc_ids=selected_ids,
        )
        chunks = [r.get("text", "").strip() for r in results if r.get("text")]
        if not chunks:
            return (
                "I couldn’t find enough relevant information in the selected context documents "
                "to answer that. Please select more relevant context pages/files and try again."
            )

        context_blob = "\n\n".join(f"--- Chunk {i+1} ---\n{c}" for i, c in enumerate(chunks[:6]))
        prompt = (
            "You are a tutor in STRICT CONTEXT-ONLY mode.\n"
            "Use only the provided context chunks.\n"
            "Do not use outside knowledge.\n"
            "If the answer is not supported by these chunks, say so clearly.\n\n"
            f"Question:\n{q}\n\n"
            f"Selected context chunks:\n{context_blob}\n"
        )
        return call_ai(prompt)
    except Exception as e:
        logger.warning(f"Context-only fallback failed: {e}")
        return (
            "I couldn't complete a context-only answer right now. "
            "Please try again in a moment."
        )

class ChatSessionCreate(BaseModel):
    user_id: str
    title: str = "New Chat"

class ChatMessageSave(BaseModel):
    chat_id: int
    user_message: str
    ai_response: str

class GenerateChatTitleRequest(BaseModel):
    chat_id: int
    user_id: str

class ChatFolderCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = "#D7B38C"
    parent_id: Optional[int] = None

class ChatUpdateFolder(BaseModel):
    chat_id: int
    folder_id: Optional[int] = None

@router.post("/ask/")
async def ask_ai(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    use_hs_context: bool = Form(True),
    context_doc_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        selected_doc_ids = [x.strip() for x in (context_doc_ids or "").split(",") if x.strip()][:200]
        chat_id_int = int(chat_id) if chat_id else None

        _assert_user_matches_request(user_id, current_user)
        user = current_user

        logger.info(
            f"[CHAT ROUTE] message | user={user.id} "
            f"HS_MODE={'ON  <-- curriculum RAG will run' if use_hs_context else 'OFF <-- no RAG, model-only'} "
            f"| q='{question[:80]}'"
        )

        today = datetime.now(timezone.utc).date()
        daily_metric = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date == today,
            )
        ).first()

        if not daily_metric:
            daily_metric = models.DailyLearningMetrics(
                user_id=user.id,
                date=today,
                questions_answered=0,
                correct_answers=0,
                sessions_completed=0,
                time_spent_minutes=0.0,
                accuracy_rate=0.0,
                engagement_score=0.0,
            )
            db.add(daily_metric)
            db.commit()
            db.refresh(daily_metric)

        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")

        chat_history_for_tutor = []
        if chat_id_int:
            recent_msgs_for_ctx = (
                db.query(models.ChatMessage)
                .filter(models.ChatMessage.chat_session_id == chat_id_int)
                .order_by(models.ChatMessage.timestamp.desc())
                .limit(20)
                .all()
            )
            chat_history_for_tutor = [
                {"user": msg.user_message, "ai": msg.ai_response}
                for msg in reversed(recent_msgs_for_ctx)
            ]

        ml_output = None
        ml_addendum = ""
        try:
            from services.ml_pipeline import MessageMLPipeline, SessionContext, ModelRegistry
            from services.memory_service import get_memory_service

            session_state = None
            session_msg_count = len(chat_history_for_tutor)
            if chat_id_int:
                session_state = db.query(models.CerbylSessionState).filter_by(
                    session_id=chat_id_int
                ).first()
                if not session_state:
                    session_state = models.CerbylSessionState(
                        session_id=chat_id_int,
                        user_id=user.id,
                        started_at=datetime.now(timezone.utc),
                        message_count=0,
                    )
                    db.add(session_state)
                    db.commit()
                    db.refresh(session_state)

            ctx = SessionContext(
                session_id=chat_id_int,
                message_count=session_state.message_count if session_state else session_msg_count,
                current_concept_id=session_state.current_concept_id if session_state else None,
                messages_on_concept=(
                    (session_state.messages_on_concept or {}).get(
                        session_state.current_concept_id or "", 0
                    ) if session_state else 0
                ),
                frustration_trend=session_state.frustration_trend or [] if session_state else [],
                engagement_trend=session_state.engagement_trend or [] if session_state else [],
            )

            pipeline = MessageMLPipeline(None, get_memory_service())
            ml_output = await pipeline.process(question, str(user.id), ctx, db)
            ml_addendum = pipeline.build_system_prompt_addendum(ml_output)

            if session_state and ml_output:
                session_state.message_count += 1
                session_state.last_message_at = datetime.now(timezone.utc)
                trend = session_state.frustration_trend or []
                trend.append(round(ml_output.frustration_score, 3))
                session_state.frustration_trend = trend[-10:]
                if ml_output.detected_concepts:
                    session_state.current_concept_id = ml_output.detected_concepts[0]
                    mon = session_state.messages_on_concept or {}
                    cid = ml_output.detected_concepts[0]
                    mon[cid] = mon.get(cid, 0) + 1
                    session_state.messages_on_concept = mon
                db.commit()

        except Exception as _ml_err:
            logger.debug(f"[CHAT] ML pipeline skipped: {_ml_err}")

        try:
            from services.context_agent import get_context_agent, LearningEvent

            _agent = get_context_agent()
            if _agent and ml_output:
                _event = LearningEvent(
                    student_id=str(user.id),
                    source="chat",
                    event_type="message",
                    concept_id=(ml_output.detected_concepts[0] if ml_output.detected_concepts else ""),
                    concept_name="",
                    session_id=chat_id_int,
                    frustration=ml_output.frustration_score,
                    intent=ml_output.intent,
                    message=question[:300],
                )
                _agent.record_event(db, _event)
        except Exception as _ag_err:
            logger.debug(f"[CHAT] context agent skipped: {_ag_err}")

        from tutor.graph import get_tutor

        tutor = get_tutor()
        if tutor:
            result = await tutor.invoke(
                user_id=str(user.id),
                user_input=question,
                chat_id=chat_id_int,
                chat_history=chat_history_for_tutor,
                use_hs_context=bool(use_hs_context),
                context_doc_ids=selected_doc_ids,
                context_only=bool(selected_doc_ids),
                ml_addendum=ml_addendum,
            )
            response_text = result.get("response", "")
            try:
                from services.math_processor import process_math_in_response
                response_text = process_math_in_response(response_text)
            except Exception:
                pass
        else:
            response_text = _context_only_fallback_answer(str(user.id), question, selected_doc_ids)

        if ml_output:
            try:
                ml_log = models.MessageMLLog(
                    session_id=chat_id_int,
                    user_id=user.id,
                    message_text=question[:500],
                    intent_class=ml_output.intent,
                    concept_ids=ml_output.detected_concepts,
                    frustration_score=ml_output.frustration_score,
                    engagement_score=ml_output.engagement_score,
                    cognitive_state=ml_output.cognitive_state,
                    archetype=ml_output.archetype,
                    response_strategy=ml_output.response_strategy,
                    kt_delta=ml_output.kt_after,
                    memories_used=ml_output.memories_used,
                    messages_this_session=len(chat_history_for_tutor) + 1,
                )
                db.add(ml_log)
            except Exception:
                pass

        if chat_id_int:
            msg = models.ChatMessage(
                chat_session_id=chat_id_int,
                user_id=user.id,
                user_message=question,
                ai_response=response_text,
                is_user=True,
                timestamp=datetime.now(timezone.utc),
            )
            db.add(msg)

            session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if session:
                session.updated_at = datetime.now(timezone.utc)

            try:
                from services.gamification_system import award_points
                award_points(db, user.id, "ai_chat", {"question": question})
            except Exception:
                pass

            db.commit()

        _intent_result = None
        _computed_confidence = 0.72
        try:
            from services.intent_engine import CerbylIntentEngine
            _engine = CerbylIntentEngine.get()
            _intent_result = _engine.classify(question)
            _computed_confidence = _engine.estimate_response_confidence(
                result=_intent_result,
                response_text=response_text,
                engagement_score=ml_output.engagement_score if ml_output else 0.5,
                frustration_score=ml_output.frustration_score if ml_output else 0.0,
                p_mastery=ml_output.p_mastery if ml_output else 0.1,
            )
            _implicit_label = (
                "INSTRUCTION" if _intent_result.is_instruction() else
                "CASUAL"      if _intent_result.is_casual()      else
                _intent_result.label
            )
            _implicit_weight = 1.5 if _implicit_label == "INSTRUCTION" else 0.7
            _engine.record_signal(question, _implicit_label, weight=_implicit_weight)
        except Exception as _ie_err:
            logger.debug("[CHAT] IntentEngine skipped: %s", _ie_err)

        return {
            "answer":            response_text,
            "ai_confidence":     _computed_confidence,
            "topics_discussed":  ml_output.detected_concepts if ml_output else [],
            "query_type":        ml_output.intent if ml_output else "conversational_learning",
            "intent_class":      _intent_result.label if _intent_result else "LEARN_CONCEPT",
            "intent_proba":      _intent_result.proba if _intent_result else {},
            "active_rules":      [{"domain": r.domain, "negated": r.negated}
                                  for r in (_intent_result.active_rules if _intent_result else [])],
            "questions_today":   daily_metric.questions_answered,
            "frustration_score": ml_output.frustration_score if ml_output else 0.0,
            "response_strategy": ml_output.response_strategy if ml_output else "",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /api/ask/: {e}", exc_info=True)
        return {
            "answer": "I apologize, but I encountered an error. Could you please rephrase your question?",
            "ai_confidence": 0.3,
            "topics_discussed": ["error"],
            "query_type": "error",
        }

@router.post("/ask_simple/")
async def ask_simple(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    use_hs_context: bool = Form(True),
    context_doc_ids: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        selected_doc_ids = [x.strip() for x in (context_doc_ids or "").split(",") if x.strip()][:200]
        _assert_user_matches_request(user_id, current_user)
        user = current_user

        chat_id_int = int(chat_id) if chat_id else None

        chat_history = []
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")

            recent_msgs = (
                db.query(models.ChatMessage)
                .filter(models.ChatMessage.chat_session_id == chat_id_int)
                .order_by(models.ChatMessage.timestamp.desc())
                .limit(20)
                .all()
            )
            chat_history = [
                {"user": msg.user_message, "ai": msg.ai_response}
                for msg in reversed(recent_msgs)
            ]

        from tutor.graph import get_tutor

        tutor = get_tutor()
        if tutor:
            result = await tutor.invoke(
                user_id=str(user.id),
                user_input=question,
                chat_id=chat_id_int,
                chat_history=chat_history,
                use_hs_context=bool(use_hs_context),
                context_doc_ids=selected_doc_ids,
                context_only=bool(selected_doc_ids),
            )
            response_text = result.get("response", "")
            try:
                from services.math_processor import process_math_in_response
                response_text = process_math_in_response(response_text)
            except Exception:
                pass
        else:
            response_text = _context_only_fallback_answer(str(user.id), question, selected_doc_ids)

        if chat_id_int:
            msg = models.ChatMessage(
                chat_session_id=chat_id_int,
                user_id=user.id,
                user_message=question,
                ai_response=response_text,
                timestamp=datetime.now(timezone.utc),
            )
            db.add(msg)

            session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if session:
                session.updated_at = datetime.now(timezone.utc)

            try:
                from services.gamification_system import award_points
                award_points(db, user.id, "ai_chat")
            except Exception:
                pass

            db.commit()

        _intent_result = None
        _computed_confidence = 0.72
        try:
            from services.intent_engine import CerbylIntentEngine
            _engine = CerbylIntentEngine.get()
            _intent_result = _engine.classify(question)
            _computed_confidence = _engine.estimate_response_confidence(
                result=_intent_result,
                response_text=response_text,
            )
            _engine.record_signal(
                question,
                "INSTRUCTION" if _intent_result.is_instruction() else _intent_result.label,
                weight=1.5 if _intent_result.is_instruction() else 0.7,
            )
        except Exception as _ie_err:
            logger.debug("[CHAT/simple] IntentEngine skipped: %s", _ie_err)

        return {
            "answer":        response_text,
            "ai_confidence": _computed_confidence,
            "intent_class":  _intent_result.label if _intent_result else "LEARN_CONCEPT",
            "active_rules":  [{"domain": r.domain, "negated": r.negated}
                              for r in (_intent_result.active_rules if _intent_result else [])],
            "topics_discussed": [],
            "query_type":    "conversational_learning",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /api/ask_simple/: {e}", exc_info=True)
        return {
            "answer": "I encountered an error processing your request.",
            "ai_confidence": 0.3,
            "topics_discussed": ["error"],
            "query_type": "error",
        }

@router.post("/ask_with_files/")
async def ask_with_files(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    use_hs_context: bool = Form(True),
    context_doc_ids: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        selected_doc_ids = [x.strip() for x in (context_doc_ids or "").split(",") if x.strip()][:200]
        context_only_mode = bool(selected_doc_ids)
        _assert_user_matches_request(user_id, current_user)
        user = current_user

        chat_id_int = int(chat_id) if chat_id else None
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")

        image_payloads: list[dict] = []
        text_extracts: list[str] = []
        saved_metadata: list[dict] = []

        for upload in files[:_MAX_IMAGES_PER_MESSAGE]:
            raw = await upload.read()
            if not raw:
                continue

            mime = (upload.content_type or "").lower()
            fname = upload.filename or "upload"

            if mime in _SUPPORTED_IMAGE_TYPES:
                if len(raw) > _MAX_IMAGE_BYTES:
                    continue
                safe_name = _safe_filename(user.id, fname)
                dest = CHAT_UPLOAD_DIR / safe_name
                dest.write_bytes(raw)
                image_payloads.append({"data": raw, "mime_type": mime, "filename": fname})
                saved_metadata.append({
                    "filename": fname,
                    "mime_type": mime,
                    "size": len(raw),
                    "storage_path": str(dest),
                    "is_image": True,
                })

            elif mime == "application/pdf" or fname.lower().endswith(".pdf"):
                extracted = _extract_pdf_text(raw)
                if extracted:
                    text_extracts.append(f"[PDF: {fname}]\n{extracted[:6000]}")
                safe_name = _safe_filename(user.id, fname)
                dest = CHAT_UPLOAD_DIR / safe_name
                dest.write_bytes(raw)
                saved_metadata.append({
                    "filename": fname,
                    "mime_type": "application/pdf",
                    "size": len(raw),
                    "storage_path": str(dest),
                    "is_image": False,
                })

        enriched_question = question.strip() or "Please analyze the attached content."
        if text_extracts:
            enriched_question += "\n\n" + "\n\n".join(text_extracts)
        if image_payloads:
            img_count = len(image_payloads)
            enriched_question = (
                f"{enriched_question}\n\n"
                f"[{img_count} image{'s' if img_count > 1 else ''} attached — analyse and respond]"
            )

        chat_history = []
        if chat_id_int:
            recent = (
                db.query(models.ChatMessage)
                .filter(models.ChatMessage.chat_session_id == chat_id_int)
                .order_by(models.ChatMessage.timestamp.desc())
                .limit(20)
                .all()
            )
            chat_history = [
                {"user": m.user_message, "ai": m.ai_response}
                for m in reversed(recent)
            ]

        response_text = ""
        ai_provider = "AI"
        vision_unavailable = False

        from deps import unified_ai as _unified_ai
        from services.ai_utils import NoVisionProviderError
        ai_client = _unified_ai

        if ai_client and image_payloads and not context_only_mode:
            try:
                response_text = ai_client.generate_with_images(
                    prompt=enriched_question,
                    images=image_payloads,
                    max_tokens=2000,
                    temperature=0.7,
                )
                ai_provider = "vision"
            except NoVisionProviderError:
                vision_unavailable = True
                logger.warning("No vision provider configured — answering text only")
            except Exception as e:
                logger.warning(f"Vision call failed ({e}) — answering text only")

        if not response_text:
            tutor_input = question.strip() or "What can you help me with?"
            if text_extracts and not context_only_mode:
                tutor_input += "\n\n" + "\n\n".join(text_extracts)
            try:
                from tutor.graph import get_tutor
                tutor = get_tutor()
                if tutor:
                    result = await tutor.invoke(
                        user_id=str(user.id),
                        user_input=tutor_input,
                        chat_id=chat_id_int,
                        chat_history=chat_history,
                        use_hs_context=bool(use_hs_context),
                        context_doc_ids=selected_doc_ids,
                        context_only=bool(selected_doc_ids),
                    )
                    response_text = result.get("response", "")
                else:
                    response_text = _context_only_fallback_answer(str(user.id), tutor_input, selected_doc_ids)
            except Exception as e:
                logger.error(f"Tutor graph failed in ask_with_files: {e}")
                response_text = _context_only_fallback_answer(str(user.id), tutor_input, selected_doc_ids)

            if vision_unavailable and image_payloads:
                response_text += (
                    "\n\n> **Note:** Image analysis isn't available with the current AI provider "
                    "(Gemini API key required). Your text question was answered above."
                )

        try:
            from services.math_processor import process_math_in_response
            response_text = process_math_in_response(response_text)
        except Exception:
            pass

        if chat_id_int:
            msg = models.ChatMessage(
                chat_session_id=chat_id_int,
                user_id=user.id,
                user_message=question or "[image upload]",
                ai_response=response_text,
                timestamp=datetime.now(timezone.utc),
                image_metadata=json.dumps(saved_metadata) if saved_metadata else None,
            )
            db.add(msg)

            session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id,
            ).first()
            if session:
                session.updated_at = datetime.now(timezone.utc)

            try:
                from services.gamification_system import award_points
                award_points(db, user.id, "ai_chat")
            except Exception:
                pass

            db.commit()

        file_summaries = [
            {"file_name": m["filename"], "is_image": m["is_image"], "size": m["size"]}
            for m in saved_metadata
        ]

        _intent_result = None
        _computed_confidence = 0.72
        try:
            from services.intent_engine import CerbylIntentEngine
            _engine = CerbylIntentEngine.get()
            _intent_result = _engine.classify(question)
            _computed_confidence = _engine.estimate_response_confidence(
                result=_intent_result,
                response_text=response_text,
            )
        except Exception as _ie_err:
            logger.debug("[CHAT/files] IntentEngine skipped: %s", _ie_err)

        return {
            "answer":          response_text,
            "ai_confidence":   _computed_confidence,
            "intent_class":    _intent_result.label if _intent_result else "LEARN_CONCEPT",
            "topics_discussed": [],
            "query_type":      "multimodal",
            "files_processed": len(saved_metadata),
            "file_summaries":  file_summaries,
            "has_file_context": bool(saved_metadata),
            "ai_provider":     ai_provider,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /api/ask_with_files/: {e}", exc_info=True)
        return {
            "answer": "I encountered an error processing your files. Please try again.",
            "ai_confidence": 0.3,
            "topics_discussed": ["error"],
            "query_type": "error",
            "files_processed": 0,
        }

def _safe_filename(user_id: int, original: str) -> str:
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    clean = re.sub(r"[^\w.\-]", "_", original)
    return f"{user_id}_{ts}_{clean}"

def _extract_pdf_text(raw: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(raw))
        pages = []
        for page in reader.pages[:20]:
            t = page.extract_text()
            if t:
                pages.append(t.strip())
        return "\n\n".join(pages)
    except Exception:
        pass
    try:
        import fitz
        doc = fitz.open(stream=raw, filetype="pdf")
        pages = [doc[i].get_text() for i in range(min(20, doc.page_count))]
        return "\n\n".join(p.strip() for p in pages if p.strip())
    except Exception:
        return ""

@router.post("/test_ai_simple")
async def test_ai_simple(
    question: str = Form(...),
    current_user: models.User = Depends(get_current_user),
):
    try:
        response = call_ai(f"Answer this question in one sentence: {question}", max_tokens=200)
        return {"answer": response, "status": "success"}
    except Exception:
        return {"answer": "Error generating response", "status": "error"}

@router.post("/create_chat_session")
def create_chat_session(
    session_data: ChatSessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat_session = models.ChatSession(user_id=current_user.id, title=session_data.title)
    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)

    return {
        "id": chat_session.id,
        "session_id": chat_session.id,
        "title": chat_session.title,
        "created_at": chat_session.created_at.isoformat() + "Z",
        "updated_at": chat_session.updated_at.isoformat() + "Z",
        "status": "success",
    }

@router.put("/rename_chat_session")
def rename_chat_session(
    data: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    chat_id = data.get("chat_id")
    new_title = data.get("new_title")
    if not chat_id or not new_title:
        raise HTTPException(status_code=400, detail="chat_id and new_title are required")

    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    chat_session.title = new_title
    chat_session.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "chat_id": chat_id, "new_title": new_title}

@router.get("/get_chat_sessions")
def get_chat_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )

    return {
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "folder_id": s.folder_id,
                "created_at": s.created_at.isoformat() + "Z" if s.created_at else None,
                "updated_at": s.updated_at.isoformat() + "Z" if s.updated_at else None,
            }
            for s in sessions
        ]
    }

@router.get("/get_chat_messages")
def get_chat_messages(
    chat_id: int = Query(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == chat_id)
        .order_by(models.ChatMessage.timestamp.asc())
        .all()
    )

    result = []
    for msg in messages:
        result.append({
            "id": f"user_{msg.id}",
            "type": "user",
            "content": msg.user_message,
            "timestamp": msg.timestamp.isoformat() + "Z",
        })
        result.append({
            "id": f"ai_{msg.id}",
            "type": "ai",
            "content": msg.ai_response,
            "timestamp": msg.timestamp.isoformat() + "Z",
            "aiConfidence": 0.85,
        })
    return result

@router.get("/get_chat_history/{session_id}")
async def get_chat_history(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        session_id_int = int(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id_int,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == session_id_int)
        .order_by(models.ChatMessage.timestamp.asc())
        .all()
    )

    return {
        "session_id": session_id,
        "messages": [
            {
                "user_message": msg.user_message,
                "ai_response": msg.ai_response,
                "timestamp": msg.timestamp.isoformat() + "Z",
            }
            for msg in messages
        ],
    }

@router.post("/save_chat_message")
def save_chat_message(
    message_data: ChatMessageSave,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == message_data.chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    existing = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == message_data.chat_id,
        models.ChatMessage.user_message == message_data.user_message,
        models.ChatMessage.ai_response == message_data.ai_response,
    ).first()

    if existing:
        return {"status": "success", "message": "Message already exists"}

    chat_message = models.ChatMessage(
        chat_session_id=message_data.chat_id,
        user_id=current_user.id,
        user_message=message_data.user_message,
        ai_response=message_data.ai_response,
        is_user=True,
    )
    db.add(chat_message)

    chat_session.updated_at = datetime.now(timezone.utc)

    message_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == message_data.chat_id
    ).count()

    if chat_session.title == "New Chat" and message_count == 0:
        words = message_data.user_message.strip().split()
        new_title = " ".join(words[:4]) + ("..." if len(words) > 4 else "")
        chat_session.title = new_title[:50] if new_title else "New Chat"

    try:
        from services.gamification_system import award_points
        award_points(db, chat_session.user_id, "ai_chat")
    except Exception:
        pass

    try:
        from activity_logger import log_activity
        log_activity(
            user_id=chat_session.user_id,
            tool_name="ai_chat",
            action="send_message",
            tokens_used=0,
            metadata={"chat_id": message_data.chat_id},
        )
    except Exception:
        pass

    db.commit()
    return {"status": "success", "message": "Message saved successfully"}

@router.delete("/delete_chat_session/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id
    ).delete()
    db.delete(chat_session)
    db.commit()

    return {"status": "success"}

@router.post("/submit_response_feedback")
async def submit_response_feedback(
    user_id: str = Form(...),
    rating: int = Form(...),
    message_context: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    user = current_user

    feedback = models.UserFeedback(
        user_id=user.id,
        feedback_type="rating",
        rating=rating,
        topic_context=message_context,
        is_processed=False,
    )
    db.add(feedback)
    db.commit()

    return {"status": "success", "message": "Feedback recorded"}

@router.post("/submit_advanced_feedback")
async def submit_advanced_feedback(
    user_id: str = Form(...),
    rating: int = Form(...),
    feedback_text: str = Form(None),
    improvement_suggestion: str = Form(None),
    message_content: str = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    user = current_user

    feedback = models.UserFeedback(
        user_id=user.id,
        feedback_type="rating_with_feedback",
        rating=rating,
        feedback_text=feedback_text,
        topic_context=message_content,
        is_processed=False,
    )
    db.add(feedback)
    db.commit()

    return {"status": "success", "message": "Feedback recorded"}

@router.post("/generate_chat_title")
async def generate_chat_title(
    request: GenerateChatTitleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(request.user_id, current_user)
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == request.chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == chat_session.id)
        .order_by(models.ChatMessage.timestamp.asc())
        .limit(5)
        .all()
    )

    if not messages:
        return {"title": "New Chat", "status": "no_messages"}

    conversation = "\n".join(
        [f"Student: {m.user_message}\nTutor: {m.ai_response}" for m in messages[:3]]
    )

    prompt = (
        f"Generate a short, descriptive title (3-6 words) for this conversation:\n\n"
        f"{conversation}\n\nTitle:"
    )

    try:
        title = call_ai(prompt, max_tokens=30, temperature=0.7).strip().strip('"').strip("'")
        if len(title) > 50:
            title = title[:47] + "..."

        chat_session.title = title
        db.commit()

        return {"title": title, "status": "success"}
    except Exception as e:
        logger.error(f"Error generating title: {e}")
        return {"title": "Chat Session", "status": "error"}

@router.post("/generate_chat_summary")
async def generate_chat_summary(
    chat_id: int = Form(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == chat_session.id)
        .order_by(models.ChatMessage.timestamp.asc())
        .all()
    )

    if not messages:
        return {"summary": "No messages in this chat.", "status": "empty"}

    conversation = "\n".join(
        [f"Student: {m.user_message}\nTutor: {m.ai_response}" for m in messages[-10:]]
    )

    prompt = (
        f"Summarize this tutoring conversation in 2-3 sentences:\n\n{conversation}\n\nSummary:"
    )

    try:
        summary = call_ai(prompt, max_tokens=200, temperature=0.5)
        return {"summary": summary.strip(), "status": "success"}
    except Exception as e:
        return {"summary": f"Could not generate summary: {e}", "status": "error"}

@router.get("/check_proactive_message")
async def check_proactive_message(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
):
    return {"has_message": False, "message": None}

@router.post("/generate_welcome_message")
async def generate_welcome_message(
    user_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    user = current_user
    name = user.first_name if user else "there"
    return {
        "message": f"Hey {name}! What would you like to learn today?",
        "status": "success",
    }

@router.get("/conversation_starters")
async def get_conversation_starters(
    user_id: str = Query(None),
    db: Session = Depends(get_db),
):
    return {
        "starters": [
            "Explain a concept I'm struggling with",
            "Help me prepare for an exam",
            "Quiz me on a topic",
            "Summarize my recent notes",
        ]
    }

@router.post("/create_chat_folder")
def create_chat_folder(
    folder_data: ChatFolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(folder_data.user_id, current_user)
    user = current_user

    folder = models.ChatFolder(
        user_id=user.id,
        name=folder_data.name,
        color=folder_data.color,
        parent_id=folder_data.parent_id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "name": folder.name,
        "color": folder.color,
        "status": "success",
    }

@router.get("/get_chat_folders")
def get_chat_folders(
    user_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    user = current_user

    folders = db.query(models.ChatFolder).filter(models.ChatFolder.user_id == user.id).all()

    return {
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "color": f.color,
                "parent_id": f.parent_id,
                "created_at": f.created_at.isoformat() + "Z" if f.created_at else None,
            }
            for f in folders
        ]
    }

@router.delete("/delete_chat_folder/{folder_id}")
def delete_chat_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    folder = db.query(models.ChatFolder).filter(
        models.ChatFolder.id == folder_id,
        models.ChatFolder.user_id == current_user.id,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    db.query(models.ChatSession).filter(
        models.ChatSession.folder_id == folder_id
    ).update({"folder_id": None})
    db.delete(folder)
    db.commit()

    return {"status": "success"}

@router.put("/move_chat_to_folder")
def move_chat_to_folder(
    data: ChatUpdateFolder,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    chat = db.query(models.ChatSession).filter(
        models.ChatSession.id == data.chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")

    if data.folder_id is not None:
        folder = db.query(models.ChatFolder).filter(
            models.ChatFolder.id == data.folder_id,
            models.ChatFolder.user_id == current_user.id,
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    chat.folder_id = data.folder_id
    db.commit()

    return {"status": "success"}

@router.post("/convert_chat_to_note_content/")
async def convert_chat_to_note_content(
    chat_id: int = Form(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id,
        models.ChatSession.user_id == current_user.id,
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_session_id == chat_session.id)
        .order_by(models.ChatMessage.timestamp.asc())
        .all()
    )

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found")

    conversation = "\n\n".join(
        [f"**Q:** {m.user_message}\n\n**A:** {m.ai_response}" for m in messages]
    )

    prompt = (
        f"Convert this Q&A conversation into well-organized study notes with headers and key points:\n\n"
        f"{conversation}\n\nStudy Notes:"
    )

    try:
        notes_content = call_ai(prompt, max_tokens=2000, temperature=0.5)
        return {"content": notes_content.strip(), "status": "success"}
    except Exception as e:
        return {"content": conversation, "status": "fallback"}

@router.post("/ai_group_notes")
async def ai_group_notes(
    user_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _assert_user_matches_request(user_id, current_user)
    user = current_user

    notes = (
        db.query(models.Note)
        .filter(models.Note.user_id == user.id, models.Note.is_deleted == False)
        .all()
    )

    if not notes:
        return {"groups": [], "status": "no_notes"}

    notes_text = "\n".join([f"- {n.title}" for n in notes[:50]])

    prompt = (
        f"Group these notes into logical categories. Return JSON array of objects "
        f'with "folder_name" and "note_titles" fields:\n\n{notes_text}'
    )

    try:
        result = call_ai(prompt, max_tokens=500, temperature=0.5)
        import json
        groups = json.loads(result.strip().strip("```json").strip("```"))
        return {"groups": groups, "status": "success"}
    except Exception:
        return {"groups": [], "status": "error"}
