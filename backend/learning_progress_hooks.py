"""
Learning Progress Hooks
Automatic hooks to track progress from various study activities
"""
import logging
from typing import Optional, Dict
from sqlalchemy.orm import Session

from agents.learning_progress_tracker import get_progress_tracker

logger = logging.getLogger(__name__)


async def track_note_activity(
    db: Session,
    user_id: int,
    note_title: str,
    note_content: str,
    note_id: Optional[int] = None
):
    """Hook for note creation/editing"""
    try:
        tracker = get_progress_tracker(db)
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="note",
            content=note_content,
            title=note_title,
            metadata={"note_id": note_id}
        )
        
        logger.info(f"Tracked note activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking note activity: {e}")
        return None


async def track_flashcard_activity(
    db: Session,
    user_id: int,
    flashcard_set_name: str,
    flashcards: list,
    study_session: bool = False
):
    """Hook for flashcard creation/study"""
    try:
        tracker = get_progress_tracker(db)
        
        # Combine flashcard content
        content = f"Flashcard Set: {flashcard_set_name}\n\n"
        for card in flashcards[:20]:  # Limit to first 20 cards
            content += f"Q: {card.get('front', '')}\nA: {card.get('back', '')}\n\n"
        
        activity_type = "flashcard" if not study_session else "practice"
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type=activity_type,
            content=content,
            title=flashcard_set_name,
            metadata={
                "flashcard_count": len(flashcards),
                "study_session": study_session
            }
        )
        
        logger.info(f"Tracked flashcard activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking flashcard activity: {e}")
        return None


async def track_quiz_activity(
    db: Session,
    user_id: int,
    quiz_title: str,
    questions: list,
    score: Optional[float] = None
):
    """Hook for quiz completion"""
    try:
        tracker = get_progress_tracker(db)
        
        # Combine quiz content
        content = f"Quiz: {quiz_title}\n\n"
        for q in questions[:15]:  # Limit to first 15 questions
            content += f"Q: {q.get('question', '')}\n"
            if q.get('answer'):
                content += f"A: {q.get('answer', '')}\n"
            content += "\n"
        
        # Quality score based on quiz performance
        quality_score = 0.8
        if score is not None:
            quality_score = max(0.5, min(1.0, score / 100))
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="quiz",
            content=content,
            title=quiz_title,
            metadata={
                "question_count": len(questions),
                "score": score,
                "quality_score": quality_score
            }
        )
        
        logger.info(f"Tracked quiz activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking quiz activity: {e}")
        return None


async def track_chat_activity(
    db: Session,
    user_id: int,
    chat_messages: list,
    topic: Optional[str] = None
):
    """Hook for AI chat sessions"""
    print(f"\n{'='*80}")
    print(f"🔍 TRACK_CHAT_ACTIVITY CALLED")
    print(f"{'='*80}")
    print(f"📊 Parameters:")
    print(f"   - user_id: {user_id}")
    print(f"   - topic: {topic}")
    print(f"   - message_count: {len(chat_messages)}")
    print(f"   - db session: {db}")
    
    try:
        print(f"\n🤖 Getting progress tracker instance...")
        tracker = get_progress_tracker(db)
        print(f"✅ Progress tracker obtained: {tracker}")
        print(f"   - AI client available: {tracker.ai_client is not None}")
        
        # Combine recent chat messages
        content = ""
        if topic:
            content = f"Topic: {topic}\n\n"
        
        # Get last 10 messages
        print(f"\n📝 Building content from messages...")
        for msg in chat_messages[-10:]:
            role = msg.get('role', 'user')
            text = msg.get('content', '')
            content += f"{role.upper()}: {text}\n\n"
        
        print(f"✅ Content built: {len(content)} characters")
        print(f"📄 Content preview: {content[:200]}...")
        
        print(f"\n🚀 Calling tracker.track_activity...")
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="chat",
            content=content,
            title=topic or "AI Chat Session",
            metadata={
                "message_count": len(chat_messages)
            }
        )
        
        print(f"\n✅ TRACK_ACTIVITY COMPLETED")
        print(f"📊 Result: {result}")
        print(f"   - Success: {result.get('success')}")
        print(f"   - Matched nodes: {result.get('matched_nodes', 0)}")
        print(f"   - Updated nodes: {result.get('updated_nodes', 0)}")
        print(f"   - Message: {result.get('message', '')}")
        
        if result.get('updates'):
            print(f"\n📈 Node Updates:")
            for update in result.get('updates', []):
                print(f"   - {update.get('node_title')} ({update.get('path_title')})")
                print(f"     Progress: +{update.get('progress_delta')}% → {update.get('new_progress')}%")
                print(f"     Status: {update.get('status')}")
        
        print(f"{'='*80}\n")
        
        logger.info(f"Tracked chat activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        print(f"\n❌ ERROR IN TRACK_CHAT_ACTIVITY")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        print(f"Full traceback:")
        traceback.print_exc()
        print(f"{'='*80}\n")
        logger.error(f"Error tracking chat activity: {e}")
        return None


async def track_slide_activity(
    db: Session,
    user_id: int,
    slide_title: str,
    slide_content: str,
    slide_analysis: Optional[Dict] = None
):
    """Hook for slide uploads and analysis"""
    try:
        tracker = get_progress_tracker(db)
        
        content = f"Slides: {slide_title}\n\n{slide_content}"
        
        if slide_analysis:
            content += f"\n\nKey Topics: {', '.join(slide_analysis.get('topics', []))}"
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="slide",
            content=content,
            title=slide_title,
            metadata=slide_analysis
        )
        
        logger.info(f"Tracked slide activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking slide activity: {e}")
        return None


async def track_media_activity(
    db: Session,
    user_id: int,
    media_title: str,
    transcript: str,
    media_type: str = "video"
):
    """Hook for video/audio transcripts"""
    try:
        tracker = get_progress_tracker(db)
        
        # Truncate very long transcripts
        content = transcript[:5000] if len(transcript) > 5000 else transcript
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="note",  # Treat as note content
            content=content,
            title=f"{media_type.title()}: {media_title}",
            metadata={
                "media_type": media_type,
                "transcript_length": len(transcript)
            }
        )
        
        logger.info(f"Tracked media activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking media activity: {e}")
        return None


async def track_practice_activity(
    db: Session,
    user_id: int,
    practice_title: str,
    practice_content: str,
    performance_score: Optional[float] = None
):
    """Hook for practice sessions and exercises"""
    try:
        tracker = get_progress_tracker(db)
        
        quality_score = 0.9  # Practice is high-value
        if performance_score is not None:
            quality_score = max(0.6, min(1.0, performance_score / 100))
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type="practice",
            content=practice_content,
            title=practice_title,
            metadata={
                "performance_score": performance_score,
                "quality_score": quality_score
            }
        )
        
        logger.info(f"Tracked practice activity: {result.get('updated_nodes', 0)} nodes updated")
        return result
    except Exception as e:
        logger.error(f"Error tracking practice activity: {e}")
        return None


# Convenience function to track any activity
async def track_learning_activity(
    db: Session,
    user_id: int,
    activity_type: str,
    content: str,
    title: str = "",
    metadata: Dict = None
):
    """
    Generic function to track any learning activity
    
    Activity types:
    - note: Note creation/editing
    - flashcard: Flashcard creation/study
    - quiz: Quiz completion
    - chat: AI chat session
    - slide: Slide upload/analysis
    - practice: Practice exercises
    - project: Hands-on projects
    """
    try:
        tracker = get_progress_tracker(db)
        
        result = await tracker.track_activity(
            user_id=user_id,
            activity_type=activity_type,
            content=content,
            title=title,
            metadata=metadata
        )
        
        return result
    except Exception as e:
        logger.error(f"Error tracking learning activity: {e}")
        return None
