"""
Comprehensive Chat Context Builder
Provides full context awareness for AI chat including notes, flashcards, quizzes, analytics, etc.
"""

import json
import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _calculate_day_streak(db: Session, user_id: int) -> int:
    """Calculate the user's current day streak from DailyLearningMetrics."""
    import models
    
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


async def build_comprehensive_chat_context(db: Session, user, question: str) -> Dict[str, Any]:
    """Build comprehensive context from all user data for the AI chat."""
    import models
    from datetime import timedelta
    
    context = {
        "user_name": user.first_name or "Student",
        "field_of_study": user.field_of_study or "General Studies",
        "learning_style": user.learning_style or "Mixed",
        "recent_topics": [],
        "weak_areas": [],
        "strong_areas": [],
        "notes_summary": "",
        "flashcard_summary": "",
        "quiz_summary": "",
        "analytics_summary": "",
    }
    
    try:
        # Get comprehensive profile
        comp_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user.id
        ).first()
        
        if comp_profile:
            context["difficulty_level"] = comp_profile.difficulty_level or "intermediate"
            context["learning_pace"] = comp_profile.learning_pace or "moderate"
            context["major"] = comp_profile.major or ""
            context["main_subject"] = comp_profile.main_subject or ""
            context["primary_archetype"] = comp_profile.primary_archetype or ""
            
            try:
                context["weak_areas"] = json.loads(comp_profile.weak_areas or "[]")
            except:
                pass
            try:
                context["strong_areas"] = json.loads(comp_profile.strong_areas or "[]")
            except:
                pass
        
        # Get user stats
        stats = db.query(models.UserStats).filter(models.UserStats.user_id == user.id).first()
        if stats:
            context["total_hours"] = round(stats.total_hours or 0, 1)
            context["accuracy"] = round(stats.accuracy_percentage or 0, 1)
        
        # Calculate day streak from DailyLearningMetrics (the accurate way)
        context["day_streak"] = _calculate_day_streak(db, user.id)
        
        # Get recent notes (for topic awareness)
        recent_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == False
        ).order_by(models.Note.updated_at.desc()).limit(5).all()
        
        if recent_notes:
            note_titles = [n.title for n in recent_notes if n.title]
            context["notes_summary"] = f"Recent notes: {', '.join(note_titles[:5])}"
            context["recent_topics"].extend(note_titles[:3])
        
        # Get flashcard sets and struggling cards
        flashcard_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).order_by(models.FlashcardSet.updated_at.desc()).limit(5).all()
        
        struggling_cards = []
        if flashcard_sets:
            set_titles = [fs.title for fs in flashcard_sets if fs.title]
            context["flashcard_summary"] = f"Flashcard sets: {', '.join(set_titles[:5])}"
            context["recent_topics"].extend(set_titles[:3])
            
            # Find struggling cards
            for fs in flashcard_sets[:3]:
                cards = db.query(models.Flashcard).filter(
                    models.Flashcard.set_id == fs.id
                ).all()
                for card in cards:
                    if card.times_reviewed > 0:
                        accuracy = card.correct_count / card.times_reviewed
                        if accuracy < 0.5 and card.times_reviewed >= 2:
                            struggling_cards.append({
                                "question": card.question[:80],
                                "set": fs.title,
                                "accuracy": round(accuracy * 100)
                            })
            
            context["struggling_cards"] = struggling_cards[:5]
        
        # Get quiz performance
        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user.id
        ).limit(5).all()
        
        if question_sets:
            qs_titles = [qs.title for qs in question_sets if qs.title]
            context["quiz_summary"] = f"Quiz topics: {', '.join(qs_titles[:5])}"
            context["recent_topics"].extend(qs_titles[:3])
        
        # Get topic mastery for strengths/weaknesses
        mastery = db.query(models.TopicMastery).filter(
            models.TopicMastery.user_id == user.id
        ).order_by(models.TopicMastery.last_practiced.desc()).limit(10).all()
        
        strengths = []
        weaknesses = []
        for tm in mastery:
            if tm.mastery_level >= 0.7:
                strengths.append(f"{tm.topic_name} ({round(tm.mastery_level * 100)}%)")
            elif tm.mastery_level < 0.5 and tm.times_studied >= 2:
                weaknesses.append(f"{tm.topic_name} ({round(tm.mastery_level * 100)}%)")
        
        if strengths:
            context["strengths_from_mastery"] = strengths[:5]
        if weaknesses:
            context["weaknesses_from_mastery"] = weaknesses[:5]
        
        # Get recent activity topics
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user.id
        ).order_by(models.Activity.timestamp.desc()).limit(10).all()
        
        if activities:
            activity_topics = list(set([a.topic for a in activities if a.topic]))
            context["recent_topics"].extend(activity_topics[:3])
        
        # Deduplicate recent topics
        context["recent_topics"] = list(set(context["recent_topics"]))[:10]
        
        logger.info(f"📊 Built comprehensive context: {len(context['recent_topics'])} topics, {len(struggling_cards)} struggling cards")
        
    except Exception as e:
        logger.error(f"Error building comprehensive context: {str(e)}")
        import traceback
        traceback.print_exc()
    
    return context


def build_enhanced_chat_prompt(user, context: Dict[str, Any], chat_history: str, question: str) -> str:
    """Build an enhanced prompt with comprehensive user context."""
    
    first_name = context.get("user_name", "there")
    field_of_study = context.get("field_of_study", "your studies")
    major = context.get("major", "")
    main_subject = context.get("main_subject", "")
    learning_style = context.get("learning_style", "Mixed")
    difficulty_level = context.get("difficulty_level", "intermediate")
    learning_pace = context.get("learning_pace", "moderate")
    archetype = context.get("primary_archetype", "")
    
    # Build strengths/weaknesses section
    weak_areas = context.get("weak_areas", [])
    strong_areas = context.get("strong_areas", [])
    weaknesses_from_mastery = context.get("weaknesses_from_mastery", [])
    strengths_from_mastery = context.get("strengths_from_mastery", [])
    struggling_cards = context.get("struggling_cards", [])
    
    strengths_text = ""
    if strong_areas or strengths_from_mastery:
        all_strengths = strong_areas + strengths_from_mastery
        strengths_text = f"\n{first_name}'s STRENGTHS: {', '.join(all_strengths[:5])}"
    
    weaknesses_text = ""
    if weak_areas or weaknesses_from_mastery:
        all_weaknesses = weak_areas + weaknesses_from_mastery
        weaknesses_text = f"\n{first_name}'s AREAS NEEDING WORK: {', '.join(all_weaknesses[:5])}"
    
    struggling_text = ""
    if struggling_cards:
        cards_info = [f"'{c['question'][:50]}...' ({c['accuracy']}% accuracy)" for c in struggling_cards[:3]]
        struggling_text = f"\nFlashcards they struggle with: {'; '.join(cards_info)}"
    
    # Build study materials section
    notes_summary = context.get("notes_summary", "")
    flashcard_summary = context.get("flashcard_summary", "")
    quiz_summary = context.get("quiz_summary", "")
    recent_topics = context.get("recent_topics", [])
    
    materials_text = ""
    if notes_summary or flashcard_summary or quiz_summary:
        materials_text = f"\n\nSTUDY MATERIALS:\n{notes_summary}\n{flashcard_summary}\n{quiz_summary}"
    
    topics_text = ""
    if recent_topics:
        topics_text = f"\nRecent topics studied: {', '.join(recent_topics[:7])}"
    
    # Build analytics section
    day_streak = context.get("day_streak", 0)
    total_hours = context.get("total_hours", 0)
    accuracy = context.get("accuracy", 0)
    
    analytics_text = ""
    if day_streak or total_hours:
        analytics_text = f"\n\nLEARNING PROGRESS: {day_streak} day streak, {total_hours} hours studied, {accuracy}% accuracy"
    
    prompt = f"""You are an expert AI tutor and learning companion for {first_name}. You have comprehensive knowledge of their learning journey.

## STUDENT PROFILE
- Name: {first_name}
- Field of Study: {field_of_study}
{f'- Major: {major}' if major else ''}
{f'- Main Subject: {main_subject}' if main_subject else ''}
- Learning Style: {learning_style}
- Difficulty Level: {difficulty_level}
- Learning Pace: {learning_pace}
{f'- Learning Archetype: {archetype}' if archetype else ''}
{strengths_text}
{weaknesses_text}
{struggling_text}
{materials_text}
{topics_text}
{analytics_text}

## YOUR APPROACH
1. Be personal - use their name, reference their specific subjects and materials
2. Be adaptive - match their learning style ({learning_style}) and pace ({learning_pace})
3. Be aware - if they ask about a weak area, provide extra support and scaffolding
4. Be supportive - provide encouragement and celebrate their {day_streak} day streak!
5. Be interactive - ask follow-up questions, suggest creating flashcards for new concepts
6. Be comprehensive - explain thoroughly with step-by-step breakdowns when needed

## MATHEMATICAL NOTATION
- Use $...$ for inline math: "The derivative $f'(x) = 2x$ shows..."
- Use $...$ for display equations
- Only wrap actual math in LaTeX, not regular text

{chat_history}

## CURRENT QUESTION
{question}

Provide a helpful, personalized, and educational response. If this relates to an area they struggle with, be extra supportive. If it's a strength, challenge them to think deeper."""

    return prompt
