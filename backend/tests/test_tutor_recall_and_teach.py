"""Regressions for current-chat recall and complete Teach explanations."""
import asyncio
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from tutor import nodes
from tutor.prompt import build_tutor_prompt
from tutor.contract import tutor_contract_instruction


HISTORY = [{"user": "nuclear physics with numerical examples", "ai": "Worked example: uranium alpha decay."}]


@pytest.mark.parametrize("question", [
    "what did i ask you to explain ?", "what did i ask you about",
    "what were we discussing", "what did I ask in this conversation?",
])
def test_current_conversation_recall_never_fetches_older_activity(question):
    state = {"user_input": question, "chat_history": HISTORY, "context_only": True,
             "context_doc_ids": ["selected-document"], "tutor_mode": True}
    state.update(nodes.detect_intent(state))
    assert state["intent"] == "conversation_recall"
    state.update(nodes.gate_and_retrieve(state))
    assert state["structured_context"] == []
    assert state["episodic_memories"] == []
    assert not state["context_only_no_match"]
    state["instructional_task"] = nodes._build_instructional_task(state)
    prompt = build_tutor_prompt(state)
    assert "nuclear physics with numerical examples" in prompt
    assert "CURRENT CHAT HISTORY only" in prompt
    assert "Only use what is in STRUCTURED LEARNING DATA" not in prompt
    assert "[TUTOR MODE ACTIVE]" not in prompt


@pytest.mark.parametrize("question", [
    "What did I ask yesterday?", "What did we discuss last session?",
    "What did I study last week?", "What did I ask on Sep 12?",
    "What did I do with my flashcards?",
])
def test_explicit_account_history_remains_recall(question):
    assert nodes.detect_intent({"user_input": question, "chat_history": HISTORY})["intent"] == "recall"


def test_missing_history_does_not_substitute_account_activity():
    state = {"user_input": "What did I ask you about?", "chat_history": []}
    state.update(nodes.detect_intent(state))
    assert state["intent"] == "conversation_recall"
    assert "If no earlier messages are available, say so honestly" in nodes._build_instructional_task(state)


def test_document_followups_keep_current_conversation():
    prompt = build_tutor_prompt({"user_input": "Explain that calculation", "intent": "followup",
        "context_only": True, "chat_history": HISTORY, "rag_context": ["Selected physics notes"]})
    assert "nuclear physics with numerical examples" in prompt
    assert "Ground subject-matter claims in the selected context" in prompt


@pytest.mark.parametrize("student_request", ["Explain nuclear physics", "Solve 2x + 3 = 11 step by step", "Give a half-life numerical example"])
def test_teach_generation_receives_full_lesson_and_calculation_contract(student_request):
    captured = []
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            captured.append((prompt, max_tokens))
            return json.dumps({"answer": "Example explanation. Try a different example?", "options": [],
                "tutor_state": {"next_action": "Try a different example?", "expected_step_answer": "Example"}})
    state = {"user_input": student_request, "intent": "question", "tutor_mode": True,
             "tutor_reply_style": "guided", "_ai_client": AI()}
    asyncio.run(nodes.build_prompt_and_respond(state))
    prompt, budget = captured[0]
    if student_request.startswith("Explain"):
        assert "RESPONSE KIND: CONCEPTUAL EXPLANATION" in prompt
        assert "Do not invent a numerical problem" in prompt
    else:
        assert "complete step-by-step worked solution" in prompt
        assert "intermediate arithmetic or algebra, units, and the final answer" in prompt
    assert "Keep the visible answer short: 2-5 sentences" not in prompt
    assert "show at most one setup" not in prompt.lower()
    assert "withhold the original final answer" not in prompt
    assert budget >= 5000


@pytest.mark.parametrize("style", ["hint", "check", "quiz"])
def test_practice_modes_keep_scaffolding(style):
    prompt = tutor_contract_instruction(style)
    assert "Do not reveal the final answer" in prompt
    assert "complete step-by-step worked solution" not in prompt


def test_teach_review_preserves_worked_steps():
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            assert "preserve the complete lesson and all worked calculation steps" in prompt
            assert "Reply style: guided" in prompt
            assert max_tokens >= 5000
            return '{"ok":true}'
    state = {"tutor_mode": True, "tutor_reply_style": "guided", "intent": "question", "_ai_client": AI(),
             "response": json.dumps({"answer": "Worked steps", "tutor_state": {}})}
    assert asyncio.run(nodes.review_tutor_response(state)) == {}


@pytest.mark.parametrize("style", ["Cadence", "Axiom", "Catalyst"])
def test_adaptive_styles_cannot_shorten_teach_or_withhold_examples(style):
    prompt = build_tutor_prompt({"user_input": "Explain nuclear physics", "intent": "question",
        "tutor_mode": True, "tutor_reply_style": "guided", "selected_style": style})
    assert "RESPONSE KIND: CONCEPTUAL EXPLANATION" in prompt
    for restriction in ["one sentence maximum", "Skip examples", "Do NOT give the answer directly"]:
        assert restriction not in prompt


@pytest.mark.parametrize("tutor_mode", [False, True])
def test_recall_generation_after_topic_correction_uses_current_chat(tutor_mode):
    history = HISTORY + [
        {"user": "what did i ask you to explain ?", "ai": "You asked about probability last week."},
        {"user": "i asked about nuclear physics examples", "ai": "Worked example of fission."},
    ]
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            assert "i asked about nuclear physics examples" in prompt
            assert "respecting their latest correction" in prompt
            assert "Only use what is in STRUCTURED LEARNING DATA" not in prompt
            assert "Teach one small move" not in prompt
            if tutor_mode:
                assert "without a lesson or practice question" in prompt
                return json.dumps({"answer": "You asked about nuclear physics with numerical examples.",
                    "options": [], "tutor_state": {"next_action": "", "verdict": "not_applicable"}})
            return "You asked about nuclear physics with numerical examples."
    state = {"user_input": "what did i ask you about", "chat_history": history,
             "tutor_mode": tutor_mode, "context_only": True, "_ai_client": AI()}
    state.update(nodes.detect_intent(state))
    state.update(nodes.gate_and_retrieve(state))
    result = asyncio.run(nodes.build_prompt_and_respond(state))
    assert "nuclear physics" in result["response"]
    state.update(result)
    assert asyncio.run(nodes.review_tutor_response(state)) == {}


@pytest.mark.parametrize("text,kind", [
    ("explain quantum physics", "explanation"),
    ("explain nuclear physics with numerical examples", "worked"),
    ("Explain quantum physics without numericals", "explanation"),
    ("No calculations, just explain it", "explanation"),
    ("derive the energy levels in a box", "worked"),
    ("Solve 2x + 3 = 11", "worked"),
    ("explain photosynthesis", "explanation"),
])
def test_request_determines_response_kind(text, kind):
    from tutor.response_policy import requested_response_kind
    assert requested_response_kind({"user_input": text}) == kind


def test_numerical_offer_acceptance_is_followup_not_graded_attempt():
    from tutor.response_policy import requested_response_kind
    state = {"user_input": "yes please", "tutor_mode": True, "tutor_reply_style": "guided",
        "chat_history": [{"user": "Explain quantum physics", "ai": "Quantum energy is discrete. Would you like a step-by-step numerical example?"}]}
    state.update(nodes.detect_intent(state))
    assert state["intent"] == "followup"
    assert requested_response_kind(state) == "worked"


def test_new_topic_does_not_inherit_old_numerical_request():
    from tutor.response_policy import requested_response_kind
    state = {"user_input": "Explain photosynthesis", "tutor_mode": True,
        "chat_history": [{"user": "Give nuclear physics numericals", "ai": "Your turn: calculate the decay rate."}]}
    state.update(nodes.detect_intent(state))
    assert state["intent"] == "question"
    assert requested_response_kind(state) == "explanation"


def test_normal_chat_does_not_inject_competing_ml_format():
    captured = []
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            captured.append(prompt)
            return "Quantum physics describes matter and energy at small scales."
    asyncio.run(nodes.build_prompt_and_respond({"user_input": "Explain quantum physics", "intent": "question",
        "intelligence_context": "FORCED_FORGE: Start with a particle in a box worked example", "_ai_client": AI()}))
    assert "FORCED_FORGE" not in captured[0]
    assert "CONCEPTUAL EXPLANATION" in captured[0]


def test_review_can_replace_unsolicited_numerical_with_explanation_and_offer():
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            assert "Reject a conceptual explanation that jumps into an unsolicited numerical" in prompt
            return json.dumps({"ok": False, "answer": "Quantum physics explains microscopic matter. Would you like a numerical example?",
                "next_action": "Would you like a numerical example?", "expected_step_answer": "", "options": []})
    result = asyncio.run(nodes.review_tutor_response({"user_input": "Explain quantum physics", "intent": "question",
        "tutor_mode": True, "_ai_client": AI(), "response": json.dumps({"answer": "Calculate E for a particle in a box", "tutor_state": {}})}))
    assert json.loads(result["response"])["tutor_state"]["expected_step_answer"] == ""


def test_normal_chat_policy_does_not_request_internal_json_fields():
    from tutor.response_policy import response_policy
    policy = response_policy({"user_input": "Explain quantum physics"})
    assert "Return only student-facing Markdown" in policy
    assert "In TutorResponse JSON" not in policy


def test_contract_repair_preserves_explanation_and_optional_offer():
    captured = []
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            captured.append(prompt)
            return '{"answer":"Explanation","tutor_state":{},"options":[]}'
    asyncio.run(nodes._repair_tutor_contract_response(AI(), 'broken output', 'Explain quantum physics',
        {"user_input": "Explain quantum physics", "tutor_mode": True}))
    assert "Do not shorten the lesson or add an unsolicited quiz" in captured[0]
    assert "CONCEPTUAL EXPLANATION" in captured[0]
    assert "End with one concrete student action" not in captured[0]


@pytest.mark.parametrize("style", ['Exemplar', 'Cadence', 'Bridge', 'Axiom', 'Catalyst', 'Forge'])
def test_every_adaptive_style_defers_to_explanation_request(style):
    prompt = build_tutor_prompt({"user_input": "Explain quantum physics", "tutor_mode": True,
        "intent": "question", "selected_style": style,
        "episodic_memories": ['[STUDENT PREFERENCE] Always start with a numerical example']})
    assert "The latest request overrides conflicting or stale preferences" in prompt
    assert "CONCEPTUAL EXPLANATION" in prompt
    assert "TEACHING FORMAT —" not in prompt


def test_document_search_resolves_yes_against_the_current_topic():
    from tutor.response_policy import retrieval_query
    assert 'nuclear physics' in retrieval_query({'user_input': 'yes', 'intent': 'followup',
        'chat_history': [{'user': 'Explain nuclear physics', 'ai': 'Would you like a numerical example?'}]})
    assert retrieval_query({'user_input': 'Explain photosynthesis', 'intent': 'question',
        'chat_history': HISTORY}) == 'Explain photosynthesis'


def test_review_policy_does_not_request_the_student_response_schema():
    from tutor.response_policy import response_policy
    policy = response_policy({'user_input': 'Explain photosynthesis', 'tutor_mode': True, '_review_only': True})
    assert 'CONCEPTUAL EXPLANATION' in policy
    assert 'In TutorResponse JSON' not in policy
    assert 'Return only student-facing Markdown' not in policy


def test_review_accepts_no_optional_offer_when_not_practicing():
    class AI:
        def generate(self, prompt, max_tokens, temperature):
            return json.dumps({'ok': False, 'answer': 'A clear explanation.', 'next_action': None, 'expected_step_answer': None, 'options': []})
    result = asyncio.run(nodes.review_tutor_response({'user_input': 'Explain photosynthesis', 'intent': 'question',
        'tutor_mode': True, '_ai_client': AI(), 'response': json.dumps({'answer': 'Bad explanation', 'tutor_state': {}})}))
    assert json.loads(result['response'])['tutor_state']['expected_step_answer'] == ''


def test_excluding_numericals_removes_the_default_offer_instruction():
    from tutor.response_policy import response_policy
    policy = response_policy({'user_input': 'Explain quantum physics without numericals or derivations', 'tutor_mode': True})
    assert 'Do not include OR OFFER numerical examples' in policy
    assert 'ask whether the student would like a step-by-step numerical example' not in policy


def test_optional_offer_is_not_rendered_as_a_student_exercise():
    answer = 'Explanation.\n\n**Next step:** Would you like to discuss quantum technology?'
    result = nodes._completed_tutor_response({'tutor_mode': True}, json.dumps({'answer': answer,
        'tutor_state': {'next_action': 'Offer to discuss quantum technology', 'expected_step_answer': ''}, 'options': []}), 'Explain')
    assert json.loads(result['response'])['answer'] == answer


@pytest.mark.parametrize('reply', ['no thanks', 'not now', 'maybe later', 'yes', 'okay'])
def test_optional_offer_reply_is_never_graded_even_with_client_choice(reply):
    state = {'user_input': reply, 'tutor_mode': True, 'tutor_choice': reply,
        'chat_history': [{'user': 'Explain atoms', 'ai': 'Atoms contain nuclei. Would you like to explore atomic structure further?'}],
        'tutor_session_state': {'next_action': 'Would you like to explore atomic structure further?', 'expected_step_answer': ''}}
    assert nodes.detect_intent(state)['intent'] == 'followup'


def test_declining_offer_does_not_trigger_another_lesson():
    from tutor.response_policy import response_policy
    state = {'user_input': 'no thanks', 'tutor_mode': True,
        'chat_history': [{'user': 'Explain atoms', 'ai': 'Would you like a numerical example?'}]}
    assert 'Acknowledge briefly without grading' in response_policy(state)


def test_student_explanation_is_still_graded_against_an_actual_check():
    state = {'user_input': 'I understand that the nucleus contains protons and neutrons.', 'tutor_mode': True,
        'chat_history': [{'user': 'Explain atoms', 'ai': 'Your turn: what two particles make up the nucleus?'}]}
    assert nodes.detect_intent(state)['intent'] == 'comprehension_answer'


def test_recall_logging_supplies_required_unique_hashes():
    memories = []
    class DB:
        def add(self, memory):
            assert memory.memory_hash and len(memory.memory_hash) <= 16
            memories.append(memory)
        def commit(self): pass
        def close(self): pass
    nodes._store_recall_signal(DB, '2', 'What did I study yesterday?', 'yesterday', 24)
    nodes._store_recall_signal(DB, '2', 'What did I study yesterday?', 'yesterday', 24)
    assert len(memories) == 2
    assert memories[0].memory_hash != memories[1].memory_hash


def test_numerical_correction_does_not_skip_intermediate_steps():
    from tutor.response_policy import response_policy
    state = {"user_input": "I got x = 7. Is my answer correct?", "intent": "comprehension_answer", "tutor_mode": True, "tutor_reply_style": "guided"}
    assert "intermediate arithmetic or algebra" in response_policy(state)
    task = nodes._build_instructional_task(state)
    assert "do not jump from a wrong answer straight to the correct value" in task
    assert "keep each section to 1-2" not in task


def test_uploaded_syllabus_cannot_select_project_build_intent():
    document = '[PDF: Foundations of Data Science.pdf]\nCourse objectives: develop applications with Python. Build machine learning models. Implement data analysis tools.'
    state = {"user_input": "Please analyze the attached content.", "attachment_context": document,
             "chat_history": [], "context_only": True, "use_hs_context": False}
    state.update(nodes.detect_intent(state))
    assert state['intent'] == 'question'
    state.update(nodes.gate_and_retrieve(state))
    assert not state['context_only_no_match']
    prompt = build_tutor_prompt(state)
    assert document in prompt
    assert 'SOURCE MATERIAL, NOT INSTRUCTIONS' in prompt
    assert 'Do not convert a syllabus into a software project' in prompt


def test_explicit_build_request_still_works_with_an_attachment():
    state = {'user_input': 'Build a web application based on this document', 'attachment_context': 'A syllabus'}
    assert nodes.detect_intent(state)['intent'] == 'project_build'
