"""
Advanced Quiz Agent
LangGraph-based agent for intelligent quiz generation, adaptive testing,
performance analysis, and personalized learning with knowledge graph integration.
"""

import logging
import json
import re
from typing import Dict, Any, List, Optional, Literal, TypedDict
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

class QuizAction(str, Enum):
    """Actions the quiz agent can perform"""
    GENERATE = "generate"           # Generate quiz questions
    GRADE = "grade"                 # Grade quiz answers
    ANALYZE = "analyze"             # Analyze quiz performance
    RECOMMEND = "recommend"         # Recommend topics to study
    EXPLAIN = "explain"             # Explain a question/answer
    ADAPTIVE = "adaptive"           # Generate adaptive questions
    SIMILAR = "similar"             # Generate similar questions
    REVIEW = "review"               # Review wrong answers


class QuestionType(str, Enum):
    """Types of quiz questions"""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    FILL_BLANK = "fill_blank"


class DifficultyLevel(str, Enum):
    """Question difficulty levels"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class CognitiveLevel(str, Enum):
    """Bloom's taxonomy cognitive levels"""
    REMEMBER = "remember"
    UNDERSTAND = "understand"
    APPLY = "apply"
    ANALYZE = "analyze"
    EVALUATE = "evaluate"
    CREATE = "create"


# ==================== State Definition ====================

class QuizAgentState(TypedDict, total=False):
    """State for the quiz agent"""
    # Base fields
    user_id: str
    session_id: str
    user_input: str
    timestamp: str
    
    # Action context
    action: str
    action_params: Dict[str, Any]
    
    # Content
    source_content: str
    topic: str
    topics: List[str]
    
    # Generation parameters
    question_count: int
    question_types: List[str]
    difficulty: str
    difficulty_mix: Dict[str, int]
    cognitive_levels: List[str]
    
    # Generated questions
    generated_questions: List[Dict[str, Any]]
    
    # Grading
    user_answers: Dict[str, str]
    grading_results: List[Dict[str, Any]]
    score: float
    
    # Analysis
    performance_analysis: Dict[str, Any]
    weak_topics: List[str]
    strong_topics: List[str]
    recommendations: List[Dict[str, Any]]
    
    # Memory context
    memory_context: Dict[str, Any]
    user_mastery: Dict[str, float]
    past_performance: List[Dict[str, Any]]
    
    # Response
    final_response: str
    response_data: Dict[str, Any]
    
    # Metadata
    response_metadata: Dict[str, Any]
    execution_path: List[str]
    errors: List[str]


# ==================== Question Generator ====================

class QuizQuestionGenerator:
    """Generates high-quality quiz questions using AI"""
    
    QUESTION_TYPE_INSTRUCTIONS = {
        "multiple_choice": "Create 4 distinct options (A, B, C, D) with only ONE correct answer",
        "true_false": "Create a statement that is clearly true or false",
        "short_answer": "Create a question with a brief, specific answer (1-3 words or a short phrase)",
        "fill_blank": "Create a sentence with ONE blank (marked as ___) to fill in"
    }
    
    DIFFICULTY_GUIDELINES = {
        "easy": "Basic recall, simple definitions, straightforward facts that most students would know",
        "medium": "Understanding concepts, making connections, applying knowledge to new situations",
        "hard": "Analysis, synthesis, evaluation, complex problem-solving requiring deep understanding"
    }
    
    GENERATION_PROMPT = """You are a quiz generator. Generate EXACTLY {count} multiple choice questions about: {topic}

{content_section}

CRITICAL - DIFFICULTY DISTRIBUTION (YOU MUST FOLLOW THIS EXACTLY):
- Generate EXACTLY {easy_count} EASY questions (basic facts, simple definitions, straightforward recall)
- Generate EXACTLY {medium_count} MEDIUM questions (understanding concepts, applying knowledge, making connections)  
- Generate EXACTLY {hard_count} HARD questions (analysis, evaluation, complex reasoning, multi-step problems)

TOTAL: {count} questions

STRICT FORMAT REQUIREMENTS:
1. ONLY multiple choice questions with EXACTLY 4 options each
2. Options MUST be labeled: A), B), C), D)
3. "correct_answer" MUST be ONLY a single letter: "A", "B", "C", or "D"
4. "difficulty" MUST be exactly "easy", "medium", or "hard" matching the distribution above
5. Each question must have ONE clear correct answer
6. Include a brief explanation

OUTPUT FORMAT - Return ONLY this JSON array, nothing else:
[
  {{
    "question_text": "What is the capital of France?",
    "question_type": "multiple_choice",
    "difficulty": "easy",
    "topic": "{topic}",
    "correct_answer": "B",
    "options": ["A) London", "B) Paris", "C) Berlin", "D) Madrid"],
    "explanation": "Paris is the capital city of France.",
    "cognitive_level": "remember",
    "points": 1
  }},
  {{
    "question_text": "Which factor most influenced the French Revolution?",
    "question_type": "multiple_choice",
    "difficulty": "hard",
    "topic": "{topic}",
    "correct_answer": "C",
    "options": ["A) Religious reform", "B) Colonial expansion", "C) Economic inequality and Enlightenment ideas", "D) Military defeat"],
    "explanation": "The French Revolution was primarily driven by economic hardship and Enlightenment philosophy challenging the monarchy.",
    "cognitive_level": "analyze",
    "points": 1
  }}
]

NOW GENERATE EXACTLY {count} QUESTIONS ({easy_count} easy, {medium_count} medium, {hard_count} hard):"""

    ADAPTIVE_PROMPT = """Generate {count} adaptive multiple choice quiz questions based on user performance.

User Performance:
- Weak areas needing practice: {weak_areas}
- Strong areas: {strong_areas}
- Recent accuracy: {accuracy}%
- Recommended difficulty: {recommended_difficulty}

Topic: {topic}
{content_section}

Generate questions that:
1. Focus 60% on weak areas to help improvement
2. Include 40% from strong areas for confidence
3. Match the recommended difficulty level
4. Use ONLY multiple choice format with 4 options (A, B, C, D)
5. correct_answer must be ONLY the letter: "A", "B", "C", or "D"

Return ONLY a valid JSON array:
[
  {{
    "question_text": "Clear question here?",
    "question_type": "multiple_choice",
    "difficulty": "easy|medium|hard",
    "topic": "specific topic",
    "correct_answer": "A",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "explanation": "Brief explanation",
    "cognitive_level": "remember|understand|apply|analyze",
    "points": 1
  }}
]"""

    SIMILAR_PROMPT = """Generate a similar question to this one:

Original Question:
{original_question}

Requirements:
- Same topic and concept
- Multiple choice with 4 options (A, B, C, D)
- Difficulty: {difficulty}
- Different specific details/numbers/examples
- Test the same underlying knowledge
- correct_answer must be ONLY the letter: "A", "B", "C", or "D"

Return ONLY a valid JSON object:
{{
  "question_text": "New question here?",
  "question_type": "multiple_choice",
  "difficulty": "{difficulty}",
  "topic": "topic",
  "correct_answer": "A",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "explanation": "Brief explanation",
  "cognitive_level": "understand",
  "points": 1
}}"""

    def __init__(self, ai_client):
        self.ai_client = ai_client
    
    def generate_questions(
        self,
        topic: str,
        content: str = "",
        count: int = 10,
        question_types: List[str] = None,
        difficulty_mix: Dict[str, int] = None,
        topics: List[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate quiz questions from topic/content"""
        
        # Force multiple choice only
        question_types = ["multiple_choice"]
        difficulty_mix = difficulty_mix or {"easy": 3, "medium": 5, "hard": 2}
        
        # Calculate actual counts based on total
        total_mix = sum(difficulty_mix.values())
        easy_count = round(count * difficulty_mix.get("easy", 3) / total_mix)
        medium_count = round(count * difficulty_mix.get("medium", 5) / total_mix)
        hard_count = count - easy_count - medium_count
        
        # Ensure at least the requested count
        if easy_count + medium_count + hard_count < count:
            medium_count += count - (easy_count + medium_count + hard_count)
        
        content_section = f"Content to base questions on:\n{content[:4000]}" if content else f"Generate questions about general knowledge of {topic}"
        
        prompt = self.GENERATION_PROMPT.format(
            count=count,
            topic=topic,
            content_section=content_section,
            easy_count=easy_count,
            medium_count=medium_count,
            hard_count=hard_count
        )
        
        return self._generate_and_parse(prompt, count)
    
    def generate_adaptive_questions(
        self,
        topic: str,
        content: str,
        count: int,
        weak_areas: List[str],
        strong_areas: List[str],
        accuracy: float,
        recommended_difficulty: str
    ) -> List[Dict[str, Any]]:
        """Generate questions adapted to user performance"""
        
        content_section = f"Content:\n{content[:4000]}" if content else f"General knowledge about {topic}"
        
        prompt = self.ADAPTIVE_PROMPT.format(
            count=count,
            topic=topic,
            content_section=content_section,
            weak_areas=", ".join(weak_areas) if weak_areas else "None identified yet",
            strong_areas=", ".join(strong_areas) if strong_areas else "None identified yet",
            accuracy=round(accuracy * 100, 1),
            recommended_difficulty=recommended_difficulty
        )
        
        return self._generate_and_parse(prompt, count)
    
    def generate_similar_question(
        self,
        original_question: Dict[str, Any],
        difficulty: str = None
    ) -> Dict[str, Any]:
        """Generate a similar question"""
        
        prompt = self.SIMILAR_PROMPT.format(
            original_question=json.dumps(original_question, indent=2),
            difficulty=difficulty or original_question.get("difficulty", "medium")
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=500, temperature=0.8)
            return self._parse_json_object(response)
        except Exception as e:
            logger.error(f"Similar question generation failed: {e}")
            return original_question
    
    def _generate_and_parse(self, prompt: str, count: int) -> List[Dict[str, Any]]:
        """Generate and parse questions from AI response"""
        try:
            response = self.ai_client.generate(prompt, max_tokens=4000, temperature=0.7)
            questions = self._parse_json_array(response)
            
            # Validate and clean questions
            valid_questions = []
            for q in questions[:count]:
                if self._validate_question(q):
                    valid_questions.append(self._clean_question(q))
            
            logger.info(f"Generated {len(valid_questions)} valid questions")
            return valid_questions
            
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            return []
    
    def _validate_question(self, question: Dict) -> bool:
        """Validate question structure"""
        required_fields = ["question_text", "correct_answer"]
        if not all(field in question and question[field] for field in required_fields):
            return False
        
        # Validate correct_answer is a letter for MCQ
        correct = str(question.get("correct_answer", "")).strip().upper()
        if correct not in ["A", "B", "C", "D"]:
            # Try to extract letter if it's like "A)" or "A."
            if correct and correct[0] in ["A", "B", "C", "D"]:
                question["correct_answer"] = correct[0]
            else:
                return False
        
        return True
    
    def _clean_question(self, question: Dict) -> Dict:
        """Clean and normalize question data"""
        correct = str(question.get("correct_answer", "A")).strip().upper()
        if correct and correct[0] in ["A", "B", "C", "D"]:
            correct = correct[0]
        else:
            correct = "A"
        
        return {
            "question_text": question.get("question_text", "").strip(),
            "question_type": "multiple_choice",
            "difficulty": question.get("difficulty", "medium").lower(),
            "topic": question.get("topic", "General"),
            "correct_answer": correct,
            "options": question.get("options", []),
            "explanation": question.get("explanation", ""),
            "cognitive_level": question.get("cognitive_level", "understand"),
            "points": question.get("points", 1)
        }
    
    def _parse_json_array(self, response: str) -> List[Dict]:
        """Parse JSON array from AI response with robust error handling"""
        json_str = response.strip()
        
        # Remove markdown code blocks
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            parts = json_str.split("```")
            if len(parts) >= 2:
                json_str = parts[1]
        
        json_str = json_str.strip()
        
        # Try direct parse first
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Find JSON array with regex
        match = re.search(r'\[[\s\S]*\]', json_str)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        
        # Try to fix common JSON issues
        json_str = self._fix_json_string(json_str)
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Last resort: find array again after fixes
        match = re.search(r'\[[\s\S]*\]', json_str)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError as e:
                logger.error(f"Final JSON parse failed: {e}")
        
        return []
    
    def _fix_json_string(self, json_str: str) -> str:
        """Attempt to fix common JSON formatting issues"""
        # Remove trailing commas before ] or }
        json_str = re.sub(r',\s*]', ']', json_str)
        json_str = re.sub(r',\s*}', '}', json_str)
        
        # Fix unescaped quotes in strings (common AI mistake)
        # This is tricky, so we do a simple approach
        
        # Remove any text before the first [
        start_idx = json_str.find('[')
        if start_idx > 0:
            json_str = json_str[start_idx:]
        
        # Remove any text after the last ]
        end_idx = json_str.rfind(']')
        if end_idx > 0 and end_idx < len(json_str) - 1:
            json_str = json_str[:end_idx + 1]
        
        return json_str
    
    def _parse_json_object(self, response: str) -> Dict:
        """Parse JSON object from AI response"""
        json_str = response.strip()
        
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0]
        elif "```" in json_str:
            parts = json_str.split("```")
            if len(parts) >= 2:
                json_str = parts[1]
        
        json_str = json_str.strip()
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        match = re.search(r'\{[\s\S]*\}', json_str)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        
        return {}


# ==================== Answer Grader ====================

class QuizAnswerGrader:
    """Grades quiz answers with intelligent matching"""
    
    GRADING_PROMPT = """Grade this answer for the question.

Question: {question}
Question Type: {question_type}
Correct Answer: {correct_answer}
User's Answer: {user_answer}

For short_answer and fill_blank questions, be lenient with:
- Minor spelling variations
- Synonyms that mean the same thing
- Different but equivalent phrasings

Return JSON:
{{
    "is_correct": true/false,
    "score": 0.0-1.0,
    "feedback": "Brief feedback on the answer",
    "partial_credit": true/false
}}"""

    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def grade_answers(
        self,
        questions: List[Dict[str, Any]],
        user_answers: Dict[str, str]
    ) -> List[Dict[str, Any]]:
        """Grade all answers for a quiz"""
        results = []
        
        for i, question in enumerate(questions):
            question_id = str(question.get("id", i))
            user_answer = user_answers.get(question_id, "")
            
            result = self.grade_single_answer(question, user_answer)
            result["question_id"] = question_id
            result["question_text"] = question.get("question_text", "")
            result["correct_answer"] = question.get("correct_answer", "")
            result["user_answer"] = user_answer
            result["difficulty"] = question.get("difficulty", "medium")
            result["topic"] = question.get("topic", "General")
            result["explanation"] = question.get("explanation", "")
            
            results.append(result)
        
        return results
    
    def grade_single_answer(
        self,
        question: Dict[str, Any],
        user_answer: str
    ) -> Dict[str, Any]:
        """Grade a single answer"""
        question_type = question.get("question_type", "multiple_choice")
        correct_answer = str(question.get("correct_answer", "")).strip().lower()
        user_answer_clean = str(user_answer).strip().lower()
        
        # Direct match for multiple choice and true/false
        if question_type in ["multiple_choice", "true_false"]:
            # Extract letter for multiple choice (e.g., "A" from "A) answer")
            if question_type == "multiple_choice":
                correct_letter = correct_answer[0] if correct_answer else ""
                user_letter = user_answer_clean[0] if user_answer_clean else ""
                is_correct = correct_letter == user_letter or correct_answer == user_answer_clean
            else:
                is_correct = correct_answer == user_answer_clean
            
            return {
                "is_correct": is_correct,
                "score": 1.0 if is_correct else 0.0,
                "feedback": "Correct!" if is_correct else f"The correct answer was: {question.get('correct_answer', '')}",
                "partial_credit": False
            }
        
        # For short answer and fill blank, use fuzzy matching or AI
        if question_type in ["short_answer", "fill_blank"]:
            # Simple fuzzy match first
            if self._fuzzy_match(correct_answer, user_answer_clean):
                return {
                    "is_correct": True,
                    "score": 1.0,
                    "feedback": "Correct!",
                    "partial_credit": False
                }
            
            # Use AI for more nuanced grading if available
            if self.ai_client:
                return self._ai_grade(question, user_answer)
            
            return {
                "is_correct": False,
                "score": 0.0,
                "feedback": f"The correct answer was: {question.get('correct_answer', '')}",
                "partial_credit": False
            }
        
        # Default
        is_correct = correct_answer == user_answer_clean
        return {
            "is_correct": is_correct,
            "score": 1.0 if is_correct else 0.0,
            "feedback": "Correct!" if is_correct else f"The correct answer was: {question.get('correct_answer', '')}",
            "partial_credit": False
        }
    
    def _fuzzy_match(self, correct: str, user: str, threshold: float = 0.85) -> bool:
        """Simple fuzzy string matching"""
        if not correct or not user:
            return False
        
        # Exact match
        if correct == user:
            return True
        
        # Contains match (for short answers)
        if correct in user or user in correct:
            return True
        
        # Simple Levenshtein-like similarity
        if len(correct) > 0 and len(user) > 0:
            # Calculate character overlap
            correct_chars = set(correct)
            user_chars = set(user)
            overlap = len(correct_chars & user_chars) / max(len(correct_chars), len(user_chars))
            if overlap >= threshold:
                return True
        
        return False
    
    def _ai_grade(self, question: Dict, user_answer: str) -> Dict[str, Any]:
        """Use AI for nuanced grading"""
        prompt = self.GRADING_PROMPT.format(
            question=question.get("question_text", ""),
            question_type=question.get("question_type", "short_answer"),
            correct_answer=question.get("correct_answer", ""),
            user_answer=user_answer
        )
        
        try:
            response = self.ai_client.generate(prompt, max_tokens=200, temperature=0.3)
            
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            match = re.search(r'\{[\s\S]*\}', json_str)
            if match:
                result = json.loads(match.group())
                return {
                    "is_correct": result.get("is_correct", False),
                    "score": result.get("score", 0.0),
                    "feedback": result.get("feedback", ""),
                    "partial_credit": result.get("partial_credit", False)
                }
        except Exception as e:
            logger.error(f"AI grading failed: {e}")
        
        return {
            "is_correct": False,
            "score": 0.0,
            "feedback": f"The correct answer was: {question.get('correct_answer', '')}",
            "partial_credit": False
        }


# ==================== Performance Analyzer ====================

class QuizPerformanceAnalyzer:
    """Analyzes quiz performance and provides insights"""
    
    def __init__(self, ai_client=None):
        self.ai_client = ai_client
    
    def analyze_session(
        self,
        grading_results: List[Dict[str, Any]],
        time_taken_seconds: int = None
    ) -> Dict[str, Any]:
        """Analyze a quiz session"""
        if not grading_results:
            return {"status": "no_data"}
        
        total = len(grading_results)
        correct = sum(1 for r in grading_results if r.get("is_correct", False))
        total_score = sum(r.get("score", 0) for r in grading_results)
        
        # Analyze by difficulty
        by_difficulty = {}
        for result in grading_results:
            diff = result.get("difficulty", "medium")
            if diff not in by_difficulty:
                by_difficulty[diff] = {"total": 0, "correct": 0}
            by_difficulty[diff]["total"] += 1
            if result.get("is_correct"):
                by_difficulty[diff]["correct"] += 1
        
        difficulty_accuracy = {
            diff: stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            for diff, stats in by_difficulty.items()
        }
        
        # Analyze by topic
        by_topic = {}
        for result in grading_results:
            topic = result.get("topic", "General")
            if topic not in by_topic:
                by_topic[topic] = {"total": 0, "correct": 0}
            by_topic[topic]["total"] += 1
            if result.get("is_correct"):
                by_topic[topic]["correct"] += 1
        
        topic_accuracy = {
            topic: stats["correct"] / stats["total"] if stats["total"] > 0 else 0
            for topic, stats in by_topic.items()
        }
        
        # Identify weak and strong areas
        weak_topics = [t for t, acc in topic_accuracy.items() if acc < 0.6]
        strong_topics = [t for t, acc in topic_accuracy.items() if acc >= 0.8]
        
        # Wrong answers for review
        wrong_answers = [
            {
                "question": r.get("question_text"),
                "user_answer": r.get("user_answer"),
                "correct_answer": r.get("correct_answer"),
                "explanation": r.get("explanation"),
                "topic": r.get("topic")
            }
            for r in grading_results if not r.get("is_correct")
        ]
        
        return {
            "total_questions": total,
            "correct_answers": correct,
            "score": total_score,
            "accuracy": correct / total if total > 0 else 0,
            "percentage": round((correct / total) * 100, 1) if total > 0 else 0,
            "difficulty_breakdown": difficulty_accuracy,
            "topic_breakdown": topic_accuracy,
            "weak_topics": weak_topics,
            "strong_topics": strong_topics,
            "wrong_answers": wrong_answers,
            "time_taken_seconds": time_taken_seconds,
            "avg_time_per_question": time_taken_seconds / total if time_taken_seconds and total > 0 else None
        }
    
    def get_recommendations(
        self,
        performance: Dict[str, Any],
        user_mastery: Dict[str, float] = None
    ) -> List[Dict[str, Any]]:
        """Generate study recommendations based on performance"""
        recommendations = []
        
        # Recommend weak topics
        for topic in performance.get("weak_topics", []):
            recommendations.append({
                "type": "study_topic",
                "topic": topic,
                "reason": f"Low accuracy on {topic} questions",
                "priority": "high",
                "action": f"Review materials on {topic}"
            })
        
        # Recommend based on difficulty performance
        diff_breakdown = performance.get("difficulty_breakdown", {})
        if diff_breakdown.get("easy", 1) < 0.8:
            recommendations.append({
                "type": "fundamentals",
                "reason": "Struggling with basic questions",
                "priority": "high",
                "action": "Review fundamental concepts before advancing"
            })
        elif diff_breakdown.get("hard", 1) < 0.4:
            recommendations.append({
                "type": "practice_advanced",
                "reason": "Need more practice with challenging questions",
                "priority": "medium",
                "action": "Practice more medium-difficulty questions first"
            })
        
        # Recommend based on overall accuracy
        accuracy = performance.get("accuracy", 0)
        if accuracy < 0.5:
            recommendations.append({
                "type": "review_all",
                "reason": "Overall accuracy below 50%",
                "priority": "high",
                "action": "Comprehensive review of all topics recommended"
            })
        elif accuracy >= 0.9:
            recommendations.append({
                "type": "advance",
                "reason": "Excellent performance!",
                "priority": "low",
                "action": "Ready for more challenging material"
            })
        
        # Add mastery-based recommendations
        if user_mastery:
            low_mastery = [c for c, m in user_mastery.items() if m < 0.5]
            if low_mastery:
                recommendations.append({
                    "type": "mastery_focus",
                    "topics": low_mastery[:3],
                    "reason": "These concepts need more practice based on history",
                    "priority": "medium"
                })
        
        return recommendations
    
    def get_adaptive_difficulty(
        self,
        past_sessions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Determine recommended difficulty based on past performance"""
        if not past_sessions:
            return {
                "recommended_difficulty": "medium",
                "reason": "No previous performance data",
                "suggested_mix": {"easy": 3, "medium": 5, "hard": 2}
            }
        
        # Calculate recent average
        recent_scores = [s.get("accuracy", 0.5) for s in past_sessions[:5]]
        avg_accuracy = sum(recent_scores) / len(recent_scores)
        
        if avg_accuracy >= 0.85:
            return {
                "recommended_difficulty": "hard",
                "reason": "Excellent recent performance",
                "suggested_mix": {"easy": 1, "medium": 4, "hard": 5}
            }
        elif avg_accuracy >= 0.70:
            return {
                "recommended_difficulty": "medium",
                "reason": "Solid understanding, ready for balanced challenge",
                "suggested_mix": {"easy": 2, "medium": 5, "hard": 3}
            }
        elif avg_accuracy >= 0.50:
            return {
                "recommended_difficulty": "medium",
                "reason": "Building foundation, focus on medium difficulty",
                "suggested_mix": {"easy": 4, "medium": 5, "hard": 1}
            }
        else:
            return {
                "recommended_difficulty": "easy",
                "reason": "Focus on fundamentals first",
                "suggested_mix": {"easy": 6, "medium": 3, "hard": 1}
            }


# ==================== Main Quiz Agent ====================

class QuizAgent(BaseAgent):
    """
    Advanced Quiz Agent with:
    - AI-powered question generation from topics or content
    - Intelligent answer grading with partial credit
    - Performance analysis and weak area detection
    - Adaptive difficulty based on user performance
    - Knowledge graph integration for concept relationships
    - Memory-aware personalization
    - Study recommendations
    """
    
    def __init__(
        self,
        ai_client: Any,
        knowledge_graph: Optional[Any] = None,
        memory_manager: Optional[MemoryManager] = None,
        db_session_factory: Optional[Any] = None,
        checkpointer: Optional[MemorySaver] = None
    ):
        self.memory_manager = memory_manager or get_memory_manager()
        self.db_session_factory = db_session_factory
        self.generator = QuizQuestionGenerator(ai_client)
        self.grader = QuizAnswerGrader(ai_client)
        self.analyzer = QuizPerformanceAnalyzer(ai_client)
        
        super().__init__(
            agent_type=AgentType.QUIZ,
            ai_client=ai_client,
            knowledge_graph=knowledge_graph,
            checkpointer=checkpointer or MemorySaver()
        )
        
    
    def _build_graph(self) -> None:
        """Build the LangGraph state machine"""
        graph = StateGraph(QuizAgentState)
        
        # Add nodes
        graph.add_node("parse_request", self._parse_request)
        graph.add_node("load_context", self._load_context)
        graph.add_node("route_action", self._route_action)
        
        # Action nodes
        graph.add_node("generate_questions", self._generate_questions)
        graph.add_node("generate_adaptive", self._generate_adaptive)
        graph.add_node("grade_answers", self._grade_answers)
        graph.add_node("analyze_performance", self._analyze_performance)
        graph.add_node("get_recommendations", self._get_recommendations)
        graph.add_node("explain_answer", self._explain_answer)
        graph.add_node("generate_similar", self._generate_similar)
        graph.add_node("review_wrong", self._review_wrong)
        
        # Finalization
        graph.add_node("update_memory", self._update_memory)
        graph.add_node("format_response", self._format_response)
        graph.add_node("handle_error", self._handle_error)
        
        # Set entry point
        graph.set_entry_point("parse_request")
        
        # Add edges
        graph.add_edge("parse_request", "load_context")
        graph.add_edge("load_context", "route_action")
        
        # Conditional routing based on action
        graph.add_conditional_edges(
            "route_action",
            self._get_action_route,
            {
                "generate": "generate_questions",
                "adaptive": "generate_adaptive",
                "grade": "grade_answers",
                "analyze": "analyze_performance",
                "recommend": "get_recommendations",
                "explain": "explain_answer",
                "similar": "generate_similar",
                "review": "review_wrong",
                "error": "handle_error"
            }
        )
        
        # All actions lead to memory update
        graph.add_edge("generate_questions", "update_memory")
        graph.add_edge("generate_adaptive", "update_memory")
        graph.add_edge("grade_answers", "update_memory")
        graph.add_edge("analyze_performance", "update_memory")
        graph.add_edge("get_recommendations", "update_memory")
        graph.add_edge("explain_answer", "update_memory")
        graph.add_edge("generate_similar", "update_memory")
        graph.add_edge("review_wrong", "update_memory")
        
        graph.add_edge("update_memory", "format_response")
        graph.add_edge("format_response", END)
        graph.add_edge("handle_error", END)
        
        # Compile
        self.graph = graph
        self.compiled_graph = graph.compile(checkpointer=self.checkpointer)
        
    
    # ==================== Graph Nodes ====================
    
    async def _parse_request(self, state: QuizAgentState) -> QuizAgentState:
        """Parse the user request to determine action"""
        user_input = state.get("user_input", "").lower()
        action_params = state.get("action_params", {})
        
        state["execution_path"] = ["quiz:parse"]
        
        # If action is explicitly provided
        if state.get("action"):
            return state
        
        # Detect action from natural language
        if any(word in user_input for word in ["generate", "create", "make", "new quiz"]):
            state["action"] = QuizAction.GENERATE.value
        elif any(word in user_input for word in ["grade", "check", "score", "submit"]):
            state["action"] = QuizAction.GRADE.value
        elif any(word in user_input for word in ["analyze", "performance", "stats", "results"]):
            state["action"] = QuizAction.ANALYZE.value
        elif any(word in user_input for word in ["recommend", "suggest", "what should", "study"]):
            state["action"] = QuizAction.RECOMMEND.value
        elif any(word in user_input for word in ["explain", "why", "help me understand"]):
            state["action"] = QuizAction.EXPLAIN.value
        elif any(word in user_input for word in ["adaptive", "personalized", "based on"]):
            state["action"] = QuizAction.ADAPTIVE.value
        elif any(word in user_input for word in ["similar", "like this", "another"]):
            state["action"] = QuizAction.SIMILAR.value
        elif any(word in user_input for word in ["review", "wrong", "mistakes"]):
            state["action"] = QuizAction.REVIEW.value
        else:
            state["action"] = QuizAction.GENERATE.value  # Default
        
        # Extract topic if generating
        if state["action"] in [QuizAction.GENERATE.value, QuizAction.ADAPTIVE.value]:
            topic_patterns = [
                r"about (.+?)(?:\.|$)",
                r"on (.+?)(?:\.|$)",
                r"for (.+?)(?:\.|$)",
                r"quiz (?:on |about |for )?(.+?)(?:\.|$)"
            ]
            for pattern in topic_patterns:
                match = re.search(pattern, user_input, re.IGNORECASE)
                if match:
                    state["topic"] = match.group(1).strip()
                    break
            
            if not state.get("topic"):
                state["topic"] = action_params.get("topic", user_input)
        
        # Set defaults from action_params
        state["question_count"] = action_params.get("question_count", 10)
        state["difficulty"] = action_params.get("difficulty", "medium")
        state["difficulty_mix"] = action_params.get("difficulty_mix", {"easy": 3, "medium": 5, "hard": 2})
        state["question_types"] = ["multiple_choice"]  # Force MCQ only
        state["source_content"] = action_params.get("content", "")
        state["topics"] = action_params.get("topics", [])
        state["user_answers"] = action_params.get("answers", {})
        
        return state
    
    async def _load_context(self, state: QuizAgentState) -> QuizAgentState:
        """Load context from memory and knowledge graph"""
        user_id = state.get("user_id")
        session_id = state.get("session_id", "default")
        topic = state.get("topic", "")
        
        if self.memory_manager:
            try:
                context = await self.memory_manager.get_context_for_agent(
                    user_id=user_id,
                    agent_type="quiz",
                    query=topic,
                    session_id=session_id
                )
                
                state["memory_context"] = context
                state["user_mastery"] = {}
                state["past_performance"] = []
                
                # Extract mastery from memory
                for concept in context.get("strong_concepts", []):
                    state["user_mastery"][concept] = 0.8
                for concept in context.get("struggled_concepts", []):
                    state["user_mastery"][concept] = 0.3
                
                # Get past quiz performance
                state["past_performance"] = context.get("agent_context", {}).get("quiz_history", [])
                
            except Exception as e:
                logger.error(f"Context load failed: {e}")
                state["memory_context"] = {}
        
        # Load from knowledge graph
        if self.knowledge_graph and topic:
            try:
                related = await self.knowledge_graph.get_related_concepts(topic)
                state["memory_context"] = state.get("memory_context", {})
                state["memory_context"]["related_concepts"] = related
            except Exception as e:
                logger.debug(f"KG lookup failed: {e}")
        
        state["execution_path"].append("quiz:context")
        return state
    
    def _get_action_route(self, state: QuizAgentState) -> str:
        """Route to appropriate action handler"""
        action = state.get("action", "generate")
        
        action_map = {
            QuizAction.GENERATE.value: "generate",
            QuizAction.ADAPTIVE.value: "adaptive",
            QuizAction.GRADE.value: "grade",
            QuizAction.ANALYZE.value: "analyze",
            QuizAction.RECOMMEND.value: "recommend",
            QuizAction.EXPLAIN.value: "explain",
            QuizAction.SIMILAR.value: "similar",
            QuizAction.REVIEW.value: "review"
        }
        
        return action_map.get(action, "generate")
    
    async def _route_action(self, state: QuizAgentState) -> QuizAgentState:
        """Prepare for action routing"""
        state["execution_path"].append(f"quiz:route:{state.get('action')}")
        return state
    
    async def _generate_questions(self, state: QuizAgentState) -> QuizAgentState:
        """Generate quiz questions"""
        topic = state.get("topic", "")
        content = state.get("source_content", "")
        count = state.get("question_count", 10)
        difficulty_mix = state.get("difficulty_mix", {"easy": 3, "medium": 5, "hard": 2})
        topics = state.get("topics", [topic]) if topic else state.get("topics", [])
        
        logger.info(f"Generating {count} questions for topic: {topic}, difficulty_mix: {difficulty_mix}")
        
        # Generate questions (MCQ only)
        questions = self.generator.generate_questions(
            topic=topic,
            content=content,
            count=count,
            question_types=["multiple_choice"],
            difficulty_mix=difficulty_mix,
            topics=topics
        )
        
        # Add IDs to questions
        for i, q in enumerate(questions):
            q["id"] = i
        
        state["generated_questions"] = questions
        state["response_data"] = {
            "action": "generate",
            "questions": questions,
            "count": len(questions),
            "topic": topic,
            "difficulty_mix": difficulty_mix
        }
        
        state["execution_path"].append("quiz:generate")
        logger.info(f"Generated {len(questions)} quiz questions on '{topic}'")
        
        return state
    
    async def _generate_adaptive(self, state: QuizAgentState) -> QuizAgentState:
        """Generate adaptive questions based on user performance"""
        topic = state.get("topic", "")
        content = state.get("source_content", "")
        count = state.get("question_count", 10)
        
        # Get adaptive difficulty recommendation
        past_performance = state.get("past_performance", [])
        adaptive_config = self.analyzer.get_adaptive_difficulty(past_performance)
        
        # Get weak/strong areas from memory
        memory_ctx = state.get("memory_context", {})
        weak_areas = memory_ctx.get("struggled_concepts", [])
        strong_areas = memory_ctx.get("strong_concepts", [])
        
        # Calculate recent accuracy
        recent_accuracy = 0.5
        if past_performance:
            recent_accuracy = sum(p.get("accuracy", 0.5) for p in past_performance[:5]) / min(5, len(past_performance))
        
        # Generate adaptive questions
        questions = self.generator.generate_adaptive_questions(
            topic=topic,
            content=content,
            count=count,
            weak_areas=weak_areas,
            strong_areas=strong_areas,
            accuracy=recent_accuracy,
            recommended_difficulty=adaptive_config["recommended_difficulty"]
        )
        
        # Add IDs
        for i, q in enumerate(questions):
            q["id"] = i
        
        state["generated_questions"] = questions
        state["response_data"] = {
            "action": "adaptive",
            "questions": questions,
            "count": len(questions),
            "topic": topic,
            "adaptive_config": adaptive_config,
            "weak_areas": weak_areas,
            "strong_areas": strong_areas
        }
        
        state["execution_path"].append("quiz:adaptive")
        logger.info(f"Generated {len(questions)} adaptive questions")
        
        return state
    
    async def _grade_answers(self, state: QuizAgentState) -> QuizAgentState:
        """Grade user answers"""
        questions = state.get("generated_questions", [])
        user_answers = state.get("user_answers", {})
        action_params = state.get("action_params", {})
        
        # Get questions from action_params if not in state
        if not questions and action_params.get("questions"):
            questions = action_params["questions"]
        
        if not questions:
            state["errors"] = state.get("errors", []) + ["No questions to grade"]
            return state
        
        # Grade answers
        grading_results = self.grader.grade_answers(questions, user_answers)
        
        # Calculate score
        total_correct = sum(1 for r in grading_results if r.get("is_correct"))
        total_score = sum(r.get("score", 0) for r in grading_results)
        accuracy = total_correct / len(grading_results) if grading_results else 0
        
        state["grading_results"] = grading_results
        state["score"] = total_score
        state["response_data"] = {
            "action": "grade",
            "results": grading_results,
            "total_questions": len(grading_results),
            "correct_answers": total_correct,
            "score": total_score,
            "accuracy": accuracy,
            "percentage": round(accuracy * 100, 1)
        }
        
        state["execution_path"].append("quiz:grade")
        logger.info(f"Graded {len(grading_results)} answers, score: {total_correct}/{len(grading_results)}")
        
        return state
    
    async def _analyze_performance(self, state: QuizAgentState) -> QuizAgentState:
        """Analyze quiz performance"""
        grading_results = state.get("grading_results", [])
        action_params = state.get("action_params", {})
        
        # Get results from action_params if not in state
        if not grading_results and action_params.get("results"):
            grading_results = action_params["results"]
        
        time_taken = action_params.get("time_taken_seconds")
        
        # Analyze session
        analysis = self.analyzer.analyze_session(grading_results, time_taken)
        
        state["performance_analysis"] = analysis
        state["weak_topics"] = analysis.get("weak_topics", [])
        state["strong_topics"] = analysis.get("strong_topics", [])
        
        state["response_data"] = {
            "action": "analyze",
            "analysis": analysis
        }
        
        state["execution_path"].append("quiz:analyze")
        return state
    
    async def _get_recommendations(self, state: QuizAgentState) -> QuizAgentState:
        """Get study recommendations"""
        performance = state.get("performance_analysis", {})
        user_mastery = state.get("user_mastery", {})
        action_params = state.get("action_params", {})
        
        # Get performance from action_params if not in state
        if not performance and action_params.get("performance"):
            performance = action_params["performance"]
        
        # Get recommendations
        recommendations = self.analyzer.get_recommendations(performance, user_mastery)
        
        # Get adaptive difficulty for next quiz
        past_performance = state.get("past_performance", [])
        adaptive_config = self.analyzer.get_adaptive_difficulty(past_performance)
        
        state["recommendations"] = recommendations
        state["response_data"] = {
            "action": "recommend",
            "recommendations": recommendations,
            "next_quiz_config": adaptive_config
        }
        
        state["execution_path"].append("quiz:recommend")
        return state
    
    async def _explain_answer(self, state: QuizAgentState) -> QuizAgentState:
        """Explain a question and its answer"""
        action_params = state.get("action_params", {})
        question = action_params.get("question", {})
        user_answer = action_params.get("user_answer", "")
        
        if not question:
            state["errors"] = state.get("errors", []) + ["No question to explain"]
            return state
        
        # Generate detailed explanation
        prompt = f"""Explain this quiz question and answer in detail:

Question: {question.get('question_text', '')}
Correct Answer: {question.get('correct_answer', '')}
User's Answer: {user_answer}
Was Correct: {user_answer.lower() == str(question.get('correct_answer', '')).lower()}

Provide:
1. Why the correct answer is right
2. If the user was wrong, explain why their answer was incorrect
3. Key concepts to understand
4. Tips for similar questions

Explanation:"""
        
        try:
            explanation = self.ai_client.generate(prompt, max_tokens=500, temperature=0.7)
        except Exception as e:
            explanation = question.get("explanation", "No explanation available.")
        
        state["response_data"] = {
            "action": "explain",
            "question": question,
            "explanation": explanation,
            "correct_answer": question.get("correct_answer"),
            "user_answer": user_answer
        }
        
        state["execution_path"].append("quiz:explain")
        return state
    
    async def _generate_similar(self, state: QuizAgentState) -> QuizAgentState:
        """Generate similar questions"""
        action_params = state.get("action_params", {})
        original_question = action_params.get("question", {})
        difficulty = action_params.get("difficulty")
        count = action_params.get("count", 1)
        
        if not original_question:
            state["errors"] = state.get("errors", []) + ["No question to base similar questions on"]
            return state
        
        similar_questions = []
        for _ in range(count):
            similar = self.generator.generate_similar_question(original_question, difficulty)
            similar["id"] = len(similar_questions)
            similar_questions.append(similar)
        
        state["generated_questions"] = similar_questions
        state["response_data"] = {
            "action": "similar",
            "questions": similar_questions,
            "original_question": original_question
        }
        
        state["execution_path"].append("quiz:similar")
        return state
    
    async def _review_wrong(self, state: QuizAgentState) -> QuizAgentState:
        """Review wrong answers from a quiz"""
        grading_results = state.get("grading_results", [])
        action_params = state.get("action_params", {})
        
        if not grading_results and action_params.get("results"):
            grading_results = action_params["results"]
        
        # Get wrong answers
        wrong_answers = [r for r in grading_results if not r.get("is_correct")]
        
        # Generate review content for each wrong answer
        review_items = []
        for wrong in wrong_answers:
            review_items.append({
                "question": wrong.get("question_text"),
                "user_answer": wrong.get("user_answer"),
                "correct_answer": wrong.get("correct_answer"),
                "explanation": wrong.get("explanation"),
                "topic": wrong.get("topic"),
                "difficulty": wrong.get("difficulty")
            })
        
        state["response_data"] = {
            "action": "review",
            "wrong_count": len(wrong_answers),
            "total_questions": len(grading_results),
            "review_items": review_items,
            "topics_to_review": list(set(w.get("topic") for w in wrong_answers if w.get("topic")))
        }
        
        state["execution_path"].append("quiz:review")
        return state
    
    async def _update_memory(self, state: QuizAgentState) -> QuizAgentState:
        """Update memory with quiz interaction"""
        user_id = state.get("user_id")
        action = state.get("action")
        
        if self.memory_manager and user_id:
            try:
                # Store quiz attempt in memory
                if action == QuizAction.GRADE.value:
                    response_data = state.get("response_data", {})
                    await self.memory_manager.remember_quiz_attempt(
                        user_id=user_id,
                        quiz_topic=state.get("topic", "General"),
                        score=response_data.get("accuracy", 0),
                        questions_count=response_data.get("total_questions", 0),
                        wrong_concepts=state.get("weak_topics", [])
                    )
                
                logger.debug(f"Updated memory for quiz action: {action}")
                
            except Exception as e:
                logger.error(f"Memory update failed: {e}")
        
        state["execution_path"].append("quiz:memory")
        return state
    
    async def _format_response(self, state: QuizAgentState) -> QuizAgentState:
        """Format the final response"""
        action = state.get("action", "generate")
        response_data = state.get("response_data", {})
        
        # Generate human-readable response
        if action == QuizAction.GENERATE.value:
            count = len(response_data.get("questions", []))
            topic = response_data.get("topic", "the topic")
            state["final_response"] = f"Generated {count} quiz questions about {topic}."
        
        elif action == QuizAction.ADAPTIVE.value:
            count = len(response_data.get("questions", []))
            config = response_data.get("adaptive_config", {})
            state["final_response"] = f"Generated {count} adaptive questions. Recommended difficulty: {config.get('recommended_difficulty', 'medium')}."
        
        elif action == QuizAction.GRADE.value:
            correct = response_data.get("correct_answers", 0)
            total = response_data.get("total_questions", 0)
            pct = response_data.get("percentage", 0)
            state["final_response"] = f"Quiz completed! Score: {correct}/{total} ({pct}%)"
        
        elif action == QuizAction.ANALYZE.value:
            analysis = response_data.get("analysis", {})
            pct = analysis.get("percentage", 0)
            weak = analysis.get("weak_topics", [])
            state["final_response"] = f"Performance analysis: {pct}% accuracy. " + (f"Focus areas: {', '.join(weak)}" if weak else "Great job!")
        
        elif action == QuizAction.RECOMMEND.value:
            recs = response_data.get("recommendations", [])
            state["final_response"] = f"Generated {len(recs)} study recommendations based on your performance."
        
        elif action == QuizAction.EXPLAIN.value:
            state["final_response"] = response_data.get("explanation", "Explanation provided.")
        
        elif action == QuizAction.SIMILAR.value:
            count = len(response_data.get("questions", []))
            state["final_response"] = f"Generated {count} similar question(s)."
        
        elif action == QuizAction.REVIEW.value:
            wrong = response_data.get("wrong_count", 0)
            state["final_response"] = f"Review {wrong} incorrect answer(s) to improve."
        
        else:
            state["final_response"] = "Quiz action completed."
        
        state["response_metadata"] = {
            "action": action,
            "success": True,
            "response_data": response_data
        }
        
        state["execution_path"].append("quiz:format")
        return state
    
    async def _handle_error(self, state: QuizAgentState) -> QuizAgentState:
        """Handle errors gracefully"""
        errors = state.get("errors", [])
        
        state["final_response"] = f"Quiz error: {'; '.join(errors)}. Please try again."
        state["response_metadata"] = {
            "success": False,
            "errors": errors,
            "action": state.get("action", "unknown")
        }
        
        return state
    
    # ==================== Required Abstract Methods ====================
    
    async def _process_input(self, state: AgentState) -> AgentState:
        """Process and validate input - implemented via _parse_request"""
        return state
    
    async def _execute_core_logic(self, state: AgentState) -> AgentState:
        """Execute main logic - implemented via action-specific methods"""
        return state
    
    async def _format_response(self, state: AgentState) -> AgentState:
        """Format response - implemented above"""
        return state


# ==================== Factory Function ====================

def create_quiz_agent(
    ai_client,
    knowledge_graph=None,
    memory_manager=None,
    db_session_factory=None
) -> QuizAgent:
    """Factory function to create quiz agent"""
    return QuizAgent(
        ai_client=ai_client,
        knowledge_graph=knowledge_graph,
        memory_manager=memory_manager,
        db_session_factory=db_session_factory
    )



