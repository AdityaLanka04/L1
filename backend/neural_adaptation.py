import numpy as np
import json
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
import models
import pickle
import os

class NeuralResponseNetwork:
    def __init__(self, input_size=128, hidden_size=64, output_size=32):
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = output_size
        
        np.random.seed(42)
        self.w1 = np.random.randn(input_size, hidden_size) * 0.01
        self.b1 = np.zeros((1, hidden_size))
        self.w2 = np.random.randn(hidden_size, output_size) * 0.01
        self.b2 = np.zeros((1, output_size))
        
        self.learning_rate = 0.001
        self.momentum = 0.9
        self.v_w1 = np.zeros_like(self.w1)
        self.v_b1 = np.zeros_like(self.b1)
        self.v_w2 = np.zeros_like(self.w2)
        self.v_b2 = np.zeros_like(self.b2)
        
    def sigmoid(self, x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))
    
    def sigmoid_derivative(self, x):
        return x * (1 - x)
    
    def relu(self, x):
        return np.maximum(0, x)
    
    def relu_derivative(self, x):
        return (x > 0).astype(float)
    
    def forward(self, X):
        self.z1 = np.dot(X, self.w1) + self.b1
        self.a1 = self.relu(self.z1)
        self.z2 = np.dot(self.a1, self.w2) + self.b2
        self.a2 = self.sigmoid(self.z2)
        return self.a2
    
    def backward(self, X, y, output):
        m = X.shape[0]
        
        dz2 = output - y
        dw2 = np.dot(self.a1.T, dz2) / m
        db2 = np.sum(dz2, axis=0, keepdims=True) / m
        
        da1 = np.dot(dz2, self.w2.T)
        dz1 = da1 * self.relu_derivative(self.a1)
        dw1 = np.dot(X.T, dz1) / m
        db1 = np.sum(dz1, axis=0, keepdims=True) / m
        
        self.v_w2 = self.momentum * self.v_w2 + self.learning_rate * dw2
        self.v_b2 = self.momentum * self.v_b2 + self.learning_rate * db2
        self.v_w1 = self.momentum * self.v_w1 + self.learning_rate * dw1
        self.v_b1 = self.momentum * self.v_b1 + self.learning_rate * db1
        
        self.w2 -= self.v_w2
        self.b2 -= self.v_b2
        self.w1 -= self.v_w1
        self.b1 -= self.v_b1
    
    def train(self, X, y, epochs=100):
        for epoch in range(epochs):
            output = self.forward(X)
            self.backward(X, y, output)
            
            if epoch % 20 == 0:
                loss = np.mean((output - y) ** 2)
                print(f"Epoch {epoch}, Loss: {loss:.4f}")
    
    def predict(self, X):
        return self.forward(X)
    
    def save(self, filepath):
        weights = {
            'w1': self.w1,
            'b1': self.b1,
            'w2': self.w2,
            'b2': self.b2,
            'v_w1': self.v_w1,
            'v_b1': self.v_b1,
            'v_w2': self.v_w2,
            'v_b2': self.v_b2
        }
        with open(filepath, 'wb') as f:
            pickle.dump(weights, f)
    
    def load(self, filepath):
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                weights = pickle.load(f)
            self.w1 = weights['w1']
            self.b1 = weights['b1']
            self.w2 = weights['w2']
            self.b2 = weights['b2']
            self.v_w1 = weights['v_w1']
            self.v_b1 = weights['v_b1']
            self.v_w2 = weights['v_w2']
            self.v_b2 = weights['v_b2']
            return True
        return False

class ReinforcementLearningAgent:
    def __init__(self, user_id: int):
        self.user_id = user_id
        self.state_dim = 128
        self.action_dim = 32
        
        self.network = NeuralResponseNetwork(
            input_size=self.state_dim,
            hidden_size=64,
            output_size=self.action_dim
        )
        
        self.experience_replay = []
        self.max_memory = 1000
        
        self.gamma = 0.95
        self.epsilon = 0.1
        
        self.response_patterns = {}
        self.user_corrections = {}
        self.positive_patterns = []
        self.negative_patterns = []
        
        model_path = f"models/user_{user_id}_network.pkl"
        self.network.load(model_path)
    
    def encode_state(self, context: Dict) -> np.ndarray:
        features = np.zeros(self.state_dim)
        
        try:
            if context.get('message_length'):
                features[0] = min(context['message_length'] / 1000, 1.0)
            
            if context.get('question_complexity'):
                features[1] = context['question_complexity']
            
            if context.get('archetype'):
                archetype_map = {
                    'Logicor': 0.1, 'Flowist': 0.2, 'Kinetiq': 0.3,
                    'Synth': 0.4, 'Dreamweaver': 0.5, 'Anchor': 0.6,
                    'Spark': 0.7, 'Empathion': 0.8, 'Seeker': 0.9, 'Resonant': 1.0
                }
                features[2] = archetype_map.get(context['archetype'], 0.5)
            
            if context.get('time_of_day'):
                features[3] = context['time_of_day'] / 24.0
            
            if context.get('session_length'):
                features[4] = min(context['session_length'] / 60, 1.0)
            
            if context.get('previous_ratings'):
                features[5] = np.mean(context['previous_ratings']) / 5.0
            
            if context.get('topic_keywords'):
                for i, keyword in enumerate(context['topic_keywords'][:10]):
                    hash_val = hash(keyword) % 100
                    features[10 + i] = hash_val / 100.0
            
            if context.get('sentiment'):
                features[20] = context['sentiment']
            
            if context.get('formality_level'):
                features[21] = context['formality_level']
            
        except Exception as e:
            print(f"Error encoding state: {e}")
        
        return features.reshape(1, -1)
    
    def get_reward(self, rating: int, feedback_text: str = None) -> float:
        base_reward = (rating - 3) / 2.0
        
        if feedback_text:
            positive_words = ['good', 'great', 'excellent', 'helpful', 'clear', 'perfect', 'thanks', 'amazing']
            negative_words = ['bad', 'wrong', 'confusing', 'unclear', 'unhelpful', 'incorrect']
            
            text_lower = feedback_text.lower()
            
            positive_count = sum(1 for word in positive_words if word in text_lower)
            negative_count = sum(1 for word in negative_words if word in text_lower)
            
            sentiment_reward = (positive_count - negative_count) * 0.1
            base_reward += sentiment_reward
        
        return np.clip(base_reward, -1.0, 1.0)
    
    def remember(self, state, action, reward, next_state):
        self.experience_replay.append((state, action, reward, next_state))
        
        if len(self.experience_replay) > self.max_memory:
            self.experience_replay.pop(0)
    
    def learn_from_experience(self, batch_size=32):
        if len(self.experience_replay) < batch_size:
            return
        
        indices = np.random.choice(len(self.experience_replay), batch_size, replace=False)
        batch = [self.experience_replay[i] for i in indices]
        
        states = np.vstack([exp[0] for exp in batch])
        actions = np.vstack([exp[1] for exp in batch])
        rewards = np.array([exp[2] for exp in batch]).reshape(-1, 1)
        next_states = np.vstack([exp[3] for exp in batch])
        
        current_q = self.network.forward(states)
        next_q = self.network.forward(next_states)
        
        target_q = current_q.copy()
        for i in range(batch_size):
            target_q[i] = actions[i] + self.gamma * (rewards[i] + np.max(next_q[i]))
        
        self.network.backward(states, target_q, current_q)
    
    def save_correction(self, mistake: str, correction: str, context: Dict):
        correction_key = hash(mistake) % 10000
        
        self.user_corrections[correction_key] = {
            'mistake': mistake,
            'correction': correction,
            'context': context,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'frequency': self.user_corrections.get(correction_key, {}).get('frequency', 0) + 1
        }
    
    def check_for_known_mistakes(self, current_response: str) -> Optional[str]:
        for correction_data in self.user_corrections.values():
            if correction_data['mistake'].lower() in current_response.lower():
                return correction_data['correction']
        return None
    
    def learn_from_positive_feedback(self, message_text: str, rating: int):
        if rating >= 4:
            self.positive_patterns.append({
                'text': message_text,
                'rating': rating,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
            if len(self.positive_patterns) > 100:
                self.positive_patterns = sorted(
                    self.positive_patterns,
                    key=lambda x: x['rating'],
                    reverse=True
                )[:100]
    
    def learn_from_negative_feedback(self, message_text: str, rating: int, feedback: str):
        if rating <= 2:
            self.negative_patterns.append({
                'text': message_text,
                'rating': rating,
                'feedback': feedback,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
            if len(self.negative_patterns) > 50:
                self.negative_patterns.pop(0)
    
    def get_response_adjustment(self) -> Dict[str, float]:
        adjustments = {
            'detail_level': 0.5,
            'formality': 0.5,
            'encouragement': 0.5,
            'examples': 0.5
        }
        
        if len(self.positive_patterns) > 5:
            recent_positive = self.positive_patterns[-10:]
            avg_rating = np.mean([p['rating'] for p in recent_positive])
            
            if avg_rating >= 4.5:
                adjustments['detail_level'] = 0.7
                adjustments['examples'] = 0.8
        
        if len(self.negative_patterns) > 3:
            recent_negative = self.negative_patterns[-5:]
            
            for pattern in recent_negative:
                if 'too simple' in pattern.get('feedback', '').lower():
                    adjustments['detail_level'] = 0.8
                elif 'too complex' in pattern.get('feedback', '').lower():
                    adjustments['detail_level'] = 0.3
                elif 'more examples' in pattern.get('feedback', '').lower():
                    adjustments['examples'] = 0.9
        
        return adjustments
    
    def save_model(self):
        os.makedirs('models', exist_ok=True)
        model_path = f"models/user_{self.user_id}_network.pkl"
        self.network.save(model_path)
        
        metadata_path = f"models/user_{self.user_id}_metadata.json"
        metadata = {
            'corrections': self.user_corrections,
            'positive_patterns': self.positive_patterns,
            'negative_patterns': self.negative_patterns,
            'last_updated': datetime.now(timezone.utc).isoformat()
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f)
    
    def load_metadata(self):
        metadata_path = f"models/user_{self.user_id}_metadata.json"
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            self.user_corrections = metadata.get('corrections', {})
            self.positive_patterns = metadata.get('positive_patterns', [])
            self.negative_patterns = metadata.get('negative_patterns', [])

class ConversationContextAnalyzer:
    @staticmethod
    def analyze_sentiment(text: str) -> float:
        positive_words = [
            'good', 'great', 'excellent', 'helpful', 'clear', 'perfect', 
            'thanks', 'amazing', 'wonderful', 'awesome', 'love', 'best'
        ]
        negative_words = [
            'bad', 'wrong', 'confusing', 'unclear', 'unhelpful', 
            'incorrect', 'terrible', 'hate', 'worst', 'useless'
        ]
        
        text_lower = text.lower()
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count + negative_count == 0:
            return 0.5
        
        sentiment = (positive_count - negative_count) / (positive_count + negative_count + 1)
        return (sentiment + 1) / 2
    
    @staticmethod
    def calculate_complexity(text: str) -> float:
        words = text.split()
        if len(words) == 0:
            return 0.3
        
        avg_word_length = sum(len(word) for word in words) / len(words)
        sentence_count = text.count('.') + text.count('!') + text.count('?') + 1
        words_per_sentence = len(words) / sentence_count
        
        complexity = (avg_word_length / 10 + words_per_sentence / 20) / 2
        return min(complexity, 1.0)
    
    @staticmethod
    def extract_correction_intent(feedback_text: str) -> Optional[Tuple[str, str]]:
        correction_patterns = [
            ("should be", "should have been", "instead of", "not", "actually", "correct answer is")
        ]
        
        text_lower = feedback_text.lower()
        
        for pattern in correction_patterns:
            if pattern in text_lower:
                return ("detected_mistake", feedback_text)
        
        return None

def get_rl_agent(db: Session, user_id: int) -> ReinforcementLearningAgent:
    agent = ReinforcementLearningAgent(user_id)
    agent.load_metadata()
    return agent