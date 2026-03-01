import time
import logging
import os
import re
from fastapi import Request
from jose import jwt, JWTError
from activity_logger import log_activity, resolve_user_id
from activity_context import set_activity_context, clear_activity_context
from deps import SECRET_KEY, ALGORITHM

logger = logging.getLogger(__name__)

ENDPOINT_TOOL_MAP = {
    '/api/chat': 'ai_chat',
    '/api/save_chat_message': 'ai_chat',
    '/api/send_message': 'ai_chat',
    '/api/rename_chat': 'ai_chat',
    '/api/flashcards': 'flashcards',
    '/api/generate_flashcards': 'flashcards_ai',
    '/api/convert_to_flashcards': 'flashcards_ai',
    '/api/notes': 'notes',
    '/api/save_note': 'notes',
    '/api/generate_notes': 'notes_ai',
    '/api/convert_to_notes': 'notes_ai',
    '/api/quiz': 'quiz',
    '/api/generate_quiz': 'quiz_ai',
    '/api/question_bank': 'question_bank',
    '/api/generate_questions': 'question_bank_ai',
    '/api/slide_explorer': 'slide_explorer',
    '/api/analyze_slides': 'slide_explorer_ai',
    '/api/media_notes': 'media_notes',
    '/api/process_media': 'media_notes_ai',
    '/api/upload_media': 'media_notes',
    '/api/learning_paths': 'learning_paths',
    '/api/generate_learning_path': 'learning_path_ai',
    '/api/weakness': 'weakness_analysis',
    '/api/analyze_weakness': 'weakness_ai',
    '/api/study_insights': 'study_insights',
    '/api/get_comprehensive_profile': 'profile',
    '/api/update_profile': 'profile',
}


def get_tool_name(path: str) -> str:
    for endpoint, tool in ENDPOINT_TOOL_MAP.items():
        if endpoint in path:
            return tool
    cleaned = path.replace('/api/', '').strip('/')
    if not cleaned:
        return 'other'
    segment = cleaned.split('/')[0]
    ai_hints = ('generate', 'analyze', 'analysis', 'summarize', 'summary', 'recommend', 'suggest', 'ai')
    if any(hint in path for hint in ai_hints):
        if segment.endswith('_ai'):
            return segment
        return f"{segment}_ai"
    return segment


def get_action(method: str, path: str) -> str:
    if method == 'POST':
        return 'create'
    if method in ('PUT', 'PATCH'):
        return 'update'
    if method == 'DELETE':
        return 'delete'
    if method == 'GET':
        return 'view'
    return 'action'


def is_ai_tool(tool_name: str) -> bool:
    if not tool_name:
        return False
    return tool_name.startswith('ai_') or tool_name.endswith('_ai') or 'ai' in tool_name


async def log_request_activity(request: Request, call_next):
    start_time = time.time()

    user_id = request.headers.get('X-User-Id')

    if not user_id or user_id == 'null':
        query_params = dict(request.query_params)
        user_id = query_params.get('user_id') or query_params.get('username')

    if not user_id or user_id == 'null':
        if 'user_id=' in str(request.url):
            match = re.search(r'user_id=([^&]+)', str(request.url))
            if match:
                user_id = match.group(1)

    if not user_id or user_id == 'null':
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = payload.get("sub")
            except JWTError:
                user_id = None

    context_token = None
    resolved_user_id = None
    if user_id and user_id != 'null' and user_id.strip() and request.url.path.startswith('/api/') and not request.url.path.startswith('/api/admin/'):
        resolved_user_id = resolve_user_id(user_id)
        if resolved_user_id:
            tool_name = get_tool_name(request.url.path)
            action = get_action(request.method, request.url.path)
            context_token = set_activity_context({
                'user_id': resolved_user_id,
                'tool_name': tool_name,
                'action': action,
                'endpoint': request.url.path,
                'method': request.method
            })

    try:
        response = await call_next(request)
    finally:
        if context_token is not None:
            clear_activity_context(context_token)

    duration = time.time() - start_time

    if user_id and user_id != 'null' and user_id.strip() and request.url.path.startswith('/api/') and not request.url.path.startswith('/api/admin/'):
        tool_name = get_tool_name(request.url.path)
        action = get_action(request.method, request.url.path)

        metadata = {
            'endpoint': request.url.path,
            'method': request.method,
            'duration_seconds': round(duration, 2),
            'status_code': response.status_code,
            'is_ai_endpoint': is_ai_tool(tool_name),
            'event_type': 'request'
        }

        if is_ai_tool(tool_name):
            metadata['token_source'] = 'none'

        try:
            log_activity(
                user_id=resolved_user_id or user_id,
                tool_name=tool_name,
                action=action,
                tokens_used=0,
                metadata=metadata
            )
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")

    return response
