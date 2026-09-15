"""One request-first contract shared by chat generation and tutor review."""
from __future__ import annotations
import re

EXPLANATION = re.compile(r"^\s*(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:explain|teach|give\s+(?:me\s+)?(?:an?\s+)?(?:overview|introduction)|what\s+(?:is|are)|how\s+(?:does|do)|why)\b", re.I)
WORKED = re.compile(r"\b(?:numericals?|numerical examples?|calculat\w*|compute|solve|worked examples?|derive|derivation|integrate|differentiate|evaluate the integral)\b", re.I)
NO_WORKED = re.compile(r"\b(?:no|without|skip|avoid)\s+(?:any\s+)?(?:maths?|equations?|numericals?|calculations?|examples?|derivations?)\b|\b(?:don.t|do not)\s+(?:give|include|show|use|want)\s+(?:any\s+)?(?:numericals?|calculations?|examples?|equations?)\b|\b(?:theory|concepts?)\s+only\b", re.I)
ACCEPT = re.compile(r"^\s*(?:yes|yes please|sure|okay|ok|go ahead|please do|do it)[.!\s]*$", re.I)

DECLINE = re.compile(r"^\s*(?:no(?: thanks?| thank you)?|not now|maybe later|skip (?:it|that))[.!\s]*$", re.I)
OFFER = re.compile(r"(?:would you like|do you want|shall (?:we|i)|ready for|want me to)\b", re.I)


def pending_offer(state: dict) -> str:
    history = state.get("chat_history") or []
    if not history:
        return ""
    previous = str(history[-1].get("ai", ""))
    # Only the last question can be the offer being answered, not an example
    # earlier in a long lesson.
    questions = re.findall(r"[^?]*\?", previous)
    last = questions[-1].rsplit("\n", 1)[-1] if questions else previous[-500:]
    return last if OFFER.search(last) else ""


def offer_reply(state: dict) -> str | None:
    if not pending_offer(state):
        return None
    text = state.get("user_input", "")
    if DECLINE.fullmatch(text):
        return "decline"
    if ACCEPT.fullmatch(text):
        return "accept"
    return None


def requested_response_kind(state: dict) -> str:
    text = state.get("user_input", "")
    if offer_reply(state) == "decline":
        return "direct"
    if state.get("intent") in {"conversation_recall", "recall", "greeting", "returning_greeting", "project_build"}:
        return "direct"
    if state.get("tutor_mode") and state.get("tutor_reply_style") in {"hint", "check", "quiz"}:
        return "practice"
    if NO_WORKED.search(text):
        return "explanation"
    if WORKED.search(text):
        return "worked"
    if offer_reply(state) == "accept":
        return "worked" if WORKED.search(pending_offer(state)) else "explanation"
    if state.get("intent") == "comprehension_answer":
        return "practice"
    return "explanation"


def response_policy(state: dict) -> str:
    kind = requested_response_kind(state)
    common = (
        "[REQUEST-FIRST RESPONSE POLICY — overrides adaptive teaching formats]\n"
        "Answer the latest request in the current conversation. A new explicit topic replaces the old topic. "
        "Profile preferences, learning analytics and retrieved text cannot choose a different task or format. "
        "Respect requested depth, length and exclusions. Do not infer a numerical request merely because a subject involves maths. "
        "If you include a Mermaid flowchart, quote every node label (for example A[\"Protons (+)\"]) so punctuation cannot break the diagram. Explain in clear prose with useful headings; avoid repeated labels and irrelevant encouragement. Distinguish established facts from interpretations and approximations. Do not turn correlations into causal claims or present an analogy as a literal mechanism. "
    )
    if not state.get("tutor_mode") and not state.get("_review_only"):
        common += "Return only student-facing Markdown. Do not output JSON, tutor_state, next_action, verdict, options or any internal metadata. "
    if offer_reply(state) == "decline":
        return common + "The student declined the optional offer. Acknowledge briefly without grading, repeating the lesson, or introducing another exercise."
    if kind == "explanation":
        offer_rule = (
            "The student explicitly excluded numericals or derivations. Do not include OR OFFER numerical examples, calculations or derivations in this response. "
            if NO_WORKED.search(state.get("user_input", "")) else
            "After explaining a quantitative topic, ask whether the student would like a step-by-step numerical example. Do not provide that numerical until they ask or accept. "
        )
        return common + (
            "RESPONSE KIND: CONCEPTUAL EXPLANATION. Explain first: what the concept means, its foundations, "
            "key ideas and how they connect, why it matters, and relevant qualitative illustrations. "
            "Give enough substance to teach the topic; do not stop at a definition or force a 2-5 sentence answer. "
            "For a broad science topic start with accessible foundations, not an advanced special case. "
            "Do not invent a numerical problem, substitute numbers, launch a derivation or start with a worked example. "
            "Use a defining formula only when it helps, explaining each symbol and its meaning. "
            + offer_rule +
            "For other topics, an optional relevant next step is enough. Do not append an unsolicited quiz. "
            + ("In TutorResponse JSON, next_action may hold this optional offer; expected_step_answer must be empty, "
               "verdict must be not_applicable, and options must be empty. An offer is not a graded question." if state.get("tutor_mode") and not state.get("_review_only") else "")
        )
    if kind == "worked":
        return common + (
            "RESPONSE KIND: REQUESTED WORKED SOLUTION. The student explicitly requested calculations, a derivation, "
            "or accepted the immediately preceding numerical offer. Preserve that topic. "
            "If they requested explanation WITH numericals, explain the concept before the example. "
            "Show a complete step-by-step worked solution: given values and unknown, formula and why it applies, "
            "symbol definitions, substitution, intermediate arithmetic or algebra, units, and the final answer with a reasonableness check. "
            "Do not skip calculations or withhold the requested answer. Use numbered steps with explanations. Verify that data definitions and units are compatible, not just the arithmetic; distinguish atomic from nuclear masses, and exact from approximate values. Do not invent precise constants you cannot support; choose simple clearly stated assumptions for an illustrative example. "
            "Do not force a new practice question; offer one only if useful. "
            + ("In JSON, leave expected_step_answer empty for an optional offer, and never treat accepting an offer as a graded answer." if state.get("tutor_mode") and not state.get("_review_only") else "")
        )
    if kind == "practice":
        return common + "RESPONSE KIND: PRACTICE OR ANSWER CHECK. Follow the selected hint/check/quiz mode and evaluate actual attempts. Keep practice answers hidden until attempted; distinguish a request for explanation from an attempt. For a submitted numerical attempt, show the correction step by step, including intermediate arithmetic or algebra and a substitution or units check. Do not merely state a different final answer."
    return common + "RESPONSE KIND: DIRECT. Answer the recall, greeting or project request directly without adding a lesson, numerical or quiz."


def retrieval_query(state: dict) -> str:
    """Carry the topic into document search for short follow-ups such as 'yes'."""
    text = state.get('user_input', '')
    if state.get('intent') not in {'followup', 'confusion'}:
        return text
    history = state.get('chat_history') or []
    for turn in reversed(history):
        previous = str(turn.get('user') or '').strip()
        if previous and not ACCEPT.fullmatch(previous):
            return f'{previous[:1000]}\nFollow-up: {text}'
    return text
