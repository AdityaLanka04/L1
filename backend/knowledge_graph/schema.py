"""
Knowledge Graph Schema Definitions
Defines node types, relationships, and data models for Neo4j
"""

from enum import Enum
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


class NodeType(str, Enum):
    """Types of nodes in the knowledge graph"""
    USER = "User"
    CONCEPT = "Concept"
    TOPIC = "Topic"
    FLASHCARD = "Flashcard"
    FLASHCARD_SET = "FlashcardSet"
    NOTE = "Note"
    QUIZ = "Quiz"
    QUESTION = "Question"
    STUDY_SESSION = "StudySession"
    LEARNING_PATH = "LearningPath"
    RESOURCE = "Resource"
    TAG = "Tag"


class RelationType(str, Enum):
    """Types of relationships in the knowledge graph"""
    # User relationships
    KNOWS = "KNOWS"                      # User -> Concept (with mastery level)
    CREATED = "CREATED"                  # User -> Content
    STUDIED = "STUDIED"                  # User -> Concept/Topic
    COMPLETED = "COMPLETED"              # User -> Quiz/Session
    FOLLOWS = "FOLLOWS"                  # User -> LearningPath
    INTERESTED_IN = "INTERESTED_IN"      # User -> Topic
    WEAK_IN = "WEAK_IN"                  # User -> Concept
    STRONG_IN = "STRONG_IN"              # User -> Concept
    
    # Concept relationships
    PREREQUISITE_OF = "PREREQUISITE_OF"  # Concept -> Concept
    RELATED_TO = "RELATED_TO"            # Concept -> Concept
    PART_OF = "PART_OF"                  # Concept -> Topic
    BUILDS_ON = "BUILDS_ON"              # Concept -> Concept
    SIMILAR_TO = "SIMILAR_TO"            # Concept -> Concept
    
    # Content relationships
    COVERS = "COVERS"                    # Content -> Concept
    TESTS = "TESTS"                      # Quiz/Question -> Concept
    MENTIONS = "MENTIONS"                # Note -> Concept
    CONTAINS = "CONTAINS"                # Set -> Item
    TAGGED_WITH = "TAGGED_WITH"          # Content -> Tag
    
    # Learning relationships
    REVIEWED = "REVIEWED"                # Session -> Flashcard
    ANSWERED = "ANSWERED"                # User -> Question
    GENERATED_FROM = "GENERATED_FROM"    # Flashcard -> Note/Resource


@dataclass
class BaseNode:
    """Base class for all nodes"""
    id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


@dataclass
class UserNode(BaseNode):
    """User node in knowledge graph"""
    user_id: int = 0
    username: str = ""
    learning_style: str = "mixed"
    difficulty_level: str = "intermediate"
    primary_archetype: str = ""
    study_goals: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "user_id": self.user_id,
            "username": self.username,
            "learning_style": self.learning_style,
            "difficulty_level": self.difficulty_level,
            "primary_archetype": self.primary_archetype,
            "study_goals": self.study_goals
        })
        return base


@dataclass
class ConceptNode(BaseNode):
    """Concept/knowledge node"""
    name: str = ""
    description: str = ""
    domain: str = ""  # e.g., "mathematics", "physics", "programming"
    subdomain: str = ""  # e.g., "calculus", "mechanics", "python"
    difficulty: float = 0.5  # 0-1 scale
    importance: float = 0.5  # 0-1 scale
    keywords: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "name": self.name,
            "description": self.description,
            "domain": self.domain,
            "subdomain": self.subdomain,
            "difficulty": self.difficulty,
            "importance": self.importance,
            "keywords": self.keywords
        })
        return base


@dataclass
class TopicNode(BaseNode):
    """Topic node (broader than concept)"""
    name: str = ""
    description: str = ""
    domain: str = ""
    concept_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "name": self.name,
            "description": self.description,
            "domain": self.domain,
            "concept_count": self.concept_count
        })
        return base


@dataclass
class FlashcardNode(BaseNode):
    """Flashcard node"""
    flashcard_id: int = 0
    front: str = ""
    back: str = ""
    difficulty: float = 0.5
    ease_factor: float = 2.5
    interval_days: int = 1
    review_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "flashcard_id": self.flashcard_id,
            "front": self.front,
            "back": self.back,
            "difficulty": self.difficulty,
            "ease_factor": self.ease_factor,
            "interval_days": self.interval_days,
            "review_count": self.review_count
        })
        return base


@dataclass
class NoteNode(BaseNode):
    """Note node"""
    note_id: int = 0
    title: str = ""
    content_preview: str = ""  # First 500 chars
    word_count: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "note_id": self.note_id,
            "title": self.title,
            "content_preview": self.content_preview,
            "word_count": self.word_count
        })
        return base


@dataclass
class StudySessionNode(BaseNode):
    """Study session node"""
    session_id: int = 0
    duration_minutes: int = 0
    cards_reviewed: int = 0
    correct_count: int = 0
    performance_score: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "session_id": self.session_id,
            "duration_minutes": self.duration_minutes,
            "cards_reviewed": self.cards_reviewed,
            "correct_count": self.correct_count,
            "performance_score": self.performance_score
        })
        return base


@dataclass 
class KnowsRelationship:
    """User KNOWS Concept relationship with mastery data"""
    mastery_level: float = 0.0  # 0-1 scale
    confidence: float = 0.0
    last_reviewed: Optional[datetime] = None
    review_count: int = 0
    correct_count: int = 0
    streak: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "mastery_level": self.mastery_level,
            "confidence": self.confidence,
            "last_reviewed": self.last_reviewed.isoformat() if self.last_reviewed else None,
            "review_count": self.review_count,
            "correct_count": self.correct_count,
            "streak": self.streak
        }


# Schema constraints and indexes for Neo4j
SCHEMA_CONSTRAINTS = [
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE",
    "CREATE CONSTRAINT concept_name IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE",
    "CREATE CONSTRAINT flashcard_id IF NOT EXISTS FOR (f:Flashcard) REQUIRE f.flashcard_id IS UNIQUE",
    "CREATE CONSTRAINT note_id IF NOT EXISTS FOR (n:Note) REQUIRE n.note_id IS UNIQUE",
    "CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE",
]

SCHEMA_INDEXES = [
    "CREATE INDEX user_username IF NOT EXISTS FOR (u:User) ON (u.username)",
    "CREATE INDEX concept_domain IF NOT EXISTS FOR (c:Concept) ON (c.domain)",
    "CREATE INDEX concept_keywords IF NOT EXISTS FOR (c:Concept) ON (c.keywords)",
    "CREATE INDEX flashcard_difficulty IF NOT EXISTS FOR (f:Flashcard) ON (f.difficulty)",
]
