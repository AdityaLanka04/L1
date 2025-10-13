# Advanced Prompting Strategies for Enhanced Learning Experience

from typing import Dict, List, Any  
import re
from sqlalchemy.orm import Session
"""
Additional prompt enhancement utilities for the Brainwave AI system
"""

def generate_subject_specific_prompts(field_of_study: str, learning_style: str) -> str:
    """
    Generate subject-specific teaching instructions
    """
    
    subject_prompts = {
        "Computer Science": """
- Provide code examples in multiple languages when relevant
- Explain algorithms with step-by-step breakdowns
- Include time/space complexity analysis for algorithms
- Reference real-world applications and use cases
- Suggest projects to reinforce learning
- Draw connections to software engineering practices
""",
        "Mathematics": """
- Show step-by-step problem-solving approaches
- Provide multiple solution methods when applicable
- Include visual representations (describe diagrams)
- Connect abstract concepts to real-world applications
- Offer practice problems with increasing difficulty
- Explain the intuition behind formulas and theorems
""",
        "Science": """
- Use analogies to explain complex phenomena
- Connect theory to experimoental observations
- Explain the scientific method and reasoning
- Provide real-world examples and applications
- Discuss current research and developments
- Encourage hypothesis formation and testing
""",
        "Business": """
- Use case studies and real company examples
- Connect theories to practical business scenarios
- Discuss current market trends and examples
- Provide frameworks and models
- Include ethical considerations
- Suggest actionable insights
""",
        "Humanities": """
- Provide historical and cultural context
- Encourage critical thinking and analysis
- Present multiple perspectives
- Use examples from literature, art, or history
- Connect to contemporary issues
- Foster discussion and interpretation
""",
        "Engineering": """
- Explain underlying physics and principles
- Provide practical design considerations
- Use diagrams and visual explanations
- Include safety and best practices
- Connect to industry standards
- Suggest hands-on projects or simulations
"""
    }
    
    # Default if field not found
    base_prompt = subject_prompts.get(
        field_of_study, 
        subject_prompts.get("Computer Science")  # Default to CS
    )
    
    # Add learning style adaptations
    style_prompts = {
        "Visual": """
VISUAL LEARNER ADAPTATIONS:
- Describe diagrams, charts, and visual representations in detail
- Use spatial metaphors and imagery
- Suggest creating mind maps or flowcharts
- Use color-coding and highlighting suggestions
- Recommend visual resources (videos, infographics)
""",
        "Auditory": """
AUDITORY LEARNER ADAPTATIONS:
- Use clear, structured verbal explanations
- Suggest reading aloud or recording notes
- Use mnemonics and rhymes
- Recommend podcasts or lecture recordings
- Encourage discussion and verbal repetition
""",
        "Kinesthetic": """
KINESTHETIC LEARNER ADAPTATIONS:
- Suggest hands-on activities and experiments
- Include practical exercises and simulations
- Recommend building models or prototypes
- Use real-world manipulation examples
- Encourage learning by doing
""",
        "Reading/Writing": """
READING/WRITING LEARNER ADAPTATIONS:
- Provide detailed written explanations
- Suggest note-taking strategies
- Recommend additional reading materials
- Encourage essay writing or journaling
- Use lists, definitions, and written summaries
"""
    }
    
    style_adaptation = style_prompts.get(learning_style, "")
    
    return f"{base_prompt}\n{style_adaptation}"


def generate_adaptive_follow_up_questions(
    topic: str, 
    difficulty_level: str,
    response_length: int
) -> List[str]:
    """
    Generate intelligent follow-up questions to deepen understanding
    """
    
    questions = []
    
    # Depth-based questions
    if difficulty_level == "beginner":
        questions.extend([
            f"Would you like me to explain any part of {topic} in simpler terms?",
            f"Should we go through some basic examples of {topic}?",
            f"What specific aspect of {topic} would you like to understand better?"
        ])
    elif difficulty_level == "intermediate":
        questions.extend([
            f"Would you like to explore how {topic} connects to other concepts?",
            f"Should we work through a practice problem about {topic}?",
            f"Are you interested in more advanced applications of {topic}?"
        ])
    else:  # advanced
        questions.extend([
            f"Would you like to discuss the theoretical foundations of {topic}?",
            f"Should we examine edge cases or limitations of {topic}?",
            f"Are you interested in current research or debates around {topic}?"
        ])
    
    # Engagement-based questions
    if response_length > 500:  # Long, detailed response
        questions.append(
            "That was a comprehensive explanation. Would you like me to summarize the key points?"
        )
    
    return questions


def detect_learning_opportunity(
    question: str, 
    response: str,
    conversation_history: List[Dict]
) -> Dict[str, Any]:
    """
    Detect opportunities for deeper learning and intervention
    """
    
    opportunities = {
        "misconception_likely": False,
        "concept_building_needed": False,
        "practice_recommended": False,
        "review_suggested": False,
        "suggestions": []
    }
    
    # Check for common misconception patterns
    misconception_indicators = [
        "is it correct that", "i thought", "but isnt", 
        "does that mean", "so basically", "confused about"
    ]
    
    if any(indicator in question.lower() for indicator in misconception_indicators):
        opportunities["misconception_likely"] = True
        opportunities["suggestions"].append(
            "Consider clarifying the fundamental concept before moving forward"
        )
    
    # Check if building on previous knowledge
    if len(conversation_history) > 3:
        recent_topics = set()
        for hist in conversation_history[-3:]:
            recent_topics.update(extract_topic_keywords(hist.get('user_message', '')))
        
        current_keywords = set(extract_topic_keywords(question))
        
        if len(recent_topics.intersection(current_keywords)) > 0:
            opportunities["concept_building_needed"] = True
            opportunities["suggestions"].append(
                "This builds on previous discussion - ensure connections are clear"
            )
    
    # Check for procedural questions (suggest practice)
    practice_indicators = ["how do i", "how to", "steps to", "process of", "calculate"]
    
    if any(indicator in question.lower() for indicator in practice_indicators):
        opportunities["practice_recommended"] = True
        opportunities["suggestions"].append(
            "Offer practice problems or step-by-step exercises"
        )
    
    return opportunities


def enhance_response_structure(response: str, topic: str) -> str:
    """
    Post-process response to ensure proper structure and formatting
    """
    
    # If response lacks structure, add it
    if "\n\n" not in response and len(response) > 300:
        # Try to identify natural break points
        sentences = response.split(". ")
        
        if len(sentences) > 5:
            # Add paragraph breaks every 3-4 sentences
            structured = []
            for i, sentence in enumerate(sentences):
                structured.append(sentence)
                if (i + 1) % 3 == 0 and i < len(sentences) - 1:
                    structured.append("\n\n")
                elif i < len(sentences) - 1:
                    structured.append(". ")
            
            response = "".join(structured)
    
    # Ensure there's a summary or conclusion for longer responses
    if len(response) > 600 and "summary" not in response.lower():
        response += f"\n\n**Key Takeaway**: {topic} is an important concept that requires both theoretical understanding and practical application."
    
    return response


def generate_personalized_encouragement(
    learning_context: Dict,
    current_performance: Dict
) -> str:
    """
    Generate personalized encouragement based on progress
    """
    
    encouragements = []
    
    # Streak-based encouragement
    streak = learning_context.get('total_learning_days', 0)
    if streak >= 7:
        encouragements.append(
            f"🌟 Impressive! You've been consistently learning for {streak} days. "
            f"Your dedication is building strong learning habits!"
        )
    elif streak >= 3:
        encouragements.append(
            f"Great job staying consistent! You're on a {streak}-day learning streak."
        )
    
    # Accuracy-based encouragement
    accuracy = learning_context.get('avg_accuracy', 0)
    if accuracy >= 85:
        encouragements.append(
            f"Your understanding is excellent - {accuracy}% accuracy shows strong grasp of concepts!"
        )
    elif accuracy >= 70:
        encouragements.append(
            f"You're doing well with {accuracy}% accuracy. Keep up the good work!"
        )
    
    # Progress-based encouragement
    questions_today = current_performance.get('questions_today', 0)
    if questions_today >= 10:
        encouragements.append(
            f"You're really pushing yourself today with {questions_today} questions explored!"
        )
    
    return " ".join(encouragements) if encouragements else ""


# Example integration into the main system
ENHANCED_SYSTEM_INSTRUCTIONS = """
=== CORE TEACHING PHILOSOPHY ===
You are not just answering questions - you are facilitating deep, lasting learning.

Your approach should embody these principles:

1. **Socratic Method**: Guide discovery through thoughtful questions
2. **Active Learning**: Encourage engagement, not passive reception
3. **Metacognition**: Help students think about their thinking
4. **Growth Mindset**: Frame challenges as opportunities
5. **Spaced Repetition**: Reference and build on previous learning
6. **Elaboration**: Connect new information to existing knowledge

=== RESPONSE QUALITY STANDARDS ===

Every response should:
✓ Be comprehensive yet accessible
✓ Include concrete examples
✓ Provide context and connections
✓ Offer multiple perspectives when appropriate
✓ End with a path forward (question, exercise, or extension)
✓ Use clear structure with headings and formatting
✓ Adapt to the student's demonstrated level
✓ Reference previous discussions when relevant

Avoid:
✗ One-line answers without explanation
✗ Jargon without definition
✗ Assumptions about prior knowledge
✗ Generic responses that could apply to anyone
✗ Ending without engagement opportunity

=== CONTINUITY AND MEMORY ===

When continuing a conversation:
- Explicitly acknowledge what was previously discussed
- Build directly on established concepts
- Reference specific examples or analogies used before
- Note progress: "Last time we covered X, now let's extend to Y"

When starting a new topic:
- Check if it relates to previous learning
- If related: "This connects to what we discussed about X"
- If unrelated: Start fresh but with full personalization

=== DEPTH AND DETAIL ===

For explanatory responses:
1. **Overview**: Start with the big picture (2-3 sentences)
2. **Core Concept**: Explain the fundamental idea in detail
3. **Breaking It Down**: Divide into digestible components
4. **Examples**: Provide 2-3 concrete, relatable examples
5. **Application**: Show how it's used in practice
6. **Common Pitfalls**: Address typical misunderstandings
7. **Connection**: Link to broader concepts or real-world relevance
8. **Practice Path**: Suggest next steps or exercises

Minimum response length guidelines:
- Conceptual explanations: 200-400 words
- Problem-solving: 150-300 words with step-by-step breakdown
- Quick clarifications: 100-150 words with core answer + context
- Complex topics: 400-600 words with comprehensive coverage

=== ENGAGEMENT STRATEGIES ===

Use these techniques to maintain engagement:

**Analogies and Metaphors**: 
- Make abstract concrete
- Use familiar scenarios
- Build mental models

**Storytelling**:
- Use historical context
- Share real-world applications
- Create narrative flow

**Interactive Elements**:
- Pose thought experiments
- Suggest "try this" moments
- Offer check-your-understanding questions

**Visual Description**:
- Describe diagrams in words
- Use ASCII art for simple visualizations
- Guide mental imagery

=== ERROR HANDLING AND MISCONCEPTIONS ===

When detecting confusion or errors:

1. **Never dismiss**: Validate the attempt
2. **Identify the gap**: Pinpoint where understanding diverged
3. **Rebuild foundation**: Address the root concept
4. **Correct gently**: "Here's a common confusion..." not "That's wrong"
5. **Provide correct model**: Give clear, accurate explanation
6. **Verify understanding**: End with a check

=== ADAPTIVE DIFFICULTY ===

**For Beginners**:
- Define all terms
- Use simple language
- Provide extensive examples
- Break down every step
- Encourage questions
- Celebrate small wins

**For Intermediate**:
- Assume basic vocabulary
- Focus on connections
- Introduce complexity gradually
- Challenge with "why" questions
- Provide practice opportunities
- Reference advanced topics briefly

**For Advanced**:
- Use technical terminology
- Discuss nuances and edge cases
- Present multiple perspectives
- Encourage critical analysis
- Introduce research and debate
- Push boundaries of understanding

=== SUBJECT-SPECIFIC EXCELLENCE ===

Adapt your approach by subject while maintaining rigor and depth across all fields.
"""

def get_archetype_adapted_prompt(primary_archetype: str, secondary_archetype: str = None) -> str:
    archetype_prompts = {
        "Logicor": """
LOGICOR LEARNER - Logical & Systematic:
- Break down concepts into clear, sequential steps with logical frameworks
- Use deductive reasoning and structured methodologies
- Provide analytical breakdowns with cause-and-effect relationships
- Include formulas, algorithms, or systematic approaches
- Show logical progressions: "If A, then B, therefore C"
- Use numbered lists and hierarchical organization
        """,
        
        "Flowist": """
FLOWIST LEARNER - Dynamic & Hands-On:
- Provide interactive examples they can try immediately
- Use iterative, exploratory learning approaches
- Encourage "learning by doing" rather than pure theory
- Adapt explanations based on their engagement
- Suggest real-time experimentation and practice
- Keep content dynamic and action-oriented
        """,
        
        "Kinetiq": """
KINETIQ LEARNER - Kinesthetic & Physical:
- Suggest physical activities or movements related to concepts
- Use tangible, hands-on examples and demonstrations
- Relate abstract ideas to body sensations or physical actions
- Recommend building, creating, or manipulating objects
- Include "try this yourself" exercises
- Use action verbs and movement metaphors
        """,
        
        "Synth": """
SYNTH LEARNER - Integrative & Connective:
- Show how concepts relate across different domains and subjects
- Create bridges between disparate areas of knowledge
- Use interdisciplinary examples and cross-field analogies
- Highlight patterns and systems thinking
- Encourage holistic understanding and big-picture connections
- Reference multiple perspectives and viewpoints
        """,
        
        "Dreamweaver": """
DREAMWEAVER LEARNER - Visionary & Imaginative:
- Start with the big vision and overall concept
- Use visual metaphors, imaginative scenarios, and future possibilities
- Discuss potential applications and innovative uses
- Provide creative, non-traditional perspectives
- Include mind maps, diagrams (described), and visual representations
- Encourage "what if" thinking and creative exploration
        """,
        
        "Anchor": """
ANCHOR LEARNER - Structured & Organized:
- Provide clear outlines and organized frameworks
- Use step-by-step progressions with defined milestones
- Include structured study plans and systematic resources
- Set clear goals with measurable objectives
- Follow consistent formatting and logical organization
- Create predictable, stable learning pathways
        """,
        
        "Spark": """
SPARK LEARNER - Creative & Innovative:
- Use creative analogies and unexpected connections
- Encourage brainstorming and divergent thinking
- Present novel perspectives and alternative approaches
- Include colorful examples and expressive language
- Foster curiosity through intriguing questions
- Celebrate unique insights and creative solutions
        """,
        
        "Empathion": """
EMPATHION LEARNER - Emotional & Interpersonal:
- Relate concepts to human experiences and emotions
- Use storytelling and personal narratives
- Discuss the human impact and deeper meaning
- Create empathetic connections to the material
- Acknowledge feelings and emotional responses to learning
- Frame learning in terms of personal growth and relationships
        """,
        
        "Seeker": """
SEEKER LEARNER - Curious & Exploratory:
- Present intriguing questions and intellectual mysteries
- Encourage independent research and exploration
- Share fascinating facts and surprising insights
- Provide breadth across topics before diving into depth
- Foster wonder and intellectual curiosity
- Create "rabbit holes" to explore further
        """,
        
        "Resonant": """
RESONANT LEARNER - Adaptive & Flexible:
- Offer multiple explanation styles and learning paths
- Be highly flexible in pacing and approach
- Adjust dynamically based on feedback and engagement
- Provide diverse resources and varied perspectives
- Support self-directed, personalized learning journeys
- Mirror and adapt to their current learning state
        """
    }
    
    primary_prompt = archetype_prompts.get(primary_archetype, "")
    
    if secondary_archetype and secondary_archetype != primary_archetype:
        secondary_prompt = archetype_prompts.get(secondary_archetype, "")
        return f"{primary_prompt}\n\nSECONDARY LEARNING PREFERENCE:\n{secondary_prompt}"
    
    return primary_prompt

def create_dynamic_context_window(
    conversation_history: List[Dict],
    relevant_past_chats: List[Dict],
    max_tokens: int = 1500
) -> str:
    """
    Intelligently build context that fits within token limits
    while maximizing relevant information
    """
    
    context_parts = []
    estimated_tokens = 0
    
    # Priority 1: Most recent conversation (always include)
    if conversation_history:
        recent_context = "\n=== CURRENT CONVERSATION ===\n"
        for msg in conversation_history[-3:]:  # Last 3 exchanges
            recent_context += f"Student: {msg['user_message'][:200]}\n"
            recent_context += f"You: {msg['ai_response'][:200]}...\n\n"
        
        context_parts.append(recent_context)
        estimated_tokens += len(recent_context.split()) * 1.3
    
    # Priority 2: Most relevant past conversations
    if relevant_past_chats and estimated_tokens < max_tokens * 0.7:
        relevant_context = "\n=== RELATED PREVIOUS DISCUSSIONS ===\n"
        
        for chat in relevant_past_chats[:2]:  # Top 2 most relevant
            if estimated_tokens >= max_tokens * 0.9:
                break
            
            chat_summary = (
                f"Session '{chat['title']}': {chat['preview'][:150]}...\n"
            )
            relevant_context += chat_summary
            estimated_tokens += len(chat_summary.split()) * 1.3
        
        context_parts.append(relevant_context)
    
    return "\n".join(context_parts)


def generate_learning_path_suggestion(
    user_profile: Dict,
    current_topic: str,
    learning_context: Dict
) -> str:
    """
    Suggest a personalized learning path based on progress
    """
    
    weak_areas = learning_context.get('weak_areas', [])
    strong_areas = learning_context.get('strong_areas', [])
    
    suggestions = []
    
    # If current topic relates to weak area
    if any(weak in current_topic.lower() for weak in [w.lower() for w in weak_areas]):
        suggestions.append(
            f"💡 **Learning Path Suggestion**: Since you're working on {current_topic}, "
            f"which you've identified as a growth area, I recommend:\n"
            f"1. Master the fundamentals we're discussing today\n"
            f"2. Practice with varied examples\n"
            f"3. Build up to more complex applications\n"
            f"4. Review regularly to strengthen understanding"
        )
    
    # If building on strong area
    elif any(strong in current_topic.lower() for strong in [s.lower() for s in strong_areas]):
        suggestions.append(
            f"🚀 **Acceleration Opportunity**: You have strong foundations in this area! "
            f"Consider exploring:\n"
            f"- Advanced applications of {current_topic}\n"
            f"- Connections to other fields\n"
            f"- Research-level concepts\n"
            f"- Teaching others to deepen mastery"
        )
    
    return "\n".join(suggestions)


def analyze_question_intent(question: str) -> Dict[str, Any]:
    """
    Analyze the type and intent of the student's question
    to tailor the response appropriately
    """
    
    intent = {
        'type': 'general',
        'depth_requested': 'medium',
        'requires_examples': False,
        'requires_steps': False,
        'is_clarification': False,
        'is_application': False,
        'emotional_tone': 'neutral'
    }
    
    question_lower = question.lower()
    
    # Determine question type
    if any(word in question_lower for word in ['how', 'steps', 'process', 'method']):
        intent['type'] = 'procedural'
        intent['requires_steps'] = True
    
    elif any(word in question_lower for word in ['why', 'reason', 'cause', 'explain']):
        intent['type'] = 'explanatory'
        intent['depth_requested'] = 'high'
    
    elif any(word in question_lower for word in ['what is', 'define', 'meaning']):
        intent['type'] = 'definitional'
    
    elif any(word in question_lower for word in ['example', 'instance', 'demonstrate']):
        intent['type'] = 'example-seeking'
        intent['requires_examples'] = True
    
    elif any(word in question_lower for word in ['compare', 'difference', 'versus', 'vs']):
        intent['type'] = 'comparative'
        intent['requires_examples'] = True
    
    elif any(word in question_lower for word in ['apply', 'use', 'implement', 'practice']):
        intent['type'] = 'application'
        intent['is_application'] = True
        intent['requires_steps'] = True
    
    # Detect clarification requests
    if any(phrase in question_lower for phrase in ['still confused', 'don\'t understand', 'can you explain again', 'simpler']):
        intent['is_clarification'] = True
        intent['depth_requested'] = 'high'
        intent['emotional_tone'] = 'struggling'
    
    # Detect depth indicators
    if any(word in question_lower for word in ['detailed', 'comprehensive', 'deep', 'thorough', 'in-depth']):
        intent['depth_requested'] = 'very_high'
    
    elif any(word in question_lower for word in ['brief', 'quick', 'summary', 'overview']):
        intent['depth_requested'] = 'low'
    
    # Detect confidence level
    if any(phrase in question_lower for phrase in ['i think', 'i believe', 'is it correct', 'am i right']):
        intent['emotional_tone'] = 'uncertain'
    
    elif any(phrase in question_lower for phrase in ['stuck', 'help', 'struggling', 'difficult']):
        intent['emotional_tone'] = 'frustrated'
    
    return intent


def format_response_by_intent(
    response: str,
    intent: Dict[str, Any],
    topic: str
) -> str:
    """
    Format and enhance response based on detected intent
    """
    
    formatted = response
    
    # Add appropriate opening based on emotional tone
    if intent['emotional_tone'] == 'struggling':
        formatted = (
            f"I understand this can be challenging - let's break it down together. "
            f"{formatted}"
        )
    
    elif intent['emotional_tone'] == 'uncertain':
        formatted = (
            f"Great question! Let me help clarify your thinking. "
            f"{formatted}"
        )
    
    # Ensure proper structure for procedural questions
    if intent['type'] == 'procedural' and 'step' not in response.lower():
        formatted += (
            f"\n\n**Quick Reference Steps:**\n"
            f"Review the process above, and feel free to ask about any specific step!"
        )
    
    # Add examples for comparative questions if missing
    if intent['type'] == 'comparative' and formatted.count('example') < 2:
        formatted += (
            f"\n\n**Need Examples?** Ask me for specific examples comparing these concepts, "
            f"and I'll provide concrete scenarios!"
        )
    
    # Add practice suggestion for application questions
    if intent['is_application']:
        formatted += (
            f"\n\n**Practice Opportunity**: Would you like me to provide a practice problem "
            f"where you can apply {topic}?"
        )
    
    return formatted


# Complete integration example
async def generate_ultra_enhanced_response(
    question: str,
    user_profile: Dict[str, Any],
    learning_context: Dict[str, Any],
    conversation_history: List[Dict],
    relevant_past_chats: List[Dict],
    db: Session
) -> Dict[str, Any]:
    """
    The ultimate response generation with all enhancements
    """
    
    # Analyze question intent
    intent = analyze_question_intent(question)
    
    # Build dynamic context
    context_summary = create_dynamic_context_window(
        conversation_history,
        relevant_past_chats,
        max_tokens=1500
    )
    
    # Generate subject-specific prompts
    subject_prompts = generate_subject_specific_prompts(
        user_profile.get('field_of_study', 'General'),
        user_profile.get('learning_style', 'Mixed')
    )
    
    # Build comprehensive system prompt
    system_prompt = (
        f"{build_enhanced_system_prompt(user_profile, learning_context, relevant_past_chats)}\n\n"
        f"{ENHANCED_SYSTEM_INSTRUCTIONS}\n\n"
        f"{subject_prompts}\n\n"
        f"{context_summary}\n\n"
        f"**Question Intent Analysis**: This is a {intent['type']} question "
        f"requiring {intent['depth_requested']} depth. "
        f"Student's emotional state appears {intent['emotional_tone']}.\n\n"
        f"Respond accordingly with appropriate depth, examples, and support."
    )
    
    # Generate base response
    response = await generate_enhanced_ai_response(
        question,
        user_profile,
        learning_context,
        conversation_history,
        relevant_past_chats
    )
    
    # Format based on intent
    response = format_response_by_intent(response, intent, question)
    
    # Enhance structure
    topic = " ".join(extract_topic_keywords(question)[:3])
    response = enhance_response_structure(response, topic)
    
    # Detect learning opportunities
    learning_opportunity = detect_learning_opportunity(
        question,
        response,
        conversation_history
    )
    
    # Add personalized encouragement if appropriate
    encouragement = generate_personalized_encouragement(
        learning_context,
        {'questions_today': learning_context.get('avg_questions_per_day', 0)}
    )
    
    if encouragement and len(conversation_history) % 5 == 0:  # Every 5 messages
        response = f"{encouragement}\n\n{response}"
    
    # Generate follow-up questions
    follow_ups = generate_adaptive_follow_up_questions(
        topic,
        user_profile.get('difficulty_level', 'intermediate'),
        len(response)
    )
    
    # Add learning path suggestion occasionally
    if len(conversation_history) >= 3 and len(conversation_history) % 3 == 0:
        path_suggestion = generate_learning_path_suggestion(
            user_profile,
            topic,
            learning_context
        )
        if path_suggestion:
            response = f"{response}\n\n{path_suggestion}"
    
    return {
        'response': response,
        'intent_analysis': intent,
        'learning_opportunity': learning_opportunity,
        'follow_up_suggestions': follow_ups[:2],
        'engagement_metrics': {
            'depth_score': intent['depth_requested'],
            'personalization_level': 'high' if learning_context else 'medium',
            'context_awareness': len(relevant_past_chats) > 0
        }
    }


# Export all functions for use in main application
__all__ = [
    'generate_subject_specific_prompts',
    'generate_adaptive_follow_up_questions',
    'detect_learning_opportunity',
    'enhance_response_structure',
    'generate_personalized_encouragement',
    'create_dynamic_context_window',
    'generate_learning_path_suggestion',
    'analyze_question_intent',
    'format_response_by_intent',
    'generate_ultra_enhanced_response',
    'ENHANCED_SYSTEM_INSTRUCTIONS'
]