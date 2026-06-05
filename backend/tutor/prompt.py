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
    context_only       = bool(state.get("context_only"))
    tutor_mode         = bool(state.get("tutor_mode"))

    is_greeting = intent in ("greeting", "returning_greeting")

    sections = []
    sections.append(_student_section(student, intent=intent, context_only=context_only))

    pref_memories = [m for m in memories if m.startswith("[STUDENT PREFERENCE]")]
    other_memories = [m for m in memories if not m.startswith("[STUDENT PREFERENCE]")]
    if pref_memories:
        sections.insert(1, _preferences_section(pref_memories))

    if not is_greeting:
        if context_only:
            sections.append(_context_only_section())
            if rag_context:
                logger.info(f"[TUTOR PROMPT] *** CONTEXT-ONLY: INJECTING {len(rag_context)} RAG chunk(s) ***")
                sections.append(_rag_section(rag_context))
            else:
                logger.info("[TUTOR PROMPT] CONTEXT-ONLY mode with no RAG chunks")
            if selected_style:
                sections.append(_style_section(selected_style))
        else:
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

    if tutor_mode and not is_greeting:
        sections.append(_tutor_mode_section(state))

    sections.append(_task_section(task, user_input, intent=intent))

    return "\n\n".join(sections)

def _student_section(s: StudentState | None, intent: str = "", context_only: bool = False) -> str:
    if not s:
        return "[STUDENT STATE]\nNo profile available."
    lines = ["[STUDENT STATE]"]
    if s.first_name:
        lines.append(f"- Name: {s.first_name}")
    if intent not in ("greeting", "returning_greeting") and not context_only:
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
    lines = ["[STRUCTURED LEARNING DATA (from database - use this for accurate answers)]"]
    lines.extend(context_lines)
    return "\n".join(lines)

def _memory_section(memories: list[str]) -> str:
    lines = ["[RELEVANT HISTORY (from episodic memory)]"]
    for m in memories:
        lines.append(f"- {m}")
    return "\n".join(lines)

def _rag_section(chunks: list[str]) -> str:
    lines = ["[CURRICULUM CONTEXT (from student's uploaded documents and HS curriculum)]"]
    lines.append("Prioritise this material when relevant. Use it to give accurate, curriculum-aligned answers.")
    for i, chunk in enumerate(chunks[:5], 1):
        lines.append(f"\n--- Source {i} ---")
        lines.append(chunk)
    return "\n".join(lines)

def _context_only_section() -> str:
    return (
        "[CONTEXT-ONLY GROUNDED ANSWERING]\n"
        "Use only the selected context chunks below. "
        "Do not rely on prior conversation, profile data, or general knowledge."
    )

def _confidence_section(analysis: dict) -> str:
    signal_type      = analysis.get("signal_type", "neutral")
    knowledge_signal = analysis.get("knowledge_signal", 0.0)
    concept          = analysis.get("primary_concept")
    markers          = analysis.get("matched_markers", [])
    sem_conf         = analysis.get("semantic_confidence", 0.0)

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

    if sem_conf >= 0.80:
        conf_tier = f"HIGH ({sem_conf:.0%}) — act on this strongly"
    elif sem_conf >= 0.50:
        conf_tier = f"MODERATE ({sem_conf:.0%}) — lean toward this signal"
    elif sem_conf > 0.0:
        conf_tier = f"WEAK ({sem_conf:.0%}) — treat as a soft hint"
    else:
        conf_tier = None

    if conf_tier:
        lines.append(f"- Classifier confidence: {conf_tier}")

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

def _tutor_mode_section(state: TutorState) -> str:
    reply_style = (state.get("tutor_reply_style") or "guided").strip().lower()
    tutor_choice = (state.get("tutor_choice") or "").strip()
    session_state = state.get("tutor_session_state") or {}
    attempt_evaluation = state.get("attempt_evaluation")

    style_lines = {
        "hint": [
            "- Give the smallest useful hint, not the solution.",
            "- Ask the student to do exactly one next move without doing it for them.",
        ],
        "guided": [
            "- Teach only the current idea needed for the next move.",
            "- Ask one short check question whose answer was not already shown.",
        ],
        "check": [
            "- Treat the student message as an attempted answer when plausible.",
            "- Start by judging correctness, then repair the most important gap.",
        ],
        "quiz": [
            "- Prefer a short practice question or MCQ before more explanation.",
            "- If an MCQ is useful, do not reveal the correct option until the student responds.",
        ],
    }.get(reply_style, [
        "- Lead with the next useful hint or step before giving any final answer.",
        "- Ask one short check question after the step.",
    ])

    lines = [
        "[TUTOR MODE ACTIVE]",
        "- Use the recent conversation to infer the student's level and adjust difficulty.",
        "- Avoid dumping complete solutions. Teach one step at a time unless the student is clearly stuck after trying.",
        "- Check the student's replies for correctness before moving to the next step.",
        "- Keep each response focused on one learning move: hint, check, correction, or next step.",
        "- Never solve the same step you ask the student to do. If you ask for Step 1, Step 1 must remain unanswered.",
        "- For calculations, show at most one setup or rule, then stop before the arithmetic/algebra the student should perform.",
        "- Do not reveal the final answer unless the student already attempted the problem or explicitly asks after multiple hints.",
        "- End with exactly one concrete student action, and set next_action to that same unsolved action.",
        "- Bad: solving all terms in an integral and then asking the student to calculate a term already shown.",
        "- Good: state the power rule, identify the first term, then ask the student to integrate only that first term.",
        "- Keep the visible answer short: 2-5 sentences unless correcting a submitted attempt.",
        *style_lines,
        "- Explicitly adapt difficulty based on the student's latest attempt: lower if stuck, raise if confident.",
        "- If the student is wrong, correct the smallest blocking misconception first.",
        "- If the student is right, acknowledge briefly and advance to a slightly harder next step.",
        "- When a clickable MCQ would help, put choices in the JSON options array.",
        "- Return ONLY the TutorResponse JSON contract requested in the system instructions.",
        "- Do not add markdown fences, marker lines, prose outside JSON, or comments around the JSON.",
    ]
    if tutor_choice:
        lines.append(f"- The student clicked this option: {tutor_choice}. Evaluate it before teaching the next step.")
    if attempt_evaluation:
        verdict = getattr(attempt_evaluation, "verdict", "not_applicable")
        confidence = getattr(attempt_evaluation, "confidence", 0.0)
        rationale = getattr(attempt_evaluation, "rationale", "")
        expected_answer = getattr(attempt_evaluation, "expected_answer", "")
        next_action = getattr(attempt_evaluation, "next_action", "")
        if verdict and verdict != "not_applicable":
            lines.extend([
                "[GRAPH ATTEMPT EVALUATION]",
                f"- Verdict: {verdict}",
                f"- Confidence: {confidence}",
                f"- Reason: {rationale or 'No rationale provided.'}",
                f"- Accepted answer/key idea: {expected_answer or 'Use the prior step context.'}",
                f"- Recommended next action: {next_action or 'Advance one step if correct; repair the smallest gap if not.'}",
                "- You must honor this graph verdict in tutor_state.verdict.",
                "- If Verdict is correct, acknowledge the answer as correct and move to a new next step. Do not ask the same question again.",
                "- If Verdict is partly_correct, credit the correct part before fixing the missing part.",
                "- If Verdict is not_yet, explain only the smallest blocking misconception and ask for one retry or easier sub-step.",
            ])
    if session_state:
        lines.extend([
            "[CURRENT TUTOR SESSION STATE]",
            f"- Level: {session_state.get('level', 'intermediate')}",
            f"- Phase: {session_state.get('phase', 'teach')}",
            f"- Last verdict: {session_state.get('verdict', 'not_applicable')}",
            f"- Objective: {session_state.get('objective', 'Build understanding step by step')}",
            f"- Next action from last turn: {session_state.get('next_action', 'Try the next small step')}",
            f"- Attempts: {session_state.get('attempts', 0)}",
            f"- Correct answers: {session_state.get('correct_count', 0)}",
        ])
    return "\n".join(lines)

def _task_section(task: str, user_input: str, intent: str = "") -> str:
    lines = ["[TASK]"]
    if task:
        lines.append(task)
    label = "Student's answer" if intent == "comprehension_answer" else "Student's question"
    lines.append(f"\n{label}: {user_input}")
    return "\n".join(lines)
