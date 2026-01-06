"""
User Knowledge Graph Service
Enhanced knowledge graph operations for per-user learning tracking,
concept mastery, and personalized learning paths.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class MasteryLevel(str, Enum):
    """Mastery level classifications"""
    NOVICE = "novice"           # 0.0 - 0.2
    BEGINNER = "beginner"       # 0.2 - 0.4
    INTERMEDIATE = "intermediate"  # 0.4 - 0.6
    PROFICIENT = "proficient"   # 0.6 - 0.8
    EXPERT = "expert"           # 0.8 - 1.0


@dataclass
class ConceptMastery:
    """User's mastery of a concept"""
    concept: str
    mastery_level: float = 0.0
    confidence: float = 0.0
    review_count: int = 0
    correct_count: int = 0
    streak: int = 0
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    
    @property
    def mastery_classification(self) -> MasteryLevel:
        if self.mastery_level < 0.2:
            return MasteryLevel.NOVICE
        elif self.mastery_level < 0.4:
            return MasteryLevel.BEGINNER
        elif self.mastery_level < 0.6:
            return MasteryLevel.INTERMEDIATE
        elif self.mastery_level < 0.8:
            return MasteryLevel.PROFICIENT
        else:
            return MasteryLevel.EXPERT
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "concept": self.concept,
            "mastery_level": self.mastery_level,
            "mastery_classification": self.mastery_classification.value,
            "confidence": self.confidence,
            "review_count": self.review_count,
            "correct_count": self.correct_count,
            "streak": self.streak,
            "last_reviewed": self.last_reviewed.isoformat() if self.last_reviewed else None,
            "next_review": self.next_review.isoformat() if self.next_review else None
        }


@dataclass
class LearningPath:
    """A recommended learning path for a user"""
    topic: str
    concepts: List[Dict[str, Any]] = field(default_factory=list)
    estimated_time_hours: float = 0.0
    difficulty: str = "intermediate"
    prerequisites_met: bool = True
    missing_prerequisites: List[str] = field(default_factory=list)


class UserKnowledgeGraph:
    """
    Enhanced knowledge graph service for per-user learning tracking.
    Provides:
    - User concept mastery tracking
    - Weak/strong area identification
    - Learning path recommendations
    - Concept relationship navigation
    - Spaced repetition scheduling
    """
    
    def __init__(self, neo4j_client, db_session_factory=None):
        self.neo4j = neo4j_client
        self.db_session_factory = db_session_factory
        self._concept_cache: Dict[str, Dict] = {}
    
    # ==================== User Profile Operations ====================
    
    async def initialize_user(self, user_id: int, user_data: Dict[str, Any] = None) -> bool:
        """Initialize or update user node in knowledge graph"""
        if not self.neo4j:
            return False
        
        data = {
            "user_id": user_id,
            "username": user_data.get("username", "") if user_data else "",
            "learning_style": user_data.get("learning_style", "mixed") if user_data else "mixed",
            "difficulty_level": user_data.get("difficulty_level", "intermediate") if user_data else "intermediate"
        }
        
        try:
            await self.neo4j.create_or_update_user(data)
            logger.info(f"Initialized user {user_id} in knowledge graph")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize user {user_id}: {e}")
            return False
    
    async def get_user_profile(self, user_id: int) -> Dict[str, Any]:
        """Get user's learning profile from knowledge graph"""
        if not self.neo4j:
            return {}
        
        query = """
        MATCH (u:User {user_id: $user_id})
        OPTIONAL MATCH (u)-[k:KNOWS]->(c:Concept)
        WITH u, COUNT(c) as concepts_known, AVG(k.mastery_level) as avg_mastery
        RETURN u.learning_style as learning_style,
               u.difficulty_level as difficulty_level,
               concepts_known,
               avg_mastery
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id})
                record = await result.single()
                
                if record:
                    return {
                        "learning_style": record["learning_style"],
                        "difficulty_level": record["difficulty_level"],
                        "concepts_known": record["concepts_known"] or 0,
                        "average_mastery": record["avg_mastery"] or 0.0
                    }
        except Exception as e:
            logger.error(f"Failed to get user profile: {e}")
        
        return {}
    
    # ==================== Concept Mastery Operations ====================
    
    async def record_concept_interaction(
        self,
        user_id: int,
        concept: str,
        correct: bool,
        source: str = "flashcard",
        difficulty: float = 0.5,
        response_time_ms: int = None
    ) -> ConceptMastery:
        """Record a user's interaction with a concept and update mastery"""
        if not self.neo4j:
            return ConceptMastery(concept=concept)
        
        # Calculate mastery delta based on correctness and difficulty
        if correct:
            delta = 0.1 * (1 + difficulty)  # Harder concepts give more mastery
            if response_time_ms and response_time_ms < 3000:
                delta *= 1.2  # Bonus for quick correct answers
        else:
            delta = -0.05 * (1 + (1 - difficulty))  # Easier concepts penalize more
        
        query = """
        MATCH (u:User {user_id: $user_id})
        MERGE (c:Concept {name: $concept})
        ON CREATE SET c.created_at = datetime(), c.difficulty = $difficulty
        MERGE (u)-[k:KNOWS]->(c)
        ON CREATE SET k.mastery_level = 0, k.review_count = 0, k.correct_count = 0, k.streak = 0
        SET k.mastery_level = CASE 
                WHEN k.mastery_level + $delta > 1.0 THEN 1.0
                WHEN k.mastery_level + $delta < 0.0 THEN 0.0
                ELSE k.mastery_level + $delta
            END,
            k.review_count = k.review_count + 1,
            k.correct_count = CASE WHEN $correct THEN k.correct_count + 1 ELSE k.correct_count END,
            k.streak = CASE WHEN $correct THEN k.streak + 1 ELSE 0 END,
            k.last_reviewed = datetime(),
            k.source = $source,
            k.confidence = CASE 
                WHEN k.review_count > 10 THEN 0.9
                WHEN k.review_count > 5 THEN 0.7
                WHEN k.review_count > 2 THEN 0.5
                ELSE 0.3
            END
        RETURN k.mastery_level as mastery, k.confidence as confidence,
               k.review_count as reviews, k.correct_count as correct,
               k.streak as streak, k.last_reviewed as last_reviewed
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "concept": concept,
                    "delta": delta,
                    "correct": correct,
                    "difficulty": difficulty,
                    "source": source
                })
                record = await result.single()
                
                if record:
                    return ConceptMastery(
                        concept=concept,
                        mastery_level=record["mastery"],
                        confidence=record["confidence"],
                        review_count=record["reviews"],
                        correct_count=record["correct"],
                        streak=record["streak"],
                        last_reviewed=datetime.now()
                    )
        except Exception as e:
            logger.error(f"Failed to record concept interaction: {e}")
        
        return ConceptMastery(concept=concept)
    
    async def get_concept_mastery(self, user_id: int, concept: str) -> ConceptMastery:
        """Get user's mastery of a specific concept"""
        if not self.neo4j:
            return ConceptMastery(concept=concept)
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept {name: $concept})
        RETURN k.mastery_level as mastery, k.confidence as confidence,
               k.review_count as reviews, k.correct_count as correct,
               k.streak as streak, k.last_reviewed as last_reviewed
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id, "concept": concept})
                record = await result.single()
                
                if record:
                    return ConceptMastery(
                        concept=concept,
                        mastery_level=record["mastery"] or 0.0,
                        confidence=record["confidence"] or 0.0,
                        review_count=record["reviews"] or 0,
                        correct_count=record["correct"] or 0,
                        streak=record["streak"] or 0,
                        last_reviewed=record["last_reviewed"]
                    )
        except Exception as e:
            logger.error(f"Failed to get concept mastery: {e}")
        
        return ConceptMastery(concept=concept)

    
    async def get_all_concept_mastery(self, user_id: int, limit: int = 100) -> List[ConceptMastery]:
        """Get all concept mastery data for a user"""
        if not self.neo4j:
            return []
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        RETURN c.name as concept, k.mastery_level as mastery, k.confidence as confidence,
               k.review_count as reviews, k.correct_count as correct,
               k.streak as streak, k.last_reviewed as last_reviewed
        ORDER BY k.mastery_level DESC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id, "limit": limit})
                records = await result.data()
                
                return [
                    ConceptMastery(
                        concept=r["concept"],
                        mastery_level=r["mastery"] or 0.0,
                        confidence=r["confidence"] or 0.0,
                        review_count=r["reviews"] or 0,
                        correct_count=r["correct"] or 0,
                        streak=r["streak"] or 0,
                        last_reviewed=r["last_reviewed"]
                    )
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get all concept mastery: {e}")
        
        return []
    
    # ==================== Weak/Strong Area Analysis ====================
    
    async def get_weak_concepts(
        self, 
        user_id: int, 
        threshold: float = 0.5,
        limit: int = 10
    ) -> List[ConceptMastery]:
        """Get concepts where user needs improvement"""
        if not self.neo4j:
            return []
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level < $threshold
        RETURN c.name as concept, c.domain as domain, k.mastery_level as mastery,
               k.confidence as confidence, k.review_count as reviews,
               k.correct_count as correct, k.streak as streak
        ORDER BY k.mastery_level ASC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "threshold": threshold,
                    "limit": limit
                })
                records = await result.data()
                
                return [
                    ConceptMastery(
                        concept=r["concept"],
                        mastery_level=r["mastery"] or 0.0,
                        confidence=r["confidence"] or 0.0,
                        review_count=r["reviews"] or 0,
                        correct_count=r["correct"] or 0,
                        streak=r["streak"] or 0
                    )
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get weak concepts: {e}")
        
        return []
    
    async def get_strong_concepts(
        self, 
        user_id: int, 
        threshold: float = 0.7,
        limit: int = 10
    ) -> List[ConceptMastery]:
        """Get concepts where user excels"""
        if not self.neo4j:
            return []
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level >= $threshold
        RETURN c.name as concept, c.domain as domain, k.mastery_level as mastery,
               k.confidence as confidence, k.review_count as reviews,
               k.correct_count as correct, k.streak as streak
        ORDER BY k.mastery_level DESC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "threshold": threshold,
                    "limit": limit
                })
                records = await result.data()
                
                return [
                    ConceptMastery(
                        concept=r["concept"],
                        mastery_level=r["mastery"] or 0.0,
                        confidence=r["confidence"] or 0.0,
                        review_count=r["reviews"] or 0,
                        correct_count=r["correct"] or 0,
                        streak=r["streak"] or 0
                    )
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get strong concepts: {e}")
        
        return []
    
    async def get_concepts_needing_review(
        self, 
        user_id: int, 
        days_threshold: int = 7,
        limit: int = 20
    ) -> List[ConceptMastery]:
        """Get concepts that haven't been reviewed recently"""
        if not self.neo4j:
            return []
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.last_reviewed < datetime() - duration({days: $days})
           OR k.last_reviewed IS NULL
        RETURN c.name as concept, k.mastery_level as mastery,
               k.confidence as confidence, k.review_count as reviews,
               k.last_reviewed as last_reviewed
        ORDER BY k.mastery_level ASC, k.last_reviewed ASC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "days": days_threshold,
                    "limit": limit
                })
                records = await result.data()
                
                return [
                    ConceptMastery(
                        concept=r["concept"],
                        mastery_level=r["mastery"] or 0.0,
                        confidence=r["confidence"] or 0.0,
                        review_count=r["reviews"] or 0,
                        last_reviewed=r["last_reviewed"]
                    )
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get concepts needing review: {e}")
        
        return []

    
    # ==================== Domain/Topic Analysis ====================
    
    async def get_domain_mastery(self, user_id: int) -> Dict[str, Dict[str, Any]]:
        """Get mastery breakdown by domain/subject"""
        if not self.neo4j:
            return {}
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE c.domain IS NOT NULL
        RETURN c.domain as domain,
               AVG(k.mastery_level) as avg_mastery,
               COUNT(c) as concept_count,
               SUM(k.review_count) as total_reviews
        ORDER BY avg_mastery DESC
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id})
                records = await result.data()
                
                return {
                    r["domain"]: {
                        "average_mastery": r["avg_mastery"] or 0.0,
                        "concept_count": r["concept_count"] or 0,
                        "total_reviews": r["total_reviews"] or 0,
                        "mastery_level": self._classify_mastery(r["avg_mastery"] or 0.0)
                    }
                    for r in records if r["domain"]
                }
        except Exception as e:
            logger.error(f"Failed to get domain mastery: {e}")
        
        return {}
    
    def _classify_mastery(self, level: float) -> str:
        """Classify mastery level"""
        if level < 0.2:
            return "novice"
        elif level < 0.4:
            return "beginner"
        elif level < 0.6:
            return "intermediate"
        elif level < 0.8:
            return "proficient"
        else:
            return "expert"
    
    # ==================== Learning Path Operations ====================
    
    async def get_learning_path(
        self, 
        user_id: int, 
        topic: str,
        max_concepts: int = 10
    ) -> LearningPath:
        """Generate a personalized learning path for a topic"""
        if not self.neo4j:
            return LearningPath(topic=topic)
        
        # Get concepts in topic ordered by difficulty, considering user's current mastery
        query = """
        MATCH (t:Topic {name: $topic})<-[:PART_OF]-(c:Concept)
        OPTIONAL MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c)
        WITH c, COALESCE(k.mastery_level, 0) as current_mastery
        WHERE current_mastery < 0.8
        OPTIONAL MATCH (c)<-[:PREREQUISITE_OF]-(prereq:Concept)
        OPTIONAL MATCH (u)-[pk:KNOWS]->(prereq)
        WITH c, current_mastery, 
             COLLECT({name: prereq.name, mastery: COALESCE(pk.mastery_level, 0)}) as prerequisites
        RETURN c.name as concept, c.difficulty as difficulty, c.description as description,
               current_mastery, prerequisites
        ORDER BY c.difficulty ASC, current_mastery ASC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "topic": topic,
                    "limit": max_concepts
                })
                records = await result.data()
                
                concepts = []
                missing_prereqs = []
                
                for r in records:
                    # Check prerequisites
                    prereqs = r.get("prerequisites", [])
                    unmet_prereqs = [p["name"] for p in prereqs if p["name"] and p["mastery"] < 0.5]
                    
                    concepts.append({
                        "name": r["concept"],
                        "difficulty": r["difficulty"] or 0.5,
                        "description": r["description"] or "",
                        "current_mastery": r["current_mastery"],
                        "prerequisites": [p["name"] for p in prereqs if p["name"]],
                        "prerequisites_met": len(unmet_prereqs) == 0
                    })
                    
                    missing_prereqs.extend(unmet_prereqs)
                
                # Estimate time (10 min per concept at intermediate difficulty)
                estimated_time = sum(
                    10 * (1 + c["difficulty"]) * (1 - c["current_mastery"])
                    for c in concepts
                ) / 60  # Convert to hours
                
                return LearningPath(
                    topic=topic,
                    concepts=concepts,
                    estimated_time_hours=round(estimated_time, 1),
                    difficulty=self._classify_mastery(
                        sum(c["difficulty"] for c in concepts) / max(len(concepts), 1)
                    ),
                    prerequisites_met=len(missing_prereqs) == 0,
                    missing_prerequisites=list(set(missing_prereqs))
                )
                
        except Exception as e:
            logger.error(f"Failed to get learning path: {e}")
        
        return LearningPath(topic=topic)
    
    async def get_recommended_topics(self, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recommended topics based on user's learning progress"""
        if not self.neo4j:
            return []
        
        query = """
        // Find topics where user has some progress but not mastery
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)-[:PART_OF]->(t:Topic)
        WITH t, AVG(k.mastery_level) as avg_mastery, COUNT(c) as concepts_studied
        WHERE avg_mastery > 0.2 AND avg_mastery < 0.8
        
        // Count total concepts in topic
        OPTIONAL MATCH (t)<-[:PART_OF]-(all_c:Concept)
        WITH t, avg_mastery, concepts_studied, COUNT(all_c) as total_concepts
        
        RETURN t.name as topic, t.description as description,
               avg_mastery, concepts_studied, total_concepts,
               toFloat(concepts_studied) / total_concepts as completion_rate
        ORDER BY avg_mastery DESC, completion_rate DESC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id, "limit": limit})
                records = await result.data()
                
                return [
                    {
                        "topic": r["topic"],
                        "description": r["description"] or "",
                        "average_mastery": r["avg_mastery"],
                        "concepts_studied": r["concepts_studied"],
                        "total_concepts": r["total_concepts"],
                        "completion_rate": r["completion_rate"],
                        "recommendation_reason": self._get_recommendation_reason(r)
                    }
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get recommended topics: {e}")
        
        return []
    
    def _get_recommendation_reason(self, topic_data: Dict) -> str:
        """Generate recommendation reason for a topic"""
        mastery = topic_data.get("avg_mastery", 0)
        completion = topic_data.get("completion_rate", 0)
        
        if mastery < 0.4:
            return "Good foundation started - keep building!"
        elif mastery < 0.6:
            return "Making progress - continue to strengthen understanding"
        elif completion < 0.5:
            return "Strong start - explore more concepts in this topic"
        else:
            return "Almost mastered - finish strong!"

    
    # ==================== Concept Relationship Operations ====================
    
    async def add_concept_with_relationships(
        self,
        concept: str,
        domain: str = None,
        description: str = None,
        difficulty: float = 0.5,
        keywords: List[str] = None,
        prerequisites: List[str] = None,
        related_concepts: List[str] = None,
        topic: str = None
    ) -> bool:
        """Add a concept with its relationships"""
        if not self.neo4j:
            return False
        
        try:
            # Create the concept
            concept_data = {
                "name": concept,
                "description": description or "",
                "domain": domain or "general",
                "subdomain": "",
                "difficulty": difficulty,
                "keywords": keywords or []
            }
            await self.neo4j.create_concept(concept_data)
            
            # Add prerequisites
            if prerequisites:
                for prereq in prerequisites:
                    await self.neo4j.link_concepts(prereq, concept, "PREREQUISITE_OF")
            
            # Add related concepts
            if related_concepts:
                for related in related_concepts:
                    await self.neo4j.link_concepts(concept, related, "RELATED_TO")
            
            # Link to topic
            if topic:
                query = """
                MERGE (t:Topic {name: $topic})
                WITH t
                MATCH (c:Concept {name: $concept})
                MERGE (c)-[:PART_OF]->(t)
                """
                async with self.neo4j.session() as session:
                    await session.run(query, {"topic": topic, "concept": concept})
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to add concept: {e}")
            return False
    
    async def get_related_concepts(
        self, 
        concept: str, 
        user_id: int = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get concepts related to a given concept, optionally with user mastery"""
        if not self.neo4j:
            return []
        
        if user_id:
            query = """
            MATCH (c:Concept {name: $concept})-[:RELATED_TO|PREREQUISITE_OF|BUILDS_ON]-(related:Concept)
            OPTIONAL MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(related)
            RETURN DISTINCT related.name as concept, related.domain as domain,
                   related.difficulty as difficulty, COALESCE(k.mastery_level, 0) as user_mastery
            LIMIT $limit
            """
            params = {"concept": concept, "user_id": user_id, "limit": limit}
        else:
            query = """
            MATCH (c:Concept {name: $concept})-[:RELATED_TO|PREREQUISITE_OF|BUILDS_ON]-(related:Concept)
            RETURN DISTINCT related.name as concept, related.domain as domain,
                   related.difficulty as difficulty
            LIMIT $limit
            """
            params = {"concept": concept, "limit": limit}
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, params)
                records = await result.data()
                return records
        except Exception as e:
            logger.error(f"Failed to get related concepts: {e}")
        
        return []
    
    async def find_knowledge_gaps(self, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Find concepts user should learn based on their current knowledge"""
        if not self.neo4j:
            return []
        
        query = """
        // Find concepts the user knows well
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(known:Concept)
        WHERE k.mastery_level > 0.6
        
        // Find concepts that build on what they know
        MATCH (known)-[:PREREQUISITE_OF]->(next:Concept)
        WHERE NOT EXISTS {
            MATCH (u)-[k2:KNOWS]->(next)
            WHERE k2.mastery_level > 0.3
        }
        
        RETURN next.name as concept, next.domain as domain, next.difficulty as difficulty,
               COUNT(known) as supporting_concepts,
               COLLECT(known.name)[0..3] as based_on
        ORDER BY supporting_concepts DESC, next.difficulty ASC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id, "limit": limit})
                records = await result.data()
                
                return [
                    {
                        "concept": r["concept"],
                        "domain": r["domain"],
                        "difficulty": r["difficulty"],
                        "supporting_concepts": r["supporting_concepts"],
                        "based_on": r["based_on"],
                        "reason": f"You've mastered {r['supporting_concepts']} prerequisite concepts"
                    }
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to find knowledge gaps: {e}")
        
        return []
    
    # ==================== Content Linking Operations ====================
    
    async def link_flashcard_to_concepts(
        self, 
        flashcard_id: int, 
        concepts: List[str],
        user_id: int = None
    ) -> bool:
        """Link a flashcard to concepts it covers"""
        if not self.neo4j:
            return False
        
        query = """
        MERGE (f:Flashcard {flashcard_id: $flashcard_id})
        WITH f
        UNWIND $concepts as concept_name
        MERGE (c:Concept {name: concept_name})
        MERGE (f)-[:COVERS]->(c)
        """
        
        try:
            async with self.neo4j.session() as session:
                await session.run(query, {
                    "flashcard_id": flashcard_id,
                    "concepts": concepts
                })
            return True
        except Exception as e:
            logger.error(f"Failed to link flashcard to concepts: {e}")
            return False
    
    async def link_note_to_concepts(
        self, 
        note_id: int, 
        concepts: List[str]
    ) -> bool:
        """Link a note to concepts it mentions"""
        if not self.neo4j:
            return False
        
        query = """
        MERGE (n:Note {note_id: $note_id})
        WITH n
        UNWIND $concepts as concept_name
        MERGE (c:Concept {name: concept_name})
        MERGE (n)-[:MENTIONS]->(c)
        """
        
        try:
            async with self.neo4j.session() as session:
                await session.run(query, {
                    "note_id": note_id,
                    "concepts": concepts
                })
            return True
        except Exception as e:
            logger.error(f"Failed to link note to concepts: {e}")
            return False
    
    async def get_content_for_weak_concepts(
        self, 
        user_id: int, 
        content_type: str = "Flashcard",
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get content that covers user's weak concepts"""
        if not self.neo4j:
            return []
        
        query = f"""
        MATCH (u:User {{user_id: $user_id}})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level < 0.5
        MATCH (content:{content_type})-[:COVERS|MENTIONS]->(c)
        RETURN DISTINCT content, c.name as concept, k.mastery_level as mastery
        ORDER BY k.mastery_level ASC
        LIMIT $limit
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id, "limit": limit})
                return await result.data()
        except Exception as e:
            logger.error(f"Failed to get content for weak concepts: {e}")
        
        return []

    
    # ==================== Analytics Operations ====================
    
    async def get_learning_analytics(self, user_id: int, days: int = 30) -> Dict[str, Any]:
        """Get comprehensive learning analytics for a user"""
        if not self.neo4j:
            return {}
        
        analytics = {
            "summary": {},
            "domain_breakdown": {},
            "mastery_distribution": {},
            "recent_progress": [],
            "recommendations": []
        }
        
        try:
            # Get summary stats
            summary_query = """
            MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
            RETURN COUNT(c) as total_concepts,
                   AVG(k.mastery_level) as avg_mastery,
                   SUM(k.review_count) as total_reviews,
                   SUM(k.correct_count) as total_correct
            """
            async with self.neo4j.session() as session:
                result = await session.run(summary_query, {"user_id": user_id})
                record = await result.single()
                
                if record:
                    total_reviews = record["total_reviews"] or 0
                    total_correct = record["total_correct"] or 0
                    analytics["summary"] = {
                        "total_concepts": record["total_concepts"] or 0,
                        "average_mastery": round(record["avg_mastery"] or 0, 2),
                        "total_reviews": total_reviews,
                        "accuracy_rate": round(total_correct / max(total_reviews, 1), 2)
                    }
            
            # Get domain breakdown
            analytics["domain_breakdown"] = await self.get_domain_mastery(user_id)
            
            # Get mastery distribution
            distribution_query = """
            MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
            RETURN 
                SUM(CASE WHEN k.mastery_level < 0.2 THEN 1 ELSE 0 END) as novice,
                SUM(CASE WHEN k.mastery_level >= 0.2 AND k.mastery_level < 0.4 THEN 1 ELSE 0 END) as beginner,
                SUM(CASE WHEN k.mastery_level >= 0.4 AND k.mastery_level < 0.6 THEN 1 ELSE 0 END) as intermediate,
                SUM(CASE WHEN k.mastery_level >= 0.6 AND k.mastery_level < 0.8 THEN 1 ELSE 0 END) as proficient,
                SUM(CASE WHEN k.mastery_level >= 0.8 THEN 1 ELSE 0 END) as expert
            """
            async with self.neo4j.session() as session:
                result = await session.run(distribution_query, {"user_id": user_id})
                record = await result.single()
                
                if record:
                    analytics["mastery_distribution"] = {
                        "novice": record["novice"] or 0,
                        "beginner": record["beginner"] or 0,
                        "intermediate": record["intermediate"] or 0,
                        "proficient": record["proficient"] or 0,
                        "expert": record["expert"] or 0
                    }
            
            # Get weak concepts for recommendations
            weak = await self.get_weak_concepts(user_id, threshold=0.5, limit=5)
            analytics["recommendations"] = [
                {
                    "type": "review",
                    "concept": c.concept,
                    "current_mastery": c.mastery_level,
                    "action": f"Review {c.concept} to improve from {c.mastery_classification.value}"
                }
                for c in weak
            ]
            
            # Add knowledge gap recommendations
            gaps = await self.find_knowledge_gaps(user_id, limit=3)
            for gap in gaps:
                analytics["recommendations"].append({
                    "type": "learn",
                    "concept": gap["concept"],
                    "action": f"Learn {gap['concept']} - you've mastered the prerequisites"
                })
            
        except Exception as e:
            logger.error(f"Failed to get learning analytics: {e}")
        
        return analytics
    
    async def get_study_streak(self, user_id: int) -> Dict[str, Any]:
        """Get user's study streak information"""
        if not self.neo4j:
            return {"current_streak": 0, "longest_streak": 0}
        
        query = """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.last_reviewed IS NOT NULL
        WITH DISTINCT date(k.last_reviewed) as study_date
        ORDER BY study_date DESC
        WITH COLLECT(study_date) as dates
        
        // Calculate current streak
        WITH dates, 
             [i IN range(0, size(dates)-1) WHERE 
              i = 0 OR duration.inDays(dates[i], dates[i-1]).days = 1] as streak_indices
        
        RETURN size(dates) as total_study_days,
               dates[0] as last_study_date
        """
        
        try:
            async with self.neo4j.session() as session:
                result = await session.run(query, {"user_id": user_id})
                record = await result.single()
                
                if record:
                    return {
                        "total_study_days": record["total_study_days"] or 0,
                        "last_study_date": str(record["last_study_date"]) if record["last_study_date"] else None
                    }
        except Exception as e:
            logger.error(f"Failed to get study streak: {e}")
        
        return {"total_study_days": 0, "last_study_date": None}


# ==================== Factory Function ====================

_user_knowledge_graph: Optional[UserKnowledgeGraph] = None

async def get_user_knowledge_graph(neo4j_client=None, db_session_factory=None) -> Optional[UserKnowledgeGraph]:
    """Get or create the UserKnowledgeGraph singleton"""
    global _user_knowledge_graph
    
    if _user_knowledge_graph is None and neo4j_client:
        _user_knowledge_graph = UserKnowledgeGraph(neo4j_client, db_session_factory)
    
    return _user_knowledge_graph


def create_user_knowledge_graph(neo4j_client, db_session_factory=None) -> UserKnowledgeGraph:
    """Create a new UserKnowledgeGraph instance"""
    return UserKnowledgeGraph(neo4j_client, db_session_factory)
