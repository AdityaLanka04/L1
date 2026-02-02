"""
Simple test endpoint to verify caching works
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class SimpleChatRequest(BaseModel):
    question: str

@router.post("/api/test/simple-chat")
async def simple_chat_test(request: SimpleChatRequest):
    """
    Simple chat endpoint for testing caching
    No context, no history - just pure question -> answer
    """
    from main import unified_ai
    
    # Simple prompt with no context
    prompt = f"Answer this question briefly: {request.question}"
    
    # Call AI (will use cache if same question asked before)
    response = unified_ai.generate(prompt, max_tokens=200, temperature=0.7)
    
    return {
        "question": request.question,
        "answer": response,
        "message": "Ask the same question again to test caching!"
    }

def register_test_cache_endpoint(app):
    """Register the test endpoint"""
    app.include_router(router)
