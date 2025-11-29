#!/usr/bin/env python3
"""
Test the full /ask endpoint logic without HTTP
"""
import os
import sys
sys.path.insert(0, 'backend')

from dotenv import load_dotenv
load_dotenv('backend/.env')

# Setup
from groq import Groq
from ai_utils import UnifiedAIClient
from database import SessionLocal
import models
import advanced_prompting
from neural_adaptation import get_rl_agent, ConversationContextAnalyzer
import asyncio
from datetime import datetime, timezone
import json

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

unified_ai = UnifiedAIClient(
    gemini_client=None,
    groq_client=groq_client,
    gemini_model="gemini-2.0-flash",
    groq_model="llama-3.3-70b-versatile",
    gemini_api_key=None
)

def call_ai(prompt: str, max_tokens: int = 2000, temperature: float = 0.7) -> str:
    return unified_ai.generate(prompt, max_tokens, temperature)

async def test_ask_endpoint():
    print("="*80)
    print("Testing Full /ask Endpoint Logic")
    print("="*80)
    
    db = SessionLocal()
    
    # Get a real user
    user = db.query(models.User).filter(models.User.email == "stupendous0512@gmail.com").first()
    if not user:
        print("❌ User not found")
        db.close()
        return
    
    print(f"\n✅ User: {user.email}")
    
    # Get or create a chat session
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user.id
    ).first()
    
    if not chat_session:
        chat_session = models.ChatSession(
            user_id=user.id,
            title="Test Chat",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
    
    print(f"✅ Chat session: {chat_session.id}")
    
    # Build user profile
    user_profile = {
        "user_id": user.id,
        "first_name": user.first_name or "Student",
        "last_name": user.last_name or "",
        "field_of_study": user.field_of_study or "General Studies",
        "learning_style": user.learning_style or "Mixed",
        "difficulty_level": "intermediate",
        "learning_pace": "moderate",
        "primary_archetype": "",
        "secondary_archetype": "",
        "brainwave_goal": "",
        "preferred_subjects": []
    }
    
    # Get conversation history
    conversation_history = []
    recent_messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == chat_session.id
    ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()
    
    for msg in reversed(recent_messages):
        conversation_history.append({
            'user_message': msg.user_message,
            'ai_response': msg.ai_response,
            'timestamp': msg.timestamp
        })
    
    print(f"✅ Conversation history: {len(conversation_history)} messages")
    
    # Get learning context
    learning_context = advanced_prompting.get_user_learning_context(db, user.id)
    print(f"✅ Learning context loaded")
    
    # Get relevant past chats
    question = "What is Python?"
    topic_keywords = " ".join(advanced_prompting.extract_topic_keywords(question))
    relevant_past_chats = advanced_prompting.get_relevant_past_conversations(
        db, user.id, topic_keywords, limit=3
    )
    print(f"✅ Relevant past chats: {len(relevant_past_chats)}")
    
    # Generate response
    print(f"\n📤 Asking: {question}")
    print("⏳ Generating response...")
    
    try:
        response = await advanced_prompting.generate_enhanced_ai_response(
            question,
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats,
            db,
            call_ai,
            "llama-3.3-70b-versatile"
        )
        
        print(f"\n✅ Response generated ({len(response)} chars)")
        print(f"📥 Response preview: {response[:200]}...")
        
        # Save to database
        chat_message = models.ChatMessage(
            chat_session_id=chat_session.id,
            user_id=user.id,
            user_message=question,
            ai_response=response,
            is_user=True,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(chat_message)
        db.commit()
        print(f"✅ Message saved to database")
        
        print("\n" + "="*80)
        print("✅ FULL TEST PASSED - AI CHAT WORKS!")
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_ask_endpoint())
