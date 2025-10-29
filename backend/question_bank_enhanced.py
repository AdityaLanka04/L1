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
from sqlalchemy import func, and_
from pydantic import BaseModel
import PyPDF2
import io

from groq import Groq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PDFUploadRequest(BaseModel):
    user_id: str


class QuestionGenerationRequest(BaseModel):
    user_id: str
    source_type: str
    source_id: Optional[int] = None
    content: Optional[str] = None
    question_count: int = 10
    difficulty_mix: Dict[str, int] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: List[str] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None
    title: Optional[str] = None


class CustomQuestionGenRequest(BaseModel):
    user_id: str
    content: str
    title: str
    question_count: int = 10
    difficulty_mix: Dict[str, int] = {"easy": 3, "medium": 5, "hard": 2}
    question_types: List[str] = ["multiple_choice", "true_false", "short_answer"]
    topics: Optional[List[str]] = None


class AnswerSubmission(BaseModel):
    user_id: str
    question_set_id: int
    answers: Dict[str, str]
    time_taken_seconds: Optional[int] = None


class SimilarQuestionRequest(BaseModel):
    user_id: str
    question_id: int
    difficulty: Optional[str] = None


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
    "document_type": "lecture_notes|assignment|exam|review|textbook|questions",
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
        
        prompt = f"""Generate {question_count} high-quality exam-style questions from this content.

Content:
{content[:10000]}

Requirements:
- Question types: {types_str}
- Difficulty distribution: {json.dumps(difficulty_distribution)}
- Focus topics: {topics_str}
- Ensure variety in question topics
- Make questions clear and unambiguous
- Provide detailed explanations

For each question, provide:
{{
    "question_text": "the question",
    "question_type": "multiple_choice|true_false|short_answer|fill_blank",
    "difficulty": "easy|medium|hard",
    "topic": "specific topic",
    "correct_answer": "answer",
    "options": ["A", "B", "C", "D"],
    "explanation": "detailed explanation why this is correct",
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
- Maintain high quality

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
    
    async def extract_questions_from_pdf(self, pdf_text: str) -> List[Dict[str, Any]]:
        prompt = f"""Extract and parse existing questions from this document.

Document Content:
{pdf_text[:10000]}

Parse any existing questions and return them in this format:
{{
    "question_text": "the question",
    "question_type": "multiple_choice|true_false|short_answer|fill_blank",
    "difficulty": "easy|medium|hard",
    "topic": "topic",
    "correct_answer": "answer if available",
    "options": ["A", "B", "C", "D"],
    "explanation": "explanation if available",
    "points": 1
}}

Return a JSON array of questions. If no questions found, return empty array []."""
        
        try:
            response = self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.3,
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
            logger.error(f"Question extraction error: {e}")
            return []


class AdaptiveDifficultyAgent:
    def __init__(self):
        pass
    
    def analyze_performance(self, session_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not session_history:
            return {
                "recommended_difficulty": "medium",
                "reason": "No previous performance data",
                "suggested_distribution": {"easy": 3, "medium": 5, "hard": 2}
            }
        
        recent_scores = [s.get("score", 0) for s in session_history[:5]]
        avg_score = sum(recent_scores) / len(recent_scores) if recent_scores else 50
        
        difficulty_stats = {"easy": [], "medium": [], "hard": []}
        for session in session_history[:5]:
            results = session.get("results", [])
            for result in results:
                diff = result.get("difficulty", "medium")
                is_correct = result.get("is_correct", False)
                if diff in difficulty_stats:
                    difficulty_stats[diff].append(is_correct)
        
        accuracy_by_difficulty = {}
        for diff, results in difficulty_stats.items():
            if results:
                accuracy_by_difficulty[diff] = sum(results) / len(results)
            else:
                accuracy_by_difficulty[diff] = 0.5
        
        if avg_score >= 85:
            recommendation = "hard"
            distribution = {"easy": 1, "medium": 4, "hard": 5}
            reason = "Excellent performance! Ready for more challenging questions."
        elif avg_score >= 70:
            recommendation = "medium"
            distribution = {"easy": 2, "medium": 6, "hard": 2}
            reason = "Solid understanding. Maintain current difficulty with gradual progression."
        else:
            recommendation = "easy"
            distribution = {"easy": 5, "medium": 4, "hard": 1}
            reason = "Building foundation. Focus on easier questions to strengthen understanding."
        
        return {
            "recommended_difficulty": recommendation,
            "reason": reason,
            "suggested_distribution": distribution,
            "accuracy_by_difficulty": accuracy_by_difficulty,
            "recent_average": round(avg_score, 1)
        }


class MLPredictorAgent:
    def __init__(self):
        pass
    
    def recommend_next_topics(self, user_profile: Dict[str, Any], available_topics: List[str]) -> List[str]:
        weak_areas = user_profile.get("weak_areas", [])
        strong_areas = user_profile.get("strong_areas", [])
        recent_topics = user_profile.get("recent_topics", [])
        
        recommendations = []
        
        for topic in weak_areas:
            if topic in available_topics and topic not in recommendations:
                recommendations.append(topic)
        
        for topic in available_topics:
            if topic not in weak_areas and topic not in strong_areas and topic not in recent_topics:
                if len(recommendations) < 5:
                    recommendations.append(topic)
        
        return recommendations[:5]


class ChatSlideProcessorAgent:
    def __init__(self, groq_client: Groq, model: str):
        self.groq_client = groq_client
        self.model = model
    
    async def extract_content_from_chat(self, chat_messages: List[Dict[str, str]]) -> str:
        combined_text = ""
        for msg in chat_messages:
            combined_text += f"User: {msg.get('user_message', '')}\n"
            combined_text += f"AI: {msg.get('ai_response', '')}\n\n"
        return combined_text
    
    async def extract_content_from_slides(self, slide_content: str) -> str:
        return slide_content


def register_question_bank_api(app, groq_client: Groq, model: str, get_db_func):
    
    agents = {
        "pdf_processor": PDFProcessorAgent(groq_client, model),
        "question_generator": QuestionGeneratorAgent(groq_client, model),
        "difficulty_classifier": DifficultyClassifierAgent(groq_client, model),
        "adaptive_difficulty": AdaptiveDifficultyAgent(),
        "ml_predictor": MLPredictorAgent(),
        "chat_slide_processor": ChatSlideProcessorAgent(groq_client, model)
    }
    
    @app.post("/qb/upload_pdf")
    async def upload_pdf(
        file: UploadFile = File(...),
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
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
            
            document = models.UploadedDocument(
                user_id=user.id,
                filename=file.filename,
                document_type=analysis.get("document_type", "unknown"),
                content=text,
                meta_data=json.dumps(analysis)
            )
            
            db.add(document)
            db.commit()
            db.refresh(document)
            
            return {
                "status": "success",
                "document_id": document.id,
                "filename": file.filename,
                "analysis": analysis
            }
            
        except Exception as e:
            logger.error(f"Error uploading PDF: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/qb/get_uploaded_documents")
    async def get_uploaded_documents(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            documents = db.query(models.UploadedDocument).filter(
                models.UploadedDocument.user_id == user.id
            ).order_by(models.UploadedDocument.created_at.desc()).all()
            
            return {
                "documents": [
                    {
                        "id": doc.id,
                        "filename": doc.filename,
                        "document_type": doc.document_type,
                        "created_at": doc.created_at.isoformat(),
                        "analysis": json.loads(doc.meta_data) if doc.meta_data else {}
                    }
                    for doc in documents
                ]
            }
            
        except Exception as e:
            logger.error(f"Error fetching documents: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/generate_from_pdf")
    async def generate_from_pdf(
        request: QuestionGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            if request.source_id:
                document = db.query(models.UploadedDocument).filter(
                    models.UploadedDocument.id == request.source_id,
                    models.UploadedDocument.user_id == user.id
                ).first()
                
                if not document:
                    raise HTTPException(status_code=404, detail="Document not found")
                
                content = document.content
                metadata = json.loads(document.meta_data) if document.meta_data else {}
                title = request.title or f"Questions from {document.filename}"
                
                if metadata.get("document_type") == "questions":
                    existing_questions = await agents["question_generator"].extract_questions_from_pdf(content)
                    
                    if existing_questions:
                        similar_questions = []
                        for orig_q in existing_questions[:request.question_count]:
                            similar = await agents["question_generator"].generate_similar_question(
                                orig_q,
                                difficulty=None
                            )
                            similar_questions.append(similar)
                        questions = similar_questions
                    else:
                        questions = await agents["question_generator"].generate_questions(
                            content,
                            request.question_count,
                            request.question_types,
                            request.difficulty_mix,
                            request.topics
                        )
                else:
                    questions = await agents["question_generator"].generate_questions(
                        content,
                        request.question_count,
                        request.question_types,
                        request.difficulty_mix,
                        request.topics
                    )
                
                source_type = "pdf"
            elif request.content:
                content = request.content
                title = request.title or "Custom Question Set"
                questions = await agents["question_generator"].generate_questions(
                    content,
                    request.question_count,
                    request.question_types,
                    request.difficulty_mix,
                    request.topics
                )
                source_type = "custom"
            else:
                raise HTTPException(status_code=400, detail="Must provide either source_id or content")
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions")
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {source_type}",
                source_type=source_type,
                source_id=request.source_id,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
            
        except Exception as e:
            logger.error(f"Error generating questions from PDF: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/generate_from_chat_slides")
    async def generate_from_chat_slides(
        request: QuestionGenerationRequest,
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            content_parts = []
            title_parts = []
            
            if request.source_type == "chat":
                chat = db.query(models.ChatSession).filter(
                    models.ChatSession.id == request.source_id,
                    models.ChatSession.user_id == user.id
                ).first()
                
                if not chat:
                    raise HTTPException(status_code=404, detail="Chat session not found")
                
                messages = db.query(models.ChatMessage).filter(
                    models.ChatMessage.chat_session_id == chat.id
                ).order_by(models.ChatMessage.timestamp.asc()).all()
                
                chat_content = await agents["chat_slide_processor"].extract_content_from_chat([
                    {"user_message": m.user_message, "ai_response": m.ai_response}
                    for m in messages
                ])
                content_parts.append(chat_content)
                title_parts.append(chat.title)
                
            elif request.source_type == "slide":
                slide = db.query(models.UploadedSlide).filter(
                    models.UploadedSlide.id == request.source_id,
                    models.UploadedSlide.user_id == user.id
                ).first()
                
                if not slide:
                    raise HTTPException(status_code=404, detail="Slide not found")
                
                content_parts.append(slide.content)
                title_parts.append(slide.title)
            
            combined_content = "\n\n".join(content_parts)
            title = request.title or f"Questions from {', '.join(title_parts)}"
            
            questions = await agents["question_generator"].generate_questions(
                combined_content,
                request.question_count,
                request.question_types,
                request.difficulty_mix,
                request.topics
            )
            
            if not questions:
                raise HTTPException(status_code=500, detail="Failed to generate questions")
            
            question_set = models.QuestionSet(
                user_id=user.id,
                title=title,
                description=f"Generated from {request.source_type}",
                source_type=request.source_type,
                source_id=request.source_id,
                total_questions=len(questions)
            )
            
            db.add(question_set)
            db.flush()
            
            for idx, q in enumerate(questions):
                question = models.Question(
                    question_set_id=question_set.id,
                    question_text=q.get("question_text"),
                    question_type=q.get("question_type"),
                    difficulty=q.get("difficulty"),
                    topic=q.get("topic"),
                    correct_answer=q.get("correct_answer"),
                    options=json.dumps(q.get("options", [])),
                    explanation=q.get("explanation"),
                    points=q.get("points", 1),
                    order_index=idx
                )
                db.add(question)
            
            db.commit()
            db.refresh(question_set)
            
            return {
                "status": "success",
                "question_set_id": question_set.id,
                "question_count": len(questions),
                "title": title
            }
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/qb/get_question_sets")
    async def get_question_sets(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_sets = db.query(models.QuestionSet).filter(
                models.QuestionSet.user_id == user.id
            ).order_by(models.QuestionSet.created_at.desc()).all()
            
            return {
                "question_sets": [
                    {
                        "id": qs.id,
                        "title": qs.title,
                        "description": qs.description,
                        "source_type": qs.source_type,
                        "total_questions": qs.total_questions,
                        "best_score": qs.best_score,
                        "attempts": qs.attempts,
                        "created_at": qs.created_at.isoformat(),
                        "updated_at": qs.updated_at.isoformat()
                    }
                    for qs in question_sets
                ]
            }
            
        except Exception as e:
            logger.error(f"Error fetching question sets: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/qb/get_question_set/{set_id}")
    async def get_question_set_detail(
        set_id: int,
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == set_id,
                models.QuestionSet.user_id == user.id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            questions = db.query(models.Question).filter(
                models.Question.question_set_id == set_id
            ).order_by(models.Question.order_index).all()
            
            return {
                "id": question_set.id,
                "title": question_set.title,
                "description": question_set.description,
                "source_type": question_set.source_type,
                "total_questions": question_set.total_questions,
                "best_score": question_set.best_score,
                "attempts": question_set.attempts,
                "created_at": question_set.created_at.isoformat(),
                "questions": [
                    {
                        "id": q.id,
                        "question_text": q.question_text,
                        "question_type": q.question_type,
                        "difficulty": q.difficulty,
                        "topic": q.topic,
                        "correct_answer": q.correct_answer,
                        "options": json.loads(q.options) if q.options else [],
                        "explanation": q.explanation,
                        "points": q.points
                    }
                    for q in questions
                ]
            }
            
        except Exception as e:
            logger.error(f"Error fetching question set: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.delete("/qb/delete_question_set/{set_id}")
    async def delete_question_set(
        set_id: int,
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            question_set = db.query(models.QuestionSet).filter(
                models.QuestionSet.id == set_id,
                models.QuestionSet.user_id == user.id
            ).first()
            
            if not question_set:
                raise HTTPException(status_code=404, detail="Question set not found")
            
            db.delete(question_set)
            db.commit()
            
            return {"status": "success", "message": "Question set deleted"}
            
        except Exception as e:
            logger.error(f"Error deleting question set: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/submit_answers")
    async def submit_answers(
        request: AnswerSubmission,
        db: Session = Depends(get_db_func)
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
            total_points = 0
            earned_points = 0
            
            for question in questions:
                user_answer = request.answers.get(str(question.id), "")
                correct_answer = str(question.correct_answer).strip().lower()
                user_answer_normalized = str(user_answer).strip().lower()
                
                is_correct = user_answer_normalized == correct_answer
                
                if is_correct:
                    correct_count += 1
                    earned_points += question.points
                
                total_points += question.points
                
                results.append({
                    "question_id": question.id,
                    "question_text": question.question_text,
                    "user_answer": user_answer,
                    "correct_answer": question.correct_answer,
                    "is_correct": is_correct,
                    "difficulty": question.difficulty,
                    "topic": question.topic,
                    "explanation": question.explanation,
                    "points": question.points
                })
            
            score = int((earned_points / total_points) * 100) if total_points > 0 else 0
            
            session_record = models.QuestionSession(
                user_id=user.id,
                question_set_id=request.question_set_id,
                score=score,
                total_questions=len(questions),
                correct_count=correct_count,
                results=json.dumps(results),
                time_taken_seconds=request.time_taken_seconds,
                completed_at=datetime.now(timezone.utc)
            )
            
            db.add(session_record)
            
            if score > question_set.best_score:
                question_set.best_score = score
            question_set.attempts += 1
            question_set.updated_at = datetime.now(timezone.utc)
            
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
                "session_id": session_record.id,
                "score": score,
                "correct_count": correct_count,
                "total_questions": len(questions),
                "earned_points": earned_points,
                "total_points": total_points,
                "details": results,
                "adaptation": adaptation
            }
            
        except Exception as e:
            logger.error(f"Error submitting answers: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/qb/generate_similar_question")
    async def generate_similar_question(
        request: SimilarQuestionRequest,
        db: Session = Depends(get_db_func)
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
    
    @app.get("/qb/get_analytics")
    async def get_analytics(
        user_id: str = Query(...),
        db: Session = Depends(get_db_func)
    ):
        try:
            import models
            
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            sessions = db.query(models.QuestionSession).filter(
                models.QuestionSession.user_id == user.id
            ).order_by(models.QuestionSession.completed_at.desc()).all()
            
            total_sessions = len(sessions)
            total_questions_answered = sum(s.total_questions for s in sessions)
            avg_score = sum(s.score for s in sessions) / total_sessions if total_sessions > 0 else 0
            
            topic_stats = {}
            difficulty_stats = {"easy": {"total": 0, "correct": 0}, "medium": {"total": 0, "correct": 0}, "hard": {"total": 0, "correct": 0}}
            
            for session in sessions:
                results = json.loads(session.results) if session.results else []
                for result in results:
                    topic = result.get("topic", "Unknown")
                    difficulty = result.get("difficulty", "medium")
                    is_correct = result.get("is_correct", False)
                    
                    if topic not in topic_stats:
                        topic_stats[topic] = {"total": 0, "correct": 0}
                    topic_stats[topic]["total"] += 1
                    if is_correct:
                        topic_stats[topic]["correct"] += 1
                    
                    if difficulty in difficulty_stats:
                        difficulty_stats[difficulty]["total"] += 1
                        if is_correct:
                            difficulty_stats[difficulty]["correct"] += 1
            
            topic_performance = []
            for topic, stats in topic_stats.items():
                accuracy = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
                topic_performance.append({
                    "topic": topic,
                    "accuracy": round(accuracy, 1),
                    "total_questions": stats["total"],
                    "correct_answers": stats["correct"]
                })
            
            topic_performance.sort(key=lambda x: x["accuracy"])
            
            difficulty_performance = []
            for difficulty, stats in difficulty_stats.items():
                accuracy = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
                difficulty_performance.append({
                    "difficulty": difficulty,
                    "accuracy": round(accuracy, 1),
                    "total_questions": stats["total"],
                    "correct_answers": stats["correct"]
                })
            
            recent_scores = [s.score for s in sessions[:10]]
            
            user_history = [
                {
                    "score": s.score,
                    "results": json.loads(s.results) if s.results else []
                }
                for s in sessions[:10]
            ]
            
            adaptation = agents["adaptive_difficulty"].analyze_performance(user_history)
            
            return {
                "total_sessions": total_sessions,
                "total_questions_answered": total_questions_answered,
                "average_score": round(avg_score, 1),
                "recent_scores": recent_scores,
                "topic_performance": topic_performance,
                "difficulty_performance": difficulty_performance,
                "weak_topics": [t for t in topic_performance if t["accuracy"] < 60][:5],
                "strong_topics": [t for t in sorted(topic_performance, key=lambda x: -x["accuracy"]) if t["accuracy"] >= 80][:5],
                "adaptive_recommendation": adaptation
            }
            
        except Exception as e:
            logger.error(f"Error fetching analytics: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("Enhanced Question Bank API with sophisticated AI agents registered successfully")