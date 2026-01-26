"""
Enhanced Chat Context Provider
Provides comprehensive context for the AI chat agent including:
- User profile and preferences
- Notes and study materials
- Flashcards and mastery levels
- Quiz performance and analytics
- Strengths and weaknesses
- Learning progress and goals
- Subject-specific context
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

logger = logging.getLogger(__name__)


class EnhancedChatContextProvider:
    """
    Provides rich, comprehensive context for AI chat interactions.
    Aggregates data from all user learning activities.
    """
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
    
    def _calculate_day_streak(self, db: Session, user_id: int) -> int:
        """Calculate the user's current day streak from DailyLearningMetrics."""
        import models
        from datetime import timezone
        
        today = datetime.now(timezone.utc).date()
        
        recent_days = db.query(models.DailyLearningMetrics.date).filter(
            models.DailyLearningMetrics.user_id == user_id,
            models.DailyLearningMetrics.questions_answered > 0
        ).order_by(models.DailyLearningMetrics.date.desc()).all()
        
        if not recent_days:
            return 0
        
        recent_dates = [day[0] for day in recent_days]
        
        # If no activity today or yesterday, streak is broken
        if today not in recent_dates and (today - timedelta(days=1)) not in recent_dates:
            return 0
        
        streak = 0
        check_date = today if today in recent_dates else today - timedelta(days=1)
        
        while check_date in recent_dates:
            streak += 1
            check_date -= timedelta(days=1)
        
        return streak
    
    async def get_comprehensive_context(
        self, 
        user_id: int, 
        current_topic: Optional[str] = None,
        include_notes: bool = True,
        include_flashcards: bool = True,
        include_quizzes: bool = True,
        include_analytics: bool = True
    ) -> Dict[str, Any]:
        """
        Get comprehensive context for the AI chat agent.
        This provides the AI with full awareness of the user's learning journey.
        """
        db = self.db_session_factory()
        try:
            import models
            
            # Get user and profile
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if not user:
                return {"error": "User not found"}
            
            context = {
                "user_profile": self._get_user_profile(db, user),
                "learning_preferences": self._get_learning_preferences(db, user_id),
                "current_session_context": {},
            }
            
            if include_notes:
                context["notes_context"] = self._get_notes_context(db, user_id, current_topic)
            
            if include_flashcards:
                context["flashcards_context"] = self._get_flashcards_context(db, user_id, current_topic)
            
            if include_quizzes:
                context["quiz_context"] = self._get_quiz_context(db, user_id, current_topic)
            
            if include_analytics:
                context["analytics"] = self._get_analytics_context(db, user_id)
                context["strengths_weaknesses"] = self._get_strengths_weaknesses(db, user_id)
            
            context["subjects"] = self._get_subjects_context(db, user_id)
            context["recent_activity"] = self._get_recent_activity(db, user_id)
            context["learning_goals"] = self._get_learning_goals(db, user_id)
            
            return context
            
        except Exception as e:
            logger.error(f"Error getting comprehensive context: {e}")
            return {"error": str(e)}
        finally:
            db.close()
    
    def _get_user_profile(self, db: Session, user) -> Dict[str, Any]:
        """Get user profile information"""
        import models
        
        profile = {
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "Student",
            "first_name": user.first_name or "Student",
            "email": user.email,
            "field_of_study": user.field_of_study or "General Studies",
            "learning_style": user.learning_style or "Mixed",
            "school": user.school_university or "",
            "age": user.age,
        }
        
        # Get comprehensive profile if exists
        comp_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        if comp_profile:
            profile.update({
                "is_college_student": comp_profile.is_college_student,
                "college_level": comp_profile.college_level,
                "major": comp_profile.major,
                "main_subject": comp_profile.main_subject,
                "difficulty_level": comp_profile.difficulty_level or "intermediate",
                "learning_pace": comp_profile.learning_pace or "moderate",
                "brainwave_goal": comp_profile.brainwave_goal,
                "primary_archetype": comp_profile.primary_archetype,
                "secondary_archetype": comp_profile.secondary_archetype,
                "archetype_description": comp_profile.archetype_description,
            })
            
            # Parse JSON fields
            try:
                profile["preferred_subjects"] = json.loads(comp_profile.preferred_subjects or "[]")
            except:
                profile["preferred_subjects"] = []
            
            try:
                profile["weak_areas"] = json.loads(comp_profile.weak_areas or "[]")
            except:
                profile["weak_areas"] = []
            
            try:
                profile["strong_areas"] = json.loads(comp_profile.strong_areas or "[]")
            except:
                profile["strong_areas"] = []
            
            try:
                profile["best_study_times"] = json.loads(comp_profile.best_study_times or "[]")
            except:
                profile["best_study_times"] = []
        
        return profile
    
    def _get_learning_preferences(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get user learning preferences"""
        import models
        
        prefs = db.query(models.UserPreferences).filter(
            models.UserPreferences.user_id == user_id
        ).first()
        
        if prefs:
            return {
                "explanation_style": prefs.preferred_explanation_style,
                "language_complexity": prefs.language_complexity,
                "likes_challenges": prefs.likes_challenges,
                "likes_step_by_step": prefs.likes_step_by_step,
                "prefers_analogies": prefs.prefers_analogies,
                "prefers_real_examples": prefs.prefers_real_examples,
                "wants_encouragement": prefs.wants_encouragement,
                "wants_progress_updates": prefs.wants_progress_updates,
            }
        
        return {
            "explanation_style": "balanced",
            "language_complexity": "medium",
            "likes_challenges": True,
            "likes_step_by_step": True,
            "prefers_analogies": True,
            "prefers_real_examples": True,
            "wants_encouragement": True,
            "wants_progress_updates": True,
        }
    
    def _get_notes_context(self, db: Session, user_id: int, topic: Optional[str] = None) -> Dict[str, Any]:
        """Get context from user's notes"""
        import models
        
        # Get recent notes
        notes_query = db.query(models.Note).filter(
            models.Note.user_id == user_id,
            models.Note.is_deleted == False
        ).order_by(desc(models.Note.updated_at))
        
        recent_notes = notes_query.limit(10).all()
        
        # Get topic-relevant notes if topic provided
        relevant_notes = []
        if topic:
            for note in notes_query.limit(50).all():
                if topic.lower() in (note.title or "").lower() or topic.lower() in (note.content or "").lower():
                    relevant_notes.append(note)
        
        return {
            "total_notes": db.query(models.Note).filter(
                models.Note.user_id == user_id,
                models.Note.is_deleted == False
            ).count(),
            "recent_notes": [
                {
                    "title": n.title,
                    "preview": (n.content or "")[:200],
                    "updated": n.updated_at.isoformat() if n.updated_at else None
                }
                for n in recent_notes[:5]
            ],
            "relevant_notes": [
                {
                    "title": n.title,
                    "content_preview": (n.content or "")[:500],
                }
                for n in relevant_notes[:3]
            ] if relevant_notes else [],
            "note_topics": list(set([n.title for n in recent_notes if n.title]))[:10]
        }
    
    def _get_flashcards_context(self, db: Session, user_id: int, topic: Optional[str] = None) -> Dict[str, Any]:
        """Get context from user's flashcards"""
        import models
        
        # Get flashcard sets
        sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user_id
        ).order_by(desc(models.FlashcardSet.updated_at)).all()
        
        total_cards = 0
        mastered_cards = 0
        struggling_cards = []
        set_summaries = []
        
        for fs in sets[:10]:
            cards = db.query(models.Flashcard).filter(
                models.Flashcard.set_id == fs.id
            ).all()
            
            total_cards += len(cards)
            
            for card in cards:
                if card.times_reviewed > 0:
                    accuracy = card.correct_count / card.times_reviewed
                    if accuracy >= 0.8:
                        mastered_cards += 1
                    elif accuracy < 0.5 and card.times_reviewed >= 2:
                        struggling_cards.append({
                            "question": card.question[:100],
                            "set": fs.title,
                            "accuracy": round(accuracy * 100)
                        })
            
            set_summaries.append({
                "title": fs.title,
                "card_count": len(cards),
                "description": fs.description[:100] if fs.description else ""
            })
        
        return {
            "total_sets": len(sets),
            "total_cards": total_cards,
            "mastered_cards": mastered_cards,
            "mastery_rate": round((mastered_cards / total_cards * 100) if total_cards > 0 else 0),
            "struggling_cards": struggling_cards[:5],
            "recent_sets": set_summaries[:5],
            "flashcard_topics": [s.title for s in sets[:10]]
        }
    
    def _get_quiz_context(self, db: Session, user_id: int, topic: Optional[str] = None) -> Dict[str, Any]:
        """Get context from user's quiz performance"""
        import models
        
        # Get question sets
        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user_id
        ).order_by(desc(models.QuestionSet.created_at)).all()
        
        # Get attempts
        attempts = db.query(models.QuestionAttempt).filter(
            models.QuestionAttempt.user_id == user_id
        ).order_by(desc(models.QuestionAttempt.submitted_at)).limit(20).all()
        
        total_questions_answered = sum(a.total_questions for a in attempts)
        total_correct = sum(a.correct_count for a in attempts)
        
        # Find weak topics from quiz performance
        weak_topics = []
        strong_topics = []
        
        for qs in question_sets:
            qs_attempts = [a for a in attempts if a.question_set_id == qs.id]
            if qs_attempts:
                avg_score = sum(a.score for a in qs_attempts) / len(qs_attempts)
                if avg_score < 60:
                    weak_topics.append({"topic": qs.title, "avg_score": round(avg_score)})
                elif avg_score >= 80:
                    strong_topics.append({"topic": qs.title, "avg_score": round(avg_score)})
        
        return {
            "total_quizzes": len(question_sets),
            "total_attempts": len(attempts),
            "total_questions_answered": total_questions_answered,
            "overall_accuracy": round((total_correct / total_questions_answered * 100) if total_questions_answered > 0 else 0),
            "weak_quiz_topics": weak_topics[:5],
            "strong_quiz_topics": strong_topics[:5],
            "recent_quiz_scores": [
                {"score": round(a.score), "date": a.submitted_at.isoformat() if a.submitted_at else None}
                for a in attempts[:5]
            ],
            "quiz_topics": [qs.title for qs in question_sets[:10]]
        }
    
    def _get_analytics_context(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get learning analytics"""
        import models
        
        # Get user stats
        stats = db.query(models.UserStats).filter(
            models.UserStats.user_id == user_id
        ).first()
        
        # Get enhanced stats
        enhanced = db.query(models.EnhancedUserStats).filter(
            models.EnhancedUserStats.user_id == user_id
        ).first()
        
        # Get daily metrics for the last 7 days
        week_ago = datetime.utcnow().date() - timedelta(days=7)
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id,
            models.DailyLearningMetrics.date >= week_ago
        ).order_by(desc(models.DailyLearningMetrics.date)).all()
        
        # Calculate day streak from DailyLearningMetrics (accurate calculation)
        day_streak = self._calculate_day_streak(db, user_id)
        
        analytics = {
            "total_lessons": stats.total_lessons if stats else 0,
            "total_hours": round(stats.total_hours, 1) if stats else 0,
            "day_streak": day_streak,
            "accuracy_percentage": round(stats.accuracy_percentage, 1) if stats else 0,
        }
        
        if enhanced:
            analytics.update({
                "learning_velocity": round(enhanced.learning_velocity, 2),
                "comprehension_rate": round(enhanced.comprehension_rate * 100, 1),
                "retention_score": round(enhanced.retention_score * 100, 1),
                "consistency_rating": round(enhanced.consistency_rating * 100, 1),
                "study_level": enhanced.study_level,
                "favorite_subject": enhanced.favorite_subject,
                "total_questions": enhanced.total_questions,
                "total_flashcards": enhanced.total_flashcards,
                "total_notes": enhanced.total_notes,
            })
        
        # Weekly summary
        if daily_metrics:
            analytics["weekly_summary"] = {
                "sessions": sum(m.sessions_completed for m in daily_metrics),
                "time_spent_minutes": round(sum(m.time_spent_minutes for m in daily_metrics)),
                "questions_answered": sum(m.questions_answered for m in daily_metrics),
                "avg_accuracy": round(
                    sum(m.accuracy_rate for m in daily_metrics) / len(daily_metrics) * 100
                ) if daily_metrics else 0,
                "active_days": len([m for m in daily_metrics if m.sessions_completed > 0])
            }
        
        return analytics
    
    def _get_strengths_weaknesses(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get user's strengths and weaknesses"""
        import models
        
        logger.info(f"=== Getting strengths/weaknesses for user {user_id} ===")
        
        # Get formatted analysis for chat display
        try:
            from comprehensive_weakness_analyzer import format_weakness_analysis_for_chat
            
            logger.info("Calling format_weakness_analysis_for_chat...")
            formatted_analysis = format_weakness_analysis_for_chat(db, user_id, models)
            
            if formatted_analysis and len(formatted_analysis) > 50:
                logger.info(f"✅ Got formatted analysis ({len(formatted_analysis)} chars)")
                # Return formatted text that can be directly displayed
                return {
                    "formatted_response": formatted_analysis,
                    "has_formatted": True
                }
            else:
                logger.warning(f"Formatted analysis too short or empty: {len(formatted_analysis) if formatted_analysis else 0} chars")
        except Exception as e:
            logger.error(f"❌ Error getting formatted weakness analysis: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        logger.info("Falling back to old method...")
        
        # Fallback to old method if formatted analysis fails
        # Get topic mastery
        mastery = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id
        ).order_by(desc(models.TopicMastery.last_practiced)).all()
        
        strengths = []
        weaknesses = []
        
        for tm in mastery:
            if tm.mastery_level >= 0.7:
                strengths.append({
                    "topic": tm.topic_name,
                    "mastery": round(tm.mastery_level * 100),
                    "confidence": round(tm.confidence_level * 100)
                })
            elif tm.mastery_level < 0.5 and tm.times_studied >= 2:
                weaknesses.append({
                    "topic": tm.topic_name,
                    "mastery": round(tm.mastery_level * 100),
                    "times_studied": tm.times_studied
                })
        
        # Also check comprehensive profile
        comp_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        profile_weak = []
        profile_strong = []
        
        if comp_profile:
            try:
                profile_weak = json.loads(comp_profile.weak_areas or "[]")
            except:
                pass
            try:
                profile_strong = json.loads(comp_profile.strong_areas or "[]")
            except:
                pass
        
        logger.info(f"Fallback method: {len(strengths)} strengths, {len(weaknesses)} weaknesses")
        
        return {
            "has_formatted": False,
            "strengths": strengths[:10],
            "weaknesses": weaknesses[:10],
            "self_reported_weak_areas": profile_weak,
            "self_reported_strong_areas": profile_strong,
            "topics_needing_review": [
                tm.topic_name for tm in mastery 
                if tm.last_practiced and 
                (datetime.utcnow() - tm.last_practiced).days > 7 and
                tm.mastery_level < 0.8
            ][:5]
        }
    
    def _get_subjects_context(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get subjects the user is studying"""
        import models
        
        # Aggregate subjects from various sources
        subjects = set()
        
        # From notes
        notes = db.query(models.Note).filter(
            models.Note.user_id == user_id,
            models.Note.is_deleted == False
        ).limit(50).all()
        
        for note in notes:
            if note.title:
                subjects.add(note.title.split()[0] if note.title else "")
        
        # From flashcard sets
        sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user_id
        ).all()
        
        for fs in sets:
            if fs.title:
                subjects.add(fs.title)
        
        # From question sets
        qsets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user_id
        ).all()
        
        for qs in qsets:
            if qs.title:
                subjects.add(qs.title)
        
        # From topic mastery
        mastery = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user_id
        ).all()
        
        for tm in mastery:
            subjects.add(tm.topic_name)
        
        # Clean up
        subjects = [s for s in subjects if s and len(s) > 2]
        
        return {
            "all_subjects": list(subjects)[:20],
            "subject_count": len(subjects)
        }
    
    def _get_recent_activity(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get recent learning activity"""
        import models
        
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(desc(models.Activity.timestamp)).limit(10).all()
        
        return {
            "recent_topics": list(set([a.topic for a in activities if a.topic]))[:5],
            "recent_questions": [
                {
                    "question": a.question[:100] if a.question else "",
                    "topic": a.topic,
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None
                }
                for a in activities[:5]
            ],
            "activity_count_today": len([
                a for a in activities 
                if a.timestamp and a.timestamp.date() == datetime.utcnow().date()
            ])
        }
    
    def _get_learning_goals(self, db: Session, user_id: int) -> Dict[str, Any]:
        """Get user's learning goals"""
        import models
        
        # Get daily goal
        today = datetime.utcnow().date()
        daily_goal = db.query(models.DailyGoal).filter(
            models.DailyGoal.user_id == str(user_id),
            models.DailyGoal.date == today
        ).first()
        
        # Get comprehensive profile for goals
        comp_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        goals = {
            "daily_target": daily_goal.target if daily_goal else 20,
            "daily_progress": daily_goal.progress if daily_goal else 0,
        }
        
        if comp_profile:
            goals["brainwave_goal"] = comp_profile.brainwave_goal
        
        return goals


def build_comprehensive_system_prompt(context: Dict[str, Any], user_message: str = "") -> str:
    """
    Build a comprehensive system prompt for the AI chat agent
    that includes all relevant user context.
    """
    profile = context.get("user_profile", {})
    prefs = context.get("learning_preferences", {})
    analytics = context.get("analytics", {})
    sw = context.get("strengths_weaknesses", {})
    notes = context.get("notes_context", {})
    flashcards = context.get("flashcards_context", {})
    quizzes = context.get("quiz_context", {})
    subjects = context.get("subjects", {})
    activity = context.get("recent_activity", {})
    goals = context.get("learning_goals", {})
    
    prompt = f"""You are an expert AI tutor and learning companion for {profile.get('first_name', 'the student')}. You have comprehensive knowledge of their learning journey and should use this context to provide personalized, effective tutoring.

## STUDENT PROFILE
- Name: {profile.get('name', 'Student')}
- Field of Study: {profile.get('field_of_study', 'General Studies')}
- Major: {profile.get('major', 'Not specified')}
- Main Subject: {profile.get('main_subject', 'Various')}
- Learning Style: {profile.get('learning_style', 'Mixed')}
- Difficulty Level: {profile.get('difficulty_level', 'intermediate')}
- Learning Pace: {profile.get('learning_pace', 'moderate')}
- School/University: {profile.get('school', 'Not specified')}
- Learning Archetype: {profile.get('primary_archetype', 'Adaptive Learner')} {f"/ {profile.get('secondary_archetype')}" if profile.get('secondary_archetype') else ''}

## LEARNING PREFERENCES
- Explanation Style: {prefs.get('explanation_style', 'balanced')}
- Language Complexity: {prefs.get('language_complexity', 'medium')}
- Likes Challenges: {'Yes' if prefs.get('likes_challenges') else 'No'}
- Prefers Step-by-Step: {'Yes' if prefs.get('likes_step_by_step') else 'No'}
- Likes Analogies: {'Yes' if prefs.get('prefers_analogies') else 'No'}
- Prefers Real Examples: {'Yes' if prefs.get('prefers_real_examples') else 'No'}
- Wants Encouragement: {'Yes' if prefs.get('wants_encouragement') else 'No'}

## LEARNING ANALYTICS
- Study Streak: {analytics.get('day_streak', 0)} days
- Total Study Hours: {analytics.get('total_hours', 0)} hours
- Overall Accuracy: {analytics.get('accuracy_percentage', 0)}%
- Study Level: {analytics.get('study_level', 'Beginner')}
- Comprehension Rate: {analytics.get('comprehension_rate', 0)}%
- Retention Score: {analytics.get('retention_score', 0)}%

## STRENGTHS (Topics they excel at)
{chr(10).join([f"- {s['topic']}: {s['mastery']}% mastery" for s in sw.get('strengths', [])[:5]]) or '- Still building strengths'}

## WEAKNESSES (Areas needing attention)
{chr(10).join([f"- {w['topic']}: {w['mastery']}% mastery (studied {w['times_studied']} times)" for w in sw.get('weaknesses', [])[:5]]) or '- No significant weaknesses identified'}

## SELF-REPORTED AREAS
- Weak Areas: {', '.join(sw.get('self_reported_weak_areas', [])) or 'None specified'}
- Strong Areas: {', '.join(sw.get('self_reported_strong_areas', [])) or 'None specified'}
- Topics Needing Review: {', '.join(sw.get('topics_needing_review', [])) or 'None'}

## STUDY MATERIALS
- Notes: {notes.get('total_notes', 0)} notes created
- Recent Note Topics: {', '.join(notes.get('note_topics', [])[:5]) or 'None'}
- Flashcards: {flashcards.get('total_cards', 0)} cards across {flashcards.get('total_sets', 0)} sets
- Flashcard Mastery: {flashcards.get('mastery_rate', 0)}%
- Quiz Performance: {quizzes.get('overall_accuracy', 0)}% accuracy across {quizzes.get('total_attempts', 0)} attempts

## STRUGGLING FLASHCARDS (Cards they often get wrong)
{chr(10).join([f"- {c['question']} (Set: {c['set']}, {c['accuracy']}% accuracy)" for c in flashcards.get('struggling_cards', [])[:3]]) or '- None identified'}

## SUBJECTS BEING STUDIED
{', '.join(subjects.get('all_subjects', [])[:10]) or 'General topics'}

## RECENT ACTIVITY
- Topics discussed recently: {', '.join(activity.get('recent_topics', [])) or 'None'}
- Activity today: {activity.get('activity_count_today', 0)} interactions

## LEARNING GOALS
- Daily Goal: {goals.get('daily_progress', 0)}/{goals.get('daily_target', 20)} questions
- Main Goal: {goals.get('brainwave_goal', 'Learn effectively')}

## YOUR ROLE AND APPROACH
1. **Be Personal**: Use their name, reference their specific subjects and materials
2. **Be Adaptive**: Match their learning style ({profile.get('learning_style', 'Mixed')}) and pace ({profile.get('learning_pace', 'moderate')})
3. **Be Aware**: Reference their notes, flashcards, and quiz performance when relevant
4. **Be Supportive**: {'Provide encouragement and positive reinforcement' if prefs.get('wants_encouragement') else 'Be direct and efficient'}
5. **Be Targeted**: Focus on their weak areas while building on strengths
6. **Be Interactive**: Ask follow-up questions, suggest practice problems, recommend creating flashcards
7. **Be Comprehensive**: Explain concepts thoroughly with {'step-by-step breakdowns' if prefs.get('likes_step_by_step') else 'clear explanations'}
8. **Use Examples**: {'Provide real-world examples and analogies' if prefs.get('prefers_real_examples') else 'Focus on theoretical understanding'}

## RESPONSE GUIDELINES
- If they ask about a topic they're weak in, provide extra detail and scaffolding
- If they ask about a strength, challenge them with deeper questions
- Reference their existing notes or flashcards when relevant
- Suggest creating study materials (notes, flashcards) for new topics
- Celebrate their progress and streak
- If they seem confused, break things down further
- If they seem confident, push them to think deeper

Remember: You have access to their entire learning history. Use this knowledge to provide the most personalized, effective tutoring possible. Make them feel understood and supported in their learning journey."""

    return prompt
