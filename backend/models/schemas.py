from typing import Optional, List
from pydantic import BaseModel


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


class LearningReviewSummary(BaseModel):
    id: int
    title: str
    status: str
    total_points: int
    best_score: float
    current_attempt: int
    attempt_count: int
    session_titles: List[str]
    created_at: str
    completed_at: Optional[str]
    can_continue: bool


class ComprehensiveProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None

    preferred_first_name: Optional[str] = None
    preferred_last_name: Optional[str] = None
    study_goals: Optional[str] = None
    career_goals: Optional[str] = None
    preferred_subjects: Optional[List[str]] = None
    difficulty_level: Optional[str] = None
    study_schedule: Optional[str] = None
    learning_pace: Optional[str] = None
    motivation_factors: Optional[List[str]] = None
    weak_areas: Optional[List[str]] = None
    strong_areas: Optional[List[str]] = None
    time_zone: Optional[str] = None
    study_environment: Optional[str] = None
    preferred_language: Optional[str] = None
    preferred_session_length: Optional[str] = None
    break_frequency: Optional[str] = None
    best_study_times: Optional[List[str]] = None
    preferred_content_types: Optional[List[str]] = None
    learning_challenges: Optional[str] = None
    device_preferences: Optional[List[str]] = None
    accessibility_needs: Optional[List[str]] = None
    notification_preferences: Optional[List[str]] = None
    contact_method: Optional[str] = None
    communication_frequency: Optional[str] = None
    data_consent: Optional[List[str]] = None
    profile_visibility: Optional[str] = None

    class Config:
        extra = "ignore"
