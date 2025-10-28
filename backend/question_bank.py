import os
import sys
import json
import logging
import tempfile
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path
import re

from fastapi import HTTPException, Depends, UploadFile, File, Query, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
import PyPDF2
import io

from groq import Groq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DifficultyClassifierAgent:
    def __init__(self, groq_client: Groq, model: str):
        self.groq_client = groq_client
        self.model = model
    
    async def classify_difficulty(self, question: str, context: str = "") -> Dict[str, Any]:
        prompt = f"""Analyze this question and classify its difficulty level as 'easy', 'medium', or 'hard'.

Question: {question}

Context: {context}

Consider these factors:
1. Cognitive complexity (recall vs analysis vs synthesis)
2. Number of concepts required
3. Depth of understanding needed
4. Problem-solving steps required

Respond in JSON format:
{{
    "difficulty": "easy|medium|hard",
    "reasoning": "brief explanation",
    "cognitive_level": "remember|understand|apply|analyze|evaluate|create",
    "estimated_time_seconds": 60
}}"""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
                max_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            logger.error(f"Difficulty classification error: {e}")
            return {
                "difficulty": "medium",
                "reasoning": "Classification failed, defaulting to medium",
                "cognitive_level": "understand",
                "estimated_time_seconds": 120
            }


class PDFProcessorAgent:
    def __init__(self, groq_client: Groq, model: str):
        self.groq_client = groq_client
        self.model = model
    
    async def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            text = ""
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text() + "\n\n"
            
            return text.strip()
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to extract text from PDF: {str(e)}")
    
    async def analyze_document(self, text: str) -> Dict[str, Any]:
        prompt = f"""Analyze this document and extract key information:

{text[:8000]}

Provide a JSON response with:
{{
    "main_topics": ["topic1", "topic2", ...],
    "key_concepts": ["concept1", "concept2", ...],
    "document_type": "lecture_notes|assignment|exam|review|textbook",
    "difficulty_level": "introductory|intermediate|advanced",
    "subject_area": "detected subject"
}}"""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
                max_tokens=800
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            logger.error(f"Document analysis error: {e}")
            return {
                "main_topics": ["General"],
                "key_concepts": [],
                "document_type": "unknown",
                "difficulty_level": "intermediate",
                "subject_area": "Unknown"
            }


class QuestionGeneratorAgent:
    def __init__(self, groq_client: Groq, model: str):
        self.groq_client = groq_client
        self.model = model
    
    async def generate_questions(
        self, 
        content: str, 
        question_count: int,
        question_types: List[str],
        difficulty_distribution: Dict[str, int],
        topics: List[str] = None
    ) -> List[Dict[str, Any]]:
        
        types_str = ", ".join(question_types)
        topics_str = ", ".join(topics) if topics else "all topics in the content"
        
        prompt = f"""Generate {question_count} exam-style questions from this content.

Content:
{content[:10000]}

Requirements:
- Question types: {types_str}
- Difficulty distribution: {json.dumps(difficulty_distribution)}
- Focus topics: {topics_str}

For each question, provide:
{{
    "question_text": "the question",
    "question_type": "multiple_choice|true_false|short_answer|fill_blank",
    "difficulty": "easy|medium|hard",
    "topic": "specific topic",
    "correct_answer": "answer",
    "options": ["A", "B", "C", "D"],  # only for multiple_choice
    "explanation": "why this is correct",
    "points": 1
}}

Return a JSON array of questions."""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.7,
                max_tokens=4000
            )
            
            content = response.choices[0].message.content
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                questions = json.loads(json_match.group())
            else:
                questions = json.loads(content)
            
            return questions
        except Exception as e:
            logger.error(f"Question generation error: {e}")
            return []
    
    async def generate_similar_question(
        self, 
        original_question: Dict[str, Any],
        difficulty: str = None
    ) -> Dict[str, Any]:
        
        difficulty = difficulty or original_question.get("difficulty", "medium")
        
        prompt = f"""Generate a similar question based on this original question.

Original Question:
{json.dumps(original_question, indent=2)}

Requirements:
- Same topic and concept
- Same question type
- Difficulty level: {difficulty}
- Different specific details/numbers/examples
- Similar cognitive level

Return a JSON object with the same structure as the original."""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.8,
                max_tokens=800
            )
            
            similar_question = json.loads(response.choices[0].message.content)
            return similar_question
        except Exception as e:
            logger.error(f"Similar question generation error: {e}")
            return original_question


class AdaptiveDifficultyAgent:
    def __init__(self):
        self.performance_threshold_high = 0.85
        self.performance_threshold_low = 0.50
    
    def analyze_performance(
        self, 
        user_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        
        if not user_history:
            return {
                "recommended_difficulty": "medium",
                "reason": "No history available",
                "suggested_distribution": {"easy": 3, "medium": 5, "hard": 2}
            }
        
        recent_sessions = user_history[-5:]
        
        total_questions = 0
        correct_answers = 0
        difficulty_performance = {"easy": {"correct": 0, "total": 0}, 
                                 "medium": {"correct": 0, "total": 0},
                                 "hard": {"correct": 0, "total": 0}}
        
        for session in recent_sessions:
            for result in session.get("results", []):
                total_questions += 1
                difficulty = result.get("difficulty", "medium")
                
                if difficulty not in difficulty_performance:
                    difficulty = "medium"
                
                difficulty_performance[difficulty]["total"] += 1
                
                if result.get("is_correct", False):
                    correct_answers += 1
                    difficulty_performance[difficulty]["correct"] += 1
        
        if total_questions == 0:
            return {
                "recommended_difficulty": "medium",
                "reason": "Insufficient data",
                "suggested_distribution": {"easy": 3, "medium": 5, "hard": 2}
            }
        
        overall_accuracy = correct_answers / total_questions
        
        easy_accuracy = (difficulty_performance["easy"]["correct"] / 
                        difficulty_performance["easy"]["total"]) if difficulty_performance["easy"]["total"] > 0 else 0
        medium_accuracy = (difficulty_performance["medium"]["correct"] / 
                          difficulty_performance["medium"]["total"]) if difficulty_performance["medium"]["total"] > 0 else 0
        hard_accuracy = (difficulty_performance["hard"]["correct"] / 
                        difficulty_performance["hard"]["total"]) if difficulty_performance["hard"]["total"] > 0 else 0
        
        if overall_accuracy >= self.performance_threshold_high:
            if hard_accuracy >= 0.70:
                return {
                    "recommended_difficulty": "hard",
                    "reason": f"Excellent performance ({overall_accuracy:.1%}), ready for harder challenges",
                    "suggested_distribution": {"easy": 1, "medium": 4, "hard": 5}
                }
            else:
                return {
                    "recommended_difficulty": "medium-hard",
                    "reason": f"Strong performance ({overall_accuracy:.1%}), increasing difficulty",
                    "suggested_distribution": {"easy": 2, "medium": 5, "hard": 3}
                }
        
        elif overall_accuracy <= self.performance_threshold_low:
            return {
                "recommended_difficulty": "easy-medium",
                "reason": f"Building foundation ({overall_accuracy:.1%}), focusing on fundamentals",
                "suggested_distribution": {"easy": 5, "medium": 4, "hard": 1}
            }
        
        else:
            return {
                "recommended_difficulty": "medium",
                "reason": f"Balanced performance ({overall_accuracy:.1%}), maintaining steady progress",
                "suggested_distribution": {"easy": 3, "medium": 5, "hard": 2}
            }
    
    def adjust_next_question_difficulty(
        self, 
        current_streak: int, 
        current_difficulty: str
    ) -> str:
        
        if current_streak >= 3 and current_difficulty != "hard":
            return "medium" if current_difficulty == "easy" else "hard"
        elif current_streak <= -2 and current_difficulty != "easy":
            return "medium" if current_difficulty == "hard" else "easy"
        else:
            return current_difficulty


class MLPerformancePredictor:
    def __init__(self):
        self.feature_weights = {
            "recent_accuracy": 0.35,
            "topic_familiarity": 0.25,
            "time_of_day": 0.10,
            "session_length": 0.15,
            "difficulty_progression": 0.15
        }
    
    def predict_success_probability(
        self, 
        user_context: Dict[str, Any]
    ) -> float:
        
        score = 0.5
        
        if "recent_accuracy" in user_context:
            score += (user_context["recent_accuracy"] - 0.5) * self.feature_weights["recent_accuracy"]
        
        if "topic_familiarity" in user_context:
            familiarity = user_context["topic_familiarity"]
            familiarity_score = {"never_seen": 0, "seen_once": 0.3, "familiar": 0.6, "mastered": 0.9}
            score += (familiarity_score.get(familiarity, 0.5) - 0.5) * self.feature_weights["topic_familiarity"]
        
        if "questions_in_session" in user_context:
            fatigue_factor = max(0, 1 - (user_context["questions_in_session"] / 50))
            score += (fatigue_factor - 0.5) * self.feature_weights["session_length"]
        
        return max(0.0, min(1.0, score))
    
    def recommend_next_topics(
        self, 
        user_profile: Dict[str, Any],
        available_topics: List[str]
    ) -> List[str]:
        
        weak_topics = user_profile.get("weak_areas", [])
        strong_topics = user_profile.get("strong_areas", [])
        recent_topics = user_profile.get("recent_topics", [])
        
        prioritized = []
        
        for topic in available_topics:
            if topic in weak_topics and topic not in recent_topics[-3:]:
                prioritized.insert(0, topic)
            elif topic not in strong_topics:
                prioritized.append(topic)
        
        return prioritized[:5]


class QuestionBankRequest(BaseModel):
    user_id: str
    chat_session_ids: Optional[List[int]] = []
    slide_ids: Optional[List[int]] = []
    question_count: int = 10
    difficulty_mix: Optional[Dict[str, int]] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: Optional[List[str]] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None


class CustomQuestionRequest(BaseModel):
    user_id: str
    content: Optional[str] = None
    pdf_id: Optional[int] = None
    question_count: int = 10
    difficulty_mix: Dict[str, int]
    question_types: List[str]


class SimilarQuestionRequest(BaseModel):
    user_id: str
    question_set_id: int
    question_id: int
    difficulty: Optional[str] = None


class AnswerSubmission(BaseModel):
    user_id: str
    question_set_id: int
    answers: Dict[str, Any]


def initialize_question_bank_agents(groq_client: Groq, model: str):
    return {
        "difficulty_classifier": DifficultyClassifierAgent(groq_client, model),
        "pdf_processor": PDFProcessorAgent(groq_client, model),
        "question_generator": QuestionGeneratorAgent(groq_client, model),
        "adaptive_difficulty": AdaptiveDifficultyAgent(),
        "ml_predictor": MLPerformancePredictor()
    }


def register_question_bank_api(app, groq_client: Groq, model: str, get_db):
    agents = initialize_question_bank_agents(groq_client, model)
    
    @app.post("/qb/upload_pdf")
    async def upload_pdf_for_questions(
        user_id: str = Query(...),
        file: UploadFile = File(...),
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            pdf_content = await file.read()
            
            text = await agents["pdf_processor"].extract_text_from_pdf(pdf_content)
            
            analysis = await agents["pdf_processor"].analyze_document(text)
            
            pdf_record = models.UploadedDocument(
                user_id=user.id,
                filename=file.filename,
                document_type="pdf",
                content=text,
                metadata=json.dumps(analysis),
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(pdf_record)
            db.commit()
            db.refresh(pdf_record)
            
            return {
                "status": "success",
                "pdf_id": pdf_record.id,
                "filename": file.filename,
                "analysis": analysis,
                "text_preview": text[:500]
            }
            
        except Exception as e:
            logger.error(f"PDF upload error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/qb/get_uploaded_documents")
    async def get_uploaded_documents(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                return {"documents": []}
            
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.user_id == user.id
            ).order_by(models.UploadedDocument.created_at.desc()).all()
            
            result = []
            for doc in documents:
                metadata = json.loads(doc.metadata) if doc.metadata else {}
                result.append({
                    "id": doc.id,
                    "filename": doc.filename,
                    "document_type": doc.document_type,
                    "created_at": doc.created_at.isoformat(),
                    "analysis": metadata
                })
            
            return {"documents": result}
            
        except Exception as e:
            logger.error(f"Error fetching documents: {e}")
            return {"documents": []}
    
    @app.post("/qb/generate_from_pdf")
    async def generate_questions_from_pdf(
        request: CustomQuestionRequest,
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if request.pdf_id:
                document = db.query(models.UploadedDocument).filter(
                    models.UploadedDocument.id == request.pdf_id,
                    models.UploadedDocument.user_id == user.id
                ).first()
                
                if not document:
                    raise HTTPException(status_code=404, detail="Document not found")
                
                content = document.content
                metadata = json.loads(document.metadata) if document.metadata else {}
                topics = metadata.get("main_topics", [])
            else:
                content = request.content
                topics = []
            
            questions = await agents["question_generator"].generate_questions(
                content=content,
                question_count=request.question_count,
                question_types=request.question_types,
                difficulty_distribution=request.difficulty_mix,
                topics=topics
            )
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=f"Questions from {document.filename if request.pdf_id else 'Custom Content'}",
                description=f"Generated {len(questions)} questions",
                source_type="pdf" if request.pdf_id else "custom",
                source_id=request.pdf_id,
                total_questions=len(questions),
                created_at=datetime.now(timezone.utc)
            )
            
            db.add(question_set)
            db.commit()
            db.refresh(question_set)
            
            for idx, q in enumerate(questions):
                question_record = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty", "medium"),
                    topic=q.get("topic", "General"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question_record)
            
            db.commit()
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions)
            }
            
        except Exception as e:
            logger.error(f"Error generating questions from PDF: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/generate_similar_question")
    async def generate_similar_question(
        request: SimilarQuestionRequest,
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            original_question = db.query(models.Question).filter(
                models.Question.id == request.question_id
            ).first()
            
            if not original_question:
                raise HTTPException(status_code=404, detail="Question not found")
            
            original_data = {
                "question_text": original_question.question_text,
                "question_type": original_question.question_type,
                "difficulty": original_question.difficulty,
                "topic": original_question.topic,
                "correct_answer": original_question.correct_answer,
                "options": json.loads(original_question.options) if original_question.options else [],
                "explanation": original_question.explanation
            }
            
            similar_question = await agents["question_generator"].generate_similar_question(
                original_question=original_data,
                difficulty=request.difficulty
            )
            
            new_question = models.Question(
                question_set_id=original_question.question_set_id,
                question_text=similar_question.get("question_text"),
                question_type=similar_question.get("question_type"),
                difficulty=similar_question.get("difficulty"),
                topic=similar_question.get("topic"),
                correct_answer=similar_question.get("correct_answer"),
                options=json.dumps(similar_question.get("options", [])),
                explanation=similar_question.get("explanation"),
                points=similar_question.get("points", 1),
                order_index=999
            )
            
            db.add(new_question)
            db.commit()
            db.refresh(new_question)
            
            return {
                "status": "success",
                "question": {
                    "id": new_question.id,
                    "question_text": new_question.question_text,
                    "question_type": new_question.question_type,
                    "difficulty": new_question.difficulty,
                    "topic": new_question.topic,
                    "options": json.loads(new_question.options) if new_question.options else []
                }
            }
            
        except Exception as e:
            logger.error(f"Error generating similar question: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/submit_answers_adaptive")
    async def submit_answers_with_adaptation(
        request: AnswerSubmission,
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == request.question_set_id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == request.question_set_id
            ).all()
            
            results = []
            correct_count = 0
            
            for question in questions:
                user_answer = request.answers.get(str(question.id))
                is_correct = str(user_answer).strip().lower() == str(question.correct_answer).strip().lower()
                
                if is_correct:
                    correct_count += 1
                
                results.append({
                    "question_id": question.id,
                    "user_answer": user_answer,
                    "correct_answer": question.correct_answer,
                    "is_correct": is_correct,
                    "difficulty": question.difficulty,
                    "topic": question.topic,
                    "explanation": question.explanation
                })
            
            session_record = models.QuestionSession(
                user_id=user.id,
                question_set_id=request.question_set_id,
                score=int((correct_count / len(questions)) * 100) if questions else 0,
                total_questions=len(questions),
                correct_count=correct_count,
                results=json.dumps(results),
                completed_at=datetime.now(timezone.utc)
            )
            
            db.add(session_record)
            db.commit()
            db.refresh(session_record)
            
            user_history = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).limit(10).all()
            
            history_data = []
            for session in user_history:
                history_data.append({
                    "score": session.score,
                    "results": json.loads(session.results) if session.results else []
                })
            
            adaptation = agents["adaptive_difficulty"].analyze_performance(history_data)
            
            return {
                "status": "success",
                "score": session_record.score,
                "correct_count": correct_count,
                "total_questions": len(questions),
                "details": results,
                "adaptation": adaptation
            }
            
        except Exception as e:
            logger.error(f"Error submitting answers: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/qb/get_adaptive_recommendations")
    async def get_adaptive_recommendations(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user_history = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).limit(10).all()
            
            history_data = []
            for session in user_history:
                history_data.append({
                    "score": session.score,
                    "results": json.loads(session.results) if session.results else []
                })
            
            performance_analysis = agents["adaptive_difficulty"].analyze_performance(history_data)
            
            all_topics = db.query(models.Question.topic).distinct().all()
            available_topics = [t[0] for t in all_topics if t[0]]
            
            user_profile = {
                "weak_areas": [],
                "strong_areas": [],
                "recent_topics": []
            }
            
            recommended_topics = agents["ml_predictor"].recommend_next_topics(
                user_profile, available_topics
            )
            
            return {
                "performance_analysis": performance_analysis,
                "recommended_topics": recommended_topics,
                "recent_sessions": len(history_data)
            }
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("Question Bank API with AI agents registered successfully")