from __future__ import annotations

from tutor.state import TutorState, StudentState, Neo4jInsights


def build_tutor_prompt(state: TutorState) -> str:
    student = state.get("student_state")
    insights = state.get("neo4j_insights")
    memories = state.get("episodic_memories", [])
    chat_history = state.get("chat_history", [])
    task = state.get("instructional_task", "")
    user_input = state.get("user_input", "")

    sections = []

    sections.append(_student_section(student))

    if chat_history:
        sections.append(_chat_history_section(chat_history))

    sections.append(_concept_section(insights))

    if memories:
        sections.append(_memory_section(memories))

    sections.append(_task_section(task, user_input))

    return "\n\n".join(sections)


def _student_section(s: StudentState | None) -> str:
    if not s:
        return "[STUDENT STATE]\nNo profile available."
    lines = ["[STUDENT STATE]"]
    if s.first_name:
        lines.append(f"- Name: {s.first_name}")
    if s.strengths:
        lines.append(f"- Strengths: {', '.join(s.strengths)}")
    if s.weaknesses:
        lines.append(f"- Weaknesses: {', '.join(s.weaknesses)}")
    lines.append(f"- Preferred style: {s.preferred_style}")
    lines.append(f"- Difficulty level: {s.difficulty_level}")
    if s.current_subject:
        lines.append(f"- Current subject: {s.current_subject}")
    return "\n".join(lines)


def _chat_history_section(history: list[dict]) -> str:
    lines = ["[CONVERSATION HISTORY (recent messages)]"]
    for msg in history[-6:]:  # last 6 exchanges max
        lines.append(f"Student: {msg.get('user', '')}")
        ai_resp = msg.get("ai", "")
        # Truncate long AI responses in context
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


def _memory_section(memories: list[str]) -> str:
    lines = ["[RELEVANT HISTORY]"]
    for m in memories:
        lines.append(f"- {m}")
    return "\n".join(lines)


def _task_section(task: str, user_input: str) -> str:
    lines = ["[TASK]"]
    if task:
        lines.append(task)
    lines.append(f"\nStudent's question: {user_input}")
    return "\n".join(lines)
