"""
Neo4j Knowledge Graph Client
Handles all interactions with the Neo4j database
"""

import os
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

# Neo4j driver - lazy import to handle missing dependency gracefully
neo4j = None
AsyncGraphDatabase = None

def _ensure_neo4j():
    global neo4j, AsyncGraphDatabase
    if neo4j is None:
        try:
            import neo4j as _neo4j
            from neo4j import AsyncGraphDatabase as _AsyncGraphDatabase
            neo4j = _neo4j
            AsyncGraphDatabase = _AsyncGraphDatabase
        except ImportError:
            logger.warning("neo4j package not installed. Knowledge graph features disabled.")
            return False
    return True


class Neo4jClient:
    """Async Neo4j client for knowledge graph operations"""
    
    _instance: Optional['Neo4jClient'] = None

    def __init__(
        self,
        uri: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        database: str = "neo4j"
    ):
        self.uri = uri or os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.username = username or os.getenv("NEO4J_USERNAME", "neo4j")
        self.password = password or os.getenv("NEO4J_PASSWORD", "password")
        self.database = database or os.getenv("NEO4J_DATABASE", "neo4j")
        self._driver = None
        self._initialized = False
    
    async def connect(self) -> bool:
        """Establish connection to Neo4j"""
        if not _ensure_neo4j():
            logger.warning("Neo4j not available - running in degraded mode")
            return False
        
        try:
            self._driver = AsyncGraphDatabase.driver(
                self.uri,
                auth=(self.username, self.password)
            )
            # Verify connectivity
            await self._driver.verify_connectivity()
            logger.info(f"Connected to Neo4j at {self.uri}")
            self._initialized = True
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self._initialized = False
            return False
    
    async def close(self):
        """Close the Neo4j connection"""
        if self._driver:
            await self._driver.close()
            self._driver = None
            self._initialized = False
            logger.info("Neo4j connection closed")
    
    @asynccontextmanager
    async def session(self):
        """Get a Neo4j session"""
        if not self._driver:
            raise RuntimeError("Neo4j client not connected")
        session = self._driver.session(database=self.database)
        try:
            yield session
        finally:
            await session.close()
    
    async def initialize_schema(self):
        """Create constraints and indexes"""
        from .schema import SCHEMA_CONSTRAINTS, SCHEMA_INDEXES
        
        async with self.session() as session:
            for constraint in SCHEMA_CONSTRAINTS:
                try:
                    await session.run(constraint)
                except Exception as e:
                    logger.debug(f"Constraint may already exist: {e}")
            
            for index in SCHEMA_INDEXES:
                try:
                    await session.run(index)
                except Exception as e:
                    logger.debug(f"Index may already exist: {e}")
        
        logger.info("Neo4j schema initialized")

    # ==================== User Operations ====================
    
    async def create_or_update_user(self, user_data: Dict[str, Any]) -> str:
        """Create or update a user node"""
        query = """
        MERGE (u:User {user_id: $user_id})
        SET u.username = $username,
            u.learning_style = $learning_style,
            u.difficulty_level = $difficulty_level,
            u.updated_at = datetime()
        RETURN elementId(u) as id
        """
        async with self.session() as session:
            result = await session.run(query, user_data)
            record = await result.single()
            return record["id"] if record else None
    
    async def get_user_mastery(self, user_id: int, concepts: List[str]) -> Dict[str, float]:
        """Get user's mastery levels for given concepts"""
        if not concepts:
            return {}
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE c.name IN $concepts
        RETURN c.name as concept, k.mastery_level as mastery
        """
        async with self.session() as session:
            result = await session.run(query, {"user_id": user_id, "concepts": concepts})
            records = await result.data()
            return {r["concept"]: r["mastery"] for r in records}
    
    async def update_user_mastery(
        self, 
        user_id: int, 
        concept: str, 
        mastery_delta: float,
        correct: bool
    ):
        """Update user's mastery of a concept"""
        query = """
        MATCH (u:User {user_id: $user_id})
        MERGE (c:Concept {name: $concept})
        MERGE (u)-[k:KNOWS]->(c)
        SET k.mastery_level = COALESCE(k.mastery_level, 0) + $delta,
            k.review_count = COALESCE(k.review_count, 0) + 1,
            k.correct_count = CASE WHEN $correct THEN COALESCE(k.correct_count, 0) + 1 ELSE k.correct_count END,
            k.streak = CASE WHEN $correct THEN COALESCE(k.streak, 0) + 1 ELSE 0 END,
            k.last_reviewed = datetime()
        """
        async with self.session() as session:
            await session.run(query, {
                "user_id": user_id,
                "concept": concept,
                "delta": mastery_delta,
                "correct": correct
            })

    # ==================== Concept Operations ====================
    
    async def create_concept(self, concept_data: Dict[str, Any]) -> str:
        """Create a new concept node"""
        query = """
        MERGE (c:Concept {name: $name})
        SET c.description = $description,
            c.domain = $domain,
            c.subdomain = $subdomain,
            c.difficulty = $difficulty,
            c.keywords = $keywords,
            c.updated_at = datetime()
        RETURN elementId(c) as id
        """
        async with self.session() as session:
            result = await session.run(query, concept_data)
            record = await result.single()
            return record["id"] if record else None
    
    async def get_related_concepts(self, text: str, limit: int = 10) -> List[str]:
        """Find concepts related to the given text using keyword matching"""
        # Extract keywords from text
        words = set(text.lower().split())
        
        query = """
        MATCH (c:Concept)
        WHERE ANY(keyword IN c.keywords WHERE keyword IN $words)
           OR ANY(word IN $words WHERE c.name CONTAINS word)
        RETURN c.name as name, c.domain as domain
        ORDER BY c.importance DESC
        LIMIT $limit
        """
        async with self.session() as session:
            result = await session.run(query, {"words": list(words), "limit": limit})
            records = await result.data()
            return [r["name"] for r in records]
    
    async def get_concept_prerequisites(self, concept: str) -> List[str]:
        """Get prerequisites for a concept"""
        query = """
        MATCH (c:Concept {name: $concept})<-[:PREREQUISITE_OF]-(prereq:Concept)
        RETURN prereq.name as name
        """
        async with self.session() as session:
            result = await session.run(query, {"concept": concept})
            records = await result.data()
            return [r["name"] for r in records]
    
    async def link_concepts(self, from_concept: str, to_concept: str, relation: str):
        """Create a relationship between concepts"""
        query = f"""
        MATCH (c1:Concept {{name: $from_concept}})
        MATCH (c2:Concept {{name: $to_concept}})
        MERGE (c1)-[:{relation}]->(c2)
        """
        async with self.session() as session:
            await session.run(query, {
                "from_concept": from_concept,
                "to_concept": to_concept
            })

    # ==================== Content Operations ====================
    
    async def link_content_to_concepts(
        self, 
        content_type: str, 
        content_id: int, 
        concepts: List[str]
    ):
        """Link content (flashcard, note, quiz) to concepts"""
        query = f"""
        MATCH (content:{content_type} {{{content_type.lower()}_id: $content_id}})
        UNWIND $concepts as concept_name
        MERGE (c:Concept {{name: concept_name}})
        MERGE (content)-[:COVERS]->(c)
        """
        async with self.session() as session:
            await session.run(query, {"content_id": content_id, "concepts": concepts})
    
    async def get_content_for_concepts(
        self, 
        concepts: List[str], 
        content_type: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get content that covers given concepts"""
        query = f"""
        MATCH (content:{content_type})-[:COVERS]->(c:Concept)
        WHERE c.name IN $concepts
        RETURN DISTINCT content
        LIMIT $limit
        """
        async with self.session() as session:
            result = await session.run(query, {"concepts": concepts, "limit": limit})
            return await result.data()
    
    # ==================== Context Operations ====================
    
    async def get_context(self, text: str, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get comprehensive context for a query"""
        context = {
            "related_concepts": [],
            "user_mastery": {},
            "prerequisites": [],
            "suggested_content": []
        }
        
        # Get related concepts
        concepts = await self.get_related_concepts(text)
        context["related_concepts"] = concepts
        
        if user_id and concepts:
            # Get user mastery
            context["user_mastery"] = await self.get_user_mastery(user_id, concepts)
            
            # Get prerequisites for weak areas
            weak_concepts = [c for c, m in context["user_mastery"].items() if m < 0.5]
            for concept in weak_concepts[:3]:
                prereqs = await self.get_concept_prerequisites(concept)
                context["prerequisites"].extend(prereqs)
        
        return context
    
    async def add_or_update(self, update: Dict[str, Any]):
        """Generic add/update operation"""
        node_type = update.get("type")
        data = update.get("data", {})
        
        if node_type == "concept":
            await self.create_concept(data)
        elif node_type == "user":
            await self.create_or_update_user(data)
        elif node_type == "mastery":
            await self.update_user_mastery(
                data["user_id"],
                data["concept"],
                data.get("delta", 0.1),
                data.get("correct", True)
            )


# Singleton instance
_knowledge_graph: Optional[Neo4jClient] = None

async def get_knowledge_graph() -> Optional[Neo4jClient]:
    """Get or create the knowledge graph client singleton"""
    global _knowledge_graph
    
    if _knowledge_graph is None:
        _knowledge_graph = Neo4jClient()
        connected = await _knowledge_graph.connect()
        if connected:
            await _knowledge_graph.initialize_schema()
        else:
            _knowledge_graph = None
    
    return _knowledge_graph
