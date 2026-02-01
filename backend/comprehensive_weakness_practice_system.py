"""
COMPREHENSIVE WEAKNESS PRACTICE SYSTEM - PRODUCTION LEVEL
Integrates weakness analysis, AI-powered question generation, knowledge graph,
adaptive learning, and personalized practice sessions.

This system provides:
1. Deep weakness analysis from all data sources
2. AI-powered custom question generation
3. Knowledge graph integration for concept relationships
4. Adaptive difficulty adjustment
5. Real-time practice sessions with feedback
6. Progress tracking and mastery calculation
7. Personalized study recommendations

Author: Cerbyl AI Team
Version: 3.0.0
"""

import logging
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
from collections import defaultdict
import random
import asyncio

logger = logging.getLogger(__name__)


# ==================== CORE WEAKNESS ANALYZER ====================

class EnhancedWeaknessAnalyzer:
    """
    Enhanced weakness analyzer that integrates with knowledge graph
    and provides deep insights into user performance patterns
    """
    
    def __init__(self, db: Session, user_id: int, models, ai_client, kg_client=None):
        self.db = db
        self.user_id = user_id
        self.models = models
        self.ai_client = ai_client
        self.kg_client = kg_client
    
    async def analyze_comprehensive_weaknesses(self) -> Dict[str, Any]:
        """
        Comprehensive weakness analysis integrating all data sources
        Returns detailed analysis with knowledge graph insights
        """
        try:
            logger.info(f"Starting comprehensive weakness analysis for user {self.user_id}")
            
            # Get data from all sources
            quiz_weaknesses = self._analyze_quiz_performance()
            flashcard_weaknesses = self._analyze_flashcard_performance()
            chat_weaknesses = self._analyze_chat_patterns()
            
            # Merge and score
            merged_weaknesses = self._merge_and_score_weaknesses(
                quiz_weaknesses, flashcard_weaknesses, chat_weaknesses
            )
            
            # Get knowledge graph insights if available
            if self.kg_client:
                kg_insights = await self._get_knowledge_graph_insights(merged_weaknesses)
                merged_weaknesses = self._enrich_with_kg_insights(merged_weaknesses, kg_insights)
            
            # Categorize by severity
            categorized = self._categorize_weaknesses(merged_weaknesses)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(categorized)
            
            return {
                "status": "success",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": self.user_id,
                "summary": {
                    "total_weaknesses": len(merged_weaknesses),
                    "critical_count": len(categorized["critical"]),
                    "high_priority_count": len(categorized["high_priority"]),
                    "medium_priority_count": len(categorized["medium_priority"]),
                    "low_priority_count": len(categorized["low_priority"])
                },
                "weaknesses": categorized,
                "recommendations": recommendations,
                "knowledge_graph_available": self.kg_client is not None
            }
            
        except Exception as e:
            logger.error(f"Error in comprehensive weakness analysis: {e}")
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "error": str(e),
                "weaknesses": {"critical": [], "high_priority": [], "medium_priority": [], "low_priority": []}
            }
    
    def _analyze_quiz_performance(self) -> Dict[str, Dict]:
        """Analyze quiz performance from UserWeakArea table"""
        weaknesses = {}
        
        try:
            weak_areas = self.db.query(self.models.UserWeakArea).filter(
                self.models.UserWeakArea.user_id == self.user_id
            ).all()
            
            for wa in weak_areas:
                weaknesses[wa.topic] = {
                    "source": "quiz",
                    "total_attempts": wa.total_questions,
                    "correct": wa.correct_count,
                    "incorrect": wa.incorrect_count,
                    "accuracy": wa.accuracy,
                    "consecutive_wrong": wa.consecutive_wrong,
                    "last_updated": wa.last_updated,
                    "priority": wa.priority,
                    "status": wa.status
                }
            
            logger.info(f"Found {len(weaknesses)} quiz weaknesses")
        except Exception as e:
            logger.error(f"Error analyzing quiz performance: {e}")
        
        return weaknesses
    
    def _analyze_flashcard_performance(self) -> Dict[str, Dict]:
        """Analyze flashcard performance with detailed card-level insights"""
        weaknesses = {}
        
        try:
            flashcard_sets = self.db.query(self.models.FlashcardSet).filter(
                self.models.FlashcardSet.user_id == self.user_id
            ).all()
            
            for fs in flashcard_sets:
                cards = self.db.query(self.models.Flashcard).filter(
                    self.models.Flashcard.set_id == fs.id
                ).all()
                
                if not cards:
                    continue
                
                total_reviews = sum(c.times_reviewed or 0 for c in cards)
                total_correct = sum(c.correct_count or 0 for c in cards)
                marked_count = sum(1 for c in cards if c.marked_for_review)
                dont_know_count = sum((c.times_reviewed or 0) - (c.correct_count or 0) for c in cards)
                
                if total_reviews > 0:
                    accuracy = (total_correct / total_reviews * 100)
                    
                    # Find struggling cards
                    struggling_cards = []
                    for card in cards:
                        if card.times_reviewed >= 3:
                            card_accuracy = (card.correct_count / card.times_reviewed) if card.times_reviewed > 0 else 0
                            if card_accuracy < 0.5 or card.marked_for_review:
                                struggling_cards.append({
                                    "id": card.id,
                                    "question": card.question[:150],
                                    "answer": card.answer[:150],
                                    "times_reviewed": card.times_reviewed,
                                    "correct_count": card.correct_count,
                                    "accuracy": card_accuracy * 100,
                                    "marked": card.marked_for_review
                                })
                    
                    weaknesses[fs.title] = {
                        "source": "flashcard",
                        "total_attempts": total_reviews,
                        "correct": total_correct,
                        "dont_know_count": dont_know_count,
                        "marked_for_review": marked_count,
                        "accuracy": accuracy,
                        "card_count": len(cards),
                        "struggling_cards": struggling_cards[:10],  # Top 10
                        "is_weak": accuracy < 60 or marked_count >= 3 or dont_know_count >= 5
                    }
            
            logger.info(f"Found {len(weaknesses)} flashcard weaknesses")
        except Exception as e:
            logger.error(f"Error analyzing flashcard performance: {e}")
        
        return weaknesses
    
    def _analyze_chat_patterns(self) -> Dict[str, Dict]:
        """Analyze chat patterns for repeated questions and confusion"""
        weaknesses = {}
        
        try:
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            chat_messages = self.db.query(self.models.ChatMessage).join(
                self.models.ChatSession
            ).filter(
                self.models.ChatSession.user_id == self.user_id,
                self.models.ChatMessage.timestamp >= thirty_days_ago
            ).order_by(self.models.ChatMessage.timestamp.desc()).limit(500).all()
            
            # Track topic mentions
            topic_mentions = defaultdict(lambda: {
                "mentions": 0,
                "confusion_indicators": 0,
                "question_count": 0,
                "timestamps": [],
                "messages": []
            })
            
            confusion_keywords = [
                'what', 'how', 'why', 'explain', 'help', 'understand',
                'confused', "don't get", 'stuck', 'struggling', 'difficult',
                'can you', 'could you', 'not sure', 'unclear'
            ]
            
            for msg in chat_messages:
                if not msg.user_message:
                    continue
                
                user_msg = msg.user_message.lower()
                has_confusion = any(kw in user_msg for kw in confusion_keywords)
                
                # Extract topics (words longer than 4 chars)
                words = re.findall(r'\b[a-zA-Z]{5,}\b', user_msg)
                for word in set(words):
                    topic = word.capitalize()
                    topic_mentions[topic]["mentions"] += 1
                    topic_mentions[topic]["timestamps"].append(msg.timestamp)
                    topic_mentions[topic]["messages"].append(user_msg[:200])
                    
                    if has_confusion:
                        topic_mentions[topic]["confusion_indicators"] += 1
                    if '?' in user_msg:
                        topic_mentions[topic]["question_count"] += 1
            
            # Filter topics with 3+ mentions
            for topic, data in topic_mentions.items():
                if data["mentions"] >= 3:
                    # Check for repeated questions within short time
                    timestamps = sorted(data["timestamps"])
                    repeated_within_week = 0
                    for i in range(len(timestamps) - 1):
                        if (timestamps[i+1] - timestamps[i]).days <= 7:
                            repeated_within_week += 1
                    
                    is_doubtful = (data["mentions"] >= 3) or (data["confusion_indicators"] >= 2)
                    
                    if is_doubtful:
                        weaknesses[topic] = {
                            "source": "chat",
                            "mentions": data["mentions"],
                            "confusion_indicators": data["confusion_indicators"],
                            "question_count": data["question_count"],
                            "repeated_within_week": repeated_within_week,
                            "is_doubtful": True,
                            "sample_messages": data["messages"][:3]
                        }
            
            logger.info(f"Found {len(weaknesses)} chat-based weaknesses")
        except Exception as e:
            logger.error(f"Error analyzing chat patterns: {e}")
        
        return weaknesses
    
    def _merge_and_score_weaknesses(
        self, 
        quiz_data: Dict, 
        flashcard_data: Dict, 
        chat_data: Dict
    ) -> List[Dict]:
        """Merge all weakness sources and calculate severity scores"""
        
        # Collect all unique topics
        all_topics = set(list(quiz_data.keys()) + list(flashcard_data.keys()) + list(chat_data.keys()))
        
        merged = []
        
        for topic in all_topics:
            quiz_info = quiz_data.get(topic, {})
            flash_info = flashcard_data.get(topic, {})
            chat_info = chat_data.get(topic, {})
            
            # Calculate totals
            total_attempts = quiz_info.get("total_attempts", 0) + flash_info.get("total_attempts", 0)
            total_correct = quiz_info.get("correct", 0) + flash_info.get("correct", 0)
            total_incorrect = quiz_info.get("incorrect", 0) + flash_info.get("dont_know_count", 0)
            
            accuracy = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            # Calculate severity score (0-100)
            severity = 0
            
            # Factor 1: Low accuracy (40 points)
            if accuracy < 30:
                severity += 40
            elif accuracy < 50:
                severity += 30
            elif accuracy < 70:
                severity += 20
            elif accuracy < 85:
                severity += 10
            
            # Factor 2: Volume of mistakes (25 points)
            if total_incorrect >= 10:
                severity += 25
            elif total_incorrect >= 5:
                severity += 15
            elif total_incorrect >= 3:
                severity += 8
            
            # Factor 3: Multiple sources (20 points)
            sources = []
            if quiz_info:
                sources.append("quiz")
            if flash_info and flash_info.get("is_weak"):
                sources.append("flashcard")
            if chat_info and chat_info.get("is_doubtful"):
                sources.append("chat")
            
            severity += len(sources) * 7
            
            # Factor 4: Recency (15 points)
            most_recent = quiz_info.get("last_updated") or flash_info.get("last_updated")
            if most_recent:
                days_ago = (datetime.utcnow() - most_recent).days
                if days_ago <= 1:
                    severity += 15
                elif days_ago <= 3:
                    severity += 10
                elif days_ago <= 7:
                    severity += 5
            
            # Bonus: Chat confusion
            if chat_info.get("is_doubtful"):
                severity += 15
                if chat_info.get("repeated_within_week", 0) >= 2:
                    severity += 10
            
            severity = min(100, severity)
            
            # Determine priority
            if severity >= 75:
                priority = "critical"
            elif severity >= 55:
                priority = "high_priority"
            elif severity >= 35:
                priority = "medium_priority"
            else:
                priority = "low_priority"
            
            merged.append({
                "topic": topic,
                "severity_score": severity,
                "priority": priority,
                "accuracy": round(accuracy, 1),
                "total_attempts": total_attempts,
                "total_correct": total_correct,
                "total_incorrect": total_incorrect,
                "sources": sources,
                "quiz_data": quiz_info,
                "flashcard_data": flash_info,
                "chat_data": chat_info,
                "last_activity": most_recent
            })
        
        # Sort by severity
        merged.sort(key=lambda x: x["severity_score"], reverse=True)
        
        return merged
    
    async def _get_knowledge_graph_insights(self, weaknesses: List[Dict]) -> Dict[str, Any]:
        """Get knowledge graph insights for weak topics"""
        if not self.kg_client:
            return {}
        
        insights = {}
        
        try:
            for weakness in weaknesses[:10]:  # Top 10 weaknesses
                topic = weakness["topic"]
                
                # Query knowledge graph for prerequisites and related concepts
                query = """
                MATCH (c:Concept {name: $topic})
                OPTIONAL MATCH (prereq:Concept)-[:PREREQUISITE_OF]->(c)
                OPTIONAL MATCH (c)-[:RELATED_TO]-(related:Concept)
                OPTIONAL MATCH (c)-[:PART_OF]->(t:Topic)
                RETURN c, collect(DISTINCT prereq) as prerequisites, 
                       collect(DISTINCT related) as related_concepts,
                       t.name as parent_topic
                """
                
                async with self.kg_client.session() as session:
                    result = await session.run(query, {"topic": topic})
                    record = await result.single()
                    
                    if record:
                        insights[topic] = {
                            "prerequisites": [p["name"] for p in record["prerequisites"] if p],
                            "related_concepts": [r["name"] for r in record["related_concepts"] if r],
                            "parent_topic": record["parent_topic"],
                            "has_kg_data": True
                        }
                    else:
                        insights[topic] = {"has_kg_data": False}
        
        except Exception as e:
            logger.error(f"Error getting knowledge graph insights: {e}")
        
        return insights
    
    def _enrich_with_kg_insights(self, weaknesses: List[Dict], kg_insights: Dict) -> List[Dict]:
        """Enrich weakness data with knowledge graph insights"""
        for weakness in weaknesses:
            topic = weakness["topic"]
            if topic in kg_insights:
                weakness["knowledge_graph"] = kg_insights[topic]
        
        return weaknesses
    
    def _categorize_weaknesses(self, weaknesses: List[Dict]) -> Dict[str, List[Dict]]:
        """Categorize weaknesses by priority"""
        return {
            "critical": [w for w in weaknesses if w["priority"] == "critical"],
            "high_priority": [w for w in weaknesses if w["priority"] == "high_priority"],
            "medium_priority": [w for w in weaknesses if w["priority"] == "medium_priority"],
            "low_priority": [w for w in weaknesses if w["priority"] == "low_priority"]
        }
    
    def _generate_recommendations(self, categorized: Dict) -> List[Dict]:
        """Generate personalized study recommendations"""
        recommendations = []
        
        critical = categorized.get("critical", [])
        high_priority = categorized.get("high_priority", [])
        
        if critical:
            top_critical = critical[0]
            recommendations.append({
                "type": "urgent",
                "title": f"Focus on {top_critical['topic']}",
                "description": f"This is your highest priority area with {top_critical['accuracy']}% accuracy. Start here immediately.",
                "action": "practice",
                "topic": top_critical['topic'],
                "estimated_time": "30-45 minutes"
            })
        
        if len(critical) > 1:
            recommendations.append({
                "type": "urgent",
                "title": "Address Critical Weaknesses",
                "description": f"You have {len(critical)} critical areas that need immediate attention.",
                "action": "review_list",
                "topics": [c['topic'] for c in critical],
                "estimated_time": "2-3 hours"
            })
        
        if high_priority:
            recommendations.append({
                "type": "important",
                "title": "Practice High-Priority Topics",
                "description": f"Work on {len(high_priority)} topics that need regular practice.",
                "action": "practice_session",
                "topics": [h['topic'] for h in high_priority[:5]],
                "estimated_time": "1-2 hours"
            })
        
        # Add knowledge graph-based recommendations
        for weakness in (critical + high_priority)[:3]:
            if weakness.get("knowledge_graph", {}).get("prerequisites"):
                prereqs = weakness["knowledge_graph"]["prerequisites"]
                recommendations.append({
                    "type": "foundation",
                    "title": f"Review Prerequisites for {weakness['topic']}",
                    "description": f"Strengthen your foundation by reviewing: {', '.join(prereqs)}",
                    "action": "review_prerequisites",
                    "topic": weakness['topic'],
                    "prerequisites": prereqs,
                    "estimated_time": "45-60 minutes"
                })
        
        return recommendations


# ==================== AI QUESTION GENERATOR ====================

class AIQuestionGenerator:
    """
    AI-powered question generator that creates custom questions
    based on user weaknesses and learning patterns
    """
    
    def __init__(self, ai_client, db: Session, models):
        self.ai_client = ai_client
        self.db = db
        self.models = models
    
    async def generate_custom_questions(
        self, 
        topic: str, 
        difficulty: str, 
        count: int = 5,
        question_types: List[str] = None,
        user_context: Dict = None
    ) -> List[Dict]:
        """
        Generate custom questions for a specific topic
        """
        try:
            logger.info(f"Generating {count} {difficulty} questions for topic: {topic}")
            
            # Build context
            context = self._build_question_context(topic, user_context)
            
            # Generate questions using AI
            prompt = self._build_question_prompt(topic, difficulty, count, question_types, context)
            
            response = self.ai_client.generate(prompt, max_tokens=3000, temperature=0.8)
            
            # Parse response
            questions = self._parse_question_response(response, topic, difficulty)
            
            logger.info(f"Successfully generated {len(questions)} questions")
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            return []
    
    def _build_question_context(self, topic: str, user_context: Dict = None) -> str:
        """Build context for question generation"""
        context_parts = [f"Topic: {topic}"]
        
        if user_context:
            if user_context.get("struggling_cards"):
                context_parts.append(f"User struggled with: {', '.join([c['question'][:50] for c in user_context['struggling_cards'][:3]])}")
            
            if user_context.get("common_mistakes"):
                context_parts.append(f"Common mistakes: {', '.join(user_context['common_mistakes'][:3])}")
            
            if user_context.get("accuracy"):
                context_parts.append(f"Current accuracy: {user_context['accuracy']}%")
        
        return "\n".join(context_parts)
    
    def _build_question_prompt(
        self, 
        topic: str, 
        difficulty: str, 
        count: int,
        question_types: List[str],
        context: str
    ) -> str:
        """Build AI prompt for question generation"""
        
        types_str = ", ".join(question_types) if question_types else "multiple choice, true/false, short answer"
        
        prompt = f"""You are an expert educator creating practice questions for a student.

{context}

Generate {count} {difficulty}-level questions about {topic}.

Question types to include: {types_str}

Requirements:
1. Questions should be clear, specific, and educational
2. Difficulty level: {difficulty} (beginner/intermediate/advanced/expert)
3. Include detailed explanations for correct answers
4. For multiple choice, provide 4 options with one correct answer
5. Questions should test understanding, not just memorization
6. Build on the context provided about the student's struggles

Format your response as a JSON array:
[
  {{
    "question": "Question text here",
    "type": "multiple_choice|true_false|short_answer",
    "options": ["A", "B", "C", "D"],  // Only for multiple choice
    "correct_answer": "Correct answer",
    "explanation": "Detailed explanation of why this is correct",
    "difficulty": "{difficulty}",
    "topic": "{topic}",
    "subtopic": "Specific subtopic if applicable",
    "hints": ["Hint 1", "Hint 2"]
  }},
  ...
]

Return ONLY valid JSON, no markdown formatting."""
        
        return prompt
    
    def _parse_question_response(self, response: str, topic: str, difficulty: str) -> List[Dict]:
        """Parse AI response into structured questions"""
        try:
            # Remove markdown code blocks if present
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response, flags=re.DOTALL)
                response = re.sub(r'\n?```$', '', response, flags=re.DOTALL)
                response = response.strip()
            
            questions = json.loads(response)
            
            # Validate and enrich questions
            validated = []
            for q in questions:
                if self._validate_question(q):
                    q["generated_at"] = datetime.utcnow().isoformat()
                    q["topic"] = topic
                    q["difficulty"] = difficulty
                    validated.append(q)
            
            return validated
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse question JSON: {e}")
            logger.error(f"Response was: {response[:500]}")
            return []
    
    def _validate_question(self, question: Dict) -> bool:
        """Validate question structure"""
        required_fields = ["question", "type", "correct_answer", "explanation"]
        
        for field in required_fields:
            if field not in question or not question[field]:
                logger.warning(f"Question missing required field: {field}")
                return False
        
        # Validate multiple choice has options
        if question["type"] == "multiple_choice":
            if "options" not in question or len(question["options"]) < 2:
                logger.warning("Multiple choice question missing options")
                return False
        
        return True
    
    async def generate_adaptive_questions(
        self,
        user_id: int,
        topic: str,
        session_performance: Dict
    ) -> List[Dict]:
        """
        Generate adaptive questions based on real-time session performance
        """
        try:
            # Analyze session performance
            accuracy = session_performance.get("accuracy", 0)
            response_times = session_performance.get("response_times", [])
            wrong_answers = session_performance.get("wrong_answers", [])
            
            # Determine difficulty adjustment
            if accuracy >= 80:
                difficulty = "advanced"
            elif accuracy >= 60:
                difficulty = "intermediate"
            else:
                difficulty = "beginner"
            
            # Build context from wrong answers
            user_context = {
                "accuracy": accuracy,
                "common_mistakes": [wa.get("user_answer") for wa in wrong_answers[:3]],
                "avg_response_time": sum(response_times) / len(response_times) if response_times else 0
            }
            
            # Generate questions
            questions = await self.generate_custom_questions(
                topic=topic,
                difficulty=difficulty,
                count=5,
                user_context=user_context
            )
            
            return questions
            
        except Exception as e:
            logger.error(f"Error generating adaptive questions: {e}")
            return []


# ==================== PRACTICE SESSION MANAGER ====================

class PracticeSessionManager:
    """
    Manages practice sessions with real-time adaptation,
    progress tracking, and performance analytics
    """
    
    def __init__(self, db: Session, models, ai_client, question_generator):
        self.db = db
        self.models = models
        self.ai_client = ai_client
        self.question_generator = question_generator
        self.active_sessions = {}  # session_id -> session_data
    
    def start_practice_session(
        self, 
        user_id: int, 
        topic: str, 
        difficulty: str = "intermediate",
        question_count: int = 10
    ) -> Dict[str, Any]:
        """Start a new practice session"""
        try:
            session_id = f"{user_id}_{topic}_{datetime.utcnow().timestamp()}"
            
            # Create session record
            session = self.models.PracticeSession(
                user_id=user_id,
                topic=topic,
                difficulty=difficulty,
                target_question_count=question_count,
                started_at=datetime.utcnow(),
                status="active"
            )
            self.db.add(session)
            self.db.commit()
            self.db.refresh(session)
            
            # Initialize session data
            self.active_sessions[session_id] = {
                "session_id": session.id,
                "user_id": user_id,
                "topic": topic,
                "difficulty": difficulty,
                "started_at": datetime.utcnow(),
                "questions_answered": 0,
                "correct_answers": 0,
                "wrong_answers": [],
                "response_times": [],
                "current_streak": 0,
                "max_streak": 0,
                "questions": [],
                "current_question_index": 0
            }
            
            logger.info(f"Started practice session {session_id} for user {user_id} on topic {topic}")
            
            return {
                "status": "success",
                "session_id": session_id,
                "db_session_id": session.id,
                "topic": topic,
                "difficulty": difficulty,
                "target_questions": question_count
            }
            
        except Exception as e:
            logger.error(f"Error starting practice session: {e}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    async def get_next_question(self, session_id: str) -> Dict[str, Any]:
        """Get next question for the session with adaptive difficulty"""
        try:
            if session_id not in self.active_sessions:
                return {"status": "error", "error": "Session not found"}
            
            session_data = self.active_sessions[session_id]
            
            # Check if we need to generate more questions
            if session_data["current_question_index"] >= len(session_data["questions"]):
                # Generate adaptive questions based on performance
                performance = {
                    "accuracy": (session_data["correct_answers"] / max(session_data["questions_answered"], 1)) * 100,
                    "response_times": session_data["response_times"],
                    "wrong_answers": session_data["wrong_answers"]
                }
                
                new_questions = await self.question_generator.generate_adaptive_questions(
                    user_id=session_data["user_id"],
                    topic=session_data["topic"],
                    session_performance=performance
                )
                
                session_data["questions"].extend(new_questions)
            
            # Get current question
            if session_data["current_question_index"] < len(session_data["questions"]):
                question = session_data["questions"][session_data["current_question_index"]]
                
                return {
                    "status": "success",
                    "question": question,
                    "question_number": session_data["questions_answered"] + 1,
                    "total_questions": len(session_data["questions"]),
                    "current_streak": session_data["current_streak"],
                    "accuracy": (session_data["correct_answers"] / max(session_data["questions_answered"], 1)) * 100 if session_data["questions_answered"] > 0 else 0
                }
            else:
                return {"status": "complete", "message": "No more questions available"}
                
        except Exception as e:
            logger.error(f"Error getting next question: {e}")
            return {"status": "error", "error": str(e)}
    
    def submit_answer(
        self, 
        session_id: str, 
        question_id: str, 
        user_answer: str,
        time_taken: int
    ) -> Dict[str, Any]:
        """Submit answer and get immediate feedback"""
        try:
            if session_id not in self.active_sessions:
                return {"status": "error", "error": "Session not found"}
            
            session_data = self.active_sessions[session_id]
            current_question = session_data["questions"][session_data["current_question_index"]]
            
            # Check if answer is correct
            is_correct = self._check_answer(user_answer, current_question["correct_answer"], current_question["type"])
            
            # Update session data
            session_data["questions_answered"] += 1
            session_data["response_times"].append(time_taken)
            
            if is_correct:
                session_data["correct_answers"] += 1
                session_data["current_streak"] += 1
                session_data["max_streak"] = max(session_data["max_streak"], session_data["current_streak"])
            else:
                session_data["current_streak"] = 0
                session_data["wrong_answers"].append({
                    "question": current_question["question"],
                    "user_answer": user_answer,
                    "correct_answer": current_question["correct_answer"],
                    "explanation": current_question["explanation"]
                })
            
            # Move to next question
            session_data["current_question_index"] += 1
            
            # Save answer to database
            answer_record = self.models.PracticeAnswer(
                session_id=session_data["session_id"],
                question_text=current_question["question"],
                user_answer=user_answer,
                correct_answer=current_question["correct_answer"],
                is_correct=is_correct,
                time_taken=time_taken,
                answered_at=datetime.utcnow()
            )
            self.db.add(answer_record)
            self.db.commit()
            
            # Calculate current accuracy
            accuracy = (session_data["correct_answers"] / session_data["questions_answered"]) * 100
            
            return {
                "status": "success",
                "is_correct": is_correct,
                "correct_answer": current_question["correct_answer"],
                "explanation": current_question["explanation"],
                "hints": current_question.get("hints", []),
                "current_streak": session_data["current_streak"],
                "accuracy": accuracy,
                "questions_answered": session_data["questions_answered"],
                "feedback": self._generate_feedback(is_correct, accuracy, session_data["current_streak"])
            }
            
        except Exception as e:
            logger.error(f"Error submitting answer: {e}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    def _check_answer(self, user_answer: str, correct_answer: str, question_type: str) -> bool:
        """Check if user answer is correct"""
        user_answer = user_answer.strip().lower()
        correct_answer = correct_answer.strip().lower()
        
        if question_type == "multiple_choice":
            return user_answer == correct_answer
        elif question_type == "true_false":
            return user_answer in ["true", "false"] and user_answer == correct_answer
        elif question_type == "short_answer":
            # Fuzzy matching for short answers
            return user_answer in correct_answer or correct_answer in user_answer
        else:
            return user_answer == correct_answer
    
    def _generate_feedback(self, is_correct: bool, accuracy: float, streak: int) -> str:
        """Generate encouraging feedback"""
        if is_correct:
            if streak >= 5:
                return f"🔥 Amazing! {streak} in a row! You're on fire!"
            elif streak >= 3:
                return f"✨ Great job! {streak} correct answers in a row!"
            elif accuracy >= 80:
                return "✅ Correct! You're doing excellent!"
            else:
                return "✅ That's right! Keep it up!"
        else:
            if accuracy < 50:
                return "📚 Don't worry, learning takes time. Review the explanation and try again!"
            else:
                return "❌ Not quite, but you're making progress. Check the explanation!"
    
    def end_practice_session(self, session_id: str) -> Dict[str, Any]:
        """End practice session and generate summary"""
        try:
            if session_id not in self.active_sessions:
                return {"status": "error", "error": "Session not found"}
            
            session_data = self.active_sessions[session_id]
            
            # Calculate final statistics
            total_questions = session_data["questions_answered"]
            correct = session_data["correct_answers"]
            accuracy = (correct / total_questions * 100) if total_questions > 0 else 0
            avg_time = sum(session_data["response_times"]) / len(session_data["response_times"]) if session_data["response_times"] else 0
            
            # Update database session
            db_session = self.db.query(self.models.PracticeSession).filter(
                self.models.PracticeSession.id == session_data["session_id"]
            ).first()
            
            if db_session:
                db_session.questions_answered = total_questions
                db_session.correct_answers = correct
                db_session.accuracy = accuracy
                db_session.max_streak = session_data["max_streak"]
                db_session.avg_response_time = avg_time
                db_session.completed_at = datetime.utcnow()
                db_session.status = "completed"
                self.db.commit()
            
            # Generate summary
            summary = {
                "status": "success",
                "session_id": session_id,
                "topic": session_data["topic"],
                "duration_minutes": (datetime.utcnow() - session_data["started_at"]).seconds / 60,
                "statistics": {
                    "total_questions": total_questions,
                    "correct_answers": correct,
                    "wrong_answers": total_questions - correct,
                    "accuracy": round(accuracy, 1),
                    "max_streak": session_data["max_streak"],
                    "avg_response_time": round(avg_time, 1)
                },
                "wrong_answers_review": session_data["wrong_answers"],
                "performance_level": self._get_performance_level(accuracy),
                "recommendations": self._generate_session_recommendations(session_data, accuracy)
            }
            
            # Clean up active session
            del self.active_sessions[session_id]
            
            logger.info(f"Ended practice session {session_id} with {accuracy}% accuracy")
            
            return summary
            
        except Exception as e:
            logger.error(f"Error ending practice session: {e}")
            return {"status": "error", "error": str(e)}
    
    def _get_performance_level(self, accuracy: float) -> str:
        """Get performance level description"""
        if accuracy >= 90:
            return "Excellent - Mastery Level"
        elif accuracy >= 75:
            return "Good - Strong Understanding"
        elif accuracy >= 60:
            return "Fair - Needs More Practice"
        elif accuracy >= 40:
            return "Developing - Keep Practicing"
        else:
            return "Needs Improvement - Review Fundamentals"
    
    def _generate_session_recommendations(self, session_data: Dict, accuracy: float) -> List[str]:
        """Generate recommendations based on session performance"""
        recommendations = []
        
        if accuracy < 60:
            recommendations.append(f"Review the fundamentals of {session_data['topic']} before continuing")
            recommendations.append("Consider studying prerequisite topics")
        elif accuracy < 80:
            recommendations.append(f"Practice more questions on {session_data['topic']}")
            recommendations.append("Focus on the areas where you made mistakes")
        else:
            recommendations.append(f"Great job! Consider moving to more advanced {session_data['topic']} topics")
            recommendations.append("Try increasing the difficulty level")
        
        if session_data["wrong_answers"]:
            recommendations.append(f"Review the {len(session_data['wrong_answers'])} questions you got wrong")
        
        if session_data["max_streak"] >= 5:
            recommendations.append("Excellent focus! Your streak shows strong understanding")
        
        return recommendations



# ==================== MASTERY TRACKER ====================

class MasteryTracker:
    """
    Tracks user mastery levels for topics and concepts
    Integrates with knowledge graph for prerequisite tracking
    """
    
    def __init__(self, db: Session, models, kg_client=None):
        self.db = db
        self.models = models
        self.kg_client = kg_client
    
    def update_mastery(
        self, 
        user_id: int, 
        topic: str, 
        performance_data: Dict
    ) -> Dict[str, Any]:
        """Update mastery level based on performance"""
        try:
            # Get or create mastery record
            mastery = self.db.query(self.models.TopicMastery).filter(
                and_(
                    self.models.TopicMastery.user_id == user_id,
                    self.models.TopicMastery.topic_name == topic
                )
            ).first()
            
            if not mastery:
                mastery = self.models.TopicMastery(
                    user_id=user_id,
                    topic_name=topic,
                    mastery_level=0.0,
                    practice_count=0
                )
                self.db.add(mastery)
            
            # Calculate new mastery level
            accuracy = performance_data.get("accuracy", 0) / 100
            consistency = performance_data.get("consistency", 0.5)
            recency_factor = performance_data.get("recency_factor", 1.0)
            
            # Mastery formula: weighted average of accuracy, consistency, and current mastery
            new_mastery = (
                mastery.mastery_level * 0.6 +  # 60% weight to previous mastery
                accuracy * 0.3 +  # 30% weight to recent accuracy
                consistency * 0.1  # 10% weight to consistency
            ) * recency_factor
            
            mastery.mastery_level = min(1.0, new_mastery)
            mastery.practice_count += 1
            mastery.last_practiced = datetime.utcnow()
            
            # Update confidence score
            if accuracy >= 0.8:
                mastery.confidence_score = min(1.0, mastery.confidence_score + 0.1)
            elif accuracy < 0.5:
                mastery.confidence_score = max(0.0, mastery.confidence_score - 0.1)
            
            self.db.commit()
            self.db.refresh(mastery)
            
            logger.info(f"Updated mastery for {topic}: {mastery.mastery_level:.2f}")
            
            return {
                "status": "success",
                "topic": topic,
                "mastery_level": round(mastery.mastery_level, 3),
                "confidence_score": round(mastery.confidence_score, 3),
                "practice_count": mastery.practice_count,
                "mastery_category": self._get_mastery_category(mastery.mastery_level)
            }
            
        except Exception as e:
            logger.error(f"Error updating mastery: {e}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    def _get_mastery_category(self, mastery_level: float) -> str:
        """Get mastery category description"""
        if mastery_level >= 0.9:
            return "Expert"
        elif mastery_level >= 0.75:
            return "Advanced"
        elif mastery_level >= 0.5:
            return "Intermediate"
        elif mastery_level >= 0.25:
            return "Beginner"
        else:
            return "Novice"
    
    def get_mastery_overview(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive mastery overview"""
        try:
            masteries = self.db.query(self.models.TopicMastery).filter(
                self.models.TopicMastery.user_id == user_id
            ).order_by(self.models.TopicMastery.mastery_level.desc()).all()
            
            overview = {
                "total_topics": len(masteries),
                "expert_topics": len([m for m in masteries if m.mastery_level >= 0.9]),
                "advanced_topics": len([m for m in masteries if 0.75 <= m.mastery_level < 0.9]),
                "intermediate_topics": len([m for m in masteries if 0.5 <= m.mastery_level < 0.75]),
                "beginner_topics": len([m for m in masteries if m.mastery_level < 0.5]),
                "avg_mastery": sum(m.mastery_level for m in masteries) / len(masteries) if masteries else 0,
                "topics": [
                    {
                        "topic": m.topic_name,
                        "mastery_level": round(m.mastery_level, 3),
                        "confidence": round(m.confidence_score, 3),
                        "practice_count": m.practice_count,
                        "last_practiced": m.last_practiced.isoformat() if m.last_practiced else None,
                        "category": self._get_mastery_category(m.mastery_level)
                    }
                    for m in masteries
                ]
            }
            
            return overview
            
        except Exception as e:
            logger.error(f"Error getting mastery overview: {e}")
            return {"total_topics": 0, "topics": []}
    
    async def get_prerequisite_mastery(self, user_id: int, topic: str) -> Dict[str, Any]:
        """Check mastery of prerequisites for a topic"""
        if not self.kg_client:
            return {"has_kg_data": False}
        
        try:
            # Query knowledge graph for prerequisites
            query = """
            MATCH (c:Concept {name: $topic})
            MATCH (prereq:Concept)-[:PREREQUISITE_OF]->(c)
            RETURN prereq.name as prerequisite
            """
            
            prerequisites = []
            async with self.kg_client.session() as session:
                result = await session.run(query, {"topic": topic})
                async for record in result:
                    prerequisites.append(record["prerequisite"])
            
            if not prerequisites:
                return {"has_prerequisites": False}
            
            # Get mastery levels for prerequisites
            prereq_mastery = []
            for prereq in prerequisites:
                mastery = self.db.query(self.models.TopicMastery).filter(
                    and_(
                        self.models.TopicMastery.user_id == user_id,
                        self.models.TopicMastery.topic_name == prereq
                    )
                ).first()
                
                prereq_mastery.append({
                    "topic": prereq,
                    "mastery_level": mastery.mastery_level if mastery else 0.0,
                    "is_sufficient": (mastery.mastery_level >= 0.6) if mastery else False
                })
            
            all_sufficient = all(p["is_sufficient"] for p in prereq_mastery)
            
            return {
                "has_prerequisites": True,
                "prerequisites": prereq_mastery,
                "all_prerequisites_met": all_sufficient,
                "recommendation": "You're ready to learn this topic!" if all_sufficient else "Consider reviewing prerequisites first"
            }
            
        except Exception as e:
            logger.error(f"Error checking prerequisite mastery: {e}")
            return {"has_kg_data": False, "error": str(e)}


# ==================== PROGRESS ANALYTICS ====================

class ProgressAnalytics:
    """
    Comprehensive progress analytics and insights
    """
    
    def __init__(self, db: Session, models):
        self.db = db
        self.models = models
    
    def get_weekly_progress(self, user_id: int) -> Dict[str, Any]:
        """Get weekly progress summary"""
        try:
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            
            # Get practice sessions from last 7 days
            sessions = self.db.query(self.models.PracticeSession).filter(
                and_(
                    self.models.PracticeSession.user_id == user_id,
                    self.models.PracticeSession.started_at >= seven_days_ago,
                    self.models.PracticeSession.status == "completed"
                )
            ).all()
            
            if not sessions:
                return {"has_data": False, "message": "No practice sessions in the last 7 days"}
            
            # Calculate statistics
            total_questions = sum(s.questions_answered for s in sessions)
            total_correct = sum(s.correct_answers for s in sessions)
            total_time = sum((s.completed_at - s.started_at).seconds / 60 for s in sessions if s.completed_at)
            
            # Group by day
            daily_stats = defaultdict(lambda: {"questions": 0, "correct": 0, "sessions": 0})
            for session in sessions:
                day = session.started_at.date().isoformat()
                daily_stats[day]["questions"] += session.questions_answered
                daily_stats[day]["correct"] += session.correct_answers
                daily_stats[day]["sessions"] += 1
            
            # Calculate trends
            accuracies = [(s.correct_answers / s.questions_answered * 100) if s.questions_answered > 0 else 0 for s in sessions]
            avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else 0
            
            return {
                "has_data": True,
                "period": "last_7_days",
                "summary": {
                    "total_sessions": len(sessions),
                    "total_questions": total_questions,
                    "total_correct": total_correct,
                    "overall_accuracy": round((total_correct / total_questions * 100) if total_questions > 0 else 0, 1),
                    "total_time_minutes": round(total_time, 1),
                    "avg_session_time": round(total_time / len(sessions), 1) if sessions else 0
                },
                "daily_breakdown": dict(daily_stats),
                "trends": {
                    "accuracy_trend": "improving" if len(accuracies) >= 2 and accuracies[-1] > accuracies[0] else "stable",
                    "avg_accuracy": round(avg_accuracy, 1)
                },
                "most_practiced_topics": self._get_most_practiced_topics(sessions)
            }
            
        except Exception as e:
            logger.error(f"Error getting weekly progress: {e}")
            return {"has_data": False, "error": str(e)}
    
    def _get_most_practiced_topics(self, sessions: List) -> List[Dict]:
        """Get most practiced topics from sessions"""
        topic_counts = defaultdict(int)
        for session in sessions:
            topic_counts[session.topic] += 1
        
        sorted_topics = sorted(topic_counts.items(), key=lambda x: x[1], reverse=True)
        
        return [
            {"topic": topic, "session_count": count}
            for topic, count in sorted_topics[:5]
        ]
    
    def get_improvement_metrics(self, user_id: int, topic: str) -> Dict[str, Any]:
        """Get improvement metrics for a specific topic"""
        try:
            # Get all sessions for this topic
            sessions = self.db.query(self.models.PracticeSession).filter(
                and_(
                    self.models.PracticeSession.user_id == user_id,
                    self.models.PracticeSession.topic == topic,
                    self.models.PracticeSession.status == "completed"
                )
            ).order_by(self.models.PracticeSession.started_at).all()
            
            if len(sessions) < 2:
                return {"has_data": False, "message": "Need at least 2 sessions to calculate improvement"}
            
            # Calculate improvement
            first_accuracy = (sessions[0].correct_answers / sessions[0].questions_answered * 100) if sessions[0].questions_answered > 0 else 0
            recent_accuracy = (sessions[-1].correct_answers / sessions[-1].questions_answered * 100) if sessions[-1].questions_answered > 0 else 0
            
            improvement = recent_accuracy - first_accuracy
            
            # Calculate average accuracy over time
            accuracies = [
                (s.correct_answers / s.questions_answered * 100) if s.questions_answered > 0 else 0
                for s in sessions
            ]
            
            return {
                "has_data": True,
                "topic": topic,
                "total_sessions": len(sessions),
                "first_session_accuracy": round(first_accuracy, 1),
                "recent_session_accuracy": round(recent_accuracy, 1),
                "improvement_percentage": round(improvement, 1),
                "improvement_trend": "improving" if improvement > 5 else "stable" if improvement > -5 else "declining",
                "average_accuracy": round(sum(accuracies) / len(accuracies), 1),
                "consistency_score": round(1 - (max(accuracies) - min(accuracies)) / 100, 2) if accuracies else 0,
                "session_history": [
                    {
                        "date": s.started_at.isoformat(),
                        "accuracy": round((s.correct_answers / s.questions_answered * 100) if s.questions_answered > 0 else 0, 1),
                        "questions": s.questions_answered
                    }
                    for s in sessions
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting improvement metrics: {e}")
            return {"has_data": False, "error": str(e)}



# ==================== STUDY RECOMMENDATION ENGINE ====================

class StudyRecommendationEngine:
    """
    AI-powered study recommendation engine
    Provides personalized study plans and recommendations
    """
    
    def __init__(self, db: Session, models, ai_client, kg_client=None):
        self.db = db
        self.models = models
        self.ai_client = ai_client
        self.kg_client = kg_client
    
    async def generate_study_plan(
        self, 
        user_id: int, 
        goal: str = "improve_weaknesses",
        duration_weeks: int = 4
    ) -> Dict[str, Any]:
        """Generate personalized study plan"""
        try:
            logger.info(f"Generating {duration_weeks}-week study plan for user {user_id}")
            
            # Get user's weaknesses
            analyzer = EnhancedWeaknessAnalyzer(self.db, user_id, self.models, self.ai_client, self.kg_client)
            weakness_analysis = await analyzer.analyze_comprehensive_weaknesses()
            
            # Get mastery levels
            mastery_tracker = MasteryTracker(self.db, self.models, self.kg_client)
            mastery_overview = mastery_tracker.get_mastery_overview(user_id)
            
            # Build context for AI
            context = self._build_study_plan_context(weakness_analysis, mastery_overview, goal, duration_weeks)
            
            # Generate plan using AI
            prompt = self._build_study_plan_prompt(context, duration_weeks)
            response = self.ai_client.generate(prompt, max_tokens=2500, temperature=0.7)
            
            # Parse response
            study_plan = self._parse_study_plan(response, duration_weeks)
            
            # Save study plan to database
            plan_record = self.models.StudyPlan(
                user_id=user_id,
                goal=goal,
                duration_weeks=duration_weeks,
                plan_data=json.dumps(study_plan),
                created_at=datetime.utcnow(),
                status="active"
            )
            self.db.add(plan_record)
            self.db.commit()
            
            logger.info(f"Generated study plan with {len(study_plan.get('weekly_plans', []))} weeks")
            
            return {
                "status": "success",
                "plan_id": plan_record.id,
                "study_plan": study_plan
            }
            
        except Exception as e:
            logger.error(f"Error generating study plan: {e}")
            return {"status": "error", "error": str(e)}
    
    def _build_study_plan_context(
        self, 
        weakness_analysis: Dict, 
        mastery_overview: Dict,
        goal: str,
        duration_weeks: int
    ) -> str:
        """Build context for study plan generation"""
        context_parts = []
        
        # Add weaknesses
        critical = weakness_analysis.get("weaknesses", {}).get("critical", [])
        if critical:
            context_parts.append(f"Critical weaknesses ({len(critical)}): {', '.join([w['topic'] for w in critical[:5]])}")
        
        high_priority = weakness_analysis.get("weaknesses", {}).get("high_priority", [])
        if high_priority:
            context_parts.append(f"High priority areas ({len(high_priority)}): {', '.join([w['topic'] for w in high_priority[:5]])}")
        
        # Add mastery levels
        expert_topics = [t for t in mastery_overview.get("topics", []) if t["mastery_level"] >= 0.9]
        if expert_topics:
            context_parts.append(f"Expert level topics: {', '.join([t['topic'] for t in expert_topics[:3]])}")
        
        # Add goal
        context_parts.append(f"Goal: {goal}")
        context_parts.append(f"Duration: {duration_weeks} weeks")
        
        return "\n".join(context_parts)
    
    def _build_study_plan_prompt(self, context: str, duration_weeks: int) -> str:
        """Build AI prompt for study plan generation"""
        prompt = f"""You are an expert educational advisor creating a personalized study plan.

Student Context:
{context}

Create a {duration_weeks}-week study plan that:
1. Prioritizes critical weaknesses first
2. Builds on existing strengths
3. Includes daily study goals
4. Provides specific practice recommendations
5. Includes review sessions
6. Is realistic and achievable

Format your response as JSON:
{{
  "overview": {{
    "goal": "Main goal description",
    "focus_areas": ["Area 1", "Area 2", ...],
    "estimated_hours_per_week": 10
  }},
  "weekly_plans": [
    {{
      "week": 1,
      "focus": "Week focus description",
      "topics": ["Topic 1", "Topic 2"],
      "daily_goals": [
        {{"day": "Monday", "goal": "Goal description", "duration_minutes": 60}},
        ...
      ],
      "practice_recommendations": ["Recommendation 1", ...],
      "review_session": "Review session description"
    }},
    ...
  ],
  "milestones": [
    {{"week": 2, "milestone": "Milestone description"}},
    ...
  ],
  "success_metrics": ["Metric 1", "Metric 2", ...]
}}

Return ONLY valid JSON."""
        
        return prompt
    
    def _parse_study_plan(self, response: str, duration_weeks: int) -> Dict:
        """Parse AI response into structured study plan"""
        try:
            # Remove markdown if present
            if response.startswith('```'):
                response = re.sub(r'^```(?:json)?\n?', '', response, flags=re.DOTALL)
                response = re.sub(r'\n?```$', '', response, flags=re.DOTALL)
                response = response.strip()
            
            plan = json.loads(response)
            
            # Validate structure
            if "weekly_plans" not in plan:
                plan["weekly_plans"] = []
            
            if "overview" not in plan:
                plan["overview"] = {"goal": "Improve weaknesses", "focus_areas": []}
            
            return plan
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse study plan JSON: {e}")
            # Return default plan
            return {
                "overview": {
                    "goal": "Improve weaknesses",
                    "focus_areas": [],
                    "estimated_hours_per_week": 10
                },
                "weekly_plans": [],
                "milestones": [],
                "success_metrics": []
            }
    
    def get_daily_recommendations(self, user_id: int) -> Dict[str, Any]:
        """Get daily study recommendations"""
        try:
            # Get active study plan
            active_plan = self.db.query(self.models.StudyPlan).filter(
                and_(
                    self.models.StudyPlan.user_id == user_id,
                    self.models.StudyPlan.status == "active"
                )
            ).order_by(self.models.StudyPlan.created_at.desc()).first()
            
            if not active_plan:
                return {"has_plan": False, "message": "No active study plan"}
            
            # Parse plan data
            plan_data = json.loads(active_plan.plan_data)
            
            # Calculate current week
            weeks_elapsed = (datetime.utcnow() - active_plan.created_at).days // 7
            current_week = min(weeks_elapsed + 1, active_plan.duration_weeks)
            
            # Get current week's plan
            weekly_plans = plan_data.get("weekly_plans", [])
            current_week_plan = next((w for w in weekly_plans if w["week"] == current_week), None)
            
            if not current_week_plan:
                return {"has_plan": True, "message": "Study plan completed"}
            
            # Get today's goal
            today = datetime.utcnow().strftime("%A")
            daily_goals = current_week_plan.get("daily_goals", [])
            today_goal = next((g for g in daily_goals if g["day"] == today), None)
            
            return {
                "has_plan": True,
                "current_week": current_week,
                "total_weeks": active_plan.duration_weeks,
                "week_focus": current_week_plan.get("focus", ""),
                "today_goal": today_goal,
                "week_topics": current_week_plan.get("topics", []),
                "practice_recommendations": current_week_plan.get("practice_recommendations", [])
            }
            
        except Exception as e:
            logger.error(f"Error getting daily recommendations: {e}")
            return {"has_plan": False, "error": str(e)}


# ==================== KNOWLEDGE GRAPH INTEGRATION ====================

class KnowledgeGraphIntegration:
    """
    Integration layer for knowledge graph operations
    """
    
    def __init__(self, kg_client):
        self.kg_client = kg_client
    
    async def get_learning_path(self, start_topic: str, end_topic: str) -> Dict[str, Any]:
        """Get optimal learning path between two topics"""
        if not self.kg_client:
            return {"has_kg": False}
        
        try:
            query = """
            MATCH path = shortestPath(
                (start:Concept {name: $start})-[:PREREQUISITE_OF*]-(end:Concept {name: $end})
            )
            RETURN [node in nodes(path) | node.name] as learning_path
            """
            
            async with self.kg_client.session() as session:
                result = await session.run(query, {"start": start_topic, "end": end_topic})
                record = await result.single()
                
                if record:
                    return {
                        "has_kg": True,
                        "learning_path": record["learning_path"],
                        "steps": len(record["learning_path"]) - 1
                    }
                else:
                    return {"has_kg": True, "learning_path": None, "message": "No path found"}
        
        except Exception as e:
            logger.error(f"Error getting learning path: {e}")
            return {"has_kg": False, "error": str(e)}
    
    async def get_related_concepts(self, topic: str, depth: int = 1) -> Dict[str, Any]:
        """Get related concepts for a topic"""
        if not self.kg_client:
            return {"has_kg": False}
        
        try:
            query = """
            MATCH (c:Concept {name: $topic})
            MATCH (c)-[:RELATED_TO*1..$depth]-(related:Concept)
            RETURN DISTINCT related.name as concept, related.difficulty as difficulty
            ORDER BY related.difficulty
            LIMIT 10
            """
            
            related = []
            async with self.kg_client.session() as session:
                result = await session.run(query, {"topic": topic, "depth": depth})
                async for record in result:
                    related.append({
                        "concept": record["concept"],
                        "difficulty": record["difficulty"]
                    })
            
            return {
                "has_kg": True,
                "topic": topic,
                "related_concepts": related
            }
        
        except Exception as e:
            logger.error(f"Error getting related concepts: {e}")
            return {"has_kg": False, "error": str(e)}
    
    async def update_user_concept_mastery(
        self, 
        user_id: int, 
        concept: str, 
        mastery_level: float
    ) -> Dict[str, Any]:
        """Update user's mastery of a concept in knowledge graph"""
        if not self.kg_client:
            return {"has_kg": False}
        
        try:
            query = """
            MATCH (u:User {id: $user_id})
            MATCH (c:Concept {name: $concept})
            MERGE (u)-[m:MASTERED]->(c)
            SET m.level = $mastery_level,
                m.updated_at = datetime()
            RETURN m.level as mastery
            """
            
            async with self.kg_client.session() as session:
                result = await session.run(query, {
                    "user_id": user_id,
                    "concept": concept,
                    "mastery_level": mastery_level
                })
                record = await result.single()
                
                return {
                    "has_kg": True,
                    "concept": concept,
                    "mastery_level": record["mastery"] if record else mastery_level
                }
        
        except Exception as e:
            logger.error(f"Error updating concept mastery: {e}")
            return {"has_kg": False, "error": str(e)}


# ==================== MAIN SYSTEM ORCHESTRATOR ====================

class WeaknessPracticeSystem:
    """
    Main orchestrator for the comprehensive weakness practice system
    Coordinates all components and provides unified interface
    """
    
    def __init__(self, db: Session, models, ai_client, kg_client=None):
        self.db = db
        self.models = models
        self.ai_client = ai_client
        self.kg_client = kg_client
        
        # Initialize components
        self.weakness_analyzer = EnhancedWeaknessAnalyzer(db, None, models, ai_client, kg_client)
        self.question_generator = AIQuestionGenerator(ai_client, db, models)
        self.session_manager = PracticeSessionManager(db, models, ai_client, self.question_generator)
        self.mastery_tracker = MasteryTracker(db, models, kg_client)
        self.progress_analytics = ProgressAnalytics(db, models)
        self.recommendation_engine = StudyRecommendationEngine(db, models, ai_client, kg_client)
        self.kg_integration = KnowledgeGraphIntegration(kg_client) if kg_client else None
    
    async def get_comprehensive_analysis(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive weakness analysis for user"""
        self.weakness_analyzer.user_id = user_id
        return await self.weakness_analyzer.analyze_comprehensive_weaknesses()
    
    async def start_practice_session(
        self, 
        user_id: int, 
        topic: str,
        difficulty: str = "intermediate",
        question_count: int = 10
    ) -> Dict[str, Any]:
        """Start a new practice session"""
        return self.session_manager.start_practice_session(user_id, topic, difficulty, question_count)
    
    async def get_next_question(self, session_id: str) -> Dict[str, Any]:
        """Get next question in practice session"""
        return await self.session_manager.get_next_question(session_id)
    
    def submit_answer(
        self, 
        session_id: str, 
        question_id: str,
        user_answer: str,
        time_taken: int
    ) -> Dict[str, Any]:
        """Submit answer and get feedback"""
        return self.session_manager.submit_answer(session_id, question_id, user_answer, time_taken)
    
    def end_practice_session(self, session_id: str) -> Dict[str, Any]:
        """End practice session and get summary"""
        return self.session_manager.end_practice_session(session_id)
    
    def get_mastery_overview(self, user_id: int) -> Dict[str, Any]:
        """Get mastery overview for user"""
        return self.mastery_tracker.get_mastery_overview(user_id)
    
    def get_weekly_progress(self, user_id: int) -> Dict[str, Any]:
        """Get weekly progress summary"""
        return self.progress_analytics.get_weekly_progress(user_id)
    
    async def generate_study_plan(
        self, 
        user_id: int,
        goal: str = "improve_weaknesses",
        duration_weeks: int = 4
    ) -> Dict[str, Any]:
        """Generate personalized study plan"""
        return await self.recommendation_engine.generate_study_plan(user_id, goal, duration_weeks)
    
    def get_daily_recommendations(self, user_id: int) -> Dict[str, Any]:
        """Get daily study recommendations"""
        return self.recommendation_engine.get_daily_recommendations(user_id)


# ==================== HELPER FUNCTIONS ====================

def create_weakness_practice_system(db: Session, models, ai_client, kg_client=None) -> WeaknessPracticeSystem:
    """Factory function to create weakness practice system"""
    return WeaknessPracticeSystem(db, models, ai_client, kg_client)


def format_practice_summary(summary: Dict) -> str:
    """Format practice session summary for display"""
    if summary.get("status") != "success":
        return "Session summary unavailable"
    
    stats = summary.get("statistics", {})
    
    lines = [
        f"Practice Session Complete: {summary.get('topic')}",
        f"Duration: {summary.get('duration_minutes', 0):.1f} minutes",
        "",
        "Performance:",
        f"  Questions: {stats.get('total_questions', 0)}",
        f"  Correct: {stats.get('correct_answers', 0)}",
        f"  Accuracy: {stats.get('accuracy', 0)}%",
        f"  Max Streak: {stats.get('max_streak', 0)}",
        f"  Avg Response Time: {stats.get('avg_response_time', 0):.1f}s",
        "",
        f"Performance Level: {summary.get('performance_level', 'N/A')}",
        ""
    ]
    
    if summary.get("recommendations"):
        lines.append("Recommendations:")
        for rec in summary["recommendations"]:
            lines.append(f"  • {rec}")
    
    return "\n".join(lines)


logger.info("Comprehensive Weakness Practice System loaded successfully")
