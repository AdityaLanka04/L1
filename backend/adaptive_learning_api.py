"""
API endpoints for Advanced Adaptive Learning & Personalization features
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from datetime import datetime

from database import get_db
import models
from adaptive_learning_engine import get_adaptive_engine
from ai_utils import UnifiedAIClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/adaptive", tags=["Adaptive Learning"])


# Request/Response Models
class AdaptDifficultyRequest(BaseModel):
    user_id: str
    topic: Optional[str] = None


class PersonalizedCurriculumRequest(BaseModel):
    user_id: str
    goal_topic: str


class ContentTransformRequest(BaseModel):
    user_id: str
    content: str
    topic: str
    transformation_type: str  # 'simplify', 'examples', 'analogies', 'interactive'


class TutorModeRequest(BaseModel):
    user_id: str
    topic: str
    mode: str  # 'step_by_step', 'socratic', 'hints_only', etc.
    question: str


def register_adaptive_learning_api(app, unified_ai: UnifiedAIClient):
    """Register all adaptive learning API endpoints"""
    
    @app.get("/api/adaptive/difficulty")
    async def get_adaptive_difficulty(
        user_id: str = Query(...),
        topic: Optional[str] = None,
        db: Session = Depends(get_db)
    ):
        """Get user's adaptive difficulty level"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            
            if topic:
                difficulty = engine.difficulty_adapter.get_optimal_question_difficulty(db, user.id, topic)
            else:
                difficulty = engine.difficulty_adapter.calculate_current_level(db, user.id)
            
            return {
                "status": "success",
                "difficulty_level": difficulty,
                "topic": topic,
                "message": f"Content difficulty adapted to {difficulty} level"
            }
        except Exception as e:
            logger.error(f"Error getting adaptive difficulty: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/learning-style")
    async def detect_learning_style(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Detect user's learning style preferences"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            style_scores = engine.style_detector.detect_style(db, user.id)
            dominant_style = engine.style_detector.get_dominant_style(style_scores)
            
            return {
                "status": "success",
                "learning_style": dominant_style,
                "style_breakdown": style_scores,
                "adaptations": engine.style_detector.adapt_content_format(dominant_style, "")
            }
        except Exception as e:
            logger.error(f"Error detecting learning style: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/curriculum")
    async def get_personalized_curriculum(
        user_id: str = Query(...),
        goal_topic: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Create personalized learning curriculum"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            curriculum = engine.curriculum_builder.build_curriculum(db, user.id, goal_topic)
            
            return {
                "status": "success",
                "goal_topic": goal_topic,
                "curriculum": curriculum,
                "total_estimated_hours": sum(c['estimated_hours'] for c in curriculum)
            }
        except Exception as e:
            logger.error(f"Error building curriculum: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/knowledge-gaps")
    async def find_knowledge_gaps(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Find user's knowledge blind spots"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            gaps = engine.gap_analyzer.find_knowledge_gaps(db, user.id)
            
            # Add remediation suggestions
            for gap in gaps:
                gap['remediation'] = engine.gap_analyzer.suggest_remediation(gap)
            
            return {
                "status": "success",
                "knowledge_gaps": gaps,
                "total_gaps": len(gaps),
                "critical_gaps": len([g for g in gaps if g['gap_severity'] == 'critical'])
            }
        except Exception as e:
            logger.error(f"Error finding knowledge gaps: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/retention")
    async def optimize_retention(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Get spaced repetition schedule for optimal retention"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            due_reviews = engine.retention_optimizer.get_due_reviews(db, user.id)
            
            return {
                "status": "success",
                "due_reviews": due_reviews,
                "total_due": len(due_reviews),
                "urgent_reviews": len([r for r in due_reviews if r['priority'] == 'urgent'])
            }
        except Exception as e:
            logger.error(f"Error optimizing retention: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    
    @app.post("/api/adaptive/transform-content")
    async def transform_content(
        request: ContentTransformRequest,
        db: Session = Depends(get_db)
    ):
        """Transform content based on user preferences"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            
            if request.transformation_type == 'simplify':
                difficulty = engine.difficulty_adapter.calculate_current_level(db, user.id)
                prompt = engine.content_transformer.simplify_content(request.content, difficulty)
                result = unified_ai.generate(prompt, max_tokens=2000)
                
            elif request.transformation_type == 'examples':
                prompt = engine.content_transformer.add_real_world_examples(request.topic, request.content)
                result = unified_ai.generate(prompt, max_tokens=2000)
                
            elif request.transformation_type == 'analogies':
                prompt = engine.content_transformer.create_analogies(request.topic)
                result = unified_ai.generate(prompt, max_tokens=1500)
                
            elif request.transformation_type == 'interactive':
                interactive_prompts = engine.content_transformer.make_interactive(request.content)
                result = {
                    'quiz': unified_ai.generate(interactive_prompts['quiz_questions'], max_tokens=1500),
                    'exercises': unified_ai.generate(interactive_prompts['practice_exercises'], max_tokens=1500),
                    'discussions': unified_ai.generate(interactive_prompts['discussion_prompts'], max_tokens=1000)
                }
            else:
                raise HTTPException(status_code=400, detail="Invalid transformation type")
            
            return {
                "status": "success",
                "transformation_type": request.transformation_type,
                "result": result
            }
        except Exception as e:
            logger.error(f"Error transforming content: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/predict-forgetting")
    async def predict_forgetting(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Predict what user will forget next"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            prediction = engine.predictive_engine.predict_next_forgotten_topic(db, user.id)
            
            if prediction:
                return {
                    "status": "success",
                    "prediction": prediction,
                    "message": f"You're likely to forget {prediction['topic']} soon. Review recommended!"
                }
            else:
                return {
                    "status": "success",
                    "prediction": None,
                    "message": "All topics are well-retained!"
                }
        except Exception as e:
            logger.error(f"Error predicting forgetting: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/burnout-risk")
    async def detect_burnout_risk(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Detect burnout risk and provide recommendations"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            burnout_analysis = engine.predictive_engine.detect_burnout_risk(db, user.id)
            
            return {
                "status": "success",
                "burnout_analysis": burnout_analysis
            }
        except Exception as e:
            logger.error(f"Error detecting burnout: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/break-schedule")
    async def get_break_schedule(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Get optimal break schedule"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            breaks = engine.predictive_engine.suggest_optimal_break_times(db, user.id)
            
            return {
                "status": "success",
                "break_schedule": breaks,
                "message": "Take regular breaks to maintain focus and prevent burnout"
            }
        except Exception as e:
            logger.error(f"Error getting break schedule: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/focus-prediction")
    async def predict_focus_level(
        user_id: str = Query(...),
        time_of_day: int = Query(..., ge=0, le=23),
        db: Session = Depends(get_db)
    ):
        """Predict focus level at specific time"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            prediction = engine.predictive_engine.predict_focus_level(db, user.id, time_of_day)
            
            return {
                "status": "success",
                "focus_prediction": prediction,
                "time_of_day": time_of_day
            }
        except Exception as e:
            logger.error(f"Error predicting focus: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post("/api/adaptive/tutor-mode")
    async def use_tutor_mode(
        request: TutorModeRequest,
        db: Session = Depends(get_db)
    ):
        """Use specific AI tutor mode"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == request.user_id) | (models.User.email == request.user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            difficulty = engine.difficulty_adapter.calculate_current_level(db, user.id)
            
            mode_prompt = engine.tutor_modes.get_mode_prompt(request.mode, request.topic, difficulty)
            full_prompt = f"{mode_prompt}\n\nStudent question: {request.question}"
            
            response = unified_ai.generate(full_prompt, max_tokens=2000)
            
            return {
                "status": "success",
                "mode": request.mode,
                "response": response
            }
        except Exception as e:
            logger.error(f"Error using tutor mode: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/study-twin")
    async def find_study_twin(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Find study partner with similar learning patterns"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            study_twin = engine.collab_matcher.find_study_twin(db, user.id)
            
            if study_twin:
                return {
                    "status": "success",
                    "study_twin": study_twin,
                    "message": "Found a great study partner for you!"
                }
            else:
                return {
                    "status": "success",
                    "study_twin": None,
                    "message": "No matching study partners found yet"
                }
        except Exception as e:
            logger.error(f"Error finding study twin: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/complementary-learners")
    async def find_complementary_learners(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Find learners with complementary strengths"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            complementary = engine.collab_matcher.find_complementary_learners(db, user.id)
            
            return {
                "status": "success",
                "complementary_learners": complementary,
                "total_matches": len(complementary)
            }
        except Exception as e:
            logger.error(f"Error finding complementary learners: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/api/adaptive/comprehensive-recommendations")
    async def get_comprehensive_recommendations(
        user_id: str = Query(...),
        db: Session = Depends(get_db)
    ):
        """Get all personalized recommendations in one call"""
        try:
            user = db.query(models.User).filter(
                (models.User.username == user_id) | (models.User.email == user_id)
            ).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            engine = get_adaptive_engine()
            recommendations = engine.get_personalized_recommendations(db, user.id)
            
            return {
                "status": "success",
                "recommendations": recommendations,
                "generated_at": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Adaptive Learning API endpoints registered")
