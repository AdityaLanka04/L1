from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, TypedDict, Optional


@dataclass
class StudentState:
    user_id: str = ""
    first_name: str = ""
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    preferred_style: str = "balanced"
    difficulty_level: str = "intermediate"
    current_subject: str = ""


@dataclass
class Neo4jInsights:
    relevant_concepts: list[str] = field(default_factory=list)
    prerequisites: list[str] = field(default_factory=list)
    common_mistakes: list[str] = field(default_factory=list)
    effective_strategies: list[str] = field(default_factory=list)
    mastery_levels: dict[str, float] = field(default_factory=dict)


@dataclass
class EvalResult:
    confusion_persists: bool = False
    strategy_worked: Optional[bool] = None
    mastery_confirmed: Optional[bool] = None
    new_struggle: Optional[bool] = None
    distilled_memory: Optional[str] = None


class TutorState(TypedDict, total=False):
    user_id: str
    user_input: str
    chat_id: Optional[int]
    chat_history: list[dict]
    intent: str
    student_state: StudentState
    neo4j_insights: Neo4jInsights
    episodic_memories: list[str]
    structured_context: list[str]
    rag_context: list[str]       # top-k curriculum chunks from context_store
    use_hs_context: bool         # enables RAG retrieval (default True)
    retrieval_gated: bool
    instructional_task: str
    response: str
    evaluation: EvalResult
    neo4j_updates: list[dict]
    chroma_writes: list[dict]
    error: Optional[str]
    _ai_client: Any
    _hs_ai_client: Any           # dedicated AI client for HS-context-enriched generation
    _db_factory: Any
