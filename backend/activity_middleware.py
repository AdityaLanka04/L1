"""
Activity Logging Middleware - Automatically track all API requests
"""
from fastapi import Request
from datetime import datetime
import time
from activity_logger import log_activity
import json
import os

# Map endpoints to tool names
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
    """Extract tool name from endpoint path"""
    for endpoint, tool in ENDPOINT_TOOL_MAP.items():
        if endpoint in path:
            return tool
    return 'other'

def get_action(method: str, path: str) -> str:
    """Determine action from method and path"""
    if 'generate' in path or 'analyze' in path or 'process' in path:
        return 'ai_generate'
    elif method == 'POST':
        return 'create'
    elif method == 'PUT' or method == 'PATCH':
        return 'update'
    elif method == 'DELETE':
        return 'delete'
    elif method == 'GET':
        return 'view'
    return 'action'

async def log_request_activity(request: Request, call_next):
    """Middleware to log all API requests"""
    start_time = time.time()
    
    # Get user_id from multiple sources
    user_id = request.headers.get('X-User-Id')
    
    # If not in headers, try to get from query params
    if not user_id or user_id == 'null':
        query_params = dict(request.query_params)
        user_id = query_params.get('user_id') or query_params.get('username')
    
    # If still not found, try to get from path params (for routes like /api/user/{user_id})
    if not user_id or user_id == 'null':
        path = request.url.path
        if 'user_id=' in str(request.url):
            import re
            match = re.search(r'user_id=([^&]+)', str(request.url))
            if match:
                user_id = match.group(1)
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Only log if user is authenticated and it's an API call
    # Skip if user_id is None, 'null', or empty
    if user_id and user_id != 'null' and user_id.strip() and request.url.path.startswith('/api/') and not request.url.path.startswith('/api/admin/'):
        tool_name = get_tool_name(request.url.path)
        action = get_action(request.method, request.url.path)
        
        # Estimate tokens (rough estimate based on response time for AI calls)
        tokens_used = 0
        if 'ai' in tool_name or 'generate' in request.url.path:
            # Rough estimate: 1 second = ~100 tokens
            tokens_used = int(duration * 100)
        
        metadata = {
            'endpoint': request.url.path,
            'method': request.method,
            'duration_seconds': round(duration, 2),
            'status_code': response.status_code
        }
        
        try:
            # Convert email to user_id by looking up in database
            import sqlite3
            db_path = os.path.join(os.path.dirname(__file__), 'brainwave_tutor.db')
            
            try:
                user_id_value = int(user_id)
            except ValueError:
                # It's an email, look up the user_id
                try:
                    conn = sqlite3.connect(db_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT id FROM users WHERE email = ? OR username = ?", (user_id, user_id))
                    result = cursor.fetchone()
                    conn.close()
                    if result:
                        user_id_value = result[0]
                    else:
                        # User not found, skip logging
                        return response
                except Exception as db_error:
                    print(f"Failed to lookup user_id: {db_error}")
                    return response
                
            log_activity(
                user_id=user_id_value,
                tool_name=tool_name,
                action=action,
                tokens_used=tokens_used,
                metadata=metadata
            )
        except Exception as e:
            print(f"Failed to log activity: {e}")
    
    return response
