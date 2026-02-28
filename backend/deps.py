import os
import logging
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

import models
from database import SessionLocal, get_db
from ai_utils import UnifiedAIClient

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    logger.critical("SECRET_KEY env var is not set — using insecure placeholder. Set a strong random SECRET_KEY before deploying to production.")
    SECRET_KEY = "your-super-secret-key-change-this-in-production"
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

ph = PasswordHasher()
security = HTTPBearer()

GEMINI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_KEY") or os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"

HS_CONTEXT_API_KEY  = os.getenv("HS_CONTEXT_API_KEY")
HS_AI_BASE_URL      = os.getenv("HS_AI_BASE_URL", "https://api.groq.com/openai/v1")
HS_AI_MODEL         = os.getenv("HS_AI_MODEL", "llama-3.3-70b-versatile")

def _init_ai_client() -> UnifiedAIClient:
    from groq import Groq
    groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
    gemini_client = None
    try:
        import google.generativeai as genai
        if GEMINI_API_KEY:
            genai.configure(api_key=GEMINI_API_KEY)
            gemini_client = genai
    except ImportError:
        pass
    return UnifiedAIClient(gemini_client, groq_client, GEMINI_MODEL, GROQ_MODEL, GEMINI_API_KEY)

def _init_hs_context_ai() -> UnifiedAIClient:
    if not HS_CONTEXT_API_KEY:
        logger.warning("HS_CONTEXT_API_KEY not set — HS context AI will use main client")
        return _init_ai_client()
    logger.info(f"HS context AI initialised: model={HS_AI_MODEL} base_url={HS_AI_BASE_URL}")
    return UnifiedAIClient(
        openai_compat_api_key=HS_CONTEXT_API_KEY,
        openai_compat_base_url=HS_AI_BASE_URL,
        openai_compat_model=HS_AI_MODEL,
    )

unified_ai    = _init_ai_client()
hs_context_ai = _init_hs_context_ai()

def call_ai(prompt: str, max_tokens: int = 2000, temperature: float = 0.7,
            use_cache: bool = False, conversation_id: str = None) -> str:
    response = unified_ai.generate(prompt, max_tokens, temperature, use_cache, conversation_id)
    try:
        from math_processor import process_math_in_response, enhance_display_math
        response = process_math_in_response(response)
        response = enhance_display_math(response)
    except ImportError:
        pass
    return response

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError:
        return False

def get_password_hash(password: str) -> str:
    return ph.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_current_user(db: Session = Depends(get_db), token: str = Depends(verify_token)):
    user = db.query(models.User).filter(models.User.username == token).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        user = get_user_by_email(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def verify_google_token(token: str):
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer.")
        return idinfo
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

def get_comprehensive_profile_safe(db: Session, user_id: int):
    try:
        return db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
    except Exception:
        return None

def calculate_day_streak(db: Session, user_id: int) -> int:
    today = datetime.now(timezone.utc).date()
    recent_days = db.query(models.DailyLearningMetrics.date).filter(
        models.DailyLearningMetrics.user_id == user_id,
        models.DailyLearningMetrics.questions_answered > 0,
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
