#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Brainwave FastAPI Backend v3.0.0
Complete backend with Brainwave AI routing and all API endpoints
"""

# --------------------------------------------------------------------------------------
# Early macOS fork safety
# --------------------------------------------------------------------------------------
import os as _os, multiprocessing as _mp
try:
    _mp.set_start_method("spawn", force=True)
except RuntimeError:
    pass
_os.environ.setdefault("OBJC_DISABLE_INITIALIZE_FORK_SAFETY", "YES")

# --------------------------------------------------------------------------------------
# Core imports
# --------------------------------------------------------------------------------------
import os
import sys
import re
import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple

# FastAPI and dependencies
from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request, File, UploadFile
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
import base64
import io
from PIL import Image
import pytesseract
import PyPDF2
import fitz  
import mimetypes
import uuid
from dotenv import load_dotenv

# Local imports
import models
from database import SessionLocal, engine

# Ensure local imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------------------
# Pydantic Models - Complete Set
# --------------------------------------------------------------------------------------

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

class ChatMessageWithFiles(BaseModel):
    chat_id: int
    user_message: str
    ai_response: str
    file_attachments: Optional[List[str]] = []

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
    weakAreas: Optional[List[str]] = []
    strongAreas: Optional[List[str]] = []
    careerGoals: Optional[str] = None
    studyGoals: Optional[str] = None
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

class TimeTrackingUpdate(BaseModel):
    user_id: str
    session_type: str
    time_spent_minutes: float
    page_url: Optional[str] = None
    activity_data: Optional[Dict] = None

class LearningReviewCreate(BaseModel):
    user_id: str
    chat_session_ids: List[int]
    review_title: str = "Learning Review Session"
    review_type: str = "comprehensive"

class LearningReviewResponse(BaseModel):
    review_id: int
    user_response: str
    attempt_number: int = 1

class ReviewHintRequest(BaseModel):
    review_id: int
    missing_points: List[str]

class FileProcessingResult(BaseModel):
    file_name: str
    file_type: str
    extracted_text: str
    summary: str
    page_count: Optional[int] = None
    image_description: Optional[str] = None

# --------------------------------------------------------------------------------------
# Brainwave AI Configuration
# --------------------------------------------------------------------------------------
@dataclass
class TutorConfig:
    route_timeout_s: float = float(os.getenv("ROUTE_TIMEOUT_S", "60"))  # Increased timeout
    gen_timeout_s: float = float(os.getenv("GEN_TIMEOUT_S", "60"))
    feedback_timeout_s: float = float(os.getenv("FEEDBACK_TIMEOUT_S", "30"))
    models_dir: str = os.getenv("MODELS_DIR", "models")
    export_dir: str = os.getenv("EXPORT_DIR", "exports")
    
    # Model configurations
    gpu_math_model: str = os.getenv("GPU_MATH_MODEL", "WizardLM/WizardMath-7B-V1.1")
    gpu_base_model: str = os.getenv("GPU_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    cpu_math_model: str = os.getenv("CPU_MATH_MODEL", "TinyLlama/TinyLlama-1.1B-Chat-v1.0")
    cpu_base_model: str = os.getenv("CPU_BASE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct")

CONFIG = TutorConfig()

def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

# --------------------------------------------------------------------------------------
# Device Detection and Torch Setup
# --------------------------------------------------------------------------------------
_have_torch = False
_have_tf = False

try:
    import torch
    _have_torch = True
except Exception:
    torch = None

try:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    _have_tf = True
except Exception:
    AutoTokenizer = AutoModelForCausalLM = None

def best_device() -> Tuple[str, Optional[Any]]:
    """Returns (device_str, dtype), preferring CUDA/MPS for GPU, else CPU"""
    if not _have_torch:
        return ("cpu", None)
    try:
        if torch.cuda.is_available():
            return ("cuda", torch.float16)
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return ("mps", torch.float16)
    except Exception:
        pass
    return ("cpu", torch.float32)

DEVICE, DEFAULT_DTYPE = best_device()
logger.info(f"Brainwave AI Device: {DEVICE} (dtype={DEFAULT_DTYPE})")

# CPU thread optimization
if DEVICE == "cpu":
    os.environ.setdefault("OMP_NUM_THREADS", "4")
    os.environ.setdefault("MKL_NUM_THREADS", "4")
    if _have_torch:
        try:
            torch.set_num_threads(4)
        except Exception:
            pass

# --------------------------------------------------------------------------------------
# Fast Math Module
# --------------------------------------------------------------------------------------
def _safe_eval(expr: str) -> Optional[str]:
    expr = (expr or "").strip()
    if not re.fullmatch(r"[0-9\.\s\+\-\*\/\%\(\)\^/]+", expr):
        return None
    expr = expr.replace("^", "**")
    if re.search(r"[A-Za-z_]", expr):
        return None
    try:
        val = eval(expr, {"__builtins__": {}}, {})
        return str(val)
    except Exception:
        return None

def fast_math_or_none(query: str) -> Optional[str]:
    if re.fullmatch(r"\s*[0-9\.\s\+\-\*\/\%\(\)\^/]+\s*", query or ""):
        return _safe_eval(query)
    return None

# --------------------------------------------------------------------------------------
# Lazy Model Loading with No Token Limit
# --------------------------------------------------------------------------------------
class LazyModel:
    def __init__(self, model_id: str, device: str, dtype: Optional[Any]):
        self.model_id = model_id
        self.device = device
        self.dtype = dtype
        self.available = _have_torch and _have_tf
        self.model = None
        self.tok = None

    def ensure_loaded(self):
        if self.model is not None or not self.available:
            return
        logger.info(f"Loading model: {self.model_id} on {self.device}")
        
        self.tok = AutoTokenizer.from_pretrained(self.model_id)
        if self.tok.pad_token is None:
            self.tok.pad_token = self.tok.eos_token
        
        kwargs = {"low_cpu_mem_usage": True}
        if self.dtype is not None:
            kwargs["torch_dtype"] = self.dtype
        if self.device in ("cuda", "mps"):
            kwargs["device_map"] = self.device
            
        self.model = AutoModelForCausalLM.from_pretrained(self.model_id, **kwargs)
        self.model.eval()

    def generate(self, prompt: str, max_new_tokens: Optional[int] = None) -> str:
        """Generate response with no token limit by default"""
        if not self.available:
            return f"[Mock Response] Based on: {prompt[:100]}..."
        
        self.ensure_loaded()
        
        # No token limit - generate as much as needed
        if max_new_tokens is None:
            max_new_tokens = 4096  # Very high default
        
        import torch as _t
        with _t.no_grad():
            # Tokenize with dynamic max length
            toks = self.tok(
                prompt, 
                return_tensors="pt", 
                truncation=True, 
                max_length=min(4096, self.tok.model_max_length)
            )
            
            input_ids = toks.input_ids
            if self.device in ("cuda", "mps"):
                input_ids = input_ids.to(self.device)
            
            # Generate with high token limit
            out = self.model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                pad_token_id=self.tok.pad_token_id,
                eos_token_id=self.tok.eos_token_id,
            )
        
        # Decode the full response
        response = self.tok.decode(out[0], skip_special_tokens=True)
        
        # Remove the prompt from the response
        if prompt in response:
            response = response.replace(prompt, "").strip()
        
        return response

# --------------------------------------------------------------------------------------
# Model Selection
# --------------------------------------------------------------------------------------
def select_models_for_device(device: str) -> Dict[str, str]:
    if device in ("cuda", "mps"):
        return {
            "base_id": CONFIG.gpu_base_model,
            "math_id": CONFIG.gpu_math_model,
        }
    return {
        "base_id": CONFIG.cpu_base_model,
        "math_id": CONFIG.cpu_math_model,
    }

# --------------------------------------------------------------------------------------
# Brainwave AI Router with Enhanced Capabilities
# --------------------------------------------------------------------------------------
# Replace the entire BrainwaveRouter class with this improved version:

class BrainwaveRouter:
    def __init__(self):
        mids = select_models_for_device(DEVICE)
        self.base = LazyModel(mids["base_id"], DEVICE, DEFAULT_DTYPE)
        self.math = LazyModel(mids["math_id"], DEVICE, DEFAULT_DTYPE)
        self.conversation_memory = {}

    async def route_query(
        self, 
        query: str, 
        user_id: str, 
        profile: Dict[str, Any],
        conversation_history: Optional[List] = None
    ) -> Dict[str, Any]:
        """Route query with improved logic"""
        q = (query or "").strip()
        
        # Fast arithmetic path - only for pure calculations
        ans = fast_math_or_none(q)
        if ans is not None:
            return {
                "response": ans,
                "query_type": "math-fast",
                "model_used": "cpu-fastpath",
                "confidence": 0.99,
                "subjects": ["arithmetic"],
                "difficulty": "easy",
                "response_time": 0.01
            }
        
        # Improved routing logic
        is_math = self._is_pure_math_query(q)
        
        # Check if models are available
        if not (self.base.available or self.math.available):
            return self._generate_mock_response(q, "math" if is_math else "general", profile)
        
        # Build context with conversation history
        context = self._build_context(q, profile, conversation_history)
        
        # Generate with appropriate model
        start_time = datetime.utcnow()
        
        if is_math:
            prompt = self._build_math_prompt(q, context)
            # Fix generation parameters to avoid inf/nan errors
            response = self._safe_generate(self.math, prompt)
            query_type = "math"
            model_used = self.math.model_id
        else:
            prompt = self._build_general_prompt(q, context)
            response = self._safe_generate(self.base, prompt)
            query_type = "general"
            model_used = self.base.model_id
        
        response_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Update conversation memory
        if user_id not in self.conversation_memory:
            self.conversation_memory[user_id] = []
        self.conversation_memory[user_id].append({
            "query": q,
            "response": response[:500],
            "timestamp": datetime.utcnow()
        })
        
        # Keep only recent memory
        self.conversation_memory[user_id] = self.conversation_memory[user_id][-10:]
        
        return {
            "response": response,
            "query_type": query_type,
            "model_used": model_used,
            "confidence": self._calculate_confidence(response, query_type),
            "subjects": self._extract_subjects(q, profile),
            "difficulty": self._assess_difficulty(q),
            "response_time": response_time
        }
    
    def _is_pure_math_query(self, query: str) -> bool:
        """
        Determine if query is PURELY mathematical.
        Only route to math model for actual mathematical problems.
        """
        query_lower = query.lower()
        
        # List of strong math indicators
        strong_math_indicators = [
            "solve for", "calculate", "integrate", "differentiate",
            "find the derivative", "find the integral",
            "solve the equation", "factor", "simplify",
            "evaluate", "compute", "what is the value of",
            "find x", "prove that", "mathematical proof"
        ]
        
        # Check for strong math indicators
        for indicator in strong_math_indicators:
            if indicator in query_lower:
                return True
        
        # Check if it's a pure calculation (numbers and operators)
        # Remove spaces and check if it's mostly mathematical
        no_spaces = query.replace(" ", "")
        if re.match(r'^[\d\+\-\*\/\(\)\.\^\%\=]+$', no_spaces):
            return True
        
        # Check for equations with variables
        if re.search(r'\b[xy]\s*[\+\-\*\/\=]\s*\d+', query_lower):
            return True
        if re.search(r'\d+\s*[\+\-\*\/\=]\s*[xy]\b', query_lower):
            return True
        
        # List of topics that should ALWAYS go to general model
        general_topics = [
            # Computer Science
            "computer", "network", "protocol", "tcp", "udp", "ip", "http",
            "programming", "code", "algorithm", "data structure", "software",
            "hardware", "operating system", "database", "sql", "api", "web",
            "javascript", "python", "java", "c++", "machine learning", "ai",
            "artificial intelligence", "neural", "deep learning",
            
            # Sciences (non-math)
            "biology", "chemistry", "physics", "atom", "molecule", "cell",
            "evolution", "genetics", "dna", "rna", "protein", "enzyme",
            "reaction", "element", "compound", "force", "energy", "motion",
            "electricity", "magnetism", "quantum", "relativity",
            
            # Humanities
            "history", "literature", "philosophy", "psychology", "sociology",
            "anthropology", "linguistics", "language", "culture", "society",
            "politics", "economics", "geography", "art", "music",
            
            # General Academic
            "explain", "what is", "how does", "why does", "define",
            "describe", "compare", "contrast", "analyze", "discuss",
            "essay", "write", "summary", "report", "research",
            
            # Technology
            "internet", "cloud", "server", "client", "browser", "website",
            "mobile", "app", "android", "ios", "windows", "linux", "mac",
            
            # Specific to your case
            "port", "osi", "layer", "router", "switch", "firewall",
            "encryption", "security", "authentication", "authorization"
        ]
        
        # If any general topic keyword is found, route to general model
        for topic in general_topics:
            if topic in query_lower:
                return False
        
        # Additional check: if the query is asking for explanation rather than calculation
        explanation_keywords = [
            "what", "how", "why", "when", "where", "who",
            "explain", "describe", "tell me about", "teach",
            "understand", "learn", "know about"
        ]
        
        for keyword in explanation_keywords:
            if query_lower.startswith(keyword):
                # Check if it's followed by math terms
                math_follow_terms = ["equation", "formula", "calculate", "solve"]
                has_math_follow = any(term in query_lower for term in math_follow_terms)
                if not has_math_follow:
                    return False
        
        # Default to general model for safety
        return False
    
    def _safe_generate(self, model: LazyModel, prompt: str) -> str:
        """
        Safe generation with fixed parameters to avoid inf/nan errors
        """
        if not model.available:
            return f"[Mock Response] Based on: {prompt[:100]}..."
        
        model.ensure_loaded()
        
        import torch as _t
        with _t.no_grad():
            # Tokenize with proper settings
            toks = model.tok(
                prompt, 
                return_tensors="pt", 
                truncation=True, 
                max_length=min(2048, model.tok.model_max_length)
            )
            
            input_ids = toks.input_ids
            attention_mask = toks.attention_mask
            
            if model.device in ("cuda", "mps"):
                input_ids = input_ids.to(model.device)
                attention_mask = attention_mask.to(model.device)
            
            # Generate with safer parameters to avoid inf/nan
            out = model.model.generate(
                input_ids,
                attention_mask=attention_mask,
                max_new_tokens=1024,  # Reasonable limit
                do_sample=True,
                temperature=0.8,  # Slightly higher for better creativity
                top_p=0.95,
                top_k=50,  # Add top_k for stability
                repetition_penalty=1.05,
                pad_token_id=model.tok.pad_token_id,
                eos_token_id=model.tok.eos_token_id,
                min_length=10,  # Ensure minimum response
                no_repeat_ngram_size=3,  # Prevent repetition
                early_stopping=True
            )
        
        # Decode the response
        response = model.tok.decode(out[0], skip_special_tokens=True)
        
        # Remove the prompt from the response if it appears
        if prompt in response:
            response = response.replace(prompt, "").strip()
        
        # Ensure we have a response
        if not response or len(response) < 10:
            response = "I understand your question. Let me provide a detailed explanation based on the context provided."
        
        return response
    
    def _build_context(self, query: str, profile: Dict, history: Optional[List]) -> str:
        """Build comprehensive context"""
        context = f"""Student Profile:
Name: {profile.get('first_name', 'Student')} {profile.get('last_name', '')}
Field: {profile.get('field_of_study', 'General Studies')}
Learning Style: {profile.get('learning_style', 'Mixed')}
Level: {profile.get('difficulty_level', 'Intermediate')}
Pace: {profile.get('learning_pace', 'Moderate')}
"""
        
        if history:
            context += "\nRecent Context:\n"
            for h in history[-3:]:
                context += f"Q: {h.get('user_message', '')[:100]}...\n"
                context += f"A: {h.get('ai_response', '')[:100]}...\n"
        
        return context
    
    def _build_math_prompt(self, query: str, context: str) -> str:
        return f"""{context}

Mathematical Problem: {query}

Instructions:
1. Solve step by step with clear explanations
2. Show all work and calculations
3. Explain mathematical concepts used
4. Provide the final answer clearly
5. Include any relevant formulas
6. Check your work for accuracy

Detailed Solution:"""
    
    def _build_general_prompt(self, query: str, context: str) -> str:
        return f"""{context}

Question: {query}

Instructions:
1. Provide a comprehensive, educational response
2. Tailor to the student's level and learning style
3. Include relevant examples and explanations
4. Break down complex concepts into understandable parts
5. Relate to the field of study when applicable
6. Be encouraging and supportive
7. Use clear, accessible language

Educational Response:"""
    
    def _calculate_confidence(self, response: str, query_type: str) -> float:
        """Calculate response confidence"""
        base_confidence = 0.75
        
        if len(response) > 500:
            base_confidence += 0.1
        if query_type == "math-fast":
            base_confidence = 0.99
        elif query_type == "math":
            base_confidence = 0.85
        
        return min(0.98, base_confidence)
    
    def _extract_subjects(self, query: str, profile: Dict) -> List[str]:
        """Extract subject areas from query"""
        subjects = []
        query_lower = query.lower()
        
        subject_keywords = {
            "mathematics": ["math", "calculus", "algebra", "geometry", "equation"],
            "computer_science": ["programming", "algorithm", "code", "software", "computer", "network"],
            "physics": ["physics", "force", "energy", "motion", "quantum"],
            "chemistry": ["chemistry", "chemical", "molecule", "reaction", "element"],
            "biology": ["biology", "cell", "organism", "evolution", "genetics"],
            "history": ["history", "historical", "ancient", "civilization", "war"],
            "literature": ["literature", "poem", "novel", "author", "writing"],
            "networking": ["network", "tcp", "udp", "protocol", "port", "osi"]
        }
        
        for subject, keywords in subject_keywords.items():
            if any(kw in query_lower for kw in keywords):
                subjects.append(subject)
        
        if not subjects:
            subjects.append(profile.get('field_of_study', 'general').lower())
        
        return subjects
    
    def _assess_difficulty(self, query: str) -> str:
        """Assess query difficulty"""
        if len(query.split()) < 10:
            return "easy"
        elif len(query.split()) < 25:
            return "medium"
        else:
            return "hard"
    
    def _generate_mock_response(self, query: str, query_type: str, profile: Dict) -> Dict:
        """Generate mock response when models unavailable"""
        user_name = profile.get("first_name", "Student")
        field = profile.get("field_of_study", "your studies")
        
        response = f"""Hello {user_name}! I understand you're asking about: '{query[:100]}...'

I would normally provide a detailed explanation tailored to your learning style and field of study ({field}).

The topic you're asking about is important and I'd typically cover:
1. Core concepts and definitions
2. Practical examples and applications
3. How it relates to your field of study
4. Common misconceptions to avoid
5. Resources for further learning

Please ensure the AI models are properly loaded for a complete response."""
        
        return {
            "response": response,
            "query_type": query_type,
            "model_used": "mock_model",
            "confidence": 0.7,
            "subjects": [field.lower()],
            "difficulty": "medium",
            "response_time": 0.1
        }
# --------------------------------------------------------------------------------------
# FastAPI Application Setup
# --------------------------------------------------------------------------------------
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Brainwave Backend API v3.0.0",
    description="Complete AI-powered educational platform with Brainwave routing",
    version="3.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = "HS256"

# Initialize global components
brainwave_router = BrainwaveRouter()

# Enhanced features import
try:
    from global_ai_learning import GlobalAILearningSystem
    from personalization_engine_backend import PersonalizationEngine
    ENHANCED_FEATURES_AVAILABLE = True
except ImportError:
    logger.warning("Enhanced AI features not available. Run migration.py to enable them.")
    ENHANCED_FEATURES_AVAILABLE = False

# --------------------------------------------------------------------------------------
# Database Dependency
# --------------------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------------------------------------------------------------------------
# Utility Functions
# --------------------------------------------------------------------------------------
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

# Helper functions
def build_user_profile_dict(user, comprehensive_profile=None) -> Dict[str, Any]:
    """Build user profile dictionary for Brainwave router"""
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
            "career_goals": getattr(comprehensive_profile, "career_goals", None)
        })
    
    return profile

async def use_brainwave_for_text_generation(
    prompt: str,
    user_profile: Dict[str, Any],
    conversation_history: Optional[List] = None
) -> str:
    """Helper function to use Brainwave router for text generation"""
    try:
        user_id = str(user_profile.get("user_id", "system"))
        result = await brainwave_router.route_query(
            prompt, 
            user_id, 
            user_profile,
            conversation_history
        )
        return result.get("response", "Unable to generate response")
    except Exception as e:
        logger.error(f"Brainwave generation error: {e}")
        return f"I apologize, but I encountered an error processing your request. Please try again."

# --------------------------------------------------------------------------------------
# BASIC ENDPOINTS
# --------------------------------------------------------------------------------------
@app.get("/")
async def root():
    return {
        "message": "Brainwave Backend API v3.0.0",
        "status": "running",
        "device": DEVICE,
        "models_available": _have_torch and _have_tf,
        "enhanced_features": ENHANCED_FEATURES_AVAILABLE,
        "api_version": "3.0.0",
        "endpoints_available": True
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Brainwave API is running",
        "device": DEVICE,
        "torch_available": _have_torch,
        "transformers_available": _have_tf,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/system_status")
def get_system_status(db: Session = Depends(get_db)):
    status = {
        "basic_features": True,
        "enhanced_features": ENHANCED_FEATURES_AVAILABLE,
        "device": DEVICE,
        "models_available": _have_torch and _have_tf,
        "database_tables": {}
    }
    
    try:
        status["database_tables"]["users"] = db.query(models.User).count()
        status["database_tables"]["chat_sessions"] = db.query(models.ChatSession).count()
        status["database_tables"]["chat_messages"] = db.query(models.ChatMessage).count()
        # ... continuing from previous code ...

        status["database_tables"]["activities"] = db.query(models.Activity).count()
        status["database_tables"]["notes"] = db.query(models.Note).count()
        status["database_tables"]["flashcard_sets"] = db.query(models.FlashcardSet).count()
        status["database_tables"]["flashcards"] = db.query(models.Flashcard).count()
    except Exception as e:
        status["database_error"] = str(e)
    
    return status

# --------------------------------------------------------------------------------------
# AUTHENTICATION ENDPOINTS
# --------------------------------------------------------------------------------------
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
    
    # Create user stats
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
    
    access_token_expires = timedelta(hours=24)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/google-auth")
def google_auth(auth_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        # Verify token with Google
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.token}"
            response = requests.get(url)
            
            if response.status_code == 200:
                user_info = response.json()
            else:
                user_info = verify_google_token(auth_data.token)
        except Exception:
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
        logger.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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

# --------------------------------------------------------------------------------------
# MAIN AI CHAT ENDPOINT - WITH BRAINWAVE ROUTER
# --------------------------------------------------------------------------------------
@app.post("/ask/")
async def ask_ai_enhanced(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    logger.info(f"Processing AI query for user {user_id}")
    
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
        
        # Get comprehensive user profile
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        # Build user profile for Brainwave
        user_profile = build_user_profile_dict(user, comprehensive_profile)
        
        # Get conversation history
        conversation_history = []
        if chat_id_int:
            recent_messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == chat_id_int
            ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()
            
            for msg in reversed(recent_messages):
                conversation_history.append({
                    'user_message': msg.user_message,
                    'ai_response': msg.ai_response,
                    'timestamp': msg.timestamp
                })
        
        # Route query through Brainwave
        routing_result = await brainwave_router.route_query(
            question,
            str(user.id),
            user_profile,
            conversation_history
        )
        
        response = routing_result["response"]
        
        # Store activity
        activity = models.Activity(
            user_id=user.id,
            question=question,
            answer=response,
            topic=user.field_of_study or "General",
            question_type=routing_result["query_type"],
            difficulty_level=routing_result.get("difficulty", "medium")
        )
        db.add(activity)
        db.commit()
        
        # Update daily metrics
        today = datetime.utcnow().date()
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
        
        daily_metric.questions_answered += 1
        daily_metric.correct_answers += 1
        db.commit()
        
        # Enhanced features integration
        enhanced_data = {}
        if ENHANCED_FEATURES_AVAILABLE:
            try:
                global_ai = GlobalAILearningSystem(db)
                enhanced_response = global_ai.generate_enhanced_response(
                    user_message=question,
                    user_id=user.id,
                    conversation_history=conversation_history
                )
                enhanced_data = {
                    "misconception_detected": enhanced_response.get("misconception_detected", False),
                    "should_request_feedback": enhanced_response.get("should_request_feedback", False),
                    "topics_analyzed": enhanced_response.get("analysis", {}).get("topics", [])
                }
            except Exception as e:
                logger.error(f"Enhanced features error: {e}")
        
        return {
            "answer": response,
            "ai_confidence": routing_result.get("confidence", 0.85),
            "misconception_detected": enhanced_data.get("misconception_detected", False),
            "should_request_feedback": routing_result.get("confidence", 0.85) < 0.7,
            "topics_discussed": routing_result.get("subjects", ["General"]),
            "query_type": routing_result["query_type"],
            "model_used": routing_result["model_used"],
            "device_used": DEVICE,
            "response_time": routing_result.get("response_time", 0.5),
            "enhanced_features_used": ENHANCED_FEATURES_AVAILABLE,
            "profile_enhanced": bool(comprehensive_profile),
            "difficulty_level": routing_result.get("difficulty", "medium"),
            "brainwave_version": "3.0.0"
        }
        
    except Exception as e:
        logger.error(f"Error in ask_ai: {str(e)}")
        return {
            "answer": f"I apologize, but I encountered an error processing your request. Please try again.",
            "ai_confidence": 0.3,
            "misconception_detected": False,
            "should_request_feedback": True,
            "topics_discussed": ["error"],
            "query_type": "error",
            "model_used": "error_handler",
            "device_used": DEVICE,
            "enhanced_features_used": False,
            "profile_enhanced": False,
            "brainwave_version": "3.0.0"
        }

# --------------------------------------------------------------------------------------
# CHAT SESSION MANAGEMENT
# --------------------------------------------------------------------------------------
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
        
        chat_id = json_data.get('chat_id')
        user_message = json_data.get('user_message')
        ai_response = json_data.get('ai_response')
        
        if isinstance(chat_id, str):
            chat_id = int(chat_id)
        
        if not all([chat_id, user_message, ai_response]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
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
        return {"status": "success", "message": "Message saved successfully"}
        
    except Exception as e:
        logger.error(f"Error in save_chat_message_json: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
            "timestamp": msg.timestamp.isoformat(),
            "ai_confidence": getattr(msg, 'ai_confidence', 0.8),
            "should_request_feedback": getattr(msg, 'ai_confidence', 0.8) < 0.7
        }
        enhanced_messages.append(message_data)
    
    return {
        "session_id": session_id,
        "messages": enhanced_messages
    }

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
    
    # Delete all messages in the session
    db.query(models.ChatMessage).filter(
        models.ChatMessage.chat_session_id == session_id
    ).delete()
    
    # Delete the session
    db.delete(chat_session)
    db.commit()
    
    return {"message": "Chat session deleted successfully"}

# --------------------------------------------------------------------------------------
# NOTE MANAGEMENT ENDPOINTS
# --------------------------------------------------------------------------------------

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

@app.post("/create_note")
def create_note(note_data: NoteCreate, db: Session = Depends(get_db)):
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
        logger.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@app.post("/create_note_form")
def create_note_form(
    user_id: str = Form(...),
    title: str = Form(...),
    content: str = Form(""),
    db: Session = Depends(get_db)
):
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
        logger.error(f"Error creating note via form: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@app.post("/save_note")
def save_note(
    user_id: str = Form(...),
    title: str = Form(...),
    content: str = Form(""),
    note_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
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
        logger.error(f"Error saving note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save note: {str(e)}")

@app.get("/get_note/{note_id}")
def get_note(note_id: int, db: Session = Depends(get_db)):
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
        logger.error(f"Error getting note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get note: {str(e)}")

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

# --------------------------------------------------------------------------------------
# ACTIVITY AND STATS ENDPOINTS
# --------------------------------------------------------------------------------------

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
        weekly_metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= week_ago.date()
            )
        ).all()
        
        weekly_sessions = sum(metric.sessions_completed for metric in weekly_metrics)
        
        learning_velocity = min(100, (weekly_sessions / 7) * 20)
        accuracy = basic_stats.accuracy_percentage if basic_stats else 0
        comprehension_rate = min(100, accuracy * 1.1)
        retention_score = min(100, (basic_stats.day_streak if basic_stats else 0) * 2)
        consistency_rating = min(100, weekly_sessions * 12)
        
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
        logger.error(f"Error getting enhanced stats: {str(e)}")
        return {
            "streak": 0, "lessons": 0, "hours": 0, "accuracy": 0,
            "totalQuestions": 0, "correctAnswers": 0, "averageSessionTime": 0,
            "weeklyProgress": 0, "monthlyGoal": 100, "achievementScore": 0,
            "studyLevel": "Beginner", "favoriteSubject": "General",
            "lastActiveDate": None, "totalFlashcards": 0, "totalNotes": 0,
            "totalChatSessions": 0, "learningVelocity": 0, "comprehensionRate": 0,
            "retentionScore": 0, "consistencyRating": 0
        }

# --------------------------------------------------------------------------------------
# FLASHCARD MANAGEMENT ENDPOINTS
# --------------------------------------------------------------------------------------

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
    
    study_session = models.FlashcardStudySession(
        set_id=session_data.set_id,
        user_id=user.id,
        cards_studied=session_data.cards_studied,
        correct_answers=session_data.correct_answers,
        session_duration=session_data.session_duration
    )
    db.add(study_session)
    
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
    
    db.query(models.Flashcard).filter(models.Flashcard.set_id == set_id).delete()
    db.query(models.FlashcardStudySession).filter(models.FlashcardStudySession.set_id == set_id).delete()
    
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
    
    flashcard.times_reviewed += 1
    flashcard.last_reviewed = datetime.utcnow()
    
    if correct:
        flashcard.correct_count += 1
    
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
    
    total_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user.id
    ).count()
    
    # ... continuing from previous code ...

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
    
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_sessions = db.query(models.FlashcardStudySession).filter(
        models.FlashcardStudySession.user_id == user.id,
        models.FlashcardStudySession.session_date >= week_ago
    ).count()
    
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

# --------------------------------------------------------------------------------------
# AI FLASHCARD GENERATION WITH BRAINWAVE
# --------------------------------------------------------------------------------------

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
        
        user_profile = build_user_profile_dict(user)
        
        # Build content source
        content_source = ""
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
            source_description = "Generated from study notes"
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
            source_description = "Generated from multiple sources"
        
        if not content_source or content_source.strip() == "":
            return {
                "flashcards": [
                    {
                        "question": "Error: No content provided",
                        "answer": "Please provide topic, chat history, or notes to generate flashcards"
                    }
                ]
            }
        
        difficulty_instruction = {
            "easy": "Create simple recall questions with straightforward answers.",
            "medium": "Create questions that test understanding and application of concepts.",
            "hard": "Create challenging questions that require critical thinking and analysis.",
            "mixed": "Create a mix of easy, medium, and hard questions."
        }.get(difficulty_level, "Create questions appropriate for the content.")
        
        prompt = f"""You are an expert educational content creator. Generate exactly {card_count} high-quality flashcards.

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
- Vary question types

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

        response = await use_brainwave_for_text_generation(prompt, user_profile)
        
        # Parse JSON response
        json_match = re.search(r'\[.*\]', response, re.DOTALL)
        if json_match:
            json_str = json_match.group()
            try:
                flashcards_data = json.loads(json_str)
                
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
                            if generation_type == "topic" and topic:
                                set_title = f"Flashcards: {topic}"
                            else:
                                set_title = f"Generated Flashcards - {datetime.now().strftime('%Y-%m-%d')}"
                        
                        flashcard_set = models.FlashcardSet(
                            user_id=user.id,
                            title=set_title,
                            description=source_description,
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
        
        # Fallback response
        return {
            "flashcards": [
                {
                    "question": f"What is a key concept from {topic or 'this content'}?",
                    "answer": "Review the material and identify the main concepts.",
                    "difficulty": difficulty_level,
                    "category": "general"
                }
            ],
            "saved_to_set": False,
            "status": "fallback"
        }
        
    except Exception as e:
        logger.error(f"Error in generate_flashcards: {str(e)}")
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

@app.post("/generate_flashcards/")
async def generate_flashcards(
    user_id: str = Form(...),
    topic: str = Form(None),
    generation_type: str = Form("topic"),
    chat_data: str = Form(None),
    db: Session = Depends(get_db)
):
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

# --------------------------------------------------------------------------------------
# FILE PROCESSING ENDPOINTS
# --------------------------------------------------------------------------------------

async def process_image_file(file_content: bytes, filename: str, user) -> Dict:
    try:
        image = Image.open(io.BytesIO(file_content))
        
        extracted_text = ""
        try:
            extracted_text = pytesseract.image_to_string(image)
        except Exception as ocr_error:
            logger.error(f"OCR failed for {filename}: {str(ocr_error)}")
            extracted_text = "OCR text extraction failed"
        
        user_profile = build_user_profile_dict(user)
        
        if extracted_text.strip():
            prompt = f"""Analyze this image content with extracted text:

Text from image: {extracted_text[:2000]}

Provide:
1. A clear description of what this image contains
2. A comprehensive summary of the text content
3. Key information or important points
4. How this content could be useful for studying"""
        else:
            prompt = f"""This is an image file named '{filename}' without readable text. 
Provide general guidance on processing such images."""

        summary = await use_brainwave_for_text_generation(prompt, user_profile)
        
        return {
            "extracted_text": extracted_text.strip() or "No text detected",
            "summary": summary,
            "image_description": "Image processed successfully",
            "processing_status": "success"
        }
        
    except Exception as e:
        return {
            "extracted_text": f"Error: {str(e)}",
            "summary": f"Failed to process image {filename}",
            "image_description": "Image processing failed",
            "processing_status": "error"
        }

async def process_pdf_file(file_content: bytes, filename: str, user) -> Dict:
    try:
        extracted_text = ""
        page_count = 0
        
        try:
            pdf_document = fitz.open(stream=file_content, filetype="pdf")
            page_count = pdf_document.page_count
            
            for page_num in range(min(page_count, 10)):
                page = pdf_document[page_num]
                text = page.get_text()
                extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
            
            pdf_document.close()
        except Exception:
            try:
                pdf_file = io.BytesIO(file_content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                page_count = len(pdf_reader.pages)
                
                for page_num in range(min(page_count, 10)):
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    extracted_text += f"\n--- Page {page_num + 1} ---\n{text}"
            except Exception as pdf_error:
                extracted_text = f"PDF text extraction failed: {str(pdf_error)}"
        
        if extracted_text.strip() and len(extracted_text.strip()) > 50:
            text_for_ai = extracted_text[:3000]
            user_profile = build_user_profile_dict(user)
            
            prompt = f"""Analyze this PDF document:

Document: {filename}
Pages: {page_count}
Content: {text_for_ai}

Provide:
1. Document Overview
2. Main Topics
3. Important Points
4. Study Notes
5. Key Takeaways"""

            summary = await use_brainwave_for_text_generation(prompt, user_profile)
        else:
            summary = "PDF processed but no readable text content found."
        
        return {
            "extracted_text": extracted_text[:5000] + "..." if len(extracted_text) > 5000 else extracted_text,
            "summary": summary,
            "page_count": page_count,
            "processing_status": "success"
        }
        
    except Exception as e:
        return {
            "extracted_text": f"Error: {str(e)}",
            "summary": f"Failed to process PDF {filename}",
            "page_count": None,
            "processing_status": "error"
        }

@app.post("/upload_and_process_files")
async def upload_and_process_files(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        processed_files = []
        
        for file in files:
            if not file.filename:
                continue
                
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
                    image_result = await process_image_file(file_content, file.filename, user)
                    result.update(image_result)
                elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                    pdf_result = await process_pdf_file(file_content, file.filename, user)
                    result.update(pdf_result)
                else:
                    result["processing_status"] = "unsupported"
                    result["summary"] = f"File type {file_type} is not supported."
                
            except Exception as file_error:
                logger.error(f"Error processing file {file.filename}: {str(file_error)}")
                result["processing_status"] = "error"
                result["summary"] = f"Error: {str(file_error)}"
            
            processed_files.append(result)
        
        return {
            "status": "success",
            "processed_files": processed_files,
            "total_files": len(files),
            "successful_processing": len([f for f in processed_files if f["processing_status"] == "success"])
        }
        
    except Exception as e:
        logger.error(f"Error in file upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

@app.post("/ask_with_files/")
async def ask_ai_with_files(
    user_id: str = Form(...),
    question: str = Form(...),
    chat_id: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    db: Session = Depends(get_db)
):
    try:
        chat_id_int = None
        if chat_id:
            try:
                chat_id_int = int(chat_id)
            except ValueError:
                pass
        
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if chat_id_int:
            chat_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == chat_id_int,
                models.ChatSession.user_id == user.id
            ).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        
        file_context = ""
        processed_files_info = []
        
        if files:
            for file in files:
                if not file.filename:
                    continue
                    
                file_content = await file.read()
                file_type = file.content_type or mimetypes.guess_type(file.filename)[0]
                
                if file_type and file_type.startswith('image/'):
                    result = await process_image_file(file_content, file.filename, user)
                elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                    result = await process_pdf_file(file_content, file.filename, user)
                else:
                    result = {
                        "file_name": file.filename,
                        "extracted_text": f"Unsupported file type: {file_type}",
                        "summary": "This file type is not supported."
                    }
                
                processed_files_info.append(result)
                
                if result.get("extracted_text"):
                    file_context += f"\n\n--- Content from {file.filename} ---\n"
                    file_context += result["extracted_text"][:1500]
        
        recent_messages = db.query(models.ChatMessage).join(models.ChatSession).filter(
            models.ChatSession.user_id == user.id
        ).order_by(models.ChatMessage.timestamp.desc()).limit(5).all()
        
        conversation_history = []
        for msg in reversed(recent_messages):
            conversation_history.append({
                'user_message': msg.user_message,
                'ai_response': msg.ai_response,
                'timestamp': msg.timestamp
            })
        
        user_profile = build_user_profile_dict(user)
        
        if file_context:
            prompt = f"""You are a helpful AI tutor analyzing uploaded documents.

Student Profile:
- Name: {user.first_name or 'Student'}
- Field: {user.field_of_study or 'various subjects'}

UPLOADED DOCUMENT CONTENT:
{file_context}

Current Question: {question}

Provide a comprehensive response using the document content."""
        else:
            prompt = f"""You are a helpful AI tutor.

Student Profile:
- Name: {user.first_name or 'Student'}
- Field: {user.field_of_study or 'various subjects'}

Question: {question}

Provide a helpful, personalized response."""
        
        response = await use_brainwave_for_text_generation(prompt, user_profile, conversation_history)
        
        activity = models.Activity(
            user_id=user.id,
            question=question,
            answer=response,
            topic="Document Analysis" if file_context else "General"
        )
        db.add(activity)
        db.commit()
        
        return {
            "answer": response,
            "ai_confidence": 0.85 if file_context else 0.75,
            "files_processed": len(processed_files_info),
            "file_summaries": processed_files_info,
            "has_file_context": bool(file_context),
            "enhanced_features_used": True,
            "memory_persistent": True
        }
        
    except Exception as e:
        logger.error(f"ERROR in ask_ai_with_files: {str(e)}")
        return {
            "answer": f"I encountered an error processing your request. Please try again.",
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
    analysis_type: str = Form("summary"),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        analysis_results = []
        user_profile = build_user_profile_dict(user)
        
        for file in files:
            if not file.filename:
                continue
                
            file_content = await file.read()
            file_type = file.content_type or mimetypes.guess_type(file.filename)[0]
            
            if file_type and file_type.startswith('image/'):
                processing_result = await process_image_file(file_content, file.filename, user)
            elif file_type == 'application/pdf' or file.filename.lower().endswith('.pdf'):
                processing_result = await process_pdf_file(file_content, file.filename, user)
            else:
                continue
            
            extracted_text = processing_result.get("extracted_text", "")
            
            if analysis_type == "summary":
                analysis_prompt = f"""Provide a comprehensive summary of this document:
Content: {extracted_text[:2000]}"""
            elif analysis_type == "key_points":
                analysis_prompt = f"""Extract key points from this document:
Content: {extracted_text[:2000]}"""
            elif analysis_type == "study_guide":
                analysis_prompt = f"""Create a study guide from this document:
Content: {extracted_text[:2000]}"""
            elif analysis_type == "questions":
                analysis_prompt = f"""Generate study questions from this document:
Content: {extracted_text[:2000]}"""
            
            try:
                analysis_response = await use_brainwave_for_text_generation(analysis_prompt, user_profile)
            except Exception:
                analysis_response = f"Analysis of {file.filename} completed."
            
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
        logger.error(f"Error in document analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {str(e)}")

# --------------------------------------------------------------------------------------
# PROFILE MANAGEMENT ENDPOINTS
# --------------------------------------------------------------------------------------

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
            "preferredLanguage": "english"
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
                    "preferredLanguage": profile.preferred_language or "english"
                })
            except json.JSONDecodeError:
                pass
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
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
            "message": "Profile updated successfully",
            "profile_completion": profile.profile_completion_percentage
        }
        
    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update profile")

@app.get("/get_comprehensive_profile")
def get_comprehensive_profile(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            # ... continuing from previous code ...

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
            "motivationFactors": [],
            "weakAreas": [],
            "strongAreas": [],
            "bestStudyTimes": [],
            "preferredContentTypes": [],
            "devicePreferences": [],
            "accessibilityNeeds": [],
            "notificationPreferences": [],
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
        
        if profile:
            try:
                if profile.preferred_subjects:
                    result["preferredSubjects"] = json.loads(profile.preferred_subjects)
                if profile.motivation_factors:
                    result["motivationFactors"] = json.loads(profile.motivation_factors)
                if profile.weak_areas:
                    result["weakAreas"] = json.loads(profile.weak_areas)
                if profile.strong_areas:
                    result["strongAreas"] = json.loads(profile.strong_areas)
                if profile.best_study_times:
                    result["bestStudyTimes"] = json.loads(profile.best_study_times)
                if profile.preferred_content_types:
                    result["preferredContentTypes"] = json.loads(profile.preferred_content_types)
                if profile.device_preferences:
                    result["devicePreferences"] = json.loads(profile.device_preferences)
                if profile.accessibility_needs:
                    result["accessibilityNeeds"] = json.loads(profile.accessibility_needs)
                if profile.notification_preferences:
                    result["notificationPreferences"] = json.loads(profile.notification_preferences)
                
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
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing profile JSON: {e}")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get comprehensive profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get profile")

@app.post("/update_comprehensive_profile")
def update_comprehensive_profile(profile_data: ComprehensiveProfileUpdate, db: Session = Depends(get_db)):
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
        
        # Update profile fields
        profile.preferred_subjects = json.dumps(profile_data.preferredSubjects or [])
        profile.motivation_factors = json.dumps(profile_data.motivationFactors or [])
        profile.weak_areas = json.dumps(profile_data.weakAreas or [])
        profile.strong_areas = json.dumps(profile_data.strongAreas or [])
        profile.best_study_times = json.dumps(profile_data.bestStudyTimes or [])
        profile.preferred_content_types = json.dumps(profile_data.preferredContentTypes or [])
        profile.device_preferences = json.dumps(profile_data.devicePreferences or [])
        profile.accessibility_needs = json.dumps(profile_data.accessibilityNeeds or [])
        profile.notification_preferences = json.dumps(profile_data.notificationPreferences or [])
        
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
        
        profile.updated_at = datetime.utcnow()
        
        # Calculate completion percentage
        essential_fields = ['difficulty_level', 'learning_pace', 'study_schedule']
        completed_fields = sum(1 for field in essential_fields if getattr(profile, field, None))
        profile.profile_completion_percentage = min(100, int((completed_fields / len(essential_fields)) * 100))
        
        db.commit()
        db.refresh(user)
        db.refresh(profile)
        
        return {
            "status": "success",
            "message": "Comprehensive profile updated successfully",
            "profile_completion": profile.profile_completion_percentage
        }
        
    except Exception as e:
        logger.error(f"Failed to update comprehensive profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

# --------------------------------------------------------------------------------------
# LEARNING ANALYTICS ENDPOINTS
# --------------------------------------------------------------------------------------

@app.get("/get_weekly_progress")
def get_weekly_progress(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        week_ago = datetime.utcnow() - timedelta(days=7)
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= week_ago.date()
            )
        ).order_by(models.DailyLearningMetrics.date.asc()).all()
        
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
        logger.error(f"Error getting weekly progress: {str(e)}")
        return {"weekly_data": [0] * 7, "total_sessions": 0, "average_per_day": 0}

@app.get("/get_user_achievements")
def get_user_achievements(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        total_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user.id
        ).count()
        
        total_flashcards = db.query(models.Flashcard).join(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).count()
        
        total_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id
        ).count()
        
        achievements = []
        
        if total_activities > 0:
            achievements.append({
                "name": "First Steps",
                "description": "Completed your first AI chat session",
                "icon": "STAR",
                "earned_at": datetime.now().strftime('%Y-%m-%d')
            })
        
        if user_stats and user_stats.day_streak >= 7:
            achievements.append({
                "name": "Study Streak",
                "description": f"Maintained a {user_stats.day_streak}-day study streak",
                "icon": "FIRE",
                "earned_at": datetime.now().strftime('%Y-%m-%d')
            })
        
        if total_flashcards >= 50:
            achievements.append({
                "name": "Flashcard Master",
                "description": "Created 50 flashcards",
                "icon": "CARDS",
                "earned_at": datetime.now().strftime('%Y-%m-%d')
            })
        
        if total_notes >= 10:
            achievements.append({
                "name": "Note Taker",
                "description": "Created 10 study notes",
                "icon": "BOOK",
                "earned_at": datetime.now().strftime('%Y-%m-%d')
            })
        
        return {"achievements": achievements}
        
    except Exception as e:
        logger.error(f"Error getting achievements: {str(e)}")
        return {"achievements": []}

@app.get("/get_learning_analytics")
def get_learning_analytics(
    user_id: str = Query(...),
    period: str = Query("week"),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        end_date = datetime.utcnow().date()
        if period == "week":
            start_date = end_date - timedelta(days=7)
        elif period == "month":
            start_date = end_date - timedelta(days=30)
        elif period == "year":
            start_date = end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=7)
        
        metrics = db.query(models.DailyLearningMetrics).filter(
            and_(
                models.DailyLearningMetrics.user_id == user.id,
                models.DailyLearningMetrics.date >= start_date,
                models.DailyLearningMetrics.date <= end_date
            )
        ).order_by(models.DailyLearningMetrics.date.asc()).all()
        
        total_sessions = sum(m.sessions_completed for m in metrics)
        total_time = sum(m.time_spent_minutes for m in metrics)
        total_questions = sum(m.questions_answered for m in metrics)
        total_correct = sum(m.correct_answers for m in metrics)
        
        accuracy = (total_correct / total_questions * 100) if total_questions > 0 else 0
        avg_session_time = (total_time / total_sessions) if total_sessions > 0 else 0
        
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
        logger.error(f"Error getting learning analytics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get analytics")

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
        logger.error(f"Error getting activity heatmap: {str(e)}")
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

@app.post("/track_session_time")
def track_session_time(time_data: TimeTrackingUpdate, db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, time_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.utcnow().date()
        
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
        
        daily_metric.time_spent_minutes += time_data.time_spent_minutes
        
        user_stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user.id
        ).first()
        
        if not user_stats:
            user_stats = models.UserStats(user_id=user.id)
            db.add(user_stats)
        
        user_stats.total_hours += (time_data.time_spent_minutes / 60)
        user_stats.last_activity = datetime.utcnow()
        
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
        
        enhanced_stats.last_active_date = datetime.utcnow()
        enhanced_stats.updated_at = datetime.utcnow()
        
        if time_data.session_type in ['ai-chat', 'flashcards', 'notes']:
            daily_metric.sessions_completed += 1
            if time_data.session_type == 'ai-chat':
                daily_metric.questions_answered += 1
                daily_metric.correct_answers += 1
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Session time tracked successfully",
            "total_time_today": daily_metric.time_spent_minutes,
            "total_hours": user_stats.total_hours
        }
        
    except Exception as e:
        logger.error(f"Error tracking session time: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to track session time")

@app.post("/start_session")
def start_session(
    user_id: str = Form(...),
    session_type: str = Form(...),
    db: Session = Depends(get_db)
):
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
        logger.error(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to end session")

@app.post("/set_learning_goal")
def set_learning_goal(
    user_id: str = Form(...),
    goal_type: str = Form(...),
    target_value: int = Form(...),
    target_period: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        enhanced_stats = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user.id
        ).first()
        
        if not enhanced_stats:
            enhanced_stats = models.EnhancedUserStats(user_id=user.id)
            db.add(enhanced_stats)
        
        if goal_type == "sessions" and target_period == "monthly":
            enhanced_stats.monthly_goal = target_value
        
        enhanced_stats.updated_at = datetime.utcnow()
        db.commit()
        
        return {
            "status": "success",
            "message": f"Goal set: {target_value} {goal_type} per {target_period}"
        }
        
    except Exception as e:
        logger.error(f"Error setting goal: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to set goal")

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
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        today = datetime.utcnow().date()
        
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
        
        daily_metric.sessions_completed += 1
        daily_metric.time_spent_minutes += duration_minutes
        daily_metric.questions_answered += questions_answered
        daily_metric.correct_answers += correct_answers
        
        try:
            current_topics = json.loads(daily_metric.topics_studied or "[]")
            new_topics = json.loads(topics_studied)
            combined_topics = list(set(current_topics + new_topics))
            daily_metric.topics_studied = json.dumps(combined_topics)
        except json.JSONDecodeError:
            daily_metric.topics_studied = topics_studied
        
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
        logger.error(f"Error recording session: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record session")

# --------------------------------------------------------------------------------------
# LEARNING REVIEWS WITH BRAINWAVE
# --------------------------------------------------------------------------------------

@app.post("/create_learning_review")
async def create_learning_review(review_data: LearningReviewCreate, db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, review_data.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        chat_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.id.in_(review_data.chat_session_ids),
            models.ChatSession.user_id == user.id
        ).all()
        
        if not chat_sessions:
            raise HTTPException(status_code=404, detail="No valid chat sessions found")
        
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
        
        user_profile = build_user_profile_dict(user)
        
        analysis_prompt = f"""Extract key learning points from these educational conversations:

Student: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}

Conversations from {len(chat_sessions)} session(s):
{combined_conversation[:4000]}

Create a JSON object with:
{{
    "core_concepts": ["Main ideas and theories"],
    "important_definitions": ["Key terms and meanings"],
    "practical_applications": ["Real-world applications"],
    "critical_insights": ["Important conclusions"],
    "study_tips": ["Study methods mentioned"]
}}"""

        try:
            analysis_response = await use_brainwave_for_text_generation(analysis_prompt, user_profile)
            
            json_match = re.search(r'\{.*\}', analysis_response, re.DOTALL)
            if json_match:
                try:
                    learning_points = json.loads(json_match.group())
                except json.JSONDecodeError:
                    learning_points = parse_learning_points_fallback(analysis_response)
            else:
                learning_points = parse_learning_points_fallback(analysis_response)
                
        except Exception as ai_error:
            logger.error(f"AI analysis failed: {ai_error}")
            learning_points = create_basic_learning_points(combined_conversation)
        
        learning_review = models.LearningReview(
            user_id=user.id,
            title=review_data.review_title,
            source_sessions=json.dumps(review_data.chat_session_ids),
            source_content=combined_conversation[:5000],
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
                "objective": "Test your knowledge retention",
                "task": "Write down everything you remember",
                "process": "Submit and get feedback",
                "hints": "Request hints if needed"
            },
            "status": "created"
        }
        
    except Exception as e:
        logger.error(f"Error creating learning review: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create learning review: {str(e)}")

# Helper functions for learning reviews
def parse_learning_points_fallback(ai_response):
    return {
        "core_concepts": ["Review the main concepts discussed"],
        "important_definitions": ["Identify key terms and meanings"],
        "practical_applications": ["Consider practical applications"],
        "critical_insights": ["Reflect on important conclusions"],
        "study_tips": ["Remember study methods shared"]
    }

def create_basic_learning_points(conversation_text):
    questions = re.findall(r'Q: ([^\n]+)', conversation_text)
    
    return {
        "core_concepts": [f"Concept: {q[:50]}..." for q in questions[:3]],
        "important_definitions": ["Key terms discussed"],
        "practical_applications": ["Real-world applications"],
        "critical_insights": ["Important insights"],
        "study_tips": ["Study methods discussed"]
    }

# --------------------------------------------------------------------------------------
# ENHANCED FEATURES INTEGRATION
# --------------------------------------------------------------------------------------

# ... continuing from previous code ...

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
        logger.error(f"Error processing feedback: {str(e)}")
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
        logger.error(f"Error getting AI metrics: {str(e)}")
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
        logger.error(f"Error getting conversation starters: {str(e)}")
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
            
        except Exception:
            return {
                "personalization_confidence": 0.0,
                "learning_style": {"primary": "balanced"},
                "migration_status": "not_run"
            }
        
    except Exception as e:
        logger.error(f"Error getting personalization insights: {str(e)}")
        return {
            "personalization_confidence": 0.0,
            "error": "Could not retrieve personalization data"
        }

@app.post("/generate_note_summary/")
async def generate_note_summary(
    user_id: str = Form(...),
    conversation_data: str = Form(...),
    session_titles: str = Form(...),
    import_mode: str = Form("summary"),
    db: Session = Depends(get_db)
):
    try:
        user = get_user_by_username(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        try:
            titles = json.loads(session_titles)
        except:
            titles = ["Chat Session"]
        
        user_profile = build_user_profile_dict(user)
        
        if import_mode == "summary":
            prompt = f"""Convert chat conversations into well-structured study notes.

Student: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}

Chat Conversations:
{conversation_data[:4000]}

Create study notes with:
1. Clear title
2. Main topics as headers
3. Key concepts in bold
4. Important definitions
5. Examples and explanations
6. Summary sections

Format as JSON with 'title' and 'content' fields:"""

        elif import_mode == "exam_prep":
            prompt = f"""Transform chat conversations into an exam preparation guide.

Student: {user.first_name or 'Student'} studying {user.field_of_study or 'various subjects'}

Chat Conversations:
{conversation_data[:4000]}

Create exam guide with:
1. Executive Summary
2. Learning Objectives
3. Core Concepts
4. Key Definitions
5. Study Strategies
6. Practice Questions
7. Review Checklist

Format as JSON with 'title' and 'content' fields:"""

        else:
            prompt = f"""Convert chat conversations into a formatted transcript.

Student: {user.first_name or 'Student'}

Chat Conversations:
{conversation_data[:4000]}

Create clean transcript with proper formatting.
Format as JSON with 'title' and 'content' fields:"""

        response = await use_brainwave_for_text_generation(prompt, user_profile)
        
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except json.JSONDecodeError:
                pass
        
        # Fallback generation
        if import_mode == "summary":
            title = f"Study Notes - {len(titles)} Session(s)"
            content = generate_summary_content(conversation_data, titles, user)
        elif import_mode == "exam_prep":
            title = f"Exam Prep Guide - {len(titles)} Session(s)"
            content = generate_exam_prep_content(conversation_data, titles, user)
        else:
            title = f"Chat Transcript - {len(titles)} Session(s)"
            content = generate_transcript_content(conversation_data, titles)
        
        return {"title": title, "content": content}
        
    except Exception as e:
        logger.error(f"Error generating note summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate note summary: {str(e)}")

@app.post("/generate_chat_summary")
async def generate_chat_summary(
    chat_data: str = Form(...),
    max_words: int = Form(4),
    format: str = Form("title"),
    db: Session = Depends(get_db)
):
    try:
        user_profile = {
            "first_name": "Student",
            "field_of_study": "General Studies",
            "learning_style": "Mixed",
            "school_university": "Student"
        }
        
        prompt = f"""Create a precise 4-word title from this content:

{chat_data[:2000]}

Rules:
- EXACTLY 4 words
- Focus on main topic
- Use academic/technical terms
- Capitalize each word
- No punctuation

Generate only the 4-word title:"""

        response = await use_brainwave_for_text_generation(prompt, user_profile)
        
        title = response.strip().replace('"', '').replace("'", "")
        words = title.split()
        
        if len(words) >= 4:
            final_title = ' '.join(words[:4])
        else:
            content_words = extract_meaningful_words(chat_data)
            needed_words = 4 - len(words)
            words.extend(content_words[:needed_words])
            final_title = ' '.join(words[:4])
        
        return {
            "summary": final_title,
            "word_count": len(final_title.split()),
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        fallback_title = extract_meaningful_words(chat_data)
        return {
            "summary": ' '.join(fallback_title[:4]) if fallback_title else "Study Session Cards",
            "word_count": 4,
            "status": "fallback"
        }

def extract_meaningful_words(text):
    priority_terms = [
        'network', 'port', 'protocol', 'tcp', 'udp', 'computer', 'server',
        'physics', 'chemistry', 'biology', 'mathematics', 'calculus',
        'programming', 'algorithm', 'function', 'variable', 'data',
        'history', 'literature', 'psychology', 'philosophy'
    ]
    
    text_lower = text.lower()
    found_priority = [term.title() for term in priority_terms if term in text_lower]
    
    if len(found_priority) >= 4:
        return found_priority[:4]
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text)
    stop_words = {
        'what', 'how', 'can', 'you', 'please', 'explain', 'tell', 'about',
        'the', 'and', 'for', 'with', 'this', 'that', 'these', 'those'
    }
    
    meaningful_words = [
        word.title() for word in words 
        if word.lower() not in stop_words and len(word) > 3
    ]
    
    result = found_priority + [w for w in meaningful_words if w not in found_priority]
    return result[:4] if result else ['Study', 'Session', 'Cards', 'Generated']

# Helper functions for content generation
def generate_summary_content(conversation_data, titles, user):
    return f"""# Study Notes

**Student:** {user.first_name} {user.last_name}
**Field:** {user.field_of_study or 'General'}
**Generated:** {datetime.now().strftime('%B %d, %Y')}

## Key Topics

{conversation_data[:1000]}...

## Summary

Review these concepts thoroughly for best understanding.
"""

def generate_exam_prep_content(conversation_data, titles, user):
    return f"""# Exam Preparation Guide

**Student:** {user.first_name} {user.last_name}
**Subject:** {user.field_of_study or 'General'}
**Date:** {datetime.now().strftime('%B %d, %Y')}

## Learning Objectives

{conversation_data[:1000]}...

## Study Strategy

Focus on understanding core concepts and practice application.
"""

def generate_transcript_content(conversation_data, titles):
    return f"""# Chat Transcript

**Export Date:** {datetime.now().strftime('%B %d, %Y')}
**Sessions:** {len(titles)}

## Conversations

{conversation_data}
"""

# --------------------------------------------------------------------------------------
# DEBUG AND TESTING ENDPOINTS
# --------------------------------------------------------------------------------------

@app.get("/test_brainwave")
def test_brainwave():
    try:
        device_info = {
            "device": DEVICE,
            "torch_available": _have_torch,
            "transformers_available": _have_tf
        }
        
        math_result = fast_math_or_none("2 + 2")
        model_config = select_models_for_device(DEVICE)
        
        return {
            "status": "success",
            "message": "Brainwave AI Router is working",
            "device_info": device_info,
            "fast_math_test": f"2 + 2 = {math_result}",
            "model_config": model_config,
            "router_initialized": brainwave_router is not None
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "device": DEVICE}

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
            }
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

@app.get("/test_simple_brainwave")
async def test_simple_brainwave():
    try:
        user_profile = {
            "first_name": "Test",
            "field_of_study": "General",
            "learning_style": "Mixed",
            "school_university": "Test"
        }
        
        result = await brainwave_router.route_query(
            "Just say hello",
            "test_user",
            user_profile
        )
        
        return {
            "status": "success",
            "response": result.get("response", "No response"),
            "message": "Brainwave is working correctly",
            "device": DEVICE,
            "model_used": result.get("model_used", "unknown")
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Brainwave is not working properly"
        }

# --------------------------------------------------------------------------------------
# Main Application Entry
# --------------------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    
    # Ensure directories exist
    ensure_dir(CONFIG.models_dir)
    ensure_dir(CONFIG.export_dir)
    
    logger.info(f"Starting Brainwave AI Backend v3.0.0")
    logger.info(f"Device: {DEVICE}")
    logger.info(f"Models available: {_have_torch and _have_tf}")
    logger.info(f"Enhanced features: {ENHANCED_FEATURES_AVAILABLE}")
    logger.info(f"All API endpoints loaded successfully")
    
    uvicorn.run(app, host="127.0.0.1", port=8001, reload=False)

