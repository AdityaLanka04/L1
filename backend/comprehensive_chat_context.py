"""
Comprehensive Chat Context Builder
Provides full context awareness for AI chat including notes, flashcards, quizzes, analytics, etc.
Enhanced with full content access and dynamic navigation buttons.
"""

import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _calculate_day_streak(db: Session, user_id: int) -> int:
    """Get the user's current day streak from UserStats (same as dashboard)."""
    import models
    
    # First try to get from UserStats (this is what the dashboard uses)
    user_stats = db.query(models.UserStats).filter(
        models.UserStats.user_id == user_id
    ).first()
    
    if user_stats and user_stats.day_streak:
        return user_stats.day_streak
    
    # Fallback: Calculate from DailyLearningMetrics if UserStats not available
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


def _strip_html(html_content: str) -> str:
    """Strip HTML tags from content for plain text summary."""
    if not html_content:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', html_content)
    # Remove extra whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def _extract_topic_from_question(question: str) -> Optional[str]:
    """Extract the main topic from any question for generating relevant action buttons."""
    question_lower = question.lower().strip()
    
    # Skip very short questions
    if len(question_lower) < 5:
        return None
    
    # Common question starters to remove
    starters = [
        r"^(?:can you |could you |please |help me |i want to |i need to |i'd like to )",
        r"^(?:what is |what are |what's |whats |how do |how does |how to |how can i )",
        r"^(?:explain |tell me about |describe |define |show me |teach me )",
        r"^(?:why is |why are |why do |why does |when is |when are |where is |where are )",
        r"^(?:give me |create |make |generate |write |build )",
    ]
    
    topic = question_lower
    for pattern in starters:
        topic = re.sub(pattern, '', topic, flags=re.IGNORECASE)
    
    # Remove trailing punctuation and common endings
    topic = re.sub(r'[?.!]+$', '', topic)
    topic = re.sub(r'\s+(?:please|thanks|thank you|for me)$', '', topic)
    
    # Clean up
    topic = topic.strip()
    
    # If topic is too long, take first few meaningful words
    words = topic.split()
    if len(words) > 5:
        topic = ' '.join(words[:5])
    
    # Skip if too short or just common words
    if len(topic) < 3 or topic in ['a', 'an', 'the', 'it', 'this', 'that']:
        return None
    
    return topic.title() if topic else None


def _generate_topic_buttons(topic: str) -> List[Dict[str, Any]]:
    """Generate action buttons for a topic (create note, flashcards, quiz)."""
    if not topic:
        return []
    
    # Truncate topic for button labels
    short_topic = topic[:25] + '...' if len(topic) > 25 else topic
    
    return [
        {
            "label": f"Create Note on {short_topic}",
            "action": "create",
            "navigate_to": "/notes/my-notes",
            "navigate_params": {"topic": topic},
            "icon": "note",
            "content_type": "note"
        },
        {
            "label": f"Create Flashcards on {short_topic}",
            "action": "create",
            "navigate_to": "/flashcards",
            "navigate_params": {"topic": topic},
            "icon": "flashcard",
            "content_type": "flashcard_set"
        },
        {
            "label": f"Quiz Me on {short_topic}",
            "action": "navigate",
            "navigate_to": "/solo-quiz",
            "navigate_params": {"topic": topic},
            "icon": "play",
            "content_type": "quiz"
        }
    ]


def _detect_content_query(question: str) -> Dict[str, Any]:
    """Detect if user is asking about specific notes, flashcards, or quizzes."""
    question_lower = question.lower()
    
    result = {
        "is_content_query": False,
        "content_type": None,
        "search_terms": [],
        "action_type": None  # view, create, search
    }
    
    # Patterns for notes
    note_patterns = [
        r"(?:show|open|view|find|get|what(?:'s| is| are)? (?:in )?my|tell me about my|read my)\s+(?:note|notes)\s*(?:on|about|for|called|titled|named)?\s*(.+)?",
        r"(?:note|notes)\s+(?:on|about|for|called|titled|named)\s+(.+)",
        r"what (?:did i|have i) (?:write|wrote|written|note|noted)\s*(?:about|on)?\s*(.+)?",
        r"(?:my|the)\s+(.+?)\s+(?:note|notes)",
    ]
    
    # Patterns for flashcards
    flashcard_patterns = [
        r"(?:show|open|view|find|get|what(?:'s| is| are)? (?:in )?my|tell me about my|review my)\s+(?:flashcard|flashcards|cards)\s*(?:on|about|for|called|titled|named)?\s*(.+)?",
        r"(?:flashcard|flashcards|cards)\s+(?:on|about|for|called|titled|named)\s+(.+)",
        r"what (?:flashcard|flashcards|cards) (?:do i have|have i made|did i create)\s*(?:about|on|for)?\s*(.+)?",
        r"(?:my|the)\s+(.+?)\s+(?:flashcard|flashcards|cards)",
    ]
    
    # Patterns for quizzes
    quiz_patterns = [
        r"(?:show|open|view|find|get|what(?:'s| is| are)? (?:in )?my|tell me about my|take my)\s+(?:quiz|quizzes|questions)\s*(?:on|about|for|called|titled|named)?\s*(.+)?",
        r"(?:quiz|quizzes|questions)\s+(?:on|about|for|called|titled|named)\s+(.+)",
        r"what (?:quiz|quizzes|questions) (?:do i have|have i made|did i create)\s*(?:about|on|for)?\s*(.+)?",
        r"(?:my|the)\s+(.+?)\s+(?:quiz|quizzes|questions)",
        r"quiz me (?:on|about)\s+(.+)",
    ]
    
    # Check notes
    for pattern in note_patterns:
        match = re.search(pattern, question_lower)
        if match:
            result["is_content_query"] = True
            result["content_type"] = "notes"
            result["action_type"] = "view"
            if match.groups() and match.group(1):
                result["search_terms"] = [match.group(1).strip()]
            return result
    
    # Check flashcards
    for pattern in flashcard_patterns:
        match = re.search(pattern, question_lower)
        if match:
            result["is_content_query"] = True
            result["content_type"] = "flashcards"
            result["action_type"] = "view"
            if match.groups() and match.group(1):
                result["search_terms"] = [match.group(1).strip()]
            return result
    
    # Check quizzes
    for pattern in quiz_patterns:
        match = re.search(pattern, question_lower)
        if match:
            result["is_content_query"] = True
            result["content_type"] = "quizzes"
            result["action_type"] = "view"
            if match.groups() and match.group(1):
                result["search_terms"] = [match.group(1).strip()]
            return result
    
    # General content queries
    if any(word in question_lower for word in ["my notes", "my flashcards", "my quizzes", "my cards"]):
        result["is_content_query"] = True
        if "note" in question_lower:
            result["content_type"] = "notes"
        elif "flashcard" in question_lower or "card" in question_lower:
            result["content_type"] = "flashcards"
        elif "quiz" in question_lower:
            result["content_type"] = "quizzes"
        result["action_type"] = "list"
    
    return result


def search_user_content(
    db: Session, 
    user_id: int, 
    search_terms: List[str], 
    content_type: str = None
) -> Dict[str, List[Dict[str, Any]]]:
    """Search user's content (notes, flashcards, quizzes) by terms."""
    import models
    
    results = {
        "notes": [],
        "flashcards": [],
        "quizzes": []
    }
    
    search_query = " ".join(search_terms).lower() if search_terms else ""
    
    try:
        # Search notes
        if content_type is None or content_type == "notes":
            notes_query = db.query(models.Note).filter(
                models.Note.user_id == user_id,
                models.Note.is_deleted == False
            )
            
            if search_query:
                notes_query = notes_query.filter(
                    (models.Note.title.ilike(f"%{search_query}%")) |
                    (models.Note.content.ilike(f"%{search_query}%"))
                )
            
            notes = notes_query.order_by(models.Note.updated_at.desc()).limit(10).all()
            
            for note in notes:
                content_preview = _strip_html(note.content or "")[:300]
                results["notes"].append({
                    "id": note.id,
                    "title": note.title,
                    "content_preview": content_preview,
                    "full_content": _strip_html(note.content or "")[:2000],  # Full content for AI context
                    "updated_at": note.updated_at.isoformat() if note.updated_at else None,
                    "navigate_to": f"/notes/editor/{note.id}",
                    "type": "note"
                })
        
        # Search flashcards
        if content_type is None or content_type == "flashcards":
            fc_query = db.query(models.FlashcardSet).filter(
                models.FlashcardSet.user_id == user_id
            )
            
            if search_query:
                fc_query = fc_query.filter(
                    (models.FlashcardSet.title.ilike(f"%{search_query}%")) |
                    (models.FlashcardSet.description.ilike(f"%{search_query}%"))
                )
            
            flashcard_sets = fc_query.order_by(models.FlashcardSet.updated_at.desc()).limit(10).all()
            
            for fc_set in flashcard_sets:
                # Get flashcards in this set
                cards = db.query(models.Flashcard).filter(
                    models.Flashcard.set_id == fc_set.id
                ).limit(20).all()
                
                cards_data = [
                    {"question": card.question, "answer": card.answer[:200] if card.answer else ""}
                    for card in cards
                ]
                
                results["flashcards"].append({
                    "id": fc_set.id,
                    "title": fc_set.title,
                    "description": fc_set.description or "",
                    "card_count": len(cards),
                    "cards_preview": cards_data[:5],  # First 5 cards for preview
                    "all_cards": cards_data,  # All cards for AI context
                    "updated_at": fc_set.updated_at.isoformat() if fc_set.updated_at else None,
                    "navigate_to": f"/flashcards?set_id={fc_set.id}",
                    "type": "flashcard_set"
                })
        
        # Search quizzes
        if content_type is None or content_type == "quizzes":
            quiz_query = db.query(models.QuestionSet).filter(
                models.QuestionSet.user_id == user_id
            )
            
            if search_query:
                quiz_query = quiz_query.filter(
                    (models.QuestionSet.title.ilike(f"%{search_query}%")) |
                    (models.QuestionSet.description.ilike(f"%{search_query}%"))
                )
            
            question_sets = quiz_query.order_by(models.QuestionSet.created_at.desc()).limit(10).all()
            
            for q_set in question_sets:
                # Get questions in this set
                questions = db.query(models.Question).filter(
                    models.Question.question_set_id == q_set.id
                ).limit(20).all()
                
                questions_data = []
                for q in questions:
                    try:
                        options = json.loads(q.options) if q.options else []
                    except:
                        options = []
                    questions_data.append({
                        "question": q.question_text,
                        "options": options,
                        "correct_answer": q.correct_answer,
                        "difficulty": q.difficulty
                    })
                
                results["quizzes"].append({
                    "id": q_set.id,
                    "title": q_set.title,
                    "description": q_set.description or "",
                    "question_count": len(questions),
                    "questions_preview": questions_data[:3],  # First 3 questions for preview
                    "all_questions": questions_data,  # All questions for AI context
                    "created_at": q_set.created_at.isoformat() if q_set.created_at else None,
                    "navigate_to": f"/question-bank?set_id={q_set.id}",
                    "type": "question_set"
                })
    
    except Exception as e:
        logger.error(f"Error searching user content: {e}")
    
    return results


def generate_action_buttons(
    content_results: Dict[str, List[Dict]], 
    content_type: str = None,
    topic: str = None
) -> List[Dict[str, Any]]:
    """Generate action buttons based on found content."""
    buttons = []
    
    # Add buttons for found notes
    for note in content_results.get("notes", [])[:3]:
        buttons.append({
            "label": f"View Note: {note['title'][:30]}{'...' if len(note['title']) > 30 else ''}",
            "action": "navigate",
            "navigate_to": note["navigate_to"],
            "icon": "note",
            "content_id": note["id"],
            "content_type": "note"
        })
    
    # Add buttons for found flashcards
    for fc in content_results.get("flashcards", [])[:3]:
        buttons.append({
            "label": f"Review: {fc['title'][:30]}{'...' if len(fc['title']) > 30 else ''} ({fc['card_count']} cards)",
            "action": "navigate",
            "navigate_to": fc["navigate_to"],
            "icon": "flashcard",
            "content_id": fc["id"],
            "content_type": "flashcard_set"
        })
    
    # Add buttons for found quizzes
    for quiz in content_results.get("quizzes", [])[:3]:
        buttons.append({
            "label": f"Take Quiz: {quiz['title'][:30]}{'...' if len(quiz['title']) > 30 else ''} ({quiz['question_count']} questions)",
            "action": "navigate",
            "navigate_to": quiz["navigate_to"],
            "icon": "quiz",
            "content_id": quiz["id"],
            "content_type": "question_set"
        })
    
    # Add creation buttons if topic is provided and no content found
    if topic and not any(content_results.values()):
        buttons.extend([
            {
                "label": f"Create Note on {topic[:20]}",
                "action": "create",
                "navigate_to": "/notes/editor/new",
                "navigate_params": {"topic": topic},
                "icon": "plus",
                "content_type": "note"
            },
            {
                "label": f"Create Flashcards on {topic[:20]}",
                "action": "create",
                "navigate_to": "/flashcards",
                "navigate_params": {"create": True, "topic": topic},
                "icon": "plus",
                "content_type": "flashcard_set"
            },
            {
                "label": f"Quiz Me on {topic[:20]}",
                "action": "create",
                "navigate_to": "/solo-quiz",
                "navigate_params": {"autoStart": True, "topics": [topic], "questionCount": 10},
                "icon": "play",
                "content_type": "quiz"
            }
        ])
    
    return buttons


async def build_comprehensive_chat_context(db: Session, user, question: str) -> Dict[str, Any]:
    """Build comprehensive context from all user data for the AI chat.
    
    Enhanced to include:
    - Full note content (not just titles)
    - Flashcard questions/answers
    - Quiz questions
    - Content search results for navigation
    - Action buttons for dynamic navigation
    """
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
        # New enhanced fields
        "content_query_detected": False,
        "content_search_results": {},
        "action_buttons": [],
        "full_content_context": "",  # Full content for AI to reference
        "extracted_topic": None,  # Topic extracted from question
    }
    
    try:
        # Extract topic from question for action buttons
        extracted_topic = _extract_topic_from_question(question)
        context["extracted_topic"] = extracted_topic
        
        # Detect if user is asking about specific content
        content_query = _detect_content_query(question)
        context["content_query_detected"] = content_query["is_content_query"]
        
        # If content query detected, search for relevant content
        if content_query["is_content_query"]:
            search_results = search_user_content(
                db, 
                user.id, 
                content_query["search_terms"],
                content_query["content_type"]
            )
            context["content_search_results"] = search_results
            
            # Generate action buttons for found content
            topic = content_query["search_terms"][0] if content_query["search_terms"] else None
            context["action_buttons"] = generate_action_buttons(search_results, content_query["content_type"], topic)
            
            # Build full content context for AI
            full_context_parts = []
            
            for note in search_results.get("notes", [])[:5]:
                full_context_parts.append(
                    f"NOTE '{note['title']}':\n{note['full_content'][:1500]}"
                )
            
            for fc in search_results.get("flashcards", [])[:3]:
                cards_text = "\n".join([
                    f"  Q: {c['question']}\n  A: {c['answer']}"
                    for c in fc.get("all_cards", [])[:10]
                ])
                full_context_parts.append(
                    f"FLASHCARD SET '{fc['title']}' ({fc['card_count']} cards):\n{cards_text}"
                )
            
            for quiz in search_results.get("quizzes", [])[:3]:
                questions_text = "\n".join([
                    f"  Q{i+1}: {q['question']}"
                    for i, q in enumerate(quiz.get("all_questions", [])[:5])
                ])
                full_context_parts.append(
                    f"QUIZ '{quiz['title']}' ({quiz['question_count']} questions):\n{questions_text}"
                )
            
            context["full_content_context"] = "\n\n".join(full_context_parts)
        
        # ALWAYS generate topic-based action buttons if we have a topic and no content buttons yet
        if extracted_topic and not context["action_buttons"]:
            context["action_buttons"] = _generate_topic_buttons(extracted_topic)
        
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
        
        # Get recent notes with FULL CONTENT (for topic awareness and AI context)
        recent_notes = db.query(models.Note).filter(
            models.Note.user_id == user.id,
            models.Note.is_deleted == False
        ).order_by(models.Note.updated_at.desc()).limit(10).all()
        
        if recent_notes:
            note_titles = [n.title for n in recent_notes if n.title]
            context["notes_summary"] = f"Recent notes: {', '.join(note_titles[:5])}"
            context["recent_topics"].extend(note_titles[:3])
            
            # Store full note data for AI context
            context["notes_full"] = [
                {
                    "id": n.id,
                    "title": n.title,
                    "content_preview": _strip_html(n.content or "")[:500],
                    "navigate_to": f"/notes/editor/{n.id}"
                }
                for n in recent_notes[:5]
            ]
        
        # Get flashcard sets with CARD CONTENT
        flashcard_sets = db.query(models.FlashcardSet).filter(
            models.FlashcardSet.user_id == user.id
        ).order_by(models.FlashcardSet.updated_at.desc()).limit(10).all()
        
        struggling_cards = []
        if flashcard_sets:
            set_titles = [fs.title for fs in flashcard_sets if fs.title]
            context["flashcard_summary"] = f"Flashcard sets: {', '.join(set_titles[:5])}"
            context["recent_topics"].extend(set_titles[:3])
            
            # Store full flashcard data for AI context
            context["flashcards_full"] = []
            
            for fs in flashcard_sets[:5]:
                cards = db.query(models.Flashcard).filter(
                    models.Flashcard.set_id == fs.id
                ).all()
                
                cards_data = [
                    {"question": card.question, "answer": card.answer[:200] if card.answer else ""}
                    for card in cards[:10]
                ]
                
                context["flashcards_full"].append({
                    "id": fs.id,
                    "title": fs.title,
                    "card_count": len(cards),
                    "cards_preview": cards_data,
                    "navigate_to": f"/flashcards?set_id={fs.id}"
                })
                
                # Find struggling cards
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
        
        # Get quiz performance with QUESTION CONTENT
        question_sets = db.query(models.QuestionSet).filter(
            models.QuestionSet.user_id == user.id
        ).limit(10).all()
        
        if question_sets:
            qs_titles = [qs.title for qs in question_sets if qs.title]
            context["quiz_summary"] = f"Quiz topics: {', '.join(qs_titles[:5])}"
            context["recent_topics"].extend(qs_titles[:3])
            
            # Store full quiz data for AI context
            context["quizzes_full"] = []
            
            for qs in question_sets[:5]:
                questions = db.query(models.Question).filter(
                    models.Question.question_set_id == qs.id
                ).limit(10).all()
                
                questions_data = [
                    {"question": q.question_text, "topic": q.topic}
                    for q in questions
                ]
                
                context["quizzes_full"].append({
                    "id": qs.id,
                    "title": qs.title,
                    "question_count": len(questions),
                    "questions_preview": questions_data[:5],
                    "navigate_to": f"/question-bank?set_id={qs.id}"
                })
        
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
        
        logger.info(f"Built comprehensive context: {len(context['recent_topics'])} topics, "
                   f"content_query={context['content_query_detected']}, "
                   f"buttons={len(context.get('action_buttons', []))}")
        
    except Exception as e:
        logger.error(f"Error building comprehensive context: {str(e)}")
        import traceback
        traceback.print_exc()
    
    return context


def build_enhanced_chat_prompt(user, context: Dict[str, Any], chat_history: str, question: str) -> str:
    """Build an enhanced prompt with comprehensive user context and full content."""
    
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
    
    # NEW: Include full content context if available
    full_content_context = context.get("full_content_context", "")
    content_context_section = ""
    if full_content_context:
        content_context_section = f"""

## USER'S RELEVANT CONTENT
The following is content from the user's notes, flashcards, or quizzes that may be relevant to their question:

{full_content_context}

When answering, reference this content specifically if relevant. If the user asks about their notes/flashcards/quizzes, 
use this information to give a detailed, personalized response."""
    
    # NEW: Include available content for navigation suggestions
    notes_full = context.get("notes_full", [])
    flashcards_full = context.get("flashcards_full", [])
    quizzes_full = context.get("quizzes_full", [])
    
    available_content = ""
    if notes_full or flashcards_full or quizzes_full:
        content_parts = []
        if notes_full:
            note_list = ", ".join([f"'{n['title']}'" for n in notes_full[:5]])
            content_parts.append(f"Notes: {note_list}")
        if flashcards_full:
            fc_list = ", ".join([f"'{f['title']}' ({f['card_count']} cards)" for f in flashcards_full[:5]])
            content_parts.append(f"Flashcard Sets: {fc_list}")
        if quizzes_full:
            quiz_list = ", ".join([f"'{q['title']}' ({q['question_count']} questions)" for q in quizzes_full[:5]])
            content_parts.append(f"Quizzes: {quiz_list}")
        
        available_content = f"\n\nAVAILABLE STUDY MATERIALS:\n" + "\n".join(content_parts)
    
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
{available_content}
{content_context_section}

## YOUR APPROACH
1. Be personal - use their name, reference their specific subjects and materials
2. Be adaptive - match their learning style ({learning_style}) and pace ({learning_pace})
3. Be aware - if they ask about a weak area, provide extra support and scaffolding
4. Be supportive - provide encouragement and celebrate their {day_streak} day streak!
5. Be interactive - ask follow-up questions, suggest creating flashcards for new concepts
6. Be comprehensive - explain thoroughly with step-by-step breakdowns when needed
7. When they ask about their content (notes, flashcards, quizzes), reference the specific content provided above
8. Suggest relevant study materials from their collection when appropriate

## MATHEMATICAL NOTATION
- Use $...$ for inline math: "The derivative $f'(x) = 2x$ shows..."
- Use $...$ for display equations
- Only wrap actual math in LaTeX, not regular text

{chat_history}

## CURRENT QUESTION
{question}

Provide a helpful, personalized, and educational response. If this relates to an area they struggle with, be extra supportive. If it's a strength, challenge them to think deeper. If they ask about their notes/flashcards/quizzes, give specific information from the content provided."""

    return prompt
