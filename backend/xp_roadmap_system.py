"""
XP Roadmap System with Topic-Based Personalized Milestones
Tracks user's study topics and generates relevant milestones
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta, timezone
import models
from typing import List, Dict, Any

def get_user_study_topics(db: Session, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Analyze user's activity to determine their main study topics
    Returns top topics based on AI chats, notes, flashcards, and quizzes
    """
    topics = {}
    
    # Get topics from AI chat sessions
    chat_sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user_id
    ).all()
    
    for session in chat_sessions:
        if session.title and session.title.strip():
            topic = session.title.strip()
            topics[topic] = topics.get(topic, 0) + 1
    
    # Get topics from notes
    notes = db.query(models.Note).filter(
        models.Note.user_id == user_id
    ).all()
    
    for note in notes:
        if note.title and note.title.strip():
            topic = note.title.strip()
            topics[topic] = topics.get(topic, 0) + 2  # Weight notes higher
    
    # Get topics from flashcard sets
    flashcard_sets = db.query(models.FlashcardSet).filter(
        models.FlashcardSet.user_id == user_id
    ).all()
    
    for fs in flashcard_sets:
        if fs.title and fs.title.strip():
            topic = fs.title.strip()
            topics[topic] = topics.get(topic, 0) + 3  # Weight flashcards even higher
    
    # Get topics from quizzes
    quiz_sessions = db.query(models.QuizSession).filter(
        models.QuizSession.user_id == user_id
    ).all()
    
    for quiz in quiz_sessions:
        if quiz.topic and quiz.topic.strip():
            topic = quiz.topic.strip()
            topics[topic] = topics.get(topic, 0) + 2
    
    # Sort by frequency and return top topics
    sorted_topics = sorted(topics.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    return [
        {
            'topic': topic,
            'activity_count': count,
            'category': categorize_topic(topic)
        }
        for topic, count in sorted_topics
    ]

def categorize_topic(topic: str) -> str:
    """Categorize topic into broad categories"""
    topic_lower = topic.lower()
    
    # Science
    if any(word in topic_lower for word in ['physics', 'chemistry', 'biology', 'science', 'quantum', 'molecular']):
        return 'science'
    
    # Math
    if any(word in topic_lower for word in ['math', 'calculus', 'algebra', 'geometry', 'statistics', 'equation']):
        return 'mathematics'
    
    # Programming
    if any(word in topic_lower for word in ['programming', 'code', 'python', 'javascript', 'java', 'algorithm', 'data structure']):
        return 'programming'
    
    # Language
    if any(word in topic_lower for word in ['language', 'english', 'spanish', 'french', 'grammar', 'vocabulary']):
        return 'language'
    
    # History
    if any(word in topic_lower for word in ['history', 'historical', 'war', 'ancient', 'medieval']):
        return 'history'
    
    # Business
    if any(word in topic_lower for word in ['business', 'economics', 'finance', 'marketing', 'management']):
        return 'business'
    
    # Arts
    if any(word in topic_lower for word in ['art', 'music', 'literature', 'poetry', 'painting']):
        return 'arts'
    
    return 'general'

def get_topic_specific_milestones(db: Session, user_id: int, topic: str) -> List[Dict[str, Any]]:
    """
    Generate topic-specific milestones based on user's activity in that topic
    """
    # Count activities for this topic
    chat_count = db.query(func.count(models.ChatMessage.id)).join(
        models.ChatSession
    ).filter(
        models.ChatSession.user_id == user_id,
        models.ChatSession.title.ilike(f'%{topic}%')
    ).scalar() or 0
    
    note_count = db.query(func.count(models.Note.id)).filter(
        models.Note.user_id == user_id,
        models.Note.title.ilike(f'%{topic}%')
    ).scalar() or 0
    
    flashcard_count = db.query(func.count(models.FlashcardSet.id)).filter(
        models.FlashcardSet.user_id == user_id,
        models.FlashcardSet.title.ilike(f'%{topic}%')
    ).scalar() or 0
    
    quiz_count = db.query(func.count(models.QuizSession.id)).filter(
        models.QuizSession.user_id == user_id,
        models.QuizSession.topic.ilike(f'%{topic}%')
    ).scalar() or 0
    
    # Generate milestones
    milestones = []
    
    # AI Chat milestones
    chat_milestones = [
        {'target': 5, 'title': f'First Steps in {topic}', 'description': 'Ask 5 questions', 'reward': '10 XP Bonus'},
        {'target': 10, 'title': f'{topic} Explorer', 'description': 'Ask 10 questions', 'reward': '20 XP Bonus'},
        {'target': 25, 'title': f'{topic} Enthusiast', 'description': 'Ask 25 questions', 'reward': '50 XP Bonus'},
        {'target': 50, 'title': f'{topic} Scholar', 'description': 'Ask 50 questions', 'reward': '100 XP Bonus'},
        {'target': 100, 'title': f'{topic} Expert', 'description': 'Ask 100 questions', 'reward': '200 XP Bonus'},
    ]
    
    for milestone in chat_milestones:
        milestones.append({
            'id': f'chat_{topic}_{milestone["target"]}',
            'type': 'ai_chat',
            'topic': topic,
            'target': milestone['target'],
            'current': chat_count,
            'title': milestone['title'],
            'description': milestone['description'],
            'reward': milestone['reward'],
            'completed': chat_count >= milestone['target'],
            'progress': min(100, (chat_count / milestone['target']) * 100)
        })
    
    # Note milestones
    note_milestones = [
        {'target': 3, 'title': f'{topic} Note Taker', 'description': 'Create 3 notes', 'reward': '15 XP Bonus'},
        {'target': 5, 'title': f'{topic} Documenter', 'description': 'Create 5 notes', 'reward': '30 XP Bonus'},
        {'target': 10, 'title': f'{topic} Archivist', 'description': 'Create 10 notes', 'reward': '60 XP Bonus'},
        {'target': 20, 'title': f'{topic} Knowledge Keeper', 'description': 'Create 20 notes', 'reward': '120 XP Bonus'},
    ]
    
    for milestone in note_milestones:
        milestones.append({
            'id': f'note_{topic}_{milestone["target"]}',
            'type': 'notes',
            'topic': topic,
            'target': milestone['target'],
            'current': note_count,
            'title': milestone['title'],
            'description': milestone['description'],
            'reward': milestone['reward'],
            'completed': note_count >= milestone['target'],
            'progress': min(100, (note_count / milestone['target']) * 100)
        })
    
    # Flashcard milestones
    flashcard_milestones = [
        {'target': 2, 'title': f'{topic} Flashcard Starter', 'description': 'Create 2 flashcard sets', 'reward': '20 XP Bonus'},
        {'target': 5, 'title': f'{topic} Memory Master', 'description': 'Create 5 flashcard sets', 'reward': '50 XP Bonus'},
        {'target': 10, 'title': f'{topic} Recall Champion', 'description': 'Create 10 flashcard sets', 'reward': '100 XP Bonus'},
    ]
    
    for milestone in flashcard_milestones:
        milestones.append({
            'id': f'flashcard_{topic}_{milestone["target"]}',
            'type': 'flashcards',
            'topic': topic,
            'target': milestone['target'],
            'current': flashcard_count,
            'title': milestone['title'],
            'description': milestone['description'],
            'reward': milestone['reward'],
            'completed': flashcard_count >= milestone['target'],
            'progress': min(100, (flashcard_count / milestone['target']) * 100)
        })
    
    # Quiz milestones
    quiz_milestones = [
        {'target': 3, 'title': f'{topic} Quiz Taker', 'description': 'Complete 3 quizzes', 'reward': '25 XP Bonus'},
        {'target': 5, 'title': f'{topic} Test Master', 'description': 'Complete 5 quizzes', 'reward': '50 XP Bonus'},
        {'target': 10, 'title': f'{topic} Quiz Champion', 'description': 'Complete 10 quizzes', 'reward': '100 XP Bonus'},
    ]
    
    for milestone in quiz_milestones:
        milestones.append({
            'id': f'quiz_{topic}_{milestone["target"]}',
            'type': 'quizzes',
            'topic': topic,
            'target': milestone['target'],
            'current': quiz_count,
            'title': milestone['title'],
            'description': milestone['description'],
            'reward': milestone['reward'],
            'completed': quiz_count >= milestone['target'],
            'progress': min(100, (quiz_count / milestone['target']) * 100)
        })
    
    return milestones

def get_personalized_roadmap(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Get complete personalized roadmap with topics and milestones
    """
    # Get user's study topics
    topics = get_user_study_topics(db, user_id, limit=5)
    
    # Generate milestones for each topic
    topic_milestones = {}
    for topic_data in topics:
        topic = topic_data['topic']
        milestones = get_topic_specific_milestones(db, user_id, topic)
        topic_milestones[topic] = {
            'topic': topic,
            'category': topic_data['category'],
            'activity_count': topic_data['activity_count'],
            'milestones': milestones,
            'completed_count': sum(1 for m in milestones if m['completed']),
            'total_count': len(milestones)
        }
    
    return {
        'topics': topics,
        'topic_milestones': topic_milestones,
        'total_topics': len(topics)
    }
