import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

import models
from deps import call_ai

logger = logging.getLogger(__name__)

VOICE_MODE_PROFILES: Dict[str, Dict[str, Any]] = {
    "coach": {
        "label": "Coach",
        "description": "Supportive and clear explanations with practical examples.",
        "ai_style": "Use encouraging language, explain concepts step-by-step, and include practical examples.",
        "speech_rate": 0.98,
        "speech_pitch": 1.0,
    },
    "story": {
        "label": "Story Mode",
        "description": "Narrative and memorable delivery.",
        "ai_style": "Explain with mini-stories and analogies while staying technically accurate.",
        "speech_rate": 0.93,
        "speech_pitch": 1.06,
    },
    "rapid": {
        "label": "Rapid Review",
        "description": "Fast high-yield revision mode.",
        "ai_style": "Prioritize high-yield facts, keep responses concise, and avoid extra filler.",
        "speech_rate": 1.08,
        "speech_pitch": 1.0,
    },
    "socratic": {
        "label": "Socratic",
        "description": "Question-led teaching with active recall.",
        "ai_style": "Use guided questioning and reveal answers clearly.",
        "speech_rate": 0.95,
        "speech_pitch": 1.01,
    },
    "exam": {
        "label": "Exam Prep",
        "description": "Exam-oriented framing and pitfalls.",
        "ai_style": "Focus on test-style framing, common mistakes, and exam-ready phrasing.",
        "speech_rate": 1.02,
        "speech_pitch": 0.98,
    },
}

VOICE_PERSONAS: Dict[str, Dict[str, Any]] = {
    "mentor": {
        "label": "Mentor",
        "description": "Calm, structured, and supportive.",
        "prompt_style": "Tone should be calm, practical, and mentor-like.",
        "speech_rate": 0.98,
        "speech_pitch": 1.0,
    },
    "professor": {
        "label": "Professor",
        "description": "Formal, precise, and concept-focused.",
        "prompt_style": "Tone should be precise, academic, and concise.",
        "speech_rate": 0.96,
        "speech_pitch": 0.98,
    },
    "friend": {
        "label": "Study Friend",
        "description": "Friendly and easy-going explanations.",
        "prompt_style": "Tone should be friendly, conversational, and confidence-building.",
        "speech_rate": 1.0,
        "speech_pitch": 1.04,
    },
    "host": {
        "label": "Podcast Host",
        "description": "Energetic host-style delivery.",
        "prompt_style": "Tone should feel like a polished podcast host: engaging and smooth.",
        "speech_rate": 1.03,
        "speech_pitch": 1.02,
    },
    "minimal": {
        "label": "Minimal",
        "description": "Compact and no-fluff responses.",
        "prompt_style": "Use compact, direct language and avoid filler.",
        "speech_rate": 1.06,
        "speech_pitch": 1.0,
    },
}

SUPPORTED_LANGUAGES: List[Dict[str, str]] = [
    {"code": "en", "label": "English"},
    {"code": "hi", "label": "Hindi"},
    {"code": "es", "label": "Spanish"},
    {"code": "fr", "label": "French"},
    {"code": "de", "label": "German"},
    {"code": "te", "label": "Telugu"},
]

DIFFICULTY_LEVELS: Dict[str, Dict[str, str]] = {
    "basic": {
        "label": "Basic",
        "instruction": "Use simple language and avoid heavy jargon.",
    },
    "intermediate": {
        "label": "Intermediate",
        "instruction": "Balance clarity and technical depth.",
    },
    "advanced": {
        "label": "Advanced",
        "instruction": "Use precise terminology and deeper reasoning.",
    },
}


def _safe_json_loads(value: Optional[str], fallback: Any):
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


@dataclass
class PodcastSession:
    session_id: str
    user_id: int
    title: str
    source_type: str
    voice_mode: str
    voice_persona: str
    difficulty: str
    answer_language: str
    transcript: str
    analysis: Dict[str, Any]
    key_takeaways: List[str] = field(default_factory=list)
    chapters: List[Dict[str, Any]] = field(default_factory=list)
    current_index: int = -1
    conversation: List[Dict[str, Any]] = field(default_factory=list)
    mcq_state: Dict[str, Any] = field(default_factory=dict)
    session_options: Dict[str, Any] = field(default_factory=dict)
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    ended: bool = False


class PodcastAgentService:
    def __init__(self):
        self._sessions: Dict[str, PodcastSession] = {}
        self._session_ttl = timedelta(hours=8)

    def list_voice_modes(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": mode_id,
                "label": mode["label"],
                "description": mode["description"],
                "speech_rate": mode["speech_rate"],
                "speech_pitch": mode["speech_pitch"],
            }
            for mode_id, mode in VOICE_MODE_PROFILES.items()
        ]

    def list_voice_personas(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": persona_id,
                "label": persona["label"],
                "description": persona["description"],
                "speech_rate": persona["speech_rate"],
                "speech_pitch": persona["speech_pitch"],
            }
            for persona_id, persona in VOICE_PERSONAS.items()
        ]

    def list_supported_languages(self) -> List[Dict[str, str]]:
        return SUPPORTED_LANGUAGES

    def list_difficulty_levels(self) -> List[Dict[str, str]]:
        return [{"id": key, "label": value["label"]} for key, value in DIFFICULTY_LEVELS.items()]

    def start_session(
        self,
        *,
        db: Session,
        user_id: int,
        transcript: str,
        analysis: Optional[Dict[str, Any]],
        title: str,
        source_type: str,
        voice_mode: str,
        voice_persona: str,
        difficulty: str,
        answer_language: str,
        session_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self._cleanup_expired_sessions()

        cleaned_transcript = self._clean_text(transcript)
        if len(cleaned_transcript) < 120:
            raise ValueError("Transcript is too short to generate a podcast episode")

        selected_voice_mode = voice_mode if voice_mode in VOICE_MODE_PROFILES else "coach"
        selected_persona = voice_persona if voice_persona in VOICE_PERSONAS else "mentor"
        selected_difficulty = difficulty if difficulty in DIFFICULTY_LEVELS else "intermediate"
        selected_language = self._normalize_language(answer_language)

        build_result = self._build_episode_structure(
            transcript=cleaned_transcript,
            analysis=analysis or {},
            title=title,
            voice_mode=selected_voice_mode,
            voice_persona=selected_persona,
            difficulty=selected_difficulty,
        )

        chapters = build_result.get("chapters", [])
        if not chapters:
            raise ValueError("Unable to generate podcast chapters from transcript")

        session_id = uuid.uuid4().hex
        session = PodcastSession(
            session_id=session_id,
            user_id=user_id,
            title=title or "Media Podcast",
            source_type=source_type or "media",
            voice_mode=selected_voice_mode,
            voice_persona=selected_persona,
            difficulty=selected_difficulty,
            answer_language=selected_language,
            transcript=cleaned_transcript,
            analysis=analysis or {},
            key_takeaways=build_result.get("key_takeaways", []),
            chapters=chapters,
            session_options=session_options or {},
        )

        self._sessions[session_id] = session
        first = self._jump_to_chapter(session, 0, mark_as_narration=True)
        self._persist_session(db, session)

        return {
            "session_id": session.session_id,
            "episode_title": build_result.get("episode_title") or session.title,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
            "voice_persona": session.voice_persona,
            "persona_profile": self._persona_profile_payload(session.voice_persona),
            "difficulty": session.difficulty,
            "answer_language": session.answer_language,
            "current_segment": first.get("content", ""),
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
            "key_takeaways": session.key_takeaways,
            "chapters": self._serialize_chapters(session.chapters),
            "bookmarks": self.list_bookmarks(db=db, session_id=session.session_id, user_id=user_id),
        }

    def get_next_segment(self, *, db: Session, session_id: str, user_id: int) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        if session.ended:
            return {
                "session_id": session.session_id,
                "current_segment": "Session ended. Resume or start a new podcast session.",
                "current_index": session.current_index,
                "total_segments": len(session.chapters),
                "has_more": False,
            }

        next_index = session.current_index + 1
        if next_index >= len(session.chapters):
            session.ended = True
            session.updated_at = datetime.now(timezone.utc)
            self._persist_session(db, session)
            return {
                "session_id": session.session_id,
                "current_segment": "That was the full podcast walkthrough. Ask me anything about this media.",
                "current_index": session.current_index,
                "total_segments": len(session.chapters),
                "has_more": False,
            }

        chapter = self._jump_to_chapter(session, next_index, mark_as_narration=True)
        self._persist_session(db, session)
        return {
            "session_id": session.session_id,
            "current_segment": chapter.get("content", ""),
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
            "chapter": chapter,
        }

    def jump_to_chapter(self, *, db: Session, session_id: str, user_id: int, chapter_index: int) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        chapter = self._jump_to_chapter(session, chapter_index, mark_as_narration=True)
        self._persist_session(db, session)
        return {
            "session_id": session.session_id,
            "current_segment": chapter.get("content", ""),
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
            "chapter": chapter,
        }

    def ask_question(
        self,
        *,
        db: Session,
        session_id: str,
        user_id: int,
        question: str,
        voice_mode: Optional[str] = None,
        voice_persona: Optional[str] = None,
        difficulty: Optional[str] = None,
        question_language: Optional[str] = None,
        answer_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)

        cleaned_question = self._clean_text(question)
        if len(cleaned_question) < 2:
            raise ValueError("Question is empty")

        if voice_mode and voice_mode in VOICE_MODE_PROFILES:
            session.voice_mode = voice_mode
        if voice_persona and voice_persona in VOICE_PERSONAS:
            session.voice_persona = voice_persona
        if difficulty and difficulty in DIFFICULTY_LEVELS:
            session.difficulty = difficulty
        if answer_language:
            session.answer_language = self._normalize_language(answer_language)

        if self._looks_like_mcq_request(cleaned_question):
            drill = self.start_mcq_drill(db=db, session_id=session_id, user_id=user_id, count=5)
            return {
                "session_id": session.session_id,
                "voice_mode": session.voice_mode,
                "voice_profile": self._voice_profile_payload(session.voice_mode),
                "voice_persona": session.voice_persona,
                "persona_profile": self._persona_profile_payload(session.voice_persona),
                "answer": "Sure. I started a 5-question MCQ drill for this podcast session.",
                "follow_up_suggestions": ["Answer question 1", "Change difficulty", "Switch to explanation mode"],
                "mcq_drill": drill,
            }

        history = self._format_recent_history(session.conversation)
        chapter_context = self._current_chapter_context(session)
        transcript_excerpt = self._trim_for_context(session.transcript, 8000)
        concept_list = ", ".join((session.analysis or {}).get("key_concepts", [])[:12])

        output_language = self._normalize_language(answer_language or session.answer_language)
        language_label = self._language_label(output_language)
        q_lang = self._language_label(self._normalize_language(question_language or output_language))

        prompt = f"""You are an interactive podcast tutor.

Voice mode style instruction: {VOICE_MODE_PROFILES[session.voice_mode]['ai_style']}
Voice persona instruction: {VOICE_PERSONAS[session.voice_persona]['prompt_style']}
Difficulty instruction: {DIFFICULTY_LEVELS[session.difficulty]['instruction']}

Source title: {session.title}
Source type: {session.source_type}
Key concepts: {concept_list or 'Not available'}
Current chapter context: {chapter_context}

Transcript excerpt:
{transcript_excerpt}

Recent conversation:
{history}

Student question (asked in {q_lang}):
{cleaned_question}

Instructions:
- Answer using transcript-grounded content only.
- Keep answer conversational and listenable (80-180 words).
- Output answer in {language_label}.
- End with one short check-for-understanding question.
- Do not use markdown.
"""

        ai_answer = call_ai(prompt, max_tokens=650, temperature=0.55)
        clean_answer = self._clean_text(ai_answer)

        suggestions = self._generate_follow_up_suggestions(
            question=cleaned_question,
            answer=clean_answer,
            key_concepts=(session.analysis or {}).get("key_concepts", []),
            language=output_language,
        )

        session.conversation.append(
            {
                "role": "user",
                "type": "question",
                "content": cleaned_question,
                "question_language": self._normalize_language(question_language or output_language),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        session.conversation.append(
            {
                "role": "assistant",
                "type": "answer",
                "content": clean_answer,
                "answer_language": output_language,
                "follow_up_suggestions": suggestions,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)

        return {
            "session_id": session.session_id,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
            "voice_persona": session.voice_persona,
            "persona_profile": self._persona_profile_payload(session.voice_persona),
            "difficulty": session.difficulty,
            "answer_language": output_language,
            "answer": clean_answer,
            "follow_up_suggestions": suggestions,
        }

    def set_voice_mode(self, *, db: Session, session_id: str, user_id: int, voice_mode: str) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        if voice_mode not in VOICE_MODE_PROFILES:
            raise ValueError(f"Unsupported voice mode: {voice_mode}")
        session.voice_mode = voice_mode
        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)
        return {
            "session_id": session.session_id,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
        }

    def update_settings(
        self,
        *,
        db: Session,
        session_id: str,
        user_id: int,
        difficulty: Optional[str] = None,
        answer_language: Optional[str] = None,
        voice_persona: Optional[str] = None,
        voice_mode: Optional[str] = None,
        session_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)

        if difficulty and difficulty in DIFFICULTY_LEVELS:
            session.difficulty = difficulty
        if answer_language:
            session.answer_language = self._normalize_language(answer_language)
        if voice_persona and voice_persona in VOICE_PERSONAS:
            session.voice_persona = voice_persona
        if voice_mode and voice_mode in VOICE_MODE_PROFILES:
            session.voice_mode = voice_mode
        if session_options:
            merged = dict(session.session_options or {})
            merged.update(session_options)
            session.session_options = merged

        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)

        return {
            "session_id": session.session_id,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
            "voice_persona": session.voice_persona,
            "persona_profile": self._persona_profile_payload(session.voice_persona),
            "difficulty": session.difficulty,
            "answer_language": session.answer_language,
            "session_options": session.session_options,
        }

    def add_bookmark(
        self,
        *,
        db: Session,
        session_id: str,
        user_id: int,
        label: Optional[str] = None,
        chapter_index: Optional[int] = None,
        timestamp_seconds: Optional[int] = None,
    ) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)

        index = chapter_index if chapter_index is not None else max(session.current_index, 0)
        if index < 0 or index >= len(session.chapters):
            raise ValueError("Invalid chapter index for bookmark")

        chapter = session.chapters[index]
        ts = timestamp_seconds if timestamp_seconds is not None else int(chapter.get("start_second", 0))
        excerpt = self._clean_text(chapter.get("content", ""))[:240]
        bookmark_label = self._clean_text(label) or f"Chapter {index + 1}: {chapter.get('title', 'Moment')}"

        record = models.PodcastBookmark(
            session_id=session.session_id,
            user_id=user_id,
            chapter_index=index,
            timestamp_seconds=max(0, int(ts)),
            label=bookmark_label[:255],
            excerpt=excerpt,
            created_at=datetime.now(timezone.utc),
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        return self._bookmark_payload(record)

    def list_bookmarks(self, *, db: Session, session_id: str, user_id: int) -> List[Dict[str, Any]]:
        records = (
            db.query(models.PodcastBookmark)
            .filter(models.PodcastBookmark.session_id == session_id, models.PodcastBookmark.user_id == user_id)
            .order_by(models.PodcastBookmark.created_at.asc())
            .all()
        )
        return [self._bookmark_payload(record) for record in records]

    def replay_bookmark(
        self,
        *,
        db: Session,
        session_id: str,
        user_id: int,
        bookmark_id: int,
    ) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        bookmark = (
            db.query(models.PodcastBookmark)
            .filter(
                models.PodcastBookmark.id == bookmark_id,
                models.PodcastBookmark.user_id == user_id,
                models.PodcastBookmark.session_id == session_id,
            )
            .first()
        )
        if not bookmark:
            raise ValueError("Bookmark not found")

        chapter = self._jump_to_chapter(session, bookmark.chapter_index, mark_as_narration=True)
        self._persist_session(db, session)

        return {
            "session_id": session.session_id,
            "bookmark": self._bookmark_payload(bookmark),
            "chapter": chapter,
            "current_segment": chapter.get("content", ""),
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
        }

    def start_mcq_drill(self, *, db: Session, session_id: str, user_id: int, count: int = 5) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        n = max(1, min(10, int(count)))

        chapter_context = self._current_chapter_context(session)
        transcript_excerpt = self._trim_for_context(session.transcript, 6000)

        prompt = f"""Create {n} multiple-choice questions from this podcast learning material.

Difficulty: {session.difficulty}
Current chapter: {chapter_context}
Transcript excerpt:
{transcript_excerpt}

Output strict JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "..."
    }}
  ]
}}

Rules:
- Exactly 4 options.
- correct_index must be 0-3.
- Questions must be grounded in transcript content.
"""

        raw = call_ai(prompt, max_tokens=1200, temperature=0.45)
        parsed = self._parse_json(raw) or {}
        questions = self._normalize_mcq_questions(parsed.get("questions", []), target=n)
        if not questions:
            questions = self._fallback_mcq_questions(session, n)

        session.mcq_state = {
            "active": True,
            "questions": questions,
            "current_index": 0,
            "score": 0,
            "answers": [],
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)

        return {
            "active": True,
            "total": len(questions),
            "current_index": 0,
            "question": self._public_mcq_question(questions[0], 0),
        }

    def answer_mcq(
        self,
        *,
        db: Session,
        session_id: str,
        user_id: int,
        question_index: int,
        selected_index: int,
    ) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        state = session.mcq_state or {}

        if not state.get("active"):
            raise ValueError("No active MCQ drill")

        questions = state.get("questions") or []
        if question_index < 0 or question_index >= len(questions):
            raise ValueError("Invalid MCQ question index")

        question = questions[question_index]
        correct_index = int(question.get("correct_index", 0))
        is_correct = selected_index == correct_index

        answers = state.get("answers") or []
        answers.append(
            {
                "question_index": question_index,
                "selected_index": selected_index,
                "correct_index": correct_index,
                "is_correct": is_correct,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )

        score = int(state.get("score", 0)) + (1 if is_correct else 0)
        next_index = question_index + 1
        completed = next_index >= len(questions)

        session.mcq_state = {
            **state,
            "answers": answers,
            "score": score,
            "current_index": min(next_index, len(questions) - 1) if questions else 0,
            "active": not completed,
            "completed_at": datetime.now(timezone.utc).isoformat() if completed else None,
        }
        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)

        payload = {
            "is_correct": is_correct,
            "correct_index": correct_index,
            "explanation": self._clean_text(question.get("explanation", "")),
            "score": score,
            "total": len(questions),
            "completed": completed,
        }

        if completed:
            payload["summary"] = f"Drill complete. Score: {score}/{len(questions)}"
        else:
            payload["next_question"] = self._public_mcq_question(questions[next_index], next_index)
        return payload

    def export_session(self, *, db: Session, session_id: str, user_id: int, format_type: str = "markdown") -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        bookmarks = self.list_bookmarks(db=db, session_id=session_id, user_id=user_id)

        export_data = {
            "session_id": session.session_id,
            "title": session.title,
            "voice_mode": session.voice_mode,
            "voice_persona": session.voice_persona,
            "difficulty": session.difficulty,
            "answer_language": session.answer_language,
            "key_takeaways": session.key_takeaways,
            "chapters": self._serialize_chapters(session.chapters),
            "bookmarks": bookmarks,
            "conversation": session.conversation,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }

        fmt = (format_type or "markdown").lower()
        if fmt == "json":
            return {
                "format": "json",
                "filename": f"podcast-session-{session.session_id[:8]}.json",
                "content": json.dumps(export_data, ensure_ascii=False, indent=2),
            }

        lines: List[str] = []
        lines.append(f"# {session.title}")
        lines.append("")
        lines.append(f"- Session ID: {session.session_id}")
        lines.append(f"- Voice Mode: {session.voice_mode}")
        lines.append(f"- Voice Persona: {session.voice_persona}")
        lines.append(f"- Difficulty: {session.difficulty}")
        lines.append(f"- Answer Language: {session.answer_language}")
        lines.append("")

        lines.append("## Key Takeaways")
        for takeaway in session.key_takeaways:
            lines.append(f"- {takeaway}")
        lines.append("")

        lines.append("## Chapters")
        for chapter in session.chapters:
            lines.append(f"### {chapter.get('index', 0) + 1}. {chapter.get('title', 'Chapter')}")
            lines.append(f"- Time: {self._format_time(int(chapter.get('start_second', 0)))}")
            lines.append(f"- Summary: {chapter.get('content', '')}")
            lines.append("")

        lines.append("## Bookmarks")
        if bookmarks:
            for bm in bookmarks:
                lines.append(f"- [{self._format_time(int(bm.get('timestamp_seconds', 0)))}] {bm.get('label', 'Bookmark')}")
        else:
            lines.append("- None")
        lines.append("")

        lines.append("## Q&A Transcript")
        for entry in session.conversation:
            role = entry.get("role", "assistant")
            content = self._clean_text(entry.get("content", ""))
            if not content:
                continue
            lines.append(f"- **{role.title()}**: {content}")

        return {
            "format": "markdown",
            "filename": f"podcast-session-{session.session_id[:8]}.md",
            "content": "\n".join(lines),
        }

    def list_user_sessions(self, *, db: Session, user_id: int, limit: int = 20) -> List[Dict[str, Any]]:
        records = (
            db.query(models.PodcastSessionMemory)
            .filter(models.PodcastSessionMemory.user_id == user_id)
            .order_by(models.PodcastSessionMemory.updated_at.desc())
            .limit(max(1, min(100, limit)))
            .all()
        )
        payload: List[Dict[str, Any]] = []
        for record in records:
            payload.append(
                {
                    "session_id": record.session_id,
                    "title": record.title,
                    "voice_mode": record.voice_mode,
                    "voice_persona": record.voice_persona,
                    "difficulty": record.difficulty,
                    "answer_language": record.answer_language,
                    "current_index": record.current_index,
                    "updated_at": record.updated_at.isoformat() if record.updated_at else None,
                    "is_ended": bool(record.is_ended),
                }
            )
        return payload

    def resume_session(self, *, db: Session, session_id: str, user_id: int) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        bookmarks = self.list_bookmarks(db=db, session_id=session_id, user_id=user_id)

        current_chapter = None
        if 0 <= session.current_index < len(session.chapters):
            current_chapter = self._chapter_payload(session.chapters[session.current_index])

        self._persist_session(db, session)
        return {
            "session_id": session.session_id,
            "episode_title": session.title,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
            "voice_persona": session.voice_persona,
            "persona_profile": self._persona_profile_payload(session.voice_persona),
            "difficulty": session.difficulty,
            "answer_language": session.answer_language,
            "current_segment": (current_chapter or {}).get("content", ""),
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
            "key_takeaways": session.key_takeaways,
            "chapters": self._serialize_chapters(session.chapters),
            "bookmarks": bookmarks,
            "mcq_state": self._public_mcq_state(session.mcq_state),
            "session_options": session.session_options,
            "ended": session.ended,
        }

    def stop_session(self, *, db: Session, session_id: str, user_id: int) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        session.ended = True
        session.updated_at = datetime.now(timezone.utc)
        self._persist_session(db, session)
        return {
            "session_id": session.session_id,
            "stopped": True,
            "message": "Podcast session stopped",
        }

    def get_state(self, *, db: Session, session_id: str, user_id: int) -> Dict[str, Any]:
        session = self._get_session(db=db, session_id=session_id, user_id=user_id)
        bookmarks = self.list_bookmarks(db=db, session_id=session_id, user_id=user_id)
        current_chapter = None
        if 0 <= session.current_index < len(session.chapters):
            current_chapter = self._chapter_payload(session.chapters[session.current_index])

        return {
            "session_id": session.session_id,
            "title": session.title,
            "source_type": session.source_type,
            "voice_mode": session.voice_mode,
            "voice_profile": self._voice_profile_payload(session.voice_mode),
            "voice_persona": session.voice_persona,
            "persona_profile": self._persona_profile_payload(session.voice_persona),
            "difficulty": session.difficulty,
            "answer_language": session.answer_language,
            "current_index": session.current_index,
            "total_segments": len(session.chapters),
            "has_more": session.current_index + 1 < len(session.chapters),
            "current_chapter": current_chapter,
            "chapters": self._serialize_chapters(session.chapters),
            "key_takeaways": session.key_takeaways,
            "bookmarks": bookmarks,
            "mcq_state": self._public_mcq_state(session.mcq_state),
            "session_options": session.session_options,
            "ended": session.ended,
        }

    def _voice_profile_payload(self, voice_mode: str) -> Dict[str, Any]:
        profile = VOICE_MODE_PROFILES.get(voice_mode, VOICE_MODE_PROFILES["coach"])
        return {
            "id": voice_mode,
            "label": profile["label"],
            "description": profile["description"],
            "speech_rate": profile["speech_rate"],
            "speech_pitch": profile["speech_pitch"],
        }

    def _persona_profile_payload(self, persona_id: str) -> Dict[str, Any]:
        profile = VOICE_PERSONAS.get(persona_id, VOICE_PERSONAS["mentor"])
        return {
            "id": persona_id,
            "label": profile["label"],
            "description": profile["description"],
            "speech_rate": profile["speech_rate"],
            "speech_pitch": profile["speech_pitch"],
        }

    def _build_episode_structure(
        self,
        *,
        transcript: str,
        analysis: Dict[str, Any],
        title: str,
        voice_mode: str,
        voice_persona: str,
        difficulty: str,
    ) -> Dict[str, Any]:
        concept_list = ", ".join(analysis.get("key_concepts", [])[:12])
        topic_list = ", ".join(analysis.get("topics", [])[:8])
        summary = self._clean_text(analysis.get("summary", ""))
        transcript_excerpt = self._trim_for_context(transcript, 12000)

        prompt = f"""Create a podcast episode structure from learning material.

Voice mode: {VOICE_MODE_PROFILES[voice_mode]['ai_style']}
Voice persona: {VOICE_PERSONAS[voice_persona]['prompt_style']}
Difficulty: {DIFFICULTY_LEVELS[difficulty]['instruction']}
Source title: {title or 'Media Notes'}
Detected concepts: {concept_list or 'Not provided'}
Detected topics: {topic_list or 'Not provided'}
Summary: {summary or 'Not provided'}

Transcript excerpt:
{transcript_excerpt}

Output strict JSON only:
{{
  "episode_title": "short title",
  "key_takeaways": ["takeaway 1", "takeaway 2", "takeaway 3"],
  "chapters": [
    {{"title": "Chapter title", "content": "80-180 word narration"}}
  ]
}}

Rules:
- 5 to 8 chapters.
- Each chapter must be grounded in transcript content.
- Keep content listenable and coherent.
- No markdown, no code fences.
"""

        raw = call_ai(prompt, max_tokens=2600, temperature=0.58)
        parsed = self._parse_json(raw) or {}

        chapters = self._normalize_chapters(parsed)
        if not chapters:
            logger.warning("Podcast chapter parse fallback triggered")
            chapters = self._fallback_chapters(summary=summary, concepts=analysis.get("key_concepts", []), transcript=transcript_excerpt)

        chapters = self._apply_chapter_timestamps(chapters)

        return {
            "episode_title": self._clean_text(parsed.get("episode_title") or title or "Podcast Session"),
            "key_takeaways": self._normalize_short_list(parsed.get("key_takeaways", [])),
            "chapters": chapters,
        }

    def _normalize_chapters(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        chapters_raw = parsed.get("chapters")
        if isinstance(chapters_raw, list) and chapters_raw:
            normalized: List[Dict[str, Any]] = []
            for item in chapters_raw[:10]:
                title = self._clean_text((item or {}).get("title", ""))
                content = self._clean_text((item or {}).get("content", ""))
                if len(content) < 20:
                    continue
                if not title:
                    title = f"Chapter {len(normalized) + 1}"
                words = content.split()
                if len(words) > 220:
                    content = " ".join(words[:220])
                normalized.append({"title": title, "content": content})
            return normalized[:8]

        segments = parsed.get("segments") if isinstance(parsed, dict) else []
        if isinstance(segments, list) and segments:
            normalized = []
            for idx, segment in enumerate(segments[:8]):
                content = self._clean_text(segment)
                if len(content) < 20:
                    continue
                normalized.append({"title": f"Chapter {idx + 1}", "content": content})
            return normalized

        return []

    def _fallback_chapters(self, *, summary: str, concepts: List[str], transcript: str) -> List[Dict[str, Any]]:
        clean_summary = self._clean_text(summary)
        concept_text = ", ".join(concepts[:8]) if concepts else "core ideas"
        words = transcript.split()

        blocks: List[str] = []
        if words:
            chunk_size = max(120, len(words) // 5)
            for i in range(0, len(words), chunk_size):
                blocks.append(" ".join(words[i:i + 140]))
                if len(blocks) >= 6:
                    break

        chapters: List[Dict[str, Any]] = []
        chapters.append({
            "title": "Big Picture",
            "content": f"Welcome. In this session we focus on {concept_text}. {clean_summary or (blocks[0] if blocks else '')}",
        })
        for idx, block in enumerate(blocks[:5]):
            chapters.append({"title": f"Core Topic {idx + 1}", "content": block})

        return chapters[:8]

    def _apply_chapter_timestamps(self, chapters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        timed: List[Dict[str, Any]] = []
        start = 0
        for idx, chapter in enumerate(chapters):
            content = self._clean_text(chapter.get("content", ""))
            words = len(content.split())
            duration = max(45, min(240, int(words * 0.46) if words > 0 else 90))
            entry = {
                "index": idx,
                "title": self._clean_text(chapter.get("title", "Chapter")) or f"Chapter {idx + 1}",
                "content": content,
                "start_second": start,
                "end_second": start + duration,
                "duration_seconds": duration,
            }
            timed.append(entry)
            start += duration
        return timed

    def _current_chapter_context(self, session: PodcastSession) -> str:
        if 0 <= session.current_index < len(session.chapters):
            chapter = session.chapters[session.current_index]
            return f"{chapter.get('title', 'Chapter')}: {self._clean_text(chapter.get('content', ''))[:300]}"
        return "No active chapter"

    def _jump_to_chapter(self, session: PodcastSession, chapter_index: int, mark_as_narration: bool = False) -> Dict[str, Any]:
        if chapter_index < 0 or chapter_index >= len(session.chapters):
            raise ValueError("Invalid chapter index")

        session.current_index = chapter_index
        chapter = session.chapters[chapter_index]
        payload = self._chapter_payload(chapter)

        if mark_as_narration:
            session.conversation.append(
                {
                    "role": "assistant",
                    "type": "narration",
                    "chapter_index": chapter_index,
                    "content": payload.get("content", ""),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        session.updated_at = datetime.now(timezone.utc)
        return payload

    def _chapter_payload(self, chapter: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "index": int(chapter.get("index", 0)),
            "title": self._clean_text(chapter.get("title", "Chapter")),
            "content": self._clean_text(chapter.get("content", "")),
            "start_second": int(chapter.get("start_second", 0)),
            "end_second": int(chapter.get("end_second", 0)),
            "duration_seconds": int(chapter.get("duration_seconds", 0)),
        }

    def _serialize_chapters(self, chapters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [self._chapter_payload(chapter) for chapter in chapters]

    def _format_recent_history(self, conversation: List[Dict[str, Any]]) -> str:
        if not conversation:
            return "No prior conversation"
        clipped = conversation[-10:]
        parts = []
        for entry in clipped:
            role = entry.get("role", "assistant")
            content = self._clean_text(entry.get("content", ""))
            if content:
                parts.append(f"{role}: {content[:260]}")
        return "\n".join(parts) if parts else "No prior conversation"

    def _generate_follow_up_suggestions(
        self,
        *,
        question: str,
        answer: str,
        key_concepts: List[str],
        language: str,
    ) -> List[str]:
        concept_text = ", ".join(key_concepts[:8])
        lang_label = self._language_label(language)

        prompt = f"""Generate 3 short follow-up student questions in {lang_label}.

Original question: {question}
Answer summary: {answer[:500]}
Key concepts: {concept_text}

Return strict JSON:
{{"suggestions": ["...", "...", "..."]}}
"""
        raw = call_ai(prompt, max_tokens=220, temperature=0.45)
        parsed = self._parse_json(raw) or {}
        suggestions = self._normalize_short_list(parsed.get("suggestions", []))
        if suggestions:
            return suggestions[:3]

        fallback = [
            "Can you explain that with one example?",
            "What is the most important point to remember?",
            "Can we do a quick practice question on this?",
        ]
        if language != "en":
            return fallback[:3]
        return fallback[:3]

    def _looks_like_mcq_request(self, question: str) -> bool:
        q = question.lower()
        return ("mcq" in q) or ("quiz" in q and "question" in q)

    def _normalize_mcq_questions(self, questions: List[Any], target: int) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in questions[:target]:
            q_text = self._clean_text((item or {}).get("question", ""))
            options = [self._clean_text(opt) for opt in ((item or {}).get("options") or []) if self._clean_text(opt)]
            correct_index = int((item or {}).get("correct_index", 0)) if str((item or {}).get("correct_index", "")).isdigit() else 0
            explanation = self._clean_text((item or {}).get("explanation", ""))
            if not q_text or len(options) < 4:
                continue
            options = options[:4]
            if correct_index < 0 or correct_index >= len(options):
                correct_index = 0
            normalized.append(
                {
                    "question": q_text,
                    "options": options,
                    "correct_index": correct_index,
                    "explanation": explanation,
                }
            )
        return normalized

    def _fallback_mcq_questions(self, session: PodcastSession, count: int) -> List[Dict[str, Any]]:
        concepts = (session.analysis or {}).get("key_concepts", [])
        topics = concepts if concepts else [chapter.get("title", "Topic") for chapter in session.chapters]
        out: List[Dict[str, Any]] = []

        for idx in range(min(count, len(topics))):
            concept = self._clean_text(topics[idx]) or f"Topic {idx + 1}"
            out.append(
                {
                    "question": f"Which statement best matches {concept}?",
                    "options": [
                        f"A core idea about {concept}",
                        f"An unrelated fact not covered for {concept}",
                        f"A contradiction of {concept}",
                        f"A random distractor for {concept}",
                    ],
                    "correct_index": 0,
                    "explanation": f"The first option aligns with transcript-grounded coverage of {concept}.",
                }
            )

        while len(out) < count:
            k = len(out) + 1
            out.append(
                {
                    "question": f"Practice question {k}: which option is most accurate based on this session?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_index": 0,
                    "explanation": "Option A is the closest transcript-grounded answer in fallback mode.",
                }
            )
        return out

    def _public_mcq_question(self, question: Dict[str, Any], index: int) -> Dict[str, Any]:
        return {
            "index": index,
            "question": self._clean_text(question.get("question", "")),
            "options": [self._clean_text(opt) for opt in (question.get("options") or [])[:4]],
        }

    def _public_mcq_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        if not state:
            return {"active": False}
        out = {
            "active": bool(state.get("active")),
            "current_index": int(state.get("current_index", 0)),
            "score": int(state.get("score", 0)),
            "total": len(state.get("questions") or []),
            "answers": state.get("answers") or [],
        }
        questions = state.get("questions") or []
        if questions and 0 <= out["current_index"] < len(questions):
            out["question"] = self._public_mcq_question(questions[out["current_index"]], out["current_index"])
        return out

    def _bookmark_payload(self, record: models.PodcastBookmark) -> Dict[str, Any]:
        return {
            "id": record.id,
            "session_id": record.session_id,
            "chapter_index": int(record.chapter_index or 0),
            "timestamp_seconds": int(record.timestamp_seconds or 0),
            "label": record.label or "Bookmarked moment",
            "excerpt": record.excerpt or "",
            "created_at": record.created_at.isoformat() if record.created_at else None,
            "timestamp_label": self._format_time(int(record.timestamp_seconds or 0)),
        }

    def _persist_session(self, db: Session, session: PodcastSession):
        record = (
            db.query(models.PodcastSessionMemory)
            .filter(models.PodcastSessionMemory.session_id == session.session_id, models.PodcastSessionMemory.user_id == session.user_id)
            .first()
        )
        if not record:
            record = models.PodcastSessionMemory(
                session_id=session.session_id,
                user_id=session.user_id,
                created_at=datetime.now(timezone.utc),
            )
            db.add(record)

        record.title = session.title
        record.source_type = session.source_type
        record.voice_mode = session.voice_mode
        record.voice_persona = session.voice_persona
        record.difficulty = session.difficulty
        record.answer_language = session.answer_language
        record.transcript = session.transcript
        record.analysis = json.dumps(session.analysis or {}, ensure_ascii=False)
        record.key_takeaways = json.dumps(session.key_takeaways or [], ensure_ascii=False)
        record.chapters = json.dumps(session.chapters or [], ensure_ascii=False)
        record.conversation = json.dumps(session.conversation or [], ensure_ascii=False)
        record.mcq_state = json.dumps(session.mcq_state or {}, ensure_ascii=False)
        record.session_options = json.dumps(session.session_options or {}, ensure_ascii=False)
        record.current_index = session.current_index
        record.is_active = not session.ended
        record.is_ended = session.ended
        record.last_accessed_at = datetime.now(timezone.utc)
        record.updated_at = datetime.now(timezone.utc)

        db.commit()

    def _hydrate_session(self, record: models.PodcastSessionMemory) -> PodcastSession:
        session = PodcastSession(
            session_id=record.session_id,
            user_id=record.user_id,
            title=record.title or "Media Podcast",
            source_type=record.source_type or "media",
            voice_mode=record.voice_mode or "coach",
            voice_persona=record.voice_persona or "mentor",
            difficulty=record.difficulty or "intermediate",
            answer_language=self._normalize_language(record.answer_language or "en"),
            transcript=record.transcript or "",
            analysis=_safe_json_loads(record.analysis, {}),
            key_takeaways=_safe_json_loads(record.key_takeaways, []),
            chapters=_safe_json_loads(record.chapters, []),
            current_index=int(record.current_index or -1),
            conversation=_safe_json_loads(record.conversation, []),
            mcq_state=_safe_json_loads(record.mcq_state, {}),
            session_options=_safe_json_loads(record.session_options, {}),
            started_at=record.created_at or datetime.now(timezone.utc),
            updated_at=record.updated_at or datetime.now(timezone.utc),
            ended=bool(record.is_ended),
        )
        return session

    def _load_session_from_db(self, *, db: Session, session_id: str, user_id: int) -> Optional[PodcastSession]:
        record = (
            db.query(models.PodcastSessionMemory)
            .filter(models.PodcastSessionMemory.session_id == session_id, models.PodcastSessionMemory.user_id == user_id)
            .first()
        )
        if not record:
            return None
        return self._hydrate_session(record)

    def _get_session(self, *, db: Session, session_id: str, user_id: int) -> PodcastSession:
        self._cleanup_expired_sessions()
        session = self._sessions.get(session_id)
        if not session:
            session = self._load_session_from_db(db=db, session_id=session_id, user_id=user_id)
            if session:
                self._sessions[session_id] = session

        if not session:
            raise ValueError("Podcast session not found")
        if session.user_id != user_id:
            raise ValueError("Access denied for this podcast session")
        return session

    def _cleanup_expired_sessions(self):
        now = datetime.now(timezone.utc)
        stale: List[str] = []
        for sid, session in self._sessions.items():
            if now - session.updated_at > self._session_ttl:
                stale.append(sid)
        for sid in stale:
            self._sessions.pop(sid, None)

    def _parse_json(self, text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None

        candidate = text.strip()
        candidate = re.sub(r"^```(?:json)?", "", candidate, flags=re.IGNORECASE).strip()
        candidate = re.sub(r"```$", "", candidate).strip()

        try:
            data = json.loads(candidate)
            return data if isinstance(data, dict) else None
        except Exception:
            pass

        match = re.search(r"\{[\s\S]*\}", candidate)
        if not match:
            return None

        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _normalize_short_list(self, values: List[Any]) -> List[str]:
        normalized: List[str] = []
        for item in (values or [])[:8]:
            text = self._clean_text(item)
            if text:
                normalized.append(text)
        return normalized

    def _normalize_language(self, code: str) -> str:
        normalized = self._clean_text(code).lower()
        if not normalized:
            return "en"
        valid_codes = {item["code"] for item in SUPPORTED_LANGUAGES}
        return normalized if normalized in valid_codes else "en"

    def _language_label(self, code: str) -> str:
        normalized = self._normalize_language(code)
        for item in SUPPORTED_LANGUAGES:
            if item["code"] == normalized:
                return item["label"]
        return "English"

    def _format_time(self, seconds: int) -> str:
        m, s = divmod(max(0, int(seconds)), 60)
        h, m = divmod(m, 60)
        if h > 0:
            return f"{h}:{m:02d}:{s:02d}"
        return f"{m}:{s:02d}"

    def _trim_for_context(self, text: str, limit: int) -> str:
        return text[:limit]

    def _clean_text(self, value: Any) -> str:
        if value is None:
            return ""
        text = str(value)
        text = text.replace("\r", " ").replace("\n", " ")
        text = re.sub(r"\s+", " ", text).strip()
        return text


podcast_agent_service = PodcastAgentService()
