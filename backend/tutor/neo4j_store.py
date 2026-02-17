from __future__ import annotations

import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

_driver = None


async def connect(
    uri: str | None = None,
    user: str | None = None,
    password: str | None = None,
):
    global _driver
    uri = uri or os.getenv("NEO4J_URI", "")
    user = user or os.getenv("NEO4J_USERNAME", "")
    password = password or os.getenv("NEO4J_PASSWORD", "")

    if not uri or not user or not password:
        logger.warning("Neo4j credentials not configured (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD)")
        return

    try:
        from neo4j import AsyncGraphDatabase
        _driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
        async with _driver.session() as session:
            await session.run("RETURN 1")
        logger.info("Neo4j connected")
    except Exception as e:
        logger.warning(f"Neo4j unavailable: {e}")
        _driver = None


async def disconnect():
    global _driver
    if _driver:
        await _driver.close()
        _driver = None


def available() -> bool:
    return _driver is not None


async def _run(query: str, params: dict | None = None) -> list[dict]:
    if not _driver:
        return []
    async with _driver.session() as session:
        result = await session.run(query, params or {})
        return [dict(record) for record in await result.data()]


async def get_student_concepts(user_id: str) -> dict:
    mastered = await _run(
        "MATCH (u:User {user_id: $uid})-[r:MASTERED]->(c:Concept) "
        "RETURN c.name AS concept, r.confidence AS confidence",
        {"uid": user_id},
    )
    struggling = await _run(
        "MATCH (u:User {user_id: $uid})-[r:STRUGGLES_WITH]->(c:Concept) "
        "RETURN c.name AS concept, r.attempt_count AS attempts",
        {"uid": user_id},
    )
    return {
        "mastered": [r["concept"] for r in mastered],
        "struggling": [r["concept"] for r in struggling],
        "mastery_levels": {r["concept"]: r["confidence"] for r in mastered},
    }


async def get_concept_context(concepts: list[str]) -> dict:
    if not concepts:
        return {"prerequisites": [], "mistakes": [], "strategies": []}
    prereqs = await _run(
        "UNWIND $names AS name "
        "MATCH (c:Concept {name: name})-[:REQUIRES]->(p:Concept) "
        "RETURN DISTINCT p.name AS prerequisite",
        {"names": concepts},
    )
    mistakes = await _run(
        "UNWIND $names AS name "
        "MATCH (c:Concept {name: name})-[:COMMON_MISTAKE]->(m:Mistake) "
        "RETURN DISTINCT m.description AS mistake",
        {"names": concepts},
    )
    return {
        "prerequisites": [r["prerequisite"] for r in prereqs],
        "mistakes": [r["mistake"] for r in mistakes],
        "strategies": [],
    }


async def get_effective_strategies(user_id: str, concept: str) -> list[str]:
    rows = await _run(
        "MATCH (u:User {user_id: $uid})-[r:HELPED_BY]->(s:Strategy) "
        "RETURN s.description AS strategy, r.times_used AS times "
        "ORDER BY r.times_used DESC LIMIT 3",
        {"uid": user_id},
    )
    return [r["strategy"] for r in rows]


async def update_mastery(user_id: str, concept: str, confidence: float = 0.8):
    await _run(
        "MERGE (u:User {user_id: $uid}) "
        "MERGE (c:Concept {name: $concept}) "
        "MERGE (u)-[r:MASTERED]->(c) "
        "SET r.mastered_at = datetime(), r.confidence = $conf "
        "WITH u, c "
        "OPTIONAL MATCH (u)-[s:STRUGGLES_WITH]->(c) DELETE s",
        {"uid": user_id, "concept": concept, "conf": confidence},
    )


async def update_struggle(user_id: str, concept: str):
    await _run(
        "MERGE (u:User {user_id: $uid}) "
        "MERGE (c:Concept {name: $concept}) "
        "MERGE (u)-[r:STRUGGLES_WITH]->(c) "
        "ON CREATE SET r.since = datetime(), r.attempt_count = 1 "
        "ON MATCH SET r.attempt_count = r.attempt_count + 1",
        {"uid": user_id, "concept": concept},
    )


async def record_strategy_success(user_id: str, strategy_desc: str):
    await _run(
        "MERGE (u:User {user_id: $uid}) "
        "MERGE (s:Strategy {description: $desc}) "
        "MERGE (u)-[r:HELPED_BY]->(s) "
        "ON CREATE SET r.times_used = 1, r.last_used = datetime() "
        "ON MATCH SET r.times_used = r.times_used + 1, r.last_used = datetime()",
        {"uid": user_id, "desc": strategy_desc},
    )


async def seed_concept(
    name: str,
    domain: str = "",
    difficulty: str = "intermediate",
    prerequisites: list[str] | None = None,
    common_mistakes: list[str] | None = None,
):
    await _run(
        "MERGE (c:Concept {name: $name}) "
        "SET c.domain = $domain, c.difficulty = $difficulty",
        {"name": name, "domain": domain, "difficulty": difficulty},
    )
    for prereq in (prerequisites or []):
        await _run(
            "MERGE (c:Concept {name: $name}) "
            "MERGE (p:Concept {name: $prereq}) "
            "MERGE (c)-[:REQUIRES]->(p)",
            {"name": name, "prereq": prereq},
        )
    for mistake in (common_mistakes or []):
        await _run(
            "MERGE (c:Concept {name: $name}) "
            "MERGE (m:Mistake {description: $desc}) "
            "MERGE (c)-[:COMMON_MISTAKE]->(m)",
            {"name": name, "desc": mistake},
        )
