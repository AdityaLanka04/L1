from __future__ import annotations

import logging
from typing import Any, Optional, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class SearchHubState(TypedDict, total=False):
    user_id: str
    query: str
    context: dict
    action: str
    topic: str
    confidence: float
    _ai_client: Any
    _db_factory: Any


def detect_action(state: SearchHubState) -> dict:
    query = state.get("query", "")
    try:
        from routes import searchhub as searchhub_routes
        intent = searchhub_routes._infer_action(query)
    except Exception as e:
        logger.warning(f"SearchHub intent detection failed: {e}")
        intent = {"action": "search", "topic": query, "confidence": 0.0}

    return {
        "action": intent.get("action", "search"),
        "topic": intent.get("topic", query),
        "confidence": intent.get("confidence", 0.0),
    }


class SearchHubGraph:

    def __init__(self, ai_client: Any, db_session_factory: Any = None):
        self.ai_client = ai_client
        self.db_factory = db_session_factory
        self._graph = self._build()

    def _build(self):
        g = StateGraph(SearchHubState)
        g.add_node("detect_action", detect_action)
        g.set_entry_point("detect_action")
        g.add_edge("detect_action", END)
        return g.compile()

    async def invoke(
        self,
        user_id: str,
        query: str,
        context: dict | None = None,
    ) -> dict:
        initial_state: SearchHubState = {
            "user_id": user_id,
            "query": query,
            "context": context or {},
            "_ai_client": self.ai_client,
            "_db_factory": self.db_factory,
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return {
                "action": result.get("action", "search"),
                "topic": result.get("topic", query),
                "confidence": result.get("confidence", 0.0),
            }
        except Exception as e:
            logger.warning(f"SearchHub graph failed: {e}")
            return {"action": "search", "topic": query, "confidence": 0.0}


_searchhub_graph: Optional[SearchHubGraph] = None


def create_searchhub_graph(ai_client: Any, db_session_factory: Any = None) -> SearchHubGraph:
    global _searchhub_graph
    _searchhub_graph = SearchHubGraph(ai_client, db_session_factory)
    return _searchhub_graph


def get_searchhub_graph() -> Optional[SearchHubGraph]:
    return _searchhub_graph
