"""
Enhanced SearchHub Agent - Smart Assistant with NLP Understanding
Like a personal AI assistant that understands natural language commands.

Features:
- Natural language understanding (NLP-based)
- Context-aware conversations
- Semantic intent matching
- Multi-language support
- Conversational memory
- Smart suggestions
- Proactive recommendations
"""

import logging
import json
import re
import random
import string
from typing import Dict, Any, List, Optional, TypedDict
from datetime import datetime
from enum import Enum

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .base_agent import BaseAgent, AgentState, AgentType, AgentResponse, agent_registry
from .memory import MemoryManager, get_memory_manager
from .nlp_engine import NLPEngine, get_nlp_engine, IntentMatch, INTENT_DEFINITIONS

logger = logging.getLogger(__name__)


# ==================== Knowledge Graph Integration ====================

class KnowledgeGraphIntegration:
    """Integrates knowledge graph data into SearchHub responses"""
    
    def __init__(self, user_knowledge_graph=None, master_agent=None):
        self.user_kg = user_knowledge_graph
        self.master_agent = master_agent
    
    async def get_weak_areas(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get user's weak areas from knowledge graph"""
        result = {
            "weak_concepts": [],
            "domain_weaknesses": {},
            "recommendations": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            weak = await self.user_kg.get_weak_concepts(user_id, threshold=0.5, limit=limit)
            result["weak_concepts"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "classification": m.mastery_classification.value,
                    "review_count": m.review_count,
                    "streak": m.streak
                }
                for m in weak
            ]
            
            domain_mastery = await self.user_kg.get_domain_mastery(user_id)
            result["domain_weaknesses"] = {
                domain: data for domain, data in domain_mastery.items()
                if data.get("average_mastery", 1.0) < 0.5
            }
            
            for concept_data in result["weak_concepts"][:5]:
                result["recommendations"].append({
                    "action": f"create flashcards on {concept_data['concept']}",
                    "reason": f"Your mastery is {concept_data['mastery']:.0%} - needs practice"
                })
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get weak areas: {e}")
        
        return result
    
    async def get_strong_areas(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get user's strong areas from knowledge graph"""
        result = {
            "strong_concepts": [],
            "domain_strengths": {},
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            strong = await self.user_kg.get_strong_concepts(user_id, threshold=0.7, limit=limit)
            result["strong_concepts"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "classification": m.mastery_classification.value,
                    "review_count": m.review_count,
                    "streak": m.streak
                }
                for m in strong
            ]
            
            domain_mastery = await self.user_kg.get_domain_mastery(user_id)
            result["domain_strengths"] = {
                domain: data for domain, data in domain_mastery.items()
                if data.get("average_mastery", 0) >= 0.7
            }
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get strong areas: {e}")
        
        return result
    
    async def get_knowledge_gaps(self, user_id: int, limit: int = 10) -> Dict[str, Any]:
        """Find knowledge gaps"""
        result = {
            "gaps": [],
            "recommended_learning_path": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            gaps = await self.user_kg.find_knowledge_gaps(user_id, limit=limit)
            result["gaps"] = gaps
            
            for gap in gaps[:5]:
                result["recommended_learning_path"].append({
                    "concept": gap.get("concept"),
                    "reason": gap.get("reason", "Based on your current knowledge"),
                    "action": f"explain {gap.get('concept')}"
                })
            
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get knowledge gaps: {e}")
        
        return result
    
    async def get_concepts_to_review(self, user_id: int, days: int = 7, limit: int = 10) -> Dict[str, Any]:
        """Get concepts that need review"""
        result = {
            "concepts_to_review": [],
            "overdue_count": 0,
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            concepts = await self.user_kg.get_concepts_needing_review(user_id, days, limit)
            result["concepts_to_review"] = [
                {
                    "concept": m.concept,
                    "mastery": round(m.mastery_level, 2),
                    "last_reviewed": m.last_reviewed.isoformat() if m.last_reviewed else "Never"
                }
                for m in concepts
            ]
            result["overdue_count"] = len(concepts)
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get concepts to review: {e}")
        
        return result
    
    async def get_learning_analytics(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive learning analytics"""
        result = {
            "summary": {},
            "mastery_distribution": {},
            "domain_breakdown": {},
            "recommendations": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            analytics = await self.user_kg.get_learning_analytics(user_id)
            result.update(analytics)
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get learning analytics: {e}")
        
        return result
    
    async def get_recommended_topics(self, user_id: int, limit: int = 5) -> Dict[str, Any]:
        """Get recommended topics"""
        result = {
            "recommended_topics": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            topics = await self.user_kg.get_recommended_topics(user_id, limit)
            result["recommended_topics"] = topics
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get recommended topics: {e}")
        
        return result
    
    async def get_learning_path(self, user_id: int, topic: str) -> Dict[str, Any]:
        """Get personalized learning path for a topic"""
        result = {
            "topic": topic,
            "concepts": [],
            "estimated_time_hours": 0,
            "prerequisites_met": True,
            "missing_prerequisites": [],
            "success": False
        }
        
        if not self.user_kg:
            return result
        
        try:
            path = await self.user_kg.get_learning_path(user_id, topic)
            result["concepts"] = path.concepts
            result["estimated_time_hours"] = path.estimated_time_hours
            result["prerequisites_met"] = path.prerequisites_met
            result["missing_prerequisites"] = path.missing_prerequisites
            result["difficulty"] = path.difficulty
            result["success"] = True
            
        except Exception as e:
            logger.error(f"Failed to get learning path: {e}")
        
        return result
    
    async def get_full_user_context(self, user_id: str) -> Dict[str, Any]:
        """Get full user context from master agent"""
        if not self.master_agent:
            return {}
        
        try:
            context = await self.master_agent.aggregator.get_full_user_context(user_id)
            return context
        except Exception as e:
            logger.error(f"Failed to get full user context: {e}")
            return {}


# ==================== State Definition ====================

class EnhancedSearchHubState(TypedDict, total=False):
    """State for the Enhanced SearchHub agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # NLP Understanding
    intent_match: Dict[str, Any]
    detected_intent: str
    confidence: float
    extracted_entities: Dict[str, Any]
    language: str
    context_used: bool
    
    # Content creation
    created_content: Dict[str, Any]
    content_id: int
    content_type: str
    
    # Search results
    search_results: List[Dict[str, Any]]
    search_query: str
    
    # AI generation
    ai_response: str
    ai_suggestions: List[str]
    related_topics: List[str]
    
    # Knowledge Graph data
    kg_data: Dict[str, Any]
    
    # Navigation
    navigate_to: str
    navigate_params: Dict[str, Any]
    
    # Memory context
    memory_context: Dict[str, Any]
    user_preferences: Dict[str, Any]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Content Creator ====================

class ContentCreator:
    """Creates content with AI-generated content"""
    
    NOTE_PROMPT = """Write a comprehensive, detailed study note about this topic.

Topic: {topic}

Create a well-structured educational article with:
1. A clear introduction explaining what {topic} is
2. 3-4 main sections covering key aspects
3. Practical examples where relevant
4. A summary of key takeaways

Use HTML formatting:
- <h2> for main headings
- <h3> for subheadings  
- <p> for paragraphs
- <ul><li> for bullet points
- <strong> for important terms

Write detailed, educational content (at least 500 words):"""

    FLASHCARD_PROMPT = """Generate {count} high-quality flashcards about this topic.

Topic: {topic}

Create flashcards that:
1. Cover key concepts progressively (basic to advanced)
2. Have clear, specific questions
3. Have concise but complete answers
4. Test understanding, not just memorization

Return ONLY valid JSON:
{{
  "flashcards": [
    {{"question": "What is...?", "answer": "...", "difficulty": "easy"}},
    {{"question": "How does...?", "answer": "...", "difficulty": "medium"}},
    {{"question": "Why is...?", "answer": "...", "difficulty": "hard"}}
  ]
}}"""

    QUESTION_PROMPT = """Generate {count} multiple-choice questions about this topic.

Topic: {topic}

Create questions that:
1. Test understanding at different levels
2. Have 4 plausible options each
3. Include clear explanations for the correct answer

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "...",
      "difficulty": "medium"
    }}
  ]
}}"""

    def __init__(self, ai_client, db_session_factory):
        self.ai_client = ai_client
        self.db_session_factory = db_session_factory
    
    def _generate_share_code(self) -> str:
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    def _parse_json(self, response: str) -> Any:
        json_str = response.strip()
        
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0]
        
        match = re.search(r'[\[{][\s\S]*[\]}]', json_str)
        if match:
            return json.loads(match.group())
        
        return {}
    
    async def create_note(self, user_id: str, topic: str) -> Dict[str, Any]:
        """Create a note with AI-generated content"""
        logger.info(f"Creating note for user {user_id} on topic: {topic}")
        
        prompt = self.NOTE_PROMPT.format(topic=topic)
        content = self.ai_client.generate(prompt, max_tokens=2000, temperature=0.7)
        
        if not content.strip().startswith('<'):
            content = f"<p>{content}</p>"
        
        db = self.db_session_factory()
        try:
            from models import Note, User
            
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            note = Note(
                user_id=actual_user_id,
                title=f"Study Notes: {topic.title()}",
                content=content,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(note)
            db.commit()
            db.refresh(note)
            
            return {
                "success": True,
                "content_type": "note",
                "content_id": note.id,
                "title": note.title,
                "content_preview": content[:500],
                "navigate_to": f"/notes/editor/{note.id}",
                "message": f"Created note '{note.title}' with comprehensive content about {topic}"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create note: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()
    
    async def create_flashcards(self, user_id: str, topic: str, count: int = 10) -> Dict[str, Any]:
        """Create flashcards with AI-generated content"""
        logger.info(f"Creating {count} flashcards for user {user_id} on topic: {topic}")
        
        # Helper function to create clean title
        def create_clean_title(topic_text: str, content_type: str = "Flashcards") -> str:
            """Create a clean, properly formatted title from topic text"""
            # Remove common prefixes
            cleaned = topic_text.lower().strip()
            cleaned = cleaned.replace('create flashcards on', '').replace('flashcards on', '')
            cleaned = cleaned.replace('create notes on', '').replace('notes on', '')
            cleaned = cleaned.replace('create questions on', '').replace('questions on', '')
            cleaned = cleaned.replace('explain', '').replace('about', '').strip()
            
            # Capitalize first letter of each major word (but not articles/prepositions)
            words = cleaned.split()
            minor_words = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'}
            
            title_words = []
            for i, word in enumerate(words):
                if i == 0 or word not in minor_words:
                    title_words.append(word.capitalize())
                else:
                    title_words.append(word)
            
            clean_topic = ' '.join(title_words)
            return f"{clean_topic} {content_type}"
        
        prompt = self.FLASHCARD_PROMPT.format(topic=topic, count=count)
        response = self.ai_client.generate(prompt, max_tokens=3000, temperature=0.7)
        
        data = self._parse_json(response)
        cards = data.get("flashcards", []) if isinstance(data, dict) else data
        
        if not cards:
            return {"error": "Failed to generate flashcards", "success": False}
        
        db = self.db_session_factory()
        try:
            from models import FlashcardSet, Flashcard, User
            
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            # Create clean title
            clean_title = create_clean_title(topic, "Flashcards")
            
            flashcard_set = FlashcardSet(
                user_id=actual_user_id,
                title=clean_title,
                description=f"Flashcards covering key concepts of {topic}",
                source_type="ai_generated",
                share_code=self._generate_share_code(),
                is_public=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(flashcard_set)
            db.flush()
            
            for card in cards[:count]:
                if "question" in card and "answer" in card:
                    flashcard = Flashcard(
                        set_id=flashcard_set.id,
                        question=card["question"],
                        answer=card["answer"][:400],
                        difficulty=card.get("difficulty", "medium"),
                        created_at=datetime.utcnow()
                    )
                    db.add(flashcard)
            
            db.commit()
            db.refresh(flashcard_set)
            
            return {
                "success": True,
                "content_type": "flashcard_set",
                "content_id": flashcard_set.id,
                "title": flashcard_set.title,
                "card_count": len(cards),
                "cards_preview": cards[:3],
                "navigate_to": f"/flashcards?set_id={flashcard_set.id}",
                "message": f"Created '{flashcard_set.title}' with {len(cards)} flashcards"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create flashcards: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()
    
    async def create_questions(self, user_id: str, topic: str, count: int = 10) -> Dict[str, Any]:
        """Create questions with AI-generated content"""
        logger.info(f"Creating {count} questions for user {user_id} on topic: {topic}")
        
        # Helper function to create clean title
        def create_clean_title(topic_text: str, content_type: str = "Questions") -> str:
            """Create a clean, properly formatted title from topic text"""
            # Remove common prefixes
            cleaned = topic_text.lower().strip()
            cleaned = cleaned.replace('create flashcards on', '').replace('flashcards on', '')
            cleaned = cleaned.replace('create notes on', '').replace('notes on', '')
            cleaned = cleaned.replace('create questions on', '').replace('questions on', '')
            cleaned = cleaned.replace('explain', '').replace('about', '').strip()
            
            # Capitalize first letter of each major word (but not articles/prepositions)
            words = cleaned.split()
            minor_words = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'}
            
            title_words = []
            for i, word in enumerate(words):
                if i == 0 or word not in minor_words:
                    title_words.append(word.capitalize())
                else:
                    title_words.append(word)
            
            clean_topic = ' '.join(title_words)
            return f"{clean_topic} {content_type}"
        
        prompt = self.QUESTION_PROMPT.format(topic=topic, count=count)
        response = self.ai_client.generate(prompt, max_tokens=3000, temperature=0.7)
        
        data = self._parse_json(response)
        questions = data.get("questions", []) if isinstance(data, dict) else data
        
        if not questions:
            return {"error": "Failed to generate questions", "success": False}
        
        db = self.db_session_factory()
        try:
            from models import User, QuestionSet, Question
            
            actual_user_id = user_id
            if isinstance(user_id, str) and not user_id.isdigit():
                user = db.query(User).filter(User.username == user_id).first()
                if user:
                    actual_user_id = user.id
                else:
                    return {"error": "User not found", "success": False}
            elif isinstance(user_id, str):
                actual_user_id = int(user_id)
            
            # Create clean title
            clean_title = create_clean_title(topic, "Questions")
            
            question_set = QuestionSet(
                user_id=actual_user_id,
                title=clean_title,
                description=f"Practice questions about {topic}",
                source_type="ai_generated",
                total_questions=len(questions[:count]),
                created_at=datetime.utcnow()
            )
            db.add(question_set)
            db.flush()
            
            for q in questions[:count]:
                if "question" in q and "options" in q:
                    question = Question(
                        question_set_id=question_set.id,
                        question_text=q["question"],
                        question_type="multiple_choice",
                        options=json.dumps(q["options"]),
                        correct_answer=q.get("correct_answer", "A"),
                        explanation=q.get("explanation", ""),
                        difficulty=q.get("difficulty", "medium"),
                        topic=topic
                    )
                    db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "success": True,
                "content_type": "question_set",
                "content_id": question_set.id,
                "title": question_set.title,
                "question_count": len(questions),
                "questions_preview": questions[:2],
                "navigate_to": f"/question-bank?set_id={question_set.id}",
                "message": f"Created '{question_set.title}' with {len(questions)} practice questions"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create questions: {e}")
            return {"error": str(e), "success": False}
        finally:
            db.close()


# ==================== Topic Explorer ====================

class TopicExplorer:
    """Explores and explains topics with AI"""
    
    EXPLAIN_PROMPT = """Explain this topic clearly and comprehensively for a student.

Topic: {topic}

Provide:
1. A clear definition/introduction
2. Key concepts and principles
3. Real-world examples or applications
4. Common misconceptions to avoid
5. Related topics to explore next

Write in an engaging, educational style. Use markdown for formatting."""

    SUMMARY_PROMPT = """Provide a concise summary of this topic.

Topic: {topic}

Include:
- What it is (1-2 sentences)
- Why it matters
- 3-5 key points
- One practical example

Keep it brief but informative."""

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def explain(self, topic: str, depth: str = "standard") -> Dict[str, Any]:
        """Generate a detailed explanation of a topic"""
        prompt = self.EXPLAIN_PROMPT.format(topic=topic)
        max_tokens = {"surface": 500, "standard": 1000, "deep": 1500}.get(depth, 1000)
        
        try:
            explanation = self.ai_client.generate(prompt, max_tokens=max_tokens, temperature=0.7)
            
            suggestions = [
                f"create flashcards on {topic}",
                f"create a note on {topic}",
                f"quiz me on {topic}",
                f"what are the key concepts of {topic}"
            ]
            
            related = self._extract_related_topics(explanation, topic)
            
            return {
                "success": True,
                "explanation": explanation,
                "topic": topic,
                "suggestions": suggestions,
                "related_topics": related
            }
            
        except Exception as e:
            logger.error(f"Topic explanation failed: {e}")
            return {"success": False, "error": str(e)}
    
    def summarize(self, topic: str) -> Dict[str, Any]:
        """Generate a brief summary of a topic"""
        prompt = self.SUMMARY_PROMPT.format(topic=topic)
        
        try:
            summary = self.ai_client.generate(prompt, max_tokens=400, temperature=0.7)
            return {"success": True, "summary": summary, "topic": topic}
        except Exception as e:
            logger.error(f"Topic summary failed: {e}")
            return {"success": False, "error": str(e)}
    
    def _extract_related_topics(self, text: str, original_topic: str) -> List[str]:
        """Extract related topics from explanation text"""
        topics = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        filtered = list(set([t for t in topics if t.lower() != original_topic.lower() and len(t) > 3]))
        return filtered[:5]


# ==================== Content Searcher ====================

class ContentSearcher:
    """Searches across all content types"""
    
    def __init__(self, db_session_factory, ai_client=None):
        self.db_session_factory = db_session_factory
        self.ai_client = ai_client
    
    async def search(
        self,
        user_id: str,
        query: str,
        content_types: List[str] = None,
        include_public: bool = True,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Search across all content types"""
        db = self.db_session_factory()
        results = []
        
        try:
            from models import Note, FlashcardSet, User, QuestionSet
            
            actual_user_id = None
            if user_id and user_id != "guest":
                if isinstance(user_id, str) and not user_id.isdigit():
                    user = db.query(User).filter(User.username == user_id).first()
                    if user:
                        actual_user_id = user.id
                elif isinstance(user_id, str):
                    actual_user_id = int(user_id)
                else:
                    actual_user_id = user_id
            
            content_types = content_types or ["notes", "flashcards", "questions"]
            
            if "notes" in content_types:
                notes_query = db.query(Note).filter(
                    Note.is_deleted == False,
                    (Note.title.ilike(f"%{query}%") | Note.content.ilike(f"%{query}%"))
                )
                if actual_user_id:
                    notes_query = notes_query.filter(Note.user_id == actual_user_id)
                
                for note in notes_query.limit(limit // 3).all():
                    results.append({
                        "id": note.id,
                        "type": "note",
                        "title": note.title,
                        "description": note.content[:200] if note.content else "",
                        "navigate_to": f"/notes/editor/{note.id}"
                    })
            
            if "flashcards" in content_types:
                fc_query = db.query(FlashcardSet).filter(
                    (FlashcardSet.title.ilike(f"%{query}%") | FlashcardSet.description.ilike(f"%{query}%"))
                )
                if actual_user_id:
                    if include_public:
                        fc_query = fc_query.filter(
                            (FlashcardSet.user_id == actual_user_id) | (FlashcardSet.is_public == True)
                        )
                    else:
                        fc_query = fc_query.filter(FlashcardSet.user_id == actual_user_id)
                
                for fc_set in fc_query.limit(limit // 3).all():
                    results.append({
                        "id": fc_set.id,
                        "type": "flashcard_set",
                        "title": fc_set.title,
                        "description": fc_set.description or "",
                        "navigate_to": f"/flashcards?set_id={fc_set.id}"
                    })
            
            if "questions" in content_types:
                try:
                    q_query = db.query(QuestionSet).filter(
                        (QuestionSet.title.ilike(f"%{query}%") | QuestionSet.description.ilike(f"%{query}%"))
                    )
                    if actual_user_id:
                        if include_public:
                            q_query = q_query.filter(
                                (QuestionSet.user_id == actual_user_id) | (QuestionSet.is_public == True)
                            )
                        else:
                            q_query = q_query.filter(QuestionSet.user_id == actual_user_id)
                    
                    for q_set in q_query.limit(limit // 3).all():
                        results.append({
                            "id": q_set.id,
                            "type": "question_set",
                            "title": q_set.title,
                            "description": q_set.description or "",
                            "navigate_to": f"/question-bank?set_id={q_set.id}"
                        })
                except Exception as e:
                    logger.warning(f"Question set search failed: {e}")
            
            return {
                "success": True,
                "results": results,
                "total_results": len(results),
                "query": query
            }
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {"success": False, "error": str(e), "results": []}
        finally:
            db.close()


# ==================== Enhanced SearchHub Agent ====================

class EnhancedSearchHubAgent(BaseAgent):
    """
    Enhanced SearchHub Agent with NLP Understanding
    
    Works like a smart assistant - understands natural language,
    maintains conversation context, and provides intelligent responses.
    
    Capabilities:
    - Natural language understanding (semantic + keyword matching)
    - Context-aware conversations (remembers previous interactions)
    - Multi-language support
    - Smart suggestions based on user behavior
    - Proactive recommendations
    - Knowledge graph integration
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        user_knowledge_graph: Optional[Any] = None,
        master_agent: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.user_knowledge_graph = user_knowledge_graph
        self.master_agent = master_agent
        
        # Initialize NLP Engine
        self.nlp_engine = get_nlp_engine(ai_client)
        
        # Initialize components
        self.content_creator = ContentCreator(ai_client, db_session_factory) if db_session_factory else None
        self.topic_explorer = TopicExplorer(ai_client)
        self.content_searcher = ContentSearcher(db_session_factory, ai_client) if db_session_factory else None
        
        # Knowledge graph integration
        self.kg_integration = KnowledgeGraphIntegration(user_knowledge_graph, master_agent)
        
        super().__init__(
            agent_type=AgentType.SEARCHHUB,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(EnhancedSearchHubState)
        
        # Add nodes
        graph.add_node("understand_intent", self._understand_intent)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("create_content", self._create_content)
        graph.add_node("search_content", self._search_content)
        graph.add_node("explore_topic", self._explore_topic)
        graph.add_node("learning_action", self._learning_action)
        graph.add_node("knowledge_graph_action", self._knowledge_graph_action)
        graph.add_node("chat_action", self._chat_action)
        graph.add_node("help_action", self._help_action)
        
        # Finalization
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("understand_intent")
        
        # Add edges
        graph.add_edge("understand_intent", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "create": "create_content",
                "search": "search_content",
                "explore": "explore_topic",
                "learning": "learning_action",
                "knowledge_graph": "knowledge_graph_action",
                "chat": "chat_action",
                "help": "help_action",
                "error": "handle_error"
            }
        )
        
        # All actions lead to format_response
        for node in ["create_content", "search_content", "explore_topic", 
                     "learning_action", "knowledge_graph_action", "chat_action", "help_action"]:
            graph.add_edge(node, "format_response")
        
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
    
    # ==================== Graph Nodes ====================
    
    async def _understand_intent(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Use NLP engine to understand user intent like a chatbot"""
        user_input = state.get("user_input", "")
        user_id = state.get("user_id", "default")
        
        state["execution_path"] = ["searchhub:understand_intent"]
        
        # Use NLP engine for understanding with AI fallback
        intent_match = await self.nlp_engine.understand_with_ai(user_input, user_id)
        
        # Store comprehensive intent match data
        state["intent_match"] = {
            "intent": intent_match.intent,
            "confidence": intent_match.confidence,
            "entities": intent_match.entities,
            "context_used": intent_match.context_used,
            "language": intent_match.language,
            "navigation_target": intent_match.navigation_target,
            "navigation_params": intent_match.navigation_params,
            "response_type": intent_match.response_type
        }
        state["detected_intent"] = intent_match.intent
        state["confidence"] = intent_match.confidence
        state["extracted_entities"] = intent_match.entities
        state["language"] = intent_match.language
        state["context_used"] = intent_match.context_used
        
        # Store navigation info from NLP engine
        if intent_match.navigation_target:
            state["navigate_to"] = intent_match.navigation_target
            state["navigate_params"] = intent_match.navigation_params
        
        # Generate chatbot-like response message
        chatbot_response = self.nlp_engine.get_chatbot_response(
            intent_match.intent, 
            intent_match.entities, 
            user_id
        )
        state["chatbot_message"] = chatbot_response
        
        logger.info(f"NLP Understanding: intent={intent_match.intent}, confidence={intent_match.confidence:.2f}, "
                   f"entities={intent_match.entities}, context_used={intent_match.context_used}, "
                   f"response_type={intent_match.response_type}, nav_target={intent_match.navigation_target}")
        
        return state
    
    async def _load_context(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Load user context and preferences"""
        user_id = state.get("user_id")
        
        if self.memory_manager and user_id:
            try:
                topic = state.get("extracted_entities", {}).get("topic", "")
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="searchhub",
                    query=topic,
                    session_id=state.get("session_id", "default")
                )
                state["memory_context"] = context
                state["user_preferences"] = context.get("user_preferences", {})
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        state["execution_path"].append("searchhub:load_context")
        return state
    
    def _get_action_route(self, state: EnhancedSearchHubState) -> str:
        """Route to appropriate action handler based on intent"""
        intent = state.get("detected_intent", "")
        
        # Intent to route mapping
        intent_routes = {
            # Creation
            "create_note": "create",
            "create_flashcards": "create",
            "create_questions": "create",
            "create_quiz": "create",
            
            # Search
            "search_all": "search",
            
            # Exploration/Learning
            "explain_topic": "explore",
            "summarize_topic": "explore",
            
            # Review
            "review_flashcards": "learning",
            
            # Knowledge Graph / Analytics
            "show_weak_areas": "knowledge_graph",
            "show_strong_areas": "knowledge_graph",
            "show_progress": "knowledge_graph",
            "show_learning_analytics": "knowledge_graph",
            "show_knowledge_gaps": "knowledge_graph",
            "show_concepts_to_review": "knowledge_graph",
            "show_recommended_topics": "knowledge_graph",
            "get_learning_path": "knowledge_graph",
            "detect_learning_style": "knowledge_graph",
            
            # Chat
            "start_chat": "chat",
            
            # Help & Greeting
            "show_help": "help",
            "greeting": "help",
            
            # Follow-up intents
            "followup_yes": "help",
            "followup_no": "help",
            "followup_more": "explore",
            "cancelled": "help",
        }
        
        return intent_routes.get(intent, "explore")
    
    async def _route_action(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Prepare for action routing"""
        state["execution_path"].append(f"searchhub:route:{state.get('detected_intent')}")
        return state
    
    async def _create_content(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Create content based on intent"""
        intent = state.get("detected_intent")
        entities = state.get("extracted_entities", {})
        topic = entities.get("topic", "")
        user_id = state.get("user_id")
        count = entities.get("count", 10)
        
        state["execution_path"].append(f"searchhub:create:{intent}")
        
        if not self.content_creator:
            state["errors"] = ["Content creation not available"]
            return state
        
        if not topic:
            state["errors"] = ["I need a topic to create content. Try: 'create flashcards on machine learning'"]
            return state
        
        result = None
        
        if intent == "create_note":
            result = await self.content_creator.create_note(user_id, topic)
        elif intent == "create_flashcards":
            result = await self.content_creator.create_flashcards(user_id, topic, count)
        elif intent == "create_questions":
            result = await self.content_creator.create_questions(user_id, topic, count)
        elif intent == "create_quiz":
            # For quiz, we don't pre-create questions - we pass params to auto-start
            state["navigate_to"] = "/solo-quiz"
            state["navigate_params"] = {
                "autoStart": True,
                "topics": [topic],
                "difficulty": "medium",
                "questionCount": count
            }
            state["response_data"] = {
                "success": True,
                "message": f"Starting quiz on {topic} with {count} questions",
                "navigate_to": "/solo-quiz"
            }
            return state
        
        if result:
            state["created_content"] = result
            state["content_id"] = result.get("content_id")
            state["content_type"] = result.get("content_type")
            state["navigate_to"] = result.get("navigate_to")
            state["navigate_params"] = {"id": result.get("content_id"), "title": result.get("title")}
            
            logger.info(f"Content created - success: {result.get('success')}, navigate_to: {result.get('navigate_to')}, content_id: {result.get('content_id')}")
            
            if result.get("success"):
                state["response_data"] = result
            else:
                state["errors"] = [result.get("error", "Content creation failed")]
        
        return state
    
    async def _search_content(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Search for content"""
        entities = state.get("extracted_entities", {})
        query = entities.get("topic") or state.get("user_input", "")
        user_id = state.get("user_id")
        
        state["execution_path"].append("searchhub:search")
        
        if not self.content_searcher:
            state["errors"] = ["Search not available"]
            return state
        
        result = await self.content_searcher.search(
            user_id=user_id,
            query=query,
            include_public=True
        )
        
        state["search_results"] = result.get("results", [])
        state["search_query"] = query
        state["response_data"] = result
        
        # If no results, provide AI exploration
        if not result.get("results"):
            explore_result = self.topic_explorer.explain(query)
            state["ai_response"] = explore_result.get("explanation", "")
            state["ai_suggestions"] = explore_result.get("suggestions", [])
        
        return state
    
    async def _explore_topic(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Explore/explain a topic with AI"""
        entities = state.get("extracted_entities", {})
        topic = entities.get("topic") or state.get("user_input", "")
        intent = state.get("detected_intent")
        
        state["execution_path"].append(f"searchhub:explore:{intent}")
        
        if intent == "summarize_topic":
            result = self.topic_explorer.summarize(topic)
            state["ai_response"] = result.get("summary", "")
        else:
            result = self.topic_explorer.explain(topic)
            state["ai_response"] = result.get("explanation", "")
            state["ai_suggestions"] = result.get("suggestions", [])
            state["related_topics"] = result.get("related_topics", [])
        
        state["response_data"] = {
            "success": result.get("success", False),
            "topic": topic,
            "explanation": state.get("ai_response"),
            "suggestions": state.get("ai_suggestions", []),
            "related_topics": state.get("related_topics", []),
            "action_buttons": [
                {"label": f"Create Note on {topic}", "action": "create_note", "topic": topic},
                {"label": "Create Flashcards", "action": "create_flashcards", "topic": topic},
                {"label": "Quiz Me", "action": "create_quiz", "topic": topic},
                {"label": "Chat About This", "action": "start_chat", "topic": topic}
            ]
        }
        
        return state
    
    async def _learning_action(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Handle learning-related actions"""
        intent = state.get("detected_intent")
        
        state["execution_path"].append(f"searchhub:learning:{intent}")
        
        navigation_map = {
            "review_flashcards": "/flashcards",
            "take_quiz": "/solo-quiz",
        }
        
        messages = {
            "review_flashcards": "Opening your flashcards for review...",
            "take_quiz": "Starting quiz mode...",
        }
        
        navigate_to = navigation_map.get(intent, "/dashboard")
        
        state["navigate_to"] = navigate_to
        state["response_data"] = {
            "success": True,
            "action": intent,
            "navigate_to": navigate_to,
            "message": messages.get(intent, "Processing your request...")
        }
        
        return state
    
    async def _knowledge_graph_action(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Handle knowledge graph related actions"""
        intent = state.get("detected_intent")
        user_id = state.get("user_id")
        entities = state.get("extracted_entities", {})
        topic = entities.get("topic", "")
        
        state["execution_path"].append(f"searchhub:knowledge_graph:{intent}")
        
        # Convert user_id to int
        user_id_int = None
        try:
            if user_id:
                if str(user_id).isdigit():
                    user_id_int = int(user_id)
                elif self.db_session_factory:
                    from models import User
                    db = self.db_session_factory()
                    try:
                        user = db.query(User).filter(
                            (User.email == user_id) | (User.username == user_id)
                        ).first()
                        if user:
                            user_id_int = user.id
                    finally:
                        db.close()
        except Exception as e:
            logger.error(f"Error resolving user_id: {e}")
        
        if not user_id_int:
            state["errors"] = ["Please log in to access your learning analytics"]
            return state
        
        result = {}
        message = ""
        ai_response = ""
        
        # Handle different knowledge graph actions
        if intent == "show_weak_areas":
            # ==================== PRIMARY: Get weak areas from UserWeakArea table ====================
            # This is what the analytics page uses - actual performance data
            weak_areas_from_db = []
            if self.db_session_factory:
                try:
                    from models import UserWeakArea
                    db = self.db_session_factory()
                    try:
                        weak_areas = db.query(UserWeakArea).filter(
                            UserWeakArea.user_id == user_id_int,
                            UserWeakArea.status.in_(["needs_practice", "improving"])
                        ).order_by(
                            UserWeakArea.priority.desc(),
                            UserWeakArea.weakness_score.desc()
                        ).limit(10).all()
                        
                        if weak_areas:
                            for wa in weak_areas:
                                weak_areas_from_db.append({
                                    "concept": wa.topic,
                                    "subtopic": wa.subtopic,
                                    "accuracy": round(wa.accuracy, 1),
                                    "weakness_score": round(wa.weakness_score, 1),
                                    "incorrect_count": wa.incorrect_count,
                                    "total_questions": wa.total_questions,
                                    "consecutive_wrong": wa.consecutive_wrong,
                                    "priority": wa.priority,
                                    "status": wa.status
                                })
                            logger.info(f"✅ Found {len(weak_areas_from_db)} weak areas from UserWeakArea table")
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Failed to get weak areas from UserWeakArea: {e}")
            
            # Try knowledge graph as secondary source
            result = await self.kg_integration.get_weak_areas(user_id_int)
            state["kg_data"] = result
            
            # ==================== RAG INTEGRATION ====================
            # Get user's RAG manager for retrieving relevant content
            user_rag = None
            try:
                from .rag.user_rag_manager import get_user_rag_manager
                user_rag = get_user_rag_manager()
            except Exception as e:
                logger.warning(f"Could not load RAG manager: {e}")
            
            # Use UserWeakArea data if available (primary source)
            if weak_areas_from_db:
                weak_list = weak_areas_from_db[:5]
                
                # ==================== RAG: Retrieve content for weak concepts ====================
                rag_content = {}
                if user_rag and weak_list:
                    try:
                        # Build query from weak concepts
                        weak_concepts = [c['concept'] for c in weak_list]
                        query = f"study materials for {', '.join(weak_concepts[:3])}"
                        
                        logger.info(f"🔍 RAG: Retrieving content for weak areas: {query}")
                        rag_results = await user_rag.retrieve_for_user(
                            user_id=str(user_id_int),
                            query=query,
                            top_k=10,
                            content_types=["note", "flashcard", "chat"]
                        )
                        
                        if rag_results:
                            # Organize by concept
                            for concept_data in weak_list:
                                concept = concept_data['concept']
                                # Find relevant content for this concept
                                relevant = [r for r in rag_results if concept.lower() in r.get('content', '').lower()]
                                if relevant:
                                    rag_content[concept] = relevant[:3]  # Top 3 per concept
                            
                            logger.info(f"✅ RAG: Found content for {len(rag_content)} weak concepts")
                    except Exception as e:
                        logger.error(f"❌ RAG retrieval failed: {e}")
                
                concepts_text = "\n".join([
                    f"• {c['concept']}: {c['accuracy']}% accuracy ({c['incorrect_count']}/{c['total_questions']} wrong)"
                    for c in weak_list
                ])
                
                # Add relevant content suggestions
                content_suggestions = ""
                if rag_content:
                    content_suggestions = "\n\nRelevant Study Materials:"
                    for concept, items in list(rag_content.items())[:3]:
                        content_suggestions += f"\n\nFor {concept}:"
                        for item in items[:2]:
                            content_type = item.get('metadata', {}).get('type', 'content')
                            title = item.get('metadata', {}).get('title', 'Untitled')
                            content_suggestions += f"\n  • {content_type.title()}: {title}"
                
                ai_response = f"Here are your areas that need attention:\n\n{concepts_text}{content_suggestions}\n\nI recommend focusing on these topics to improve your overall mastery."
                message = f"Found {len(weak_areas_from_db)} concepts that need attention"
                result["success"] = True
                result["weak_concepts"] = weak_areas_from_db
            
            # Fallback to knowledge graph if available
            elif result.get("success") and result.get("weak_concepts"):
                weak_list = result["weak_concepts"][:5]
                
                # ==================== RAG: Retrieve content for weak concepts ====================
                rag_content = {}
                if user_rag and weak_list:
                    try:
                        # Build query from weak concepts
                        weak_concepts = [c['concept'] for c in weak_list]
                        query = f"study materials for {', '.join(weak_concepts[:3])}"
                        
                        logger.info(f"🔍 RAG: Retrieving content for weak areas: {query}")
                        rag_results = await user_rag.retrieve_for_user(
                            user_id=str(user_id_int),
                            query=query,
                            top_k=10,
                            content_types=["note", "flashcard", "chat"]
                        )
                        
                        if rag_results:
                            # Organize by concept
                            for concept_data in weak_list:
                                concept = concept_data['concept']
                                # Find relevant content for this concept
                                relevant = [r for r in rag_results if concept.lower() in r.get('content', '').lower()]
                                if relevant:
                                    rag_content[concept] = relevant[:3]  # Top 3 per concept
                            
                            logger.info(f"✅ RAG: Found content for {len(rag_content)} weak concepts")
                    except Exception as e:
                        logger.error(f"❌ RAG retrieval failed: {e}")
                
                concepts_text = "\n".join([
                    f"• {c['concept']}: {c['mastery']:.0%} mastery"
                    for c in weak_list
                ])
                
                # Add relevant content suggestions
                content_suggestions = ""
                if rag_content:
                    content_suggestions = "\n\nRelevant Study Materials:"
                    for concept, items in list(rag_content.items())[:3]:
                        content_suggestions += f"\n\nFor {concept}:"
                        for item in items[:2]:
                            content_type = item.get('metadata', {}).get('type', 'content')
                            title = item.get('metadata', {}).get('title', 'Untitled')
                            content_suggestions += f"\n  • {content_type.title()}: {title}"
                
                ai_response = f"Here are your areas that need attention:\n\n{concepts_text}{content_suggestions}\n\nI recommend focusing on these topics to improve your overall mastery."
                message = f"Found {len(result['weak_concepts'])} concepts that need attention"
            else:
                # Final fallback: Get weak areas from flashcard performance
                if self.db_session_factory:
                    try:
                        from models import FlashcardSet, Flashcard
                        db = self.db_session_factory()
                        try:
                            # Get flashcard sets with low performance
                            sets = db.query(FlashcardSet).filter(FlashcardSet.user_id == user_id_int).all()
                            weak_topics = []
                            for fs in sets:
                                if hasattr(fs, 'flashcards') and fs.flashcards:
                                    # Calculate performance based on flashcard stats
                                    total = len(fs.flashcards)
                                    if total > 0:
                                        weak_topics.append({
                                            "topic": fs.title,
                                            "cards": total,
                                            "description": fs.description or ""
                                        })
                            
                            if weak_topics:
                                topics_text = "\n".join([f"  • {t['topic']} ({t['cards']} cards)" for t in weak_topics[:5]])
                                ai_response = f"Based on your flashcard sets, here are topics to focus on:\n\n{topics_text}\n\nReview these regularly to strengthen your knowledge."
                                message = f"Found {len(weak_topics)} topics to review"
                                result["success"] = True
                                result["weak_topics"] = weak_topics
                            else:
                                ai_response = "Great job! No weak areas detected. Keep up the good work, or create some flashcards to start tracking your progress!"
                                message = "No weak areas found"
                        finally:
                            db.close()
                    except Exception as e:
                        logger.error(f"Failed to get weak areas from DB: {e}")
                        ai_response = "Great job! No significant weak areas detected. Keep up the good work!"
                        message = "No weak areas found"
                else:
                    ai_response = "Great job! No significant weak areas detected. Keep up the good work!"
                    message = "No weak areas found"
        
        elif intent == "show_strong_areas":
            result = await self.kg_integration.get_strong_areas(user_id_int)
            state["kg_data"] = result
            
            if result.get("success") and result.get("strong_concepts"):
                strong_list = result["strong_concepts"][:5]
                concepts_text = "\n".join([
                    f"  • {c['concept']}: {c['mastery']:.0%} mastery"
                    for c in strong_list
                ])
                ai_response = f"You're excelling in these areas:\n\n{concepts_text}\n\nConsider challenging yourself with harder questions or helping others learn these topics!"
                message = f"You're strong in {len(result['strong_concepts'])} concepts!"
            else:
                ai_response = "Keep studying! Your strengths will develop as you practice more."
                message = "Keep building your knowledge"
        
        elif intent == "show_progress":
            result = await self.kg_integration.get_learning_analytics(user_id_int)
            state["kg_data"] = result
            
            if result.get("success"):
                summary = result.get("summary", {})
                ai_response = f"""Here's your learning progress:

Total Concepts: {summary.get('total_concepts', 0)}
Average Mastery: {summary.get('average_mastery', 0):.0%}
Total Reviews: {summary.get('total_reviews', 0)}
Accuracy Rate: {summary.get('accuracy_rate', 0):.0%}

Keep up the great work!"""
                message = "Here's your learning progress"
                state["navigate_to"] = "/study-insights"
            else:
                ai_response = "Start studying to see your progress!"
                message = "No progress data yet"
        
        elif intent == "show_learning_analytics":
            result = await self.kg_integration.get_learning_analytics(user_id_int)
            state["kg_data"] = result
            state["navigate_to"] = "/study-insights"
            
            if result.get("success"):
                summary = result.get("summary", {})
                distribution = result.get("mastery_distribution", {})
                ai_response = f"""Your Learning Analytics:

Summary:
  • Total Concepts: {summary.get('total_concepts', 0)}
  • Average Mastery: {summary.get('average_mastery', 0):.0%}
  • Total Reviews: {summary.get('total_reviews', 0)}
  • Accuracy: {summary.get('accuracy_rate', 0):.0%}

Mastery Distribution:
  • Expert: {distribution.get('expert', 0)} concepts
  • Proficient: {distribution.get('proficient', 0)} concepts
  • Intermediate: {distribution.get('intermediate', 0)} concepts
  • Beginner: {distribution.get('beginner', 0)} concepts"""
                message = "Here's your detailed analytics"
            else:
                ai_response = "Start studying to see your analytics!"
                message = "No analytics data yet"
        
        elif intent == "show_knowledge_gaps":
            result = await self.kg_integration.get_knowledge_gaps(user_id_int)
            state["kg_data"] = result
            
            if result.get("success") and result.get("gaps"):
                gaps_list = result["gaps"][:5]
                gaps_text = "\n".join([
                    f"  • {g['concept']}: {g.get('reason', 'Ready to learn')}"
                    for g in gaps_list
                ])
                ai_response = f"Knowledge gaps detected - these concepts build on what you already know:\n\n{gaps_text}"
                message = f"Found {len(result['gaps'])} concepts you're ready to learn"
            else:
                ai_response = "No knowledge gaps detected. You're on a great learning path!"
                message = "No gaps found"
        
        elif intent == "show_concepts_to_review":
            result = await self.kg_integration.get_concepts_to_review(user_id_int)
            state["kg_data"] = result
            
            if result.get("success") and result.get("concepts_to_review"):
                review_list = result["concepts_to_review"][:5]
                review_text = "\n".join([
                    f"  • {c['concept']}: {c['mastery']:.0%} mastery"
                    for c in review_list
                ])
                ai_response = f"Concepts due for review:\n\n{review_text}\n\nRegular spaced repetition helps move knowledge to long-term memory."
                message = f"{result['overdue_count']} concepts need review"
            else:
                ai_response = "You're all caught up! No concepts need immediate review."
                message = "All caught up on reviews"
        
        elif intent == "show_recommended_topics":
            result = await self.kg_integration.get_recommended_topics(user_id_int)
            state["kg_data"] = result
            
            if result.get("success") and result.get("recommended_topics"):
                topics_list = result["recommended_topics"][:5]
                topics_text = "\n".join([
                    f"  • {t['topic']}: {t.get('recommendation_reason', 'Good next step')}"
                    for t in topics_list
                ])
                ai_response = f"Recommended topics for you:\n\n{topics_text}\n\nThese are selected based on your current progress."
                message = f"Found {len(result['recommended_topics'])} recommended topics"
            else:
                ai_response = "Start learning to get personalized topic recommendations!"
                message = "No recommendations yet"
        
        elif intent == "get_learning_path":
            if topic:
                result = await self.kg_integration.get_learning_path(user_id_int, topic)
                state["kg_data"] = result
                
                if result.get("success") and result.get("concepts"):
                    concepts_list = result["concepts"][:8]
                    path_text = "\n".join([
                        f"  {i+1}. {c['name']}"
                        for i, c in enumerate(concepts_list)
                    ])
                    ai_response = f"""Learning Path for {topic}:

{path_text}

Estimated Time: {result.get('estimated_time_hours', 0):.1f} hours
Difficulty: {result.get('difficulty', 'intermediate').title()}"""
                    message = f"Generated learning path for {topic}"
                else:
                    ai_response = f"I couldn't find a structured learning path for '{topic}'. Try exploring the topic first!"
                    message = "No learning path found"
            else:
                ai_response = "Please specify a topic. Example: 'learning path for machine learning'"
                message = "No topic specified"
        
        elif intent == "detect_learning_style":
            # Get learning data from database if knowledge graph not available
            learning_data = {}
            if result.get("success"):
                learning_data = result
            elif self.db_session_factory:
                # Fallback: Get data directly from database
                try:
                    from models import FlashcardSet, Flashcard, Note, User
                    db = self.db_session_factory()
                    try:
                        # Get user's study statistics
                        flashcard_sets = db.query(FlashcardSet).filter(FlashcardSet.user_id == user_id_int).all()
                        notes = db.query(Note).filter(Note.user_id == user_id_int, Note.is_deleted == False).all()
                        
                        total_flashcards = sum(len(fs.flashcards) if hasattr(fs, 'flashcards') else 0 for fs in flashcard_sets)
                        total_notes = len(notes)
                        total_sets = len(flashcard_sets)
                        
                        learning_data = {
                            "success": True,
                            "summary": {
                                "total_flashcard_sets": total_sets,
                                "total_flashcards": total_flashcards,
                                "total_notes": total_notes,
                                "total_reviews": total_flashcards * 2,  # Estimate
                                "accuracy_rate": 0.7  # Default estimate
                            }
                        }
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Failed to get learning data from DB: {e}")
            
            if learning_data.get("success"):
                summary = learning_data.get("summary", {})
                total_reviews = summary.get("total_reviews", 0)
                total_notes = summary.get("total_notes", 0)
                total_flashcards = summary.get("total_flashcards", 0)
                accuracy = summary.get("accuracy_rate", 0)
                
                # Determine learning style based on user behavior
                if total_notes > total_flashcards:
                    style = "Reading/Writing Learner"
                    description = "You prefer learning through written content. You absorb information best by reading and taking notes."
                    tips = [
                        "Create detailed notes on topics you're studying",
                        "Write summaries in your own words",
                        "Use bullet points and lists to organize information",
                        "Review your notes regularly"
                    ]
                elif total_flashcards > 20 and accuracy > 0.7:
                    style = "Visual-Sequential Learner"
                    description = "You learn best through structured, step-by-step content with visual cues and repetition."
                    tips = [
                        "Use flashcards with images when possible",
                        "Break complex topics into smaller chunks",
                        "Follow a structured learning path",
                        "Practice with spaced repetition"
                    ]
                elif total_reviews > 30:
                    style = "Active-Kinesthetic Learner"
                    description = "You learn by doing and practicing. Hands-on experience helps you retain information."
                    tips = [
                        "Take quizzes frequently to test yourself",
                        "Practice problems and exercises",
                        "Teach concepts to others",
                        "Apply what you learn to real projects"
                    ]
                else:
                    style = "Multimodal Learner"
                    description = "You benefit from a variety of learning methods. Mix different approaches for best results."
                    tips = [
                        "Combine notes, flashcards, and quizzes",
                        "Watch videos and read articles on topics",
                        "Discuss concepts with others",
                        "Use multiple resources for each topic"
                    ]
                
                tips_text = "\n".join([f"  • {tip}" for tip in tips])
                ai_response = f"""Your Learning Style: {style}

{description}

Based on your activity:
  • Flashcard sets created: {summary.get('total_flashcard_sets', 0)}
  • Notes written: {total_notes}
  • Study sessions: {total_reviews}

Tips for your learning style:
{tips_text}"""
                message = f"Your learning style is {style}"
                result["learning_style"] = style
                result["description"] = description
                result["tips"] = tips
                result["success"] = True
            else:
                ai_response = """I don't have enough data to determine your learning style yet.

To help me understand how you learn best:
  • Create some flashcards on a topic you're studying
  • Write a few notes
  • Take a quiz or two

After a few study sessions, I'll be able to give you personalized insights!"""
                message = "Need more study data to detect learning style"
        
        state["ai_response"] = ai_response
        
        # Analytics actions should NOT navigate - show results in SearchHub UI
        # Remove navigation so the AI response is displayed in the UI
        # state["navigate_to"] = None  # Explicitly don't navigate
        
        state["response_data"] = {
            "success": result.get("success", False) or bool(ai_response),
            "action": intent,
            "data": result,
            "message": message,
            "ai_response": ai_response,
            "suggestions": self.nlp_engine.get_suggestions("", state.get("user_id", "default"))
        }
        
        return state
    
    async def _chat_action(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Handle chat-related actions"""
        entities = state.get("extracted_entities", {})
        topic = entities.get("topic") or state.get("user_input", "")
        
        state["execution_path"].append("searchhub:chat")
        
        state["navigate_to"] = "/ai-chat"
        state["navigate_params"] = {"initialMessage": topic}
        state["response_data"] = {
            "success": True,
            "action": "start_chat",
            "navigate_to": "/ai-chat",
            "navigate_params": {"initialMessage": topic},
            "message": f"Starting chat about {topic}..."
        }
        
        return state
    
    async def _help_action(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Show help, handle greetings, and follow-up intents"""
        intent = state.get("detected_intent", "")
        state["execution_path"].append(f"searchhub:help:{intent}")
        
        # Handle different help-related intents
        if intent == "greeting":
            greeting_responses = [
                "Hey there! 👋 How can I help you learn today?",
                "Hi! Ready to study something? Just tell me what you need!",
                "Hello! I'm here to help you learn. What would you like to do?",
                "Hey! What would you like to learn about today?",
            ]
            import random
            greeting = random.choice(greeting_responses)
            
            state["ai_response"] = greeting
            state["response_data"] = {
                "success": True,
                "action": "greeting",
                "message": greeting,
                "ai_response": greeting,
                "suggestions": [
                    "create flashcards on [topic]",
                    "explain [topic]",
                    "show my progress",
                    "what are my weak areas",
                    "quiz me on [topic]"
                ]
            }
            return state
        
        elif intent == "cancelled":
            state["ai_response"] = "No problem! Let me know if you need anything else."
            state["response_data"] = {
                "success": True,
                "action": "cancelled",
                "message": "No problem! Let me know if you need anything else.",
                "ai_response": "No problem! Let me know if you need anything else."
            }
            return state
        
        elif intent in ["followup_yes", "followup_no"]:
            # These should have been handled by context, but provide fallback
            state["ai_response"] = "I'm not sure what you're referring to. Could you tell me more specifically what you'd like to do?"
            state["response_data"] = {
                "success": True,
                "action": intent,
                "message": "I'm not sure what you're referring to. Could you tell me more specifically what you'd like to do?",
                "ai_response": "I'm not sure what you're referring to. Could you tell me more specifically what you'd like to do?"
            }
            return state
        
        # Default help text
        help_text = """Hey! Here's what I can help you with:

📝 CREATE CONTENT
  • "Create flashcards on [topic]"
  • "Make a note about [topic]"
  • "Generate questions on [topic]"
  • "Quiz me on [topic]"

🔍 SEARCH & EXPLORE
  • "Search for [topic]"
  • "Explain [topic]"
  • "What is [topic]?"

📊 LEARNING ANALYTICS
  • "Show my progress"
  • "What are my weak areas?"
  • "What should I review?"
  • "Show my learning analytics"

🎯 SMART FEATURES
  • "What should I study next?"
  • "Learning path for [topic]"
  • "What's my learning style?"

Just type naturally - I understand conversational language! Try something like "help me learn about machine learning" or "I need to study for my physics exam"."""
        
        state["ai_response"] = help_text
        state["response_data"] = {
            "success": True,
            "action": "show_help",
            "message": "Here's what I can do",
            "ai_response": help_text,
            "suggestions": [
                "create flashcards on machine learning",
                "explain quantum physics",
                "show my progress",
                "what are my weak areas"
            ]
        }
        
        return state
    
    async def _format_response(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Format the final response with chatbot-like messaging"""
        intent = state.get("detected_intent")
        entities = state.get("extracted_entities", {})
        topic = entities.get("topic", "")
        intent_match = state.get("intent_match", {})
        
        state["execution_path"].append("searchhub:format_response")
        
        response_data = state.get("response_data", {})
        chatbot_message = state.get("chatbot_message", "")
        
        logger.info(f"Format response - intent: {intent}, navigate_to in state: {state.get('navigate_to')}, response_data: {response_data.get('success')}")
        
        if state.get("errors"):
            state["final_response"] = f"Sorry, I encountered an issue: {state['errors'][0]}"
            state["response_metadata"] = {
                "success": False,
                "errors": state["errors"],
                "action": intent,
                "suggestions": [
                    "create flashcards on [topic]",
                    "explain [topic]",
                    "show my progress"
                ]
            }
        else:
            # Use chatbot message if available, otherwise use response data message
            message = chatbot_message or response_data.get("message", f"Completed {intent}")
            state["final_response"] = message
            
            # Build comprehensive metadata
            state["response_metadata"] = {
                "success": True,
                "action": intent,
                "topic": topic,
                "confidence": state.get("confidence", 0),
                "context_used": state.get("context_used", False),
                "language": state.get("language", "en"),
                "navigate_to": state.get("navigate_to"),
                "navigate_params": state.get("navigate_params", {}),
                "content_id": state.get("content_id"),
                "content_type": state.get("content_type"),
                "response_type": intent_match.get("response_type", "action"),
                "chatbot_message": chatbot_message,
                "response_data": response_data,
                "suggestions": response_data.get("suggestions", self.nlp_engine.get_suggestions("", state.get("user_id", "default")))
            }
        
        return state
    
    async def _handle_error(self, state: EnhancedSearchHubState) -> EnhancedSearchHubState:
        """Handle errors gracefully with helpful suggestions"""
        errors = state.get("errors", ["Unknown error"])
        user_id = state.get("user_id", "default")
        
        # Provide helpful error message
        error_responses = [
            f"Hmm, I ran into a problem: {errors[0]}. Could you try rephrasing that?",
            f"I couldn't quite do that: {errors[0]}. Let me know if you'd like to try something else!",
            f"Oops! {errors[0]}. Try being more specific or ask me what I can do.",
        ]
        import random
        
        state["final_response"] = random.choice(error_responses)
        state["response_metadata"] = {
            "success": False,
            "errors": errors,
            "suggestions": self.nlp_engine.get_suggestions("", user_id)
        }
        
        return state
    
    # ==================== Public Methods ====================
    
    def get_suggestions(self, partial_query: str, user_id: str = "default") -> List[str]:
        """Get autocomplete suggestions"""
        return self.nlp_engine.get_suggestions(partial_query, user_id)
    
    def clear_context(self, user_id: str):
        """Clear conversation context for user"""
        self.nlp_engine.clear_context(user_id)
    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process input - handled by _understand_intent"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute core logic - handled by action nodes"""
        return state


# ==================== Factory Function ====================

def create_enhanced_search_hub_agent(
    ai_client: Any,
    knowledge_graph: Optional[Any] = None,
    memory_manager: Optional[MemoryManager] = None,
    db_session_factory: Optional[Any] = None,
    user_knowledge_graph: Optional[Any] = None,
    master_agent: Optional[Any] = None
) -> EnhancedSearchHubAgent:
    """Factory function to create an Enhanced SearchHub agent"""
    return EnhancedSearchHubAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory,
        user_knowledge_graph=user_knowledge_graph,
        master_agent=master_agent
    )
