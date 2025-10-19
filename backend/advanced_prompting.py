from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
import json
import re
import models
from ai_personality import PersonalityEngine, AdaptiveLearningModel, build_natural_prompt
from neural_adaptation import get_rl_agent, ConversationContextAnalyzer


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
        print(f"Error building learning context: {str(e)}")
        return {}


def analyze_weak_topics(db: Session, user_id: int) -> List[Dict[str, Any]]:
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
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
                days_since_last = (datetime.now(timezone.utc) - max(data['recent_attempts'])).days
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
        greeting = f"Hey {first_name}!"
    else:
        greeting = ""
    
    base_prompt = f"""{greeting} You're chatting with {first_name}.

CRITICAL CONTEXT YOU MUST REMEMBER:
- Their main subject: {field_of_study}
- Current difficulty level: {difficulty_level}"""

    if preferred_subjects:
        subjects_str = ", ".join(preferred_subjects[:5])
        base_prompt += f"\n- Interested in: {subjects_str}"
    
    if primary_archetype:
        base_prompt += f"\n- Learning archetype: {primary_archetype}"
        if secondary_archetype:
            base_prompt += f" (with {secondary_archetype} traits)"
        
        archetype_teaching = {
            'Logicor': """They're a Logicor - they excel at logical analysis and systematic thinking.
- Break down complex problems into clear, logical steps
- Show cause-effect relationships explicitly
- Use structured frameworks and methodologies
- Present information in a well-organized, sequential manner""",
            
            'Flowist': """They're a Flowist - they thrive on dynamic, hands-on experiences.
- Keep things interactive and practical
- Use real-world examples they can try
- Encourage learning by doing
- Be flexible and adapt to their pace""",
            
            'Kinetiq': """They're a Kinetiq - they learn through movement and physical engagement.
- Suggest hands-on activities and experiments
- Use action-oriented language
- Provide tangible, practical demonstrations
- Connect concepts to physical experiences""",
            
            'Synth': """They're a Synth - they see patterns and connections naturally.
- Show how concepts relate across different domains
- Highlight patterns and relationships
- Connect new information to what they already know
- Use analogies that bridge different fields""",
            
            'Dreamweaver': """They're a Dreamweaver - they think in big pictures and possibilities.
- Start with the overall vision before details
- Use visual metaphors and imaginative scenarios
- Paint the bigger picture first
- Encourage creative thinking about applications""",
            
            'Anchor': """They're an Anchor - they value structure and clear organization.
- Provide step-by-step progressions
- Use clear frameworks and defined goals
- Be methodical and systematic
- Give them a roadmap for learning""",
            
            'Spark': """They're a Spark - they're driven by creativity and innovation.
- Use creative analogies and unexpected connections
- Encourage innovative thinking
- Present novel approaches
- Make learning exciting and fresh""",
            
            'Empathion': """They're an Empathion - they connect through meaning and emotion.
- Relate concepts to human experiences
- Use storytelling when possible
- Discuss the personal meaning and impact
- Show the emotional or human side""",
            
            'Seeker': """They're a Seeker - they're motivated by curiosity and discovery.
- Present intriguing questions
- Share fascinating insights
- Encourage exploration
- Make them curious to learn more""",
            
            'Resonant': """They're Resonant - highly adaptable and flexible.
- Adjust your approach based on their responses
- Offer multiple explanation styles
- Be dynamic in your teaching
- Read their reactions and adapt"""
        }
        
        if primary_archetype in archetype_teaching:
            base_prompt += f"\n\n{archetype_teaching[primary_archetype]}"
    
    if brainwave_goal:
        goal_context = {
            'exam_prep': "They're preparing for exams - focus on test strategies, key concepts, and practice.",
            'homework_help': "They need homework help - guide them step-by-step without just giving answers.",
            'concept_mastery': "They want to master concepts deeply - provide thorough explanations and connections.",
            'skill_building': "They're building skills - emphasize practical application and progressive development.",
            'career_prep': "They're preparing for their career - connect to real-world professional applications.",
            'curiosity': "They're learning for fun - make it fascinating and go beyond basics when they're interested."
        }
        if brainwave_goal in goal_context:
            base_prompt += f"\n{goal_context[brainwave_goal]}"
    
    if learning_context and learning_context.get('most_frequent_topics'):
        topics = [t[0] for t in learning_context['most_frequent_topics']]
        if topics:
            base_prompt += f"\n\nRecent topics they've explored: {', '.join(topics)}"
    
    if conversation_history and not is_first_message:
        recent = conversation_history[-3:]
        if recent:
            base_prompt += f"\n\nCONVERSATION CONTEXT:"
            for msg in recent[-2:]:
                base_prompt += f"\nThem: {msg['user_message'][:80]}..."
                base_prompt += f"\nYou: {msg['ai_response'][:80]}..."
    
    if relevant_past_chats and not is_first_message:
        base_prompt += f"\n\nYou've discussed similar topics before in: \"{relevant_past_chats[0]['title']}\""
    
    base_prompt += f"""

HOW TO RESPOND:
- Be natural and conversational like a real person
- Don't announce what you're doing ("As a Logicor..." or "Based on your archetype...")
- Just naturally teach in the way that works for them
- Reference past conversations when relevant
- If you don't know something they mentioned, ask them about it
- Vary your responses - don't use the same structure every time
- Be warm but not overly formal
- Use their name occasionally but not every message"""

    return base_prompt


def save_conversation_memory(
    db: Session,
    user_id: int,
    question: str,
    answer: str,
    topic_tags: List[str]
):
    try:
        memory = models.ConversationMemory(
            user_id=user_id,
            question=question,
            answer=answer,
            context_summary=f"{question[:100]}...",
            topic_tags=json.dumps(topic_tags[:5]),
            question_type="conversational",
            last_used=datetime.now(timezone.utc),
            usage_count=1
        )
        db.add(memory)
        db.commit()
    except Exception as e:
        print(f"Error saving memory: {e}")
        db.rollback()


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
        
        personality_engine = PersonalityEngine()
        adaptive_model = AdaptiveLearningModel()
        adaptive_model.load_model_state(db, user_id)
        
        rl_agent = get_rl_agent(db, user_id)
        
        context = {
            'message_length': len(question),
            'question_complexity': ConversationContextAnalyzer.calculate_complexity(question),
            'archetype': user_profile.get('primary_archetype', ''),
            'time_of_day': datetime.now(timezone.utc).hour,
            'session_length': len(conversation_history),
            'previous_ratings': [
                msg.get('userRating', 3) for msg in conversation_history[-10:]
                if msg.get('userRating')
            ],
            'topic_keywords': extract_topic_keywords(question),
            'sentiment': ConversationContextAnalyzer.analyze_sentiment(question),
            'formality_level': 0.5
        }
        
        state = rl_agent.encode_state(context)
        response_adjustments = rl_agent.get_response_adjustment()
        
        weak_topics = analyze_weak_topics(db, user_id) if user_id else []
        
        system_prompt = build_intelligent_system_prompt(
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats,
            weak_topics,
            is_first_message
        )
        
        if response_adjustments['detail_level'] > 0.7:
            system_prompt += "\nProvide detailed, thorough explanations."
        elif response_adjustments['detail_level'] < 0.4:
            system_prompt += "\nKeep explanations brief and to the point."
        
        if response_adjustments['examples'] > 0.7:
            system_prompt += "\nInclude multiple practical examples."
        
        if response_adjustments['encouragement'] > 0.7:
            system_prompt += "\nBe especially encouraging and supportive."
        
        if rl_agent.user_corrections:
            system_prompt += "\n\nIMPORTANT - Previous corrections:"
            for correction_data in list(rl_agent.user_corrections.values())[-5:]:
                system_prompt += f"\n- Never: {correction_data['mistake']}"
                system_prompt += f"\n  Always: {correction_data['correction']}"
        
        topic_keywords = extract_topic_keywords(question)
        conversation_memories = personality_engine.get_conversation_memory(
            db, user_id, ' '.join(topic_keywords)
        )
        
        if conversation_memories and not is_first_message:
            memory_context = "\n".join([
                f"You discussed: {m['context']}" for m in conversation_memories[:2]
            ])
            system_prompt += f"\n\n{memory_context}"
        
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in conversation_history[-5:]:
            messages.append({"role": "user", "content": msg['user_message']})
            messages.append({"role": "assistant", "content": msg['ai_response']})
        
        messages.append({"role": "user", "content": question})
        
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.8,
            max_tokens=3072,
            top_p=0.95,
        )
        
        response = chat_completion.choices[0].message.content
        
        known_mistake = rl_agent.check_for_known_mistakes(response)
        if known_mistake:
            response = known_mistake
        
        action = rl_agent.network.predict(state)
        next_context = context.copy()
        next_context['session_length'] += 1
        next_state = rl_agent.encode_state(next_context)
        
        rl_agent.remember(state, action, 0.0, next_state)
        
        save_conversation_memory(db, user_id, question, response, topic_keywords)
        
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