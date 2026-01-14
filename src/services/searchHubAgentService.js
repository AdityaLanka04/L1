/**
 * SearchHub Agent Service
 * Frontend service for interacting with the NLP-powered SearchHub Agent API
 * Provides natural language understanding for search and content creation
 */

import { API_URL, getAuthToken } from '../config';

class SearchHubAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/searchhub`;
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
   * Main search/command endpoint - understands natural language
   */
  async search(userId, query, options = {}) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query: query,
          session_id: options.sessionId || null,
          context: options.context || {}
        })
      });

      if (!response.ok) {
        throw new Error(`SearchHub request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('SearchHub search error:', error);
      throw error;
    }
  }

  /**
   * Create a note with AI-generated content
   */
  async createNote(userId, topic, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/create-note`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: topic,
          content: options.content || null,
          depth: options.depth || 'standard',
          tone: options.tone || 'professional'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create note: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create note error:', error);
      throw error;
    }
  }

  /**
   * Create flashcards with AI-generated content
   */
  async createFlashcards(userId, topic, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/create-flashcards`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: topic,
          count: options.count || 10,
          difficulty: options.difficulty || 'medium',
          content: options.content || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create flashcards error:', error);
      throw error;
    }
  }

  /**
   * Create questions with AI-generated content
   */
  async createQuestions(userId, topic, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/create-questions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: topic,
          count: options.count || 10,
          difficulty_mix: options.difficultyMix || { easy: 3, medium: 5, hard: 2 },
          content: options.content || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create questions error:', error);
      throw error;
    }
  }

  /**
   * Get an explanation for a topic
   */
  async explain(userId, topic, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/explain`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          topic: topic,
          depth: options.depth || 'standard'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get explanation: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Explain topic error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions based on query and user context
   */
  async getSuggestions(userId, query = '') {
    try {
      const response = await fetch(
        `${this.baseUrl}/suggestions?query=${encodeURIComponent(query)}&user_id=${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get suggestions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get suggestions error:', error);
      throw error;
    }
  }

  /**
   * Get available actions
   */
  async getActions() {
    try {
      const response = await fetch(`${this.baseUrl}/actions`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get actions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get actions error:', error);
      throw error;
    }
  }

  /**
   * Clear conversation context for a session
   */
  async clearContext(userId, sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/clear-context`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to clear context: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear context error:', error);
      throw error;
    }
  }
}

const searchHubAgentService = new SearchHubAgentService();
export default searchHubAgentService;
export { SearchHubAgentService };
