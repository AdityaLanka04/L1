"""
Master Agent - The Central Intelligence Hub
Aggregates context from all agents, manages user learning profile,
identifies weak areas, and coordinates agent activities.
"""

import logging
import json
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .memory.unified_memory import MemoryType

logger = logging.getLogger(__name__)


# ==================== Enums & Types ====================

class MasterAction(str, Enum):
    """Actions the master agent can perform"""
    GET_USER_PROFILE = "get_user_profile"
    GET_WEAK_TOPICS = "get_weak_topics"
    GET_STRONG_TOPICS = "get_strong_topics"
    GET_LEARNING_INSIGHTS = "get_learning_insights"
    GET_RECOMMENDATIONS = "get_recommendations"
    COORDINATE_AGENTS = "coordinate_agents"
    ANALYZE_PROGRESS = "analyze_progress"
    GET_FULL_CONTEXT = "get_full_context"


class LearningDimension(str, Enum):
    """Dimensions of learning to analyze"""
    KNOWLEDGE = "knowledge"
    RETENTION = "retention"
    APPLICATION = "application"
    CONSISTENCY = "consistency"
    ENGAGEMENT = "engagement"


# ==================== State Definition ====================

class MasterAgentState(TypedDict, total=False):
    """State for the master agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Action context
    action: str
    action_params: Dict[str, Any]
    
    # Aggregated user context
    user_profile: Dict[str, Any]
    learning_state: Dict[str, Any]
    
    # Topic analysis
    weak_topics: List[Dict[str, Any]]
    strong_topics: List[Dict[str, Any]]
    suggested_topics: List[str]
    
    # Agent contexts
    flashcard_context: Dict[str, Any]
    quiz_context: Dict[str, Any]
    chat_context: Dict[str, Any]
    notes_context: Dict[str, Any]
    
    # Performance metrics
    overall_performance: Dict[str, Any]
    dimension_scores: Dict[str, float]
    
    # Recommendations
    recommendations: List[Dict[str, Any]]
    priority_actions: List[Dict[str, Any]]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== User Profile Aggregator ====================

@dataclass
class UserLearningProfile:
    """Comprehensive user learning profile"""
    user_id: str
    
    # Basic info
    name: str = ""
    field_of_study: str = ""
    learning_style: str = ""
    difficulty_level: str = "intermediate"
    
    # Learning metrics
    total_study_time_hours: float = 0.0
    day_streak: int = 0
    overall_accuracy: float = 0.0
    retention_rate: float = 0.0
    
    # Topic mastery
    strong_topics: List[str] = field(default_factory=list)
    weak_topics: List[str] = field(default_factory=list)
    current_focus_topics: List[str] = field(default_factory=list)
    
    # Preferences
    preferred_study_time: str = ""
    session_length_preference: int = 30
    prefers_visual_aids: bool = False
    prefers_examples: bool = True
    
    # Engagement
    engagement_score: float = 0.5
    consistency_score: float = 0.5
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "field_of_study": self.field_of_study,
            "learning_style": self.learning_style,
            "difficulty_level": self.difficulty_level,
            "total_study_time_hours": self.total_study_time_hours,
            "day_streak": self.day_streak,
            "overall_accuracy": self.overall_accuracy,
            "retention_rate": self.retention_rate,
            "strong_topics": self.strong_topics,
            "weak_topics": self.weak_topics,
            "current_focus_topics": self.current_focus_topics,
            "preferred_study_time": self.preferred_study_time,
            "session_length_preference": self.session_length_preference,
            "prefers_visual_aids": self.prefers_visual_aids,
            "prefers_examples": self.prefers_examples,
            "engagement_score": self.engagement_score,
            "consistency_score": self.consistency_score
        }


class UserContextAggregator:
    """Aggregates user context from all sources"""
    
    def __init__(self, memory_manager: MemoryManager, db_session_factory=None, user_knowledge_graph=None):
        self.memory_manager = memory_manager
        self.db_session_factory = db_session_factory
        self.user_kg = user_knowledge_graph
    
    async def get_full_user_context(self, user_id: str) -> Dict[str, Any]:
        """Get comprehensive user context from all agents and sources"""
        context = {
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "profile": {},
            "learning_state": {},
            "agent_contexts": {},
            "knowledge_graph": {},
            "performance": {},
            "recommendations": []
        }
        
        # 1. Get base profile from database
        context["profile"] = await self._get_user_profile(user_id)
        
        # 2. Get context from each agent type
        context["agent_contexts"]["flashcard"] = await self._get_flashcard_context(user_id)
        context["agent_contexts"]["quiz"] = await self._get_quiz_context(user_id)
        context["agent_contexts"]["chat"] = await self._get_chat_context(user_id)
        context["agent_contexts"]["notes"] = await self._get_notes_context(user_id)
        
        # 3. Get knowledge graph context
        context["knowledge_graph"] = await self._get_knowledge_graph_context(user_id)
        
        # 4. Aggregate learning state (now includes KG data)
        context["learning_state"] = await self._aggregate_learning_state(
            user_id, 
            context["agent_contexts"],
            context["knowledge_graph"]
        )
        
        # 4. Calculate performance metrics
        context["performance"] = self._calculate_performance_metrics(context)
        
        # 5. Generate recommendations
        context["recommendations"] = self._generate_recommendations(context)
        
        return context
    
    async def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user profile from database"""
        profile = {
            "name": "",
            "field_of_study": "",
            "learning_style": "",
            "school_university": "",
            "preferences": {}
        }
        
        if self.db_session_factory:
            try:
                from models import User, UserPreferences, UserPersonalityProfile, EnhancedUserStats
                
                db = self.db_session_factory()
                try:
                    user = db.query(User).filter(User.id == int(user_id)).first()
                    if user:
                        profile["name"] = f"{user.first_name or ''} {user.last_name or ''}".strip()
                        profile["field_of_study"] = user.field_of_study or ""
                        profile["learning_style"] = user.learning_style or ""
                        profile["school_university"] = user.school_university or ""
                    
                    # Get preferences
                    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == int(user_id)).first()
                    if prefs:
                        profile["preferences"] = {
                            "explanation_style": prefs.preferred_explanation_style,
                            "favorite_subjects": prefs.favorite_subjects or [],
                            "likes_challenges": prefs.likes_challenges,
                            "likes_step_by_step": prefs.likes_step_by_step,
                            "prefers_visual_aids": prefs.prefers_visual_aids,
                            "prefers_examples": prefs.prefers_real_examples
                        }
                    
                    # Get personality profile
                    personality = db.query(UserPersonalityProfile).filter(
                        UserPersonalityProfile.user_id == int(user_id)
                    ).first()
                    if personality:
                        profile["personality"] = {
                            "pace_preference": personality.pace_preference,
                            "detail_preference": personality.detail_preference,
                            "visual_learner_score": personality.visual_learner_score,
                            "session_length_preference": personality.session_length_preference
                        }
                    
                    # Get enhanced stats
                    stats = db.query(EnhancedUserStats).filter(
                        EnhancedUserStats.user_id == int(user_id)
                    ).first()
                    if stats:
                        profile["stats"] = {
                            "learning_velocity": stats.learning_velocity,
                            "retention_score": stats.retention_score,
                            "consistency_rating": stats.consistency_rating,
                            "study_level": stats.study_level,
                            "favorite_subject": stats.favorite_subject,
                            "total_questions": stats.total_questions,
                            "correct_answers": stats.correct_answers
                        }
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error getting user profile: {e}")
        
        return profile

    
    async def _get_flashcard_context(self, user_id: str) -> Dict[str, Any]:
        """Get flashcard-related context"""
        context = {
            "total_sets": 0,
            "total_cards": 0,
            "cards_mastered": 0,
            "cards_struggling": 0,
            "recent_topics": [],
            "weak_concepts": [],
            "strong_concepts": [],
            "retention_rate": 0.0,
            "study_sessions_this_week": 0
        }
        
        # Get from memory manager
        if self.memory_manager:
            try:
                flashcard_memories = await self.memory_manager.memory.recall(
                    user_id=user_id,
                    memory_types=[MemoryType.FLASHCARD],
                    limit=50
                )
                
                # Analyze flashcard performance
                correct_count = 0
                total_count = 0
                weak_concepts = []
                strong_concepts = []
                topics = set()
                
                for memory in flashcard_memories:
                    total_count += 1
                    if memory.metadata.get("correct"):
                        correct_count += 1
                        concept = memory.metadata.get("concept") or memory.tags[0] if memory.tags else None
                        if concept:
                            strong_concepts.append(concept)
                    else:
                        concept = memory.metadata.get("concept") or memory.tags[0] if memory.tags else None
                        if concept:
                            weak_concepts.append(concept)
                    
                    topics.update(memory.tags)
                
                context["retention_rate"] = correct_count / max(total_count, 1)
                context["recent_topics"] = list(topics)[:10]
                context["weak_concepts"] = list(set(weak_concepts))[:10]
                context["strong_concepts"] = list(set(strong_concepts))[:10]
                
            except Exception as e:
                logger.error(f"Error getting flashcard context: {e}")
        
        # Get from database
        if self.db_session_factory:
            try:
                from models import FlashcardSet, Flashcard, FlashcardStudySession
                
                db = self.db_session_factory()
                try:
                    # Count sets and cards
                    sets = db.query(FlashcardSet).filter(FlashcardSet.user_id == int(user_id)).all()
                    context["total_sets"] = len(sets)
                    
                    total_cards = 0
                    mastered = 0
                    struggling = 0
                    
                    for s in sets:
                        cards = db.query(Flashcard).filter(Flashcard.set_id == s.id).all()
                        total_cards += len(cards)
                        for card in cards:
                            if card.times_reviewed > 0:
                                accuracy = card.correct_count / card.times_reviewed
                                if accuracy >= 0.8:
                                    mastered += 1
                                elif accuracy < 0.5:
                                    struggling += 1
                    
                    context["total_cards"] = total_cards
                    context["cards_mastered"] = mastered
                    context["cards_struggling"] = struggling
                    
                    # Recent study sessions
                    week_ago = datetime.utcnow() - timedelta(days=7)
                    sessions = db.query(FlashcardStudySession).filter(
                        FlashcardStudySession.user_id == int(user_id),
                        FlashcardStudySession.session_date >= week_ago
                    ).count()
                    context["study_sessions_this_week"] = sessions
                    
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error getting flashcard DB context: {e}")
        
        return context
    
    async def _get_quiz_context(self, user_id: str) -> Dict[str, Any]:
        """Get quiz-related context"""
        context = {
            "total_quizzes": 0,
            "average_score": 0.0,
            "weak_topics": [],
            "strong_topics": [],
            "recent_scores": [],
            "difficulty_performance": {}
        }
        
        if self.memory_manager:
            try:
                quiz_memories = await self.memory_manager.memory.recall(
                    user_id=user_id,
                    memory_types=[MemoryType.QUIZ],
                    limit=30
                )
                
                scores = []
                weak_topics = []
                strong_topics = []
                difficulty_scores = {"easy": [], "medium": [], "hard": []}
                
                for memory in quiz_memories:
                    score = memory.metadata.get("score", 0)
                    scores.append(score)
                    
                    topic = memory.metadata.get("topic", "")
                    if score < 0.6:
                        weak_topics.append(topic)
                        weak_topics.extend(memory.metadata.get("wrong_concepts", []))
                    elif score >= 0.8:
                        strong_topics.append(topic)
                    
                    difficulty = memory.metadata.get("difficulty", "medium")
                    if difficulty in difficulty_scores:
                        difficulty_scores[difficulty].append(score)
                
                context["total_quizzes"] = len(scores)
                context["average_score"] = sum(scores) / max(len(scores), 1)
                context["recent_scores"] = scores[:10]
                context["weak_topics"] = list(set(weak_topics))[:10]
                context["strong_topics"] = list(set(strong_topics))[:10]
                context["difficulty_performance"] = {
                    k: sum(v) / max(len(v), 1) for k, v in difficulty_scores.items() if v
                }
                
            except Exception as e:
                logger.error(f"Error getting quiz context: {e}")
        
        return context

    
    async def _get_chat_context(self, user_id: str) -> Dict[str, Any]:
        """Get chat/tutoring context"""
        context = {
            "total_conversations": 0,
            "topics_discussed": [],
            "questions_asked": 0,
            "confusion_topics": [],
            "interests": [],
            "learning_patterns": {}
        }
        
        if self.memory_manager:
            try:
                chat_memories = await self.memory_manager.memory.recall(
                    user_id=user_id,
                    memory_types=[MemoryType.CONVERSATION],
                    limit=50
                )
                
                topics = []
                confusion_topics = []
                
                for memory in chat_memories:
                    topics.extend(memory.tags)
                    
                    # Check for confusion indicators
                    content = memory.content.lower()
                    if any(word in content for word in ["confused", "don't understand", "help", "stuck"]):
                        confusion_topics.extend(memory.tags)
                
                context["total_conversations"] = len(chat_memories)
                context["topics_discussed"] = list(set(topics))[:15]
                context["confusion_topics"] = list(set(confusion_topics))[:10]
                
            except Exception as e:
                logger.error(f"Error getting chat context: {e}")
        
        # Get from database
        if self.db_session_factory:
            try:
                from models import ChatSession, Activity
                
                db = self.db_session_factory()
                try:
                    # Count sessions
                    sessions = db.query(ChatSession).filter(
                        ChatSession.user_id == int(user_id)
                    ).count()
                    context["total_conversations"] = max(context["total_conversations"], sessions)
                    
                    # Get activity topics
                    activities = db.query(Activity).filter(
                        Activity.user_id == int(user_id)
                    ).order_by(Activity.timestamp.desc()).limit(50).all()
                    
                    activity_topics = [a.topic for a in activities if a.topic]
                    context["interests"] = list(set(activity_topics))[:10]
                    context["questions_asked"] = len(activities)
                    
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error getting chat DB context: {e}")
        
        return context
    
    async def _get_notes_context(self, user_id: str) -> Dict[str, Any]:
        """Get notes-related context"""
        context = {
            "total_notes": 0,
            "recent_topics": [],
            "favorite_notes": 0,
            "notes_with_flashcards": 0
        }
        
        if self.db_session_factory:
            try:
                from models import Note
                
                db = self.db_session_factory()
                try:
                    notes = db.query(Note).filter(
                        Note.user_id == int(user_id),
                        Note.is_deleted == False
                    ).all()
                    
                    context["total_notes"] = len(notes)
                    context["favorite_notes"] = sum(1 for n in notes if n.is_favorite)
                    context["notes_with_flashcards"] = sum(1 for n in notes if n.flashcards)
                    
                    # Extract topics from titles
                    topics = [n.title for n in notes if n.title and n.title != "Untitled Note"]
                    context["recent_topics"] = topics[:10]
                    
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error getting notes context: {e}")
        
        return context
    
    async def _get_knowledge_graph_context(self, user_id: str) -> Dict[str, Any]:
        """Get context from the knowledge graph"""
        context = {
            "weak_concepts": [],
            "strong_concepts": [],
            "domain_mastery": {},
            "knowledge_gaps": [],
            "recommended_topics": [],
            "mastery_distribution": {},
            "total_concepts": 0,
            "average_mastery": 0.0
        }
        
        if not self.user_kg:
            return context
        
        try:
            # Get weak concepts from KG
            weak = await self.user_kg.get_weak_concepts(int(user_id), threshold=0.5, limit=10)
            context["weak_concepts"] = [
                {"concept": m.concept, "mastery": m.mastery_level, "classification": m.mastery_classification.value}
                for m in weak
            ]
            
            # Get strong concepts from KG
            strong = await self.user_kg.get_strong_concepts(int(user_id), threshold=0.7, limit=10)
            context["strong_concepts"] = [
                {"concept": m.concept, "mastery": m.mastery_level, "classification": m.mastery_classification.value}
                for m in strong
            ]
            
            # Get domain mastery
            context["domain_mastery"] = await self.user_kg.get_domain_mastery(int(user_id))
            
            # Get knowledge gaps
            context["knowledge_gaps"] = await self.user_kg.find_knowledge_gaps(int(user_id), limit=5)
            
            # Get recommended topics
            context["recommended_topics"] = await self.user_kg.get_recommended_topics(int(user_id), limit=5)
            
            # Get analytics summary
            analytics = await self.user_kg.get_learning_analytics(int(user_id))
            context["mastery_distribution"] = analytics.get("mastery_distribution", {})
            context["total_concepts"] = analytics.get("summary", {}).get("total_concepts", 0)
            context["average_mastery"] = analytics.get("summary", {}).get("average_mastery", 0.0)
            
        except Exception as e:
            logger.error(f"Error getting knowledge graph context: {e}")
        
        return context
    
    async def _aggregate_learning_state(
        self, 
        user_id: str, 
        agent_contexts: Dict[str, Dict],
        kg_context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Aggregate learning state from all agent contexts and knowledge graph"""
        kg_context = kg_context or {}
        
        state = {
            "weak_topics": [],
            "strong_topics": [],
            "topics_to_review": [],
            "current_focus": [],
            "mastery_levels": {},
            "knowledge_gaps": [],
            "domain_mastery": {},
            "learning_velocity": 0.0,
            "engagement_trend": "stable"
        }
        
        # Collect weak topics from all sources (including KG)
        all_weak = []
        all_weak.extend(agent_contexts.get("flashcard", {}).get("weak_concepts", []))
        all_weak.extend(agent_contexts.get("quiz", {}).get("weak_topics", []))
        all_weak.extend(agent_contexts.get("chat", {}).get("confusion_topics", []))
        
        # Add weak concepts from knowledge graph (higher priority)
        for wc in kg_context.get("weak_concepts", []):
            concept = wc.get("concept") if isinstance(wc, dict) else wc
            if concept:
                all_weak.append(concept)
                all_weak.append(concept)  # Double weight for KG data
        
        # Count frequency to prioritize
        weak_counts = {}
        for topic in all_weak:
            if topic:
                weak_counts[topic] = weak_counts.get(topic, 0) + 1
        
        state["weak_topics"] = sorted(weak_counts.keys(), key=lambda x: weak_counts[x], reverse=True)[:10]
        
        # Collect strong topics (including KG)
        all_strong = []
        all_strong.extend(agent_contexts.get("flashcard", {}).get("strong_concepts", []))
        all_strong.extend(agent_contexts.get("quiz", {}).get("strong_topics", []))
        
        # Add strong concepts from knowledge graph
        for sc in kg_context.get("strong_concepts", []):
            concept = sc.get("concept") if isinstance(sc, dict) else sc
            if concept:
                all_strong.append(concept)
        
        strong_counts = {}
        for topic in all_strong:
            if topic:
                strong_counts[topic] = strong_counts.get(topic, 0) + 1
        
        state["strong_topics"] = sorted(strong_counts.keys(), key=lambda x: strong_counts[x], reverse=True)[:10]
        
        # Knowledge gaps from KG
        state["knowledge_gaps"] = [
            g.get("concept") for g in kg_context.get("knowledge_gaps", [])
        ]
        
        # Domain mastery from KG
        state["domain_mastery"] = kg_context.get("domain_mastery", {})
        
        # Topics to review (weak but not recently studied)
        state["topics_to_review"] = state["weak_topics"][:5]
        
        # Current focus (intersection of interests and weak areas, or knowledge gaps)
        interests = agent_contexts.get("chat", {}).get("interests", [])
        state["current_focus"] = [t for t in state["weak_topics"] if t in interests][:3]
        if not state["current_focus"]:
            state["current_focus"] = state["weak_topics"][:3]
        
        # Get mastery levels from database
        if self.db_session_factory:
            try:
                from models import TopicMastery
                
                db = self.db_session_factory()
                try:
                    masteries = db.query(TopicMastery).filter(
                        TopicMastery.user_id == int(user_id)
                    ).all()
                    
                    for m in masteries:
                        state["mastery_levels"][m.topic_name] = {
                            "level": m.mastery_level,
                            "confidence": m.confidence_level,
                            "times_studied": m.times_studied
                        }
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Error getting mastery levels: {e}")
        
        return state

    
    def _calculate_performance_metrics(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate overall performance metrics"""
        metrics = {
            "overall_score": 0.0,
            "dimension_scores": {},
            "trend": "stable",
            "areas_of_concern": [],
            "areas_of_excellence": []
        }
        
        agent_contexts = context.get("agent_contexts", {})
        profile = context.get("profile", {})
        stats = profile.get("stats", {})
        
        # Knowledge dimension (quiz + flashcard accuracy)
        quiz_score = agent_contexts.get("quiz", {}).get("average_score", 0.5)
        flashcard_retention = agent_contexts.get("flashcard", {}).get("retention_rate", 0.5)
        knowledge_score = (quiz_score + flashcard_retention) / 2
        metrics["dimension_scores"]["knowledge"] = knowledge_score
        
        # Retention dimension
        retention_score = stats.get("retention_score", flashcard_retention)
        metrics["dimension_scores"]["retention"] = retention_score
        
        # Consistency dimension
        consistency = stats.get("consistency_rating", 0.5)
        study_sessions = agent_contexts.get("flashcard", {}).get("study_sessions_this_week", 0)
        consistency_score = min(1.0, (consistency + study_sessions / 7) / 2)
        metrics["dimension_scores"]["consistency"] = consistency_score
        
        # Engagement dimension
        total_activities = (
            agent_contexts.get("chat", {}).get("questions_asked", 0) +
            agent_contexts.get("quiz", {}).get("total_quizzes", 0) +
            agent_contexts.get("flashcard", {}).get("total_cards", 0)
        )
        engagement_score = min(1.0, total_activities / 100)
        metrics["dimension_scores"]["engagement"] = engagement_score
        
        # Overall score (weighted average)
        weights = {"knowledge": 0.35, "retention": 0.25, "consistency": 0.2, "engagement": 0.2}
        metrics["overall_score"] = sum(
            metrics["dimension_scores"].get(dim, 0) * weight 
            for dim, weight in weights.items()
        )
        
        # Identify areas of concern and excellence
        for dim, score in metrics["dimension_scores"].items():
            if score < 0.4:
                metrics["areas_of_concern"].append(dim)
            elif score >= 0.8:
                metrics["areas_of_excellence"].append(dim)
        
        return metrics
    
    def _generate_recommendations(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate personalized recommendations"""
        recommendations = []
        
        learning_state = context.get("learning_state", {})
        performance = context.get("performance", {})
        agent_contexts = context.get("agent_contexts", {})
        
        # Recommend based on weak topics
        weak_topics = learning_state.get("weak_topics", [])[:3]
        for topic in weak_topics:
            recommendations.append({
                "type": "study_topic",
                "topic": topic,
                "reason": "This topic needs more practice based on your quiz and flashcard performance",
                "priority": "high",
                "suggested_action": f"Create flashcards or take a quiz on {topic}"
            })
        
        # Recommend based on performance dimensions
        areas_of_concern = performance.get("areas_of_concern", [])
        
        if "consistency" in areas_of_concern:
            recommendations.append({
                "type": "habit",
                "reason": "Your study consistency could improve",
                "priority": "high",
                "suggested_action": "Try to study at least 15 minutes daily to build a habit"
            })
        
        if "retention" in areas_of_concern:
            recommendations.append({
                "type": "review",
                "reason": "Your retention rate is below optimal",
                "priority": "high",
                "suggested_action": "Use spaced repetition with flashcards to improve retention"
            })
        
        # Recommend based on quiz difficulty performance
        difficulty_perf = agent_contexts.get("quiz", {}).get("difficulty_performance", {})
        if difficulty_perf.get("hard", 1) < 0.5:
            recommendations.append({
                "type": "difficulty",
                "reason": "Struggling with hard questions",
                "priority": "medium",
                "suggested_action": "Focus on medium difficulty questions before attempting hard ones"
            })
        
        # Recommend based on engagement
        if performance.get("dimension_scores", {}).get("engagement", 1) < 0.3:
            recommendations.append({
                "type": "engagement",
                "reason": "Low engagement detected",
                "priority": "medium",
                "suggested_action": "Try exploring new topics or using different study methods"
            })
        
        return recommendations[:5]  # Limit to top 5 recommendations


# ==================== Insight Generator ====================

class LearningInsightGenerator:
    """Generates insights about user's learning journey"""
    
    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def generate_insights(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate learning insights from aggregated context"""
        insights = []
        
        learning_state = context.get("learning_state", {})
        performance = context.get("performance", {})
        profile = context.get("profile", {})
        
        # Insight: Learning style alignment
        learning_style = profile.get("learning_style", "")
        if learning_style:
            insights.append({
                "type": "learning_style",
                "title": "Learning Style",
                "insight": f"Your learning style is {learning_style}. We're adapting content to match.",
                "actionable": True,
                "action": "Explore study methods that align with your style"
            })
        
        # Insight: Weak areas
        weak_topics = learning_state.get("weak_topics", [])
        if weak_topics:
            insights.append({
                "type": "weak_areas",
                "title": "Areas Needing Attention",
                "insight": f"You're struggling with: {', '.join(weak_topics[:3])}",
                "actionable": True,
                "action": "Focus your next study session on these topics"
            })
        
        # Insight: Strengths
        strong_topics = learning_state.get("strong_topics", [])
        if strong_topics:
            insights.append({
                "type": "strengths",
                "title": "Your Strengths",
                "insight": f"You're excelling at: {', '.join(strong_topics[:3])}",
                "actionable": False
            })
        
        # Insight: Performance trend
        overall_score = performance.get("overall_score", 0.5)
        if overall_score >= 0.8:
            insights.append({
                "type": "performance",
                "title": "Excellent Progress",
                "insight": "You're performing above average! Keep up the great work.",
                "actionable": False
            })
        elif overall_score < 0.4:
            insights.append({
                "type": "performance",
                "title": "Room for Improvement",
                "insight": "Your performance could improve. Let's focus on fundamentals.",
                "actionable": True,
                "action": "Start with easier content and build up gradually"
            })
        
        # Insight: Study consistency
        dimension_scores = performance.get("dimension_scores", {})
        consistency = dimension_scores.get("consistency", 0.5)
        if consistency < 0.4:
            insights.append({
                "type": "consistency",
                "title": "Study Consistency",
                "insight": "Regular study sessions lead to better retention.",
                "actionable": True,
                "action": "Set a daily study reminder"
            })
        
        return insights
    
    async def generate_ai_insights(self, context: Dict[str, Any]) -> str:
        """Generate AI-powered personalized insights"""
        prompt = f"""Analyze this student's learning data and provide 3 personalized insights:

Profile:
- Field of study: {context.get('profile', {}).get('field_of_study', 'Not specified')}
- Learning style: {context.get('profile', {}).get('learning_style', 'Not specified')}

Performance:
- Overall score: {context.get('performance', {}).get('overall_score', 0.5):.0%}
- Knowledge: {context.get('performance', {}).get('dimension_scores', {}).get('knowledge', 0.5):.0%}
- Retention: {context.get('performance', {}).get('dimension_scores', {}).get('retention', 0.5):.0%}
- Consistency: {context.get('performance', {}).get('dimension_scores', {}).get('consistency', 0.5):.0%}

Weak topics: {', '.join(context.get('learning_state', {}).get('weak_topics', [])[:5])}
Strong topics: {', '.join(context.get('learning_state', {}).get('strong_topics', [])[:5])}

Provide 3 brief, actionable insights (2-3 sentences each):"""

        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.7)
            return response.strip()
        except Exception as e:
            logger.error(f"AI insight generation failed: {e}")
            return "Unable to generate personalized insights at this time."


# ==================== Main Master Agent ====================

class MasterAgent(BaseAgent):
    """
    Master Agent - The Central Intelligence Hub
    
    Responsibilities:
    - Aggregate context from all specialized agents
    - Build comprehensive user learning profiles
    - Identify weak topics and areas needing attention
    - Generate personalized recommendations
    - Coordinate agent activities
    - Provide unified view of user's learning state
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        user_knowledge_graph: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.user_knowledge_graph = user_knowledge_graph
        self.aggregator = UserContextAggregator(
            self.memory_manager, 
            db_session_factory, 
            user_knowledge_graph
        )
        self.insight_generator = LearningInsightGenerator(ai_client)
        
        # Register as ORCHESTRATOR type since it manages other agents
        super().__init__(
            agent_type=AgentType.ORCHESTRATOR,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
        logger.info("Master Agent initialized")
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(MasterAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("aggregate_context", self._aggregate_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("get_profile", self._get_user_profile)
        graph.add_node("analyze_weaknesses", self._analyze_weaknesses)
        graph.add_node("analyze_strengths", self._analyze_strengths)
        graph.add_node("generate_insights", self._generate_insights)
        graph.add_node("generate_recommendations", self._generate_recommendations)
        graph.add_node("get_full_context", self._get_full_context)
        
        # Finalization
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "aggregate_context")
        graph.add_edge("aggregate_context", "route_action")
        
        # Conditional routing based on action
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "profile": "get_profile",
                "weaknesses": "analyze_weaknesses",
                "strengths": "analyze_strengths",
                "insights": "generate_insights",
                "recommendations": "generate_recommendations",
                "full_context": "get_full_context",
                "error": "handle_error"
            }
        )
        
        # All actions lead to format_response
        graph.add_edge("get_profile", "format_response")
        graph.add_edge("analyze_weaknesses", "format_response")
        graph.add_edge("analyze_strengths", "format_response")
        graph.add_edge("generate_insights", "format_response")
        graph.add_edge("generate_recommendations", "format_response")
        graph.add_edge("get_full_context", "format_response")
        
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        logger.info("Master Agent graph compiled")
    
    # ==================== Graph Nodes ====================
    
    async def _parse_request(self, state: MasterAgentState) -> MasterAgentState:
        """Parse the request to determine action"""
        user_input = state.get("user_input", "").lower()
        action_params = state.get("action_params", {})
        
        state["execution_path"] = ["master:parse"]
        
        # If action is explicitly provided
        if state.get("action"):
            return state
        
        # Detect action from natural language
        if any(word in user_input for word in ["profile", "about me", "my info"]):
            state["action"] = MasterAction.GET_USER_PROFILE.value
        elif any(word in user_input for word in ["weak", "struggling", "need help", "improve"]):
            state["action"] = MasterAction.GET_WEAK_TOPICS.value
        elif any(word in user_input for word in ["strong", "good at", "excel", "best"]):
            state["action"] = MasterAction.GET_STRONG_TOPICS.value
        elif any(word in user_input for word in ["insight", "analysis", "progress"]):
            state["action"] = MasterAction.GET_LEARNING_INSIGHTS.value
        elif any(word in user_input for word in ["recommend", "suggest", "what should"]):
            state["action"] = MasterAction.GET_RECOMMENDATIONS.value
        else:
            state["action"] = MasterAction.GET_FULL_CONTEXT.value
        
        return state

    
    async def _aggregate_context(self, state: MasterAgentState) -> MasterAgentState:
        """Aggregate context from all sources"""
        user_id = state.get("user_id")
        
        try:
            full_context = await self.aggregator.get_full_user_context(user_id)
            
            state["user_profile"] = full_context.get("profile", {})
            state["learning_state"] = full_context.get("learning_state", {})
            state["flashcard_context"] = full_context.get("agent_contexts", {}).get("flashcard", {})
            state["quiz_context"] = full_context.get("agent_contexts", {}).get("quiz", {})
            state["chat_context"] = full_context.get("agent_contexts", {}).get("chat", {})
            state["notes_context"] = full_context.get("agent_contexts", {}).get("notes", {})
            state["overall_performance"] = full_context.get("performance", {})
            state["recommendations"] = full_context.get("recommendations", [])
            
            # Extract weak and strong topics
            state["weak_topics"] = [
                {"topic": t, "source": "aggregated"} 
                for t in full_context.get("learning_state", {}).get("weak_topics", [])
            ]
            state["strong_topics"] = [
                {"topic": t, "source": "aggregated"} 
                for t in full_context.get("learning_state", {}).get("strong_topics", [])
            ]
            
            logger.info(f"Aggregated context for user {user_id}")
            
        except Exception as e:
            logger.error(f"Context aggregation failed: {e}")
            state["errors"] = state.get("errors", []) + [str(e)]
        
        state["execution_path"].append("master:aggregate")
        return state
    
    def _get_action_route(self, state: MasterAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", MasterAction.GET_FULL_CONTEXT.value)
        
        if action == MasterAction.GET_USER_PROFILE.value:
            return "profile"
        elif action == MasterAction.GET_WEAK_TOPICS.value:
            return "weaknesses"
        elif action == MasterAction.GET_STRONG_TOPICS.value:
            return "strengths"
        elif action == MasterAction.GET_LEARNING_INSIGHTS.value:
            return "insights"
        elif action == MasterAction.GET_RECOMMENDATIONS.value:
            return "recommendations"
        else:
            return "full_context"
    
    async def _route_action(self, state: MasterAgentState) -> MasterAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"master:route:{state.get('action')}")
        return state
    
    async def _get_user_profile(self, state: MasterAgentState) -> MasterAgentState:
        """Get comprehensive user profile"""
        profile = state.get("user_profile", {})
        learning_state = state.get("learning_state", {})
        performance = state.get("overall_performance", {})
        
        # Build comprehensive profile response
        profile_data = {
            "basic_info": {
                "name": profile.get("name", ""),
                "field_of_study": profile.get("field_of_study", ""),
                "learning_style": profile.get("learning_style", ""),
                "school": profile.get("school_university", "")
            },
            "learning_preferences": profile.get("preferences", {}),
            "personality": profile.get("personality", {}),
            "stats": profile.get("stats", {}),
            "current_focus": learning_state.get("current_focus", []),
            "performance_summary": {
                "overall_score": performance.get("overall_score", 0),
                "dimension_scores": performance.get("dimension_scores", {}),
                "areas_of_excellence": performance.get("areas_of_excellence", []),
                "areas_of_concern": performance.get("areas_of_concern", [])
            }
        }
        
        state["response_data"] = {
            "action": "get_user_profile",
            "profile": profile_data
        }
        
        # Generate natural language summary
        name = profile.get("name", "Student")
        field = profile.get("field_of_study", "various subjects")
        score = performance.get("overall_score", 0.5)
        
        state["final_response"] = f"""Here's your learning profile:

**{name}**
- Field of Study: {field}
- Learning Style: {profile.get('learning_style', 'Not specified')}
- Overall Performance: {score:.0%}

**Current Focus Areas:** {', '.join(learning_state.get('current_focus', ['General learning']))}

**Strengths:** {', '.join(learning_state.get('strong_topics', ['Building knowledge'])[:3])}

**Areas to Improve:** {', '.join(learning_state.get('weak_topics', ['Keep practicing'])[:3])}
"""
        
        state["execution_path"].append("master:profile")
        return state
    
    async def _analyze_weaknesses(self, state: MasterAgentState) -> MasterAgentState:
        """Analyze user's weak topics in detail"""
        weak_topics = state.get("weak_topics", [])
        learning_state = state.get("learning_state", {})
        flashcard_ctx = state.get("flashcard_context", {})
        quiz_ctx = state.get("quiz_context", {})
        
        # Detailed weakness analysis
        weakness_analysis = {
            "weak_topics": [t["topic"] for t in weak_topics],
            "sources": {
                "flashcards": flashcard_ctx.get("weak_concepts", []),
                "quizzes": quiz_ctx.get("weak_topics", []),
                "chat": state.get("chat_context", {}).get("confusion_topics", [])
            },
            "priority_topics": learning_state.get("topics_to_review", []),
            "suggested_actions": []
        }
        
        # Generate suggested actions for each weak topic
        for topic in weakness_analysis["weak_topics"][:5]:
            weakness_analysis["suggested_actions"].append({
                "topic": topic,
                "actions": [
                    f"Create flashcards on {topic}",
                    f"Take a practice quiz on {topic}",
                    f"Ask the tutor to explain {topic}"
                ]
            })
        
        state["response_data"] = {
            "action": "analyze_weaknesses",
            "analysis": weakness_analysis
        }
        
        topics_str = ', '.join(weakness_analysis["weak_topics"][:5]) or "No specific weak areas identified"
        state["final_response"] = f"""**Areas Needing Attention:**

{topics_str}

**Recommended Actions:**
1. Focus your next study session on these topics
2. Create flashcards to reinforce key concepts
3. Take practice quizzes to test your understanding
4. Ask the AI tutor for detailed explanations

**Priority:** Start with {weakness_analysis['priority_topics'][0] if weakness_analysis['priority_topics'] else 'any topic above'}
"""
        
        state["execution_path"].append("master:weaknesses")
        return state

    
    async def _analyze_strengths(self, state: MasterAgentState) -> MasterAgentState:
        """Analyze user's strong topics"""
        strong_topics = state.get("strong_topics", [])
        flashcard_ctx = state.get("flashcard_context", {})
        quiz_ctx = state.get("quiz_context", {})
        
        strength_analysis = {
            "strong_topics": [t["topic"] for t in strong_topics],
            "sources": {
                "flashcards": flashcard_ctx.get("strong_concepts", []),
                "quizzes": quiz_ctx.get("strong_topics", [])
            },
            "mastery_levels": state.get("learning_state", {}).get("mastery_levels", {}),
            "suggestions": [
                "Challenge yourself with harder questions on these topics",
                "Help others learn these topics to reinforce your knowledge",
                "Explore advanced concepts in these areas"
            ]
        }
        
        state["response_data"] = {
            "action": "analyze_strengths",
            "analysis": strength_analysis
        }
        
        topics_str = ', '.join(strength_analysis["strong_topics"][:5]) or "Keep building your knowledge!"
        state["final_response"] = f"""**Your Strengths:**

{topics_str}

**Great job!** You're showing strong understanding in these areas.

**Next Steps:**
- Challenge yourself with harder questions
- Explore advanced concepts
- Use your strengths to tackle related topics
"""
        
        state["execution_path"].append("master:strengths")
        return state
    
    async def _generate_insights(self, state: MasterAgentState) -> MasterAgentState:
        """Generate learning insights"""
        context = {
            "profile": state.get("user_profile", {}),
            "learning_state": state.get("learning_state", {}),
            "performance": state.get("overall_performance", {})
        }
        
        # Generate structured insights
        insights = self.insight_generator.generate_insights(context)
        
        # Generate AI-powered insights
        ai_insights = await self.insight_generator.generate_ai_insights(context)
        
        state["response_data"] = {
            "action": "generate_insights",
            "insights": insights,
            "ai_insights": ai_insights,
            "performance_summary": state.get("overall_performance", {})
        }
        
        # Format insights for response
        insights_text = "\n".join([
            f"• **{i['title']}**: {i['insight']}" for i in insights
        ])
        
        state["final_response"] = f"""**Learning Insights:**

{insights_text}

**Personalized Analysis:**
{ai_insights}
"""
        
        state["execution_path"].append("master:insights")
        return state
    
    async def _generate_recommendations(self, state: MasterAgentState) -> MasterAgentState:
        """Generate personalized recommendations"""
        recommendations = state.get("recommendations", [])
        
        # Add priority actions
        priority_actions = []
        for rec in recommendations:
            if rec.get("priority") == "high":
                priority_actions.append(rec)
        
        state["priority_actions"] = priority_actions
        
        state["response_data"] = {
            "action": "generate_recommendations",
            "recommendations": recommendations,
            "priority_actions": priority_actions
        }
        
        # Format recommendations
        rec_text = "\n".join([
            f"• **{rec.get('type', 'Tip').title()}**: {rec.get('suggested_action', rec.get('reason', ''))}"
            for rec in recommendations
        ])
        
        state["final_response"] = f"""**Personalized Recommendations:**

{rec_text if rec_text else "Keep up the great work! Continue with your current study plan."}

**Priority Actions:**
{chr(10).join([f"1. {a.get('suggested_action', '')}" for a in priority_actions[:3]]) if priority_actions else "No urgent actions needed."}
"""
        
        state["execution_path"].append("master:recommendations")
        return state
    
    async def _get_full_context(self, state: MasterAgentState) -> MasterAgentState:
        """Get full aggregated context"""
        state["response_data"] = {
            "action": "get_full_context",
            "user_profile": state.get("user_profile", {}),
            "learning_state": state.get("learning_state", {}),
            "agent_contexts": {
                "flashcard": state.get("flashcard_context", {}),
                "quiz": state.get("quiz_context", {}),
                "chat": state.get("chat_context", {}),
                "notes": state.get("notes_context", {})
            },
            "performance": state.get("overall_performance", {}),
            "weak_topics": [t["topic"] for t in state.get("weak_topics", [])],
            "strong_topics": [t["topic"] for t in state.get("strong_topics", [])],
            "recommendations": state.get("recommendations", [])
        }
        
        # Generate summary
        performance = state.get("overall_performance", {})
        learning_state = state.get("learning_state", {})
        
        state["final_response"] = f"""**Your Learning Dashboard:**

📊 **Overall Performance:** {performance.get('overall_score', 0.5):.0%}

📈 **Dimension Scores:**
- Knowledge: {performance.get('dimension_scores', {}).get('knowledge', 0.5):.0%}
- Retention: {performance.get('dimension_scores', {}).get('retention', 0.5):.0%}
- Consistency: {performance.get('dimension_scores', {}).get('consistency', 0.5):.0%}
- Engagement: {performance.get('dimension_scores', {}).get('engagement', 0.5):.0%}

🎯 **Focus Areas:** {', '.join(learning_state.get('current_focus', ['General learning'])[:3])}

⚠️ **Needs Attention:** {', '.join(learning_state.get('weak_topics', [])[:3]) or 'None identified'}

✅ **Strengths:** {', '.join(learning_state.get('strong_topics', [])[:3]) or 'Building knowledge'}
"""
        
        state["execution_path"].append("master:full_context")
        return state

    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process input - handled by _parse_request"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Core logic - handled by action nodes"""
        return state
    
    async def _format_response(self, state: MasterAgentState) -> MasterAgentState:
        """Format the final response"""
        state["response_metadata"] = {
            "success": True,
            "action": state.get("action"),
            "execution_path": state.get("execution_path", []),
            "timestamp": datetime.utcnow().isoformat(),
            "response_data": state.get("response_data", {})
        }
        
        return state
    
    async def _handle_error(self, state: MasterAgentState) -> MasterAgentState:
        """Handle errors"""
        errors = state.get("errors", [])
        
        state["final_response"] = f"I encountered an issue gathering your learning data: {'; '.join(errors)}"
        state["response_metadata"] = {
            "success": False,
            "errors": errors,
            "execution_path": state.get("execution_path", [])
        }
        
        return state


# ==================== Factory Function ====================

def create_master_agent(
    ai_client,
    knowledge_graph=None,
    memory_manager=None,
    db_session_factory=None,
    user_knowledge_graph=None
) -> MasterAgent:
    """Factory function to create the Master Agent"""
    return MasterAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory,
        user_knowledge_graph=user_knowledge_graph
    )
