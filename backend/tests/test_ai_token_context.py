import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_learning_path_graph_sets_ai_usage_context():
    from activity_context import get_activity_context
    from graphs.learningpath_graph import LearningPathGraph

    class FakeAI:
        def __init__(self):
            self.context_seen = None

        def generate(self, prompt, max_tokens=1800, temperature=0.4):
            self.context_seen = dict(get_activity_context() or {})
            return """
            {
              "title": "Neural Networks Path",
              "description": "A test path",
              "estimated_hours": 1.0,
              "nodes": [
                {
                  "title": "Intro",
                  "description": "Start here",
                  "objectives": ["Understand basics"],
                  "prerequisites": [],
                  "estimated_minutes": 20,
                  "content_plan": ["Read", "Practice"]
                }
              ]
            }
            """

    fake = FakeAI()
    graph = LearningPathGraph(fake)

    result = graph.invoke(
        user_id="123",
        topic="neural networks",
        difficulty="beginner",
        length="short",
    )

    assert result["title"] == "Neural Networks Path"
    assert fake.context_seen == {
        "user_id": "123",
        "tool_name": "learning_path_ai",
        "action": "generate",
        "endpoint": "/api/learning-paths/generate",
        "method": "POST",
    }
    assert get_activity_context() is None


def test_call_ai_async_preserves_activity_context(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "test-secret-that-is-long-enough-for-jwt")
    monkeypatch.setenv("GROQ_API_KEY", "dummy")

    import deps
    from activity_context import clear_activity_context, get_activity_context, set_activity_context

    seen = {}

    def fake_call_ai(prompt, max_tokens=2000, temperature=0.7, use_cache=False, conversation_id=None):
        seen.update(get_activity_context() or {})
        return "ok"

    monkeypatch.setattr(deps, "call_ai", fake_call_ai)

    token = set_activity_context({
        "user_id": "456",
        "tool_name": "ai_chat",
        "action": "create",
        "endpoint": "/api/ask_simple/",
        "method": "POST",
    })
    try:
        result = asyncio.run(deps.call_ai_async("hello"))
    finally:
        clear_activity_context(token)

    assert result == "ok"
    assert seen == {
        "user_id": "456",
        "tool_name": "ai_chat",
        "action": "create",
        "endpoint": "/api/ask_simple/",
        "method": "POST",
    }
    assert get_activity_context() is None
