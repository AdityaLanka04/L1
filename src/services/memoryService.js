/**
 * Memory Service
 * Frontend service for interacting with the Agent Memory System API
 * Provides access to unified context and learning summaries
 */

import { API_URL, getAuthToken } from '../config';

class MemoryService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/memory`;
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
   * Get unified context for a user (what agents use to understand the user)
   */
  async getContext(userId, query = '', sessionId = null) {
    try {
      let url = `${this.baseUrl}/context/${userId}?query=${encodeURIComponent(query)}`;
      if (sessionId) {
        url += `&session_id=${encodeURIComponent(sessionId)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get context: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get context error:', error);
      throw error;
    }
  }

  /**
   * Get a summary of user's learning journey
   */
  async getLearningSummary(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/summary/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get learning summary: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning summary error:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/stats/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get memory stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get memory stats error:', error);
      throw error;
    }
  }

  /**
   * Store an interaction in memory
   */
  async remember(userId, interactionType, data) {
    try {
      const response = await fetch(`${this.baseUrl}/remember`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          interaction_type: interactionType,
          data: data
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to remember interaction: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Remember interaction error:', error);
      throw error;
    }
  }

  /**
   * Remember a conversation
   */
  async rememberConversation(userId, userMessage, aiResponse, sessionId = 'default', topics = []) {
    return this.remember(userId, 'conversation', {
      user_message: userMessage,
      ai_response: aiResponse,
      session_id: sessionId,
      topics: topics
    });
  }

  /**
   * Remember a flashcard interaction
   */
  async rememberFlashcard(userId, flashcardId, front, back, correct) {
    return this.remember(userId, 'flashcard', {
      flashcard_id: flashcardId,
      front: front,
      back: back,
      correct: correct
    });
  }

  /**
   * Remember a quiz attempt
   */
  async rememberQuiz(userId, topic, score, questionsCount, wrongConcepts = []) {
    return this.remember(userId, 'quiz', {
      topic: topic,
      score: score,
      questions_count: questionsCount,
      wrong_concepts: wrongConcepts
    });
  }

  /**
   * Remember a note interaction
   */
  async rememberNote(userId, noteId, title, action = 'viewed', contentPreview = '') {
    return this.remember(userId, 'note', {
      note_id: noteId,
      title: title,
      action: action,
      content_preview: contentPreview
    });
  }
}

const memoryService = new MemoryService();
export default memoryService;
export { MemoryService };
