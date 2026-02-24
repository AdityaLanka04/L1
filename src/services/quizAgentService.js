/**
 * Quiz Agent Service
 * Frontend service for interacting with the Quiz Agent API
 */

import { API_URL, getAuthToken } from '../config';

class QuizAgentService {
  constructor() {
    // Social routes are at /api directly, not /api/social
    this.baseUrl = `${API_URL}`;
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
      sessionId,
      use_hs_context
    } = params;

    // Create the quiz
    const createResponse = await this.request('/create_solo_quiz', {
      method: 'POST',
      body: JSON.stringify({
        subject: topic,
        difficulty: this._getDifficultyFromMix(difficultyMix),
        question_count: questionCount
      })
    });

    if (!createResponse.quiz_id) {
      return { success: false, questions: [] };
    }

    // Fetch the quiz with questions
    const quizResponse = await this.request(`/solo_quiz/${createResponse.quiz_id}`, {
      method: 'GET'
    });

    // Transform to expected format and include quiz_id
    return {
      success: true,
      questions: quizResponse.questions || [],
      quiz_id: createResponse.quiz_id,
      quiz: quizResponse.quiz
    };
  }

  _getDifficultyFromMix(mix) {
    // Convert difficulty mix to single difficulty level
    if (mix.hard >= mix.medium && mix.hard >= mix.easy) return 'hard';
    if (mix.medium >= mix.easy) return 'medium';
    return 'easy';
  }

  /**
   * Generate adaptive quiz questions based on user performance
   * @param {Object} params - Adaptive generation parameters
   */
  async generateAdaptiveQuiz(params) {
    // Adaptive quiz not implemented in backend yet, fall back to regular quiz
    return this.generateQuiz(params);
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

    // Calculate score
    let correctCount = 0;
    const results = questions.map((q, idx) => {
      const questionId = String(q.id ?? idx);
      const userAnswer = String(answers[questionId] || '').trim().toUpperCase();
      const correctAnswer = String(q.correct_answer || '').trim().toUpperCase();
      
      // Check if correct - handle both full answer and letter-only format
      let isCorrect = false;
      if (userAnswer === correctAnswer) {
        isCorrect = true;
      } else if (userAnswer.length === 1 && correctAnswer.startsWith(userAnswer)) {
        // User answered with just the letter (A, B, C, D)
        isCorrect = true;
      } else if (correctAnswer.length === 1 && userAnswer.startsWith(correctAnswer)) {
        // Correct answer is just a letter
        isCorrect = true;
      }
      
      if (isCorrect) correctCount++;
      
      return {
        question_text: q.question || q.question_text,
        user_answer: answers[questionId] || '',
        correct_answer: q.correct_answer,
        is_correct: isCorrect,
        explanation: q.explanation
      };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);

    // Get quiz_id from sessionStorage
    const quizData = JSON.parse(sessionStorage.getItem('quizData') || '{}');
    const quiz_id = quizData.quiz_id;

    if (quiz_id) {
      try {
        // Submit completion to backend
        await this.request('/complete_solo_quiz', {
          method: 'POST',
          body: JSON.stringify({
            quiz_id,
            score: percentage,
            answers: results
          })
        });
      } catch (error) {
        console.error('Failed to submit quiz completion:', error);
        // Continue even if submission fails
      }
    }

    return {
      success: true,
      total_questions: questions.length,
      correct_answers: correctCount,
      percentage,
      results
    };
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
