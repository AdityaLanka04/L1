from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import func  # Add this import
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import requests
from typing import List, Optional, Dict, Any
import base64
import io
from PIL import Image
import pytesseract
import PyPDF2
import fitz  
import mimetypes
from datetime import datetime, timedelta
import os
import uuid
import json
import re
from dotenv import load_dotenv
from langchain_community.llms import Ollama
import models
from database import SessionLocal, engine
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON, Date, and_
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from typing import List, Optional, Dict, Any
import json
import re


# Enhanced features import with fallback
try:
    from global_ai_learning import GlobalAILearningSystem
    from personalization_engine_backend import PersonalizationEngine
    ENHANCED_FEATURES_AVAILABLE = True
except ImportError:
    print("Enhanced AI features not available. Run migration.py to enable them.")
    ENHANCED_FEATURES_AVAILABLE = False

# Load environment variables
load_dotenv()

# Create all database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Brainwave Backend API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

# ==================== PYDANTIC MODELS ====================

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
    
    class Config:
        str_strip_whitespace = True

class NoteCreate(BaseModel):
    user_id: str
    title: str = "New Note"
    content: str = ""

class NoteUpdate(BaseModel):
    note_id: int
    title: str
    content: str

class ActivityData(BaseModel):
    user_id: str
    activity_data: list

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

class ComprehensiveProfileUpdate(BaseModel):
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
    timeZone: Optional[str] = ""
    studyEnvironment: Optional[str] = "quiet"
    preferredLanguage: Optional[str] = "english"
    preferredSessionLength: Optional[str] = ""
    breakFrequency: Optional[str] = ""
    bestStudyTimes: Optional[List[str]] = []
    preferredContentTypes: Optional[List[str]] = []
    devicePreferences: Optional[List[str]] = []
    accessibilityNeeds: Optional[List[str]] = []
    internetSpeed: Optional[str] = ""
    dataUsage: Optional[str] = ""
    notificationPreferences: Optional[List[str]] = []
    contactMethod: Optional[str] = ""
    communicationFrequency: Optional[str] = ""
    profileVisibility: Optional[str] = "private"

class TimeTrackingUpdate(BaseModel):
    user_id: str
    session_type: str  # 'dashboard', 'ai-chat', 'flashcards', 'notes', 'profile'
    time_spent_minutes: float
    page_url: Optional[str] = None
    activity_data: Optional[Dict] = None


class LearningReviewCreate(BaseModel):
    user_id: str
    chat_session_ids: List[int]
    review_title: str = "Learning Review Session"
    review_type: str = "comprehensive"  # comprehensive, key_points, summary

class LearningReviewResponse(BaseModel):
    review_id: int
    user_response: str
    attempt_number: int = 1

class ReviewHintRequest(BaseModel):
    review_id: int
    missing_points: List[str]


# ==================== UTILITY FUNCTIONS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)
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
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
        
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

def get_current_user(db: Session = Depends(get_db), token: str = Depends(verify_token)):
    user = get_user_by_username(db, token)
    if not user:
        user = get_user_by_email(db, token)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ==================== BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "Brainwave Backend API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "API is running"}

# ==================== AUTHENTICATION ENDPOINTS ====================

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
    print(f"REGISTER: Attempting to register user: {username} ({first_name} {last_name})")
    
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
    
    # Create user stats
    user_stats = models.UserStats(user_id=db_user.id)
    db.add(user_stats)
    db.commit()
    
    print(f"REGISTER: User {username} registered successfully")
    return {"message": "User registered successfully"}

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    print(f"LOGIN: Login attempt for user: {form_data.username}")
    
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        print(f"LOGIN: Authentication failed for user: {form_data.username}")
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    print(f"LOGIN: Login successful for user: {form_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/token_form")
async def login_form(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    print(f"LOGIN_FORM: Login attempt for user: {username}")
    
    user = authenticate_user(db, username, password)
    if not user:
        print(f"LOGIN_FORM: Authentication failed for user: {username}")
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    print(f"LOGIN_FORM: Login successful for user: {username}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/google-auth")
def google_auth(auth_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        # Try Google's tokeninfo endpoint first
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.token}"
            response = requests.get(url)
            
            if response.status_code == 200:
                user_info = response.json()
            else:
                raise Exception("Invalid token from tokeninfo")
                
        except Exception:
            # Fallback to Google's verify_oauth2_token
            user_info = verify_google_token(auth_data.token)
        
        email = user_info.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Email not found")
        
        user = get_user_by_email(db, email)
        
        if not user:
            # Create new Google user
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
            
            # Create user stats
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
        print(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

# Add this to your main.py
@app.post("/firebase-auth")
async def firebase_authentication(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        id_token = data.get('idToken')
        email = data.get('email')
        display_name = data.get('displayName')
        photo_url = data.get('photoURL')
        uid = data.get('uid')

        # For now, just verify the token format and create/update user
        if not id_token or not email:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Check if user exists
        user = get_user_by_email(db, email)
        
        if not user:
            # Create new user
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
            
            # Create user stats
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
            db.commit()

        # Create access token
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
        print(f"Firebase auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")

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

# ==================== CHAT SESSION MANAGEMENT ====================

@app.post("/create_chat_session")
def create_chat_session(session_data: ChatSessionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@app.get("/get_chat_sessions")
def get_chat_sessions(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
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
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == chat_id
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == chat_id
    ).order_by(models.ChatMessage.timestamp.asc()).all()
    
    result = []
    for message in messages:
        result.append({
            "id": f"{message.id}_user",
            "type": "user",
            "content": message.user_message,
            "timestamp": message.timestamp.isoformat()
        })
        result.append({
            "id": f"{message.id}_ai",
            "type": "ai",
            "content": message.ai_response,
            "timestamp": message.timestamp.isoformat()
        })
    
    return result

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
    
    # Update session timestamp
    chat_session.updated_at = datetime.utcnow()
    
    # Auto-generate title for new chats
    message_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == message_data.chat_id
    ).count()
    
    if chat_session.title == "New Chat" and message_count == 0:
        user_message = message_data.user_message.strip()
        words = user_message.split()
        
        if len(words) <= 4:
            new_title = user_message
        else:
            new_title = " ".join(words[:4]) + "..."
        
        new_title = new_title[0].upper() + new_title[1:] if new_title else "New Chat"
        new_title = new_title[:50]
        chat_session.title = new_title
    
    db.commit()
    return {"status": "success", "message": "Message saved successfully"}

@app.post("/save_chat_message_json")
async def save_chat_message_json(request: Request, db: Session = Depends(get_db)):
    try:
        json_data = await request.json()
        print(f"Received JSON data: {json_data}")
        
        chat_id = json_data.get('chat_id')
        user_message = json_data.get('user_message')
        ai_response = json_data.get('ai_response')
        
        print(f"Extracted - chat_id: {chat_id}, user_message: {user_message[:50] if user_message else None}")
        
        if isinstance(chat_id, str):
            chat_id = int(chat_id)
        
        if not all([chat_id, user_message, ai_response]):
            raise HTTPException(status_code=400, detail=f"Missing fields - chat_id: {chat_id}, user_message: {bool(user_message)}, ai_response: {bool(ai_response)}")
        
        chat_session = db.query(models.ChatSession).filter(
            models.ChatSession.id == chat_id
        ).first()
        if not chat_session:
            raise HTTPException(status_code=404, detail=f"Chat session {chat_id} not found")
        
        chat_message = models.ChatMessage(
            chat_session_id=chat_id,
            user_message=user_message,
            ai_response=ai_response
        )
        db.add(chat_message)
        
        chat_session.updated_at = datetime.utcnow()
        
        message_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == chat_id
        ).count()
        
        if chat_session.title == "New Chat" and message_count == 0:
            words = user_message.strip().split()
            new_title = " ".join(words[:4]) + ("..." if len(words) > 4 else "")
            new_title = new_title[0].upper() + new_title[1:] if new_title else "New Chat"
            chat_session.title = new_title[:50]
        
        db.commit()
        print("Message saved successfully!")
        return {"status": "success", "message": "Message saved successfully"}
        
    except Exception as e:
        print(f"Error in save_chat_message_json: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AI CHAT ENDPOINT ====================

@app.post("/ask/")
async def ask_ai_enhanced(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    print(f"\nDEBUG: Starting enhanced ask_ai with profile integration")
    print(f"user_id: {user_id}")
    print(f"question: {question[:50]}...")
    print(f"chat_id: {chat_id}")
    
    try:
        # Convert chat_id
        chat_id_int = None
        if chat_id:
            try:
                chat_id_int = int(chat_id)
                print(f"Converted chat_id to int: {chat_id_int}")
            except ValueError:
                print(f"Could not convert chat_id to int: {chat_id}")
                pass
        
        # Get user
        print(f"Looking up user: {user_id}")
        user = get_user_by_username(db, user_id)
        if not user:
            print(f"User not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        print(f"Found user: {user.first_name} {user.last_name}")
        
        # Validate chat session
        if chat_id_int:
            print(f"Validating chat session: {chat_id_int}")
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                print(f"Chat session not found: {chat_id_int}")
                raise HTTPException(status_code=404, detail="Chat session not found")
            print(f"Chat session validated")
        
        # Get comprehensive user profile for enhanced personalization
        print("Loading user profile for personalization...")
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        # Build comprehensive user context
        user_context = f"""
Student Profile:
- Name: {user.first_name or 'Student'} {user.last_name or ''}
- Field of Study: {user.field_of_study or 'General Studies'}
- Learning Style: {user.learning_style or 'Mixed'} learner
- Academic Level: {user.school_university or 'Student'}
"""
        
        if profile:
            try:
                # Add profile-specific context
                preferred_subjects = json.loads(profile.preferred_subjects or "[]")
                motivation_factors = json.loads(profile.motivation_factors or "[]")
                weak_areas = json.loads(profile.weak_areas or "[]")
                strong_areas = json.loads(profile.strong_areas or "[]")
                
                user_context += f"""
Learning Preferences:
- Difficulty Level: {profile.difficulty_level or 'intermediate'}
- Learning Pace: {profile.learning_pace or 'moderate'}
- Study Schedule: {profile.study_schedule or 'flexible'}
- Study Environment: {profile.study_environment or 'quiet'}
- Preferred Language: {profile.preferred_language or 'english'}

Academic Focus:
- Preferred Subjects: {', '.join(preferred_subjects[:5]) if preferred_subjects else 'Not specified'}
- Study Goals: {profile.study_goals[:100] + '...' if profile.study_goals and len(profile.study_goals) > 100 else profile.study_goals or 'Not specified'}
- Career Goals: {profile.career_goals[:100] + '...' if profile.career_goals and len(profile.career_goals) > 100 else profile.career_goals or 'Not specified'}

Learning Profile:
- Motivation: {', '.join(motivation_factors[:3]) if motivation_factors else 'General learning'}
- Strengths: {', '.join(strong_areas[:3]) if strong_areas else 'To be discovered'}
- Areas for Improvement: {', '.join(weak_areas[:3]) if weak_areas else 'None specified'}

Study Preferences:
- Session Length: {profile.preferred_session_length or 'Flexible'}
- Break Frequency: {profile.break_frequency or 'As needed'}
- Learning Challenges: {profile.learning_challenges[:100] + '...' if profile.learning_challenges and len(profile.learning_challenges) > 100 else profile.learning_challenges or 'None specified'}
"""
                
                print(f"Loaded comprehensive profile for enhanced personalization")
                
            except json.JSONDecodeError as e:
                print(f"Error parsing profile JSON data: {e}")
                user_context += "\nNote: Some profile preferences could not be loaded."
        else:
            user_context += "\nNote: Complete your profile for enhanced personalization!"
            print("No comprehensive profile found")
        
        # Initialize enhanced AI systems if available
        ai_response_data = None
        if ENHANCED_FEATURES_AVAILABLE:
            try:
                print("Initializing enhanced AI features...")
                global_ai = GlobalAILearningSystem(db)
                personalization = PersonalizationEngine(db, user.id)
                
                # Get conversation history from ALL user's chats
                print("Getting user's complete conversation history...")
                all_user_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
                    models.ChatSession.user_id == user.id
                ).order_by(models.ChatMessage.timestamp.desc()).limit(10).all()
                
                conversation_history = []
                for msg in reversed(all_user_messages):
                    conversation_history.append({
                        'user_message': msg.user_message,
                        'ai_response': msg.ai_response,
                        'timestamp': msg.timestamp
                    })
                
                # Generate enhanced response using global AI system
                print("Generating enhanced AI response...")
                ai_response_data = global_ai.generate_enhanced_response(
                    user_message=question,
                    user_id=user.id,
                    conversation_history=conversation_history
                )
                
                print(f"Enhanced response generated with confidence: {ai_response_data['ai_confidence']}")
                
            except Exception as enhanced_error:
                print(f"Enhanced features failed, falling back to basic: {enhanced_error}")
                ai_response_data = None
        
        # Initialize Ollama
        print(f"Initializing Ollama...")
        try:
            llm = Ollama(model="llama3")
            print(f"Ollama initialized successfully")
        except Exception as ollama_error:
            print(f"Ollama initialization failed: {ollama_error}")
            raise ollama_error
        
        # Build comprehensive AI prompt with full user context
        if ai_response_data and ENHANCED_FEATURES_AVAILABLE:
            # Use enhanced prompt with full context
            ai_prompt = f"""You are an advanced AI tutor with persistent memory and comprehensive student profiling. You remember everything from all previous conversations and adapt your teaching to the student's complete learning profile.

{user_context}

{ai_response_data['enhanced_prompt']}

Important Instructions:
1. **Personalize Based on Profile**: Use the student's field of study, learning style, difficulty level, and preferences to tailor your response
2. **Reference Conversation History**: Build on previous discussions and maintain continuity
3. **Adapt to Learning Pace**: Match the student's preferred learning pace ({profile.learning_pace if profile else 'moderate'})
4. **Consider Goals**: Keep their study and career goals in mind when providing guidance
5. **Address Weaknesses**: If the question relates to their areas for improvement, provide extra support
6. **Leverage Strengths**: Build on their known strengths when explaining concepts
7. **Match Communication Style**: Adapt to their preferred difficulty level and environment

Current Question: {question}

Provide a comprehensive, personalized response that demonstrates deep understanding of this student's learning profile and history."""
            
            print(f"Using enhanced prompt with full profile integration (length: {len(ai_prompt)} chars)")
        else:
            # Build comprehensive fallback prompt
            print(f"Using comprehensive prompt with profile context...")
            
            # Get recent conversation history
            recent_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
                models.ChatSession.user_id == user.id
            ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()
            
            context_str = ""
            if recent_messages:
                context_str = f"\nRecent conversation history:\n"
                for msg in reversed(recent_messages):
                    context_str += f"Student: {msg.user_message[:100]}...\n"
                    context_str += f"You: {msg.ai_response[:100]}...\n"
                context_str += "\n"
            
            ai_prompt = f"""You are an expert AI tutor with comprehensive student profiling and persistent memory. You maintain detailed understanding of each student and provide personalized educational support.

{user_context}

{context_str}

Teaching Guidelines:
1. **Personalization**: Always consider the student's field of study, learning style, and academic level
2. **Adaptive Difficulty**: Match content to their specified difficulty level ({profile.difficulty_level if profile else 'intermediate'})
3. **Learning Style Integration**: 
   - Visual learners: Use diagrams, charts, and visual analogies
   - Auditory learners: Include verbal explanations and sound-based examples
   - Kinesthetic learners: Suggest hands-on activities and physical practice
   - Reading/Writing learners: Provide detailed written explanations and note-taking strategies
4. **Goal Alignment**: Connect lessons to their study and career objectives
5. **Strength Building**: Leverage their identified strengths in explanations
6. **Weakness Support**: Provide extra scaffolding for areas they want to improve
7. **Motivational Alignment**: Reference their motivation factors when encouraging progress
8. **Pace Matching**: Respect their preferred learning pace ({profile.learning_pace if profile else 'moderate'})
9. **Environmental Consideration**: Adapt suggestions to their study environment preferences
10. **Continuous Context**: Reference previous conversations to show growth and build on prior learning

Current Question: {question}

Provide a thoughtful, personalized response that demonstrates deep understanding of this student's complete learning profile. Include relevant examples from their field of study, match their learning preferences, and build on your shared learning history."""
        
        print(f"Sending comprehensive prompt to Ollama...")
        try:
            response = llm.invoke(ai_prompt)
            print(f"Got response from Ollama (length: {len(response)} chars)")
            print(f"Response preview: {response[:100]}...")
        except Exception as llm_error:
            print(f"Ollama invoke failed: {llm_error}")
            raise llm_error
        
        # Track time spent on AI chat
        try:
            track_session_time(TimeTrackingUpdate(
                user_id=user_id,
                session_type="ai-chat",
                time_spent_minutes=2.0  # Approximate time for AI interaction
            ), db)
        except Exception as time_error:
            print(f"Time tracking failed: {time_error}")
        
        # Store activity with enhanced features
        print(f"Storing activity...")
        try:
            activity = models.Activity(
                user_id=user.id,
                question=question,
                answer=response,
                topic=user.field_of_study or "General",
                question_type="profile_enhanced",
                difficulty_level=profile.difficulty_level if profile else "intermediate",
                user_satisfaction=5  # Default high satisfaction for profile-enhanced responses
            )
            db.add(activity)
            db.commit()
            print(f"Activity stored successfully")
        except Exception as activity_error:
            print(f"Error storing activity: {activity_error}")
        
        # Update personalization if enhanced features available
        if ENHANCED_FEATURES_AVAILABLE and ai_response_data:
            try:
                personalization = PersonalizationEngine(db, user.id)
                # Analyze the user's message for learning patterns
                analysis = personalization.analyze_user_message(question)
                print(f"User message analyzed: {analysis}")
                
                # Store conversation memory for persistence
                personalization.store_conversation_memory(
                    memory_type="profile_enhanced_qa",
                    content=f"Q: {question[:100]}... A: {response[:100]}...",
                    importance=0.8,  # Higher importance for profile-enhanced responses
                    context=f"Profile-enhanced chat session {chat_id_int or 'new'}"
                )
                
                print("Personalization updated successfully")
            except Exception as personalization_error:
                print(f"Personalization update failed: {personalization_error}")
        
        # Calculate enhanced confidence based on profile completeness
        profile_completeness = 0.5  # Default
        if profile:
            # Calculate how complete the profile is
            essential_fields = ['difficulty_level', 'learning_pace', 'study_goals']
            completed_fields = sum(1 for field in essential_fields if getattr(profile, field, None))
            profile_completeness = min(1.0, 0.3 + (completed_fields / len(essential_fields)) * 0.7)
        
        base_confidence = ai_response_data['ai_confidence'] if ai_response_data else 0.75
        enhanced_confidence = min(0.98, base_confidence + (profile_completeness * 0.2))
        
        # Build comprehensive response
        result = {
            "answer": response,
            "ai_confidence": enhanced_confidence,
            "misconception_detected": ai_response_data['misconception_detected'] if ai_response_data else False,
            "should_request_feedback": ai_response_data['should_request_feedback'] if ai_response_data else False,
            "topics_discussed": ai_response_data['analysis']['topics'] if ai_response_data else [user.field_of_study or "General"],
            "enhanced_features_used": ENHANCED_FEATURES_AVAILABLE,
            "memory_persistent": True,
            "profile_enhanced": bool(profile),
            "profile_completeness": profile_completeness,
            "personalization_level": "comprehensive" if profile else "basic",
            "learning_style_adapted": user.learning_style or "mixed",
            "difficulty_level": profile.difficulty_level if profile else "intermediate",
            "field_context": user.field_of_study or "general"
        }
        
        print(f"SUCCESS: Returning comprehensive profile-enhanced response")
        return result
        
    except Exception as e:
        print(f"ERROR in ask_ai_enhanced: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        return {
            "answer": f"I apologize, but I encountered an error: {str(e)}. Please try again, and consider completing your profile for better personalized responses.",
            "ai_confidence": 0.3,
            "misconception_detected": False,
            "should_request_feedback": True,
            "topics_discussed": [],
            "enhanced_features_used": False,
            "memory_persistent": False,
            "profile_enhanced": False,
            "profile_completeness": 0.0,
            "personalization_level": "error",
            "learning_style_adapted": "none",
            "difficulty_level": "unknown",
            "field_context": "error"
        }

@app.get("/get_notes")
def get_notes(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
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


# ==================== ENHANCED AI CHAT WITH FILE PROCESSING ====================

class ChatMessageWithFiles(BaseModel):
    chat_id: int
    user_message: str
    ai_response: str
    file_attachments: Optional[List[str]] = []  # Store file names/paths
    
    class Config:
        str_strip_whitespace = True

class FileProcessingResult(BaseModel):
    file_name: str
    file_type: str
    extracted_text: str
    summary: str
    page_count: Optional[int] = None
    image_description: Optional[str] = None

@app.post("/upload_and_process_files")
async def upload_and_process_files(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload and process multiple files (PDFs, images) for AI analysis"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        processed_files = []
        llm = Ollama(model="llama3")
        
        for file in files:
            if not file.filename:
                continue
                
            # Read file content
            file_content = await file.read()
            file_type = file.content_type or mimetypes.guess_type(file.filename)[0]
            
            result = {
                "file_name": file.filename,
                "file_type": file_type,
                "extracted_text": "",
                "summary": "",
                "page_count": None,
                "image_description": None,
                "processing_status": "success"
            }
            
            try:
                if file_type and file_type.startswith('image/'):
                    # Process image
                    image_result = await process_image_file(file_content, file.filename, llm)
                    result.update(image_result)
                    
                elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                    # Process PDF
                    pdf_result = await process_pdf_file(file_content, file.filename, llm)
                    result.update(pdf_result)
                    
                else:
                    result["processing_status"] = "unsupported"
                    result["summary"] = f"File type {file_type} is not supported. Please upload PDF or image files."
                
            except Exception as file_error:
                print(f"Error processing file {file.filename}: {str(file_error)}")
                result["processing_status"] = "error"
                result["summary"] = f"Error processing file: {str(file_error)}"
            
            processed_files.append(result)
        
        return {
            "status": "success",
            "processed_files": processed_files,
            "total_files": len(files),
            "successful_processing": len([f for f in processed_files if f["processing_status"] == "success"])
        }
        
    except Exception as e:
        print(f"Error in file upload and processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

async def process_image_file(file_content: bytes, filename: str, llm) -> Dict:
    """Process image files - extract text and generate description"""
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(file_content))
        
        # Extract text using OCR
        extracted_text = ""
        try:
            extracted_text = pytesseract.image_to_string(image)
        except Exception as ocr_error:
            print(f"OCR failed for {filename}: {str(ocr_error)}")
            extracted_text = "OCR text extraction failed"
        
        # Generate AI description and summary
        if extracted_text.strip():
            prompt = f"""Analyze this image content that contains text. Here's the extracted text:

Text from image: {extracted_text[:2000]}

Please provide:
1. A clear description of what this image contains
2. A comprehensive summary of the text content
3. Key information or important points
4. How this content could be useful for studying

Format your response clearly with sections."""
        else:
            prompt = f"""This is an image file named '{filename}' that appears to contain visual content without readable text. 

Please provide:
1. A general description of what type of image this might be
2. Suggestions for how to better process this image
3. Recommendations for the user

Note: No text could be extracted from this image."""
        
        try:
            ai_response = llm.invoke(prompt)
            summary = ai_response
        except Exception as ai_error:
            summary = f"AI analysis failed: {str(ai_error)}"
        
        return {
            "extracted_text": extracted_text.strip() or "No text detected in image",
            "summary": summary,
            "image_description": "Image processed successfully",
            "processing_status": "success"
        }
        
    except Exception as e:
        return {
            "extracted_text": f"Error processing image: {str(e)}",
            "summary": f"Failed to process image {filename}",
            "image_description": "Image processing failed",
            "processing_status": "error"
        }

async def process_pdf_file(file_content: bytes, filename: str, llm) -> Dict:
    """Process PDF files - extract text and generate summary"""
    try:
        extracted_text = ""
        page_count = 0
        
        # Try PyMuPDF first (better for complex PDFs)
        try:
            pdf_document = fitz.open(stream=file_content, filetype="pdf")
            page_count = pdf_document.page_count
            
            for page_num in range(min(page_count, 10)):  # Limit to first 10 pages
                page = pdf_document[page_num]
                text = page.get_text()
                extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
            
            pdf_document.close()
            
        except Exception:
            # Fallback to PyPDF2
            try:
                pdf_file = io.BytesIO(file_content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                page_count = len(pdf_reader.pages)
                
                for page_num in range(min(page_count, 10)):  # Limit to first 10 pages
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
                    
            except Exception as pdf_error:
                extracted_text = f"PDF text extraction failed: {str(pdf_error)}"
        
        # Generate AI summary
        if extracted_text.strip() and len(extracted_text.strip()) > 50:
            # Truncate text for AI processing (keep first 3000 characters)
            text_for_ai = extracted_text[:3000]
            
            prompt = f"""Analyze this PDF document content and provide a comprehensive summary.

Document: {filename}
Pages: {page_count}

Content:
{text_for_ai}

Please provide:
1. **Document Overview**: What type of document this is
2. **Main Topics**: Key subjects covered
3. **Important Points**: Critical information highlighted
4. **Study Notes**: How this content can be used for learning
5. **Key Takeaways**: Most important information to remember

Format your response in clear sections with headers."""

            try:
                ai_response = llm.invoke(prompt)
                summary = ai_response
            except Exception as ai_error:
                summary = f"AI summary generation failed: {str(ai_error)}"
        else:
            summary = "PDF processed but no readable text content found or text extraction failed."
        
        return {
            "extracted_text": extracted_text[:5000] + "..." if len(extracted_text) > 5000 else extracted_text,
            "summary": summary,
            "page_count": page_count,
            "processing_status": "success"
        }
        
    except Exception as e:
        return {
            "extracted_text": f"Error processing PDF: {str(e)}",
            "summary": f"Failed to process PDF {filename}",
            "page_count": None,
            "processing_status": "error"
        }

@app.post("/ask_with_files/")
async def ask_ai_with_files(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    """Enhanced AI chat that can process files (PDFs, images) along with questions"""
    print(f"\nDEBUG: Enhanced ask_ai with files")
    print(f"user_id: {user_id}")
    print(f"question: {question[:50]}...")
    print(f"chat_id: {chat_id}")
    print(f"files: {len(files) if files else 0} files uploaded")
    
    try:
        # Convert chat_id
        chat_id_int = None
        if chat_id:
            try:
                chat_id_int = int(chat_id)
            except ValueError:
                pass
        
        # Get user
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Validate chat session
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Initialize Ollama
        llm = Ollama(model="llama3")
        
        # Process uploaded files if any
        file_context = ""
        processed_files_info = []
        
        if files:
            print(f"Processing {len(files)} uploaded files...")
            for file in files:
                if not file.filename:
                    continue
                    
                file_content = await file.read()
                file_type = file.content_type or mimetypes.guess_type(file.filename)[0]
                
                print(f"Processing file: {file.filename} (type: {file_type})")
                
                if file_type and file_type.startswith('image/'):
                    result = await process_image_file(file_content, file.filename, llm)
                elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                    result = await process_pdf_file(file_content, file.filename, llm)
                else:
                    result = {
                        "file_name": file.filename,
                        "extracted_text": f"Unsupported file type: {file_type}",
                        "summary": "This file type is not supported for processing."
                    }
                
                processed_files_info.append(result)
                
                # Add file content to context
                if result.get("extracted_text"):
                    file_context += f"\n\n--- Content from {file.filename} ---\n"
                    file_context += result["extracted_text"][:1500]  # Limit per file
        
        # Get conversation history
        recent_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()
        
        context_str = ""
        if recent_messages:
            context_str = f"\nRecent conversation history:\n"
            for msg in reversed(recent_messages):
                context_str += f"You asked: {msg.user_message[:100]}...\n"
                context_str += f"I responded: {msg.ai_response[:100]}...\n"
        
        # Build enhanced prompt with file context
        if file_context:
            ai_prompt = f"""You are a helpful AI tutor with access to uploaded documents and persistent memory.

Student Profile:
- Name: {user.first_name or 'Student'}
- Studies: {user.field_of_study or 'various subjects'}
- Learning Style: {user.learning_style or 'mixed'} learner
- Background: {user.school_university or 'General education'}

{context_str}

UPLOADED DOCUMENT CONTENT:
{file_context}

Current Question: {question}

Instructions:
1. Analyze the uploaded document(s) thoroughly
2. Reference relevant content from the documents in your response
3. Connect the documents to the student's question
4. Provide educational insights based on the document content
5. Cite specific parts of the documents when relevant
6. If the question is about the documents, provide detailed analysis
7. If the question is general, use document content to enhance your response

Provide a comprehensive, educational response that makes full use of the uploaded document content."""

        else:
            # Standard prompt without files
            ai_prompt = f"""You are a helpful AI tutor with persistent memory.

Student Profile:
- Name: {user.first_name or 'Student'}
- Studies: {user.field_of_study or 'various subjects'}  
- Learning Style: {user.learning_style or 'mixed'} learner
- Background: {user.school_university or 'General education'}

{context_str}

Current Question: {question}

Provide a helpful, personalized response that references our previous conversations and builds on what we've discussed."""
        
        print(f"Sending enhanced prompt to Ollama...")
        response = llm.invoke(ai_prompt)
        print(f"Got response from Ollama (length: {len(response)} chars)")
        
        # Store activity
        activity = models.Activity(
            user_id=user.id,
            question=question,
            answer=response,
            topic="Document Analysis" if file_context else "General"
        )
        db.add(activity)
        db.commit()
        
        # Build enhanced response
        result = {
            "answer": response,
            "ai_confidence": 0.85 if file_context else 0.75,
            "files_processed": len(processed_files_info),
            "file_summaries": processed_files_info,
            "has_file_context": bool(file_context),
            "enhanced_features_used": True,
            "memory_persistent": True
        }
        
        print(f"SUCCESS: Returning enhanced response with file processing")
        return result
        
    except Exception as e:
        print(f"ERROR in ask_ai_with_files: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "answer": f"I apologize, but I encountered an error processing your request: {str(e)}. Please try again.",
            "ai_confidence": 0.3,
            "files_processed": 0,
            "file_summaries": [],
            "has_file_context": False,
            "enhanced_features_used": False,
            "memory_persistent": False
        }

@app.post("/analyze_document/")
async def analyze_document(
    user_id: str = Form(...),
    analysis_type: str = Form("summary"),  # summary, key_points, study_guide, questions
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Dedicated document analysis endpoint for detailed processing"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        llm = Ollama(model="llama3")
        analysis_results = []
        
        for file in files:
            if not file.filename:
                continue
                
            file_content = await file.read()
            file_type = file.content_type or mimetypes.guess_type(file.filename)[0]
            
            # Process file content
            if file_type and file_type.startswith('image/'):
                processing_result = await process_image_file(file_content, file.filename, llm)
            elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                processing_result = await process_pdf_file(file_content, file.filename, llm)
            else:
                continue
            
            # Generate specific analysis based on type
            extracted_text = processing_result.get("extracted_text", "")
            
            if analysis_type == "summary":
                analysis_prompt = f"""Provide a comprehensive summary of this document:

Content: {extracted_text[:2000]}

Create a clear, well-structured summary highlighting the main points and key information."""

            elif analysis_type == "key_points":
                analysis_prompt = f"""Extract and list the key points from this document:

Content: {extracted_text[:2000]}

Provide:
1. Main concepts (numbered list)
2. Important definitions
3. Critical information
4. Notable facts or figures"""

            elif analysis_type == "study_guide":
                analysis_prompt = f"""Create a study guide from this document:

Content: {extracted_text[:2000]}

Include:
1. Learning objectives
2. Key concepts to master
3. Important terminology
4. Study questions
5. Review checklist"""

            elif analysis_type == "questions":
                analysis_prompt = f"""Generate study questions from this document:

Content: {extracted_text[:2000]}

Create:
1. 5 comprehension questions
2. 3 analysis questions  
3. 2 application questions
4. Include answer hints"""

            try:
                analysis_response = llm.invoke(analysis_prompt)
            except Exception:
                analysis_response = f"Analysis of {file.filename} completed but detailed analysis failed."
            
            analysis_results.append({
                "file_name": file.filename,
                "analysis_type": analysis_type,
                "content": analysis_response,
                "extracted_text_length": len(extracted_text),
                "page_count": processing_result.get("page_count")
            })
        
        return {
            "status": "success",
            "analysis_type": analysis_type,
            "results": analysis_results,
            "total_files_analyzed": len(analysis_results)
        }
        
    except Exception as e:
        print(f"Error in document analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {str(e)}")


@app.put("/update_note")
def update_note(note_data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_data.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.title = note_data.title
    note.content = note_data.content
    note.updated_at = datetime.utcnow()
    
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

# ==================== ACTIVITY ENDPOINTS ====================

@app.get("/get_activities")
def get_activities(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    activities = db.query(models.Activity).filter(
        models.Activity.user_id == user.id
    ).order_by(models.Activity.timestamp.desc()).all()
    
    return [
        {
            "id": activity.id,
            "question": activity.question,
            "answer": activity.answer,
            "topic": activity.topic,
            "timestamp": activity.timestamp.isoformat()
        }
        for activity in activities
    ]

@app.get("/get_recent_activities")
def get_recent_activities(user_id: str = Query(...), limit: int = Query(20), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    recent_activities = db.query(models.Activity).filter(
        models.Activity.user_id == user.id
    ).order_by(models.Activity.timestamp.desc()).limit(limit).all()
    
    return [
        {
            "question": activity.question,
            "answer": activity.answer,
            "topic": activity.topic,
            "timestamp": activity.timestamp.isoformat()
        }
        for activity in recent_activities
    ]

@app.post("/update_user_stats")
def update_user_stats(
    user_id: str = Form(...),
    lessons: int = Form(None),
    hours: float = Form(None),
    streak: int = Form(None),
    accuracy: float = Form(None),
    db: Session = Depends(get_db)
):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    stats = db.query(models.UserStats).filter(
        models.UserStats.user_id == user.id
    ).first()
    
    if not stats:
        stats = models.UserStats(user_id=user.id)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    
    if lessons is not None:
        stats.total_lessons = lessons
    if hours is not None:  
        stats.total_hours = hours
    if streak is not None:
        stats.day_streak = streak
    if accuracy is not None:
        stats.accuracy_percentage = accuracy
    
    db.commit()
    
    return {
        "message": "User stats updated successfully",
        "stats": {
            "lessons": stats.total_lessons,
            "hours": stats.total_hours, 
            "streak": stats.day_streak,
            "accuracy": stats.accuracy_percentage
        }
    }

# ==================== FLASHCARD MANAGEMENT ====================

@app.post("/create_flashcard_set")
def create_flashcard_set(set_data: FlashcardSetCreate, db: Session = Depends(get_db)):
    user = get_user_by_username(db, set_data.user_id)
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

# ==================== NOTE MANAGEMENT ENDPOINTS ====================

@app.post("/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
    """Create a new note for a user"""
    try:
        user = get_user_by_username(db, note_data.user_id)
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
        print(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@app.post("/create_note_form")
def create_note_form(
    user_id: str = Form(...),
    title: str = Form(...),
    content: str = Form(""),
    db: Session = Depends(get_db)
):
    """Create a new note using form data"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_note = models.Note(
            user_id=user.id,
            title=title,
            content=content
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
        print(f"Error creating note via form: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@app.post("/save_note")
def save_note(
    user_id: str = Form(...),
    title: str = Form(...),
    content: str = Form(""),
    note_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Save a note (create new or update existing)"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if note_id:
            # Update existing note
            note = db.query(models.Note).filter(
                models.Note.id == note_id,
                models.Note.user_id == user.id
            ).first()
            
            if not note:
                raise HTTPException(status_code=404, detail="Note not found")
            
            note.title = title
            note.content = content
            note.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(note)
            
            return {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "updated_at": note.updated_at.isoformat(),
                "status": "success",
                "message": "Note updated successfully",
                "action": "updated"
            }
        else:
            # Create new note
            new_note = models.Note(
                user_id=user.id,
                title=title,
                content=content
            )
            db.add(new_note)
            db.commit()
            db.refresh(new_note)
            
            return {
                "id": new_note.id,
                "title": new_note.title,
                "content": new_note.content,
                "created_at": new_note.created_at.isoformat(),
                "updated_at": new_note.updated_at.isoformat(),
                "status": "success",
                "message": "Note created successfully",
                "action": "created"
            }
            
    except Exception as e:
        print(f"Error saving note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save note: {str(e)}")

@app.get("/get_note/{note_id}")
def get_note(note_id: int, db: Session = Depends(get_db)):
    """Get a specific note by ID"""
    try:
        note = db.query(models.Note).filter(models.Note.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "user_id": note.user_id,
            "created_at": note.created_at.isoformat(),
            "updated_at": note.updated_at.isoformat()
        }
        
    except Exception as e:
        print(f"Error getting note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get note: {str(e)}")

@app.get("/get_flashcard_sets")
def get_flashcard_sets(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).all()
    
    result = []
    for flashcard_set in flashcard_sets:
        # Count cards in each set
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
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all flashcard sets with their recent activity
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).order_by(models.FlashcardSet.updated_at.desc()).limit(limit).all()
    
    history = []
    for flashcard_set in flashcard_sets:
        # Get card count
        card_count = db.query(models.Flashcard).filter(
            models.Flashcard.set_id == flashcard_set.id
        ).count()
        
        # Get recent study sessions for this set
        recent_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).order_by(models.FlashcardStudySession.session_date.desc()).limit(3).all()
        
        # Calculate total study time and performance
        total_sessions = db.query(models.FlashcardStudySession).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).count()
        
        total_study_time = db.query(models.FlashcardStudySession.session_duration).filter(
            models.FlashcardStudySession.set_id == flashcard_set.id
        ).all()
        
        avg_study_time = sum(duration[0] for duration in total_study_time) / len(total_study_time) if total_study_time else 0
        
        # Calculate accuracy
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
            "last_studied": recent_sessions[0].session_date.isoformat() if recent_sessions else None,
            "recent_sessions": [
                {
                    "session_date": session.session_date.isoformat(),
                    "cards_studied": session.cards_studied,
                    "correct_answers": session.correct_answers,
                    "session_duration": session.session_duration,
                    "accuracy": round((session.correct_answers / session.cards_studied * 100), 1) if session.cards_studied > 0 else 0
                }
                for session in recent_sessions
            ]
        })
    
    return {
        "total_sets": len(history),
        "flashcard_history": history
    }

@app.post("/record_flashcard_study_session")
def record_flashcard_study_session(session_data: FlashcardStudySession, db: Session = Depends(get_db)):
    user = get_user_by_username(db, session_data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == session_data.set_id,
        models.FlashcardSet.user_id == user.id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Record the study session
    study_session = models.FlashcardStudySession(
        set_id=session_data.set_id,
        user_id=user.id,
        cards_studied=session_data.cards_studied,
        correct_answers=session_data.correct_answers,
        session_duration=session_data.session_duration
    )
    db.add(study_session)
    
    # Update flashcard set timestamp
    flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(study_session)
    
    return {
        "session_id": study_session.id,
        "accuracy": round((session_data.correct_answers / session_data.cards_studied * 100), 1) if session_data.cards_studied > 0 else 0,
        "status": "success",
        "message": "Study session recorded successfully"
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
    flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(flashcard_set)
    
    return {
        "id": flashcard_set.id,
        "title": flashcard_set.title,
        "description": flashcard_set.description,
        "updated_at": flashcard_set.updated_at.isoformat(),
        "status": "success"
    }

@app.put("/update_flashcard")
def update_flashcard(card_data: FlashcardUpdate, db: Session = Depends(get_db)):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == card_data.flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    flashcard.question = card_data.question
    flashcard.answer = card_data.answer
    flashcard.difficulty = card_data.difficulty
    flashcard.category = card_data.category
    flashcard.updated_at = datetime.utcnow()
    
    # Update the set's timestamp too
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == flashcard.set_id
    ).first()
    if flashcard_set:
        flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(flashcard)
    
    return {
        "id": flashcard.id,
        "question": flashcard.question,
        "answer": flashcard.answer,
        "difficulty": flashcard.difficulty,
        "category": flashcard.category,
        "updated_at": flashcard.updated_at.isoformat(),
        "status": "success"
    }

@app.delete("/delete_flashcard/{flashcard_id}")
def delete_flashcard(flashcard_id: int, db: Session = Depends(get_db)):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    set_id = flashcard.set_id
    db.delete(flashcard)
    
    # Update the set's timestamp
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if flashcard_set:
        flashcard_set.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Flashcard deleted successfully"}

@app.delete("/delete_flashcard_set/{set_id}")
def delete_flashcard_set(set_id: int, db: Session = Depends(get_db)):
    flashcard_set = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.id == set_id
    ).first()
    if not flashcard_set:
        raise HTTPException(status_code=404, detail="Flashcard set not found")
    
    # Delete all flashcards in the set
    db.query(models.Flashcard).filter(models.Flashcard.set_id == set_id).delete()
    
    # Delete all study sessions for this set
    db.query(models.FlashcardStudySession).filter(models.FlashcardStudySession.set_id == set_id).delete()
    
    # Delete the set itself
    db.delete(flashcard_set)
    db.commit()
    
    return {"message": "Flashcard set and all associated data deleted successfully"}

@app.post("/mark_flashcard_reviewed")
def mark_flashcard_reviewed(
    flashcard_id: int = Form(...),
    correct: bool = Form(...),
    db: Session = Depends(get_db)
):
    flashcard = db.query(models.Flashcard).filter(
        models.Flashcard.id == flashcard_id
    ).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    # Update flashcard review stats
    flashcard.times_reviewed += 1
    flashcard.last_reviewed = datetime.utcnow()
    
    if correct:
        flashcard.correct_count += 1
    
    # Calculate new accuracy
    accuracy = (flashcard.correct_count / flashcard.times_reviewed * 100) if flashcard.times_reviewed > 0 else 0
    
    db.commit()
    
    return {
        "flashcard_id": flashcard_id,
        "times_reviewed": flashcard.times_reviewed,
        "correct_count": flashcard.correct_count,
        "accuracy": round(accuracy, 1),
        "last_reviewed": flashcard.last_reviewed.isoformat(),
        "status": "success"
    }

@app.get("/get_flashcard_statistics")
def get_flashcard_statistics(user_id: str = Query(...), db: Session = Depends(get_db)):
    user = get_user_by_username(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Total sets and cards
    total_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    total_cards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    # Study sessions
    total_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).count()
    
    # Total study time
    total_time_result = db.query(models.FlashcardStudySession.session_duration).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    total_study_time = sum(duration[0] for duration in total_time_result)
    
    # Overall accuracy
    all_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id
    ).all()
    
    total_cards_studied = sum(session.cards_studied for session in all_sessions)
    total_correct = sum(session.correct_answers for session in all_sessions)
    overall_accuracy = (total_correct / total_cards_studied * 100) if total_cards_studied > 0 else 0
    
    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id,
        models.FlashcardStudySession.session_date >= week_ago
    ).count()
    
    # Most studied sets - FIXED: Use func.count instead of db.func.count
    most_studied_sets = db.query(
        models.FlashcardSet.title,
        func.count(models.FlashcardStudySession.id).label('session_count')
    ).join(models.FlashcardStudySession).filter(
        models.FlashcardSet.user_id == user.id
    ).group_by(models.FlashcardSet.id).order_by(
        func.count(models.FlashcardStudySession.id).desc()
    ).limit(5).all()
    
    return {
        "total_sets": total_sets,
        "total_cards": total_cards,
        "total_study_sessions": total_sessions,
        "total_study_time_minutes": total_study_time,
        "overall_accuracy": round(overall_accuracy, 1),
        "recent_sessions_week": recent_sessions,
        "most_studied_sets": [
            {"title": title, "session_count": count}
            for title, count in most_studied_sets
        ],
        "average_session_time": round(total_study_time / total_sessions, 1) if total_sessions > 0 else 0
    }

# ==================== AI FLASHCARD GENERATION ====================

@app.post("/generate_flashcards_advanced/")
async def generate_flashcards_advanced(
    user_id: str = Form(...),
    generation_type: str = Form("topic"),
    topic: str = Form(None),
    chat_data: str = Form(None),
    note_content: str = Form(None),
    difficulty_level: str = Form("medium"),
    card_count: int = Form(10),
    save_to_set: bool = Form(True),
    set_title: str = Form(None),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        llm = Ollama(model="llama3")
        
        # Build content based on generation type
        content_source = ""
        source_type = generation_type
        source_description = ""
        
        if generation_type == "topic" and topic:
            content_source = f"Topic: {topic}"
            source_description = f"Generated from topic: {topic}"
            
        elif generation_type == "chat_history" and chat_data:
            try:
                chat_messages = json.loads(chat_data)
                conversation_content = []
                for msg in chat_messages[:30]:
                    conversation_content.append(f"Q: {msg.get('user_message', '')}")
                    conversation_content.append(f"A: {msg.get('ai_response', '')}")
                content_source = "\n".join(conversation_content)
                source_description = f"Generated from {len(chat_messages)} chat messages"
            except json.JSONDecodeError:
                content_source = "Invalid chat data"
                
        elif generation_type == "notes" and note_content:
            content_source = note_content[:2000]
            source_description = f"Generated from study notes"
            
        elif generation_type == "mixed":
            sources = []
            if topic:
                sources.append(f"Topic: {topic}")
            if chat_data:
                try:
                    chat_messages = json.loads(chat_data)
                    conversation_content = []
                    for msg in chat_messages[:15]:
                        conversation_content.append(f"Q: {msg.get('user_message', '')}")
                        conversation_content.append(f"A: {msg.get('ai_response', '')}")
                    sources.append("Chat History:\n" + "\n".join(conversation_content))
                except:
                    pass
            if note_content:
                sources.append(f"Notes:\n{note_content[:1000]}")
            
            content_source = "\n\n---\n\n".join(sources)
            source_description = f"Generated from multiple sources"
        
        if not content_source or content_source.strip() == "":
            return {
                "flashcards": [
                    {
                        "question": "Error: No content provided",
                        "answer": "Please provide topic, chat history, or notes to generate flashcards"
                    }
                ]
            }
        
        # Build AI prompt based on difficulty and content
        difficulty_instruction = {
            "easy": "Create simple recall questions with straightforward answers.",
            "medium": "Create questions that test understanding and application of concepts.",
            "hard": "Create challenging questions that require critical thinking and analysis.",
            "mixed": "Create a mix of easy, medium, and hard questions."
        }.get(difficulty_level, "Create questions appropriate for the content.")
        
        prompt = f"""You are an expert educational content creator. Generate exactly {card_count} high-quality flashcards based on the following content.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Difficulty Level: {difficulty_level}
Instructions: {difficulty_instruction}

Content Source:
{content_source}

Requirements:
- Create exactly {card_count} flashcards
- Focus on key concepts, definitions, processes, and applications
- Make questions clear and specific
- Provide complete, accurate answers
- Vary question types (definitions, explanations, applications, comparisons)
- Include the difficulty level for each card

Format your response as a JSON array:
[
  {{
    "question": "What is...",
    "answer": "The answer is...",
    "difficulty": "easy|medium|hard",
    "category": "concept|definition|application|process"
  }}
]

Generate {card_count} educational flashcards in JSON format:"""

        response = llm.invoke(prompt)
        print(f"AI Response for flashcards: {response[:200]}...")
        
        # Parse JSON response
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            try:
                flashcards_data = json.loads(json_str)
                
                valid_flashcards = []
                for i, card in enumerate(flashcards_data[:card_count]):
                    if isinstance(card, dict) and 'question' in card and 'answer' in card:
                        valid_flashcards.append({
                            'question': str(card['question']).strip(),
                            'answer': str(card['answer']).strip(),
                            'difficulty': str(card.get('difficulty', difficulty_level)).strip(),
                            'category': str(card.get('category', 'general')).strip()
                        })
                
                if len(valid_flashcards) > 0:
                    # Save to database if requested
                    if save_to_set:
                        # Create flashcard set
                        if not set_title:
                            if generation_type == "topic" and topic:
                                set_title = f"Flashcards: {topic}"
                            elif generation_type == "chat_history":
                                set_title = f"Chat Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                            elif generation_type == "notes":
                                set_title = f"Note Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                            else:
                                set_title = f"Generated Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                        
                        flashcard_set = models.FlashcardSet(
                            user_id=user.id,
                            title=set_title,
                            description=source_description,
                            source_type=source_type
                        )
                        db.add(flashcard_set)
                        db.commit()
                        db.refresh(flashcard_set)
                        
                        # Add flashcards to set
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
                
            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                print(f"Attempted to parse: {json_str[:300]}...")
        
        # Fallback response
        fallback_source = topic or "this content"
        return {
            "flashcards": [
                {
                    "question": f"What is a key concept from {fallback_source}?",
                    "answer": "This is a fundamental concept that requires further study. Please try generating again or provide more specific content.",
                    "difficulty": difficulty_level,
                    "category": "general"
                },
                {
                    "question": f"How would you apply knowledge about {fallback_source}?",
                    "answer": "Consider practical applications and real-world examples of this concept.",
                    "difficulty": difficulty_level,
                    "category": "application"
                }
            ],
            "saved_to_set": False,
            "status": "fallback"
        }
        
    except Exception as e:
        print(f"Error in generate_flashcards_advanced: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "flashcards": [
                {
                    "question": f"Error generating flashcards",
                    "answer": f"There was an error: {str(e)}. Please try again with different content.",
                    "difficulty": "medium",
                    "category": "error"
                }
            ],
            "saved_to_set": False,
            "status": "error"
        }

@app.post("/generate_flashcards/")
async def generate_flashcards(
    user_id: str = Form(...),
    topic: str = Form(None),
    generation_type: str = Form("topic"),
    chat_data: str = Form(None),
    db: Session = Depends(get_db)
):
    """Generate flashcards from topic or chat history - Original endpoint for compatibility"""
    try:
        # Use the new advanced endpoint internally
        return await generate_flashcards_advanced(
            user_id=user_id,
            generation_type=generation_type,
            topic=topic,
            chat_data=chat_data,
            note_content=None,
            difficulty_level="medium",
            card_count=10,
            save_to_set=False,
            set_title=None,
            db=db
        )
        
    except Exception as e:
        print(f"Error in generate_flashcards: {str(e)}")
        return {
            "flashcards": [
                {
                    "question": f"What would you like to learn about {topic or 'this topic'}?",
                    "answer": "Please try again or ask specific questions about this topic in the AI chat first."
                }
            ]
        }

# ==================== ENHANCED FEATURES ====================

@app.post("/rate_response")
def rate_ai_response(
    user_id: str = Form(...),
    message_id: int = Form(...),
    rating: int = Form(...),
    feedback_text: str = Form(None),
    improvement_suggestion: str = Form(None),
    db: Session = Depends(get_db)
):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {"status": "error", "message": "Enhanced features not available"}
    
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        global_ai = GlobalAILearningSystem(db)
        success = global_ai.process_user_feedback(
            user.id, message_id, rating, feedback_text, improvement_suggestion
        )
        
        if success:
            return {
                "status": "success",
                "message": "Feedback recorded and AI learning updated",
                "global_impact": True
            }
        else:
            return {"status": "error", "message": "Could not process feedback"}
    
    except Exception as e:
        print(f"Error processing feedback: {str(e)}")
        return {"status": "error", "message": "Error processing feedback"}

@app.get("/ai_metrics")
def get_ai_metrics(db: Session = Depends(get_db)):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {
            "daily_metrics": {"total_interactions": 0, "successful_interactions": 0, "average_rating": 0.0},
            "overall_metrics": {"total_feedback_received": 0, "knowledge_base_entries": 0, "average_user_rating": 0.0},
            "learning_status": {"is_learning": False, "improvement_rate": 0.0}
        }
    
    try:
        today = datetime.now().date()
        today_metrics = db.query(models.AILearningMetrics).filter(
            models.AILearningMetrics.date >= datetime.combine(today, datetime.min.time())
        ).first()
        
        total_feedback = db.query(models.UserFeedback).count()
        knowledge_entries = db.query(models.GlobalKnowledgeBase).filter(
            models.GlobalKnowledgeBase.is_active == True
        ).count()
        
        avg_rating_result = db.query(models.UserFeedback.rating).filter(
            models.UserFeedback.rating.isnot(None)
        ).all()
        avg_rating = sum(r[0] for r in avg_rating_result) / len(avg_rating_result) if avg_rating_result else 0.0
        
        return {
            "daily_metrics": {
                "total_interactions": today_metrics.total_interactions if today_metrics else 0,
                "successful_interactions": today_metrics.successful_interactions if today_metrics else 0,
                "average_rating": today_metrics.average_response_rating if today_metrics else 0.0
            },
            "overall_metrics": {
                "total_feedback_received": total_feedback,
                "knowledge_base_entries": knowledge_entries,
                "average_user_rating": round(avg_rating, 2)
            },
            "learning_status": {
                "is_learning": True,
                "improvement_rate": 85.0
            }
        }
    
    except Exception as e:
        print(f"Error getting AI metrics: {str(e)}")
        return {"error": "Could not retrieve AI metrics"}

@app.get("/conversation_starters")
def get_conversation_starters(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        suggestions = []
        
        if user.field_of_study:
            field = user.field_of_study
            suggestions.extend([
                f"What's a fundamental concept in {field}?",
                f"Can you explain a {field} concept that many students find confusing?",
                f"What are some real-world applications of {field}?"
            ])
        
        suggestions.extend([
            "What's something fascinating I probably don't know?",
            "Can you explain a concept using a simple analogy?",
            "Help me understand something that seems counterintuitive",
            "What's a common misconception in my field of study?",
            "Can you give me a challenging problem to solve?",
            "What's the most important thing to know about my subject?"
        ])
        
        import random
        random.shuffle(suggestions)
        return {"suggestions": suggestions[:8]}
        
    except Exception as e:
        print(f"Error getting conversation starters: {str(e)}")
        return {"suggestions": ["What would you like to learn today?"]}

@app.get("/personalization_insights")
def get_personalization_insights(user_id: str = Query(...), db: Session = Depends(get_db)):
    if not ENHANCED_FEATURES_AVAILABLE:
        return {
            "personalization_confidence": 0.0,
            "learning_style": {"primary": "balanced"},
            "migration_status": "not_run"
        }
    
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            profile = db.query(models.UserPersonalityProfile).filter(
                models.UserPersonalityProfile.user_id == user.id
            ).first()
            
            topic_masteries = db.query(models.TopicMastery).filter(
                models.TopicMastery.user_id == user.id
            ).order_by(models.TopicMastery.mastery_level.desc()).limit(10).all()
            
            insights = {
                "personalization_confidence": profile.profile_confidence if profile else 0.0,
                "learning_style": {
                    "primary": "Visual" if profile and profile.visual_learner_score > 0.6 else "balanced",
                    "visual_score": profile.visual_learner_score if profile else 0.5,
                    "auditory_score": profile.auditory_learner_score if profile else 0.5,
                    "kinesthetic_score": profile.kinesthetic_learner_score if profile else 0.5,
                    "reading_score": profile.reading_learner_score if profile else 0.5
                },
                "topic_expertise": [
                    {
                        "topic": mastery.topic_name.replace('_', ' ').title(),
                        "mastery_level": mastery.mastery_level,
                        "times_studied": mastery.times_studied
                    }
                    for mastery in topic_masteries
                ],
                "migration_status": "completed"
            }
            
            return insights
            
        except Exception as table_error:
            return {
                "personalization_confidence": 0.0,
                "learning_style": {"primary": "balanced"},
                "migration_status": "not_run"
            }
        
    except Exception as e:
        print(f"Error getting personalization insights: {str(e)}")
        return {
            "personalization_confidence": 0.0,
            "error": "Could not retrieve personalization data"
        }

@app.post("/save_chat_message")
def save_chat_message_enhanced(message_data: ChatMessageSave, db: Session = Depends(get_db)):
    print(f"Saving message with enhanced features...")
    
    chat_session = db.query(models.ChatSession).filter(
        models.ChatSession.id == message_data.chat_id
    ).first()
    if not chat_session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Create basic chat message
    chat_message = models.ChatMessage(
        chat_session_id=message_data.chat_id,
        user_message=message_data.user_message,
        ai_response=message_data.ai_response
    )
    
    # Add enhanced fields if available
    if ENHANCED_FEATURES_AVAILABLE:
        try:
            # Get user from chat session
            user = db.query(models.User).filter(models.User.id == chat_session.user_id).first()
            if user:
                # Initialize personalization engine
                personalization = PersonalizationEngine(db, user.id)
                
                # Analyze the interaction
                analysis = personalization.analyze_user_message(message_data.user_message)
                
                # Store the interaction in personalization system
                personalization.post_interaction_update(
                    user_message=message_data.user_message,
                    ai_response=message_data.ai_response,
                    user_feedback=None,  # Will be updated when user rates
                    interaction_duration=1.0,  # Default duration
                    topics_discussed=analysis.get('topics', ['general'])
                )
                
                print(f"Enhanced personalization data stored")
                
        except Exception as e:
            print(f"Enhanced analysis failed: {e}")
    
    db.add(chat_message)
    
    # Update session timestamp
    chat_session.updated_at = datetime.utcnow()
    
    # Auto-generate title for new chats
    message_count = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == message_data.chat_id
    ).count()
    
    if chat_session.title == "New Chat" and message_count == 0:
        user_message = message_data.user_message.strip()
        words = user_message.split()
        
        if len(words) <= 4:
            new_title = user_message
        else:
            new_title = " ".join(words[:4]) + "..."
        
        new_title = new_title[0].upper() + new_title[1:] if new_title else "New Chat"
        new_title = new_title[:50]
        chat_session.title = new_title
    
    db.commit()
    print("Message saved with enhanced features!")
    return {"status": "success", "message": "Message saved successfully"}

@app.get("/get_chat_history_enhanced/{session_id}")
async def get_chat_history_enhanced(session_id: str, db: Session = Depends(get_db)):
    try:
        session_id_int = int(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id_int
    ).order_by(models.ChatMessage.timestamp.asc()).all()
    
    enhanced_messages = []
    for msg in messages:
        message_data = {
            "user_message": msg.user_message,
            "ai_response": msg.ai_response,
            "timestamp": msg.timestamp.isoformat()
        }
        
        # Add enhanced fields if available
        if hasattr(msg, 'ai_confidence') and msg.ai_confidence:
            message_data["ai_confidence"] = msg.ai_confidence
            message_data["should_request_feedback"] = msg.ai_confidence < 0.7
        else:
            message_data["ai_confidence"] = 0.8
            message_data["should_request_feedback"] = False
        
        enhanced_messages.append(message_data)
    
    return {
        "session_id": session_id,
        "messages": enhanced_messages
    }

@app.get("/system_status")
def get_system_status(db: Session = Depends(get_db)):
    status = {
        "basic_features": True,
        "enhanced_features": ENHANCED_FEATURES_AVAILABLE,
        "database_tables": {}
    }
    
    # Check basic tables
    try:
        status["database_tables"]["users"] = db.query(models.User).count()
        status["database_tables"]["chat_sessions"] = db.query(models.ChatSession).count()
        status["database_tables"]["chat_messages"] = db.query(models.ChatMessage).count()
        status["database_tables"]["activities"] = db.query(models.Activity).count()
        status["database_tables"]["notes"] = db.query(models.Note).count()
        status["database_tables"]["user_stats"] = db.query(models.UserStats).count()
        status["database_tables"]["flashcard_sets"] = db.query(models.FlashcardSet).count()
        status["database_tables"]["flashcards"] = db.query(models.Flashcard).count()
        status["database_tables"]["flashcard_study_sessions"] = db.query(models.FlashcardStudySession).count()
    except Exception as e:
        status["basic_tables_error"] = str(e)
    
    # Check enhanced tables if available
    if ENHANCED_FEATURES_AVAILABLE:
        try:
            status["database_tables"]["global_knowledge_base"] = db.query(models.GlobalKnowledgeBase).count()
            status["database_tables"]["user_feedback"] = db.query(models.UserFeedback).count()
            status["database_tables"]["ai_learning_metrics"] = db.query(models.AILearningMetrics).count()
            status["migration_status"] = "completed"
        except Exception as e:
            status["migration_status"] = "tables_missing"
            status["enhanced_tables_error"] = str(e)
    else:
        status["migration_status"] = "not_run"
        status["recommendation"] = "Run 'python migration.py' to enable enhanced features"
    
    return status

# ==================== DEBUG AND TESTING ENDPOINTS ====================

@app.get("/test_ollama")
def test_ollama():
    try:
        llm = Ollama(model="llama3")
        response = llm.invoke("Say hello!")
        return {"status": "success", "response": response}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/debug/users")
async def debug_users(db: Session = Depends(get_db)):
    try:
        users = db.query(models.User).all()
        return {
            "user_count": len(users),
            "users": [
                {
                    "id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "username": user.username,
                    "google_user": user.google_user
                } for user in users
            ]
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/create-test-user")
async def create_test_user(db: Session = Depends(get_db)):
    try:
        existing_user = get_user_by_username(db, 'testuser')
        if existing_user:
            return {"message": "Test user already exists", "username": "testuser", "password": "testpass"}
        
        hashed_password = get_password_hash('testpass')
        test_user = models.User(
            first_name='Test',
            last_name='User',
            email='testuser@example.com',
            username='testuser',
            hashed_password=hashed_password,
            age=25,
            field_of_study='Computer Science',
            learning_style='Visual',
            school_university='Test University',
            google_user=False
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        
        user_stats = models.UserStats(user_id=test_user.id)
        db.add(user_stats)
        db.commit()
        
        return {
            "message": "Test user created successfully", 
            "username": "testuser", 
            "password": "testpass",
            "profile": {
                "first_name": "Test",
                "last_name": "User",
                "email": "testuser@example.com",
                "age": 25,
                "field_of_study": "Computer Science",
                "learning_style": "Visual",
                "school_university": "Test University"
            },
            "instructions": "You can now login with these credentials"
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/reset-db")
async def reset_database(db: Session = Depends(get_db)):
    try:
        db.query(models.ChatMessage).delete()
        db.query(models.ChatSession).delete()
        db.query(models.Activity).delete()
        db.query(models.Note).delete()
        db.query(models.UserStats).delete()
        
        # Delete flashcard data
        db.query(models.FlashcardStudySession).delete()
        db.query(models.Flashcard).delete()
        db.query(models.FlashcardSet).delete()
        
        db.query(models.User).delete()
        
        db.commit()
        
        return {"message": "Database tables cleared successfully"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/tables")
async def debug_tables(db: Session = Depends(get_db)):
    try:
        result = {
            "tables": {
                "users": db.query(models.User).count(),
                "chat_sessions": db.query(models.ChatSession).count(),
                "chat_messages": db.query(models.ChatMessage).count(),
                "activities": db.query(models.Activity).count(),
                "notes": db.query(models.Note).count(),
                "user_stats": db.query(models.UserStats).count(),
                "flashcard_sets": db.query(models.FlashcardSet).count(),
                "flashcards": db.query(models.Flashcard).count(),
                "flashcard_study_sessions": db.query(models.FlashcardStudySession).count()
            }
        }
        return result
    except Exception as e:
        return {"error": str(e)}

@app.get("/debug/test-auth")
async def debug_test_auth(username: str, password: str, db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    return {
        "username": username,
        "password_provided": bool(password),
        "authentication_result": bool(user),
        "user_data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "google_user": user.google_user
        } if user else None
    }

@app.get("/debug/ollama")
def debug_ollama():
    try:
        import requests
        
        # Test direct Ollama API connection
        try:
            response = requests.get("http://localhost:11434/api/version", timeout=5)
            if response.status_code == 200:
                ollama_status = "connected"
                ollama_version = response.json()
            else:
                ollama_status = f"error_status_{response.status_code}"
                ollama_version = None
        except requests.exceptions.ConnectionError:
            ollama_status = "connection_refused"
            ollama_version = None
        except requests.exceptions.Timeout:
            ollama_status = "timeout"
            ollama_version = None
        except Exception as e:
            ollama_status = f"error_{str(e)}"
            ollama_version = None
        
        # Test langchain Ollama
        try:
            from langchain_community.llms import Ollama
            llm = Ollama(model="llama3")
            test_response = llm.invoke("Say 'test successful'")
            langchain_status = "working"
            langchain_response = test_response[:100] + "..." if len(test_response) > 100 else test_response
        except Exception as e:
            langchain_status = f"error_{str(e)}"
            langchain_response = None
        
        return {
            "ollama_api": {
                "status": ollama_status,
                "version": ollama_version
            },
            "langchain_ollama": {
                "status": langchain_status,
                "test_response": langchain_response
            },
            "recommendations": [
                "Check if Ollama is running: 'ollama serve'",
                "Verify llama3 model is installed: 'ollama list'",
                "Install llama3 if missing: 'ollama pull llama3'",
                "Check port 11434 is available: 'lsof -i :11434'"
            ]
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "status": "debug_failed"
        }

@app.get("/test_simple_ollama")
def test_simple_ollama():
    try:
        from langchain_community.llms import Ollama
        llm = Ollama(model="llama3")
        response = llm.invoke("Just say hello")
        return {
            "status": "success",
            "response": response,
            "message": "Ollama is working correctly"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Ollama is not working properly"
        }
    
# Add this endpoint to your existing backend file (after the other endpoints)

@app.post("/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db)
):
    """Generate AI-enhanced note summaries from chat conversations"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        llm = Ollama(model="llama3")
        
        # Parse session titles
        try:
            titles = json.loads(session_titles)
        except:
            titles = ["Chat Session"]
        
        # Build prompt based on import mode
        if import_mode == "summary":
            prompt = f"""You are an expert educational content creator. Convert the following chat conversations into well-structured study notes.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Learning Style: {user.learning_style or 'mixed'} learner

Requirements:
- Create comprehensive study notes in markdown format
- Use proper headers (# ## ###) for organization
- Bold important concepts and definitions
- Use bullet points for key information
- Include examples where relevant
- Structure content for easy review and studying
- Focus on educational value and clarity

Chat Conversations:
{conversation_data[:4000]}

Create a well-structured study note document with:
1. Clear title
2. Main topics as headers
3. Key concepts in bold
4. Important definitions highlighted
5. Examples and explanations
6. Summary sections

Format the response as JSON with 'title' and 'content' fields:"""

        elif import_mode == "exam_prep":
            prompt = f"""You are an expert exam preparation specialist. Transform the following chat conversations into a comprehensive exam preparation guide.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Learning Style: {user.learning_style or 'mixed'} learner

Create an exam-focused study guide with:

1. **Executive Summary** - Key topics overview
2. **Learning Objectives** - What the student should master
3. **Core Concepts** - Main topics broken down systematically
4. **Key Definitions** - Important terms and their meanings
5. **Study Strategies** - How to approach each topic
6. **Practice Questions** - Self-assessment opportunities
7. **Quick Review Checklist** - Final exam preparation
8. **Time Management** - Suggested study schedule

Use markdown formatting with:
- # for main sections
- ## for subsections
- ### for detailed topics
- **bold** for key terms
- *italic* for emphasis
- > blockquotes for important notes
- - bullet points for lists
- 1. numbered lists for procedures

Chat Conversations:
{conversation_data[:4000]}

Format as JSON with 'title' and 'content' fields:"""

        else:  # full transcript
            prompt = f"""Convert the following chat conversations into a well-formatted transcript document for {user.first_name or 'Student'}.

Create a clean, readable transcript with:
- Clear headers for each session
- Proper formatting for questions and answers
- Timestamps where available
- Organized structure for easy reference

Chat Conversations:
{conversation_data[:4000]}

Format as JSON with 'title' and 'content' fields:"""

        response = llm.invoke(prompt)
        
        # Try to extract JSON from response
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except json.JSONDecodeError:
                pass
        
        # Fallback: Generate structured content manually
        if import_mode == "summary":
            title = f"Study Notes - {len(titles)} Session(s)"
            content = generate_enhanced_summary_content(conversation_data, titles, user)
        elif import_mode == "exam_prep":
            title = f"Exam Prep Guide - {len(titles)} Session(s)"
            content = generate_enhanced_exam_prep_content(conversation_data, titles, user)
        else:
            title = f"Chat Transcript - {len(titles)} Session(s)"
            content = generate_enhanced_transcript_content(conversation_data, titles)
        
        return {
            "title": title,
            "content": content
        }
        
    except Exception as e:
        print(f"Error generating note summary: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate note summary: {str(e)}")

def generate_enhanced_summary_content(conversation_data, titles, user):
    """Generate enhanced summary content with better formatting"""
    content = f"""# Study Notes from AI Chat Sessions

**Student:** {user.first_name} {user.last_name}
**Field of Study:** {user.field_of_study or 'General'}
**Learning Style:** {user.learning_style or 'Mixed'}
**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}

---

## Overview

This document contains key concepts and explanations from {len(titles)} chat session(s). The content has been organized for optimal study and review.

### How to Use This Study Guide

1. **First Read:** Go through all sections to get an overview
2. **Deep Study:** Focus on concepts marked as important
3. **Review:** Use the summary sections for quick refreshers
4. **Practice:** Apply concepts to real-world examples

---

## Key Topics and Concepts

"""
    
    # Parse conversation data and extract key points
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Session {i + 1}"
            
        content += f"### {session_title}\n\n"
        
        # Extract Q&A pairs
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        for j, (question, answer) in enumerate(qa_pairs[:5]):  # Limit to 5 Q&As per session
            content += f"#### Question {j + 1}\n\n"
            content += f"**Q:** {question.strip()}\n\n"
            
            # Extract key points from answer (first 200 words)
            answer_words = answer.strip().split()[:200]
            key_answer = " ".join(answer_words)
            
            content += f"**Key Points:**\n\n"
            content += f"{key_answer}...\n\n"
            content += f"**Study Focus:** Review and understand this concept thoroughly\n\n"
            content += "---\n\n"
    
    content += f"""## Study Recommendations

### Active Learning Techniques
- **Summarize** each concept in your own words
- **Create connections** between different topics
- **Practice application** with real-world examples
- **Teach others** to reinforce your understanding

### Review Strategy
- **Daily Review:** 15-20 minutes of concept review
- **Weekly Deep Dive:** 1-2 hours of intensive study
- **Monthly Assessment:** Test your knowledge comprehensively

### Memory Aids
- Create **flashcards** for key definitions
- Use **mind maps** to connect related concepts
- Practice **spaced repetition** for long-term retention

---

## Quick Reference Checklist

**Before Your Next Study Session:**
"""
    
    for i, title in enumerate(titles):
        content += f"- [ ] Review concepts from {title}\n"
    
    content += """- [ ] Complete practice exercises
- [ ] Review key definitions
- [ ] Test understanding with examples

**Study Progress Tracking:**
- [ ] Initial reading completed
- [ ] Deep study completed  
- [ ] Practice exercises completed
- [ ] Ready for assessment

---

*Generated by Brainwave AI Study Assistant*
"""
    
    return content

def generate_enhanced_exam_prep_content(conversation_data, titles, user):
    """Generate comprehensive exam preparation guide"""
    content = f"""# Comprehensive Exam Preparation Guide

**Student:** {user.first_name} {user.last_name}
**Subject:** {user.field_of_study or 'General Studies'}
**Preparation Date:** {datetime.now().strftime('%B %d, %Y')}
**Source:** {len(titles)} AI Chat Session(s)

---

## Executive Summary

This comprehensive exam preparation guide synthesizes key concepts from your AI chat sessions into a structured study plan. The guide is designed to maximize your exam performance through systematic review and practice.

### Quick Stats
- **Total Sessions Analyzed:** {len(titles)}
- **Estimated Study Time:** 8-12 hours
- **Recommended Study Period:** 2-3 weeks
- **Difficulty Level:** Intermediate to Advanced

---

## Learning Objectives

By the end of your study using this guide, you should be able to:

1. **Understand** core concepts from all chat sessions
2. **Apply** theoretical knowledge to practical problems
3. **Analyze** complex scenarios using learned principles
4. **Synthesize** information from multiple sources
5. **Evaluate** different approaches and solutions

---

## Study Schedule

### Week 1: Foundation Building
- **Days 1-2:** Initial reading of all concepts (2-3 hours)
- **Days 3-4:** Deep dive into challenging topics (3-4 hours)
- **Days 5-7:** Practice and application exercises (2-3 hours)

### Week 2: Intensive Review
- **Days 8-10:** Comprehensive review of all materials (4-5 hours)
- **Days 11-12:** Mock tests and self-assessment (2-3 hours)
- **Days 13-14:** Final review and weak area focus (2-3 hours)

---

## Core Concepts and Topics

"""
    
    # Process conversation data
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Topic Area {i + 1}"
            
        content += f"### {session_title}\n\n"
        content += f"**Priority Level:** High\n\n"
        
        # Extract Q&A pairs and create study points
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        content += f"**Key Learning Points:**\n\n"
        
        for j, (question, answer) in enumerate(qa_pairs[:3]):  # Top 3 per session
            content += f"{j + 1}. **{question.strip()[:100]}{'...' if len(question.strip()) > 100 else ''}**\n"
            
            # Extract first sentence or key point from answer
            answer_sentences = answer.strip().split('.')
            key_point = answer_sentences[0] if answer_sentences else answer.strip()[:150]
            
            content += f"   - *Key Insight:* {key_point}...\n"
            content += f"   - *Study Method:* Review, practice, and test understanding\n\n"
        
        content += f"**Exam Focus Areas:**\n"
        content += f"- Definition and core principles\n"
        content += f"- Practical applications and examples\n"
        content += f"- Common misconceptions to avoid\n"
        content += f"- Integration with other topics\n\n"
        content += "---\n\n"
    
    content += f"""## Strategic Study Methods

### For Visual Learners
- Create **concept maps** and **diagrams**
- Use **color coding** for different topic areas
- Make **flowcharts** for processes and procedures
- Draw **connections** between related concepts

### For Auditory Learners  
- **Explain concepts aloud** to yourself or others
- Create **mnemonics** for key information
- **Record yourself** summarizing topics
- **Discuss topics** with study partners

### For Kinesthetic Learners
- **Write out** key concepts multiple times
- Create **physical flashcards** and manipulate them
- **Walk around** while reviewing material
- **Practice problems** hands-on

### For Reading/Writing Learners
- **Rewrite notes** in your own words
- Create **detailed outlines** and summaries
- Make **lists** of key points and definitions
- **Practice writing** explanations and examples

---

## Self-Assessment Questions

### Comprehension Check
1. Can you explain each core concept in simple terms?
2. Do you understand how concepts relate to each other?
3. Can you provide real-world examples for abstract ideas?

### Application Test
1. Can you solve practice problems using learned concepts?
2. Are you able to apply knowledge to new scenarios?
3. Can you identify when and how to use different approaches?

### Critical Thinking
1. Can you compare and contrast different methods or theories?
2. Are you able to evaluate the strengths and weaknesses of approaches?
3. Can you synthesize information from multiple sources?

---

## Exam Day Strategy

### Pre-Exam (Night Before)
- [ ] Light review of key concepts only
- [ ] Organize materials for exam day
- [ ] Get adequate sleep (7-8 hours)
- [ ] Prepare everything needed for exam

### Exam Day (Morning)
- [ ] Eat a nutritious breakfast
- [ ] Arrive early at exam location
- [ ] Do a brief warm-up review (15 minutes max)
- [ ] Stay calm and confident

### During the Exam
1. **Read all instructions carefully**
2. **Allocate time** based on question weights
3. **Start with easier questions** to build confidence
4. **Show your work** for partial credit
5. **Review answers** if time permits

---

## Final Review Checklist

**Content Mastery:**
"""
    
    for i, title in enumerate(titles):
        content += f"- [ ] {title} concepts thoroughly understood\n"
    
    content += f"""
**Skill Development:**
- [ ] Problem-solving techniques practiced
- [ ] Application methods mastered
- [ ] Critical thinking skills sharpened
- [ ] Time management practiced

**Exam Readiness:**
- [ ] All study materials reviewed
- [ ] Practice tests completed
- [ ] Weak areas addressed
- [ ] Confidence level high

---

## Emergency Review (Last 24 Hours)

If you're short on time, focus on these **high-impact activities:**

1. **Read summaries** of each topic (30 minutes)
2. **Review key definitions** and formulas (20 minutes)  
3. **Practice 2-3 sample problems** (30 minutes)
4. **Scan through** your most challenging topics (20 minutes)

**Total Time:** 100 minutes of focused review

---

*"Success is where preparation and opportunity meet."*

**Good luck with your exam!**

*Generated by Brainwave AI Exam Prep Assistant*
"""
    
    return content

def generate_enhanced_transcript_content(conversation_data, titles):
    """Generate clean, well-formatted transcript"""
    content = f"""# Complete Chat Session Transcript

**Export Date:** {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}
**Total Sessions:** {len(titles)}
**Format:** Chronological conversation record

---

## Document Information

This transcript contains complete conversations from your AI chat sessions. Each session is clearly marked and organized chronologically for easy reference.

### Navigation Tips
- Use Ctrl+F (Cmd+F) to search for specific topics
- Each session begins with a clear header
- Questions and responses are clearly labeled
- Timestamps are included where available

---

"""
    
    # Process each session
    messages = conversation_data.split('\n\n--- New Session ---\n\n')
    
    for i, session_content in enumerate(messages):
        if i < len(titles):
            session_title = titles[i]
        else:
            session_title = f"Chat Session {i + 1}"
            
        content += f"## Session {i + 1}: {session_title}\n\n"
        content += f"**Session Overview:** Detailed conversation transcript\n\n"
        
        # Extract and format Q&A pairs
        qa_pairs = re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session_content, re.DOTALL)
        
        for j, (question, answer) in enumerate(qa_pairs):
            content += f"### Exchange {j + 1}\n\n"
            content += f"**You:**\n{question.strip()}\n\n"
            content += f"**AI Tutor:**\n{answer.strip()}\n\n"
            content += f"*Exchange completed*\n\n"
            content += "---\n\n"
        
        content += f"*End of {session_title}*\n\n"
        
        if i < len(messages) - 1:
            content += "═══════════════════════════════════════\n\n"
    
    content += f"""---

## Transcript Summary

**Total Exchanges:** {sum(len(re.findall(r'Q: (.*?)\nA: (.*?)(?=\nQ:|$)', session, re.DOTALL)) for session in messages)}
**Total Sessions:** {len(titles)}
**Export Completed:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

*This transcript was generated by Brainwave AI Assistant*
"""
    
    return content


@app.delete("/delete_chat_session/{session_id}")
def delete_chat_session(session_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a chat session and all its messages"""
    try:
        chat_session = db.query(models.ChatSession).filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id  # Ensure user owns the session
        ).first()
        
        if not chat_session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Delete all messages in the session first (foreign key constraint)
        db.query(models.ChatMessage).filter(
            models.ChatMessage.chat_session_id == session_id
        ).delete()
        
        # Delete the session itself
        db.delete(chat_session)
        db.commit()
        
        return {"message": "Chat session deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting chat session {session_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete chat session")
    


# Enhanced Stats Endpoints

@app.get("/get_enhanced_user_stats")
def get_enhanced_user_stats(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get comprehensive user statistics for dashboard"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get basic stats
        basic_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        # Get enhanced stats
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        # Calculate derived metrics
        total_questions = db.query(models.Activity).filter(
            models.Activity.user_id == user.id
        ).count()
        
        total_flashcards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id
        ).count()
        
        total_chat_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).count()
        
        # Calculate weekly progress
        week_ago = datetime.utcnow() - timedelta(days=7)
        weekly_metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= week_ago.date()
            )
        ).all()
        
        weekly_sessions = sum(metric.sessions_completed for metric in weekly_metrics)
        
        # Calculate learning velocity (sessions per week trend)
        learning_velocity = min(100, (weekly_sessions / 7) * 20)  # Normalize to 0-100
        
        # Calculate comprehension rate based on accuracy
        accuracy = basic_stats.accuracy_percentage if basic_stats else 0
        comprehension_rate = min(100, accuracy * 1.1)  # Slight boost for comprehension
        
        # Calculate retention score based on consistency
        retention_score = min(100, (basic_stats.day_streak if basic_stats else 0) * 2)
        
        # Calculate consistency rating
        consistency_rating = min(100, weekly_sessions * 12)  # Based on regular study
        
        # Determine study level
        total_hours = basic_stats.total_hours if basic_stats else 0
        if total_hours < 10:
            study_level = "Beginner"
        elif total_hours < 50:
            study_level = "Intermediate"
        elif total_hours < 100:
            study_level = "Advanced"
        else:
            study_level = "Expert"
        
        # Calculate achievement score
        achievement_score = (
            (basic_stats.day_streak if basic_stats else 0) * 10 +
            total_questions * 5 +
            total_flashcards * 3 +
            total_notes * 8 +
            total_chat_sessions * 2
        )
        
        return {
            "streak": basic_stats.day_streak if basic_stats else 0,
            "lessons": basic_stats.total_lessons if basic_stats else 0,
            "hours": basic_stats.total_hours if basic_stats else 0,
            "accuracy": basic_stats.accuracy_percentage if basic_stats else 0,
            "totalQuestions": total_questions,
            "correctAnswers": int(total_questions * (accuracy / 100)) if accuracy > 0 else 0,
            "averageSessionTime": 12,  # Default or calculate from actual data
            "weeklyProgress": weekly_sessions,
            "monthlyGoal": enhanced_stats.monthly_goal if enhanced_stats else 100,
            "achievementScore": achievement_score,
            "studyLevel": study_level,
            "favoriteSubject": enhanced_stats.favorite_subject if enhanced_stats else "General",
            "lastActiveDate": enhanced_stats.last_active_date.isoformat() if enhanced_stats and enhanced_stats.last_active_date else None,
            "totalFlashcards": total_flashcards,
            "totalNotes": total_notes,
            "totalChatSessions": total_chat_sessions,
            "learningVelocity": int(learning_velocity),
            "comprehensionRate": int(comprehension_rate),
            "retentionScore": int(retention_score),
            "consistencyRating": int(consistency_rating)
        }
        
    except Exception as e:
        print(f"Error getting enhanced stats: {str(e)}")
        return {
            "streak": 0, "lessons": 0, "hours": 0, "accuracy": 0,
            "totalQuestions": 0, "correctAnswers": 0, "averageSessionTime": 0,
            "weeklyProgress": 0, "monthlyGoal": 100, "achievementScore": 0,
            "studyLevel": "Beginner", "favoriteSubject": "General",
            "lastActiveDate": None, "totalFlashcards": 0, "totalNotes": 0,
            "totalChatSessions": 0, "learningVelocity": 0, "comprehensionRate": 0,
            "retentionScore": 0, "consistencyRating": 0
        }

@app.get("/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get weekly learning progress data"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get last 7 days of data
        week_ago = datetime.utcnow() - timedelta(days=7)
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= week_ago.date()
            )
        ).order_by(models.DailyLearningMetrics.date.asc()).all()
        
        # Create 7-day array with default values
        weekly_data = [0] * 7
        for metric in daily_metrics:
            days_ago = (datetime.utcnow().date() - metric.date).days
            if 0 <= days_ago < 7:
                weekly_data[6 - days_ago] = metric.sessions_completed
        
        return {
            "weekly_data": weekly_data,
            "total_sessions": sum(weekly_data),
            "average_per_day": sum(weekly_data) / 7
        }
        
    except Exception as e:
        print(f"Error getting weekly progress: {str(e)}")
        return {"weekly_data": [0] * 7, "total_sessions": 0, "average_per_day": 0}

@app.get("/get_user_achievements")
def get_user_achievements(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get user's earned achievements"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # For now, return mock achievements - you can implement real achievement logic
        achievements = [
            {
                "name": "First Steps",
                "description": "Completed your first AI chat session",
                "icon": "STAR",
                "earned_at": "2024-01-15"
            },
            {
                "name": "Study Streak",
                "description": "Maintained a 7-day study streak",
                "icon": "FIRE",
                "earned_at": "2024-01-20"
            },
            {
                "name": "Flashcard Master",
                "description": "Created 50 flashcards",
                "icon": "CARDS",
                "earned_at": "2024-01-25"
            }
        ]
        
        return {"achievements": achievements}
        
    except Exception as e:
        print(f"Error getting achievements: {str(e)}")
        return {"achievements": []}

# Profile Management Endpoints

@app.get("/get_user_profile")
def get_user_profile(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        result = {
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "email": user.email or "",
            "age": user.age or "",
            "fieldOfStudy": user.field_of_study or "",
            "learningStyle": user.learning_style or "",
            "schoolUniversity": user.school_university or "",
            "preferredSubjects": [],
            "difficultyLevel": "intermediate",
            "studySchedule": "flexible",
            "learningPace": "moderate",
            "motivationFactors": [],
            "weakAreas": [],
            "strongAreas": [],
            "careerGoals": "",
            "studyGoals": "",
            "timeZone": "",
            "studyEnvironment": "quiet",
            "preferredLanguage": "english",
            "preferredSessionLength": "",
            "breakFrequency": "",
            "bestStudyTimes": [],
            "preferredContentTypes": [],
            "learningChallenges": "",
            "devicePreferences": [],
            "accessibilityNeeds": [],
            "internetSpeed": "",
            "dataUsage": "",
            "notificationPreferences": [],
            "contactMethod": "",
            "communicationFrequency": "",
            "dataConsent": [],
            "profileVisibility": "private"
        }
        
        if profile:
            try:
                result.update({
                    "preferredSubjects": json.loads(profile.preferred_subjects or "[]"),
                    "difficultyLevel": profile.difficulty_level or "intermediate",
                    "studySchedule": profile.study_schedule or "flexible",
                    "learningPace": profile.learning_pace or "moderate",
                    "motivationFactors": json.loads(profile.motivation_factors or "[]"),
                    "weakAreas": json.loads(profile.weak_areas or "[]"),
                    "strongAreas": json.loads(profile.strong_areas or "[]"),
                    "careerGoals": profile.career_goals or "",
                    "studyGoals": profile.study_goals or "",
                    "timeZone": profile.time_zone or "",
                    "studyEnvironment": profile.study_environment or "quiet",
                    "preferredLanguage": profile.preferred_language or "english",
                    "preferredSessionLength": profile.preferred_session_length or "",
                    "breakFrequency": profile.break_frequency or "",
                    "bestStudyTimes": json.loads(profile.best_study_times or "[]"),
                    "preferredContentTypes": json.loads(profile.preferred_content_types or "[]"),
                    "learningChallenges": profile.learning_challenges or "",
                    "devicePreferences": json.loads(profile.device_preferences or "[]"),
                    "accessibilityNeeds": json.loads(profile.accessibility_needs or "[]"),
                    "internetSpeed": profile.internet_speed or "",
                    "dataUsage": profile.data_usage or "",
                    "notificationPreferences": json.loads(profile.notification_preferences or "[]"),
                    "contactMethod": profile.contact_method or "",
                    "communicationFrequency": profile.communication_frequency or "",
                    "dataConsent": json.loads(profile.data_consent or "[]"),
                    "profileVisibility": profile.profile_visibility or "private"
                })
            except json.JSONDecodeError:
                pass
        
        return result
        
    except Exception as e:
        print(f"Error getting user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get profile")

@app.post("/update_user_profile")
def update_user_profile(profile_data: UserProfileUpdate, db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, profile_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if profile_data.firstName is not None:
            user.first_name = profile_data.firstName
        if profile_data.lastName is not None:
            user.last_name = profile_data.lastName
        if profile_data.email is not None:
            user.email = profile_data.email
        if profile_data.age is not None:
            user.age = profile_data.age
        if profile_data.fieldOfStudy is not None:
            user.field_of_study = profile_data.fieldOfStudy
        if profile_data.learningStyle is not None:
            user.learning_style = profile_data.learningStyle
        if profile_data.schoolUniversity is not None:
            user.school_university = profile_data.schoolUniversity
        
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        if not profile:
            profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(profile)
        
        if profile_data.preferredSubjects is not None:
            profile.preferred_subjects = json.dumps(profile_data.preferredSubjects)
        if profile_data.difficultyLevel is not None:
            profile.difficulty_level = profile_data.difficultyLevel
        if profile_data.studySchedule is not None:
            profile.study_schedule = profile_data.studySchedule
        if profile_data.learningPace is not None:
            profile.learning_pace = profile_data.learningPace
        if profile_data.motivationFactors is not None:
            profile.motivation_factors = json.dumps(profile_data.motivationFactors)
        if profile_data.weakAreas is not None:
            profile.weak_areas = json.dumps(profile_data.weakAreas)
        if profile_data.strongAreas is not None:
            profile.strong_areas = json.dumps(profile_data.strongAreas)
        if profile_data.careerGoals is not None:
            profile.career_goals = profile_data.careerGoals
        if profile_data.studyGoals is not None:
            profile.study_goals = profile_data.studyGoals
        if profile_data.timeZone is not None:
            profile.time_zone = profile_data.timeZone
        if profile_data.studyEnvironment is not None:
            profile.study_environment = profile_data.studyEnvironment
        if profile_data.preferredLanguage is not None:
            profile.preferred_language = profile_data.preferredLanguage
        
        profile.updated_at = datetime.utcnow()
        
        essential_fields = ['difficulty_level', 'learning_pace', 'study_goals']
        completed_fields = sum(1 for field in essential_fields if getattr(profile, field, None))
        profile.profile_completion_percentage = min(100, int((completed_fields / len(essential_fields)) * 100))
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Profile updated successfully"
        }
        
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")
    

@app.post("/update_user_profile")
def update_user_profile(profile_data: UserProfileUpdate, db: Session = Depends(get_db)):
    """Update user's profile information"""
    try:
        user = get_user_by_username(db, profile_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update basic user info
        if profile_data.firstName is not None:
            user.first_name = profile_data.firstName
        if profile_data.lastName is not None:
            user.last_name = profile_data.lastName
        if profile_data.email is not None:
            user.email = profile_data.email
        if profile_data.age is not None:
            user.age = profile_data.age
        if profile_data.fieldOfStudy is not None:
            user.field_of_study = profile_data.fieldOfStudy
        if profile_data.learningStyle is not None:
            user.learning_style = profile_data.learningStyle
        if profile_data.schoolUniversity is not None:
            user.school_university = profile_data.schoolUniversity
        
        # Get or create comprehensive profile
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        if not profile:
            profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(profile)
        
        # Update comprehensive profile info
        if profile_data.preferredSubjects is not None:
            profile.preferred_subjects = json.dumps(profile_data.preferredSubjects)
        if profile_data.difficultyLevel is not None:
            profile.difficulty_level = profile_data.difficultyLevel
        if profile_data.studySchedule is not None:
            profile.study_schedule = profile_data.studySchedule
        if profile_data.learningPace is not None:
            profile.learning_pace = profile_data.learningPace
        if profile_data.motivationFactors is not None:
            profile.motivation_factors = json.dumps(profile_data.motivationFactors)
        if profile_data.weakAreas is not None:
            profile.weak_areas = json.dumps(profile_data.weakAreas)
        if profile_data.strongAreas is not None:
            profile.strong_areas = json.dumps(profile_data.strongAreas)
        if profile_data.careerGoals is not None:
            profile.career_goals = profile_data.careerGoals
        if profile_data.studyGoals is not None:
            profile.study_goals = profile_data.studyGoals
        if profile_data.timeZone is not None:
            profile.time_zone = profile_data.timeZone
        if profile_data.studyEnvironment is not None:
            profile.study_environment = profile_data.studyEnvironment
        if profile_data.preferredLanguage is not None:
            profile.preferred_language = profile_data.preferredLanguage
        
        profile.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Profile updated successfully"
        }
        
    except Exception as e:
        print(f"Error updating profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")

# Enhanced Analytics Endpoints

@app.post("/record_learning_session")
def record_learning_session(
    user_id: str = Form(...),
    session_type: str = Form(...),
    duration_minutes: int = Form(...),
    questions_answered: int = Form(0),
    correct_answers: int = Form(0),
    topics_studied: str = Form("[]"),
    db: Session = Depends(get_db)
):
    """Record a learning session for analytics"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.utcnow().date()
        
        # Get or create today's metrics
        daily_metric = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date == today
            )
        ).first()
        
        if not daily_metric:
            daily_metric = models.DailyLearningMetrics(
                user_id=user.id,
                date=today
            )
            db.add(daily_metric)
        
        # Update metrics
        daily_metric.sessions_completed += 1
        daily_metric.time_spent_minutes += duration_minutes
        daily_metric.questions_answered += questions_answered
        daily_metric.correct_answers += correct_answers
        
        # Update topics studied
        try:
            current_topics = json.loads(daily_metric.topics_studied or "[]")
            new_topics = json.loads(topics_studied)
            combined_topics = list(set(current_topics + new_topics))
            daily_metric.topics_studied = json.dumps(combined_topics)
        except json.JSONDecodeError:
            daily_metric.topics_studied = topics_studied
        
        # Update enhanced stats
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
        
        enhanced_stats.last_active_date = datetime.utcnow()
        enhanced_stats.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Learning session recorded"
        }
        
    except Exception as e:
        print(f"Error recording session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record session")

@app.get("/get_learning_analytics")
def get_learning_analytics(
    user_id: str = Query(...),
    period: str = Query("week"),  # week, month, year
    db: Session = Depends(get_db)
):
    """Get detailed learning analytics"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Calculate date range
        end_date = datetime.utcnow().date()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        elif period == "year":
            start_date = end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=7)
        
        # Get metrics for period
        metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= start_date,
                models.DailyLearningMetrics.date <= end_date
            )
        ).order_by(models.DailyLearningMetrics.date.asc()).all()
        
        # Calculate analytics
        total_sessions = sum(m.sessions_completed for m in metrics)
        total_time = sum(m.time_spent_minutes for m in metrics)
        total_questions = sum(m.questions_answered for m in metrics)
        total_correct = sum(m.correct_answers for m in metrics)
        
        accuracy = (total_correct / total_questions * 100) if total_questions > 0 else 0
        avg_session_time = (total_time / total_sessions) if total_sessions > 0 else 0
        
        # Get topic distribution
        all_topics = []
        for metric in metrics:
            try:
                topics = json.loads(metric.topics_studied or "[]")
                all_topics.extend(topics)
            except json.JSONDecodeError:
                continue
        
        topic_counts = {}
        for topic in all_topics:
            topic_counts[topic] = topic_counts.get(topic, 0) + 1
        
        return {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_sessions": total_sessions,
            "total_time_minutes": total_time,
            "total_questions": total_questions,
            "total_correct": total_correct,
            "accuracy_percentage": round(accuracy, 1),
            "average_session_time": round(avg_session_time, 1),
            "topic_distribution": topic_counts,
            "daily_data": [
                {
                    "date": metric.date.isoformat(),
                    "sessions": metric.sessions_completed,
                    "time_minutes": metric.time_spent_minutes,
                    "questions": metric.questions_answered,
                    "correct": metric.correct_answers
                }
                for metric in metrics
            ]
        }
        
    except Exception as e:
        print(f"Error getting analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

# Goal Setting and Tracking

@app.post("/set_learning_goal")
def set_learning_goal(
    user_id: str = Form(...),
    goal_type: str = Form(...),  # sessions, hours, questions, streak
    target_value: int = Form(...),
    target_period: str = Form(...),  # daily, weekly, monthly
    db: Session = Depends(get_db)
):
    """Set a learning goal for the user"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get or create enhanced stats
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
        
        # Update goal based on type
        if goal_type == "sessions" and target_period == "monthly":
            enhanced_stats.monthly_goal = target_value
        
        enhanced_stats.updated_at = datetime.utcnow()
        db.commit()
        
        return {
            "status": "success",
            "message": f"Goal set: {target_value} {goal_type} per {target_period}"
        }
        
    except Exception as e:
        print(f"Error setting goal: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to set goal")

# Enhanced AI Response with Profile Context

@app.post("/ask_with_profile/")
async def ask_ai_with_profile(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """AI chat with personalized responses based on user profile"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get user profile for personalization
        profile = db.query(models.UserProfile).filter(
            models.UserProfile.user_id == user.id
        ).first()
        
        # Build personalized context
        personalization_context = f"""
Student Profile:
- Name: {user.first_name or 'Student'}
- Field of Study: {user.field_of_study or 'General'}
- Learning Style: {user.learning_style or 'Mixed'}
- Difficulty Level: {profile.difficulty_level if profile else 'intermediate'}
- Learning Pace: {profile.learning_pace if profile else 'moderate'}
"""
        
        if profile:
            try:
                preferred_subjects = json.loads(profile.preferred_subjects or "[]")
                motivation_factors = json.loads(profile.motivation_factors or "[]")
                weak_areas = json.loads(profile.weak_areas or "[]")
                strong_areas = json.loads(profile.strong_areas or "[]")
                
                if preferred_subjects:
                    personalization_context += f"- Preferred Subjects: {', '.join(preferred_subjects)}\n"
                if motivation_factors:
                    personalization_context += f"- Motivation: {', '.join(motivation_factors)}\n"
                if weak_areas:
                    personalization_context += f"- Areas to Improve: {', '.join(weak_areas)}\n"
                if strong_areas:
                    personalization_context += f"- Strengths: {', '.join(strong_areas)}\n"
                
            except json.JSONDecodeError:
                pass
        
        # Initialize Ollama
        llm = Ollama(model="llama3")
        
        # Build enhanced prompt with personalization
        enhanced_prompt = f"""{personalization_context}

Current Question: {question}

Instructions:
1. Tailor your response to the student's learning style and difficulty level
2. Reference their field of study and preferred subjects when relevant
3. Consider their strengths and areas for improvement
4. Match their preferred learning pace
5. Use motivational language that aligns with their motivation factors
6. Provide examples relevant to their academic background

Provide a personalized, educational response:"""

        response = llm.invoke(enhanced_prompt)
        
        # Record learning session
        try:
            await record_learning_session(
                user_id=user_id,
                session_type="ai_chat",
                duration_minutes=1,
                questions_answered=1,
                correct_answers=1,
                topics_studied=json.dumps([user.field_of_study or "General"]),
                db=db
            )
        except:
            pass  # Don't fail if session recording fails
        
        return {
            "answer": response,
            "personalized": True,
            "ai_confidence": 0.85,
            "profile_used": True
        }
        
    except Exception as e:
        print(f"Error in personalized AI chat: {str(e)}")
        return {
            "answer": f"I apologize, but I encountered an error: {str(e)}. Please try again.",
            "personalized": False,
            "ai_confidence": 0.3,
            "profile_used": False
        }

# Add these Pydantic models to your main.py:

class ComprehensiveProfileUpdate(BaseModel):
    user_id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[str] = None
    age: Optional[int] = None
    fieldOfStudy: Optional[str] = None
    learningStyle: Optional[str] = None
    schoolUniversity: Optional[str] = None
    studyGoals: Optional[str] = None
    careerGoals: Optional[str] = None
    preferredSubjects: Optional[List[str]] = []
    difficultyLevel: Optional[str] = "intermediate"
    studySchedule: Optional[str] = "flexible"
    learningPace: Optional[str] = "moderate"
    motivationFactors: Optional[List[str]] = []
    weakAreas: Optional[List[str]] = []
    strongAreas: Optional[List[str]] = []
    timeZone: Optional[str] = None
    studyEnvironment: Optional[str] = "quiet"
    preferredLanguage: Optional[str] = "english"
    preferredSessionLength: Optional[str] = None
    breakFrequency: Optional[str] = None
    bestStudyTimes: Optional[List[str]] = []
    preferredContentTypes: Optional[List[str]] = []
    learningChallenges: Optional[str] = None
    devicePreferences: Optional[List[str]] = []
    accessibilityNeeds: Optional[List[str]] = []
    internetSpeed: Optional[str] = None
    dataUsage: Optional[str] = None
    notificationPreferences: Optional[List[str]] = []
    contactMethod: Optional[str] = None
    communicationFrequency: Optional[str] = None
    dataConsent: Optional[List[str]] = []
    profileVisibility: Optional[str] = "private"

# Add these endpoints to your main.py:

@app.get("/get_comprehensive_profile")
def get_comprehensive_profile(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        print(f"DEBUG: Getting profile for user: {user_id}")
        
        user = get_user_by_username(db, user_id)
        if not user:
            print(f"DEBUG: User not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        print(f"DEBUG: Found user ID: {user.id}")
        
        # Get comprehensive profile
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        print(f"DEBUG: Profile found: {profile is not None}")
        
        # Build result with user data
        result = {
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "email": user.email or "",
            "age": user.age or "",
            "fieldOfStudy": user.field_of_study or "",
            "learningStyle": user.learning_style or "",
            "schoolUniversity": user.school_university or "",
            # Default arrays
            "preferredSubjects": [],
            "motivationFactors": [],
            "bestStudyTimes": [],
            "preferredContentTypes": [],
            "devicePreferences": [],
            "accessibilityNeeds": [],
            "notificationPreferences": [],
            # Default strings
            "difficultyLevel": "intermediate",
            "studySchedule": "flexible",
            "learningPace": "moderate",
            "timeZone": "",
            "studyEnvironment": "quiet",
            "preferredLanguage": "english",
            "preferredSessionLength": "",
            "breakFrequency": "",
            "internetSpeed": "",
            "dataUsage": "",
            "contactMethod": "",
            "communicationFrequency": "",
            "profileVisibility": "private"
        }
        
        # If profile exists, update with profile data
        if profile:
            try:
                # Parse JSON fields safely
                if profile.preferred_subjects:
                    try:
                        result["preferredSubjects"] = json.loads(profile.preferred_subjects)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing preferred_subjects")
                
                if profile.motivation_factors:
                    try:
                        result["motivationFactors"] = json.loads(profile.motivation_factors)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing motivation_factors")
                
                if profile.best_study_times:
                    try:
                        result["bestStudyTimes"] = json.loads(profile.best_study_times)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing best_study_times")
                
                if profile.preferred_content_types:
                    try:
                        result["preferredContentTypes"] = json.loads(profile.preferred_content_types)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing preferred_content_types")
                
                if profile.device_preferences:
                    try:
                        result["devicePreferences"] = json.loads(profile.device_preferences)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing device_preferences")
                
                if profile.accessibility_needs:
                    try:
                        result["accessibilityNeeds"] = json.loads(profile.accessibility_needs)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing accessibility_needs")
                
                if profile.notification_preferences:
                    try:
                        result["notificationPreferences"] = json.loads(profile.notification_preferences)
                    except json.JSONDecodeError:
                        print("DEBUG: Error parsing notification_preferences")
                
                # Update string fields
                result.update({
                    "difficultyLevel": profile.difficulty_level or "intermediate",
                    "studySchedule": profile.study_schedule or "flexible",
                    "learningPace": profile.learning_pace or "moderate",
                    "timeZone": profile.time_zone or "",
                    "studyEnvironment": profile.study_environment or "quiet",
                    "preferredLanguage": profile.preferred_language or "english",
                    "preferredSessionLength": profile.preferred_session_length or "",
                    "breakFrequency": profile.break_frequency or "",
                    "internetSpeed": profile.internet_speed or "",
                    "dataUsage": profile.data_usage or "",
                    "contactMethod": profile.contact_method or "",
                    "communicationFrequency": profile.communication_frequency or "",
                    "profileVisibility": profile.profile_visibility or "private"
                })
                
            except Exception as e:
                print(f"DEBUG: Error processing profile data: {e}")
        
        print(f"DEBUG: Returning profile data: {result}")
        return result
        
    except Exception as e:
        print(f"ERROR: Failed to get profile: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to get profile")

@app.post("/update_comprehensive_profile")
def update_comprehensive_profile(profile_data: ComprehensiveProfileUpdate, db: Session = Depends(get_db)):
    try:
        print(f"DEBUG: Updating profile for user: {profile_data.user_id}")
        print(f"DEBUG: Profile data keys: {list(profile_data.dict().keys())}")
        
        user = get_user_by_username(db, profile_data.user_id)
        if not user:
            print(f"DEBUG: User not found: {profile_data.user_id}")
            raise HTTPException(status_code=404, detail="User not found")
        
        print(f"DEBUG: Found user ID: {user.id}")
        
        # Update basic user info
        user_updated = False
        if profile_data.firstName is not None and profile_data.firstName != user.first_name:
            user.first_name = profile_data.firstName
            user_updated = True
            print(f"DEBUG: Updated firstName to: {profile_data.firstName}")
            
        if profile_data.lastName is not None and profile_data.lastName != user.last_name:
            user.last_name = profile_data.lastName
            user_updated = True
            print(f"DEBUG: Updated lastName to: {profile_data.lastName}")
            
        if profile_data.email is not None and profile_data.email != user.email:
            user.email = profile_data.email
            user_updated = True
            print(f"DEBUG: Updated email to: {profile_data.email}")
            
        if profile_data.age is not None and profile_data.age != user.age:
            user.age = profile_data.age
            user_updated = True
            print(f"DEBUG: Updated age to: {profile_data.age}")
            
        if profile_data.fieldOfStudy is not None and profile_data.fieldOfStudy != user.field_of_study:
            user.field_of_study = profile_data.fieldOfStudy
            user_updated = True
            print(f"DEBUG: Updated fieldOfStudy to: {profile_data.fieldOfStudy}")
            
        if profile_data.learningStyle is not None and profile_data.learningStyle != user.learning_style:
            user.learning_style = profile_data.learningStyle
            user_updated = True
            print(f"DEBUG: Updated learningStyle to: {profile_data.learningStyle}")
            
        if profile_data.schoolUniversity is not None and profile_data.schoolUniversity != user.school_university:
            user.school_university = profile_data.schoolUniversity
            user_updated = True
            print(f"DEBUG: Updated schoolUniversity to: {profile_data.schoolUniversity}")
        
        # Get or create comprehensive profile
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        if not profile:
            print(f"DEBUG: Creating new profile for user {user.id}")
            profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(profile)
        else:
            print(f"DEBUG: Updating existing profile for user {user.id}")
        
        # Update profile fields with proper JSON serialization
        try:
            profile.preferred_subjects = json.dumps(profile_data.preferredSubjects or [])
            profile.motivation_factors = json.dumps(profile_data.motivationFactors or [])
            profile.best_study_times = json.dumps(profile_data.bestStudyTimes or [])
            profile.preferred_content_types = json.dumps(profile_data.preferredContentTypes or [])
            profile.device_preferences = json.dumps(profile_data.devicePreferences or [])
            profile.accessibility_needs = json.dumps(profile_data.accessibilityNeeds or [])
            profile.notification_preferences = json.dumps(profile_data.notificationPreferences or [])
            
            print(f"DEBUG: JSON fields serialized successfully")
        except Exception as json_error:
            print(f"ERROR: JSON serialization failed: {json_error}")
            raise json_error
        
        # Update string fields
        profile.difficulty_level = profile_data.difficultyLevel or "intermediate"
        profile.study_schedule = profile_data.studySchedule or "flexible"
        profile.learning_pace = profile_data.learningPace or "moderate"
        profile.time_zone = profile_data.timeZone or ""
        profile.study_environment = profile_data.studyEnvironment or "quiet"
        profile.preferred_language = profile_data.preferredLanguage or "english"
        profile.preferred_session_length = profile_data.preferredSessionLength or ""
        profile.break_frequency = profile_data.breakFrequency or ""
        profile.internet_speed = profile_data.internetSpeed or ""
        profile.data_usage = profile_data.dataUsage or ""
        profile.contact_method = profile_data.contactMethod or ""
        profile.communication_frequency = profile_data.communicationFrequency or ""
        profile.profile_visibility = profile_data.profileVisibility or "private"
        
        # Update timestamps
        profile.updated_at = datetime.utcnow()
        
        # Calculate completion percentage
        essential_fields = ['difficulty_level', 'learning_pace', 'study_schedule']
        completed_fields = sum(1 for field in essential_fields if getattr(profile, field, None))
        profile.profile_completion_percentage = min(100, int((completed_fields / len(essential_fields)) * 100))
        
        print(f"DEBUG: Profile completion: {profile.profile_completion_percentage}%")
        
        # Commit all changes
        try:
            db.commit()
            print(f"DEBUG: Successfully committed profile updates to database")
            
            # Refresh objects to get latest data
            db.refresh(user)
            db.refresh(profile)
            
        except Exception as commit_error:
            print(f"ERROR: Database commit failed: {commit_error}")
            db.rollback()
            raise commit_error
        
        print(f"SUCCESS: Profile updated successfully for user {user.username}")
        
        return {
            "status": "success", 
            "message": "Profile updated successfully",
            "profile_completion": profile.profile_completion_percentage
        }
        
    except Exception as e:
        print(f"ERROR: Failed to update profile: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@app.get("/get_enhanced_user_stats")
def get_enhanced_user_stats(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        basic_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        total_questions = db.query(models.Activity).filter(
            models.Activity.user_id == user.id
        ).count()
        
        total_flashcards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id
        ).count()
        
        total_chat_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).count()
        
        week_ago = datetime.utcnow() - timedelta(days=7)
        weekly_sessions = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= week_ago.date()
            )
        ).count()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
            db.commit()
            db.refresh(enhanced_stats)
        
        accuracy = basic_stats.accuracy_percentage if basic_stats else 0
        total_hours = basic_stats.total_hours if basic_stats else 0
        
        if total_hours < 10:
            study_level = "Beginner"
        elif total_hours < 50:
            study_level = "Intermediate"
        elif total_hours < 100:
            study_level = "Advanced"
        else:
            study_level = "Expert"
        
        achievement_score = (
            (basic_stats.day_streak if basic_stats else 0) * 10 +
            total_questions * 5 +
            total_flashcards * 3 +
            total_notes * 8 +
            total_chat_sessions * 2
        )
        
        return {
            "streak": basic_stats.day_streak if basic_stats else 0,
            "lessons": basic_stats.total_lessons if basic_stats else 0,
            "hours": total_hours,
            "accuracy": accuracy,
            "totalQuestions": total_questions,
            "correctAnswers": int(total_questions * (accuracy / 100)) if accuracy > 0 else 0,
            "averageSessionTime": 12,
            "weeklyProgress": weekly_sessions,
            "monthlyGoal": enhanced_stats.monthly_goal,
            "achievementScore": achievement_score,
            "studyLevel": study_level,
            "favoriteSubject": enhanced_stats.favorite_subject,
            "lastActiveDate": enhanced_stats.last_active_date.isoformat() if enhanced_stats.last_active_date else None,
            "totalFlashcards": total_flashcards,
            "totalNotes": total_notes,
            "totalChatSessions": total_chat_sessions,
            "learningVelocity": min(100, weekly_sessions * 20),
            "comprehensionRate": min(100, accuracy * 1.1),
            "retentionScore": min(100, (basic_stats.day_streak if basic_stats else 0) * 2),
            "consistencyRating": min(100, weekly_sessions * 12)
        }
        
    except Exception as e:
        print(f"Error getting enhanced stats: {str(e)}")
        return {
            "streak": 0, "lessons": 0, "hours": 0, "accuracy": 0,
            "totalQuestions": 0, "correctAnswers": 0, "averageSessionTime": 0,
            "weeklyProgress": 0, "monthlyGoal": 100, "achievementScore": 0,
            "studyLevel": "Beginner", "favoriteSubject": "General",
            "lastActiveDate": None, "totalFlashcards": 0, "totalNotes": 0,
            "totalChatSessions": 0, "learningVelocity": 0, "comprehensionRate": 0,
            "retentionScore": 0, "consistencyRating": 0
        }
    
@app.post("/track_session_time")
def track_session_time(time_data: TimeTrackingUpdate, db: Session = Depends(get_db)):
    """Track time spent on different parts of the application"""
    try:
        user = get_user_by_username(db, time_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.utcnow().date()
        
        # Get or create today's metrics
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
                sessions_completed=0,
                time_spent_minutes=0,
                questions_answered=0,
                correct_answers=0,
                topics_studied="[]"
            )
            db.add(daily_metric)
        
        # Update time spent
        daily_metric.time_spent_minutes += time_data.time_spent_minutes
        
        # Update basic user stats
        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        if not user_stats:
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
        
        user_stats.total_hours += (time_data.time_spent_minutes / 60)
        user_stats.last_activity = datetime.utcnow()
        
        # Update enhanced stats
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
        
        enhanced_stats.last_active_date = datetime.utcnow()
        enhanced_stats.updated_at = datetime.utcnow()
        
        # If it's a learning session, increment session count
        if time_data.session_type in ['ai-chat', 'flashcards', 'notes']:
            daily_metric.sessions_completed += 1
            if time_data.session_type == 'ai-chat':
                daily_metric.questions_answered += 1
                daily_metric.correct_answers += 1  # Assume successful interaction
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Session time tracked successfully",
            "total_time_today": daily_metric.time_spent_minutes,
            "total_hours": user_stats.total_hours
        }
        
    except Exception as e:
        print(f"Error tracking session time: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to track session time")

@app.post("/start_session")
def start_session(
    user_id: str = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    """Start a new session tracking"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        session_id = f"{user.id}_{session_type}_{int(datetime.utcnow().timestamp())}"
        
        return {
            "status": "success",
            "session_id": session_id,
            "start_time": datetime.utcnow().isoformat(),
            "message": f"Started {session_type} session"
        }
        
    except Exception as e:
        print(f"Error starting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start session")

@app.post("/end_session")
def end_session(
    user_id: str = Form(...),
    session_id: str = Form(...),
    time_spent_minutes: float = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
    """End a session and record the time"""
    try:
        time_data = TimeTrackingUpdate(
            user_id=user_id,
            session_type=session_type,
            time_spent_minutes=time_spent_minutes
        )
        
        result = track_session_time(time_data, db)
        
        return {
            "status": "success",
            "message": f"Ended {session_type} session",
            "time_recorded": time_spent_minutes,
            "total_time_today": result.get("total_time_today", 0)
        }
        
    except Exception as e:
        print(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end session")

@app.get("/debug_profile/{user_id}")
def debug_profile(user_id: str, db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            return {"error": "User not found"}
        
        profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        return {
            "user_exists": True,
            "user_id": user.id,
            "username": user.username,
            "profile_exists": profile is not None,
            "profile_data": {
                "difficulty_level": profile.difficulty_level if profile else None,
                "learning_pace": profile.learning_pace if profile else None,
                "preferred_subjects": profile.preferred_subjects if profile else None
            } if profile else None
        }
    except Exception as e:
        return {"error": str(e)}

@app.get("/get_activity_heatmap")
def get_activity_heatmap(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=364)
        
        daily_activities = db.query(
            models.DailyLearningMetrics.date,
            models.DailyLearningMetrics.questions_answered
        ).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= start_date,
                models.DailyLearningMetrics.date <= end_date
            )
        ).all()
        
        activity_map = {activity.date: activity.questions_answered for activity in daily_activities}
        
        heatmap_data = []
        current_date = start_date
        
        while current_date <= end_date:
            questions_count = activity_map.get(current_date, 0)
            heatmap_data.append({
                "date": current_date.isoformat(),
                "count": questions_count,
                "level": get_activity_level(questions_count)
            })
            current_date += timedelta(days=1)
        
        total_questions = sum(item["count"] for item in heatmap_data)
        
        return {
            "heatmap_data": heatmap_data,
            "total_count": total_questions,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
        
    except Exception as e:
        print(f"Error getting activity heatmap: {str(e)}")
        return {
            "heatmap_data": [],
            "total_count": 0,
            "date_range": {"start": "", "end": ""}
        }

def get_activity_level(questions_count):
    if questions_count == 0:
        return 0
    elif 1 <= questions_count < 5:
        return 1
    elif 5 <= questions_count < 10:
        return 2
    elif 10 <= questions_count < 15:
        return 3
    elif 15 <= questions_count < 20:
        return 4
    else:
        return 5

@app.post("/create_learning_review")
async def create_learning_review(review_data: LearningReviewCreate, db: Session = Depends(get_db)):
    """Create a learning review session from chat transcripts"""
    try:
        user = get_user_by_username(db, review_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get chat sessions and their messages
        chat_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.id.in_(review_data.chat_session_ids),
            models.ChatSession.user_id == user.id
        ).all()
        
        if not chat_sessions:
            raise HTTPException(status_code=404, detail="No valid chat sessions found")
        
        # Collect all conversation data
        all_conversations = []
        session_titles = []
        
        for session in chat_sessions:
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == session.id
            ).order_by(models.ChatMessage.timestamp.asc()).all()
            
            conversation_text = ""
            for msg in messages:
                conversation_text += f"Q: {msg.user_message}\nA: {msg.ai_response}\n\n"
            
            all_conversations.append(conversation_text)
            session_titles.append(session.title)
        
        combined_conversation = "\n\n--- Session Break ---\n\n".join(all_conversations)
        
        # Initialize AI for analysis
        llm = Ollama(model="llama3")
        
        # Generate key learning points from the conversations
        analysis_prompt = f"""Analyze the following educational conversations and extract the key learning points that a student should remember and understand.

Student Profile: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}
Learning Style: {user.learning_style or 'mixed'} learner

Conversations from {len(chat_sessions)} session(s):
{combined_conversation[:4000]}

Extract and organize the key learning points into:
1. **Core Concepts** - Main ideas and theories discussed
2. **Important Definitions** - Key terms and their meanings  
3. **Practical Applications** - How concepts apply in real situations
4. **Critical Insights** - Important conclusions or revelations
5. **Study Tips** - Specific methods or approaches mentioned

Format your response as a JSON object with these sections as keys, and each section containing an array of learning points.

Example format:
{{
    "core_concepts": ["Concept 1 explanation", "Concept 2 explanation"],
    "important_definitions": ["Term 1: definition", "Term 2: definition"],
    "practical_applications": ["Application 1", "Application 2"],
    "critical_insights": ["Insight 1", "Insight 2"],
    "study_tips": ["Tip 1", "Tip 2"]
}}

Generate comprehensive learning points:"""

        try:
            analysis_response = llm.invoke(analysis_prompt)
            
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', analysis_response, re.DOTALL)
            if json_match:
                try:
                    learning_points = json.loads(json_match.group())
                except json.JSONDecodeError:
                    # Fallback to manual parsing
                    learning_points = parse_learning_points_fallback(analysis_response)
            else:
                learning_points = parse_learning_points_fallback(analysis_response)
                
        except Exception as ai_error:
            print(f"AI analysis failed: {ai_error}")
            # Create basic learning points from conversation
            learning_points = create_basic_learning_points(combined_conversation)
        
        # Create learning review record
        learning_review = models.LearningReview(
            user_id=user.id,
            title=review_data.review_title,
            source_sessions=json.dumps(review_data.chat_session_ids),
            source_content=combined_conversation[:5000],  # Store truncated content
            expected_points=json.dumps(learning_points),
            review_type=review_data.review_type,
            total_points=sum(len(points) for points in learning_points.values()),
            status="active"
        )
        
        db.add(learning_review)
        db.commit()
        db.refresh(learning_review)
        
        return {
            "review_id": learning_review.id,
            "title": learning_review.title,
            "total_points": learning_review.total_points,
            "learning_categories": list(learning_points.keys()),
            "session_titles": session_titles,
            "instructions": {
                "objective": "Test your knowledge retention from the AI chat sessions",
                "task": "Write down everything you remember from these conversations",
                "process": "Submit your response and get feedback on missing points",
                "hints": "Request hints for specific areas you're struggling with"
            },
            "status": "created"
        }
        
    except Exception as e:
        print(f"Error creating learning review: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create learning review: {str(e)}")

@app.post("/submit_learning_response")
async def submit_learning_response(response_data: LearningReviewResponse, db: Session = Depends(get_db)):
    """Submit user's learning response and get feedback on missing points"""
    try:
        learning_review = db.query(models.LearningReview).filter(
            models.LearningReview.id == response_data.review_id
        ).first()
        
        if not learning_review:
            raise HTTPException(status_code=404, detail="Learning review not found")
        
        if learning_review.status != "active":
            raise HTTPException(status_code=400, detail="Learning review is not active")
        
        # Get expected learning points
        try:
            expected_points = json.loads(learning_review.expected_points)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid expected points data")
        
        # Initialize AI for comparison
        llm = Ollama(model="llama3")
        
        # Create comprehensive comparison prompt
        comparison_prompt = f"""You are an educational assessment AI. Compare the student's response with the expected learning points to identify what's missing.

Expected Learning Points:
{json.dumps(expected_points, indent=2)}

Student's Response:
"{response_data.user_response}"

Your task:
1. Identify which expected points the student has covered (fully or partially)
2. Identify which important points are completely missing
3. Rate the overall completeness as a percentage
4. Provide specific feedback on what's missing

Respond in JSON format:
{{
    "covered_points": ["point 1", "point 2"],
    "missing_points": ["missing point 1", "missing point 2"],
    "partially_covered": ["partial point 1"],
    "completeness_percentage": 75,
    "feedback": "Overall feedback on the response",
    "next_steps": "Suggestions for improvement"
}}

Analyze the student's knowledge retention:"""

        try:
            comparison_response = llm.invoke(comparison_prompt)
            
            # Parse AI response
            json_match = re.search(r'\{.*\}', comparison_response, re.DOTALL)
            if json_match:
                try:
                    analysis_result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    analysis_result = create_fallback_analysis(expected_points, response_data.user_response)
            else:
                analysis_result = create_fallback_analysis(expected_points, response_data.user_response)
                
        except Exception as ai_error:
            print(f"AI comparison failed: {ai_error}")
            analysis_result = create_fallback_analysis(expected_points, response_data.user_response)
        
        # Create review attempt record
        review_attempt = models.LearningReviewAttempt(
            review_id=learning_review.id,
            attempt_number=response_data.attempt_number,
            user_response=response_data.user_response,
            covered_points=json.dumps(analysis_result.get("covered_points", [])),
            missing_points=json.dumps(analysis_result.get("missing_points", [])),
            completeness_score=analysis_result.get("completeness_percentage", 0),
            ai_feedback=analysis_result.get("feedback", "Response analyzed")
        )
        
        db.add(review_attempt)
        
        # Update learning review
        learning_review.current_attempt = response_data.attempt_number
        learning_review.best_score = max(
            learning_review.best_score or 0,
            analysis_result.get("completeness_percentage", 0)
        )
        
        # Check if review is complete (90% or higher)
        if analysis_result.get("completeness_percentage", 0) >= 90:
            learning_review.status = "completed"
            learning_review.completed_at = datetime.utcnow()
        
        learning_review.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(review_attempt)
        
        return {
            "attempt_id": review_attempt.id,
            "completeness_percentage": analysis_result.get("completeness_percentage", 0),
            "covered_points": analysis_result.get("covered_points", []),
            "missing_points": analysis_result.get("missing_points", []),
            "partially_covered": analysis_result.get("partially_covered", []),
            "feedback": analysis_result.get("feedback", ""),
            "next_steps": analysis_result.get("next_steps", ""),
            "is_complete": learning_review.status == "completed",
            "can_continue": len(analysis_result.get("missing_points", [])) > 0,
            "attempt_number": response_data.attempt_number
        }
        
    except Exception as e:
        print(f"Error submitting learning response: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process response: {str(e)}")

@app.post("/get_learning_hints")
async def get_learning_hints(hint_request: ReviewHintRequest, db: Session = Depends(get_db)):
    """Get hints for missing learning points"""
    try:
        learning_review = db.query(models.LearningReview).filter(
            models.LearningReview.id == hint_request.review_id
        ).first()
        
        if not learning_review:
            raise HTTPException(status_code=404, detail="Learning review not found")
        
        # Get expected points
        try:
            expected_points = json.loads(learning_review.expected_points)
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Invalid expected points data")
        
        # Initialize AI for hint generation
        llm = Ollama(model="llama3")
        
        # Create hint generation prompt
        hint_prompt = f"""You are a helpful tutor providing hints for learning gaps. The student is missing these specific points from their learning review:

Missing Points: {hint_request.missing_points}

Original Learning Content (for context):
{learning_review.source_content[:2000]}

Generate helpful hints that:
1. Don't give away the full answer
2. Guide the student toward the missing concepts
3. Provide memory triggers or associations
4. Suggest ways to think about the topics
5. Are encouraging and supportive

For each missing point, provide:
- A gentle hint that guides thinking
- A memory trigger or keyword
- A question that helps recall

Format as JSON:
{{
    "hints": [
        {{
            "missing_point": "the missing concept",
            "hint": "gentle guidance",
            "memory_trigger": "keyword or phrase",
            "guiding_question": "question to help recall"
        }}
    ],
    "general_advice": "Overall study suggestions"
}}

Generate helpful learning hints:"""

        try:
            hint_response = llm.invoke(hint_prompt)
            
            # Parse AI response
            json_match = re.search(r'\{.*\}', hint_response, re.DOTALL)
            if json_match:
                try:
                    hints_result = json.loads(json_match.group())
                except json.JSONDecodeError:
                    hints_result = create_fallback_hints(hint_request.missing_points)
            else:
                hints_result = create_fallback_hints(hint_request.missing_points)
                
        except Exception as ai_error:
            print(f"AI hint generation failed: {ai_error}")
            hints_result = create_fallback_hints(hint_request.missing_points)
        
        return {
            "review_id": hint_request.review_id,
            "hints": hints_result.get("hints", []),
            "general_advice": hints_result.get("general_advice", "Review your notes and try to recall the key concepts discussed."),
            "encouragement": "You're doing great! Use these hints to guide your thinking and try again."
        }
        
    except Exception as e:
        print(f"Error generating hints: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate hints")

@app.get("/get_learning_reviews")
def get_learning_reviews(user_id: str = Query(...), db: Session = Depends(get_db)):
    """Get all learning reviews for a user"""
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        reviews = db.query(models.LearningReview).filter(
            models.LearningReview.user_id == user.id
        ).order_by(models.LearningReview.created_at.desc()).all()
        
        review_list = []
        for review in reviews:
            # Get attempt count
            attempt_count = db.query(models.LearningReviewAttempt).filter(
                models.LearningReviewAttempt.review_id == review.id
            ).count()
            
            # Get session titles
            try:
                session_ids = json.loads(review.source_sessions)
                session_titles = [
                    session.title for session in 
                    db.query(models.ChatSession).filter(models.ChatSession.id.in_(session_ids)).all()
                ]
            except:
                session_titles = ["Unknown Session"]
            
            review_list.append({
                "id": review.id,
                "title": review.title,
                "status": review.status,
                "total_points": review.total_points,
                "best_score": review.best_score or 0,
                "current_attempt": review.current_attempt or 0,
                "attempt_count": attempt_count,
                "session_titles": session_titles,
                "created_at": review.created_at.isoformat(),
                "completed_at": review.completed_at.isoformat() if review.completed_at else None,
                "can_continue": review.status == "active"
            })
        
        return {"reviews": review_list}
        
    except Exception as e:
        print(f"Error getting learning reviews: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get learning reviews")

@app.get("/get_learning_review_details/{review_id}")
def get_learning_review_details(review_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific learning review"""
    try:
        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()
        
        if not review:
            raise HTTPException(status_code=404, detail="Learning review not found")
        
        # Get all attempts
        attempts = db.query(models.LearningReviewAttempt).filter(
            models.LearningReviewAttempt.review_id == review_id
        ).order_by(models.LearningReviewAttempt.attempt_number.asc()).all()
        
        # Get expected points
        try:
            expected_points = json.loads(review.expected_points)
        except:
            expected_points = {}
        
        # Get session information
        try:
            session_ids = json.loads(review.source_sessions)
            sessions = db.query(models.ChatSession).filter(
                models.ChatSession.id.in_(session_ids)
            ).all()
            session_info = [
                {
                    "id": session.id,
                    "title": session.title,
                    "created_at": session.created_at.isoformat()
                }
                for session in sessions
            ]
        except:
            session_info = []
        
        attempt_history = []
        for attempt in attempts:
            try:
                covered_points = json.loads(attempt.covered_points)
                missing_points = json.loads(attempt.missing_points)
            except:
                covered_points = []
                missing_points = []
            
            attempt_history.append({
                "attempt_number": attempt.attempt_number,
                "completeness_score": attempt.completeness_score,
                "covered_points": covered_points,
                "missing_points": missing_points,
                "user_response": attempt.user_response,
                "ai_feedback": attempt.ai_feedback,
                "timestamp": attempt.created_at.isoformat()
            })
        
        return {
            "id": review.id,
            "title": review.title,
            "status": review.status,
            "review_type": review.review_type,
            "total_points": review.total_points,
            "best_score": review.best_score or 0,
            "current_attempt": review.current_attempt or 0,
            "expected_points": expected_points,
            "source_sessions": session_info,
            "attempt_history": attempt_history,
            "created_at": review.created_at.isoformat(),
            "completed_at": review.completed_at.isoformat() if review.completed_at else None,
            "updated_at": review.updated_at.isoformat()
        }
        
    except Exception as e:
        print(f"Error getting review details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get review details")

@app.delete("/delete_learning_review/{review_id}")
def delete_learning_review(review_id: int, db: Session = Depends(get_db)):
    """Delete a learning review and all its attempts"""
    try:
        review = db.query(models.LearningReview).filter(
            models.LearningReview.id == review_id
        ).first()
        
        if not review:
            raise HTTPException(status_code=404, detail="Learning review not found")
        
        # Delete all attempts first
        db.query(models.LearningReviewAttempt).filter(
            models.LearningReviewAttempt.review_id == review_id
        ).delete()
        
        # Delete the review
        db.delete(review)
        db.commit()
        
        return {"message": "Learning review deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting learning review: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete learning review")

# Helper functions to add to your main.py

def parse_learning_points_fallback(ai_response):
    """Fallback function to parse learning points from AI response"""
    return {
        "core_concepts": ["Review the main concepts discussed in your conversations"],
        "important_definitions": ["Identify key terms and their meanings"],
        "practical_applications": ["Consider how these concepts apply in practice"],
        "critical_insights": ["Reflect on important conclusions reached"],
        "study_tips": ["Remember the study methods and tips shared"]
    }

def create_basic_learning_points(conversation_text):
    """Create basic learning points from conversation text"""
    # Simple extraction based on question patterns
    questions = re.findall(r'Q: ([^\n]+)', conversation_text)
    
    return {
        "core_concepts": [f"Concept related to: {q[:50]}..." for q in questions[:3]],
        "important_definitions": ["Key terms discussed in the conversations"],
        "practical_applications": ["Real-world applications mentioned"],
        "critical_insights": ["Important insights from the discussions"],
        "study_tips": ["Study methods and approaches discussed"]
    }

def create_fallback_analysis(expected_points, user_response):
    """Create fallback analysis when AI fails"""
    total_expected = sum(len(points) for points in expected_points.values())
    response_length = len(user_response.split())
    
    # Simple heuristic based on response length
    completeness = min(90, max(10, response_length * 2))
    
    return {
        "covered_points": ["Some concepts appear to be covered"],
        "missing_points": ["Please provide more detail on the main topics"],
        "partially_covered": [],
        "completeness_percentage": completeness,
        "feedback": "Your response shows some understanding. Try to be more comprehensive.",
        "next_steps": "Review the conversations and try to recall more specific details."
    }

def create_fallback_hints(missing_points):
    """Create fallback hints when AI fails"""
    return {
        "hints": [
            {
                "missing_point": point,
                "hint": "Think about the main discussion around this topic",
                "memory_trigger": "Key concept",
                "guiding_question": "What was explained about this?"
            }
            for point in missing_points[:3]
        ],
        "general_advice": "Review your conversation history and try to recall the key points discussed."
    }
    
@app.post("/generate_chat_summary")
async def generate_chat_summary(
    chat_data: str = Form(...),
    max_words: int = Form(4),
    format: str = Form("title"),
    db: Session = Depends(get_db)
):
    """Generate AI-powered 4-word summary from chat content"""
    try:
        print(f"Generating summary for content: {chat_data[:100]}...")
        
        llm = Ollama(model="llama3")
        
        prompt = f"""Analyze this conversation content and create a precise 4-word title that captures the main topic being discussed.

Content to analyze:
{chat_data[:2000]}

Rules:
- Generate EXACTLY 4 words
- Focus on the main subject/topic being discussed
- Use academic/technical terms when relevant
- Avoid generic words like "chat", "discussion", "conversation", "session"
- Capitalize each word
- No punctuation or extra formatting

Examples of good 4-word titles:
- "Computer Network Port Protocols"
- "Physics Newton Motion Laws"
- "Chemistry Organic Reaction Mechanisms"
- "Mathematics Calculus Derivative Applications"

Generate only the 4-word title:"""

        response = llm.invoke(prompt)
        
        # Clean the response
        title = response.strip().replace('"', '').replace("'", "")
        words = title.split()
        
        # Ensure exactly 4 words
        if len(words) >= 4:
            final_title = ' '.join(words[:4])
        else:
            # If less than 4 words, extract from content
            content_words = extract_meaningful_words(chat_data)
            needed_words = 4 - len(words)
            words.extend(content_words[:needed_words])
            final_title = ' '.join(words[:4])
        
        print(f"Generated title: {final_title}")
        
        return {
            "summary": final_title,
            "word_count": len(final_title.split()),
            "status": "success"
        }
        
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        # Fallback to content analysis
        fallback_title = extract_meaningful_words(chat_data)
        return {
            "summary": ' '.join(fallback_title[:4]) if fallback_title else "Study Session Cards",
            "word_count": 4,
            "status": "fallback"
        }

def extract_meaningful_words(text):
    """Extract meaningful words from text as fallback"""
    import re
    
    # Technical/academic keywords that should be prioritized
    priority_terms = [
        'network', 'port', 'protocol', 'tcp', 'udp', 'computer', 'server',
        'physics', 'chemistry', 'biology', 'mathematics', 'calculus',
        'programming', 'algorithm', 'function', 'variable', 'data',
        'history', 'literature', 'psychology', 'philosophy'
    ]
    
    # Find priority terms first
    text_lower = text.lower()
    found_priority = [term.title() for term in priority_terms if term in text_lower]
    
    if len(found_priority) >= 4:
        return found_priority[:4]
    
    # Extract other meaningful words
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text)
    stop_words = {
        'what', 'how', 'can', 'you', 'please', 'explain', 'tell', 'about',
        'the', 'and', 'for', 'with', 'this', 'that', 'these', 'those'
    }
    
    meaningful_words = [
        word.title() for word in words 
        if word.lower() not in stop_words and len(word) > 3
    ]
    
    # Combine priority terms with other words
    result = found_priority + [w for w in meaningful_words if w not in found_priority]
    return result[:4] if result else ['Study', 'Session', 'Cards', 'Generated']


# ==================== MAIN APPLICATION ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)