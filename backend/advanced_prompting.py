from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
import json
import re


def extract_topic_keywords(text: str, max_keywords: int = 5) -> List[str]:
    stop_words = {
        'what', 'when', 'where', 'which', 'who', 'how', 'does', 'can', 'will', 
        'should', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'explain', 'tell', 'help',
        'understand', 'know', 'about', 'this', 'that', 'with', 'from', 'for'
    }
    
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    keywords = [w for w in words if w not in stop_words]
    
    return keywords[:max_keywords]


def get_relevant_past_conversations(db: Session, user_id: int, current_topic: str, limit: int = 3) -> List[Dict]:
    try:
        import models
        
        recent_sessions = db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user_id
        ).order_by(models.ChatSession.updated_at.desc()).limit(15).all()
        
        relevant_conversations = []
        
        for session in recent_sessions:
            messages = db.query(models.ChatMessage).filter(
                models.ChatMessage.chat_session_id == session.id
            ).order_by(models.ChatMessage.timestamp.asc()).limit(3).all()
            
            if messages:
                session_content = " ".join([
                    f"{m.user_message} {m.ai_response}" for m in messages
                ])
                
                topic_keywords = current_topic.lower().split()
                relevance_score = sum(
                    1 for keyword in topic_keywords 
                    if len(keyword) > 3 and keyword in session_content.lower()
                )
                
                if relevance_score > 0:
                    relevant_conversations.append({
                        'session_id': session.id,
                        'title': session.title,
                        'relevance_score': relevance_score,
                        'last_updated': session.updated_at,
                        'preview': session_content[:150]
                    })
        
        relevant_conversations.sort(
            key=lambda x: (x['relevance_score'], x['last_updated']), 
            reverse=True
        )
        
        return relevant_conversations[:limit]
        
    except Exception as e:
        print(f"Error getting relevant conversations: {e}")
        return []


def get_user_learning_context(db: Session, user_id: int) -> Dict[str, Any]:
    try:
        import models
        
        recent_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(20).all()
        
        topics_studied = {}
        for activity in recent_activities:
            topic = activity.topic or "General"
            topics_studied[topic] = topics_studied.get(topic, 0) + 1
        
        daily_metrics = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id
        ).order_by(models.DailyLearningMetrics.date.desc()).limit(7).all()
        
        avg_questions_per_day = (
            sum(m.questions_answered for m in daily_metrics) / len(daily_metrics)
            if daily_metrics else 0
        )
        
        avg_accuracy = (
            sum(m.correct_answers / max(m.questions_answered, 1) for m in daily_metrics) 
            / len(daily_metrics) * 100
            if daily_metrics else 0
        )
        
        comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
            models.ComprehensiveUserProfile.user_id == user_id
        ).first()
        
        weak_areas = []
        strong_areas = []
        
        if comprehensive_profile:
            try:
                weak_areas = json.loads(comprehensive_profile.weak_areas or "[]")
                strong_areas = json.loads(comprehensive_profile.strong_areas or "[]")
            except:
                pass
        
        return {
            'topics_studied': topics_studied,
            'most_frequent_topics': sorted(topics_studied.items(), key=lambda x: x[1], reverse=True)[:3],
            'avg_questions_per_day': round(avg_questions_per_day, 1),
            'avg_accuracy': round(avg_accuracy, 1),
            'weak_areas': weak_areas,
            'strong_areas': strong_areas,
            'total_learning_days': len(daily_metrics)
        }
        
    except Exception as e:
        print(f"Error building learning context: {e}")
        return {}


def analyze_weak_topics(db: Session, user_id: int) -> List[Dict[str, Any]]:
    try:
        import models
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id,
            models.Activity.timestamp >= thirty_days_ago
        ).all()
        
        topic_performance = {}
        
        for activity in activities:
            topic = activity.topic or "General"
            if topic not in topic_performance:
                topic_performance[topic] = {
                    'topic': topic,
                    'questions': 0,
                    'recent_attempts': []
                }
            
            topic_performance[topic]['questions'] += 1
            topic_performance[topic]['recent_attempts'].append(activity.timestamp)
        
        weak_topics = []
        for topic, data in topic_performance.items():
            if data['questions'] >= 3:
                days_since_last = (datetime.utcnow() - max(data['recent_attempts'])).days
                if days_since_last >= 7:
                    weak_topics.append({
                        'topic': topic,
                        'days_since_review': days_since_last,
                        'total_questions': data['questions']
                    })
        
        weak_topics.sort(key=lambda x: x['days_since_review'], reverse=True)
        return weak_topics[:3]
    
    except Exception as e:
        print(f"Error analyzing weak topics: {e}")
        return []


def get_archetype_teaching_style(primary_archetype: str, secondary_archetype: str = None) -> str:
    archetype_styles = {
        "Logicor": "Use logical step-by-step breakdowns, systematic approaches, and clear cause-effect relationships.",
        "Flowist": "Keep explanations dynamic and interactive. Encourage hands-on exploration and learning by doing.",
        "Kinetiq": "Include practical examples they can physically try. Use action-oriented language and tangible demonstrations.",
        "Synth": "Connect concepts across different domains. Show relationships between ideas and highlight patterns.",
        "Dreamweaver": "Start with the big picture. Use visual metaphors and imaginative scenarios.",
        "Anchor": "Provide clear structure and organization. Use step-by-step progressions with defined goals.",
        "Spark": "Use creative analogies and unexpected connections. Encourage innovative thinking.",
        "Empathion": "Relate concepts to human experiences and emotions. Use storytelling and discuss personal meaning.",
        "Seeker": "Present intriguing questions and mysteries. Share fascinating insights and encourage exploration.",
        "Resonant": "Be highly flexible and adaptive. Offer multiple explanation styles and adjust dynamically."
    }
    
    primary_style = archetype_styles.get(primary_archetype, "")
    if secondary_archetype and secondary_archetype != primary_archetype:
        secondary_style = archetype_styles.get(secondary_archetype, "")
        return f"{primary_style} Also: {secondary_style}"
    
    return primary_style


def build_user_profile_dict(user, comprehensive_profile=None) -> Dict[str, Any]:
    profile = {
        "user_id": getattr(user, "id", "unknown"),
        "first_name": getattr(user, "first_name", "Student"),
        "last_name": getattr(user, "last_name", ""),
        "field_of_study": getattr(user, "field_of_study", "General Studies"),
        "learning_style": getattr(user, "learning_style", "Mixed"),
        "school_university": getattr(user, "school_university", "Student"),
        "age": getattr(user, "age", None),
        "preferred_subjects": [],
        "brainwave_goal": ""
    }
    
    if comprehensive_profile:
        profile.update({
            "difficulty_level": getattr(comprehensive_profile, "difficulty_level", "intermediate"),
            "learning_pace": getattr(comprehensive_profile, "learning_pace", "moderate"),
            "study_environment": getattr(comprehensive_profile, "study_environment", "quiet"),
            "preferred_language": getattr(comprehensive_profile, "preferred_language", "english"),
            "study_goals": getattr(comprehensive_profile, "study_goals", None),
            "career_goals": getattr(comprehensive_profile, "career_goals", None),
            "primary_archetype": getattr(comprehensive_profile, "primary_archetype", ""),
            "secondary_archetype": getattr(comprehensive_profile, "secondary_archetype", ""),
            "archetype_description": getattr(comprehensive_profile, "archetype_description", ""),
            "brainwave_goal": getattr(comprehensive_profile, "brainwave_goal", "")
        })
        
        try:
            if comprehensive_profile.preferred_subjects:
                profile["preferred_subjects"] = json.loads(comprehensive_profile.preferred_subjects)
        except:
            profile["preferred_subjects"] = []
    
    return profile


def build_intelligent_system_prompt(
    user_profile: Dict[str, Any],
    learning_context: Dict[str, Any],
    conversation_history: List[Dict],
    relevant_past_chats: List[Dict],
    weak_topics: List[Dict],
    is_first_message: bool
) -> str:
    first_name = user_profile.get('first_name', 'there')
    field_of_study = user_profile.get('field_of_study', 'your studies')
    difficulty_level = user_profile.get('difficulty_level', 'intermediate')
    primary_archetype = user_profile.get('primary_archetype', '')
    secondary_archetype = user_profile.get('secondary_archetype', '')
    brainwave_goal = user_profile.get('brainwave_goal', '')
    preferred_subjects = user_profile.get('preferred_subjects', [])
    
    if is_first_message:
        base_prompt = f"""You are an expert AI tutor. Welcome {first_name} warmly and let them know you're here to help them with {field_of_study}.

Keep your greeting natural and brief - don't list all your capabilities."""
    else:
        base_prompt = f"""You are an expert AI tutor helping {first_name} with {field_of_study}.

Be natural and conversational. Reference previous discussions when relevant, but don't repeat yourself."""
    
    if primary_archetype:
        base_prompt += f"""

STUDENT'S LEARNING ARCHETYPE: {primary_archetype}"""
        if secondary_archetype:
            base_prompt += f""" (Secondary: {secondary_archetype})"""
        
        teaching_style = get_archetype_teaching_style(primary_archetype, secondary_archetype)
        if teaching_style:
            base_prompt += f"""
{teaching_style}"""
    
    if brainwave_goal:
        goal_guidance = {
            'exam_prep': "Focus on test-taking strategies, key concepts review, and practice problems.",
            'homework_help': "Provide step-by-step guidance while encouraging independent thinking.",
            'concept_mastery': "Deep dive into fundamentals with thorough explanations and connections.",
            'skill_building': "Emphasize practical application and progressive skill development.",
            'career_prep': "Connect concepts to real-world professional applications.",
            'curiosity': "Encourage exploration and provide fascinating insights beyond basics."
        }
        if brainwave_goal in goal_guidance:
            base_prompt += f"""

STUDENT'S GOAL: {goal_guidance[brainwave_goal]}"""
    
    if preferred_subjects:
        subjects_str = ", ".join(preferred_subjects[:5])
        base_prompt += f"""

STUDENT'S INTERESTS: {subjects_str}
Connect topics to these interests when naturally relevant."""
    
    base_prompt += f"""

STUDENT LEVEL: {difficulty_level.title()}
Adjust your explanations accordingly."""
    
    if learning_context and learning_context.get('most_frequent_topics'):
        topics = ', '.join([t[0] for t in learning_context['most_frequent_topics']])
        base_prompt += f"""

RECENT FOCUS AREAS: {topics}"""
    
    if weak_topics and not is_first_message:
        topics_list = ', '.join([t['topic'] for t in weak_topics[:2]])
        base_prompt += f"""

REVIEW OPPORTUNITIES: {topics_list} haven't been reviewed recently.
If naturally relevant, suggest a quick review."""
    
    if conversation_history and not is_first_message:
        recent_context = ""
        for msg in conversation_history[-3:]:
            recent_context += f"Student: {msg['user_message'][:100]}\n"
            recent_context += f"You: {msg['ai_response'][:100]}...\n\n"
        
        base_prompt += f"""

RECENT CONVERSATION:
{recent_context.strip()}
Continue naturally from this context."""
    
    if relevant_past_chats and not is_first_message:
        base_prompt += f"""

RELATED PAST DISCUSSIONS:
{len(relevant_past_chats)} previous conversation(s) touched on similar topics.
Reference if relevant: "{relevant_past_chats[0]['title']}" """
    
    base_prompt += """

RESPONSE GUIDELINES:
- Be clear, helpful, and thorough
- Use concrete examples to illustrate concepts
- Break down complex topics step-by-step when needed
- Ask clarifying questions if the question is ambiguous
- Vary your response style - be natural, not formulaic
- Only suggest next steps or ask follow-up questions when it genuinely helps
- Keep your tone warm but professional"""
    
    return base_prompt

def get_quiz_based_teaching_adaptations(quiz_responses: Dict[str, str]) -> str:
    adaptations = []
    
    if quiz_responses.get('learningEnvironment') == 'structured':
        adaptations.append("Provide clear, organized frameworks and step-by-step guidance")
    elif quiz_responses.get('learningEnvironment') == 'flexible':
        adaptations.append("Offer flexible explanations with multiple pathways to understanding")
    elif quiz_responses.get('learningEnvironment') == 'collaborative':
        adaptations.append("Include discussion prompts and collaborative learning suggestions")
    elif quiz_responses.get('learningEnvironment') == 'independent':
        adaptations.append("Encourage self-discovery with guiding questions")
    
    if quiz_responses.get('problemSolving') == 'break_down':
        adaptations.append("Break complex problems into logical, sequential steps")
    elif quiz_responses.get('problemSolving') == 'visualize':
        adaptations.append("Start with big-picture overview before diving into details")
    elif quiz_responses.get('problemSolving') == 'experiment':
        adaptations.append("Suggest hands-on experiments and trial-and-error approaches")
    elif quiz_responses.get('problemSolving') == 'discuss':
        adaptations.append("Frame concepts as discussion points and thought experiments")
    
    if quiz_responses.get('newConcepts') == 'reading':
        adaptations.append("Provide thorough written explanations with detailed context")
    elif quiz_responses.get('newConcepts') == 'visual':
        adaptations.append("Use analogies and describe visual representations")
    elif quiz_responses.get('newConcepts') == 'hands_on':
        adaptations.append("Suggest practical exercises and real-world applications")
    elif quiz_responses.get('newConcepts') == 'discussion':
        adaptations.append("Present ideas through dialogue and questioning")
    
    if quiz_responses.get('informationProcessing') == 'logic':
        adaptations.append("Use logical reasoning and cause-effect relationships")
    elif quiz_responses.get('informationProcessing') == 'patterns':
        adaptations.append("Highlight patterns, connections, and recurring themes")
    elif quiz_responses.get('informationProcessing') == 'emotion':
        adaptations.append("Connect concepts to human experiences and real-life meaning")
    elif quiz_responses.get('informationProcessing') == 'action':
        adaptations.append("Emphasize physical demonstrations and kinesthetic learning")
    
    if quiz_responses.get('feedback') == 'detailed':
        adaptations.append("Provide detailed analytical feedback with specific examples")
    elif quiz_responses.get('feedback') == 'encouraging':
        adaptations.append("Use positive, encouraging language that builds confidence")
    elif quiz_responses.get('feedback') == 'constructive':
        adaptations.append("Focus on actionable improvements and next steps")
    elif quiz_responses.get('feedback') == 'direct':
        adaptations.append("Be direct and concise in corrections and suggestions")
    
    return " ".join(adaptations) if adaptations else ""


def should_suggest_weak_topic_review(message_count: int, weak_topics: List[Dict]) -> Optional[str]:
    if not weak_topics or message_count < 1:
        return None
    
    if message_count % 8 == 0:
        topic = weak_topics[0]
        return f"\n\n💡 By the way, it's been {topic['days_since_review']} days since we discussed {topic['topic']}. Would you like a quick refresher?"
    
    return None


async def generate_enhanced_ai_response(
    question: str,
    user_profile: Dict[str, Any],
    learning_context: Dict[str, Any],
    conversation_history: List[Dict],
    relevant_past_chats: List[Dict],
    db: Session,
    groq_client: Any,
    model: str
) -> str:
    try:
        user_id = user_profile.get('user_id')
        is_first_message = len(conversation_history) == 0
        
        weak_topics = analyze_weak_topics(db, user_id) if user_id else []
        
        system_prompt = build_intelligent_system_prompt(
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats,
            weak_topics,
            is_first_message
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in conversation_history[-5:]:
            messages.append({"role": "user", "content": msg['user_message']})
            messages.append({"role": "assistant", "content": msg['ai_response']})
        
        messages.append({"role": "user", "content": question})
        
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7,
            max_tokens=3072,
            top_p=0.9,
        )
        
        response = chat_completion.choices[0].message.content
        
        message_count = len(conversation_history) + 1
        review_suggestion = should_suggest_weak_topic_review(message_count, weak_topics)
        
        if review_suggestion and not is_first_message:
            response += review_suggestion
        
        return response
        
    except Exception as e:
        print(f"Error generating response: {e}")
        return "I apologize, but I encountered an error. Could you please rephrase your question?"


def get_topic_from_question(question: str) -> str:
    question_lower = question.lower()
    
    common_topics = {
        'Mathematics': ['calculus', 'algebra', 'geometry', 'trigonometry', 'statistics', 'math'],
        'Physics': ['physics', 'mechanics', 'thermodynamics', 'quantum', 'relativity', 'force', 'energy'],
        'Chemistry': ['chemistry', 'organic', 'chemical', 'reaction', 'molecule', 'atom'],
        'Biology': ['biology', 'cell', 'dna', 'genetics', 'organism', 'evolution'],
        'Computer Science': ['programming', 'algorithm', 'code', 'computer', 'software', 'python', 'java', 'javascript'],
        'History': ['history', 'historical', 'war', 'ancient', 'medieval', 'revolution'],
        'Literature': ['literature', 'novel', 'poetry', 'shakespeare', 'author', 'book'],
        'Economics': ['economics', 'market', 'supply', 'demand', 'trade', 'economy'],
        'Psychology': ['psychology', 'behavior', 'cognitive', 'mental', 'brain'],
        'Engineering': ['engineering', 'design', 'build', 'circuit', 'mechanical'],
        'Business': ['business', 'management', 'marketing', 'finance', 'entrepreneurship']
    }
    
    for topic, keywords in common_topics.items():
        if any(keyword in question_lower for keyword in keywords):
            return topic
    
    words = extract_topic_keywords(question, max_keywords=1)
    
    if words:
        return words[0].title()
    
    return "General"