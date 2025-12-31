/**
 * Quiz Agent Service
 * Frontend service for interacting with the Quiz Agent API
 */

import { API_URL, getAuthToken } from '../config';

class QuizAgentService {
  constructor() {
    // API_URL already includes /api, so we just add /agents/quiz
    this.baseUrl = `${API_URL}/agents/quiz`;
  }

  /**
   * Make API request with error handling and auth
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = getAuthToken();
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    try {
      console.log('📡 Quiz Agent Request:', url);
      const response = await fetch(url, { 
        ...defaultOptions, 
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        }
      });
      
      // Handle expired token
      if (response.status === 401) {
        console.warn('🔒 Token expired, redirecting to login...');
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Session expired. Please login again.');
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Quiz Agent API Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate quiz questions from a topic or content
   * @param {Object} params - Generation parameters
   * @param {string} params.userId - User ID
   * @param {string} params.topic - Topic to generate questions about
   * @param {string} [params.content] - Optional content to base questions on
   * @param {number} [params.questionCount=10] - Number of questions to generate
   * @param {Object} [params.difficultyMix] - Distribution of difficulties
   * @param {string[]} [params.questionTypes] - Types of questions to generate
   * @param {string[]} [params.topics] - Specific topics to focus on
   */
  async generateQuiz(params) {
    const {
      userId,
      topic,
      content,
      questionCount = 10,
      difficultyMix = { easy: 3, medium: 5, hard: 2 },
      questionTypes = ['multiple_choice'],
      topics,
      sessionId
    } = params;

    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        topic,
        content,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        question_types: questionTypes,
        topics,
        session_id: sessionId
      })
    });
  }

  /**
   * Generate adaptive quiz questions based on user performance
   * @param {Object} params - Adaptive generation parameters
   */
  async generateAdaptiveQuiz(params) {
    const {
      userId,
      topic,
      content,
      questionCount = 10,
      sessionId
    } = params;

    return this.request('/adaptive', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        topic,
        content,
        question_count: questionCount,
        session_id: sessionId
      })
    });
  }

  /**
   * Grade quiz answers
   * @param {Object} params - Grading parameters
   * @param {string} params.userId - User ID
   * @param {Array} params.questions - Array of question objects
   * @param {Object} params.answers - Map of question ID to user answer
   * @param {number} [params.timeTakenSeconds] - Time taken to complete quiz
   */
  async gradeQuiz(params) {
    const {
      userId,
      questions,
      answers,
      timeTakenSeconds,
      sessionId
    } = params;

    return this.request('/grade', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        questions,
        answers,
        time_taken_seconds: timeTakenSeconds,
        session_id: sessionId
      })
    });
  }

  /**
   * Analyze quiz performance
   * @param {Object} params - Analysis parameters
   * @param {string} params.userId - User ID
   * @param {Array} params.results - Grading results from gradeQuiz
   * @param {number} [params.timeTakenSeconds] - Time taken
   */
  async analyzePerformance(params) {
    const {
      userId,
      results,
      timeTakenSeconds,
      sessionId
    } = params;

    return this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        results,
        time_taken_seconds: timeTakenSeconds,
        session_id: sessionId
      })
    });
  }

  /**
   * Get study recommendations based on quiz performance
   * @param {string} userId - User ID
   */
  async getRecommendations(userId, sessionId = null) {
    const params = new URLSearchParams({ user_id: userId });
    if (sessionId) params.append('session_id', sessionId);
    
    return this.request(`/recommendations?${params}`, {
      method: 'GET'
    });
  }

  /**
   * Get detailed explanation for a question
   * @param {Object} params - Explanation parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.question - Question object
   * @param {string} [params.userAnswer] - User's answer
   */
  async explainQuestion(params) {
    const {
      userId,
      question,
      userAnswer = '',
      sessionId
    } = params;

    return this.request('/explain', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        question,
        user_answer: userAnswer,
        session_id: sessionId
      })
    });
  }

  /**
   * Generate similar questions for practice
   * @param {Object} params - Similar question parameters
   * @param {string} params.userId - User ID
   * @param {Object} params.question - Original question
   * @param {string} [params.difficulty] - Desired difficulty
   * @param {number} [params.count=1] - Number of similar questions
   */
  async generateSimilarQuestions(params) {
    const {
      userId,
      question,
      difficulty,
      count = 1,
      sessionId
    } = params;

    return this.request('/similar', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        question,
        difficulty,
        count,
        session_id: sessionId
      })
    });
  }

  /**
   * Review wrong answers from a quiz
   * @param {Object} params - Review parameters
   * @param {string} params.userId - User ID
   * @param {Array} params.results - Grading results
   */
  async reviewWrongAnswers(params) {
    const {
      userId,
      results,
      sessionId
    } = params;

    return this.request('/review', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        results,
        session_id: sessionId
      })
    });
  }

  /**
   * Get available quiz actions
   */
  async getActions() {
    return this.request('/actions', { method: 'GET' });
  }

  /**
   * Get available question types
   */
  async getQuestionTypes() {
    return this.request('/question_types', { method: 'GET' });
  }

  /**
   * Get available difficulty levels
   */
  async getDifficulties() {
    return this.request('/difficulties', { method: 'GET' });
  }

  /**
   * Invoke the quiz agent with custom action
   * @param {Object} params - Full request parameters
   */
  async invoke(params) {
    return this.request('', {
      method: 'POST',
      body: JSON.stringify({
        user_id: params.userId,
        action: params.action,
        topic: params.topic,
        content: params.content,
        question_count: params.questionCount,
        difficulty: params.difficulty,
        difficulty_mix: params.difficultyMix,
        question_types: params.questionTypes,
        topics: params.topics,
        questions: params.questions,
        answers: params.answers,
        results: params.results,
        question: params.question,
        user_answer: params.userAnswer,
        time_taken_seconds: params.timeTakenSeconds,
        session_id: params.sessionId
      })
    });
  }
}

// Export singleton instance
const quizAgentService = new QuizAgentService();
export default quizAgentService;

// Also export the class for testing
export { QuizAgentService };
