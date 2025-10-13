import os
import sys
import re
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import asyncio

from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request, File, UploadFile, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
from dotenv import load_dotenv
from groq import Groq

import models
from database import SessionLocal, engine

from advanced_prompting import get_archetype_adapted_prompt  # ✅ ONLY IMPORT THIS

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Brainwave Backend API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"

groq_client = Groq(api_key=GROQ_API_KEY)

logger.info(f"🔑 GROQ_API_KEY loaded: {GROQ_API_KEY[:10]}..." if GROQ_API_KEY else "❌ NO API KEY")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str
    password: str
    age: Optional[int] = None
    field_of_study: Optional[str] = None
    learning_style: Optional[str] = None
    school_university: Optional[str] = None

class GoogleAuth(BaseModel):
    token: str

class ChatSessionCreate(BaseModel):
    user_id: str
    title: str = "New Chat"

class ChatMessageSave(BaseModel):
    chat_id: int
    user_message: str
    ai_response: str

class NoteCreate(BaseModel):
    user_id: str
    title: str = "New Note"
    content: str = ""

class NoteUpdate(BaseModel):
    note_id: int
    title: str
    content: str

class FlashcardSetCreate(BaseModel):
    user_id: str
    title: str = "New Flashcard Set"
    description: str = ""
    source_type: str = "manual"
    source_id: Optional[int] = None

class FlashcardCreate(BaseModel):
    set_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardSetUpdate(BaseModel):
    set_id: int
    title: str
    description: str

class FlashcardUpdate(BaseModel):
    flashcard_id: int
    question: str
    answer: str
    difficulty: Optional[str] = "medium"
    category: Optional[str] = "general"

class FlashcardStudySession(BaseModel):
    set_id: int
    user_id: str
    cards_studied: int
    correct_answers: int
    session_duration: int

class UserProfileUpdate(BaseModel):
    user_id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    fieldOfStudy: Optional[str] = None
    learningStyle: Optional[str] = None
    schoolUniversity: Optional[str] = None
    preferredSubjects: Optional[List[str]] = []
    difficultyLevel: Optional[str] = "intermediate"
    studySchedule: Optional[str] = "flexible"
    learningPace: Optional[str] = "moderate"
    motivationFactors: Optional[List[str]] = []
    weakAreas: Optional[List[str]] = []
    strongAreas: Optional[List[str]] = []
    careerGoals: Optional[str] = None
    studyGoals: Optional[str] = None
    timeZone: Optional[str] = None
    studyEnvironment: Optional[str] = "quiet"
    preferredLanguage: Optional[str] = "english"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_username(db, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        user = get_user_by_email(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def verify_google_token(token: str):
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')
        return idinfo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
def calculate_day_streak(db: Session, user_id: int) -> int:
    today = datetime.now(timezone.utc).date()
    
    recent_days = db.query(models.DailyLearningMetrics.date).filter(
        models.DailyLearningMetrics.user_id == user_id,
        models.DailyLearningMetrics.questions_answered > 0
    ).order_by(models.DailyLearningMetrics.date.desc()).all()
    
    if not recent_days:
        return 0
    
    recent_dates = [day[0] for day in recent_days]
    
    if today not in recent_dates and (today - timedelta(days=1)) not in recent_dates:
        return 0
    
    streak = 0
    check_date = today if today in recent_dates else today - timedelta(days=1)
    
    while check_date in recent_dates:
        streak += 1
        check_date -= timedelta(days=1)
    
    return streak

def get_current_user(db: Session = Depends(get_db), token: str = Depends(verify_token)):
    user = get_user_by_username(db, token)
    if not user:
        user = get_user_by_email(db, token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def build_user_profile_dict(user, comprehensive_profile=None) -> Dict[str, Any]:
    profile = {
        "user_id": getattr(user, "id", "unknown"),
        "first_name": getattr(user, "first_name", "Student"),
        "last_name": getattr(user, "last_name", ""),
        "field_of_study": getattr(user, "field_of_study", "General Studies"),
        "learning_style": getattr(user, "learning_style", "Mixed"),
        "school_university": getattr(user, "school_university", "Student"),
        "age": getattr(user, "age", None)
    }
    
    if comprehensive_profile:
        profile.update({
            "difficulty_level": getattr(comprehensive_profile, "difficulty_level", "intermediate"),
            "learning_pace": getattr(comprehensive_profile, "learning_pace", "moderate"),
            "study_environment": getattr(comprehensive_profile, "study_environment", "quiet"),
            "preferred_language": getattr(comprehensive_profile, "preferred_language", "english"),
            "study_goals": getattr(comprehensive_profile, "study_goals", None),
            "career_goals": getattr(comprehensive_profile, "career_goals", None),
            "primary_archetype": getattr(comprehensive_profile, "primary_archetype", ""),
            "secondary_archetype": getattr(comprehensive_profile, "secondary_archetype", ""),
            "archetype_description": getattr(comprehensive_profile, "archetype_description", "")
        })
    
    return profile

async def generate_ai_response(prompt: str, user_profile: Dict[str, Any]) -> str:
    try:
        system_prompt = f"""You are an expert AI tutor helping {user_profile.get('first_name', 'a student')} who is studying {user_profile.get('field_of_study', 'various subjects')}.
Learning Style: {user_profile.get('learning_style', 'Mixed')}
Level: {user_profile.get('difficulty_level', 'intermediate')}
Pace: {user_profile.get('learning_pace', 'moderate')}

Provide clear, educational responses tailored to the student's profile."""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048,
            top_p=0.9,
        )
        
        return chat_completion.choices[0].message.content
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return f"I apologize, but I encountered an error processing your request. Please try again."

@app.get("/")
async def root():
    return {
        "message": "Brainwave Backend API v3.0.0",
        "status": "running",
        "ai_provider": "Groq",
        "api_version": "3.0.0"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Brainwave API is running",
        "ai_provider": "Groq",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/get_daily_goal_progress")
def get_daily_goal_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.now(timezone.utc).date()
        
        questions_today = db.query(models.Activity).filter(
            models.Activity.user_id == user.id,
            func.date(models.Activity.timestamp) == today
        ).count()
        
        daily_goal = 20
        
        activities = db.query(func.date(models.Activity.timestamp)).filter(
            models.Activity.user_id == user.id
        ).distinct().order_by(func.date(models.Activity.timestamp).desc()).all()
        
        streak = 0
        if activities:
            check_date = datetime.now(timezone.utc).date()
            for activity_date in [a[0] for a in activities]:
                if activity_date == check_date or activity_date == check_date - timedelta(days=1):
                    streak += 1
                    check_date = activity_date - timedelta(days=1)
                else:
                    break
        
        return {
            "questions_today": questions_today,
            "daily_goal": daily_goal,
            "percentage": min(int((questions_today / daily_goal) * 100), 100),
            "streak": streak
        }
    except Exception as e:
        logger.error(f"Error getting daily goal: {str(e)}")
        return {"questions_today": 0, "daily_goal": 20, "percentage": 0, "streak": 0}


@app.post("/register")
async def register(
    first_name: str = Form(...),
    last_name: str = Form(...),
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    age: int = Form(None),
    field_of_study: str = Form(None),
    learning_style: str = Form(None),
    school_university: str = Form(None),
    db: Session = Depends(get_db)
):
    logger.info(f"Registering user: {username}")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    if get_user_by_username(db, username):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(password)
    db_user = models.User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        username=username,
        hashed_password=hashed_password,
        age=age,
        field_of_study=field_of_study,
        learning_style=learning_style,
        school_university=school_university,
        google_user=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    user_stats = models.UserStats(user_id=db_user.id)
    db.add(user_stats)
    db.commit()
    
    logger.info(f"User {username} registered successfully")
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/token_form")
async def login_form(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/google-auth")
def google_auth(auth_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.token}"
            response = requests.get(url)
            user_info = response.json() if response.status_code == 200 else verify_google_token(auth_data.token)
        except:
            user_info = verify_google_token(auth_data.token)
        
        email = user_info.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email not found")
        
        user = get_user_by_email(db, email)
        
        if not user:
            user = models.User(
                first_name=user_info.get('given_name', ''),
                last_name=user_info.get('family_name', ''),
                email=email,
                username=email,
                hashed_password=get_password_hash("google_oauth"),
                picture_url=user_info.get('picture', ''),
                google_user=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
            db.commit()
        
        access_token = create_access_token(data={"sub": user.username})
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_info": {
                "email": email,
                "given_name": user_info.get('given_name'),
                "family_name": user_info.get('family_name'),
                "picture": user_info.get('picture'),
                "google_user": True
            }
        }
    except Exception as e:
        logger.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/me")
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "username": current_user.username,
        "age": current_user.age,
        "field_of_study": current_user.field_of_study,
        "learning_style": current_user.learning_style,
        "school_university": current_user.school_university,
        "picture_url": current_user.picture_url,
        "google_user": current_user.google_user
    }

#!/usr/bin/env python3
# Enhanced AI Chat System with Conversation Memory and Context Awareness

import json
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import asyncio
from sqlalchemy import and_, desc, func
from groq import Groq

# Enhanced helper functions for conversation context

def get_relevant_past_conversations(db, user_id: int, current_topic: str, limit: int = 5) -> List[Dict]:
    """
    Retrieve relevant past conversations based on topic similarity
    """
    try:
        # Get recent chat sessions with their messages
        recent_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user_id
        ).order_by(models.ChatSession.updated_at.desc()).limit(20).all()
        
        relevant_conversations = []
        
        for session in recent_sessions:
            # Get first few messages to understand the topic
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == session.id
            ).order_by(models.ChatMessage.timestamp.asc()).limit(3).all()
            
            if messages:
                # Combine messages to check relevance
                session_content = " ".join([
                    f"{m.user_message} {m.ai_response}" for m in messages
                ])
                
                # Simple topic matching (can be enhanced with embeddings)
                topic_keywords = current_topic.lower().split()
                relevance_score = sum(
                    1 for keyword in topic_keywords 
                    if len(keyword) > 3 and keyword in session_content.lower()
                )
                
                if relevance_score > 0:
                    relevant_conversations.append({
                        'session_id': session.id,
                        'title': session.title,
                        'relevance_score': relevance_score,
                        'last_updated': session.updated_at,
                        'preview': session_content[:200]
                    })
        
        # Sort by relevance and recency
        relevant_conversations.sort(
            key=lambda x: (x['relevance_score'], x['last_updated']), 
            reverse=True
        )
        
        return relevant_conversations[:limit]
        
    except Exception as e:
        logger.error(f"Error getting relevant conversations: {str(e)}")
        return []


def get_user_learning_context(db, user_id: int) -> Dict[str, Any]:
    """
    Build comprehensive learning context about the user
    """
    try:
        # Get user's recent topics
        recent_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(20).all()
        
        topics_studied = {}
        for activity in recent_activities:
            topic = activity.topic or "General"
            topics_studied[topic] = topics_studied.get(topic, 0) + 1
        
        # Get learning patterns
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id
        ).order_by(models.DailyLearningMetrics.date.desc()).limit(7).all()
        
        avg_questions_per_day = (
            sum(m.questions_answered for m in daily_metrics) / len(daily_metrics)
            if daily_metrics else 0
        )
        
        avg_accuracy = (
            sum(m.correct_answers / max(m.questions_answered, 1) for m in daily_metrics) 
            / len(daily_metrics) * 100
            if daily_metrics else 0
        )
        
        # Get user's weak and strong areas from profile
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        weak_areas = []
        strong_areas = []
        
        if comprehensive_profile:
            try:
                weak_areas = json.loads(comprehensive_profile.weak_areas or "[]")
                strong_areas = json.loads(comprehensive_profile.strong_areas or "[]")
            except:
                pass
        
        return {
            'topics_studied': topics_studied,
            'most_frequent_topics': sorted(topics_studied.items(), key=lambda x: x[1], reverse=True)[:3],
            'avg_questions_per_day': round(avg_questions_per_day, 1),
            'avg_accuracy': round(avg_accuracy, 1),
            'weak_areas': weak_areas,
            'strong_areas': strong_areas,
            'total_learning_days': len(daily_metrics)
        }
        
    except Exception as e:
        logger.error(f"Error building learning context: {str(e)}")
        return {}


def build_enhanced_system_prompt(user_profile: Dict, learning_context: Dict, 
                                 relevant_past_chats: List[Dict]) -> str:
    """
    Create a comprehensive system prompt with full context
    """
    
    # Base information
    prompt_parts = [
        f"You are an expert AI tutor helping {user_profile.get('first_name', 'a student')}.",
        f"\n=== STUDENT PROFILE ===",
        f"Name: {user_profile.get('first_name', 'Student')} {user_profile.get('last_name', '')}",
        f"Field of Study: {user_profile.get('field_of_study', 'Various subjects')}",
        f"Learning Style: {user_profile.get('learning_style', 'Mixed')}",
        f"Difficulty Level: {user_profile.get('difficulty_level', 'intermediate')}",
        f"Learning Pace: {user_profile.get('learning_pace', 'moderate')}",
        f"Study Environment: {user_profile.get('study_environment', 'quiet')}",
    ]
    
    # Add goals if available
    if user_profile.get('study_goals'):
        prompt_parts.append(f"Study Goals: {user_profile['study_goals']}")
    if user_profile.get('career_goals'):
        prompt_parts.append(f"Career Goals: {user_profile['career_goals']}")
    
    # Learning context
    if learning_context:
        prompt_parts.append(f"\n=== LEARNING HISTORY ===")
        
        if learning_context.get('most_frequent_topics'):
            topics = ", ".join([t[0] for t in learning_context['most_frequent_topics']])
            prompt_parts.append(f"Recently Studied Topics: {topics}")
        
        if learning_context.get('avg_accuracy', 0) > 0:
            prompt_parts.append(f"Average Accuracy: {learning_context['avg_accuracy']}%")
        
        if learning_context.get('weak_areas'):
            weak = ", ".join(learning_context['weak_areas'][:3])
            prompt_parts.append(f"Areas Needing Support: {weak}")
        
        if learning_context.get('strong_areas'):
            strong = ", ".join(learning_context['strong_areas'][:3])
            prompt_parts.append(f"Strong Areas: {strong}")
    
    # Relevant past conversations
    if relevant_past_chats:
        prompt_parts.append(f"\n=== RELEVANT PAST CONVERSATIONS ===")
        prompt_parts.append("You have discussed related topics before:")
        
        for i, chat in enumerate(relevant_past_chats[:3], 1):
            prompt_parts.append(
                f"{i}. '{chat['title']}' (Session {chat['session_id']}) - "
                f"Last updated: {chat['last_updated'].strftime('%Y-%m-%d')}"
            )
            prompt_parts.append(f"   Preview: {chat['preview'][:150]}...")
    
    # Teaching instructions
    prompt_parts.extend([
        f"\n=== TEACHING APPROACH ===",
        f"1. PERSONALIZATION: Adapt your teaching to {user_profile.get('first_name', 'the student')}'s learning style and pace",
        f"2. CONTEXT AWARENESS: Reference previous conversations when relevant, but don't force connections",
        f"3. DEPTH: Provide detailed, comprehensive explanations with examples and analogies",
        f"4. ENGAGEMENT: Ask thought-provoking questions to encourage critical thinking",
        f"5. SCAFFOLDING: Build on previous knowledge and connect new concepts to what they already know",
        f"6. CLARITY: Break down complex topics into digestible parts",
        f"7. PRACTICE: Suggest exercises or practice problems when appropriate",
        f"8. ENCOURAGEMENT: Be supportive and acknowledge progress",
        f"\n=== RESPONSE GUIDELINES ===",
        f"- For follow-up questions on previous topics, explicitly acknowledge the continuation",
        f"- For new topics, start fresh but mention if it relates to something studied before",
        f"- Use the student's learning style: {user_profile.get('learning_style', 'Mixed')}",
        f"- Adjust difficulty based on their level: {user_profile.get('difficulty_level', 'intermediate')}",
        f"- Include relevant examples from {user_profile.get('field_of_study', 'their field')}",
        f"- Structure responses with clear sections: concept explanation, examples, practice, summary",
        f"- Use formatting: headings, bullet points, numbered lists for clarity",
        f"- End with a question or suggestion for further exploration when appropriate"
    ])
    
    return "\n".join(prompt_parts)


def extract_topic_keywords(text: str) -> List[str]:
    """
    Extract meaningful keywords from a question for context matching
    """
    # Remove common words
    stop_words = {
        'what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'was', 'were',
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'can', 'could', 'should', 'would', 'will', 'do', 'does', 'did', 'me',
        'you', 'my', 'your', 'about', 'explain', 'tell', 'help', 'understand'
    }
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    keywords = [w for w in words if w not in stop_words]
    
    return keywords[:10]  # Return top 10 keywords


async def generate_enhanced_ai_response(
    prompt: str, 
    user_profile: Dict[str, Any],
    learning_context: Dict[str, Any],
    conversation_history: List[Dict],
    relevant_past_chats: List[Dict]
) -> str:
    try:
        system_prompt = build_enhanced_system_prompt(
            user_profile, 
            learning_context, 
            relevant_past_chats
        )
        
        primary_archetype = user_profile.get('primary_archetype', '')
        secondary_archetype = user_profile.get('secondary_archetype', '')
        
        if primary_archetype:
            from advanced_prompting import get_archetype_adapted_prompt
            archetype_adaptation = get_archetype_adapted_prompt(primary_archetype, secondary_archetype)
            system_prompt += f"\n\n=== ARCHETYPE-ADAPTED TEACHING STYLE ===\n{archetype_adaptation}"
        
        messages = [{"role": "system", "content": system_prompt}]
        
        for hist in conversation_history[-5:]:
            messages.append({
                "role": "user",
                "content": hist.get('user_message', '')
            })
            messages.append({
                "role": "assistant",
                "content": hist.get('ai_response', '')
            })
        
        messages.append({"role": "user", "content": prompt})
        
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=3072,
            top_p=0.9,
        )
        
        response = chat_completion.choices[0].message.content
        
        if len(response.split()) < 50:
            follow_up_messages = messages + [
                {"role": "assistant", "content": response},
                {"role": "user", "content": "Can you provide more detail and examples?"}
            ]
            
            expanded_completion = groq_client.chat.completions.create(
                messages=follow_up_messages,
                model=GROQ_MODEL,
                temperature=0.7,
                max_tokens=3072,
                top_p=0.9,
            )
            response = expanded_completion.choices[0].message.content
        
        return response
        
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return (
            f"I apologize, but I encountered an error processing your request. "
            f"However, I'm here to help you learn. Please try rephrasing your question."
        )


# ENHANCED /ask/ ENDPOINT
@app.post("/ask/")
async def ask_ai_enhanced(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    logger.info(f"Processing enhanced AI query for user {user_id}")
    
    try:
        chat_id_int = int(chat_id) if chat_id else None
        
        # Get user
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate chat session if provided
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Get comprehensive user profile
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        user_profile = build_user_profile_dict(user, comprehensive_profile)
        
        # Get learning context
        learning_context = get_user_learning_context(db, user.id)
        
        # Get current conversation history
        conversation_history = []
        if chat_id_int:
            recent_messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == chat_id_int
            ).order_by(models.ChatMessage.timestamp.desc()).limit(10).all()
            
            for msg in reversed(recent_messages):
                conversation_history.append({
                    'user_message': msg.user_message,
                    'ai_response': msg.ai_response,
                    'timestamp': msg.timestamp
                })
        
        # Extract topic keywords from the question
        topic_keywords = " ".join(extract_topic_keywords(question))
        
        # Get relevant past conversations
        relevant_past_chats = get_relevant_past_conversations(
            db, user.id, topic_keywords, limit=5
        )
        
        # Generate enhanced AI response
        response = await generate_enhanced_ai_response(
            question,
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats
        )
        
        # Save the conversation
        if chat_id_int:
            chat_message = models.ChatMessage(
                chat_session_id=chat_id_int,
                user_message=question,
                ai_response=response
            )
            db.add(chat_message)
            
            # Update chat session
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int
            ).first()
            chat_session.updated_at = datetime.now(timezone.utc)
            
            # Auto-generate title for new chats
            message_count = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == chat_id_int
            ).count()
            
            if chat_session.title == "New Chat" and message_count == 0:
                title_keywords = extract_topic_keywords(question)
                new_title = " ".join(title_keywords[:4]).title()
                chat_session.title = new_title[:50] if new_title else "New Chat"
        
        # Record activity
        activity = models.Activity(
            user_id=user.id,
            question=question,
            answer=response,
            topic=topic_keywords[:50] if topic_keywords else user.field_of_study or "General",
            question_type="conversational",
            difficulty_level=user_profile.get('difficulty_level', 'medium'),
            timestamp=datetime.now(timezone.utc)
        )
        db.add(activity)
        
        # Update daily metrics
        today = datetime.now(timezone.utc).date()
        daily_metric = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date == today
            )
        ).first()
        
        if not daily_metric:
            daily_metric = models.DailyLearningMetrics(
                user_id=user.id,
                date=today,
                sessions_completed=1,  # ✅ This creates a session
                time_spent_minutes=0,
                questions_answered=1,
                correct_answers=1,
                topics_studied=json.dumps([topic_keywords[:50]])
            )
            db.add(daily_metric)
            logger.info(f"✅ Created new daily metric for {user.email}")
        else:
            daily_metric.questions_answered += 1
            daily_metric.correct_answers += 1
            logger.info(f"✅ Updated daily metric - Questions: {daily_metric.questions_answered}")
            
            # Update topics studied
            try:
                topics = json.loads(daily_metric.topics_studied or "[]")
                if topic_keywords and topic_keywords not in topics:
                    topics.append(topic_keywords[:50])
                    daily_metric.topics_studied = json.dumps(topics[-10:])  # Keep last 10
            except:
                daily_metric.topics_studied = json.dumps([topic_keywords[:50]])
        
        db.commit()
        
        return {
            "answer": response,
            "ai_confidence": 0.92,
            "misconception_detected": False,
            "should_request_feedback": len(response.split()) > 200,  # Request feedback for detailed responses
            "topics_discussed": [topic_keywords] if topic_keywords else ["General"],
            "query_type": "conversational_learning",
            "model_used": GROQ_MODEL,
            "ai_provider": "Groq",
            "response_time": 0.5,
            "profile_enhanced": bool(comprehensive_profile),
            "questions_today": daily_metric.questions_answered,
            "context_used": {
                "conversation_history": len(conversation_history),
                "relevant_past_chats": len(relevant_past_chats),
                "learning_context_available": bool(learning_context)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in enhanced ask_ai: {str(e)}")
        return {
            "answer": (
                f"I apologize, but I encountered an error. However, I'm still here to help! "
                f"Could you please rephrase your question or let me know what specific aspect "
                f"you'd like to learn about?"
            ),
            "ai_confidence": 0.3,
            "misconception_detected": False,
            "should_request_feedback": True,
            "topics_discussed": ["error"],
            "query_type": "error",
            "model_used": "error_handler",
            "ai_provider": "Groq"
        }

@app.post("/create_chat_session")
def create_chat_session(
    session_data: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chat_session = models.ChatSession(
        user_id=current_user.id,
        title=session_data.title
    )
    db.add(chat_session)
    db.commit()
    db.refresh(chat_session)
    
    return {
        "id": chat_session.id,
        "session_id": chat_session.id,
        "title": chat_session.title,
        "created_at": chat_session.created_at.isoformat(),
        "updated_at": chat_session.updated_at.isoformat(),
        "status": "success"
    }

@app.get("/get_user_achievements")
def get_user_achievements(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user's achievements
        user_achievements = db.query(models.UserAchievement).filter(
            models.UserAchievement.user_id == user.id
        ).order_by(models.UserAchievement.earned_at.desc()).all()
        
        achievements = []
        for ua in user_achievements:
            achievement = db.query(models.Achievement).filter(
                models.Achievement.id == ua.achievement_id
            ).first()
            
            if achievement:
                achievements.append({
                    "id": achievement.id,
                    "name": achievement.name,
                    "description": achievement.description,
                    "icon": achievement.icon,
                    "points": achievement.points,
                    "category": achievement.category,
                    "rarity": achievement.rarity,
                    "earned_at": ua.earned_at.isoformat()
                })
        
        return {
            "achievements": achievements,
            "total_points": sum(a["points"] for a in achievements)
        }
        
    except Exception as e:
        logger.error(f"Error getting achievements: {str(e)}")
        return {
            "achievements": [],
            "total_points": 0
        }

@app.get("/get_chat_sessions")
def get_chat_sessions(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user.id
    ).order_by(models.ChatSession.updated_at.desc()).all()
    
    return {
        "sessions": [
            {
                "id": session.id,
                "title": session.title,
                "created_at": session.created_at.isoformat(),
                "updated_at": session.updated_at.isoformat()
            }
            for session in sessions
        ]
    }

@app.get("/get_chat_messages")
def get_chat_messages(chat_id: int = Query(...), db: Session = Depends(get_db)):
    try:
        logger.info(f"Loading messages for chat_id: {chat_id}")
        
        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == chat_id
        ).order_by(models.ChatMessage.timestamp.asc()).all()
        
        logger.info(f"Found {len(messages)} messages")
        
        result = []
        for msg in messages:
            result.append({
                "id": f"user_{msg.id}",
                "type": "user",
                "content": msg.user_message,
                "timestamp": msg.timestamp.isoformat()
            })
            result.append({
                "id": f"ai_{msg.id}",
                "type": "ai",
                "content": msg.ai_response,
                "timestamp": msg.timestamp.isoformat(),
                "aiConfidence": 0.85,
                "shouldRequestFeedback": False
            })
        
        logger.info(f"Returning {len(result)} message objects")
        return result
        
    except Exception as e:
        logger.error(f"Error in get_chat_messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_chat_history/{session_id}")
async def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    try:
        session_id_int = int(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id_int
    ).order_by(models.ChatMessage.timestamp.asc()).all()
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "user_message": msg.user_message,
                "ai_response": msg.ai_response,
                "timestamp": msg.timestamp.isoformat()
            }
            for msg in messages
        ]
    }

@app.post("/save_chat_message")
def save_chat_message(message_data: ChatMessageSave, db: Session = Depends(get_db)):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == message_data.chat_id
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    chat_message = models.ChatMessage(
        chat_session_id=message_data.chat_id,
        user_message=message_data.user_message,
        ai_response=message_data.ai_response
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
    
    db.commit()
    return {"status": "success", "message": "Message saved successfully"}

@app.delete("/delete_chat_session/{session_id}")
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id,
        models.ChatSession.user_id == current_user.id
    ).first()
    
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id
    ).delete()
    
    db.delete(chat_session)
    db.commit()
    
    return {"message": "Chat session deleted successfully"}

@app.get("/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    notes = db.query(models.Note).filter(
        models.Note.user_id == user.id
    ).order_by(models.Note.updated_at.desc()).all()
    
    return [
        {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "created_at": note.created_at.isoformat(),
            "updated_at": note.updated_at.isoformat()
        }
        for note in notes
    ]

@app.post("/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, note_data.user_id) or get_user_by_email(db, note_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_note = models.Note(
            user_id=user.id,
            title=note_data.title,
            content=note_data.content
        )
        db.add(new_note)
        db.commit()
        db.refresh(new_note)
        
        return {
            "id": new_note.id,
            "title": new_note.title,
            "content": new_note.content,
            "user_id": user.id,
            "created_at": new_note.created_at.isoformat(),
            "updated_at": new_note.updated_at.isoformat(),
            "status": "success",
            "message": "Note created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@app.put("/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.title = note_data.title
    note.content = note_data.content
    note.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(note)
    
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "updated_at": note.updated_at.isoformat()
    }

@app.delete("/delete_note/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}

@app.post("/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_profile = build_user_profile_dict(user)
        
        if import_mode == "summary":
            prompt = f"""Create study notes from this conversation. Format with headers, bullet points, and key concepts.

Conversation: {conversation_data[:3000]}

Provide a clear title and well-formatted study notes."""
        elif import_mode == "exam_prep":
            prompt = f"""Create an exam preparation guide from this conversation. Include:
1. Executive Summary
2. Key Concepts
3. Study Strategy
4. Review Checklist

Conversation: {conversation_data[:3000]}

Format as a comprehensive exam prep guide with a clear title."""
        else:
            prompt = f"""Create a formatted transcript from this conversation.

Conversation: {conversation_data[:3000]}

Provide a title and formatted content."""
        
        response = await generate_ai_response(prompt, user_profile)
        
        lines = response.split('\n')
        title = lines[0].replace('#', '').strip() if lines else "Study Notes"
        content = '\n'.join(lines[1:]) if len(lines) > 1 else response
        
        return {
            "title": title[:100],
            "content": content
        }
        
    except Exception as e:
        logger.error(f"Error generating note summary: {str(e)}")
        return {
            "title": "Study Notes",
            "content": f"# Study Notes\n\n{conversation_data[:1000]}"
        }

@app.post("/create_flashcard_set")
def create_flashcard_set(set_data: FlashcardSetCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, set_data.user_id) or get_user_by_email(db, set_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_set = models.FlashcardSet(
        user_id=user.id,
        title=set_data.title,
        description=set_data.description,
        source_type=set_data.source_type,
        source_id=set_data.source_id
    )
    db.add(flashcard_set)
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "id": flashcard_set.id,
        "title": flashcard_set.title,
        "description": flashcard_set.description,
        "source_type": flashcard_set.source_type,
        "created_at": flashcard_set.created_at.isoformat(),
        "card_count": 0,
        "status": "success"
    }

@app.post("/add_flashcard_to_set")
def add_flashcard_to_set(card_data: FlashcardCreate, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == card_data.set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcard = models.Flashcard(
        set_id=card_data.set_id,
        question=card_data.question,
        answer=card_data.answer,
        difficulty=card_data.difficulty,
        category=card_data.category
    )
    db.add(flashcard)
    db.commit()
    db.refresh(flashcard)
    
    return {
        "id": flashcard.id,
        "question": flashcard.question,
        "answer": flashcard.answer,
        "difficulty": flashcard.difficulty,
        "category": flashcard.category,
        "status": "success"
    }

@app.get("/get_flashcard_sets")
def get_flashcard_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).all()
    
    result = []
    for flashcard_set in flashcard_sets:
        card_count = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == flashcard_set.id
        ).count()
        
        result.append({
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "source_type": flashcard_set.source_type,
            "source_id": flashcard_set.source_id,
            "card_count": card_count,
            "created_at": flashcard_set.created_at.isoformat(),
            "updated_at": flashcard_set.updated_at.isoformat()
        })
    
    return {"flashcard_sets": result}

@app.get("/get_flashcards_in_set")
def get_flashcards_in_set(set_id: int = Query(...), db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcards = db.query(models.Flashcard).filter(
        models.Flashcard.set_id == set_id
    ).order_by(models.Flashcard.created_at.asc()).all()
    
    return {
        "set_id": set_id,
        "set_title": flashcard_set.title,
        "set_description": flashcard_set.description,
        "flashcards": [
            {
                "id": card.id,
                "question": card.question,
                "answer": card.answer,
                "difficulty": card.difficulty,
                "category": card.category,
                "times_reviewed": card.times_reviewed,
                "last_reviewed": card.last_reviewed.isoformat() if card.last_reviewed else None,
                "created_at": card.created_at.isoformat()
            }
            for card in flashcards
        ]
    }

@app.get("/get_flashcard_history")
def get_flashcard_history(user_id: str = Query(...), limit: int = Query(50), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).limit(limit).all()
    
    history = []
    for flashcard_set in flashcard_sets:
        card_count = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == flashcard_set.id
        ).count()
        
        recent_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).order_by(models.FlashcardStudySession.session_date.desc()).limit(3).all()
        
        total_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).count()
        
        total_study_time = db.query(models.FlashcardStudySession.session_duration).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).all()
        
        avg_study_time = sum(duration[0] for duration in total_study_time) / len(total_study_time) if total_study_time else 0
        
        all_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).all()
        
        total_cards = sum(session.cards_studied for session in all_sessions)
        total_correct = sum(session.correct_answers for session in all_sessions)
        accuracy = (total_correct / total_cards * 100) if total_cards > 0 else 0
        
        history.append({
            "id": flashcard_set.id,
            "title": flashcard_set.title,
            "description": flashcard_set.description,
            "source_type": flashcard_set.source_type,
            "source_id": flashcard_set.source_id,
            "card_count": card_count,
            "total_sessions": total_sessions,
            "avg_study_time_minutes": round(avg_study_time, 1),
            "accuracy_percentage": round(accuracy, 1),
            "created_at": flashcard_set.created_at.isoformat(),
            "updated_at": flashcard_set.updated_at.isoformat(),
            "last_studied": recent_sessions[0].session_date.isoformat() if recent_sessions else None
        })
    
    return {
        "total_sets": len(history),
        "flashcard_history": history
    }

@app.get("/get_flashcard_statistics")
def get_flashcard_statistics(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    total_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    total_cards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    total_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).count()
    
    total_time_result = db.query(models.FlashcardStudySession.session_duration).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    total_study_time = sum(duration[0] for duration in total_time_result)
    
    all_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    
    total_cards_studied = sum(session.cards_studied for session in all_sessions)
    total_correct = sum(session.correct_answers for session in all_sessions)
    overall_accuracy = (total_correct / total_cards_studied * 100) if total_cards_studied > 0 else 0
    
    return {
        "total_sets": total_sets,
        "total_cards": total_cards,
        "total_study_sessions": total_sessions,
        "total_study_time_minutes": total_study_time,
        "overall_accuracy": round(overall_accuracy, 1)
    }

@app.post("/generate_flashcards/")
async def generate_flashcards(
    user_id: str = Form(...),
    topic: str = Form(None),
    generation_type: str = Form("topic"),
    chat_data: str = Form(None),
    card_count: int = Form(10),
    difficulty_level: str = Form("medium"),
    save_to_set: bool = Form(False),
    set_title: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_profile = build_user_profile_dict(user)
        
        if generation_type == "topic" and topic:
            content_source = f"Topic: {topic}"
        elif generation_type == "chat_history" and chat_data:
            try:
                chat_messages = json.loads(chat_data)
                conversation_content = []
                for msg in chat_messages[:30]:
                    conversation_content.append(f"Q: {msg.get('user_message', '')}")
                    conversation_content.append(f"A: {msg.get('ai_response', '')}")
                content_source = "\n".join(conversation_content)
            except:
                content_source = "Invalid chat data"
        else:
            content_source = topic or "General knowledge"
        
        prompt = f"""Generate exactly {card_count} educational flashcards.

Content: {content_source[:2000]}

Create flashcards in this JSON format:
[
  {{
    "question": "Clear question here",
    "answer": "Complete answer here",
    "difficulty": "{difficulty_level}",
    "category": "general"
  }}
]

Generate exactly {card_count} flashcards now:"""

        response = await generate_ai_response(prompt, user_profile)
        
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            try:
                flashcards_data = json.loads(json_match.group())
                valid_flashcards = []
                for card in flashcards_data[:card_count]:
                    if isinstance(card, dict) and 'question' in card and 'answer' in card:
                        valid_flashcards.append({
                            'question': str(card['question']).strip(),
                            'answer': str(card['answer']).strip(),
                            'difficulty': str(card.get('difficulty', difficulty_level)).strip(),
                            'category': str(card.get('category', 'general')).strip()
                        })
                
                if len(valid_flashcards) > 0:
                    if save_to_set:
                        if not set_title:
                            set_title = f"Flashcards: {topic}" if topic else "AI Generated Flashcards"
                        
                        flashcard_set = models.FlashcardSet(
                            user_id=user.id,
                            title=set_title,
                            description=f"Generated flashcards",
                            source_type=generation_type
                        )
                        db.add(flashcard_set)
                        db.commit()
                        db.refresh(flashcard_set)
                        
                        saved_cards = []
                        for card_data in valid_flashcards:
                            flashcard = models.Flashcard(
                                set_id=flashcard_set.id,
                                question=card_data['question'],
                                answer=card_data['answer'],
                                difficulty=card_data['difficulty'],
                                category=card_data['category']
                            )
                            db.add(flashcard)
                            saved_cards.append(flashcard)
                        
                        db.commit()
                        
                        return {
                            "flashcards": valid_flashcards,
                            "saved_to_set": True,
                            "set_id": flashcard_set.id,
                            "set_title": set_title,
                            "cards_saved": len(saved_cards),
                            "status": "success"
                        }
                    else:
                        return {
                            "flashcards": valid_flashcards,
                            "saved_to_set": False,
                            "status": "success"
                        }
            except json.JSONDecodeError:
                pass
        
        return {
            "flashcards": [
                {
                    "question": f"What is a key concept in {topic or 'this topic'}?",
                    "answer": "Review the material to learn key concepts.",
                    "difficulty": difficulty_level,
                    "category": "general"
                }
            ],
            "saved_to_set": False,
            "status": "fallback"
        }
        
    except Exception as e:
        logger.error(f"Error generating flashcards: {str(e)}")
        return {
            "flashcards": [
                {
                    "question": "Error generating flashcards",
                    "answer": f"Error: {str(e)}",
                    "difficulty": "medium",
                    "category": "error"
                }
            ],
            "saved_to_set": False,
            "status": "error"
        }

@app.post("/generate_chat_summary")
async def generate_chat_summary(
    chat_data: str = Form(...),
    max_words: int = Form(4),
    format: str = Form("title"),
    db: Session = Depends(get_db)
):
    try:
        user_profile = {"first_name": "Student", "field_of_study": "General Studies"}
        
        prompt = f"""Create a precise 4-word title from this content:

{chat_data[:2000]}

Rules:
- EXACTLY 4 words
- Focus on main topic
- Use academic/technical terms
- Capitalize each word
- No punctuation

Generate only the 4-word title:"""

        response = await generate_ai_response(prompt, user_profile)
        
        title = response.strip().replace('"', '').replace("'", "")
        words = title.split()
        final_title = ' '.join(words[:4]) if len(words) >= 4 else title
        
        return {
            "summary": final_title,
            "word_count": len(final_title.split()),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        return {
            "summary": "Study Session Cards",
            "word_count": 3,
            "status": "fallback"
        }

@app.put("/update_flashcard_set")
def update_flashcard_set(set_data: FlashcardSetUpdate, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_data.set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    flashcard_set.title = set_data.title
    flashcard_set.description = set_data.description
    flashcard_set.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "id": flashcard_set.id,
        "title": flashcard_set.title,
        "description": flashcard_set.description,
        "updated_at": flashcard_set.updated_at.isoformat(),
        "status": "success"
    }

@app.delete("/delete_flashcard_set/{set_id}")
def delete_flashcard_set(set_id: int, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    db.query(models.Flashcard).filter(models.Flashcard.set_id == set_id).delete()
    db.query(models.FlashcardStudySession).filter(models.FlashcardStudySession.set_id == set_id).delete()
    
    db.delete(flashcard_set)
    db.commit()
    
    return {"message": "Flashcard set deleted successfully"}

@app.get("/get_enhanced_user_stats")
def get_enhanced_user_stats(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        total_questions = db.query(models.Activity).filter(
            models.Activity.user_id == user.id
        ).count()
        
        total_sessions = db.query(models.DailyLearningMetrics.sessions_completed).filter(
            models.DailyLearningMetrics.user_id == user.id
        ).all()
        total_sessions_count = sum(s[0] for s in total_sessions) if total_sessions else 0
        
        total_time = db.query(models.DailyLearningMetrics.time_spent_minutes).filter(
            models.DailyLearningMetrics.user_id == user.id
        ).all()
        total_minutes = sum(t[0] for t in total_time) if total_time else 0
        
        total_flashcards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id
        ).count()
        
        total_chat_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).count()
        
        streak = calculate_day_streak(db, user.id)
        
        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        if user_stats:
            user_stats.day_streak = streak
            user_stats.total_lessons = total_sessions_count
            user_stats.total_hours = total_minutes / 60
            db.commit()
        
        return {
            "streak": streak,
            "lessons": total_sessions_count,
            "hours": round(total_minutes / 60, 1),
            "minutes": total_minutes,
            "accuracy": user_stats.accuracy_percentage if user_stats else 0,
            "totalQuestions": total_questions,
            "totalFlashcards": total_flashcards,
            "totalNotes": total_notes,
            "totalChatSessions": total_chat_sessions,
            "total_time_today": 0
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return {
            "streak": 0, "lessons": 0, "hours": 0, "minutes": 0, "accuracy": 0,
            "totalQuestions": 0, "totalFlashcards": 0, "totalNotes": 0, "totalChatSessions": 0
        }

@app.get("/get_activity_heatmap")
def get_activity_heatmap(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=365)
        
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user.id,
            models.Activity.timestamp >= start_date
        ).all()
        
        activity_dict = {}
        for activity in activities:
            date_str = activity.timestamp.date().isoformat()
            activity_dict[date_str] = activity_dict.get(date_str, 0) + 1
        
        current_date = start_date
        heatmap_data = []
        
        while current_date <= end_date:
            date_str = current_date.isoformat()
            count = activity_dict.get(date_str, 0)
            
            if count == 0:
                level = 0
            elif count == 1:
                level = 1
            elif count <= 3:
                level = 2
            elif count <= 5:
                level = 3
            elif count <= 8:
                level = 4
            else:
                level = 5
            
            heatmap_data.append({
                "date": date_str,
                "count": count,
                "level": level
            })
            current_date += timedelta(days=1)
        
        total_count = sum(activity_dict.values())
        
        return {
            "heatmap_data": heatmap_data,
            "total_count": total_count,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error getting heatmap: {str(e)}")
        return {"heatmap_data": [], "total_count": 0, "date_range": {"start": "", "end": ""}}

@app.get("/get_recent_activities")
def get_recent_activities(user_id: str = Query(...), limit: int = Query(5), db: Session = Depends(get_db)):
    return []

@app.get("/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"weekly_data": [0,0,0,0,0,0,0], "total_sessions": 0, "average_per_day": 0}

@app.get("/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get last 7 days
        end_date = datetime.now(timezone.utc).date()
        start_date = end_date - timedelta(days=6)  # 6 days ago + today = 7 days
        
        # Get daily metrics for the week
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user.id,
            models.DailyLearningMetrics.date >= start_date,
            models.DailyLearningMetrics.date <= end_date
        ).order_by(models.DailyLearningMetrics.date.asc()).all()
        
        # Create a map of date to sessions
        metrics_map = {metric.date: metric.sessions_completed for metric in daily_metrics}
        
        # Fill in the last 7 days (Monday to Sunday)
        weekly_data = []
        total_sessions = 0
        
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            sessions = metrics_map.get(current_date, 0)
            weekly_data.append(sessions)
            total_sessions += sessions
        
        average_per_day = total_sessions / 7 if total_sessions > 0 else 0
        
        return {
            "weekly_data": weekly_data,
            "total_sessions": total_sessions,
            "average_per_day": round(average_per_day, 1),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting weekly progress: {str(e)}")
        return {
            "weekly_data": [0, 0, 0, 0, 0, 0, 0],
            "total_sessions": 0,
            "average_per_day": 0
        }


@app.get("/get_learning_analytics")
def get_learning_analytics(user_id: str = Query(...), period: str = Query("week"), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=7)
    
    daily_metrics = db.query(models.DailyLearningMetrics).filter(
        models.DailyLearningMetrics.user_id == user.id,
        models.DailyLearningMetrics.date >= start_date,
        models.DailyLearningMetrics.date <= end_date
    ).all()
    
    total_sessions = len([m for m in daily_metrics if m.questions_answered > 0 or m.time_spent_minutes > 0])
    total_time_minutes = sum(m.time_spent_minutes for m in daily_metrics)
    total_questions = sum(m.questions_answered for m in daily_metrics)
    
    return {
        "period": "week",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_sessions": total_sessions,
        "total_time_minutes": total_time_minutes,
        "total_questions": total_questions,
        "accuracy_percentage": 100,
        "average_per_day": 0,
        "days_active": total_sessions,
        "daily_data": []
    }
@app.post("/firebase-auth")
async def firebase_authentication(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        id_token = data.get('idToken')
        email = data.get('email')
        display_name = data.get('displayName')
        photo_url = data.get('photoURL')
        uid = data.get('uid')

        if not id_token or not email:
            raise HTTPException(status_code=400, detail="Missing required fields")

        user = get_user_by_email(db, email)
        
        if not user:
            names = display_name.split(' ') if display_name else ['', '']
            first_name = names[0] if len(names) > 0 else ''
            last_name = ' '.join(names[1:]) if len(names) > 1 else ''
            
            user = models.User(
                first_name=first_name,
                last_name=last_name,
                email=email,
                username=email,
                hashed_password=get_password_hash(f"firebase_{uid}"),
                picture_url=photo_url,
                google_user=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
            db.commit()

        access_token = create_access_token(
            data={"sub": user.username, "user_id": user.id}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "picture_url": user.picture_url,
                "google_user": True
            }
        }

    except Exception as e:
        logger.error(f"Firebase auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@app.post("/start_session")
def start_session(
    user_id: str = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        session_id = f"{user.id}_{session_type}_{int(datetime.now(timezone.utc).timestamp())}"
        
        return {
            "status": "success",
            "session_id": session_id,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "message": f"Started {session_type} session"
        }
        
    except Exception as e:
        logger.error(f"Error starting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start session")

@app.post("/end_session")
def end_session(
    user_id: str = Form(...),
    session_id: str = Form(...),
    time_spent_minutes: float = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.now(timezone.utc).date()
        daily_metric = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date == today
            )
        ).first()
        
        if not daily_metric:
            # New record - start at 1
            daily_metric = models.DailyLearningMetrics(
                user_id=user.id,
                date=today,
                sessions_completed=1,
                time_spent_minutes=time_spent_minutes,
                questions_answered=0,
                correct_answers=0,
                topics_studied="[]"
            )
            db.add(daily_metric)
        else:
            # Existing record - increment from current value (even if 0)
            daily_metric.time_spent_minutes += time_spent_minutes
            daily_metric.sessions_completed = (daily_metric.sessions_completed or 0) + 1
        
        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        if not user_stats:
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
        
        user_stats.total_hours += (time_spent_minutes / 60)
        user_stats.last_activity = datetime.now(timezone.utc)
        
        db.commit()
        
        logger.info(f"✅ Session ended: user={user.email}, sessions_today={daily_metric.sessions_completed}, time={daily_metric.time_spent_minutes}")
        
        return {
            "status": "success",
            "message": f"Ended {session_type} session",
            "time_recorded": time_spent_minutes,
            "total_time_today": daily_metric.time_spent_minutes,
            "sessions_today": daily_metric.sessions_completed
        }
        
    except Exception as e:
        logger.error(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end session")


@app.get("/conversation_starters")
def get_conversation_starters(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"suggestions": ["What would you like to learn today?"]}

@app.get("/get_learning_reviews")
def get_learning_reviews(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"reviews": []}



@app.post("/create_learning_review")
def create_learning_review(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        chat_session_ids = payload.get("chat_session_ids", [])
        review_title = payload.get("review_title", "Learning Review")
        review_type = payload.get("review_type", "comprehensive")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        sessions = db.query(models.ChatSession).filter(
            models.ChatSession.id.in_(chat_session_ids),
            models.ChatSession.user_id == user.id
        ).all()

        if not sessions:
            raise HTTPException(status_code=404, detail="No chat sessions found")

        session_titles = [s.title for s in sessions]
        session_ids = [s.id for s in sessions]

        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id.in_(session_ids)
        ).order_by(models.ChatMessage.timestamp.asc()).all()

        combined_text = "\n".join([
            f"Q: {m.user_message}\nA: {m.ai_response}" for m in messages
        ])[:8000]

        prompt = f"""
        You are an intelligent learning assistant.
        Extract 5-10 key learning points that summarize the following conversation.
        Return them strictly as a JSON list: ["Point 1", "Point 2", ...].

        Conversation:
        {combined_text}
        """

        ai_response = asyncio.run(generate_ai_response(prompt, {"first_name": "Student"}))
        try:
            learning_points = json.loads(re.search(r"\[.*\]", ai_response, re.DOTALL).group())
        except:
            learning_points = ["Key ideas extracted", "More points will appear after review"]

        review = models.LearningReview(
            user_id=user.id,
            title=review_title,
            source_sessions=json.dumps(session_ids),
            source_content=combined_text[:4000],
            expected_points=json.dumps(learning_points),
            review_type=review_type,
            total_points=len(learning_points),
            best_score=0.0,
            current_attempt=0,
            status="active",
            created_at=datetime.now(timezone.utc)
        )

        db.add(review)
        db.commit()
        db.refresh(review)

        return {
            "status": "success",
            "review_id": review.id,
            "title": review.title,
            "session_titles": session_titles,
            "learning_points": learning_points
        }

    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create learning review: {str(e)}")
    
@app.post("/save_archetype_profile")
async def save_archetype_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        primary_archetype = payload.get("primary_archetype")
        secondary_archetype = payload.get("secondary_archetype")
        archetype_scores = payload.get("archetype_scores", {})
        archetype_description = payload.get("archetype_description", "")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        if not comprehensive_profile:
            comprehensive_profile = models.ComprehensiveUserProfile(
                user_id=user.id,
                primary_archetype=primary_archetype,
                secondary_archetype=secondary_archetype,
                archetype_scores=json.dumps(archetype_scores),
                archetype_description=archetype_description
            )
            db.add(comprehensive_profile)
        else:
            comprehensive_profile.primary_archetype = primary_archetype
            comprehensive_profile.secondary_archetype = secondary_archetype
            comprehensive_profile.archetype_scores = json.dumps(archetype_scores)
            comprehensive_profile.archetype_description = archetype_description

        db.commit()
        db.refresh(comprehensive_profile)

        return {
            "status": "success",
            "message": "Archetype profile saved successfully",
            "primary_archetype": primary_archetype,
            "secondary_archetype": secondary_archetype
        }

    except Exception as e:
        logger.error(f"Error saving archetype: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save archetype: {str(e)}")


@app.get("/check_profile_quiz")
async def check_profile_quiz(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        has_archetype = (
            comprehensive_profile is not None and 
            comprehensive_profile.primary_archetype is not None and 
            comprehensive_profile.primary_archetype != ""
        )

        return {
            "completed": has_archetype,
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking quiz: {str(e)}")
        return {"completed": False}


@app.get("/get_comprehensive_profile")
async def get_comprehensive_profile(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        result = {
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "email": user.email or "",
            "age": user.age,
            "fieldOfStudy": user.field_of_study or "",
            "difficultyLevel": "intermediate",
            "learningPace": "moderate",
            "preferredSubjects": [],
            "bestStudyTimes": [],
            "primaryArchetype": "",
            "secondaryArchetype": "",
            "archetypeDescription": ""
        }

        if comprehensive_profile:
            result.update({
                "difficultyLevel": comprehensive_profile.difficulty_level or "intermediate",
                "learningPace": comprehensive_profile.learning_pace or "moderate",
                "primaryArchetype": comprehensive_profile.primary_archetype or "",
                "secondaryArchetype": comprehensive_profile.secondary_archetype or "",
                "archetypeDescription": comprehensive_profile.archetype_description or ""
            })

            try:
                if comprehensive_profile.preferred_subjects:
                    result["preferredSubjects"] = json.loads(comprehensive_profile.preferred_subjects)
            except:
                pass

            try:
                if comprehensive_profile.best_study_times:
                    result["bestStudyTimes"] = json.loads(comprehensive_profile.best_study_times)
            except:
                pass

        return result

    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/update_comprehensive_profile")
async def update_comprehensive_profile(
    profile_data: UserProfileUpdate,
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, profile_data.user_id) or get_user_by_email(db, profile_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if profile_data.firstName:
            user.first_name = profile_data.firstName
        if profile_data.lastName:
            user.last_name = profile_data.lastName
        if profile_data.email:
            user.email = profile_data.email
        if profile_data.age:
            user.age = profile_data.age
        if profile_data.fieldOfStudy:
            user.field_of_study = profile_data.fieldOfStudy
        if profile_data.learningStyle:
            user.learning_style = profile_data.learningStyle

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        if not comprehensive_profile:
            comprehensive_profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(comprehensive_profile)

        if profile_data.difficultyLevel:
            comprehensive_profile.difficulty_level = profile_data.difficultyLevel
        if profile_data.learningPace:
            comprehensive_profile.learning_pace = profile_data.learningPace
        if profile_data.timeZone:
            comprehensive_profile.time_zone = profile_data.timeZone
        if profile_data.preferredSessionLength:
            comprehensive_profile.preferred_session_length = profile_data.preferredSessionLength

        if profile_data.preferredSubjects:
            comprehensive_profile.preferred_subjects = json.dumps(profile_data.preferredSubjects)
        if profile_data.bestStudyTimes:
            comprehensive_profile.best_study_times = json.dumps(profile_data.bestStudyTimes)

        db.commit()

        return {
            "status": "success",
            "message": "Profile updated successfully"
        }

    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting Brainwave AI Backend v3.0.0 with Groq")
    logger.info(f"All API endpoints loaded successfully")
    
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=False)