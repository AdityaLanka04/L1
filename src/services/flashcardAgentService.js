/**
 * Flashcard Agent Service
 * Frontend service for interacting with the Flashcard Agent API
 * Provides AI-powered flashcard generation, review, and analysis
 */

import { API_URL, getAuthToken } from '../config';

class FlashcardAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/flashcards`;
  }

  /**
   * Get headers with authentication
   */
  getHeaders() {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Generic invoke method for the flashcard agent
   */
  async invoke(action, params) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          action: action,
          topic: params.topic || null,
          content: params.content || null,
          card_count: params.cardCount || 10,
          difficulty: params.difficulty || 'medium',
          review_results: params.reviewResults || null,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Flashcard agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Flashcard agent invoke error:', error);
      throw error;
    }
  }

  /**
   * Generate flashcards from topic or content
   */
  async generate(userId, topic, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: topic,
          content: options.content || null,
          card_count: options.cardCount || 10,
          difficulty: options.difficulty || 'medium',
          session_id: options.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate flashcards error:', error);
      throw error;
    }
  }

  /**
   * Process a review session and get spaced repetition updates
   */
  async review(userId, reviewResults, sessionId = null) {
    try {
      const response = await fetch(`${this.baseUrl}/review`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          review_results: reviewResults,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to process review: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Review flashcards error:', error);
      throw error;
    }
  }

  /**
   * Analyze flashcard performance for a user
   */
  async analyze(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze?user_id=${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analyze flashcards error:', error);
      throw error;
    }
  }

  /**
   * Get study recommendations for a user
   */
  async getRecommendations(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/recommendations?user_id=${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get recommendations: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get recommendations error:', error);
      throw error;
    }
  }

  /**
   * Get an explanation for a flashcard concept
   */
  async explain(userId, concept, sessionId = null) {
    try {
      const response = await fetch(`${this.baseUrl}/explain`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          concept: concept,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get explanation: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Explain concept error:', error);
      throw error;
    }
  }
}

const flashcardAgentService = new FlashcardAgentService();
export default flashcardAgentService;
export { FlashcardAgentService };
