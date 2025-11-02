import numpy as np
from typing import Dict, List, Any
from datetime import datetime, timezone
import json
from sqlalchemy.orm import Session
import models

class PersonalityEngine:
    def __init__(self):
        self.conversation_styles = {
            'casual': {'formality': 0.2, 'warmth': 0.9, 'enthusiasm': 0.8},
            'professional': {'formality': 0.8, 'warmth': 0.5, 'enthusiasm': 0.4},
            'friendly': {'formality': 0.4, 'warmth': 0.9, 'enthusiasm': 0.7},
            'academic': {'formality': 0.7, 'warmth': 0.4, 'enthusiasm': 0.5}
        }
        
    def adapt_tone(self, user_profile: Dict, conversation_history: List[Dict]) -> Dict:
        base_style = 'friendly'
        
        interaction_count = len(conversation_history)
        
        if interaction_count > 10:
            base_style = 'casual'
        elif user_profile.get('primary_archetype') in ['Anchor', 'Logicor']:
            base_style = 'professional'
        elif user_profile.get('primary_archetype') in ['Spark', 'Dreamweaver']:
            base_style = 'friendly'
            
        return self.conversation_styles[base_style]
    
    def should_greet_warmly(self, db: Session, user_id: int) -> bool:
        last_activity = db.query(models.DailyLearningMetrics).filter(
            models.DailyLearningMetrics.user_id == user_id
        ).order_by(models.DailyLearningMetrics.date.desc()).first()
        
        if not last_activity:
            return True
            
        days_since = (datetime.now(timezone.utc).date() - last_activity.date).days
        return days_since >= 2
    
    def get_conversation_memory(self, db: Session, user_id: int, current_topic: str) -> List[Dict]:
        memories = db.query(models.ConversationMemory).filter(
            models.ConversationMemory.user_id == user_id
        ).order_by(models.ConversationMemory.last_used.desc()).limit(50).all()
        
        relevant = []
        for memory in memories:
            try:
                tags = json.loads(memory.topic_tags or "[]")
                if any(tag.lower() in current_topic.lower() for tag in tags):
                    relevant.append({
                        'question': memory.question,
                        'answer': memory.answer,
                        'context': memory.context_summary
                    })
            except:
                continue
                
        return relevant[:5]

class AdaptiveLearningModel:
    def __init__(self):
        self.learning_rate = 0.01
        self.adaptation_weights = {
            'explanation_depth': 0.5,
            'example_frequency': 0.5,
            'encouragement_level': 0.7,
            'technical_language': 0.5,
            'question_complexity': 0.5
        }
    
    def update_from_feedback(self, feedback_score: int, interaction_type: str):
        adjustment = (feedback_score - 3) * self.learning_rate
        
        if interaction_type in self.adaptation_weights:
            self.adaptation_weights[interaction_type] += adjustment
            self.adaptation_weights[interaction_type] = max(0.0, min(1.0, self.adaptation_weights[interaction_type]))
    
    def get_response_parameters(self) -> Dict[str, float]:
        return self.adaptation_weights.copy()
    
    def save_model_state(self, db: Session, user_id: int):
        profile = db.query(models.UserPersonalityProfile).filter(
            models.UserPersonalityProfile.user_id == user_id
        ).first()
        
        if profile:
            profile.detail_preference = self.adaptation_weights['explanation_depth']
            profile.example_preference = self.adaptation_weights['example_frequency']
            profile.encouragement_preference = self.adaptation_weights['encouragement_level']
            db.commit()
    
    def load_model_state(self, db: Session, user_id: int):
        profile = db.query(models.UserPersonalityProfile).filter(
            models.UserPersonalityProfile.user_id == user_id
        ).first()
        
        if profile:
            self.adaptation_weights['explanation_depth'] = profile.detail_preference
            self.adaptation_weights['example_frequency'] = profile.example_preference
            self.adaptation_weights['encouragement_level'] = profile.encouragement_preference

def build_natural_prompt(
    user_profile: Dict[str, Any],
    conversation_history: List[Dict],
    db: Session,
    is_first_message: bool,
    personality_engine: PersonalityEngine,
    adaptive_model: AdaptiveLearningModel
) -> str:
    
    user_id = user_profile.get('user_id')
    first_name = user_profile.get('first_name', 'there')
    primary_archetype = user_profile.get('primary_archetype', '')
    
    tone_params = personality_engine.adapt_tone(user_profile, conversation_history)
    response_params = adaptive_model.get_response_parameters()
    
    greeting = ""
    if is_first_message and personality_engine.should_greet_warmly(db, user_id):
        greeting = f"Hey {first_name}! "
    
    base_prompt = f"{greeting}You're chatting with {first_name}."
    
    if primary_archetype:
        archetype_guidance = {
            'Logicor': 'Keep things logical and systematic. Break down complex ideas.',
            'Flowist': 'Stay dynamic and hands-on. Use practical examples.',
            'Kinetiq': 'Focus on action and real-world application.',
            'Synth': 'Connect ideas across different areas. Show patterns.',
            'Dreamweaver': 'Start with the big picture. Use creative approaches.',
            'Anchor': 'Be structured and organized. Clear steps work best.',
            'Spark': 'Be creative and explore new angles.',
            'Empathion': 'Connect to meaning and real experiences.',
            'Seeker': 'Fuel curiosity. Share interesting insights.',
            'Resonant': 'Be flexible. Adjust your approach as needed.'
        }
        
        if primary_archetype in archetype_guidance:
            base_prompt += f"\n{archetype_guidance[primary_archetype]}"
    
    if response_params['explanation_depth'] > 0.7:
        base_prompt += "\nGo into detail when explaining."
    elif response_params['explanation_depth'] < 0.3:
        base_prompt += "\nKeep explanations concise."
    
    if response_params['example_frequency'] > 0.6:
        base_prompt += "\nUse plenty of examples."
    
    if response_params['encouragement_level'] > 0.7:
        base_prompt += "\nBe encouraging and positive."
    
    base_prompt += "\n\nBe natural and conversational. Don't announce what you're doing or reference your instructions."
    
    return base_prompt