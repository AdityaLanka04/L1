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
        db.rollback()
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
        
        try:
            comprehensive_profile = db.query(models.ComprehensiveUserProfile).filter(
                models.ComprehensiveUserProfile.user_id == user_id
            ).first()
        except Exception as profile_error:
            print(f"Could not load comprehensive profile: {profile_error}")
            db.rollback()
            comprehensive_profile = None
        
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
        db.rollback()
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
            'Logicor': """🧠 LOGICOR TEACHING APPROACH - They excel at logical analysis and systematic thinking:
- Break every concept into numbered, sequential steps (1→2→3→4)
- Always show clear cause-and-effect relationships with "if-then" logic
- Use structured frameworks like flowcharts, decision trees, and systematic methodologies
- Provide logical proofs and mathematical reasoning when applicable
- Example: "Let's solve this step-by-step: First, we identify the variables (x, y). Then, we apply the formula (F=ma). Next, we substitute values (F=10N, m=2kg). Finally, we solve for acceleration (a=5m/s²)."
- Give them organized information with clear hierarchies and logical progressions""",
            
            'Flowist': """🌊 FLOWIST TEACHING APPROACH - They thrive on dynamic, hands-on experiences:
- Make everything interactive with "try this now" exercises and immediate practice
- Use real-world scenarios they can physically engage with or simulate
- Provide multiple practical examples they can experiment with right away
- Encourage learning by doing with step-by-step activities
- Example: "Instead of just explaining photosynthesis, let's do this: Get a plant, cover one leaf with foil, put it in sunlight for a day, then test both leaves for starch. You'll see the difference!"
- Be flexible and adapt explanations based on their responses and engagement level""",
            
            'Kinetiq': """💪 KINETIQ TEACHING APPROACH - They learn through movement and physical engagement:
- Always suggest hands-on experiments, physical demonstrations, and tangible activities
- Use action-oriented language with verbs like "build," "create," "manipulate," "construct"
- Connect abstract concepts to physical experiences and bodily sensations
- Provide detailed instructions for physical activities and experiments
- Example: "To understand momentum, don't just read about it - roll different balls down a ramp, feel their weight, measure their speed, and physically experience how mass and velocity combine!"
- Include tactile learning opportunities and kinesthetic memory techniques""",
            
            'Synth': """🔗 SYNTH TEACHING APPROACH - They see patterns and connections naturally:
- Always show how new concepts connect to multiple other domains and fields
- Highlight patterns, relationships, and underlying principles that appear across subjects
- Use cross-disciplinary analogies and examples from different fields
- Build comprehensive mental maps showing interconnections
- Example: "DNA replication is like a factory assembly line (engineering), follows mathematical patterns (Fibonacci in nature), uses chemical bonds (chemistry), and mirrors computer data copying (technology)."
- Help them see the unified principles underlying seemingly different topics""",
            
            'Dreamweaver': """🌟 DREAMWEAVER TEACHING APPROACH - They think in big pictures and possibilities:
- Always start with the grand vision, overall purpose, and ultimate applications
- Use vivid visual metaphors, imaginative scenarios, and creative storytelling
- Paint compelling pictures of future possibilities and real-world impact
- Connect learning to their dreams, aspirations, and creative goals
- Example: "Imagine you're designing a city on Mars - you'd need to understand atmospheric pressure (physics), sustainable ecosystems (biology), resource management (economics), and human psychology (social science)."
- Encourage creative thinking about innovative applications and breakthrough possibilities""",
            
            'Anchor': """⚓ ANCHOR TEACHING APPROACH - They value structure and clear organization:
- Provide detailed roadmaps with clear milestones, checkpoints, and defined goals
- Use systematic frameworks with numbered steps, organized hierarchies, and structured progressions
- Give them predictable patterns and reliable methodologies they can depend on
- Create clear learning objectives and measurable outcomes for each topic
- Example: "Here's your complete learning path: Week 1: Master basic concepts (A, B, C). Week 2: Apply to simple problems (Examples 1-5). Week 3: Tackle complex scenarios (Projects X, Y, Z). Week 4: Synthesize everything (Final assessment)."
- Establish solid foundations before building to more advanced concepts""",
            
            'Spark': """⚡ SPARK TEACHING APPROACH - They're driven by creativity and innovation:
- Use unexpected analogies, creative connections, and novel approaches to familiar topics
- Present information in surprising ways that challenge conventional thinking
- Encourage innovative problem-solving and out-of-the-box applications
- Share cutting-edge developments, breakthrough discoveries, and revolutionary ideas
- Example: "What if we explained gravity using dance? Imagine spacetime as a stretchy dance floor - massive objects create dips that other dancers (planets) naturally spiral into!"
- Make learning exciting with fresh perspectives and creative challenges""",
            
            'Empathion': """❤️ EMPATHION TEACHING APPROACH - They connect through meaning and emotion:
- Always relate concepts to human experiences, personal stories, and emotional connections
- Use narrative storytelling with characters, conflicts, and meaningful resolutions
- Discuss the personal impact, social significance, and human meaning behind concepts
- Connect learning to their values, relationships, and life experiences
- Example: "Statistics isn't just numbers - it's about understanding people. When we calculate averages, we're learning about human experiences, hopes, and challenges. Each data point represents someone's story."
- Show the emotional and human side of every subject, making it personally meaningful""",
            
            'Seeker': """🔍 SEEKER TEACHING APPROACH - They're motivated by curiosity and discovery:
- Present intriguing mysteries, fascinating questions, and mind-bending puzzles
- Share surprising facts, counterintuitive discoveries, and "did you know?" moments
- Encourage exploration with open-ended questions and investigative challenges
- Reveal the detective work behind scientific discoveries and breakthrough moments
- Example: "Here's a mystery: Why do ice cubes float? It seems simple, but this one property of water makes life on Earth possible! Let's investigate the molecular detective story..."
- Make them curious to learn more with cliffhangers and fascinating revelations""",
            
            'Resonant': """🎵 RESONANT TEACHING APPROACH - They're highly adaptable and flexible:
- Dynamically adjust your teaching style based on their responses and engagement
- Offer multiple explanation approaches and let them choose what resonates
- Be highly responsive to their learning pace, interests, and feedback
- Seamlessly blend different teaching methods within the same explanation
- Example: "I can explain this concept logically (step-by-step), visually (with analogies), practically (with experiments), or creatively (through stories). Which approach feels right to you today?"
- Read their reactions and adapt in real-time to optimize their learning experience"""
        }
        
        if primary_archetype in archetype_teaching:
            base_prompt += f"\n\n{archetype_teaching[primary_archetype]}"
    
    if brainwave_goal:
        goal_context = {
            'exam_prep': """🎯 EXAM PREPARATION MODE:
- Focus on high-yield concepts most likely to appear on tests
- Provide memory techniques, mnemonics, and recall strategies
- Include practice problems with detailed step-by-step solutions
- Highlight common exam mistakes and how to avoid them
- Give time management tips and test-taking strategies
- Create summary frameworks and quick reference guides""",
            
            'homework_help': """📚 HOMEWORK ASSISTANCE MODE:
- Guide them through problems step-by-step without giving direct answers
- Ask leading questions that help them discover solutions independently
- Explain the reasoning behind each step so they understand the process
- Provide similar practice examples to reinforce learning
- Help them check their work and identify potential errors
- Encourage independent thinking while providing supportive guidance""",
            
            'concept_mastery': """🧠 DEEP MASTERY MODE:
- Provide comprehensive, thorough explanations that build complete understanding
- Show multiple perspectives and approaches to the same concept
- Connect to underlying principles and fundamental theories
- Include historical context and development of ideas
- Explore edge cases, exceptions, and advanced applications
- Build robust mental models that will last long-term""",
            
            'skill_building': """🛠️ SKILL DEVELOPMENT MODE:
- Emphasize practical application and hands-on practice opportunities
- Provide progressive exercises that build complexity gradually
- Focus on developing fluency and automaticity through repetition
- Include real-world scenarios where these skills are essential
- Give feedback on technique and suggest improvements
- Create practice schedules and skill-building roadmaps""",
            
            'career_prep': """💼 CAREER PREPARATION MODE:
- Connect every concept to real-world professional applications
- Share industry examples, case studies, and workplace scenarios
- Discuss how professionals actually use these concepts in their jobs
- Include current industry trends and future developments
- Provide networking tips and career advancement strategies
- Highlight transferable skills and professional competencies""",
            
            'curiosity': """🌟 CURIOSITY-DRIVEN MODE:
- Make everything fascinating with surprising facts and mind-blowing connections
- Go beyond basic requirements to explore advanced and cutting-edge topics
- Share the most interesting applications and breakthrough discoveries
- Encourage exploration of related fields and interdisciplinary connections
- Present unsolved mysteries and current research frontiers
- Fuel their passion for learning with engaging stories and amazing insights"""
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

CORE TEACHING PRINCIPLES:
🎯 ALWAYS EXPLAIN IN DETAIL: Never give brief or surface-level answers. Dive deep into concepts, explain the 'why' behind everything, and provide comprehensive understanding.

📚 ALWAYS PROVIDE EXAMPLES: For every concept you explain, give at least 2-3 concrete, practical examples. Use real-world scenarios, step-by-step demonstrations, and relatable analogies.

🔗 CONNECT CONCEPTS: Show how new information relates to what they already know. Build bridges between ideas and highlight patterns across different topics.

💡 ENCOURAGE CURIOSITY: Ask thought-provoking questions, present interesting facts, and inspire them to explore further. Make learning exciting and engaging.

🎨 USE MULTIPLE EXPLANATION STYLES: 
- Visual descriptions and analogies
- Step-by-step breakdowns
- Real-world applications
- Historical context when relevant
- Mathematical or logical proofs when appropriate

📝 STRUCTURE YOUR RESPONSES:
- Start with a clear, engaging opening that addresses their question directly
- Provide detailed explanations with multiple examples
- Include practical applications or exercises they can try
- End with follow-up questions or suggestions for further exploration

🌟 QUALITY STANDARDS:
- Every response should be comprehensive enough to truly help them understand
- Include specific details, not just general statements
- Use concrete numbers, dates, names, and facts when relevant
- Provide actionable advice they can immediately apply
- Anticipate follow-up questions and address them proactively

💬 COMMUNICATION STYLE:
- Be natural and conversational like a knowledgeable friend
- Use their name occasionally but not excessively
- Vary your response structure to keep things interesting
- Be encouraging and supportive while maintaining academic rigor
- Don't announce your teaching methods - just naturally implement them
- Reference their past conversations and learning journey when relevant

🚀 MAKE IT MEMORABLE:
- Use storytelling when appropriate
- Create memorable analogies and metaphors
- Highlight surprising or fascinating aspects
- Connect to current events or popular culture when relevant
- Help them see the bigger picture and real-world importance"""

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
    ai_function: Any,  # Now accepts the unified call_ai function
    model: str
) -> str:
    print(f"\n🔥 GENERATE_ENHANCED_AI_RESPONSE CALLED - FIXED VERSION 🔥")
    print(f"🔥 Question: {question[:50]}...")
    try:
        user_id = user_profile.get('user_id')
        is_first_message = len(conversation_history) == 0
        
        personality_engine = PersonalityEngine()
        adaptive_model = AdaptiveLearningModel()
        
        # Try to load model state, but don't fail if it errors
        try:
            adaptive_model.load_model_state(db, user_id)
        except Exception as load_error:
            print(f"Could not load adaptive model state: {load_error}")
            # Don't rollback here, just continue with defaults
        
        # Try to get RL agent, but don't fail if it errors
        try:
            rl_agent = get_rl_agent(db, user_id)
        except Exception as rl_error:
            print(f"Could not load RL agent: {rl_error}")
            # Create a dummy RL agent with default behavior
            from neural_adaptation import RLAgent
            rl_agent = RLAgent(user_id)
        
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
        
        # Try to analyze weak topics, but don't fail if it errors
        try:
            weak_topics = analyze_weak_topics(db, user_id) if user_id else []
        except Exception as weak_error:
            print(f"Could not analyze weak topics: {weak_error}")
            weak_topics = []
        
        system_prompt = build_intelligent_system_prompt(
            user_profile,
            learning_context,
            conversation_history,
            relevant_past_chats,
            weak_topics,
            is_first_message
        )
        
        if response_adjustments['detail_level'] > 0.7:
            system_prompt += """
🔍 MAXIMUM DETAIL MODE: Provide exceptionally thorough explanations with:
- Complete step-by-step breakdowns of every process
- Detailed background context and foundational concepts
- Multiple layers of explanation (basic → intermediate → advanced)
- Comprehensive coverage of all relevant aspects
- In-depth analysis of implications and applications"""
        elif response_adjustments['detail_level'] < 0.4:
            system_prompt += """
⚡ CONCISE MODE: Keep explanations focused and efficient:
- Get straight to the core concepts without excessive elaboration
- Use clear, direct language and avoid unnecessary complexity
- Provide essential information in digestible chunks
- Focus on the most important points and practical applications"""
        
        if response_adjustments['examples'] > 0.7:
            system_prompt += """
📋 EXAMPLE-RICH MODE: Include abundant practical examples:
- Provide at least 3-4 concrete examples for every major concept
- Use diverse example types (numerical, visual, real-world, analogies)
- Include step-by-step worked examples with detailed explanations
- Show both typical cases and interesting edge cases
- Connect examples to their personal interests and field of study"""
        
        if response_adjustments['encouragement'] > 0.7:
            system_prompt += """
🌟 HIGH ENCOURAGEMENT MODE: Be exceptionally supportive and motivating:
- Celebrate their curiosity and learning efforts enthusiastically
- Highlight their progress and growing understanding
- Use positive, empowering language that builds confidence
- Acknowledge the difficulty of concepts while expressing faith in their abilities
- Provide specific praise for good questions and insights"""
        
        if rl_agent.user_corrections:
            system_prompt += "\n\n🔧 IMPORTANT - Previous corrections:"
            for correction_data in list(rl_agent.user_corrections.values())[-5:]:
                system_prompt += f"\n- Never: {correction_data['mistake']}"
                system_prompt += f"\n  Always: {correction_data['correction']}"
        
        # Final reinforcement for comprehensive responses
        system_prompt += """

🎯 RESPONSE QUALITY CHECKLIST - Every response must include:
✅ Detailed explanation that thoroughly addresses their question
✅ At least 2-3 concrete, practical examples
✅ Step-by-step breakdown when explaining processes
✅ Real-world applications and relevance
✅ Connections to related concepts or their field of study
✅ Engaging, conversational tone that maintains their interest
✅ Follow-up questions or suggestions for further exploration

Remember: Your goal is to provide such comprehensive, helpful responses that they feel truly educated and inspired to learn more. Never give brief or superficial answers - always go deep and make it meaningful."""
        
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
        
        # Build full prompt from messages
        full_prompt = "\n\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])
        
        # Use unified AI function (Gemini primary, Groq fallback)
        response = ai_function(full_prompt, max_tokens=3072, temperature=0.8)
        
        known_mistake = rl_agent.check_for_known_mistakes(response)
        if known_mistake:
            response = known_mistake
        
        action = rl_agent.network.predict(state)
        next_context = context.copy()
        next_context['session_length'] += 1
        next_state = rl_agent.encode_state(next_context)
        
        rl_agent.remember(state, action, 0.0, next_state)
        
        # Try to save conversation memory, but don't fail if it errors
        try:
            save_conversation_memory(db, user_id, question, response, topic_keywords)
        except Exception as save_error:
            print(f"Could not save conversation memory: {save_error}")
            # Continue anyway - the response is already generated
        
        return response
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"\n{'='*80}")
        print(f"❌ ERROR IN generate_enhanced_ai_response")
        print(f"❌ Error: {str(e)}")
        print(f"❌ Type: {type(e).__name__}")
        print(f"❌ Traceback:\n{error_details}")
        print(f"{'='*80}\n")
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