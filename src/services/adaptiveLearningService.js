import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = `${API_BASE_URL}/api/adaptive`;

/**
 * Adaptive Learning Service
 * Handles real-time adaptive learning sessions with cognitive load monitoring
 */

class AdaptiveLearningService {
  constructor() {
    this.activeSession = null;
    this.sessionMetrics = null;
  }

  // Session Management
  async startAdaptiveSession(userId, topic) {
    try {
      const response = await axios.post(`${API_URL}/session/start`, {
        user_id: userId,
        topic: topic
      });
      
      if (response.data.status === 'success') {
        this.activeSession = response.data.session;
        return response.data.session;
      }
      throw new Error('Failed to start adaptive session');
    } catch (error) {
      console.error('Error starting adaptive session:', error);
      throw error;
    }
  }

  async processQuestionResponse(userId, questionData) {
    try {
      const response = await axios.post(`${API_URL}/session/response`, {
        user_id: userId,
        question_id: questionData.questionId,
        topic: questionData.topic,
        is_correct: questionData.isCorrect,
        response_time: questionData.responseTime,
        difficulty: questionData.difficulty
      });
      
      if (response.data.status === 'success') {
        return response.data.result;
      }
      throw new Error('Failed to process question response');
    } catch (error) {
      console.error('Error processing question response:', error);
      throw error;
    }
  }

  async getSessionMetrics(userId) {
    try {
      const response = await axios.get(`${API_URL}/session/metrics`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        this.sessionMetrics = response.data.metrics;
        return response.data.metrics;
      }
      return null;
    } catch (error) {
      console.error('Error getting session metrics:', error);
      throw error;
    }
  }

  async getRealTimeRecommendations(userId) {
    try {
      const response = await axios.get(`${API_URL}/session/recommendations`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.recommendations;
      }
      return null;
    } catch (error) {
      console.error('Error getting real-time recommendations:', error);
      throw error;
    }
  }

  async endAdaptiveSession(userId) {
    try {
      const response = await axios.post(`${API_URL}/session/end`, {
        user_id: userId
      });
      
      if (response.data.status === 'success') {
        const summary = response.data.summary;
        this.activeSession = null;
        this.sessionMetrics = null;
        return summary;
      }
      throw new Error('Failed to end adaptive session');
    } catch (error) {
      console.error('Error ending adaptive session:', error);
      throw error;
    }
  }

  // Cognitive Load Monitoring
  async assessCognitiveLoad(userId) {
    try {
      const response = await axios.get(`${API_URL}/cognitive-load`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.assessment;
      }
      return null;
    } catch (error) {
      console.error('Error assessing cognitive load:', error);
      throw error;
    }
  }

  // Difficulty & Learning Style
  async getAdaptiveDifficulty(userId, topic = null) {
    try {
      const params = { user_id: userId };
      if (topic) params.topic = topic;
      
      const response = await axios.get(`${API_URL}/difficulty`, { params });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting adaptive difficulty:', error);
      throw error;
    }
  }

  async detectLearningStyle(userId) {
    try {
      const response = await axios.get(`${API_URL}/learning-style`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error detecting learning style:', error);
      throw error;
    }
  }

  // Curriculum & Knowledge Gaps
  async getPersonalizedCurriculum(userId, goalTopic) {
    try {
      const response = await axios.get(`${API_URL}/curriculum`, {
        params: { user_id: userId, goal_topic: goalTopic }
      });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error getting personalized curriculum:', error);
      throw error;
    }
  }

  async findKnowledgeGaps(userId) {
    try {
      const response = await axios.get(`${API_URL}/knowledge-gaps`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error finding knowledge gaps:', error);
      throw error;
    }
  }

  // Retention & Spaced Repetition
  async optimizeRetention(userId) {
    try {
      const response = await axios.get(`${API_URL}/retention`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error optimizing retention:', error);
      throw error;
    }
  }

  async predictForgetting(userId) {
    try {
      const response = await axios.get(`${API_URL}/predict-forgetting`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error predicting forgetting:', error);
      throw error;
    }
  }

  // Burnout & Well-being
  async detectBurnoutRisk(userId) {
    try {
      const response = await axios.get(`${API_URL}/burnout-risk`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.burnout_analysis;
      }
      return null;
    } catch (error) {
      console.error('Error detecting burnout risk:', error);
      throw error;
    }
  }

  async getBreakSchedule(userId) {
    try {
      const response = await axios.get(`${API_URL}/break-schedule`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.break_schedule;
      }
      return null;
    } catch (error) {
      console.error('Error getting break schedule:', error);
      throw error;
    }
  }

  async predictFocusLevel(userId, timeOfDay) {
    try {
      const response = await axios.get(`${API_URL}/focus-prediction`, {
        params: { user_id: userId, time_of_day: timeOfDay }
      });
      
      if (response.data.status === 'success') {
        return response.data.focus_prediction;
      }
      return null;
    } catch (error) {
      console.error('Error predicting focus level:', error);
      throw error;
    }
  }

  // Content Transformation
  async transformContent(userId, content, topic, transformationType) {
    try {
      const response = await axios.post(`${API_URL}/transform-content`, {
        user_id: userId,
        content: content,
        topic: topic,
        transformation_type: transformationType
      });
      
      if (response.data.status === 'success') {
        return response.data.result;
      }
      return null;
    } catch (error) {
      console.error('Error transforming content:', error);
      throw error;
    }
  }

  // AI Tutor Modes
  async useTutorMode(userId, topic, mode, question) {
    try {
      const response = await axios.post(`${API_URL}/tutor-mode`, {
        user_id: userId,
        topic: topic,
        mode: mode,
        question: question
      });
      
      if (response.data.status === 'success') {
        return response.data.response;
      }
      return null;
    } catch (error) {
      console.error('Error using tutor mode:', error);
      throw error;
    }
  }

  // Collaborative Learning
  async findStudyTwin(userId) {
    try {
      const response = await axios.get(`${API_URL}/study-twin`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.study_twin;
      }
      return null;
    } catch (error) {
      console.error('Error finding study twin:', error);
      throw error;
    }
  }

  async findComplementaryLearners(userId) {
    try {
      const response = await axios.get(`${API_URL}/complementary-learners`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.complementary_learners;
      }
      return null;
    } catch (error) {
      console.error('Error finding complementary learners:', error);
      throw error;
    }
  }

  // Comprehensive Recommendations
  async getComprehensiveRecommendations(userId) {
    try {
      const response = await axios.get(`${API_URL}/comprehensive-recommendations`, {
        params: { user_id: userId }
      });
      
      if (response.data.status === 'success') {
        return response.data.recommendations;
      }
      return null;
    } catch (error) {
      console.error('Error getting comprehensive recommendations:', error);
      throw error;
    }
  }

  // Utility Methods
  getCognitiveLoadColor(loadLevel) {
    const colors = {
      'under-challenged': '#4CAF50',
      'optimal': '#8BC34A',
      'high': '#FF9800',
      'very_high': '#FF5722',
      'overload': '#F44336'
    };
    return colors[loadLevel] || '#9E9E9E';
  }

  getCognitiveLoadLabel(loadLevel) {
    const labels = {
      'under-challenged': 'Under-Challenged',
      'optimal': 'Optimal',
      'high': 'High Load',
      'very_high': 'Very High Load',
      'overload': 'Overload'
    };
    return labels[loadLevel] || 'Unknown';
  }

  getDifficultyColor(difficulty) {
    const colors = {
      'beginner': '#4CAF50',
      'intermediate': '#2196F3',
      'advanced': '#FF9800',
      'expert': '#9C27B0'
    };
    return colors[difficulty] || '#9E9E9E';
  }

  // Session State
  hasActiveSession() {
    return this.activeSession !== null;
  }

  getActiveSession() {
    return this.activeSession;
  }

  clearSession() {
    this.activeSession = null;
    this.sessionMetrics = null;
  }
}

export default new AdaptiveLearningService();
