from routes.notes import NoteAgentRequest, _build_note_agent_prompt, _clean_grammar_result


def test_grammar_prompt_requires_only_corrected_text():
    prompt = _build_note_agent_prompt(
        NoteAgentRequest(
            user_id="student",
            action="grammar",
            content="topic today is about",
            context='<span style="font-size: 16px">Unrelated note HTML</span>',
        )
    )

    assert "Return only the corrected text" in prompt
    assert "Do not complete an unfinished thought" in prompt
    assert "topic today is about" in prompt
    assert "Context:" not in prompt
    assert "Unrelated note HTML" not in prompt


def test_clean_grammar_result_removes_note_and_explanation():
    result = (
        "Today's topic is about.\n\n"
        "Note: The provided sentence was incomplete, so punctuation was added."
    )

    assert _clean_grammar_result(result) == "Today's topic is about."


def test_clean_grammar_result_removes_echoed_context():
    result = (
        "The topic today is about.\n\n"
        'Context:\n<span data-note-font="Montserrat">The topic today is about</span>'
    )

    assert _clean_grammar_result(result) == "The topic today is about."


def test_clean_grammar_result_removes_response_label_and_fence():
    result = "```text\nCorrected sentence: Today's topic is about.\n```"

    assert _clean_grammar_result(result) == "Today's topic is about."


def test_clean_grammar_result_preserves_multiple_corrected_paragraphs():
    result = "This is the first paragraph.\n\nThis is the second paragraph."

    assert _clean_grammar_result(result) == result
