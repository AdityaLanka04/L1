from __future__ import annotations

import logging

from tutor.state import TutorState, StudentState, Neo4jInsights
from dkt.style_bandit import STYLE_INSTRUCTIONS

logger = logging.getLogger(__name__)

def build_tutor_prompt(state: TutorState) -> str:
    student            = state.get("student_state")
    insights           = state.get("neo4j_insights")
    memories           = state.get("episodic_memories", [])
    structured_context = state.get("structured_context", [])
    chat_history       = state.get("chat_history", [])
    task               = state.get("instructional_task", "")
    user_input         = state.get("user_input", "")
    rag_context        = state.get("rag_context", [])
    analysis           = state.get("language_analysis") or {}
    selected_style     = state.get("selected_style", "")
    intent             = state.get("intent", "")

    is_greeting = intent in ("greeting", "returning_greeting")

    sections = []
    sections.append(_student_section(student, intent=intent))

    # Preferences always shown — survive greetings
    pref_memories = [m for m in memories if m.startswith("[STUDENT PREFERENCE]")]
    other_memories = [m for m in memories if not m.startswith("[STUDENT PREFERENCE]")]
    if pref_memories:
        sections.insert(1, _preferences_section(pref_memories))

    # Everything below is suppressed for greetings — prevents topic seeding
    if not is_greeting:
        if chat_history:
            sections.append(_chat_history_section(chat_history))
        sections.append(_concept_section(insights))
        if structured_context:
            sections.append(_structured_context_section(structured_context))
        if other_memories:
            sections.append(_memory_section(other_memories))
        if rag_context:
            logger.info(f"[TUTOR PROMPT] *** INJECTING {len(rag_context)} RAG chunk(s) ***")
            sections.append(_rag_section(rag_context))
        else:
            logger.info("[TUTOR PROMPT] No RAG context — model knowledge only")
        if analysis:
            conf_section = _confidence_section(analysis)
            if conf_section:
                sections.append(conf_section)
        if selected_style:
            sections.append(_style_section(selected_style))

    sections.append(_task_section(task, user_input))

    return "\n\n".join(sections)

def _student_section(s: StudentState | None, intent: str = "") -> str:
    if not s:
        return "[STUDENT STATE]\nNo profile available."
    lines = ["[STUDENT STATE]"]
    if s.first_name:
        lines.append(f"- Name: {s.first_name}")
    # Don't expose topic lists for greetings — LLM uses them to hallucinate suggestions
    if intent not in ("greeting", "returning_greeting"):
        if s.strengths:
            lines.append(f"- Strengths: {', '.join(s.strengths)}")
        if s.weaknesses:
            lines.append(f"- Weaknesses: {', '.join(s.weaknesses)}")
        if s.current_subject:
            lines.append(f"- Current subject: {s.current_subject}")
    lines.append(f"- Preferred style: {s.preferred_style}")
    lines.append(f"- Difficulty level: {s.difficulty_level}")
    return "\n".join(lines)

def _chat_history_section(history: list[dict]) -> str:
    lines = ["[CONVERSATION HISTORY (recent messages)]"]
    for msg in history[-6:]:
        lines.append(f"Student: {msg.get('user', '')}")
        ai_resp = msg.get("ai", "")
        if len(ai_resp) > 200:
            ai_resp = ai_resp[:200] + "..."
        lines.append(f"Cerbyl: {ai_resp}")
    lines.append("---")
    return "\n".join(lines)

def _concept_section(insights: Neo4jInsights | None) -> str:
    lines = ["[CONCEPT CONTEXT]"]
    if not insights or (
        not insights.prerequisites
        and not insights.common_mistakes
        and not insights.effective_strategies
    ):
        lines.append("No specific concept context available.")
        return "\n".join(lines)
    if insights.prerequisites:
        lines.append(f"- Prerequisites: {', '.join(insights.prerequisites)}")
    if insights.common_mistakes:
        lines.append("- Common mistakes to watch for:")
        for m in insights.common_mistakes:
            lines.append(f"  * {m}")
    if insights.effective_strategies:
        lines.append("- Strategies that worked before:")
        for s in insights.effective_strategies:
            lines.append(f"  * {s}")
    return "\n".join(lines)

def _structured_context_section(context_lines: list[str]) -> str:
    """Section containing real data from the database (flashcards, notes, activity)."""
    lines = ["[STRUCTURED LEARNING DATA (from database - use this for accurate answers)]"]
    lines.extend(context_lines)
    return "\n".join(lines)

def _memory_section(memories: list[str]) -> str:
    lines = ["[RELEVANT HISTORY (from episodic memory)]"]
    for m in memories:
        lines.append(f"- {m}")
    return "\n".join(lines)

def _rag_section(chunks: list[str]) -> str:
    """Section containing HS curriculum / personal document RAG context."""
    lines = ["[CURRICULUM CONTEXT (from student's uploaded documents and HS curriculum)]"]
    lines.append("Prioritise this material when relevant. Use it to give accurate, curriculum-aligned answers.")
    for i, chunk in enumerate(chunks[:5], 1):
        lines.append(f"\n--- Source {i} ---")
        lines.append(chunk)
    return "\n".join(lines)

def _confidence_section(analysis: dict) -> str:
    signal_type      = analysis.get("signal_type", "neutral")
    knowledge_signal = analysis.get("knowledge_signal", 0.0)
    concept          = analysis.get("primary_concept")
    markers          = analysis.get("matched_markers", [])

    if signal_type in ("neutral", "neutral_question") or not signal_type:
        return ""

    lines = ["[DETECTED CONFIDENCE STATE]"]

    signal_labels = {
        "confusion":  "CONFUSION (student does not understand)",
        "re_ask":     "RE-ASK (student needs a completely different explanation)",
        "doubt":      "CONFIRMATION SEEKING (student is checking their understanding)",
        "hesitation": "HESITATION (student is uncertain but trying)",
        "mastery":    "MASTERY SIGNAL (student indicates they understood)",
        "extension":  "CONCEPTUAL EXTENSION (student making connections — strong signal)",
    }
    label = signal_labels.get(signal_type, signal_type.upper())
    lines.append(f"- Signal: {label}")

    if concept:
        lines.append(f"- Concept in focus: {concept}")

    lines.append(f"- Knowledge signal: {knowledge_signal:+.2f} (−1 = forgot/lost, +1 = mastered)")

    if markers:
        lines.append(f"- Detected phrase: \"{markers[0]}\"")

    lines.append(
        "IMPORTANT: Let this signal shape your response structure. "
        "Do NOT ignore it. Do NOT narrate it — just act on it."
    )

    return "\n".join(lines)


def _preferences_section(pref_memories: list[str]) -> str:
    lines = ["[STUDENT PREFERENCES — MUST FOLLOW]"]
    lines.append("The student has explicitly stated these preferences. You MUST respect them in every response:")
    for p in pref_memories:
        clean = p.replace("[STUDENT PREFERENCE]", "").strip()
        lines.append(f"• {clean}")
    lines.append("Ignoring these preferences is a critical failure.")
    return "\n".join(lines)


def _style_section(style: str) -> str:
    instructions = STYLE_INSTRUCTIONS.get(style)
    if not instructions:
        return ""
    return f"[TEACHING FORMAT]\n{instructions}"


def _task_section(task: str, user_input: str) -> str:
    lines = ["[TASK]"]
    if task:
        lines.append(task)
    lines.append(f"\nStudent's question: {user_input}")
    return "\n".join(lines)
