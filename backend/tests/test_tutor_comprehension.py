from __future__ import annotations

import sys
import types
import importlib
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

tutor_pkg = types.ModuleType("tutor")
tutor_pkg.__path__ = [str(BACKEND_DIR / "tutor")]
sys.modules["tutor"] = tutor_pkg

prompt_stub = types.ModuleType("tutor.prompt")
prompt_stub.build_tutor_prompt = lambda state: ""
sys.modules["tutor.prompt"] = prompt_stub

evaluator_stub = types.ModuleType("tutor.evaluator")
evaluator_stub.evaluate = lambda **kwargs: None
sys.modules["tutor.evaluator"] = evaluator_stub

neo4j_stub = types.ModuleType("tutor.neo4j_store")
neo4j_stub.available = lambda: False
sys.modules["tutor.neo4j_store"] = neo4j_stub

chroma_stub = types.ModuleType("tutor.chroma_store")
chroma_stub.available = lambda: False
sys.modules["tutor.chroma_store"] = chroma_stub

nodes = importlib.import_module("tutor.nodes")


def test_detects_answer_to_previous_comprehension_check():
    state = {
        "user_input": (
            "Wave-particle duality means quantum objects can show wave-like behavior "
            "such as interference, but are detected in discrete particle-like events."
        ),
        "chat_history": [
            {
                "user": "Explain wave-particle duality.",
                "ai": (
                    "## Comprehension Check\n"
                    "To ensure you're following along, Aditya, can you briefly describe "
                    "what you understand by wave-particle duality and how it relates to quantum mechanics?"
                ),
            }
        ],
    }

    result = nodes.detect_intent(state)

    assert result["intent"] == "comprehension_answer"
    assert "wave-particle duality" in result["comprehension_check"]


def test_does_not_treat_new_question_as_check_answer():
    state = {
        "user_input": "Can you explain wave-particle duality again with an example?",
        "chat_history": [
            {
                "user": "Explain wave-particle duality.",
                "ai": (
                    "Comprehension Check: can you briefly describe how wave-particle "
                    "duality relates to quantum mechanics?"
                ),
            }
        ],
    }

    result = nodes.detect_intent(state)

    assert result["intent"] != "comprehension_answer"


def test_comprehension_answer_task_uses_tutor_feedback_rubric():
    task = nodes._build_instructional_task(
        {
            "intent": "comprehension_answer",
            "user_input": "It is when particles behave like waves too.",
            "comprehension_check": "How does wave-particle duality relate to quantum mechanics?",
            "chat_history": [],
            "language_analysis": {"instructional_hint": "generic hint that should not win"},
        }
    )

    assert "answering your previous comprehension check" in task
    assert "direct verdict" in task
    assert "stronger 2-4 sentence version" in task
    assert "generic hint" not in task
