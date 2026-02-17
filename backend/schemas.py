from typing import List, Optional
from pydantic import BaseModel


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


class ChatFolderCreate(BaseModel):
    user_id: str
    name: str
    color: Optional[str] = "#D7B38C"
    parent_id: Optional[int] = None


class ChatUpdateFolder(BaseModel):
    chat_id: int
    folder_id: Optional[int] = None


class FlashcardReviewRequest(BaseModel):
    user_id: str
    card_id: str
    was_correct: bool
    mode: str = "preview"


class GenerateChatTitleRequest(BaseModel):
    chat_id: int
    user_id: str


class AIWritingAssistRequest(BaseModel):
    user_id: str
    content: str
    action: str
    tone: Optional[str] = "professional"


class ShareContentRequest(BaseModel):
    content_type: str
    content_id: int
    friend_ids: List[int]
    message: Optional[str] = None
    permission: str = "view"


class RemoveSharedAccessRequest(BaseModel):
    share_id: int


class RegisterPayload(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str
    password: str
    age: Optional[int] = None
    field_of_study: Optional[str] = None
    learning_style: Optional[str] = None
    school_university: Optional[str] = None


class PlaylistCreateRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    is_public: bool = False
    tags: Optional[List[str]] = []


class PlaylistItemRequest(BaseModel):
    content_type: str
    content_id: int
    title: Optional[str] = None
    order_index: Optional[int] = None
