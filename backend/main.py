import os
import sys
import re
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
import asyncio
import math  
import tempfile
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
from models import get_db


from pathlib import Path
import PyPDF2
import io

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from ai_personality import PersonalityEngine, AdaptiveLearningModel
from neural_adaptation import get_rl_agent, ConversationContextAnalyzer
import advanced_prompting
from flashcard_api import register_flashcard_api 
from question_bank_enhanced import register_question_bank_api

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

models.Base.metadata.create_all(bind=engine)




app = FastAPI(title="Brainwave Backend API", version="3.0.0")  # ✅ Keep this, remove duplicate

# ==================== CORS CONFIGURATION ====================



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "https://ceryl.onrender.com",
        "https://l1.vercel.app",  # ✅ your main production domain (if set)
    ],
    allow_origin_regex=r"https://l1-[a-z0-9]+-projects\.vercel\.app$",  # ✅ allows all preview deploys
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


logger.info("✅ CORS configured for localhost, Render, and Vercel deployments")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.3-70b-versatile"

groq_client = Groq(api_key=GROQ_API_KEY)

logger.info(f"🔑 GROQ_API_KEY loaded: {GROQ_API_KEY[:10]}..." if GROQ_API_KEY else "❌ NO API KEY")
flashcard_api = register_flashcard_api(app, groq_client, GROQ_MODEL)  # ← ADD THIS LINE
logger.info("✅ Flashcard API integrated successfully")


register_question_bank_api(app, groq_client, GROQ_MODEL, get_db)
logger.info("Enhanced Question Bank API with sophisticated AI agents registered successfully")

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
    preferredSessionLength: Optional[int] = None  
    bestStudyTimes: Optional[List[str]] = [] 

class FolderCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = "#D7B38C"
    parent_id: Optional[int] = None

class FolderUpdate(BaseModel):
    folder_id: int
    name: str
    color: Optional[str] = None

class NoteUpdateFolder(BaseModel):
    note_id: int
    folder_id: Optional[int] = None

class NoteFavorite(BaseModel):
    note_id: int
    is_favorite: bool

class AIWritingAssistRequest(BaseModel):
    user_id: str
    content: str
    action: str  # "continue", "improve", "simplify", "expand", "tone_change"
    tone: Optional[str] = "professional"

class ShareContentRequest(BaseModel):
    content_type: str  # 'chat' or 'note'
    content_id: int
    friend_ids: List[int]
    message: Optional[str] = None
    permission: str = 'view'  # 'view' or 'edit'

class RemoveSharedAccessRequest(BaseModel):
    share_id: int

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
def extract_topic_keywords(text: str) -> List[str]:
    stop_words = {
        'what', 'when', 'where', 'which', 'who', 'how', 'does', 'can', 'will', 
        'should', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'explain', 'tell', 'help',
        'understand', 'know', 'about', 'this', 'that', 'with', 'from', 'for'
    }
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    keywords = [w for w in words if w not in stop_words]
    
    return keywords[:10]


def get_relevant_past_conversations(db: Session, user_id: int, current_topic: str, limit: int = 5) -> List[Dict]:
    try:
        recent_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user_id
        ).order_by(models.ChatSession.updated_at.desc()).limit(20).all()
        
        relevant_conversations = []
        
        for session in recent_sessions:
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == session.id
            ).order_by(models.ChatMessage.timestamp.asc()).limit(3).all()
            
            if messages:
                session_content = " ".join([
                    f"{m.user_message} {m.ai_response}" for m in messages
                ])
                
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
        
        relevant_conversations.sort(
            key=lambda x: (x['relevance_score'], x['last_updated']), 
            reverse=True
        )
        
        return relevant_conversations[:limit]
        
    except Exception as e:
        logger.error(f"Error getting relevant conversations: {str(e)}")
        return []


def get_user_learning_context(db: Session, user_id: int) -> Dict[str, Any]:
    try:
        recent_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(20).all()
        
        topics_studied = {}
        for activity in recent_activities:
            topic = activity.topic or "General"
            topics_studied[topic] = topics_studied.get(topic, 0) + 1
        
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

#@app.get("/")
#async def root():
 #   return {
 #       "message": "Brainwave Backend API v3.0.0",
  ##     "ai_provider": "Groq",
   #     "api_version": "3.0.0"
   # }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Brainwave API is running",
        "ai_provider": "Groq",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/api/get_daily_goal_progress")
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


@app.post("/api/register")
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

@app.post("/api/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/token_form")
async def login_form(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/google-auth")
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

@app.get("/api/me")
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


@app.post("/api/ask/")
async def ask_ai_enhanced(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    logger.info(f"🤖 Processing AI query for user {user_id}")
    
    try:
        chat_id_int = int(chat_id) if chat_id else None
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
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
        
        if comprehensive_profile:
            user_profile.update({
                "difficulty_level": comprehensive_profile.difficulty_level or "intermediate",
                "learning_pace": comprehensive_profile.learning_pace or "moderate",
                "primary_archetype": comprehensive_profile.primary_archetype or "",
                "secondary_archetype": comprehensive_profile.secondary_archetype or "",
                "brainwave_goal": comprehensive_profile.brainwave_goal or ""
            })
            
            try:
                if comprehensive_profile.preferred_subjects:
                    subjects_data = comprehensive_profile.preferred_subjects
                    if isinstance(subjects_data, str):
                        user_profile["preferred_subjects"] = json.loads(subjects_data)
                    else:
                        user_profile["preferred_subjects"] = subjects_data
            except Exception as e:
                logger.error(f"Error parsing subjects: {e}")
                user_profile["preferred_subjects"] = []
        
        logger.info(f"📊 Profile: {user_profile['primary_archetype']} | {user_profile['field_of_study']}")
        
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
        
        learning_context = advanced_prompting.get_user_learning_context(db, user.id)
        
        topic_keywords = " ".join(advanced_prompting.extract_topic_keywords(question))
        relevant_past_chats = advanced_prompting.get_relevant_past_conversations(
            db, user.id, topic_keywords, limit=3
        )
        
        rl_agent = get_rl_agent(db, user.id)
        
        context = {
            'message_length': len(question),
            'question_complexity': ConversationContextAnalyzer.calculate_complexity(question),
            'archetype': user_profile.get('primary_archetype', ''),
            'time_of_day': datetime.now(timezone.utc).hour,
            'session_length': len(conversation_history),
            'previous_ratings': [
                msg.get('userRating', 3) for msg in conversation_history
                if isinstance(msg, dict) and msg.get('userRating')
            ],
            'topic_keywords': advanced_prompting.extract_topic_keywords(question),
            'sentiment': ConversationContextAnalyzer.analyze_sentiment(question),
            'formality_level': 0.5
        }
        
        state = rl_agent.encode_state(context)
        response_adjustments = rl_agent.get_response_adjustment()
        
        logger.info(f"🧠 Neural adjustments: {response_adjustments}")
        
        response = await advanced_prompting.generate_enhanced_ai_response(
            question,
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats,
            db,
            groq_client,
            GROQ_MODEL
        )
        
        known_mistake = rl_agent.check_for_known_mistakes(response)
        if known_mistake:
            logger.info(f"🔧 Correcting known mistake")
            response = known_mistake
        
        if chat_id_int:
            chat_message = models.ChatMessage(
                chat_session_id=chat_id_int,
                user_message=question,
                ai_response=response
            )
            db.add(chat_message)
            
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int
            ).first()
            chat_session.updated_at = datetime.now(timezone.utc)
            
            message_count = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == chat_id_int
            ).count()
            
            if chat_session.title == "New Chat" and message_count == 0:
                title_words = question.strip().split()[:4]
                new_title = " ".join(title_words)
                chat_session.title = new_title[:50] if new_title else "New Chat"
        
        topic = advanced_prompting.get_topic_from_question(question)
        
        activity = models.Activity(
            user_id=user.id,
            question=question,
            answer=response,
            topic=topic,
            question_type="conversational",
            difficulty_level=user_profile.get('difficulty_level', 'medium'),
            timestamp=datetime.now(timezone.utc)
        )
        db.add(activity)
        
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
                sessions_completed=1,
                time_spent_minutes=0,
                questions_answered=1,
                correct_answers=1,
                topics_studied=json.dumps([topic])
            )
            db.add(daily_metric)
        else:
            daily_metric.questions_answered += 1
            daily_metric.correct_answers += 1
            
            try:
                topics = json.loads(daily_metric.topics_studied or "[]")
                if topic and topic not in topics:
                    topics.append(topic)
                    daily_metric.topics_studied = json.dumps(topics[-10:])
            except:
                daily_metric.topics_studied = json.dumps([topic])
        
        db.commit()
        
        action = rl_agent.network.predict(state)
        next_state = rl_agent.encode_state({**context, 'session_length': len(conversation_history) + 1})
        rl_agent.remember(state, action, 0.0, next_state)
        
        advanced_prompting.save_conversation_memory(db, user.id, question, response, context['topic_keywords'])
        
        return {
            "answer": response,
            "ai_confidence": 0.92,
            "misconception_detected": False,
            "should_request_feedback": False,
            "topics_discussed": [topic],
            "query_type": "conversational_learning",
            "model_used": GROQ_MODEL,
            "ai_provider": "Groq",
            "archetype_used": user_profile.get('primary_archetype', 'None'),
            "questions_today": daily_metric.questions_answered,
            "learning_context_used": bool(learning_context),
            "relevant_past_chats": len(relevant_past_chats),
            "neural_network_active": True,
            "response_adjustments": response_adjustments
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ask_ai: {str(e)}", exc_info=True)
        return {
            "answer": "I apologize, but I encountered an error. Could you please rephrase your question?",
            "ai_confidence": 0.3,
            "misconception_detected": False,
            "should_request_feedback": False,
            "topics_discussed": ["error"],
            "query_type": "error",
            "model_used": "error_handler",
            "ai_provider": "Groq"
        }
    
@app.post("/api/create_chat_session")
def create_chat_session(
    session_data: ChatSessionCreate,
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, session_data.user_id) or get_user_by_email(db, session_data.user_id)
        if not user:
            logger.error(f"User not found: {session_data.user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        chat_session = models.ChatSession(
            user_id=user.id,
            title=session_data.title
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
        
        logger.info(f"✅ Chat session created: ID={chat_session.id} for user {user.email}")
        
        return {
            "id": chat_session.id,
            "session_id": chat_session.id,
            "title": chat_session.title,
            "created_at": chat_session.created_at.isoformat(),
            "updated_at": chat_session.updated_at.isoformat(),
            "status": "success"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating chat session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")

@app.get("/api/get_user_achievements")
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

@app.get("/api/get_chat_sessions")
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

@app.get("/api/get_chat_messages")
def get_chat_messages(chat_id: int = Query(...), db: Session = Depends(get_db)):
    try:
        logger.info(f"📥 Loading messages for chat_id: {chat_id}")
        
        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == chat_id
        ).order_by(models.ChatMessage.timestamp.asc()).all()
        
        logger.info(f"Found {len(messages)} message pairs")
        
        result = []
        
        for msg in messages:
            # Add user message
            result.append({
                "id": f"user_{msg.id}",
                "type": "user",
                "content": msg.user_message,
                "timestamp": msg.timestamp.isoformat()
            })
            
            # Add AI message
            result.append({
                "id": f"ai_{msg.id}",
                "type": "ai",
                "content": msg.ai_response,
                "timestamp": msg.timestamp.isoformat(),
                "aiConfidence": 0.85,
                "shouldRequestFeedback": False
            })
        
        logger.info(f"📤 Returning {len(result)} individual messages")
        return result
        
    except Exception as e:
        logger.error(f"Error in get_chat_messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/submit_response_feedback")
async def submit_response_feedback(
    user_id: str = Form(...),
    rating: int = Form(...),
    message_context: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        from ai_personality import AdaptiveLearningModel
        
        adaptive_model = AdaptiveLearningModel()
        adaptive_model.load_model_state(db, user.id)
        adaptive_model.update_from_feedback(rating, 'explanation_depth')
        adaptive_model.save_model_state(db, user.id)
        
        feedback = models.UserFeedback(
            user_id=user.id,
            feedback_type="rating",
            rating=rating,
            topic_context=message_context,
            is_processed=False
        )
        db.add(feedback)
        db.commit()
        
        return {
            "status": "success",
            "message": "Feedback recorded and model updated"
        }
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/api/submit_advanced_feedback")
async def submit_advanced_feedback(
    user_id: str = Form(...),
    rating: int = Form(...),
    feedback_text: str = Form(None),
    improvement_suggestion: str = Form(None),
    message_content: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        from ai_personality import AdaptiveLearningModel
        from neural_adaptation import get_rl_agent, ConversationContextAnalyzer
        
        adaptive_model = AdaptiveLearningModel()
        adaptive_model.load_model_state(db, user.id)
        adaptive_model.update_from_feedback(rating, 'explanation_depth')
        adaptive_model.save_model_state(db, user.id)
        
        rl_agent = get_rl_agent(db, user.id)
        
        reward = rl_agent.get_reward(rating, feedback_text)
        
        context = {
            'message_length': len(message_content or ''),
            'question_complexity': 0.5,
            'archetype': '',
            'time_of_day': datetime.now(timezone.utc).hour,
            'session_length': 0,
            'previous_ratings': [],
            'topic_keywords': [],
            'sentiment': ConversationContextAnalyzer.analyze_sentiment(feedback_text or ''),
            'formality_level': 0.5
        }
        
        state = rl_agent.encode_state(context)
        next_state = state
        action = rl_agent.network.predict(state)
        
        rl_agent.remember(state, action, reward, next_state)
        rl_agent.learn_from_experience(batch_size=16)
        
        if rating >= 4:
            rl_agent.learn_from_positive_feedback(message_content or '', rating)
        elif rating <= 2 and feedback_text:
            rl_agent.learn_from_negative_feedback(
                message_content or '', rating, feedback_text
            )
        
        if improvement_suggestion:
            correction_intent = ConversationContextAnalyzer.extract_correction_intent(
                improvement_suggestion
            )
            if correction_intent:
                rl_agent.save_correction(
                    message_content or '',
                    improvement_suggestion,
                    context
                )
        
        rl_agent.save_model()
        
        feedback = models.UserFeedback(
            user_id=user.id,
            feedback_type="rating_with_learning",
            rating=rating,
            feedback_text=feedback_text,
            topic_context=message_content,
            is_processed=True,
            resulted_in_improvement=True
        )
        db.add(feedback)
        db.commit()
        
        return {
            "status": "success",
            "message": "Feedback processed with neural network",
            "reward": float(reward),
            "model_updated": True,
            "corrections_learned": len(rl_agent.user_corrections)
        }
        
    except Exception as e:
        logger.error(f"Error in advanced feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get_chat_history/{session_id}")
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

@app.post("/api/save_chat_message")
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

@app.delete("/api/delete_chat_session/{session_id}")
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

# ==================== NOTES ENDPOINTS ====================
# Add this helper function BEFORE the notes endpoints


def clean_conversational_elements(text: str) -> str:
    """Remove conversational phrases from AI-generated content"""
    conversational_patterns = [
        r'^(Hi|Hello|Hey|Greetings)[,!.\s]+.*?\n',
        r'^(Sure|Of course|Certainly|Absolutely)[,!.\s]+.*?\n',
        r'^(Here\'s|Here is|Let me)[,\s]+.*?\n',
        r'^(I\'ll|I will|I can)[,\s]+.*?\n',
        r'Hope this helps.*$',
        r'Feel free to.*$',
        r'Let me know.*$',
    ]
    
    cleaned_text = text
    for pattern in conversational_patterns:
        cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.MULTILINE | re.IGNORECASE)
    
    # Remove multiple newlines and clean up
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    return cleaned_text.lstrip('\n\r\t ')


# ==================== NOTES ENDPOINTS ====================

@app.get("/api/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all notes for a user (excluding deleted)"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # CRITICAL: Query with explicit filter for non-deleted notes
        notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == False  # This line filters out deleted notes
        ).order_by(models.Note.updated_at.desc()).all()
        
        logger.info(f"Retrieved {len(notes)} active notes for user {user.email}")
        
        # Double-check: filter again in Python to be absolutely sure
        result = []
        for note in notes:
            if not note.is_deleted:  # Extra safety check
                result.append({
                    "id": note.id,
                    "title": note.title,
                    "content": note.content,
                    "created_at": note.created_at.isoformat(),
                    "updated_at": note.updated_at.isoformat(),
                    "is_favorite": getattr(note, 'is_favorite', False),
                    "folder_id": getattr(note, 'folder_id', None),
                    "custom_font": getattr(note, 'custom_font', 'Inter'),
                    "is_deleted": False
                })
        
        logger.info(f"Returning {len(result)} notes after filtering")
        return result
        
    except Exception as e:
        logger.error(f"Error getting notes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
# Add these endpoints to your main.py file
@app.get("/api/debug_notes/{user_id}")
def debug_notes(user_id: str, db: Session = Depends(get_db)):
    """Debug endpoint to see ALL notes"""
    user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
    if not user:
        return {"error": "User not found"}
    
    notes = db.query(models.Note).filter(
        models.Note.user_id == user.id
    ).all()
    
    result = []
    for note in notes:
        result.append({
            "id": note.id,
            "title": note.title,
            "is_deleted": note.is_deleted,
            "deleted_at": str(note.deleted_at) if note.deleted_at else None,
        })
    
    return {"total_notes": len(notes), "notes": result}

@app.post("/api/transcribe_audio/")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db)
):
    temp_audio_path = None
    try:
        logger.info(f"🎤 Transcribing audio for user: {user_id}")
        logger.info(f"📁 File info - Name: {audio_file.filename}, Type: {audio_file.content_type}")
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        audio_content = await audio_file.read()
        logger.info(f"📊 Audio size: {len(audio_content)} bytes")
        
        if len(audio_content) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm", mode='wb') as temp_file:
            temp_file.write(audio_content)
            temp_audio_path = temp_file.name
        
        logger.info(f"💾 Saved to: {temp_audio_path}")
        
        try:
            with open(temp_audio_path, "rb") as f:
                logger.info("🚀 Calling Groq Whisper API...")
                transcription = groq_client.audio.transcriptions.create(
                    file=f,
                    model="whisper-large-v3-turbo",
                    response_format="json",
                    language="en"
                )
            
            transcript_text = transcription.text
            logger.info(f"✅ Transcription successful: '{transcript_text[:100]}...'")
            
            return {
                "status": "success",
                "transcript": transcript_text,
                "length": len(transcript_text),
                "model_used": "whisper-large-v3-turbo"
            }
            
        except Exception as groq_error:
            logger.error(f"❌ Groq API error: {str(groq_error)}")
            logger.error(f"Error type: {type(groq_error).__name__}")
            raise HTTPException(
                status_code=500, 
                detail=f"Transcription failed: {str(groq_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to transcribe audio: {str(e)}"
        )
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.remove(temp_audio_path)
                logger.info(f"🗑️ Cleaned up temp file: {temp_audio_path}")
            except Exception as cleanup_error:
                logger.warning(f"⚠️ Failed to cleanup temp file: {cleanup_error}")

@app.get("/api/test_transcribe")
def test_transcribe_endpoint():
    """Test endpoint to verify transcription route exists"""
    return {
        "status": "endpoint exists",
        "message": "Transcribe audio endpoint is registered",
        "groq_available": GROQ_API_KEY is not None,
        "groq_key_prefix": GROQ_API_KEY[:10] if GROQ_API_KEY else "None"
    }


@app.post("/api/transcribe_audio_test/")
async def transcribe_audio_test(
    user_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Simplified test version without actual audio file"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "status": "success",
            "message": "Endpoint working, user found",
            "user_id": user.id,
            "groq_configured": GROQ_API_KEY is not None
        }
    except Exception as e:
        logger.error(f"Test endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/fix_all_notes")
def fix_all_notes(db: Session = Depends(get_db)):
    """Emergency fix - set all NULL is_deleted to False and ensure data integrity"""
    try:
        # Get all notes
        all_notes = db.query(models.Note).all()
        
        fixed_count = 0
        verified_count = 0
        error_count = 0
        
        for note in all_notes:
            try:
                # Fix NULL or None is_deleted values
                if note.is_deleted is None:
                    note.is_deleted = False
                    fixed_count += 1
                
                # Fix any integer 1 that should be True (for SQLite compatibility)
                elif note.is_deleted == 1:
                    note.is_deleted = True
                    verified_count += 1
                
                # Fix any integer 0 that should be False
                elif note.is_deleted == 0:
                    note.is_deleted = False
                    verified_count += 1
                
                # If marked as deleted but no deleted_at timestamp, add one
                if note.is_deleted and note.deleted_at is None:
                    note.deleted_at = datetime.now(timezone.utc)
                    logger.info(f"Added deleted_at timestamp to note {note.id}")
                
                # If not deleted but has deleted_at timestamp, clear it
                if not note.is_deleted and note.deleted_at is not None:
                    note.deleted_at = None
                    logger.info(f"Cleared deleted_at timestamp from note {note.id}")
                    
            except Exception as e:
                error_count += 1
                logger.error(f"Error fixing note {note.id}: {str(e)}")
                continue
        
        # Commit all changes
        db.commit()
        
        logger.info(f"✅ Note fix completed: {fixed_count} fixed, {verified_count} verified, {error_count} errors")
        
        return {
            "status": "success",
            "total_notes": len(all_notes),
            "fixed_count": fixed_count,
            "verified_count": verified_count,
            "error_count": error_count,
            "message": f"Successfully fixed {fixed_count} notes with NULL is_deleted values"
        }
    
    except Exception as e:
        logger.error(f"Critical error in fix_all_notes: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fix notes: {str(e)}"
        )
  

@app.get("/api/get_folders")
def get_folders(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all folders for a user with note counts"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        folders = db.query(models.Folder).filter(
            models.Folder.user_id == user.id
        ).order_by(models.Folder.name.asc()).all()
        
        result = []
        for folder in folders:
            # ✅ Count only non-deleted notes
            note_count = db.query(models.Note).filter(
                models.Note.folder_id == folder.id,
                models.Note.is_deleted == False  # ✅ Exclude deleted notes from count
            ).count()
            
            result.append({
                "id": folder.id,
                "name": folder.name,
                "color": folder.color,
                "parent_id": folder.parent_id,
                "note_count": note_count,
                "created_at": folder.created_at.isoformat()
            })
        
        return {"folders": result}
    except Exception as e:
        logger.error(f"Error getting folders: {str(e)}")
        return {"folders": []}


@app.get("/api/get_trash")
def get_trash(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all deleted notes (trash)"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get notes deleted within last 30 days (timezone-aware)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == True,
            models.Note.deleted_at != None,
            models.Note.deleted_at >= thirty_days_ago
        ).order_by(models.Note.deleted_at.desc()).all()
        
        logger.info(f"📥 Found {len(notes)} deleted notes for user {user.email}")
        
        result = []
        for note in notes:
            # Handle timezone-aware datetime safely
            if note.deleted_at:
                if note.deleted_at.tzinfo is None:
                    # If naive, make it aware
                    deleted_at_aware = note.deleted_at.replace(tzinfo=timezone.utc)
                else:
                    deleted_at_aware = note.deleted_at
                
                days_since_deletion = (datetime.now(timezone.utc) - deleted_at_aware).days
                days_remaining = max(0, 30 - days_since_deletion)
            else:
                days_remaining = 30
            
            result.append({
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "deleted_at": note.deleted_at.isoformat() if note.deleted_at else None,
                "days_remaining": days_remaining
            })
        
        return {"trash": result}
        
    except Exception as e:
        logger.error(f"Error getting trash: {str(e)}", exc_info=True)
        return {"trash": []}

# ENHANCED AI CONTENT GENERATION WITH SPECIFIC PROMPTS
@app.post("/api/generate_note_content/")
async def generate_note_content(
    user_id: str = Form(...),
    prompt: str = Form(...),
    content_type: str = Form("general"),
    existing_content: str = Form(""),
    db: Session = Depends(get_db)
):
    """
    Generate AI content for notes with specific prompt templates
    """
    try:
        logger.info(f"Generating {content_type} content for user: {user_id}")
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            logger.error(f"User not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        user_profile = build_user_profile_dict(user, comprehensive_profile)
        
        content_context = existing_content[-500:] if existing_content else ""
        
        # DIFFERENT SYSTEM PROMPTS FOR EACH ACTION TYPE
        action_prompts = {
            "explain": f"""You are an educational content expert specializing in clear explanations.

CRITICAL RULES:
1. NO greetings, NO conversational phrases
2. Start DIRECTLY with the explanation
3. Use HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
4. Break down complex concepts into simple terms
5. Use analogies and examples
6. Structure: Definition > How it works > Examples

Student Level: {user_profile.get('difficulty_level', 'intermediate')}
Learning Style: {user_profile.get('learning_style', 'Mixed')}

Topic to explain: {prompt}

Provide a clear, detailed explanation that builds understanding step by step.""",

            "key_points": f"""You are a study guide expert who extracts essential information.

CRITICAL RULES:
1. NO greetings, NO conversational phrases
2. Start with <h2>Key Points</h2>
3. Use numbered list (<ol>) or bullet points (<ul><li>)
4. Each point should be concise but complete
5. Include 5-10 key points maximum
6. Bold important terms with <strong>

Student Level: {user_profile.get('difficulty_level', 'intermediate')}

Topic: {prompt}

Extract and present the most important points clearly.""",

            "guide": f"""You are a comprehensive guide writer for educational content.

CRITICAL RULES:
1. NO greetings, NO conversational phrases
2. Start with <h1>Guide: [Topic]</h1>
3. Use clear section headings (<h2>, <h3>)
4. Include introduction, main sections, and conclusion
5. Add practical examples and applications
6. Use lists, tables, or diagrams where helpful

Student Level: {user_profile.get('difficulty_level', 'intermediate')}
Field: {user_profile.get('field_of_study', 'General')}

Topic: {prompt}

Create a comprehensive, well-structured guide.""",

            "summary": f"""You are a summarization expert for academic content.

CRITICAL RULES:
1. NO greetings, NO conversational phrases
2. Start with <h2>Summary</h2>
3. Condense to essential information only
4. Use clear, concise language
5. Maintain key facts and concepts
6. Structure with bullet points if needed

Content to summarize: {content_context}

Additional context: {prompt}

Provide a concise, accurate summary.""",

            "general": f"""You are an expert educational content generator.

CRITICAL RULES:
1. NO greetings, NO conversational phrases
2. Start DIRECTLY with the main content
3. Use HTML formatting: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
4. Be educational, clear, and well-structured
5. Match student's level and learning style

Student Level: {user_profile.get('difficulty_level', 'intermediate')}
Learning Style: {user_profile.get('learning_style', 'Mixed')}

Generate educational content about: {prompt}"""
        }
        
        system_prompt = action_prompts.get(content_type, action_prompts["general"])
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        logger.info("Calling Groq API...")
        
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048,
            top_p=0.9,
        )
        
        generated_content = chat_completion.choices[0].message.content
        logger.info(f"Generated content length: {len(generated_content)} characters")
        
        generated_content = clean_conversational_elements(generated_content)
        
        if not generated_content.strip().startswith('<'):
            generated_content = f"<h2>{prompt}</h2>\n<p>{generated_content}</p>"
        
        logger.info("Content generation successful")
        
        return {
            "status": "success",
            "content": generated_content,
            "content_type": content_type,
            "word_count": len(generated_content.split()),
            "model_used": GROQ_MODEL
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error generating note content: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate content: {str(e)}"
        )


# ENHANCED AI WRITING ASSISTANT WITH MORE ACTIONS
@app.post("/api/ai_writing_assistant/")
async def ai_writing_assistant(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    AI Writing Assistant with multiple transformation actions
    """
    try:
        user_id = payload.get("user_id")
        content = payload.get("content", "")
        action = payload.get("action", "improve")
        tone = payload.get("tone", "professional")
        context = payload.get("context", "")
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_profile = build_user_profile_dict(user)
        
        # DIFFERENT PROMPTS FOR EACH ACTION
        action_prompts = {
            "continue": f"""Continue writing this text naturally and coherently.

RULES:
- Match the existing style and tone
- Continue logically from where it ends
- Add 2-3 more sentences or paragraphs
- Do NOT repeat what's already written

Text to continue:
{content}

Continue writing:""",

            "improve": f"""Improve and enhance this text while keeping the same meaning.

RULES:
- Make it more clear and professional
- Fix awkward phrasing
- Improve word choice
- Keep the same structure and meaning
- Do NOT add new information

Original text:
{content}

Improved version:""",

            "simplify": f"""Simplify this text to make it easier to understand.

RULES:
- Use simpler words and shorter sentences
- Explain technical terms
- Break down complex ideas
- Keep all important information
- Make it accessible to a general audience

Text to simplify:
{content}

Simplified version:""",

            "expand": f"""Expand this text with more details, examples, and explanations.

RULES:
- Add relevant details and context
- Include practical examples
- Explain concepts more thoroughly
- Increase depth without redundancy
- Maintain the original tone

Text to expand:
{content}

Expanded version:""",

            "tone_change": f"""Rewrite this text in a {tone} tone.

RULES:
- Change the tone to be {tone}
- Keep the same information
- Adjust language and style appropriately
- Maintain clarity

Original text:
{content}

Rewritten in {tone} tone:""",

            "grammar": f"""Fix all grammar and spelling errors in this text.

RULES:
- Correct spelling mistakes
- Fix grammatical errors
- Improve punctuation
- Do NOT change the meaning or style
- Keep the same tone and voice

Text to correct:
{content}

Corrected version:""",

            "summarize": f"""Create a concise summary of this text.

RULES:
- Extract only the most important points
- Keep it brief but complete
- Maintain key information
- Use clear, simple language

Text to summarize:
{content}

Summary:"""
        }
        
        prompt = action_prompts.get(action, action_prompts["improve"])
        
        system_prompt = f"""You are a professional writing assistant for {user_profile.get('first_name', 'a student')}.

CRITICAL: Return ONLY the processed text. NO explanations, NO comments, NO greetings."""

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
        
        result = chat_completion.choices[0].message.content.strip()
        
        return {
            "status": "success",
            "action": action,
            "result": result,
            "model_used": GROQ_MODEL,
            "original_length": len(content.split()),
            "new_length": len(result.split())
        }
        
    except Exception as e:
        logger.error(f"AI writing assistant error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI assistant failed: {str(e)}")

@app.post("/api/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    """Create a new note"""
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


@app.get("/api/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all notes for a user (excluding deleted)"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # SQLite stores boolean as 0/1, so check for both False and 0
        notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            (models.Note.is_deleted == False) | (models.Note.is_deleted == 0) | (models.Note.is_deleted == None)
        ).order_by(models.Note.updated_at.desc()).all()
        
        # Extra Python filter to be absolutely sure
        active_notes = [n for n in notes if not n.is_deleted and n.deleted_at is None]
        
        logger.info(f"Retrieved {len(active_notes)} active notes for user {user.email}")
        
        return [
            {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "created_at": note.created_at.isoformat(),
                "updated_at": note.updated_at.isoformat(),
                "is_favorite": getattr(note, 'is_favorite', False),
                "folder_id": getattr(note, 'folder_id', None),
                "custom_font": getattr(note, 'custom_font', 'Inter'),
                "is_deleted": False
            }
            for note in active_notes
        ]
        
    except Exception as e:
        logger.error(f"Error getting notes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/soft_delete_note/{note_id}")
def soft_delete_note(note_id: int, db: Session = Depends(get_db)):
    """Move note to trash (soft delete)"""
    try:
        note = db.query(models.Note).filter(models.Note.id == note_id).first()
        
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Set as integer 1 for SQLite
        note.is_deleted = 1
        note.deleted_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(note)
        
        logger.info(f"Note {note.id} moved to trash - is_deleted={note.is_deleted}")
        
        return {
            "message": "Note moved to trash successfully",
            "note_id": note.id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error deleting note: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db)):
    """Update an existing note"""
    try:
        note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Check if deleted (handle both boolean and integer)
        if note.is_deleted or note.is_deleted == 1 or note.deleted_at is not None:
            logger.warning(f"Rejected update to deleted note {note.id}")
            raise HTTPException(status_code=400, detail="Cannot update a deleted note")
        
        note.title = note_data.title
        note.content = note_data.content
        note.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(note)
        
        logger.info(f"Note {note.id} updated successfully")
        
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "updated_at": note.updated_at.isoformat(),
            "is_deleted": False,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_note/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    """Delete a note"""
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}


@app.post("/api/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db)
):
    """Generate a summary for chat-to-note conversion"""
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

# ==================== END NOTES ENDPOINTS ====================# Add this new endpoint to your main.py file

# Add this to your main.py (replace the existing generate_note_content endpoint)






# Optional: Add endpoint to generate content from existing chat
@app.post("/api/convert_chat_to_note_content/")
async def convert_chat_to_note_content(
    user_id: str = Form(...),
    chat_session_id: int = Form(...),
    format_style: str = Form("comprehensive"),  # comprehensive, summary, key_points
    db: Session = Depends(get_db)
):
    """
    Convert an existing chat session into formatted note content
    """
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get chat session
        chat_session = db.query(models.ChatSession).filter(
            models.ChatSession.id == chat_session_id,
            models.ChatSession.user_id == user.id
        ).first()
        
        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Get all messages from the session
        messages = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == chat_session_id
        ).order_by(models.ChatMessage.timestamp.asc()).all()
        
        if not messages:
            raise HTTPException(status_code=404, detail="No messages found in chat session")
        
        # Compile conversation data
        conversation_text = []
        for msg in messages:
            conversation_text.append(f"Q: {msg.user_message}")
            conversation_text.append(f"A: {msg.ai_response}")
        
        full_conversation = "\n\n".join(conversation_text)
        
        # Generate formatted notes from conversation
        if format_style == "comprehensive":
            prompt = f"""Convert this chat conversation into comprehensive study notes.

Conversation:
{full_conversation[:4000]}

Create well-structured notes with:
- Clear headings and subheadings
- Key concepts explained
- Important points highlighted
- Examples included
- Summary at the end

Use HTML formatting. Start directly with content (NO conversational elements)."""

        elif format_style == "summary":
            prompt = f"""Create a concise summary of this chat conversation:

{full_conversation[:4000]}

Include:
- Main topics discussed
- Key takeaways (bullet points)
- Important conclusions

Use HTML formatting. Start directly with content."""

        elif format_style == "key_points":
            prompt = f"""Extract the key points from this conversation:

{full_conversation[:4000]}

Format as:
- Numbered or bulleted list of main points
- Brief explanations where needed
- Organized by topic

Use HTML formatting. Start directly with content."""
        
        user_profile = build_user_profile_dict(user)
        
        system_prompt = f"""You are a notes content generator. Convert the conversation into clean, educational notes.
CRITICAL: Generate ONLY the content - NO greetings, NO conversational phrases.
Use HTML formatting tags. Start DIRECTLY with the content."""

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
        
        generated_content = chat_completion.choices[0].message.content
        generated_content = clean_conversational_elements(generated_content)
        
        return {
            "status": "success",
            "content": generated_content,
            "title": chat_session.title,
            "format_style": format_style,
            "original_message_count": len(messages),
            "word_count": len(generated_content.split())
        }
        
    except Exception as e:
        logger.error(f"Error converting chat to note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to convert chat: {str(e)}")


# Optional: Endpoint to expand/elaborate on selected text
@app.post("/api/expand_note_content/")
async def expand_note_content(
    user_id: str = Form(...),
    selected_text: str = Form(...),
    expansion_type: str = Form("elaborate"),  # elaborate, explain, add_examples
    db: Session = Depends(get_db)
):
    """
    Expand or elaborate on selected text in a note
    """
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_profile = build_user_profile_dict(user)
        
        if expansion_type == "elaborate":
            instruction = f"Provide a detailed elaboration of this text: {selected_text}\n\nAdd more depth, context, and explanation."
        elif expansion_type == "explain":
            instruction = f"Explain this concept in simpler terms: {selected_text}\n\nMake it easy to understand."
        elif expansion_type == "add_examples":
            instruction = f"Provide practical examples for: {selected_text}\n\nInclude 2-3 real-world examples."
        else:
            instruction = f"Expand on this text with additional information: {selected_text}"
        
        system_prompt = f"""You are expanding notes content for a {user_profile.get('difficulty_level', 'intermediate')} level student.
Generate ONLY the expanded content - NO conversational elements.
Use HTML formatting. Start DIRECTLY with the content."""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=1024,
            top_p=0.9,
        )
        
        expanded_content = chat_completion.choices[0].message.content
        expanded_content = clean_conversational_elements(expanded_content)
        
        return {
            "status": "success",
            "expanded_content": expanded_content,
            "expansion_type": expansion_type,
            "original_length": len(selected_text),
            "expanded_length": len(expanded_content)
        }
        
    except Exception as e:
        logger.error(f"Error expanding content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to expand content: {str(e)}")

@app.post("/api/create_note")
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

@app.put("/api/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db)):
    """Update an existing note"""
    try:
        note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # ✅ CRITICAL: Do not allow updating deleted notes
        if note.is_deleted:
            logger.warning(f"⚠️ Attempted to update deleted note {note.id}")
            raise HTTPException(status_code=400, detail="Cannot update a deleted note")
        
        note.title = note_data.title
        note.content = note_data.content
        note.updated_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(note)
        
        logger.info(f"✅ Note {note.id} updated successfully")
        
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "updated_at": note.updated_at.isoformat(),
            "is_deleted": note.is_deleted,
            "status": "success"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


     
@app.delete("/api/delete_note/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}

@app.post("/api/generate_note_summary/")
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
# ==================== NEW MODELS FOR FEATURES ====================



# ==================== FOLDERS ENDPOINTS ====================

@app.post("/api/create_folder")
def create_folder(folder_data: FolderCreate, db: Session = Depends(get_db)):
    """Create a new folder"""
    try:
        user = get_user_by_username(db, folder_data.user_id) or get_user_by_email(db, folder_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_folder = models.Folder(
            user_id=user.id,
            name=folder_data.name,
            color=folder_data.color,
            parent_id=folder_data.parent_id
        )
        db.add(new_folder)
        db.commit()
        db.refresh(new_folder)
        
        return {
            "id": new_folder.id,
            "name": new_folder.name,
            "color": new_folder.color,
            "parent_id": new_folder.parent_id,
            "created_at": new_folder.created_at.isoformat(),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete_folder/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    """Delete a folder (moves notes to root)"""
    try:
        folder = db.query(models.Folder).filter(
            models.Folder.id == folder_id
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        # Move all notes in this folder to root (no folder)
        db.query(models.Note).filter(
            models.Note.folder_id == folder_id
        ).update({"folder_id": None})
        
        db.delete(folder)
        db.commit()
        
        return {"message": "Folder deleted successfully", "status": "success"}
    except Exception as e:
        logger.error(f"Error deleting folder: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/move_note_to_folder")
def move_note_to_folder(data: NoteUpdateFolder, db: Session = Depends(get_db)):
    """Move note to a folder or remove from folder"""
    try:
        note = db.query(models.Note).filter(
            models.Note.id == data.note_id
        ).first()
        
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        note.folder_id = data.folder_id
        db.commit()
        
        return {
            "message": "Note moved successfully",
            "note_id": note.id,
            "folder_id": data.folder_id,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error moving note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== FAVORITES ENDPOINT ====================

@app.put("/api/toggle_favorite")
def toggle_favorite(data: NoteFavorite, db: Session = Depends(get_db)):
    """Toggle favorite status of a note"""
    try:
        note = db.query(models.Note).filter(
            models.Note.id == data.note_id
        ).first()
        
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        note.is_favorite = data.is_favorite
        note.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "message": "Favorite status updated",
            "note_id": note.id,
            "is_favorite": note.is_favorite,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error toggling favorite: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get_favorite_notes")
def get_favorite_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all favorite notes (excluding deleted)"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            models.Note.is_favorite == True,
            models.Note.is_deleted == False  # ✅ Exclude deleted notes
        ).order_by(models.Note.updated_at.desc()).all()
        
        return {
            "favorites": [
                {
                    "id": note.id,
                    "title": note.title,
                    "content": note.content,
                    "created_at": note.created_at.isoformat(),
                    "updated_at": note.updated_at.isoformat()
                }
                for note in notes
            ]
        }
    except Exception as e:
        logger.error(f"Error getting favorites: {str(e)}")
        return {"favorites": []}
        
        
                        # ==================== TRASH/RECYCLE BIN ====================


@app.put("/api/restore_note/{note_id}")
def restore_note(note_id: int, db: Session = Depends(get_db)):
    """Restore note from trash"""
    try:
        note = db.query(models.Note).filter(
            models.Note.id == note_id
        ).first()
        
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        note.is_deleted = False
        note.deleted_at = None
        note.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "message": "Note restored successfully",
            "note_id": note.id,
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error restoring note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/permanent_delete_note/{note_id}")
def permanent_delete_note(note_id: int, db: Session = Depends(get_db)):
    """Permanently delete a note"""
    try:
        note = db.query(models.Note).filter(
            models.Note.id == note_id
        ).first()
        
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        db.delete(note)
        db.commit()
        
        return {
            "message": "Note permanently deleted",
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error permanently deleting note: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI WRITING ASSISTANT ====================

@app.post("/api/ai_writing_assistant/")
async def ai_writing_assistant(
    request: AIWritingAssistRequest,
    db: Session = Depends(get_db)
):
    """AI Writing Assistant - multiple actions"""
    try:
        user = get_user_by_username(db, request.user_id) or get_user_by_email(db, request.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_profile = build_user_profile_dict(user)
        
        # Build prompt based on action
        prompts = {
            "continue": f"Continue writing this text naturally:\n\n{request.content}\n\nContinue from where it left off:",
            "improve": f"Improve and enhance this text while keeping the same meaning:\n\n{request.content}\n\nImproved version:",
            "simplify": f"Simplify this text to make it easier to understand:\n\n{request.content}\n\nSimplified version:",
            "expand": f"Expand this text with more details and examples:\n\n{request.content}\n\nExpanded version:",
            "tone_change": f"Rewrite this text in a {request.tone} tone:\n\n{request.content}\n\nRewritten version:",
            "grammar": f"Fix grammar and spelling errors in this text:\n\n{request.content}\n\nCorrected version:",
            "summarize": f"Summarize this text concisely:\n\n{request.content}\n\nSummary:"
        }
        
        prompt = prompts.get(request.action, prompts["improve"])
        
        # Call Groq AI
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": f"You are a helpful writing assistant for {user_profile.get('first_name', 'the user')}."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048,
            top_p=0.9,
        )
        
        result = chat_completion.choices[0].message.content
        
        return {
            "status": "success",
            "action": request.action,
            "result": result,
            "model_used": GROQ_MODEL
        }
        
    except Exception as e:
        logger.error(f"AI writing assistant error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI assistant failed: {str(e)}")


# ==================== UPDATE GET_NOTES TO INCLUDE NEW FIELDS ====================



@app.post("/api/generate_chat_summary")
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





@app.get("/api/get_enhanced_user_stats")
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

@app.get("/api/get_activity_heatmap")
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

@app.get("/api/get_recent_activities")
def get_recent_activities(user_id: str = Query(...), limit: int = Query(5), db: Session = Depends(get_db)):
    return []

@app.get("/api/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"weekly_data": [0,0,0,0,0,0,0], "total_sessions": 0, "average_per_day": 0}

@app.get("/api/get_weekly_progress")
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


@app.get("/api/get_learning_analytics")
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
@app.post("/api/firebase-auth")
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
@app.get("/api/check_profile_quiz")
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

@app.post("/api/start_session")
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

@app.post("/api/end_session")
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


@app.get("/api/conversation_starters")
def get_conversation_starters(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"suggestions": ["What would you like to learn today?"]}

@app.get("/api/get_learning_reviews")
def get_learning_reviews(user_id: str = Query(...), db: Session = Depends(get_db)):
    return {"reviews": []}



@app.post("/api/create_learning_review")
async def create_learning_review(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        chat_session_ids = payload.get("chat_session_ids", [])
        slide_ids = payload.get("slide_ids", [])
        review_title = payload.get("review_title", "Learning Review")
        review_type = payload.get("review_type", "comprehensive")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not chat_session_ids and not slide_ids:
            raise HTTPException(status_code=400, detail="At least one source required")

        session_titles = []
        slide_filenames = []
        combined_text = ""

        if chat_session_ids:
            sessions = db.query(models.ChatSession).filter(
                models.ChatSession.id.in_(chat_session_ids),
                models.ChatSession.user_id == user.id
            ).all()

            if sessions:
                session_titles = [s.title for s in sessions]
                session_ids = [s.id for s in sessions]

                messages = db.query(models.ChatMessage).filter(
                    models.ChatMessage.chat_session_id.in_(session_ids)
                ).order_by(models.ChatMessage.timestamp.asc()).all()

                for msg in messages:
                    combined_text += f"Q: {msg.user_message}\nA: {msg.ai_response}\n\n"

        if slide_ids:
            slides = db.query(models.UploadedSlide).filter(
                models.UploadedSlide.id.in_(slide_ids),
                models.UploadedSlide.user_id == user.id
            ).all()

            if slides:
                slide_filenames = [s.original_filename for s in slides]
                
                for slide in slides:
                    if slide.extracted_text:
                        combined_text += f"\n\nSlide: {slide.original_filename}\n{slide.extracted_text}\n"

        combined_text = combined_text[:8000]

        prompt = f"""
        You are an intelligent learning assistant.
        Extract 8-12 key learning points from the following content.
        Return them strictly as a JSON list: ["Point 1", "Point 2", ...].

        Content:
        {combined_text}
        """

        user_profile = build_user_profile_dict(user)
        ai_response = await generate_ai_response(prompt, user_profile)
        
        try:
            json_match = re.search(r"\[.*\]", ai_response, re.DOTALL)
            if json_match:
                learning_points = json.loads(json_match.group())
            else:
                learning_points = ["Key concepts covered", "Important principles", "Main ideas"]
        except:
            learning_points = ["Key ideas extracted", "More points will appear after review"]

        review = models.LearningReview(
            user_id=user.id,
            title=review_title,
            source_sessions=json.dumps(chat_session_ids) if chat_session_ids else None,
            source_slides=json.dumps(slide_ids) if slide_ids else None,
            source_content=combined_text[:4000],
            expected_points=json.dumps(learning_points),
            review_type=review_type,
            total_points=len(learning_points),
            best_score=0.0,
            current_attempt=0,
            attempt_count=0,
            status="active",
            created_at=datetime.now(timezone.utc)
        )

        db.add(review)
        db.commit()
        db.refresh(review)

        return {
            "status": "success",
            "review_id": review.id,
            "id": review.id,
            "title": review.title,
            "session_titles": session_titles,
            "slide_filenames": slide_filenames,
            "learning_points": learning_points,
            "total_points": len(learning_points)
        }

    except Exception as e:
        logger.error(f"Error creating review: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create learning review: {str(e)}")


@app.get("/api/get_learning_reviews")
def get_learning_reviews(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        reviews = db.query(models.LearningReview).filter(
            models.LearningReview.user_id == user.id
        ).order_by(models.LearningReview.created_at.desc()).all()

        result = []
        for review in reviews:
            session_titles = []
            slide_filenames = []
            
            try:
                if review.source_sessions:
                    session_ids = json.loads(review.source_sessions)
                    sessions = db.query(models.ChatSession).filter(
                        models.ChatSession.id.in_(session_ids)
                    ).all()
                    session_titles = [s.title for s in sessions]
            except:
                pass
            
            try:
                if review.source_slides:
                    slide_ids = json.loads(review.source_slides)
                    slides = db.query(models.UploadedSlide).filter(
                        models.UploadedSlide.id.in_(slide_ids)
                    ).all()
                    slide_filenames = [s.original_filename for s in slides]
            except:
                pass

            result.append({
                "id": review.id,
                "title": review.title,
                "status": review.status,
                "total_points": review.total_points,
                "best_score": round(review.best_score, 1),
                "attempt_count": review.attempt_count,
                "current_attempt": review.current_attempt,
                "session_titles": session_titles,
                "slide_filenames": slide_filenames,
                "created_at": review.created_at.isoformat(),
                "updated_at": review.updated_at.isoformat(),
                "completed_at": review.completed_at.isoformat() if review.completed_at else None,
                "can_continue": review.status == "active" and review.current_attempt < 5
            })

        return {"reviews": result}

    except Exception as e:
        logger.error(f"Error getting learning reviews: {str(e)}")
        return {"reviews": []}


UPLOAD_DIR = Path("uploads/slides")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.post("/api/upload_slides")
async def upload_slides(
    user_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        uploaded_slides = []
        
        for file in files:
            if not file.filename.lower().endswith(('.pdf', '.ppt', '.pptx')):
                continue
            
            file_content = await file.read()
            file_size = len(file_content)
            
            timestamp = int(datetime.now(timezone.utc).timestamp())
            safe_filename = f"{user.id}_{timestamp}_{file.filename}"
            file_path = UPLOAD_DIR / safe_filename
            
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            page_count = 0
            extracted_text = ""
            
            if file.filename.lower().endswith('.pdf'):
                try:
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                    page_count = len(pdf_reader.pages)
                    
                    for page in pdf_reader.pages[:10]:
                        extracted_text += page.extract_text() + "\n"
                    
                    extracted_text = extracted_text[:10000]
                except Exception as e:
                    logger.error(f"Error extracting PDF text: {str(e)}")
            
            slide = models.UploadedSlide(
                user_id=user.id,
                filename=safe_filename,
                original_filename=file.filename,
                file_path=str(file_path),
                file_size=file_size,
                file_type=file.content_type or "application/pdf",
                page_count=page_count,
                extracted_text=extracted_text,
                processing_status="completed",
                uploaded_at=datetime.now(timezone.utc),
                processed_at=datetime.now(timezone.utc)
            )
            
            db.add(slide)
            uploaded_slides.append(slide)
        
        db.commit()
        
        return {
            "status": "success",
            "uploaded_count": len(uploaded_slides),
            "message": f"Successfully uploaded {len(uploaded_slides)} slide(s)"
        }
        
    except Exception as e:
        logger.error(f"Error uploading slides: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to upload slides: {str(e)}")


@app.get("/api/get_uploaded_slides")
def get_uploaded_slides(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        slides = db.query(models.UploadedSlide).filter(
            models.UploadedSlide.user_id == user.id
        ).order_by(models.UploadedSlide.uploaded_at.desc()).all()
        
        return {
            "slides": [
                {
                    "id": slide.id,
                    "filename": slide.original_filename,
                    "file_size": slide.file_size,
                    "file_type": slide.file_type,
                    "page_count": slide.page_count,
                    "uploaded_at": slide.uploaded_at.isoformat(),
                    "preview_url": slide.preview_url,
                    "processing_status": slide.processing_status
                }
                for slide in slides
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting slides: {str(e)}")
        return {"slides": []}


@app.delete("/api/delete_slide/{slide_id}")
def delete_slide(slide_id: int, db: Session = Depends(get_db)):
    try:
        slide = db.query(models.UploadedSlide).filter(
            models.UploadedSlide.id == slide_id
        ).first()
        
        if not slide:
            raise HTTPException(status_code=404, detail="Slide not found")
        
        if Path(slide.file_path).exists():
            Path(slide.file_path).unlink()
        
        db.delete(slide)
        db.commit()
        
        return {
            "status": "success",
            "message": "Slide deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting slide: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_questions")
async def generate_questions(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        chat_session_ids = payload.get("chat_session_ids", [])
        slide_ids = payload.get("slide_ids", [])
        question_count = payload.get("question_count", 10)
        difficulty_mix = payload.get("difficulty_mix", {"easy": 3, "medium": 5, "hard": 2})
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if not chat_session_ids and not slide_ids:
            raise HTTPException(status_code=400, detail="At least one source required")
        
        source_content = ""
        
        if chat_session_ids:
            sessions = db.query(models.ChatSession).filter(
                models.ChatSession.id.in_(chat_session_ids),
                models.ChatSession.user_id == user.id
            ).all()
            
            for session in sessions:
                messages = db.query(models.ChatMessage).filter(
                    models.ChatMessage.chat_session_id == session.id
                ).limit(20).all()
                
                for msg in messages:
                    source_content += f"Q: {msg.user_message}\nA: {msg.ai_response}\n\n"
        
        if slide_ids:
            slides = db.query(models.UploadedSlide).filter(
                models.UploadedSlide.id.in_(slide_ids),
                models.UploadedSlide.user_id == user.id
            ).all()
            
            for slide in slides:
                if slide.extracted_text:
                    source_content += f"\n\nSlide: {slide.original_filename}\n{slide.extracted_text[:2000]}\n"
        
        source_content = source_content[:6000]
        
        user_profile = build_user_profile_dict(user)
        
        prompt = f"""Generate {question_count} educational questions based on this content.

**DIFFICULTY DISTRIBUTION**:
- Easy: {difficulty_mix.get('easy', 3)} questions
- Medium: {difficulty_mix.get('medium', 5)} questions  
- Hard: {difficulty_mix.get('hard', 2)} questions

**QUESTION TYPES**: Mix of multiple choice, true/false, and short answer

**SOURCE CONTENT**:
{source_content}

**OUTPUT FORMAT** (JSON array only):
[
  {{
    "question_text": "Question here?",
    "question_type": "multiple_choice|true_false|short_answer",
    "correct_answer": "Correct answer",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "difficulty": "easy|medium|hard",
    "explanation": "Why this is correct",
    "topic": "Topic name"
  }}
]

Generate exactly {question_count} questions:"""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert question generator. Return only valid JSON array."},
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=3000,
        )
        
        response_text = chat_completion.choices[0].message.content
        
        try:
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON array found")
        except Exception as e:
            logger.error(f"Failed to parse questions: {str(e)}")
            questions_data = []
        
        question_set = models.QuestionSet(
            user_id=user.id,
            title=f"Questions - {datetime.now().strftime('%Y-%m-%d')}",
            description="Auto-generated questions",
            source_type="mixed" if (chat_session_ids and slide_ids) else ("chat" if chat_session_ids else "slides"),
            source_chat_sessions=json.dumps(chat_session_ids) if chat_session_ids else None,
            source_slides=json.dumps(slide_ids) if slide_ids else None,
            question_count=len(questions_data),
            easy_count=difficulty_mix.get('easy', 0),
            medium_count=difficulty_mix.get('medium', 0),
            hard_count=difficulty_mix.get('hard', 0),
            status="active"
        )
        
        db.add(question_set)
        db.commit()
        db.refresh(question_set)
        
        for idx, q_data in enumerate(questions_data):
            question = models.Question(
                question_set_id=question_set.id,
                question_text=q_data.get("question_text", ""),
                question_type=q_data.get("question_type", "multiple_choice"),
                correct_answer=q_data.get("correct_answer", ""),
                options=json.dumps(q_data.get("options", [])) if q_data.get("options") else None,
                difficulty=q_data.get("difficulty", "medium"),
                explanation=q_data.get("explanation", ""),
                topic=q_data.get("topic", "General"),
                order_index=idx
            )
            db.add(question)
        
        db.commit()
        db.refresh(question_set)
        
        questions = db.query(models.Question).filter(
            models.Question.question_set_id == question_set.id
        ).order_by(models.Question.order_index).all()
        
        return {
            "status": "success",
            "question_set_id": question_set.id,
            "id": question_set.id,
            "title": question_set.title,
            "question_count": len(questions),
            "questions": [
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "difficulty": q.difficulty,
                    "options": json.loads(q.options) if q.options else []
                }
                for q in questions
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating questions: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")


@app.get("/api/get_question_sets")
def get_question_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user.id
        ).order_by(models.QuestionSet.created_at.desc()).all()
        
        return {
            "question_sets": [
                {
                    "id": qs.id,
                    "title": qs.title,
                    "description": qs.description,
                    "question_count": qs.question_count,
                    "easy_count": qs.easy_count,
                    "medium_count": qs.medium_count,
                    "hard_count": qs.hard_count,
                    "best_score": round(qs.best_score, 1),
                    "attempt_count": qs.attempt_count,
                    "status": qs.status,
                    "can_practice": True,
                    "created_at": qs.created_at.isoformat()
                }
                for qs in question_sets
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting question sets: {str(e)}")
        return {"question_sets": []}
@app.delete("/api/delete_question_set/{question_set_id}")
def delete_question_set(
    question_set_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        question_set = db.query(models.QuestionSet).filter(
            models.QuestionSet.id == question_set_id,
            models.QuestionSet.user_id == current_user.id
        ).first()
        
        if not question_set:
            raise HTTPException(status_code=404, detail="Question set not found")
        
        db.query(models.QuestionResult).filter(
            models.QuestionResult.question_id.in_(
                db.query(models.Question.id).filter(
                    models.Question.question_set_id == question_set_id
                )
            )
        ).delete(synchronize_session=False)
        
        db.query(models.QuestionAttempt).filter(
            models.QuestionAttempt.question_set_id == question_set_id
        ).delete()
        
        db.query(models.Question).filter(
            models.Question.question_set_id == question_set_id
        ).delete()
        
        db.delete(question_set)
        db.commit()
        
        return {
            "status": "success",
            "message": "Question set deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting question set: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete question set: {str(e)}")
        
@app.post("/api/submit_question_answers")
async def submit_question_answers(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        question_set_id = payload.get("question_set_id")
        answers = payload.get("answers", {})
        
        question_set = db.query(models.QuestionSet).filter(
            models.QuestionSet.id == question_set_id
        ).first()
        
        if not question_set:
            raise HTTPException(status_code=404, detail="Question set not found")
        
        questions = db.query(models.Question).filter(
            models.Question.question_set_id == question_set_id
        ).all()
        
        correct_count = 0
        incorrect_count = 0
        question_results = []
        
        for question in questions:
            # ✅ CRITICAL FIX: Check if question was answered at all
            question_id_str = str(question.id)
            
            # If question ID not in answers dict at all = unanswered
            if question_id_str not in answers:
                is_correct = False
                display_answer = "No answer provided"
            else:
                # Question ID exists in answers, get the value
                user_answer = answers[question_id_str]
                
                # Check if the answer is None or empty string
                if user_answer is None or (isinstance(user_answer, str) and user_answer.strip() == ""):
                    is_correct = False
                    display_answer = "No answer provided"
                else:
                    # Valid answer provided - now check if it's correct
                    display_answer = user_answer
                    
                    if question.question_type == "multiple_choice":
                        is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()
                    elif question.question_type == "true_false":
                        is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()
                    else:  # short_answer
                        is_correct = user_answer.strip().lower() in question.correct_answer.strip().lower()
            
            # Count the result
            if is_correct:
                correct_count += 1
            else:
                incorrect_count += 1
            
            question_results.append({
                "question_id": question.id,
                "question_text": question.question_text,
                "user_answer": display_answer,
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "explanation": question.explanation
            })
        
        score = (correct_count / len(questions) * 100) if questions else 0
        
        attempt = models.QuestionAttempt(
            question_set_id=question_set_id,
            user_id=question_set.user_id,
            attempt_number=question_set.attempt_count + 1,
            answers=json.dumps(answers),
            score=score,
            correct_count=correct_count,
            incorrect_count=incorrect_count,
            total_questions=len(questions),
            submitted_at=datetime.now(timezone.utc)
        )
        
        db.add(attempt)
        
        question_set.attempt_count += 1
        if score > question_set.best_score:
            question_set.best_score = score
        
        db.commit()
        
        return {
            "status": "success",
            "score": round(score, 1),
            "correct_count": correct_count,
            "incorrect_count": incorrect_count,
            "total_questions": len(questions),
            "question_results": question_results,
            "feedback": f"You scored {round(score, 1)}%! {'Excellent work!' if score >= 80 else 'Keep practicing!'}"
        }
        
    except Exception as e:
        logger.error(f"Error submitting answers: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/update_learning_review")
async def update_learning_review(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        review_id = payload.get("review_id")
        slide_ids = payload.get("slide_ids", [])
        
        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()
        
        if not review:
            raise HTTPException(status_code=404, detail="Review not found")
        
        if slide_ids:
            slides = db.query(models.UploadedSlide).filter(
                models.UploadedSlide.id.in_(slide_ids)
            ).all()
            
            slide_content = ""
            for slide in slides:
                if slide.extracted_text:
                    slide_content += f"\n{slide.extracted_text[:1000]}\n"
            
            current_content = review.source_content or ""
            review.source_content = (current_content + "\n" + slide_content)[:8000]
            
            for slide_id in slide_ids:
                link = models.LearningReviewSlide(
                    review_id=review_id,
                    slide_id=slide_id
                )
                db.add(link)
        
        review.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "status": "success",
            "message": "Review updated with slides"
        }
        
    except Exception as e:
        logger.error(f"Error updating review: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get_question_set_details/{question_set_id}")
def get_question_set_details(question_set_id: int, db: Session = Depends(get_db)):
    try:
        question_set = db.query(models.QuestionSet).filter(
            models.QuestionSet.id == question_set_id
        ).first()
        
        if not question_set:
            raise HTTPException(status_code=404, detail="Question set not found")
        
        questions = db.query(models.Question).filter(
            models.Question.question_set_id == question_set_id
        ).order_by(models.Question.order_index).all()
        
        return {
            "id": question_set.id,
            "title": question_set.title,
            "description": question_set.description,
            "question_count": len(questions),
            "status": question_set.status,
            "questions": [
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "correct_answer": q.correct_answer,
                    "options": json.loads(q.options) if q.options else [],
                    "difficulty": q.difficulty,
                    "explanation": q.explanation,
                    "topic": q.topic
                }
                for q in questions
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting question set details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/submit_learning_response")
async def submit_learning_response(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Submit and evaluate a learning review response
    """
    try:
        review_id = payload.get("review_id")
        user_response = payload.get("user_response", "")
        attempt_number = payload.get("attempt_number", 1)

        if not review_id or not user_response.strip():
            raise HTTPException(status_code=400, detail="Review ID and response are required")

        # Get the learning review
        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()

        if not review:
            raise HTTPException(status_code=404, detail="Learning review not found")

        # Parse expected learning points
        try:
            expected_points = json.loads(review.expected_points)
        except:
            expected_points = []

        if not expected_points:
            raise HTTPException(status_code=400, detail="No learning points found in review")

        # Get user profile for personalized feedback
        user = db.query(models.User).filter(models.User.id == review.user_id).first()
        user_profile = build_user_profile_dict(user)

        # ==================== EVALUATION PROMPT ====================
        evaluation_prompt = f"""You are an expert educational evaluator assessing a student's learning retention.

**TASK**: Compare the student's response to the expected learning points and determine:
1. Which points the student covered (even if worded differently)
2. Which points the student missed completely

**EXPECTED LEARNING POINTS**:
{chr(10).join([f"{i+1}. {point}" for i, point in enumerate(expected_points)])}

**STUDENT'S RESPONSE**:
{user_response}

**EVALUATION RULES**:
1. A point is "covered" if the student demonstrates understanding of the concept, even with different wording
2. Look for semantic similarity, not exact word matches
3. Partial explanations count if they show comprehension
4. Be fair but thorough - don't mark something covered if it's clearly missing

**OUTPUT FORMAT** (JSON only, no other text):
{{
  "covered_points": ["Exact text of covered points from the expected list"],
  "missing_points": ["Exact text of missing points from the expected list"],
  "coverage_percentage": <number between 0-100>,
  "understanding_quality": "<poor|fair|good|excellent>",
  "feedback": "Brief constructive feedback on what was done well and what needs improvement",
  "next_steps": "Specific actionable advice for improvement"
}}

Generate evaluation now:"""

        # Call Groq AI for evaluation
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system", 
                    "content": "You are an expert educational evaluator. Return only valid JSON."
                },
                {
                    "role": "user", 
                    "content": evaluation_prompt
                }
            ],
            model=GROQ_MODEL,
            temperature=0.3,  # Lower temperature for more consistent evaluation
            max_tokens=2048,
        )

        response_text = chat_completion.choices[0].message.content

        # Parse AI evaluation response
        try:
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                evaluation = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found in response")
        except Exception as e:
            logger.error(f"Failed to parse evaluation JSON: {str(e)}")
            logger.error(f"Raw response: {response_text}")
            
            # Fallback evaluation if JSON parsing fails
            evaluation = {
                "covered_points": [],
                "missing_points": expected_points,
                "coverage_percentage": 0,
                "understanding_quality": "fair",
                "feedback": "Unable to properly evaluate your response. Please try again with more detail.",
                "next_steps": "Write a more comprehensive response covering all key concepts."
            }

        covered_points = evaluation.get("covered_points", [])
        missing_points = evaluation.get("missing_points", [])
        coverage_percentage = evaluation.get("coverage_percentage", 0)
        understanding_quality = evaluation.get("understanding_quality", "fair")
        feedback = evaluation.get("feedback", "")
        next_steps = evaluation.get("next_steps", "")

        # ==================== SAVE ATTEMPT ====================
        attempt = models.LearningReviewAttempt(
            review_id=review.id,
            attempt_number=attempt_number,
            user_response=user_response,
            covered_points=json.dumps(covered_points),
            missing_points=json.dumps(missing_points),
            completeness_percentage=coverage_percentage,
            feedback=feedback,
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(attempt)

        # Update review record
        review.current_attempt = attempt_number
        review.attempt_count = max(review.attempt_count, attempt_number)
        
        if coverage_percentage > review.best_score:
            review.best_score = coverage_percentage

        # Check if review is complete (>= 80% coverage or 3+ attempts)
        is_complete = coverage_percentage >= 80.0 or attempt_number >= 3
        
        if is_complete and coverage_percentage >= 80.0:
            review.status = "completed"
            review.completed_at = datetime.now(timezone.utc)
        
        review.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(attempt)

        # ==================== RETURN RESULTS ====================
        return {
            "status": "success",
            "attempt_id": attempt.id,
            "attempt_number": attempt_number,
            "covered_points": covered_points,
            "missing_points": missing_points,
            "completeness_percentage": round(coverage_percentage, 1),
            "understanding_quality": understanding_quality,
            "feedback": feedback,
            "next_steps": next_steps,
            "is_complete": is_complete,
            "can_continue": not is_complete and attempt_number < 5,
            "best_score": review.best_score,
            "points_covered_count": len(covered_points),
            "points_missing_count": len(missing_points),
            "total_points": len(expected_points)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting learning response: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to evaluate learning response: {str(e)}"
        )
#=====================Nodes endpoint=====================

# ==================== KNOWLEDGE ROADMAP SYSTEM ====================

@app.post("/api/create_knowledge_roadmap")
async def create_knowledge_roadmap(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Create a new knowledge roadmap with ONLY root topic (no initial subtopics)
    """
    try:
        user_id = payload.get("user_id")
        root_topic = payload.get("root_topic")
        
        if not user_id or not root_topic:
            raise HTTPException(status_code=400, detail="user_id and root_topic required")
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create ONLY root node (no AI generation yet)
        root_node = models.KnowledgeNode(
            user_id=user.id,
            parent_node_id=None,
            topic_name=root_topic,
            description=f"Explore {root_topic} - Click 'Explore' to learn or 'Expand' to see subtopics",
            depth_level=0,
            ai_explanation=None,  # Will be generated on explore
            key_concepts=None,
            generated_subtopics=None,
            is_explored=False,
            exploration_count=0,
            expansion_status="unexpanded",  # Not expanded initially
            position_x=0.0,
            position_y=0.0
        )
        
        db.add(root_node)
        db.flush()
        
        # Create roadmap
        roadmap = models.KnowledgeRoadmap(
            user_id=user.id,
            title=f"Exploring {root_topic}",
            root_topic=root_topic,
            root_node_id=root_node.id,
            total_nodes=1,  # Only root node
            max_depth_reached=0,
            status="active",
            last_accessed=datetime.now(timezone.utc)
        )
        
        db.add(roadmap)
        db.commit()
        db.refresh(roadmap)
        db.refresh(root_node)
        
        return {
            "status": "success",
            "roadmap_id": roadmap.id,
            "root_node_id": root_node.id,
            "root_node": {
                "id": root_node.id,
                "topic_name": root_node.topic_name,
                "description": root_node.description,
                "depth_level": root_node.depth_level,
                "ai_explanation": root_node.ai_explanation,
                "key_concepts": json.loads(root_node.key_concepts) if root_node.key_concepts else [],
                "is_explored": root_node.is_explored,
                "expansion_status": root_node.expansion_status,
                "position": {"x": root_node.position_x, "y": root_node.position_y}
            },
            "child_nodes": [],  # No children initially
            "total_nodes": roadmap.total_nodes
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating roadmap: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create roadmap: {str(e)}")


@app.post("/api/expand_knowledge_node/{node_id}")
async def expand_knowledge_node(
    node_id: int,
    db: Session = Depends(get_db)
):
    """
    Expand a node by generating 4-5 subtopics (DOES NOT generate explanations)
    """
    try:
        node = db.query(models.KnowledgeNode).filter(
            models.KnowledgeNode.id == node_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check if already expanded to avoid duplicate work
        if node.expansion_status == "expanded":
            children = db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.parent_node_id == node_id
            ).all()
            
            return {
                "status": "success",
                "message": "Node already expanded",
                "child_nodes": [
                    {
                        "id": child.id,
                        "parent_id": child.parent_node_id,
                        "topic_name": child.topic_name,
                        "description": child.description,
                        "depth_level": child.depth_level,
                        "is_explored": child.is_explored,
                        "expansion_status": child.expansion_status,
                        "position": {"x": child.position_x, "y": child.position_y}
                    }
                    for child in children
                ]
            }
        
        # Update expansion status immediately to prevent duplicate requests
        node.expansion_status = "expanding"
        db.commit()
        
        # Get user for personalized generation
        user = db.query(models.User).filter(models.User.id == node.user_id).first()
        user_profile = build_user_profile_dict(user)
        
        # Build context from parent nodes
        context_path = []
        current = node
        while current:
            context_path.insert(0, current.topic_name)
            if current.parent_node_id:
                current = db.query(models.KnowledgeNode).filter(
                    models.KnowledgeNode.id == current.parent_node_id
                ).first()
            else:
                current = None
        
        context_str = " → ".join(context_path)
        
        # Generate ONLY subtopics (no explanations)
        expansion_prompt = f"""You are a knowledge exploration assistant.

**TOPIC TO EXPAND**: {node.topic_name}
**CONTEXT PATH**: {context_str}
**CURRENT DEPTH**: {node.depth_level}
**STUDENT LEVEL**: {user_profile.get('difficulty_level', 'intermediate')}

**TASK**: Generate 4-5 specific subtopics that dive deeper into "{node.topic_name}".

**RULES**:
1. Each subtopic should be more specific than the parent
2. Cover different aspects/dimensions of the topic
3. Progress from foundational to advanced concepts
4. Make them concrete and explorable
5. Avoid being too broad or repetitive
6. Give SHORT names (2-5 words max)
7. Give brief one-line descriptions

**OUTPUT FORMAT** (JSON only):
{{
  "subtopics": [
    {{
      "name": "Specific Subtopic Name (SHORT)",
      "description": "One-line description (under 100 chars)",
      "complexity": "beginner|intermediate|advanced"
    }}
  ]
}}

Generate 4-5 subtopics now:"""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert educator. Return only valid JSON with 4-5 subtopics."},
                {"role": "user", "content": expansion_prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.8,
            max_tokens=1000,
        )
        
        response_text = chat_completion.choices[0].message.content
        
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found")
        except Exception as e:
            logger.error(f"Failed to parse expansion JSON: {str(e)}")
            # Fallback subtopics
            ai_data = {
                "subtopics": [
                    {"name": "Fundamentals", "description": "Core concepts and basics", "complexity": "beginner"},
                    {"name": "Key Principles", "description": "Essential rules and theories", "complexity": "intermediate"},
                    {"name": "Applications", "description": "Real-world uses", "complexity": "intermediate"},
                    {"name": "Advanced Topics", "description": "Deep dive into complexity", "complexity": "advanced"}
                ]
            }
        
        # Create child nodes WITHOUT explanations
        subtopics = ai_data.get("subtopics", [])[:5]  # Max 5 subtopics
        child_nodes = []
        
        for idx, subtopic in enumerate(subtopics):
            # Calculate position in a circle around parent
            angle = (idx * (360 / len(subtopics))) * (3.14159 / 180)
            radius = 300 + (node.depth_level * 50)  # Increase radius with depth
            
            child_node = models.KnowledgeNode(
                user_id=node.user_id,
                parent_node_id=node.id,
                topic_name=subtopic.get("name", ""),
                description=subtopic.get("description", ""),
                depth_level=node.depth_level + 1,
                ai_explanation=None,  # NOT generated yet - only on explore
                key_concepts=None,
                generated_subtopics=None,
                is_explored=False,
                exploration_count=0,
                expansion_status="unexpanded",
                position_x=node.position_x + (radius * float(math.cos(angle))),
                position_y=node.position_y + (radius * float(math.sin(angle)))
            )
            db.add(child_node)
            child_nodes.append(child_node)
        
        # Update parent node status to expanded
        node.expansion_status = "expanded"
        node.generated_subtopics = json.dumps(subtopics)
        
        # Update roadmap stats
        roadmap = db.query(models.KnowledgeRoadmap).filter(
            models.KnowledgeRoadmap.user_id == node.user_id
        ).order_by(models.KnowledgeRoadmap.created_at.desc()).first()
        
        if roadmap:
            roadmap.total_nodes += len(child_nodes)
            roadmap.max_depth_reached = max(roadmap.max_depth_reached, node.depth_level + 1)
            roadmap.last_accessed = datetime.now(timezone.utc)
        
        db.commit()
        
        for child in child_nodes:
            db.refresh(child)
        
        return {
            "status": "success",
            "message": f"Expanded {node.topic_name} with {len(child_nodes)} subtopics",
            "child_nodes": [
                {
                    "id": child.id,
                    "parent_id": child.parent_node_id,
                    "topic_name": child.topic_name,
                    "description": child.description,
                    "depth_level": child.depth_level,
                    "is_explored": child.is_explored,
                    "expansion_status": child.expansion_status,
                    "position": {"x": child.position_x, "y": child.position_y}
                }
                for child in child_nodes
            ]
        }
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error expanding node: {str(e)}", exc_info=True)
        # Reset expansion status on error
        if node:
            node.expansion_status = "unexpanded"
            db.commit()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to expand node: {str(e)}")

@app.post("/api/explore_node/{node_id}")
async def explore_node(
    node_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate AI explanation for a node (DOES NOT expand or create children)
    """
    try:
        node = db.query(models.KnowledgeNode).filter(
            models.KnowledgeNode.id == node_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # If already has explanation, just return it
        if node.ai_explanation and node.key_concepts:
            node.exploration_count += 1
            node.last_explored = datetime.now(timezone.utc)
            db.commit()
            db.refresh(node)
            
            return {
                "status": "already_generated",
                "node": {
                    "id": node.id,
                    "topic_name": node.topic_name,
                    "ai_explanation": node.ai_explanation,
                    "key_concepts": json.loads(node.key_concepts) if node.key_concepts else [],
                    "is_explored": node.is_explored,
                    "exploration_count": node.exploration_count
                }
            }
        
        # Generate explanation
        user = db.query(models.User).filter(models.User.id == node.user_id).first()
        user_profile = build_user_profile_dict(user)
        
        # Build context
        context_path = []
        current = node.parent_node_id
        while current:
            parent = db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.id == current
            ).first()
            if parent:
                context_path.insert(0, parent.topic_name)
                current = parent.parent_node_id
            else:
                current = None
        
        context_str = " → ".join(context_path) if context_path else "Root level"
        
        explanation_prompt = f"""You are an expert educator helping {user_profile.get('first_name', 'a student')}.

**TOPIC**: {node.topic_name}
**CONTEXT PATH**: {context_str}
**DEPTH LEVEL**: {node.depth_level}
**STUDENT LEVEL**: {user_profile.get('difficulty_level', 'intermediate')}

**TASK**: Create a comprehensive yet digestible explanation of "{node.topic_name}".

**OUTPUT FORMAT** (JSON only):
{{
  "explanation": "Clear, engaging explanation (250-400 words) with examples and analogies",
  "key_concepts": ["Key Concept 1", "Key Concept 2", "Key Concept 3", "Key Concept 4", "Key Concept 5"],
  "why_important": "Why this topic matters (2-3 sentences)",
  "real_world_examples": ["Real example 1 with context", "Real example 2 with context"],
  "learning_tips": "Practical advice for mastering this topic"
}}

Generate now:"""

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an expert educator. Return only valid JSON with detailed explanations."},
                {"role": "user", "content": explanation_prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048,
        )
        
        response_text = chat_completion.choices[0].message.content
        
        try:
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
            else:
                raise ValueError("No JSON found")
        except Exception as e:
            logger.error(f"Failed to parse explanation JSON: {str(e)}")
            ai_data = {
                "explanation": f"An exploration of {node.topic_name}. This topic involves understanding the fundamental concepts and their applications.",
                "key_concepts": ["Core principles", "Key theories", "Practical applications", "Related fields", "Future directions"],
                "why_important": "Understanding this topic is essential for building a strong foundation in this domain.",
                "real_world_examples": ["Used in various industries", "Applied in research and development"],
                "learning_tips": "Practice regularly, connect concepts to real-world scenarios, and explore related topics."
            }
        
        # Update node with explanation (mark as explored)
        node.ai_explanation = ai_data.get("explanation", "")
        node.key_concepts = json.dumps(ai_data.get("key_concepts", []))
        node.is_explored = True
        node.exploration_count += 1
        node.last_explored = datetime.now(timezone.utc)
        
        # Create exploration history record
        history = models.NodeExplorationHistory(
            node_id=node.id,
            user_id=node.user_id,
            exploration_duration=0,
            explored_at=datetime.now(timezone.utc)
        )
        db.add(history)
        
        db.commit()
        db.refresh(node)
        
        return {
            "status": "success",
            "node": {
                "id": node.id,
                "topic_name": node.topic_name,
                "description": node.description,
                "ai_explanation": node.ai_explanation,
                "key_concepts": json.loads(node.key_concepts) if node.key_concepts else [],
                "why_important": ai_data.get("why_important", ""),
                "real_world_examples": ai_data.get("real_world_examples", []),
                "learning_tips": ai_data.get("learning_tips", ""),
                "is_explored": node.is_explored,
                "exploration_count": node.exploration_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exploring node: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to explore node: {str(e)}")

@app.get("/api/get_knowledge_roadmap/{roadmap_id}")
async def get_knowledge_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db)
):
    """
    Get complete roadmap structure with all nodes
    """
    try:
        roadmap = db.query(models.KnowledgeRoadmap).filter(
            models.KnowledgeRoadmap.id == roadmap_id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Get root node
        root_node = db.query(models.KnowledgeNode).filter(
            models.KnowledgeNode.id == roadmap.root_node_id
        ).first()
        
        # Get flat list of all nodes in this roadmap tree
        roadmap_node_ids = set()
        
        def collect_node_ids(node_id):
            roadmap_node_ids.add(node_id)
            children = db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.parent_node_id == node_id
            ).all()
            for child in children:
                collect_node_ids(child.id)
        
        if root_node:
            collect_node_ids(root_node.id)
        
        all_nodes = db.query(models.KnowledgeNode).filter(
            models.KnowledgeNode.id.in_(roadmap_node_ids)
        ).all()
        
        # Create a map of nodes for easier lookup
        node_map = {node.id: node for node in all_nodes}
        
        # Build the expansion hierarchy
        def build_expansion_hierarchy(node_id, expanded_nodes, path=[]):
            node = node_map.get(node_id)
            if not node:
                return
                
            # Add this node to the path
            current_path = path + [node_id]
            
            # If this node is expanded, add it to the expanded nodes set
            if node.expansion_status == 'expanded':
                expanded_nodes.add(node_id)
                
                # Recursively add all children of expanded nodes
                children = db.query(models.KnowledgeNode).filter(
                    models.KnowledgeNode.parent_node_id == node_id
                ).all()
                for child in children:
                    build_expansion_hierarchy(child.id, expanded_nodes, current_path)
        
        # Get all expanded nodes
        expanded_nodes = set()
        if root_node:
            build_expansion_hierarchy(root_node.id, expanded_nodes)
        
        nodes_flat = [
            {
                "id": node.id,
                "parent_id": node.parent_node_id,
                "topic_name": node.topic_name,
                "description": node.description,
                "depth_level": node.depth_level,
                "ai_explanation": node.ai_explanation,
                "key_concepts": json.loads(node.key_concepts) if node.key_concepts else [],
                "is_explored": node.is_explored,
                "exploration_count": node.exploration_count,
                "expansion_status": node.expansion_status,
                "user_notes": node.user_notes,
                "position": {"x": node.position_x, "y": node.position_y},
                "created_at": node.created_at.isoformat()
            }
            for node in all_nodes
        ]
        
        return {
            "roadmap": {
                "id": roadmap.id,
                "title": roadmap.title,
                "root_topic": roadmap.root_topic,
                "total_nodes": roadmap.total_nodes,
                "max_depth_reached": roadmap.max_depth_reached,
                "status": roadmap.status,
                "created_at": roadmap.created_at.isoformat(),
                "last_accessed": roadmap.last_accessed.isoformat() if roadmap.last_accessed else None
            },
            "nodes_flat": nodes_flat,
            "expanded_nodes": list(expanded_nodes)  # Add this to track which nodes should be expanded
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting roadmap: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get roadmap: {str(e)}")

@app.get("/api/get_user_roadmaps")
async def get_user_roadmaps(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get all knowledge roadmaps for a user
    """
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        roadmaps = db.query(models.KnowledgeRoadmap).filter(
            models.KnowledgeRoadmap.user_id == user.id
        ).order_by(models.KnowledgeRoadmap.last_accessed.desc()).all()
        
        roadmap_data = []
        for roadmap in roadmaps:
            # Get root node info
            root_node = db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.id == roadmap.root_node_id
            ).first()
            
            roadmap_data.append({
                "id": roadmap.id,
                "title": roadmap.title,
                "root_topic": roadmap.root_topic,
                "total_nodes": roadmap.total_nodes,
                "max_depth_reached": roadmap.max_depth_reached,
                "status": roadmap.status,
                "created_at": roadmap.created_at.isoformat(),
                "last_accessed": roadmap.last_accessed.isoformat() if roadmap.last_accessed else roadmap.created_at.isoformat()
            })
        
        return {
            "status": "success",
            "roadmaps": roadmap_data
        }
        
    except Exception as e:
        logger.error(f"Error getting user roadmaps: {str(e)}")
        return {
            "status": "error",
            "roadmaps": []
        }
 # ==================== MISSING ENDPOINTS FOR LEARNING REVIEW ====================

@app.get("/api/get_generated_questions")
def get_generated_questions(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all generated question sets for a user"""
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user.id
        ).order_by(models.QuestionSet.created_at.desc()).all()
        
        return {
            "question_sets": [
                {
                    "id": qs.id,
                    "title": qs.title,
                    "question_count": qs.question_count,
                    "created_at": qs.created_at.isoformat(),
                    "status": qs.status,
                    "best_score": round(qs.best_score, 1),
                    "attempt_count": qs.attempt_count
                }
                for qs in question_sets
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting generated questions: {str(e)}")
        return {"question_sets": []}

@app.get("/api/get_question_set/{question_set_id}")
def get_question_set_with_questions(question_set_id: int, db: Session = Depends(get_db)):
    """Get a specific question set with all its questions"""
    try:
        question_set = db.query(models.QuestionSet).filter(
            models.QuestionSet.id == question_set_id
        ).first()
        
        if not question_set:
            raise HTTPException(status_code=404, detail="Question set not found")
        
        questions = db.query(models.Question).filter(
            models.Question.question_set_id == question_set_id
        ).order_by(models.Question.order_index).all()
        
        return {
            "id": question_set.id,
            "title": question_set.title,
            "description": question_set.description,
            "questions": [
                {
                    "id": q.id,
                    "question_text": q.question_text,
                    "question_type": q.question_type,
                    "options": json.loads(q.options) if q.options else [],
                    "difficulty": q.difficulty,
                    "explanation": q.explanation,
                    "topic": q.topic
                }
                for q in questions
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting question set: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/submit_answers")
async def submit_answers(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Submit answers for a question set and get results"""
    try:
        user_id = payload.get("user_id")
        question_set_id = payload.get("question_set_id")
        answers = payload.get("answers", {})
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        question_set = db.query(models.QuestionSet).filter(
            models.QuestionSet.id == question_set_id
        ).first()
        
        if not question_set:
            raise HTTPException(status_code=404, detail="Question set not found")
        
        questions = db.query(models.Question).filter(
            models.Question.question_set_id == question_set_id
        ).all()
        
        results = []
        correct_count = 0
        
        for question in questions:
            user_answer = answers.get(str(question.id), "").strip()
            is_correct = False
            
            if question.question_type == "multiple_choice":
                is_correct = user_answer.lower() == question.correct_answer.lower()
            elif question.question_type == "true_false":
                is_correct = user_answer.lower() == question.correct_answer.lower()
            else:  # short_answer
                # For short answer, check if user's answer contains key phrases
                is_correct = any(keyword in user_answer.lower() 
                               for keyword in question.correct_answer.lower().split()[:3])
            
            if is_correct:
                correct_count += 1
            
            results.append({
                "question_id": question.id,
                "user_answer": user_answer,
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "explanation": question.explanation
            })
        
        score = (correct_count / len(questions)) * 100 if questions else 0
        
        # Update question set stats
        question_set.attempt_count += 1
        if score > question_set.best_score:
            question_set.best_score = score
        
        # Record the attempt
        attempt = models.QuestionAttempt(
            question_set_id=question_set_id,
            user_id=user.id,
            attempt_number=question_set.attempt_count,
            answers=json.dumps(answers),
            score=score,
            correct_count=correct_count,
            incorrect_count=len(questions) - correct_count,
            total_questions=len(questions),
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(attempt)
        db.commit()
        
        return {
            "status": "success",
            "score": round(score, 1),
            "correct_count": correct_count,
            "total_questions": len(questions),
            "details": results
        }
        
    except Exception as e:
        logger.error(f"Error submitting answers: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get_hints/{question_id}")
def get_hints_for_question(question_id: int, db: Session = Depends(get_db)):
    """Get hints for a specific question"""
    try:
        question = db.query(models.Question).filter(
            models.Question.id == question_id
        ).first()
        
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        
        # Generate hints based on question content
        hints = []
        
        if question.question_type == "multiple_choice":
            options = json.loads(question.options) if question.options else []
            if len(options) >= 2:
                hints.append(f"Consider the options carefully. Eliminate obviously wrong answers first.")
                hints.append(f"The correct answer relates to: {question.topic}")
        
        elif question.question_type == "true_false":
            hints.append(f"Think about the fundamental concepts of {question.topic}")
            hints.append(f"Consider real-world applications of this concept")
        
        else:  # short_answer
            hints.append(f"Focus on the key terms related to {question.topic}")
            hints.append(f"Think about how this concept is applied in practice")
        
        hints.append(f"Review your notes on {question.topic} if you're unsure")
        
        return {
            "question_id": question_id,
            "hints": hints[:3]  # Return max 3 hints
        }
        
    except Exception as e:
        logger.error(f"Error getting hints: {str(e)}")
        return {"question_id": question_id, "hints": ["Think about the main concepts covered in this topic."]}

@app.post("/api/submit_review_response")
async def submit_review_response(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Submit a response for a learning review"""
    try:
        user_id = payload.get("user_id")
        review_id = payload.get("review_id")
        response_text = payload.get("response_text", "")
        
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()
        
        if not review:
            raise HTTPException(status_code=404, detail="Learning review not found")
        
        # Parse expected points
        try:
            expected_points = json.loads(review.expected_points)
        except:
            expected_points = []
        
        # Simple evaluation - count how many points are mentioned
        covered_points = []
        for point in expected_points:
            if any(keyword in response_text.lower() for keyword in point.lower().split()[:3]):
                covered_points.append(point)
        
        coverage_percentage = (len(covered_points) / len(expected_points)) * 100 if expected_points else 0
        
        # Generate feedback
        if coverage_percentage >= 80:
            feedback = "Excellent! You've covered most of the key concepts thoroughly."
            strengths = ["Comprehensive understanding", "Good recall of main points"]
            improvements = ["Consider adding more specific examples"]
        elif coverage_percentage >= 60:
            feedback = "Good effort! You've captured the main ideas but missed some details."
            strengths = ["Solid grasp of core concepts", "Clear expression"]
            improvements = ["Add more specific details", "Expand on the applications"]
        else:
            feedback = "You're on the right track but missed several key concepts. Review the material and try again."
            strengths = ["Good attempt at explaining what you remember"]
            improvements = ["Review the main concepts more thoroughly", "Focus on key definitions and applications"]
        
        # Save the attempt
        attempt = models.LearningReviewAttempt(
            review_id=review_id,
            attempt_number=review.current_attempt + 1,
            user_response=response_text,
            covered_points=json.dumps(covered_points),
            missing_points=json.dumps([p for p in expected_points if p not in covered_points]),
            completeness_percentage=coverage_percentage,
            feedback=feedback,
            submitted_at=datetime.now(timezone.utc)
        )
        db.add(attempt)
        
        # Update review
        review.current_attempt += 1
        if coverage_percentage > review.best_score:
            review.best_score = coverage_percentage
        
        if coverage_percentage >= 80:
            review.status = "completed"
            review.completed_at = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "status": "success",
            "score": round(coverage_percentage, 1),
            "feedback": feedback,
            "strengths": strengths,
            "improvements": improvements,
            "covered_points": covered_points,
            "total_points": len(expected_points)
        }
        
    except Exception as e:
        logger.error(f"Error submitting review response: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
               
@app.get("/api/get_knowledge_roadmaps")
async def get_knowledge_roadmaps(
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get all roadmaps for a user
    """
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        roadmaps = db.query(models.KnowledgeRoadmap).filter(
            models.KnowledgeRoadmap.user_id == user.id
        ).order_by(models.KnowledgeRoadmap.created_at.desc()).all()
        
        return {
            "roadmaps": [
                {
                    "id": roadmap.id,
                    "title": roadmap.title,
                    "root_topic": roadmap.root_topic,
                    "total_nodes": roadmap.total_nodes,
                    "max_depth_reached": roadmap.max_depth_reached,
                    "status": roadmap.status,
                    "created_at": roadmap.created_at.isoformat(),
                    "last_accessed": roadmap.last_accessed.isoformat() if roadmap.last_accessed else None
                }
                for roadmap in roadmaps
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting user roadmaps: {str(e)}")
        return {"roadmaps": []}


@app.post("/api/save_node_notes/{node_id}")
async def save_node_notes(
    node_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Save user notes on a node
    """
    try:
        node = db.query(models.KnowledgeNode).filter(
            models.KnowledgeNode.id == node_id
        ).first()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        notes = payload.get("notes", "")
        node.user_notes = notes
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Notes saved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error saving notes: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/delete_roadmap/{roadmap_id}")
async def delete_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a roadmap and all its nodes
    """
    try:
        roadmap = db.query(models.KnowledgeRoadmap).filter(
            models.KnowledgeRoadmap.id == roadmap_id
        ).first()
        
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        
        # Delete all nodes recursively
        def delete_node_tree(node_id):
            children = db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.parent_node_id == node_id
            ).all()
            
            for child in children:
                delete_node_tree(child.id)
            
            db.query(models.NodeExplorationHistory).filter(
                models.NodeExplorationHistory.node_id == node_id
            ).delete()
            
            db.query(models.KnowledgeNode).filter(
                models.KnowledgeNode.id == node_id
            ).delete()
        
        if roadmap.root_node_id:
            delete_node_tree(roadmap.root_node_id)
        
        db.delete(roadmap)
        db.commit()
        
        return {
            "status": "success",
            "message": "Roadmap deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting roadmap: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== HINTS ENDPOINT ====================



@app.post("/api/get_learning_hints")
async def get_learning_hints(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Generate hints for missing learning points
    """
    try:
        review_id = payload.get("review_id")
        missing_points = payload.get("missing_points", [])

        if not review_id or not missing_points:
            raise HTTPException(status_code=400, detail="Review ID and missing points required")

        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()

        if not review:
            raise HTTPException(status_code=404, detail="Learning review not found")

        # Get original source content for context
        source_content = review.source_content[:3000]

        # Limit to first 3 missing points
        missing_points = missing_points[:3]

        # Generate hints for each missing point
        hints_list = []
        
        for point in missing_points:
            hint_prompt = f"""You are a helpful learning assistant providing subtle hints.

**CONTEXT** (original learning material):
{source_content}

**MISSING LEARNING POINT**:
{point}

**TASK**: Create a helpful hint that guides the student toward remembering this point WITHOUT directly giving away the answer.

**OUTPUT FORMAT** (JSON only):
{{
  "missing_point": "{point}",
  "hint": "A subtle clue that prompts memory without revealing the full answer",
  "memory_trigger": "A keyword or phrase that might jog their memory",
  "guiding_question": "A question that leads them to think about this topic"
}}

Generate hint now:"""

            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": "You are a helpful learning assistant. Return only valid JSON."},
                    {"role": "user", "content": hint_prompt}
                ],
                model=GROQ_MODEL,
                temperature=0.7,
                max_tokens=512,
            )

            response_text = chat_completion.choices[0].message.content

            try:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    hint_data = json.loads(json_match.group())
                    hints_list.append(hint_data)
            except:
                # Fallback hint if parsing fails
                hints_list.append({
                    "missing_point": point,
                    "hint": f"Think about the key concepts related to: {point[:50]}...",
                    "memory_trigger": "Review your notes",
                    "guiding_question": "What do you remember about this topic?"
                })

        return {
            "status": "success",
            "hints": hints_list,
            "total_hints": len(hints_list)
        }

    except Exception as e:
        logger.error(f"Error generating hints: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate hints: {str(e)}")


# ==================== GET LEARNING REVIEWS ====================

@app.get("/api/get_learning_reviews")
def get_learning_reviews(user_id: str = Query(...), db: Session = Depends(get_db)):
    """
    Get all learning reviews for a user
    """
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        reviews = db.query(models.LearningReview).filter(
            models.LearningReview.user_id == user.id
        ).order_by(models.LearningReview.created_at.desc()).all()

        result = []
        for review in reviews:
            # Get session titles
            try:
                session_ids = json.loads(review.source_sessions)
                sessions = db.query(models.ChatSession).filter(
                    models.ChatSession.id.in_(session_ids)
                ).all()
                session_titles = [s.title for s in sessions]
            except:
                session_titles = []

            result.append({
                "id": review.id,
                "title": review.title,
                "status": review.status,
                "total_points": review.total_points,
                "best_score": round(review.best_score, 1),
                "attempt_count": review.attempt_count,
                "current_attempt": review.current_attempt,
                "session_titles": session_titles,
                "created_at": review.created_at.isoformat(),
                "updated_at": review.updated_at.isoformat(),
                "completed_at": review.completed_at.isoformat() if review.completed_at else None,
                "can_continue": review.status == "active" and review.current_attempt < 5
            })

        return {"reviews": result}

    except Exception as e:
        logger.error(f"Error getting learning reviews: {str(e)}")
        return {"reviews": []}
    
@app.post("/api/save_archetype_profile")
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
        quiz_responses = payload.get("quiz_responses", {})

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
                archetype_description=archetype_description,
                quiz_responses=json.dumps(quiz_responses)
            )
            db.add(comprehensive_profile)
        else:
            comprehensive_profile.primary_archetype = primary_archetype
            comprehensive_profile.secondary_archetype = secondary_archetype
            comprehensive_profile.archetype_scores = json.dumps(archetype_scores)
            comprehensive_profile.archetype_description = archetype_description
            comprehensive_profile.quiz_responses = json.dumps(quiz_responses)

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



@app.get("/api/get_comprehensive_profile")
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
            "fieldOfStudy": user.field_of_study or "",
            "brainwaveGoal": "",
            "preferredSubjects": [],
            "difficultyLevel": "intermediate",
            "learningPace": "moderate",
            "primaryArchetype": "",
            "secondaryArchetype": "",
            "archetypeDescription": ""
        }

        if comprehensive_profile:
            result.update({
                "difficultyLevel": comprehensive_profile.difficulty_level or "intermediate",
                "learningPace": comprehensive_profile.learning_pace or "moderate",
                "brainwaveGoal": comprehensive_profile.brainwave_goal or "",
                "primaryArchetype": comprehensive_profile.primary_archetype or "",
                "secondaryArchetype": comprehensive_profile.secondary_archetype or "",
                "archetypeDescription": comprehensive_profile.archetype_description or ""
            })

            try:
                if comprehensive_profile.preferred_subjects:
                    result["preferredSubjects"] = json.loads(comprehensive_profile.preferred_subjects)
            except:
                result["preferredSubjects"] = []

        return result

    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/update_comprehensive_profile")
async def update_comprehensive_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if payload.get("firstName"):
            user.first_name = payload["firstName"]
        if payload.get("lastName"):
            user.last_name = payload["lastName"]
        if payload.get("email"):
            user.email = payload["email"]
        if payload.get("fieldOfStudy"):
            user.field_of_study = payload["fieldOfStudy"]

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        if not comprehensive_profile:
            comprehensive_profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(comprehensive_profile)

        if payload.get("difficultyLevel"):
            comprehensive_profile.difficulty_level = payload["difficultyLevel"]
        if payload.get("learningPace"):
            comprehensive_profile.learning_pace = payload["learningPace"]
        if payload.get("brainwaveGoal"):
            comprehensive_profile.brainwave_goal = payload["brainwaveGoal"]

        if "preferredSubjects" in payload:
            comprehensive_profile.preferred_subjects = json.dumps(payload["preferredSubjects"])

        comprehensive_profile.updated_at = datetime.now(timezone.utc)

        db.commit()

        return {
            "status": "success",
            "message": "Profile updated successfully"
        }

    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 
    
@app.post("/api/save_complete_profile")
async def save_complete_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        if not comprehensive_profile:
            comprehensive_profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(comprehensive_profile)

        if "preferred_subjects" in payload:
            comprehensive_profile.preferred_subjects = json.dumps(payload["preferred_subjects"])
        
        if "main_subject" in payload:
            user.field_of_study = payload["main_subject"]
        
        if "brainwave_goal" in payload:
            comprehensive_profile.brainwave_goal = payload["brainwave_goal"]
        
        if payload.get("quiz_completed"):
            comprehensive_profile.primary_archetype = payload.get("primary_archetype")
            comprehensive_profile.secondary_archetype = payload.get("secondary_archetype")
            comprehensive_profile.archetype_scores = json.dumps(payload.get("archetype_scores", {}))
            comprehensive_profile.archetype_description = payload.get("archetype_description")

        comprehensive_profile.quiz_completed = payload.get("quiz_completed", False)
        comprehensive_profile.updated_at = datetime.now(timezone.utc)

        db.commit()

        return {
            "status": "success",
            "message": "Profile saved successfully"
        }

    except Exception as e:
        logger.error(f"Error saving complete profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== FRIEND SYSTEM ENDPOINTS ====================

@app.get("/api/search_users")
async def search_users(
    query: str = Query(..., min_length=1),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Search for users by username or email"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Search for users (excluding current user)
        search_pattern = f"%{query}%"
        users = db.query(models.User).filter(
            and_(
                models.User.id != current_user.id,
                (models.User.username.ilike(search_pattern) | models.User.email.ilike(search_pattern))
            )
        ).limit(20).all()
        
        result = []
        for user in users:
            # Get comprehensive profile for preferred subjects
            comp_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == user.id
            ).first()
            
            # Get user stats
            user_stats = db.query(models.UserStats).filter(
                models.UserStats.user_id == user.id
            ).first()
            
            # Check friendship status
            friendship = db.query(models.Friendship).filter(
                and_(
                    models.Friendship.user_id == current_user.id,
                    models.Friendship.friend_id == user.id
                )
            ).first()
            
            # Check if there's a pending friend request
            pending_request_sent = db.query(models.FriendRequest).filter(
                and_(
                    models.FriendRequest.sender_id == current_user.id,
                    models.FriendRequest.receiver_id == user.id,
                    models.FriendRequest.status == "pending"
                )
            ).first()
            
            pending_request_received = db.query(models.FriendRequest).filter(
                and_(
                    models.FriendRequest.sender_id == user.id,
                    models.FriendRequest.receiver_id == current_user.id,
                    models.FriendRequest.status == "pending"
                )
            ).first()
            
            preferred_subjects = []
            if comp_profile and comp_profile.preferred_subjects:
                try:
                    preferred_subjects = json.loads(comp_profile.preferred_subjects)
                except:
                    preferred_subjects = []
            
            result.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "picture_url": user.picture_url or "",
                "field_of_study": user.field_of_study or "",
                "preferred_subjects": preferred_subjects,
                "stats": {
                    "total_lessons": user_stats.total_lessons if user_stats else 0,
                    "total_hours": round(user_stats.total_hours, 1) if user_stats else 0,
                    "day_streak": user_stats.day_streak if user_stats else 0,
                    "accuracy_percentage": round(user_stats.accuracy_percentage, 1) if user_stats else 0
                },
                "is_friend": friendship is not None,
                "request_sent": pending_request_sent is not None,
                "request_received": pending_request_received is not None
            })
        
        return {"users": result}
    
    except Exception as e:
        logger.error(f"Error searching users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/send_friend_request")
async def send_friend_request(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Send a friend request to another user"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        receiver_id = payload.get("receiver_id")
        if not receiver_id:
            raise HTTPException(status_code=400, detail="receiver_id is required")
        
        # Check if receiver exists
        receiver = db.query(models.User).filter(models.User.id == receiver_id).first()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")
        
        # Check if they're already friends
        existing_friendship = db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == receiver_id
            )
        ).first()
        
        if existing_friendship:
            raise HTTPException(status_code=400, detail="Already friends")
        
        # Check if there's already a pending request
        existing_request = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.sender_id == current_user.id,
                models.FriendRequest.receiver_id == receiver_id,
                models.FriendRequest.status == "pending"
            )
        ).first()
        
        if existing_request:
            raise HTTPException(status_code=400, detail="Friend request already sent")
        
        # Create friend request
        friend_request = models.FriendRequest(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            status="pending"
        )
        db.add(friend_request)
        db.commit()
        
        return {
            "status": "success",
            "message": "Friend request sent successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending friend request: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/friend_requests")
async def get_friend_requests(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all pending friend requests for the current user"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Get received requests
        received_requests = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.receiver_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).all()
        
        # Get sent requests
        sent_requests = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.sender_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).all()
        
        received_result = []
        for req in received_requests:
            sender = req.sender
            received_result.append({
                "request_id": req.id,
                "user_id": sender.id,
                "username": sender.username,
                "email": sender.email,
                "first_name": sender.first_name or "",
                "last_name": sender.last_name or "",
                "picture_url": sender.picture_url or "",
                "created_at": req.created_at.isoformat()
            })
        
        sent_result = []
        for req in sent_requests:
            receiver = req.receiver
            sent_result.append({
                "request_id": req.id,
                "user_id": receiver.id,
                "username": receiver.username,
                "email": receiver.email,
                "first_name": receiver.first_name or "",
                "last_name": receiver.last_name or "",
                "picture_url": receiver.picture_url or "",
                "created_at": req.created_at.isoformat()
            })
        
        return {
            "received": received_result,
            "sent": sent_result
        }
    
    except Exception as e:
        logger.error(f"Error getting friend requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/respond_friend_request")
async def respond_friend_request(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Accept or reject a friend request"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        request_id = payload.get("request_id")
        action = payload.get("action")  # "accept" or "reject"
        
        if not request_id or not action:
            raise HTTPException(status_code=400, detail="request_id and action are required")
        
        # Get the friend request
        friend_request = db.query(models.FriendRequest).filter(
            and_(
                models.FriendRequest.id == request_id,
                models.FriendRequest.receiver_id == current_user.id,
                models.FriendRequest.status == "pending"
            )
        ).first()
        
        if not friend_request:
            raise HTTPException(status_code=404, detail="Friend request not found")
        
        if action == "accept":
            # Update request status
            friend_request.status = "accepted"
            friend_request.responded_at = datetime.now(timezone.utc)
            
            # Create friendship (bidirectional)
            friendship1 = models.Friendship(
                user_id=current_user.id,
                friend_id=friend_request.sender_id
            )
            friendship2 = models.Friendship(
                user_id=friend_request.sender_id,
                friend_id=current_user.id
            )
            
            db.add(friendship1)
            db.add(friendship2)
            db.commit()
            
            return {
                "status": "success",
                "message": "Friend request accepted"
            }
        
        elif action == "reject":
            friend_request.status = "rejected"
            friend_request.responded_at = datetime.now(timezone.utc)
            db.commit()
            
            return {
                "status": "success",
                "message": "Friend request rejected"
            }
        
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to friend request: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/friends")
async def get_friends(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all friends of the current user"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        # Get all friendships
        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()
        
        result = []
        for friendship in friendships:
            friend = friendship.friend
            
            # Get comprehensive profile
            comp_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == friend.id
            ).first()
            
            # Get user stats
            user_stats = db.query(models.UserStats).filter(
                models.UserStats.user_id == friend.id
            ).first()
            
            preferred_subjects = []
            if comp_profile and comp_profile.preferred_subjects:
                try:
                    preferred_subjects = json.loads(comp_profile.preferred_subjects)
                except:
                    preferred_subjects = []
            
            result.append({
                "id": friend.id,
                "username": friend.username,
                "email": friend.email,
                "first_name": friend.first_name or "",
                "last_name": friend.last_name or "",
                "picture_url": friend.picture_url or "",
                "field_of_study": friend.field_of_study or "",
                "preferred_subjects": preferred_subjects,
                "stats": {
                    "total_lessons": user_stats.total_lessons if user_stats else 0,
                    "total_hours": round(user_stats.total_hours, 1) if user_stats else 0,
                    "day_streak": user_stats.day_streak if user_stats else 0,
                    "accuracy_percentage": round(user_stats.accuracy_percentage, 1) if user_stats else 0
                },
                "friends_since": friendship.created_at.isoformat()
            })
        
        return {"friends": result}
    
    except Exception as e:
        logger.error(f"Error getting friends: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/remove_friend")
async def remove_friend(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Remove a friend"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="Current user not found")
        
        friend_id = payload.get("friend_id")
        if not friend_id:
            raise HTTPException(status_code=400, detail="friend_id is required")
        
        # Delete both friendship records
        db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == friend_id
            )
        ).delete()
        
        db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == friend_id,
                models.Friendship.friend_id == current_user.id
            )
        ).delete()
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Friend removed successfully"
        }
    
    except Exception as e:
        logger.error(f"Error removing friend: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== FRIEND ACTIVITY FEED ====================

@app.get("/api/friend_activity_feed")
async def get_friend_activity_feed(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    limit: int = Query(50, le=100)
):
    """Get activity feed of friends' achievements and milestones"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get friend IDs
        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()
        friend_ids = [f.friend_id for f in friendships]
        
        if not friend_ids:
            return {"activities": []}
        
        # Get friend activities
        activities = db.query(models.FriendActivity).filter(
            models.FriendActivity.user_id.in_(friend_ids)
        ).order_by(models.FriendActivity.created_at.desc()).limit(limit).all()
        
        result = []
        for activity in activities:
            # Get kudos count and check if current user gave kudos
            kudos_count = db.query(models.Kudos).filter(
                models.Kudos.activity_id == activity.id
            ).count()
            
            user_gave_kudos = db.query(models.Kudos).filter(
                and_(
                    models.Kudos.activity_id == activity.id,
                    models.Kudos.user_id == current_user.id
                )
            ).first() is not None
            
            result.append({
                "id": activity.id,
                "user": {
                    "id": activity.user.id,
                    "username": activity.user.username,
                    "first_name": activity.user.first_name or "",
                    "last_name": activity.user.last_name or "",
                    "picture_url": activity.user.picture_url or ""
                },
                "activity_type": activity.activity_type,
                "title": activity.title,
                "description": activity.description or "",
                "icon": activity.icon or "Trophy",
                "metadata": json.loads(activity.activity_data) if activity.activity_data else {},
                "kudos_count": kudos_count,
                "user_gave_kudos": user_gave_kudos,
                "created_at": activity.created_at.isoformat()
            })
        
        return {"activities": result}
    
    except Exception as e:
        logger.error(f"Error fetching friend activity feed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/give_kudos")
async def give_kudos(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Give kudos to a friend's activity"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        activity_id = payload.get("activity_id")
        reaction_type = payload.get("reaction_type", "👏")
        
        if not activity_id:
            raise HTTPException(status_code=400, detail="activity_id is required")
        
        # Check if already gave kudos
        existing = db.query(models.Kudos).filter(
            and_(
                models.Kudos.activity_id == activity_id,
                models.Kudos.user_id == current_user.id
            )
        ).first()
        
        if existing:
            # Remove kudos
            db.delete(existing)
            db.commit()
            return {"status": "removed", "message": "Kudos removed"}
        else:
            # Add kudos
            kudos = models.Kudos(
                activity_id=activity_id,
                user_id=current_user.id,
                reaction_type=reaction_type
            )
            db.add(kudos)
            db.commit()
            return {"status": "added", "message": "Kudos given"}
    
    except Exception as e:
        logger.error(f"Error giving kudos: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/create_activity")
async def create_activity(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new activity (used internally when user achieves something)"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        activity = models.FriendActivity(
            user_id=current_user.id,
            activity_type=payload.get("activity_type"),
            title=payload.get("title"),
            description=payload.get("description", ""),
            icon=payload.get("icon", "Trophy"),
            activity_data=json.dumps(payload.get("metadata", {}))
        )
        
        db.add(activity)
        db.commit()
        
        return {"status": "success", "activity_id": activity.id}
    
    except Exception as e:
        logger.error(f"Error creating activity: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LEADERBOARDS ====================

@app.get("/api/leaderboard")
async def get_leaderboard(
    category: str = Query("global", regex="^(global|friends|subject|archetype)$"),
    metric: str = Query("total_hours", regex="^(total_hours|accuracy|streak|lessons)$"),
    period: str = Query("all_time", regex="^(weekly|monthly|all_time)$"),
    subject: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get leaderboard rankings"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Determine user pool based on category
        if category == "friends":
            friendships = db.query(models.Friendship).filter(
                models.Friendship.user_id == current_user.id
            ).all()
            user_ids = [f.friend_id for f in friendships] + [current_user.id]
        else:
            user_ids = None  # All users
        
        # Get user stats
        query = db.query(models.UserStats, models.User).join(
            models.User, models.UserStats.user_id == models.User.id
        )
        
        if user_ids:
            query = query.filter(models.UserStats.user_id.in_(user_ids))
        
        # Order by metric
        if metric == "total_hours":
            query = query.order_by(models.UserStats.total_hours.desc())
            score_field = "total_hours"
        elif metric == "accuracy":
            query = query.order_by(models.UserStats.accuracy_percentage.desc())
            score_field = "accuracy_percentage"
        elif metric == "streak":
            query = query.order_by(models.UserStats.day_streak.desc())
            score_field = "day_streak"
        else:  # lessons
            query = query.order_by(models.UserStats.total_lessons.desc())
            score_field = "total_lessons"
        
        results = query.limit(limit).all()
        
        leaderboard = []
        for rank, (stats, user) in enumerate(results, start=1):
            score = getattr(stats, score_field)
            leaderboard.append({
                "rank": rank,
                "user_id": user.id,
                "username": user.username,
                "first_name": user.first_name or "",
                "last_name": user.last_name or "",
                "picture_url": user.picture_url or "",
                "score": round(score, 1) if isinstance(score, float) else score,
                "metric": metric,
                "is_current_user": user.id == current_user.id
            })
        
        # Find current user's rank if not in top results
        current_user_rank = next((item for item in leaderboard if item["is_current_user"]), None)
        
        return {
            "leaderboard": leaderboard,
            "current_user_rank": current_user_rank,
            "category": category,
            "metric": metric,
            "period": period
        }
    
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== QUIZ BATTLES ====================

@app.post("/api/create_quiz_battle")
async def create_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new quiz battle challenge"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        opponent_id = payload.get("opponent_id")
        subject = payload.get("subject")
        difficulty = payload.get("difficulty", "intermediate")
        question_count = payload.get("question_count", 10)
        time_limit = payload.get("time_limit_seconds", 300)
        
        if not opponent_id or not subject:
            raise HTTPException(status_code=400, detail="opponent_id and subject are required")
        
        # Check if opponent is a friend
        friendship = db.query(models.Friendship).filter(
            and_(
                models.Friendship.user_id == current_user.id,
                models.Friendship.friend_id == opponent_id
            )
        ).first()
        
        if not friendship:
            raise HTTPException(status_code=400, detail="Can only battle with friends")
        
        # Create battle
        battle = models.QuizBattle(
            challenger_id=current_user.id,
            opponent_id=opponent_id,
            subject=subject,
            difficulty=difficulty,
            question_count=question_count,
            time_limit_seconds=time_limit,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)
        )
        
        db.add(battle)
        db.commit()
        
        return {
            "status": "success",
            "battle_id": battle.id,
            "message": "Quiz battle created"
        }
    
    except Exception as e:
        logger.error(f"Error creating quiz battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quiz_battles")
async def get_quiz_battles(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    status: str = Query("active", regex="^(pending|active|completed|all)$")
):
    """Get user's quiz battles"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get battles where user is challenger or opponent
        query = db.query(models.QuizBattle).filter(
            (models.QuizBattle.challenger_id == current_user.id) |
            (models.QuizBattle.opponent_id == current_user.id)
        )
        
        if status != "all":
            query = query.filter(models.QuizBattle.status == status)
        
        battles = query.order_by(models.QuizBattle.created_at.desc()).all()
        
        result = []
        for battle in battles:
            is_challenger = battle.challenger_id == current_user.id
            opponent = battle.opponent if is_challenger else battle.challenger
            
            result.append({
                "id": battle.id,
                "opponent": {
                    "id": opponent.id,
                    "username": opponent.username,
                    "first_name": opponent.first_name or "",
                    "last_name": opponent.last_name or "",
                    "picture_url": opponent.picture_url or ""
                },
                "subject": battle.subject,
                "difficulty": battle.difficulty,
                "status": battle.status,
                "question_count": battle.question_count,
                "time_limit_seconds": battle.time_limit_seconds,
                "your_score": battle.challenger_score if is_challenger else battle.opponent_score,
                "opponent_score": battle.opponent_score if is_challenger else battle.challenger_score,
                "your_completed": battle.challenger_completed if is_challenger else battle.opponent_completed,
                "opponent_completed": battle.opponent_completed if is_challenger else battle.challenger_completed,
                "is_challenger": is_challenger,
                "created_at": battle.created_at.isoformat(),
                "expires_at": battle.expires_at.isoformat() if battle.expires_at else None
            })
        
        return {"battles": result}
    
    except Exception as e:
        logger.error(f"Error fetching quiz battles: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/complete_quiz_battle")
async def complete_quiz_battle(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Complete a quiz battle with score"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        battle_id = payload.get("battle_id")
        score = payload.get("score")
        
        if not battle_id or score is None:
            raise HTTPException(status_code=400, detail="battle_id and score are required")
        
        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()
        
        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")
        
        # Update score
        is_challenger = battle.challenger_id == current_user.id
        if is_challenger:
            battle.challenger_score = score
            battle.challenger_completed = True
        else:
            battle.opponent_score = score
            battle.opponent_completed = True
        
        # Check if both completed
        if battle.challenger_completed and battle.opponent_completed:
            battle.status = "completed"
            battle.completed_at = datetime.now(timezone.utc)
            
            # Create activity for winner
            winner_id = battle.challenger_id if battle.challenger_score > battle.opponent_score else battle.opponent_id
            winner = battle.challenger if winner_id == battle.challenger_id else battle.opponent
            loser = battle.opponent if winner_id == battle.challenger_id else battle.challenger
            
            activity = models.FriendActivity(
                user_id=winner_id,
                activity_type="quiz_battle_won",
                title=f"Won Quiz Battle!",
                description=f"Defeated {loser.username} in {battle.subject}",
                icon="Swords",
                activity_data=json.dumps({
                    "winner_score": battle.challenger_score if winner_id == battle.challenger_id else battle.opponent_score,
                    "loser_score": battle.opponent_score if winner_id == battle.challenger_id else battle.challenger_score,
                    "subject": battle.subject
                })
            )
            db.add(activity)
        elif battle.status == "pending":
            battle.status = "active"
            battle.started_at = datetime.now(timezone.utc)
        
        db.commit()
        
        return {
            "status": "success",
            "battle_status": battle.status,
            "message": "Score submitted"
        }
    
    except Exception as e:
        logger.error(f"Error completing quiz battle: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHALLENGES ====================

@app.post("/api/create_challenge")
async def create_challenge(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new challenge"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        challenge = models.Challenge(
            creator_id=current_user.id,
            title=payload.get("title"),
            description=payload.get("description", ""),
            challenge_type=payload.get("challenge_type"),
            subject=payload.get("subject"),
            target_metric=payload.get("target_metric"),
            target_value=payload.get("target_value"),
            time_limit_minutes=payload.get("time_limit_minutes"),
            starts_at=datetime.now(timezone.utc),
            ends_at=datetime.now(timezone.utc) + timedelta(minutes=payload.get("time_limit_minutes", 60))
        )
        
        db.add(challenge)
        db.commit()
        
        return {
            "status": "success",
            "challenge_id": challenge.id
        }
    
    except Exception as e:
        logger.error(f"Error creating challenge: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/challenges")
async def get_challenges(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    filter_type: str = Query("active", regex="^(active|completed|my_challenges|all)$")
):
    """Get available challenges"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        query = db.query(models.Challenge)
        
        if filter_type == "my_challenges":
            query = query.filter(models.Challenge.creator_id == current_user.id)
        elif filter_type != "all":
            query = query.filter(models.Challenge.status == filter_type)
        
        challenges = query.order_by(models.Challenge.created_at.desc()).all()
        
        result = []
        for challenge in challenges:
            # Check if user is participating
            participation = db.query(models.ChallengeParticipation).filter(
                and_(
                    models.ChallengeParticipation.challenge_id == challenge.id,
                    models.ChallengeParticipation.user_id == current_user.id
                )
            ).first()
            
            result.append({
                "id": challenge.id,
                "creator": {
                    "id": challenge.creator.id,
                    "username": challenge.creator.username,
                    "first_name": challenge.creator.first_name or "",
                    "last_name": challenge.creator.last_name or ""
                },
                "title": challenge.title,
                "description": challenge.description or "",
                "challenge_type": challenge.challenge_type,
                "subject": challenge.subject or "",
                "target_metric": challenge.target_metric,
                "target_value": challenge.target_value,
                "time_limit_minutes": challenge.time_limit_minutes,
                "status": challenge.status,
                "participant_count": challenge.participant_count,
                "is_participating": participation is not None,
                "user_progress": participation.progress if participation else 0,
                "user_completed": participation.completed if participation else False,
                "created_at": challenge.created_at.isoformat(),
                "ends_at": challenge.ends_at.isoformat() if challenge.ends_at else None
            })
        
        return {"challenges": result}
    
    except Exception as e:
        logger.error(f"Error fetching challenges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/join_challenge")
async def join_challenge(
    payload: dict = Body(...),
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Join a challenge"""
    try:
        current_user = get_user_by_username(db, username) or get_user_by_email(db, username)
        if not current_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        challenge_id = payload.get("challenge_id")
        if not challenge_id:
            raise HTTPException(status_code=400, detail="challenge_id is required")
        
        # Check if already participating
        existing = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Already participating in this challenge")
        
        participation = models.ChallengeParticipation(
            challenge_id=challenge_id,
            user_id=current_user.id
        )
        
        db.add(participation)
        
        # Update participant count
        challenge = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
        if challenge:
            challenge.participant_count += 1
        
        db.commit()
        
        return {"status": "success", "message": "Joined challenge"}
    
    except Exception as e:
        logger.error(f"Error joining challenge: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz_battle/{battle_id}")
async def get_quiz_battle_detail(
    battle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific battle"""
    try:
        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()
        
        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")
        
        # Check if user is part of this battle
        if battle.challenger_id != current_user.id and battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this battle")
        
        # Get existing questions if any
        questions = db.query(models.BattleQuestion).filter(
            models.BattleQuestion.battle_id == battle_id
        ).all()
        
        question_list = []
        for q in questions:
            question_list.append({
                "id": q.id,
                "question": q.question,
                "options": json.loads(q.options),
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            })
        
        is_challenger = battle.challenger_id == current_user.id
        
        return {
            "battle": {
                "id": battle.id,
                "subject": battle.subject,
                "difficulty": battle.difficulty,
                "status": battle.status,
                "question_count": battle.question_count,
                "time_limit_seconds": battle.time_limit_seconds,
                "your_score": battle.challenger_score if is_challenger else battle.opponent_score,
                "opponent_score": battle.opponent_score if is_challenger else battle.challenger_score,
                "your_completed": battle.challenger_completed if is_challenger else battle.opponent_completed,
                "is_challenger": is_challenger
            },
            "questions": question_list
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting battle detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_battle_questions")
async def generate_battle_questions(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI questions for a quiz battle"""
    try:
        battle_id = payload.get("battle_id")
        subject = payload.get("subject")
        difficulty = payload.get("difficulty", "intermediate")
        question_count = payload.get("question_count", 10)
        
        # Verify battle exists and user is participant
        battle = db.query(models.QuizBattle).filter(
            models.QuizBattle.id == battle_id
        ).first()
        
        if not battle:
            raise HTTPException(status_code=404, detail="Battle not found")
        
        if battle.challenger_id != current_user.id and battle.opponent_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Check if questions already exist
        existing = db.query(models.BattleQuestion).filter(
            models.BattleQuestion.battle_id == battle_id
        ).first()
        
        if existing:
            # Return existing questions
            questions = db.query(models.BattleQuestion).filter(
                models.BattleQuestion.battle_id == battle_id
            ).all()
            
            return {
                "questions": [{
                    "id": q.id,
                    "question": q.question,
                    "options": json.loads(q.options),
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                } for q in questions]
            }
        
        # Generate new questions using AI
        difficulty_map = {
            "beginner": "easy, suitable for beginners",
            "intermediate": "moderate difficulty",
            "advanced": "challenging, advanced level"
        }
        
        prompt = f"""Generate exactly {question_count} multiple choice questions about {subject}.
Difficulty level: {difficulty_map.get(difficulty, 'moderate')}.

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Brief explanation of the correct answer"
  }}
]

Requirements:
- Each question must have exactly 4 options
- correct_answer must be 0, 1, 2, or 3 (index of the correct option)
- Questions should be clear and unambiguous
- Explanations should be concise (1-2 sentences)
- Make questions engaging and educational
- Return ONLY the JSON array, no additional text"""

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean the response
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        questions_data = json.loads(content)
        
        # Save questions to database
        saved_questions = []
        for q_data in questions_data:
            battle_question = models.BattleQuestion(
                battle_id=battle_id,
                question=q_data["question"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation", "")
            )
            db.add(battle_question)
            db.flush()
            
            saved_questions.append({
                "id": battle_question.id,
                "question": battle_question.question,
                "options": q_data["options"],
                "correct_answer": battle_question.correct_answer,
                "explanation": battle_question.explanation
            })
        
        # Update battle status to active
        if battle.status == "pending":
            battle.status = "active"
            battle.started_at = datetime.utcnow()
        
        db.commit()
        
        return {"questions": saved_questions}
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}, Content: {content}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating battle questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHALLENGE ENDPOINTS ====================

@app.get("/api/challenge/{challenge_id}")
async def get_challenge_detail(
    challenge_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific challenge"""
    try:
        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        # Get user's participation
        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()
        
        if not participation:
            raise HTTPException(status_code=403, detail="Not participating in this challenge")
        
        # Get existing questions if any
        questions = db.query(models.ChallengeQuestion).filter(
            models.ChallengeQuestion.challenge_id == challenge_id
        ).all()
        
        question_list = []
        for q in questions:
            question_list.append({
                "id": q.id,
                "question": q.question,
                "options": json.loads(q.options),
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            })
        
        return {
            "challenge": {
                "id": challenge.id,
                "title": challenge.title,
                "description": challenge.description,
                "challenge_type": challenge.challenge_type,
                "subject": challenge.subject,
                "target_metric": challenge.target_metric,
                "target_value": challenge.target_value,
                "time_limit_minutes": challenge.time_limit_minutes,
                "status": challenge.status,
                "progress": participation.progress,
                "completed": participation.completed
            },
            "questions": question_list
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting challenge detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_challenge_questions")
async def generate_challenge_questions(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI questions for a challenge"""
    try:
        challenge_id = payload.get("challenge_id")
        subject = payload.get("subject", "General Knowledge")
        challenge_type = payload.get("challenge_type", "speed")
        question_count = payload.get("question_count", 10)
        
        # Verify challenge exists and user is participant
        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()
        
        if not participation:
            raise HTTPException(status_code=403, detail="Not participating in this challenge")
        
        # Check if questions already exist
        existing = db.query(models.ChallengeQuestion).filter(
            models.ChallengeQuestion.challenge_id == challenge_id
        ).first()
        
        if existing:
            # Return existing questions
            questions = db.query(models.ChallengeQuestion).filter(
                models.ChallengeQuestion.challenge_id == challenge_id
            ).all()
            
            return {
                "questions": [{
                    "id": q.id,
                    "question": q.question,
                    "options": json.loads(q.options),
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation
                } for q in questions]
            }
        
        # Generate questions based on challenge type
        type_descriptions = {
            "speed": "fast-paced questions that can be answered quickly",
            "accuracy": "precise questions requiring careful consideration",
            "topic_mastery": "comprehensive questions testing deep understanding",
            "streak": "progressively challenging questions"
        }
        
        prompt = f"""Generate exactly {question_count} multiple choice questions about {subject}.
Challenge type: {challenge_type} - {type_descriptions.get(challenge_type, '')}.

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0,
    "explanation": "Brief explanation of the correct answer"
  }}
]

Requirements:
- Each question must have exactly 4 options
- correct_answer must be 0, 1, 2, or 3 (index of the correct option)
- Questions should be clear and educational
- Explanations should be concise (1-2 sentences)
- Return ONLY the JSON array, no additional text"""

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Clean the response
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        questions_data = json.loads(content)
        
        # Save questions to database
        saved_questions = []
        for q_data in questions_data:
            challenge_question = models.ChallengeQuestion(
                challenge_id=challenge_id,
                question=q_data["question"],
                options=json.dumps(q_data["options"]),
                correct_answer=q_data["correct_answer"],
                explanation=q_data.get("explanation", "")
            )
            db.add(challenge_question)
            db.flush()
            
            saved_questions.append({
                "id": challenge_question.id,
                "question": challenge_question.question,
                "options": q_data["options"],
                "correct_answer": challenge_question.correct_answer,
                "explanation": challenge_question.explanation
            })
        
        db.commit()
        
        return {"questions": saved_questions}
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {str(e)}, Content: {content}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        db.rollback()
        logger.error(f"Error generating challenge questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/update_challenge_progress")
async def update_challenge_progress(
    payload: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's progress in a challenge"""
    try:
        challenge_id = payload.get("challenge_id")
        questions_answered = payload.get("questions_answered", 0)
        accuracy_percentage = payload.get("accuracy_percentage", 0)
        answers = payload.get("answers", [])
        
        # Get challenge and participation
        challenge = db.query(models.Challenge).filter(
            models.Challenge.id == challenge_id
        ).first()
        
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        participation = db.query(models.ChallengeParticipation).filter(
            and_(
                models.ChallengeParticipation.challenge_id == challenge_id,
                models.ChallengeParticipation.user_id == current_user.id
            )
        ).first()
        
        if not participation:
            raise HTTPException(status_code=404, detail="Participation not found")
        
        # Save answers
        for answer_data in answers:
            battle_answer = models.ChallengeAnswer(
                challenge_id=challenge_id,
                user_id=current_user.id,
                question_id=answer_data["question_id"],
                selected_answer=answer_data["selected_answer"],
                is_correct=answer_data["is_correct"]
            )
            db.add(battle_answer)
        
        # Calculate progress based on target metric
        progress = 0
        score = questions_answered if challenge.target_metric == "questions_answered" else accuracy_percentage
        
        if challenge.target_metric == "questions_answered":
            progress = min((questions_answered / challenge.target_value) * 100, 100)
            participation.score = questions_answered
        elif challenge.target_metric == "accuracy_percentage":
            progress = min((accuracy_percentage / challenge.target_value) * 100, 100)
            participation.score = accuracy_percentage
        
        participation.progress = progress
        
        # Check if completed
        if progress >= 100:
            participation.completed = True
            participation.completed_at = datetime.utcnow()
            
            # Create activity
            activity = models.FriendActivity(
                user_id=current_user.id,
                activity_type="challenge_completed",
                title=f"Completed Challenge: {challenge.title}",
                description=f"Achieved {progress:.1f}% progress",
                icon="trophy",
                activity_data=json.dumps({
                    "challenge_id": challenge.id,
                    "score": float(score),
                    "progress": float(progress)
                })
            )
            db.add(activity)
        
        db.commit()
        
        return {
            "message": "Progress updated successfully",
            "progress": progress,
            "completed": participation.completed
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating challenge progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
from sqlalchemy import and_, or_
@app.post("/api/share_content")
async def share_content(
    share_data: ShareContentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Share a note or chat with friends"""
    try:
        logger.info(f"📤 Sharing content for user {current_user.id}")
        
        # Verify content ownership
        if share_data.content_type == 'note':
            content = db.query(models.Note).filter(
                models.Note.id == share_data.content_id,
                models.Note.user_id == current_user.id
            ).first()
            if not content:
                raise HTTPException(status_code=404, detail="Note not found or not owned by user")
        elif share_data.content_type == 'chat':
            content = db.query(models.ChatSession).filter(
                models.ChatSession.id == share_data.content_id,
                models.ChatSession.user_id == current_user.id
            ).first()
            if not content:
                raise HTTPException(status_code=404, detail="Chat not found or not owned by user")
        else:
            raise HTTPException(status_code=400, detail="Invalid content type")
        
        # Create share records for each friend
        shared_records = []
        for friend_id in share_data.friend_ids:
            # ✅ FIXED: Check for 'active' status instead of 'accepted'
            friendship = db.query(models.Friendship).filter(
                and_(
                    or_(
                        and_(
                            models.Friendship.user_id == current_user.id,
                            models.Friendship.friend_id == friend_id
                        ),
                        and_(
                            models.Friendship.user_id == friend_id,
                            models.Friendship.friend_id == current_user.id
                        )
                    ),
                    models.Friendship.status == 'active'  # ✅ Changed from 'accepted' to 'active'
                )
            ).first()
            
            if not friendship:
                logger.warning(f"⚠️ User {friend_id} is not a friend of {current_user.id}")
                continue  # Skip if not friends
            
            # Check if already shared
            existing_share = db.query(models.SharedContent).filter(
                models.SharedContent.owner_id == current_user.id,
                models.SharedContent.shared_with_id == friend_id,
                models.SharedContent.content_type == share_data.content_type,
                models.SharedContent.content_id == share_data.content_id
            ).first()
            
            if existing_share:
                # Update existing share
                existing_share.permission = share_data.permission
                existing_share.message = share_data.message
                existing_share.shared_at = datetime.now(timezone.utc)
                shared_records.append(existing_share)
                logger.info(f"🔄 Updated existing share for friend {friend_id}")
            else:
                # Create new share
                shared_content = models.SharedContent(
                    owner_id=current_user.id,
                    shared_with_id=friend_id,
                    content_type=share_data.content_type,
                    content_id=share_data.content_id,
                    permission=share_data.permission,
                    message=share_data.message,
                    shared_at=datetime.now(timezone.utc)
                )
                db.add(shared_content)
                shared_records.append(shared_content)
                logger.info(f"✅ Created new share for friend {friend_id}")
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Content shared with {len(shared_records)} friend(s)",
            "shared_count": len(shared_records)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sharing content: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shared_with_me")
def get_shared_with_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all content shared with the current user"""
    try:
        logger.info(f"🔍 Starting shared_with_me endpoint for user: {current_user.id}")
        
        # Get all shared content for this user
        shared_items = db.query(models.SharedContent).filter(
            models.SharedContent.shared_with_id == current_user.id
        ).order_by(models.SharedContent.shared_at.desc()).all()
        
        logger.info(f"📦 Found {len(shared_items)} shared items for user {current_user.id}")
        
        # Debug: Log all shared items
        for item in shared_items:
            logger.info(f"🔄 Shared item: id={item.id}, type={item.content_type}, content_id={item.content_id}, owner_id={item.owner_id}")
        
        result = []
        for item in shared_items:
            # Get owner info
            owner = db.query(models.User).filter(models.User.id == item.owner_id).first()
            if not owner:
                logger.warning(f"⚠️ Owner not found for shared item {item.id}")
                continue
            
            # Get content details
            title = "Untitled"
            content_exists = False
            
            if item.content_type == 'note':
                note = db.query(models.Note).filter(models.Note.id == item.content_id).first()
                if note:
                    title = note.title or "Untitled Note"
                    content_exists = True
                    logger.info(f"📝 Note found: {title}")
                else:
                    logger.warning(f"⚠️ Note not found for ID: {item.content_id}")
                    title = "Deleted Note"
            elif item.content_type == 'chat':
                chat = db.query(models.ChatSession).filter(models.ChatSession.id == item.content_id).first()
                if chat:
                    title = chat.title or "Untitled Chat"
                    content_exists = True
                    logger.info(f"💬 Chat found: {title}")
                else:
                    logger.warning(f"⚠️ Chat not found for ID: {item.content_id}")
                    title = "Deleted Chat"
            
            # Only include if content still exists
            if content_exists:
                result.append({
                    "id": item.id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "title": title,
                    "permission": item.permission,
                    "message": item.message,
                    "shared_at": item.shared_at.isoformat() if item.shared_at else None,
                    "shared_by": {
                        "id": owner.id,
                        "username": owner.username,
                        "email": owner.email,
                        "first_name": owner.first_name or "",
                        "last_name": owner.last_name or "",
                        "picture_url": owner.picture_url or ""
                    }
                })
            else:
                logger.info(f"🗑️ Skipping deleted content: {item.content_type} {item.content_id}")
        
        logger.info(f"✅ Returning {len(result)} valid shared items")
        return {"shared_items": result}
        
    except Exception as e:
        logger.error(f"❌ Error getting shared content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug_friendships")
def debug_friendships(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check friendship status"""
    try:
        # Get all friendships for current user
        friendships = db.query(models.Friendship).filter(
            models.Friendship.user_id == current_user.id
        ).all()
        
        # Also get reverse friendships
        reverse_friendships = db.query(models.Friendship).filter(
            models.Friendship.friend_id == current_user.id
        ).all()
        
        result = {
            "user": {
                "id": current_user.id,
                "username": current_user.username
            },
            "friendships": [
                {
                    "id": f.id,
                    "user_id": f.user_id,
                    "friend_id": f.friend_id,
                    "status": f.status,
                    "created_at": f.created_at.isoformat()
                }
                for f in friendships
            ],
            "reverse_friendships": [
                {
                    "id": f.id,
                    "user_id": f.user_id,
                    "friend_id": f.friend_id,
                    "status": f.status,
                    "created_at": f.created_at.isoformat()
                }
                for f in reverse_friendships
            ],
            "total_friendships": len(friendships) + len(reverse_friendships)
        }
        
        return result
        
    except Exception as e:
        return {"error": str(e)}
@app.get("/api/shared/{content_type}/{content_id}")
def get_shared_content(
    content_type: str,
    content_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of shared content"""
    try:
        logger.info(f"🔍 Accessing shared content: {content_type} {content_id} for user: {current_user.id}")
        
        # Check if content is shared with user or owned by user
        shared = db.query(models.SharedContent).filter(
            models.SharedContent.content_type == content_type,
            models.SharedContent.content_id == content_id,
            models.SharedContent.shared_with_id == current_user.id
        ).first()
        
        # Get content
        if content_type == 'note':
            content = db.query(models.Note).filter(models.Note.id == content_id).first()
            if not content:
                raise HTTPException(status_code=404, detail="Note not found")
            
            # Check permissions
            is_owner = content.user_id == current_user.id
            if not is_owner and not shared:
                raise HTTPException(status_code=403, detail="No access to this note")
            
            owner = db.query(models.User).filter(models.User.id == content.user_id).first()
            
            return {
                "content_type": "note",
                "content_id": content.id,
                "title": content.title,
                "content": content.content,
                "created_at": content.created_at.isoformat(),
                "updated_at": content.updated_at.isoformat(),
                "permission": shared.permission if shared else "owner",
                "is_owner": is_owner,
                "owner": {
                    "id": owner.id,
                    "username": owner.username,
                    "first_name": owner.first_name or "",
                    "last_name": owner.last_name or "",
                    "picture_url": owner.picture_url or ""
                }
            }
            
        elif content_type == 'chat':
            content = db.query(models.ChatSession).filter(models.ChatSession.id == content_id).first()
            if not content:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Check permissions
            is_owner = content.user_id == current_user.id
            if not is_owner and not shared:
                raise HTTPException(status_code=403, detail="No access to this chat")
            
            # Get messages
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == content_id
            ).order_by(models.ChatMessage.timestamp.asc()).all()
            
            owner = db.query(models.User).filter(models.User.id == content.user_id).first()
            
            return {
                "content_type": "chat",
                "content_id": content.id,
                "title": content.title,
                "created_at": content.created_at.isoformat(),
                "updated_at": content.updated_at.isoformat(),
                "permission": shared.permission if shared else "owner",
                "is_owner": is_owner,
                "owner": {
                    "id": owner.id,
                    "username": owner.username,
                    "first_name": owner.first_name or "",
                    "last_name": owner.last_name or "",
                    "picture_url": owner.picture_url or ""
                },
                "messages": [
                    {
                        "user_message": msg.user_message,
                        "ai_response": msg.ai_response,
                        "timestamp": msg.timestamp.isoformat()
                    }
                    for msg in messages
                ]
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid content type")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting shared content: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug_shared_content")
def debug_shared_content(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Debug endpoint to check shared content"""
    try:
        # Get all shared content
        shared_items = db.query(models.SharedContent).filter(
            models.SharedContent.shared_with_id == current_user.id
        ).all()
        
        # Also check if user has any shared items as owner
        owned_shares = db.query(models.SharedContent).filter(
            models.SharedContent.owner_id == current_user.id
        ).all()
        
        return {
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email
            },
            "received_shares": [
                {
                    "id": item.id,
                    "owner_id": item.owner_id,
                    "shared_with_id": item.shared_with_id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "permission": item.permission,
                    "message": item.message,
                    "shared_at": item.shared_at.isoformat() if item.shared_at else None
                }
                for item in shared_items
            ],
            "sent_shares": [
                {
                    "id": item.id,
                    "owner_id": item.owner_id,
                    "shared_with_id": item.shared_with_id,
                    "content_type": item.content_type,
                    "content_id": item.content_id,
                    "permission": item.permission,
                    "message": item.message
                }
                for item in owned_shares
            ],
            "total_received": len(shared_items),
            "total_sent": len(owned_shares)
        }
        
    except Exception as e:
        return {"error": str(e)}
@app.delete("/api/remove_shared_access/{share_id}")
def remove_shared_access(
    share_id: int,
    current_user: models.User = Depends(get_current_user),  # Use the existing dependency
    db: Session = Depends(get_db)
):
    """Remove access to shared content"""
    try:
        logger.info(f"🗑️ User {current_user.id} attempting to remove shared access {share_id}")
        
        # Find shared content - user can remove if they are the recipient OR the owner
        shared = db.query(models.SharedContent).filter(
            models.SharedContent.id == share_id
        ).first()
        
        if not shared:
            logger.error(f"❌ Shared content not found: {share_id}")
            raise HTTPException(status_code=404, detail="Shared content not found")
        
        # Check permissions: user can remove if they are the recipient OR the owner
        can_remove = (shared.shared_with_id == current_user.id) or (shared.owner_id == current_user.id)
        
        if not can_remove:
            logger.warning(f"⚠️ User {current_user.id} not authorized to remove share {share_id}")
            raise HTTPException(status_code=403, detail="Not authorized to remove this shared content")
        
        logger.info(f"✅ Removing shared access: share_id={share_id}, owner={shared.owner_id}, recipient={shared.shared_with_id}")
        
        db.delete(shared)
        db.commit()
        
        return {
            "success": True, 
            "message": "Access removed successfully",
            "removed_share_id": share_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error removing shared access: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/update_shared_note/{note_id}")
def update_shared_note(
    note_id: int,
    note_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Update a shared note (if user has edit permission)"""
    try:
        # Verify token and get user
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        user = get_user_by_email(db, user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get note
        note = db.query(models.Note).filter(models.Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        # Check if owner
        if note.user_id == user.id:
            # Owner can always edit
            pass
        else:
            # Check if shared with edit permission
            shared = db.query(models.SharedContent).filter(
                models.SharedContent.content_type == 'note',
                models.SharedContent.content_id == note_id,
                models.SharedContent.shared_with_id == user.id,
                models.SharedContent.permission == 'edit'
            ).first()
            
            if not shared:
                raise HTTPException(status_code=403, detail="No edit permission for this note")
        
        # Update note
        if 'content' in note_data:
            note.content = note_data['content']
        if 'title' in note_data:
            note.title = note_data['title']
        
        note.updated_at = datetime.now(timezone.utc)
        db.commit()
        
        return {
            "success": True,
            "message": "Note updated successfully",
            "note": {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "updated_at": note.updated_at.isoformat()
            }
        }
        
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating shared note: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== SERVE REACT APP ====================

# Serve static files from React build
# ==================== SERVE REACT APP ====================

# ==================== SERVE REACT APP ====================

# ==================== SERVE REACT APP (OPTIONAL - NOT USED IN PRODUCTION) ====================

build_dir = Path(__file__).parent.parent / "build"

# Only serve React if build exists (for local testing)
if build_dir.exists() and os.getenv("SERVE_REACT", "false").lower() == "true":
    logger.info(f"✅ Serving React app from {build_dir}")
    
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="static")
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """Serve React app for all non-API routes (local testing only)"""
        
        # Block /api/* from being caught
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        file_path = build_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        return FileResponse(build_dir / "index.html")
else:
    logger.info("ℹ️ Not serving React app (frontend on Vercel)")
    
    # Simple root endpoint
    @app.get("/")
    async def root():
        return {
            "message": "Brainwave Backend API v3.0.0",
            "status": "running",
            "frontend": "https://l1-m71fagwct-asphar0057s-projects.vercel.app"
        }

# ==================== END SERVE REACT APP ====================
# ==================== END SERVE REACT APP ====================
# ==================== END SERVE REACT APP ====================
# ==================== END SERVE REACT APP ====================

if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting Brainwave AI Backend v3.0.0 with Groq")
    logger.info(f"All API endpoints loaded successfully")
    
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)