from __future__ import annotations

import logging
from typing import Any, Optional

from langgraph.graph import StateGraph, END

from tutor.state import TutorState
from tutor import nodes

logger = logging.getLogger(__name__)


class TutorGraph:

    def __init__(self, ai_client: Any, db_session_factory: Any = None):
        self.ai_client = ai_client
        self.db_factory = db_session_factory
        self._graph = self._build()

    def _build(self):
        g = StateGraph(TutorState)

        g.add_node("detect_intent", nodes.detect_intent)
        g.add_node("fetch_student_state", nodes.fetch_student_state)
        g.add_node("reason_from_graph", nodes.reason_from_graph)
        g.add_node("gate_and_retrieve", nodes.gate_and_retrieve)
        g.add_node("build_prompt_and_respond", nodes.build_prompt_and_respond)
        g.add_node("evaluate_response", nodes.evaluate_response)
        g.add_node("persist_updates", nodes.persist_updates)

        g.set_entry_point("detect_intent")
        g.add_edge("detect_intent", "fetch_student_state")
        g.add_edge("fetch_student_state", "reason_from_graph")
        g.add_edge("reason_from_graph", "gate_and_retrieve")
        g.add_edge("gate_and_retrieve", "build_prompt_and_respond")
        g.add_edge("build_prompt_and_respond", "evaluate_response")
        g.add_edge("evaluate_response", "persist_updates")
        g.add_edge("persist_updates", END)

        return g.compile()

    async def invoke(
        self,
        user_id: str,
        user_input: str,
        chat_id: int | None = None,
        chat_history: list[dict] | None = None,
    ) -> dict:
        initial_state: TutorState = {
            "user_id": user_id,
            "user_input": user_input,
            "chat_id": chat_id,
            "chat_history": chat_history or [],
            "_ai_client": self.ai_client,
            "_db_factory": self.db_factory,
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return {
                "response": result.get("response", ""),
                "intent": result.get("intent", ""),
                "evaluation": result.get("evaluation"),
                "neo4j_updates": result.get("neo4j_updates", []),
                "chroma_writes": result.get("chroma_writes", []),
            }
        except Exception as e:
            logger.error(f"Tutor graph failed: {e}")
            return {"response": "Something went wrong. Please try again.", "error": str(e)}


_tutor: Optional[TutorGraph] = None


def create_tutor(ai_client: Any, db_session_factory: Any = None) -> TutorGraph:
    global _tutor
    _tutor = TutorGraph(ai_client, db_session_factory)
    return _tutor


def get_tutor() -> Optional[TutorGraph]:
    return _tutor
