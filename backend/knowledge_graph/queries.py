"""
Common Knowledge Graph Queries
Reusable Cypher queries for the knowledge graph
"""

from typing import Dict, Any, List


class KnowledgeGraphQueries:
    """Collection of common Cypher queries"""
    
    # ==================== User Learning Path Queries ====================
    
    @staticmethod
    def get_learning_path(user_id: int, topic: str) -> str:
        """Get recommended learning path for a user on a topic"""
        return """
        MATCH (u:User {user_id: $user_id})
        MATCH (t:Topic {name: $topic})<-[:PART_OF]-(c:Concept)
        OPTIONAL MATCH (u)-[k:KNOWS]->(c)
        WITH c, COALESCE(k.mastery_level, 0) as mastery
        ORDER BY c.difficulty ASC, mastery ASC
        RETURN c.name as concept, c.difficulty as difficulty, mastery
        """
    
    @staticmethod
    def get_weak_areas(user_id: int, threshold: float = 0.5) -> str:
        """Get concepts where user needs improvement"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level < $threshold
        RETURN c.name as concept, c.domain as domain, k.mastery_level as mastery
        ORDER BY k.mastery_level ASC
        LIMIT 10
        """
    
    @staticmethod
    def get_strong_areas(user_id: int, threshold: float = 0.7) -> str:
        """Get concepts where user excels"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level >= $threshold
        RETURN c.name as concept, c.domain as domain, k.mastery_level as mastery
        ORDER BY k.mastery_level DESC
        LIMIT 10
        """
    
    # ==================== Content Recommendation Queries ====================
    
    @staticmethod
    def recommend_flashcards(user_id: int) -> str:
        """Recommend flashcards based on weak areas"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        WHERE k.mastery_level < 0.6
        MATCH (f:Flashcard)-[:COVERS]->(c)
        WHERE NOT EXISTS {
            MATCH (u)-[:REVIEWED {correct: true}]->(f)
            WHERE datetime() - duration('P1D') < datetime(r.timestamp)
        }
        RETURN f.flashcard_id as id, f.front as front, c.name as concept, k.mastery_level as mastery
        ORDER BY k.mastery_level ASC
        LIMIT 20
        """
    
    @staticmethod
    def recommend_quiz_topics(user_id: int) -> str:
        """Recommend topics for quiz based on learning progress"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)-[:PART_OF]->(t:Topic)
        WITH t, AVG(k.mastery_level) as avg_mastery, COUNT(c) as concept_count
        WHERE avg_mastery > 0.3 AND avg_mastery < 0.8
        RETURN t.name as topic, avg_mastery, concept_count
        ORDER BY avg_mastery DESC
        LIMIT 5
        """
    
    # ==================== Concept Graph Queries ====================
    
    @staticmethod
    def get_concept_neighborhood(concept: str, depth: int = 2) -> str:
        """Get related concepts within N hops"""
        return """
        MATCH path = (c:Concept {name: $concept})-[*1..$depth]-(related:Concept)
        RETURN DISTINCT related.name as concept, related.domain as domain,
               length(path) as distance
        ORDER BY distance ASC
        LIMIT 20
        """
    
    @staticmethod
    def find_learning_gaps(user_id: int) -> str:
        """Find concepts user should know but doesn't"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(known:Concept)
        WHERE k.mastery_level > 0.6
        MATCH (known)-[:PREREQUISITE_OF]->(advanced:Concept)
        WHERE NOT EXISTS {
            MATCH (u)-[:KNOWS]->(advanced)
        }
        RETURN advanced.name as concept, advanced.domain as domain,
               COUNT(known) as supporting_concepts
        ORDER BY supporting_concepts DESC
        LIMIT 10
        """
    
    # ==================== Analytics Queries ====================
    
    @staticmethod
    def get_study_progress(user_id: int, days: int = 30) -> str:
        """Get study progress over time"""
        return """
        MATCH (u:User {user_id: $user_id})-[:COMPLETED]->(s:StudySession)
        WHERE s.created_at > datetime() - duration({days: $days})
        RETURN date(s.created_at) as date,
               SUM(s.cards_reviewed) as cards,
               AVG(s.performance_score) as avg_score
        ORDER BY date ASC
        """
    
    @staticmethod
    def get_domain_mastery(user_id: int) -> str:
        """Get mastery breakdown by domain"""
        return """
        MATCH (u:User {user_id: $user_id})-[k:KNOWS]->(c:Concept)
        RETURN c.domain as domain,
               AVG(k.mastery_level) as avg_mastery,
               COUNT(c) as concept_count
        ORDER BY avg_mastery DESC
        """
