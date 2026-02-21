import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import requests
from fastapi import APIRouter, Body, Depends, Form, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, func, text
from sqlalchemy.orm import Session

import models
from deps import (
    ALGORITHM,
    GOOGLE_CLIENT_ID,
    SECRET_KEY,
    authenticate_user,
    call_ai,
    create_access_token,
    get_comprehensive_profile_safe,
    get_current_user,
    get_db,
    get_password_hash,
    get_user_by_email,
    get_user_by_username,
    ph,
    security,
    unified_ai,
    verify_google_token,
    verify_password,
    verify_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


class RegisterPayload(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    username: str
    password: str
    age: Optional[int] = None
    field_of_study: Optional[str] = None
    learning_style: Optional[str] = None
    school_university: Optional[str] = None


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


@router.get("/get_daily_goal_progress")
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


@router.post("/register")
async def register(payload: RegisterPayload, db: Session = Depends(get_db)):
    logger.info(f"Registering user: {payload.username}")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already registered")

    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(payload.password)

    max_retries = 2
    for attempt in range(max_retries):
        try:
            db_user = models.User(
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=payload.email,
                username=payload.username,
                hashed_password=hashed_password,
                age=payload.age,
                field_of_study=payload.field_of_study,
                learning_style=payload.learning_style,
                school_university=payload.school_university,
                google_user=False,
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)

            user_stats = models.UserStats(user_id=db_user.id)
            db.add(user_stats)
            db.commit()

            logger.info(f"User {payload.username} registered successfully")
            return {"message": "User registered successfully"}

        except Exception as e:
            db.rollback()
            error_msg = str(e).lower()

            if "duplicate key" in error_msg and "pkey" in error_msg and attempt < max_retries - 1:
                logger.warning(f"Sequence error detected, fixing... (attempt {attempt + 1})")

                try:
                    max_id_query = text("SELECT COALESCE(MAX(id), 0) FROM users")
                    max_id = db.execute(max_id_query).scalar()

                    fix_query = text("SELECT setval('users_id_seq', :next_id)")
                    db.execute(fix_query, {"next_id": max_id + 1})
                    db.commit()

                    logger.info(f"Sequence fixed to {max_id + 1}, retrying registration...")
                    continue

                except Exception as fix_error:
                    logger.error(f"Failed to fix sequence: {str(fix_error)}")

            logger.error(f"Registration failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Registration failed. Please try again.")

    raise HTTPException(status_code=500, detail="Registration failed after retries")


@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token_form")
async def login_form(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google-auth")
async def google_auth(auth_data: GoogleAuth, db: Session = Depends(get_db)):
    try:
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={auth_data.token}"
            response = requests.get(url)
            user_info = response.json() if response.status_code == 200 else verify_google_token(auth_data.token)
        except Exception:
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
        else:
            user.last_login = datetime.utcnow()
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


@router.post("/firebase-auth")
async def firebase_authentication(request: Request, db: Session = Depends(get_db)):
    from database import DATABASE_URL as db_url
    max_retries = 2
    for attempt in range(max_retries):
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
            is_new_user = False

            if not user:
                is_new_user = True
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

                gamif_stats = models.UserGamificationStats(
                    user_id=user.id,
                    week_start_date=datetime.now(timezone.utc)
                )
                db.add(gamif_stats)

                db.commit()
                logger.info(f"New user created via Firebase: {email}")

            access_token = create_access_token(
                data={"sub": user.username, "user_id": user.id}
            )

            return {
                "access_token": access_token,
                "token_type": "bearer",
                "is_new_user": is_new_user,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "picture_url": user.picture_url,
                    "google_user": True
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            error_msg = str(e).lower()

            if "duplicate key" in error_msg and "pkey" in error_msg and attempt < max_retries - 1:
                logger.warning(f"Sequence error on Firebase auth, fixing... (attempt {attempt + 1})")
                try:
                    if db_url and "postgres" in db_url:
                        max_id_query = text("SELECT COALESCE(MAX(id), 0) FROM users")
                        max_id = db.execute(max_id_query).scalar()
                        fix_query = text("SELECT setval('users_id_seq', :next_id)")
                        db.execute(fix_query, {"next_id": max_id + 1})
                        db.commit()
                        logger.info("Sequence fixed, retrying...")
                        continue
                except Exception as fix_error:
                    logger.error(f"Failed to fix sequence: {str(fix_error)}")

            logger.error(f"Firebase auth error: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

    raise HTTPException(status_code=500, detail="Authentication failed after retries")


@router.get("/me")
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


@router.get("/check_profile_quiz")
async def check_profile_quiz(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        has_completed_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.primary_archetype is not None and
            comprehensive_profile.primary_archetype != ""
        )

        has_skipped_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.quiz_skipped == True
        )

        quiz_flow_completed = has_completed_quiz or has_skipped_quiz

        logger.info(f"check_profile_quiz for {user_id}: completed={has_completed_quiz}, skipped={has_skipped_quiz}, flow_completed={quiz_flow_completed}")

        return {
            "completed": quiz_flow_completed,
            "quiz_completed": has_completed_quiz,
            "quiz_skipped": has_skipped_quiz,
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking quiz: {str(e)}")
        return {"completed": False}


@router.get("/is_first_time_user")
async def is_first_time_user(user_id: str = Query(...), db: Session = Depends(get_db)):
    try:
        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        now = datetime.now(timezone.utc)

        user_created = user.created_at
        if user_created.tzinfo is None:
            user_created = user_created.replace(tzinfo=timezone.utc)

        user_last_login = user.last_login
        if user_last_login and user_last_login.tzinfo is None:
            user_last_login = user_last_login.replace(tzinfo=timezone.utc)

        if user_last_login:
            time_between_creation_and_login = abs((user_last_login - user_created).total_seconds())
            is_first_login = time_between_creation_and_login < 120
        else:
            is_first_login = True

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        has_completed_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.primary_archetype is not None and
            comprehensive_profile.primary_archetype != ""
        )

        has_skipped_quiz = (
            comprehensive_profile is not None and
            comprehensive_profile.quiz_skipped == True
        )

        quiz_flow_done = has_completed_quiz or has_skipped_quiz

        is_first_time = is_first_login and not quiz_flow_done

        time_since_creation = now - user_created

        logger.info(f"is_first_time_user for {user_id}: is_first_time={is_first_time}, is_first_login={is_first_login}, quiz_completed={has_completed_quiz}, quiz_skipped={has_skipped_quiz}, account_age_minutes={time_since_creation.total_seconds() / 60:.2f}")

        return {
            "is_first_time": is_first_time,
            "is_first_login": is_first_login,
            "account_age_minutes": time_since_creation.total_seconds() / 60,
            "quiz_completed": has_completed_quiz,
            "quiz_skipped": has_skipped_quiz,
            "user_id": user_id
        }

    except Exception as e:
        logger.error(f"Error checking first-time user: {str(e)}")
        return {"is_first_time": False}


@router.post("/start_session")
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
            "start_time": datetime.now(timezone.utc).isoformat() + 'Z',
            "message": f"Started {session_type} session"
        }

    except Exception as e:
        logger.error(f"Error starting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start session")


@router.post("/end_session")
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

        logger.info(f"Session ended: user={user.email}, sessions_today={daily_metric.sessions_completed}, time={daily_metric.time_spent_minutes}")

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


@router.post("/save_archetype_profile")
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


@router.get("/get_comprehensive_profile")
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
            show_insights_value = comprehensive_profile.show_study_insights
            notifications_value = comprehensive_profile.notifications_enabled
            logger.info(f"Loading profile - show_study_insights from DB: {show_insights_value} (type: {type(show_insights_value)})")

            result.update({
                "difficultyLevel": comprehensive_profile.difficulty_level or "intermediate",
                "learningPace": comprehensive_profile.learning_pace or "moderate",
                "brainwaveGoal": comprehensive_profile.brainwave_goal or "",
                "primaryArchetype": comprehensive_profile.primary_archetype or "",
                "secondaryArchetype": comprehensive_profile.secondary_archetype or "",
                "archetypeDescription": comprehensive_profile.archetype_description or "",
                "showStudyInsights": show_insights_value if show_insights_value is not None else True,
                "notificationsEnabled": notifications_value if notifications_value is not None else True
            })

            try:
                if comprehensive_profile.preferred_subjects:
                    result["preferredSubjects"] = json.loads(comprehensive_profile.preferred_subjects)
            except Exception:
                result["preferredSubjects"] = []
        else:
            result["showStudyInsights"] = True
            result["notificationsEnabled"] = True

        return result

    except Exception as e:
        logger.error(f"Error getting profile: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update_comprehensive_profile")
async def update_comprehensive_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        logger.info(f"Received profile update payload: {payload}")

        user_id = payload.get("user_id")
        if not user_id:
            logger.error("No user_id in payload!")
            raise HTTPException(status_code=400, detail="user_id is required")

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

        if "showStudyInsights" in payload:
            value = payload["showStudyInsights"]
            if isinstance(value, str):
                value = value.lower() == 'true'
            comprehensive_profile.show_study_insights = bool(value)
            logger.info(f"Setting show_study_insights to: {comprehensive_profile.show_study_insights} (received: {payload['showStudyInsights']})")

        if "notificationsEnabled" in payload:
            value = payload["notificationsEnabled"]
            if isinstance(value, str):
                value = value.lower() == "true"
            comprehensive_profile.notifications_enabled = bool(value)

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


@router.post("/suggest_subjects")
async def suggest_subjects(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        input_text = payload.get("input", "")
        college_level = payload.get("college_level", "")

        if len(input_text) < 2:
            return {"suggestions": []}

        prompt = f"""Based on the input "{input_text}" and college level "{college_level}", suggest 5 relevant academic subjects or courses.

Return ONLY a JSON array of subject names, nothing else. Format: ["Subject 1", "Subject 2", ...]

Examples:
- Input "calc" → ["Calculus I", "Calculus II", "Calculus III", "Multivariable Calculus", "Differential Calculus"]
- Input "bio" → ["Biology", "Molecular Biology", "Cell Biology", "Microbiology", "Biochemistry"]
- Input "comp" → ["Computer Science", "Computer Architecture", "Computational Theory", "Computer Networks", "Computer Graphics"]

Input: "{input_text}"
College Level: "{college_level}"
Suggestions:"""

        response = call_ai(prompt, max_tokens=200, temperature=0.7)

        try:
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                suggestions = json.loads(json_match.group())
            else:
                suggestions = [s.strip().strip('"').strip("'").strip('-').strip()
                               for s in response.split('\n') if s.strip()]
                suggestions = [s for s in suggestions if len(s) > 2 and len(s) < 50][:5]
        except Exception:
            suggestions = []

        return {"suggestions": suggestions}

    except Exception as e:
        logger.error(f"Error generating subject suggestions: {str(e)}")
        return {"suggestions": []}


@router.post("/save_complete_profile")
async def save_complete_profile(
    payload: dict = Body(...),
    db: Session = Depends(get_db)
):
    try:
        user_id = payload.get("user_id")
        logger.info(f"save_complete_profile called for {user_id}")
        logger.info(f"Payload: quiz_completed={payload.get('quiz_completed')}, quiz_skipped={payload.get('quiz_skipped')}")

        user = get_user_by_username(db, user_id) or get_user_by_email(db, user_id)
        if not user:
            logger.error(f"User not found: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()

        if not comprehensive_profile:
            logger.info(f"Creating new comprehensive profile for user {user.id}")
            comprehensive_profile = models.ComprehensiveUserProfile(user_id=user.id)
            db.add(comprehensive_profile)
        else:
            logger.info(f"Updating existing comprehensive profile for user {user.id}")

        if "is_college_student" in payload:
            comprehensive_profile.is_college_student = payload["is_college_student"]

        if "college_level" in payload:
            comprehensive_profile.college_level = payload["college_level"]

        if "major" in payload:
            comprehensive_profile.major = payload["major"]

        if "preferred_subjects" in payload:
            comprehensive_profile.preferred_subjects = json.dumps(payload["preferred_subjects"])

        if "main_subject" in payload:
            user.field_of_study = payload["main_subject"]
            comprehensive_profile.main_subject = payload["main_subject"]

        if "brainwave_goal" in payload:
            comprehensive_profile.brainwave_goal = payload["brainwave_goal"]

        if payload.get("quiz_completed"):
            comprehensive_profile.primary_archetype = payload.get("primary_archetype", "")
            comprehensive_profile.secondary_archetype = payload.get("secondary_archetype", "")
            comprehensive_profile.archetype_scores = json.dumps(payload.get("archetype_scores", {}))
            comprehensive_profile.archetype_description = payload.get("archetype_description", "")

        comprehensive_profile.quiz_completed = payload.get("quiz_completed", False)
        comprehensive_profile.quiz_skipped = payload.get("quiz_skipped", False)
        comprehensive_profile.updated_at = datetime.now(timezone.utc)

        db.flush()
        db.commit()
        db.refresh(comprehensive_profile)

        logger.info(f"Saved profile for {user_id}: quiz_completed={comprehensive_profile.quiz_completed}, quiz_skipped={comprehensive_profile.quiz_skipped}, profile_id={comprehensive_profile.id}")

        verify_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        logger.info(f"Verification query: quiz_skipped={verify_profile.quiz_skipped if verify_profile else 'NOT FOUND'}")

        if payload.get("quiz_completed"):
            try:
                from proactive_ai_system import get_proactive_ai_engine
                proactive_engine = get_proactive_ai_engine(unified_ai)
                user_profile_data = {
                    "first_name": user.first_name or "there",
                    "field_of_study": user.field_of_study or "General Studies",
                    "is_college_student": payload.get("is_college_student", True),
                    "college_level": payload.get("college_level", ""),
                    "subjects": payload.get("preferred_subjects", []),
                    "main_subject": payload.get("main_subject", ""),
                    "goal": payload.get("brainwave_goal", "")
                }

                greeting_prompt = f"""You are an AI tutor greeting {user_profile_data['first_name']} for the first time after they completed their profile.

Profile:
- College Student: {user_profile_data['is_college_student']}
- Level: {user_profile_data['college_level']}
- Main Subject: {user_profile_data['main_subject']}
- Goal: {user_profile_data['goal']}

Generate a warm, personalized greeting message (2-3 sentences) that:
1. Welcomes them by name
2. Acknowledges their specific subject and goal
3. Expresses excitement to help them succeed
4. Sounds natural and encouraging

Keep it brief and friendly."""

                greeting_message = call_ai(greeting_prompt, max_tokens=150, temperature=0.8)

                new_session = models.ChatSession(
                    user_id=user.id,
                    title="Welcome to Cerbyl",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                db.add(new_session)
                db.commit()
                db.refresh(new_session)

                greeting_chat = models.ChatMessage(
                    chat_session_id=new_session.id,
                    user_id=user.id,
                    user_message="PROFILE_COMPLETED",
                    ai_response=greeting_message,
                    timestamp=datetime.now(timezone.utc)
                )
                db.add(greeting_chat)
                db.commit()

            except Exception as e:
                logger.error(f"Error generating greeting: {str(e)}")

        return {
            "status": "success",
            "message": "Profile saved successfully",
            "quiz_completed": comprehensive_profile.quiz_completed,
            "quiz_skipped": comprehensive_profile.quiz_skipped
        }

    except Exception as e:
        logger.error(f"Error saving complete profile: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
