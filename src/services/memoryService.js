/**
 * Memory Service
 * Frontend service for interacting with the Enhanced Memory System API
 * Provides episodic, semantic, and procedural memory management
 */

import { API_URL, getAuthToken } from '../config';

class MemoryService {
  constructor() {
    this.baseUrl = `${API_URL}/api/memory`;
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

  // ==================== MEMORY STORAGE ====================

  /**
   * Store a new memory
   */
  async store(userId, content, memoryType, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/store`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content: content,
          memory_type: memoryType, // conversation, flashcard, quiz, note, learning_event
          tags: options.tags || [],
          metadata: options.metadata || {},
          importance: options.importance || 0.5,
          session_id: options.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to store memory: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Store memory error:', error);
      throw error;
    }
  }

  /**
   * Recall memories based on query
   */
  async recall(userId, query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/recall`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query: query,
          memory_types: options.memoryTypes || null,
          limit: options.limit || 10,
          min_relevance: options.minRelevance || 0.5,
          time_range: options.timeRange || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to recall memories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Recall memory error:', error);
      throw error;
    }
  }

  /**
   * Get context for an agent
   */
  async getContext(userId, agentType, query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/context`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          agent_type: agentType,
          query: query,
          session_id: options.sessionId || null
        })
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

  // ==================== CONVERSATION MEMORY ====================

  /**
   * Remember a conversation
   */
  async rememberConversation(userId, userMessage, aiResponse, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/conversation`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          user_message: userMessage,
          ai_response: aiResponse,
          session_id: options.sessionId || null,
          agent_type: options.agentType || 'chat',
          topics: options.topics || []
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to remember conversation: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Remember conversation error:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId, options = {}) {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        limit: options.limit || 20
      });

      if (options.sessionId) {
        params.append('session_id', options.sessionId);
      }

      const response = await fetch(`${this.baseUrl}/conversations?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get conversation history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get conversation history error:', error);
      throw error;
    }
  }

  // ==================== LEARNING EVENTS ====================

  /**
   * Record a learning event
   */
  async recordLearningEvent(userId, eventType, eventData, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/learning-event`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          event_type: eventType, // flashcard_review, quiz_completed, note_created, etc.
          event_data: eventData,
          topics: options.topics || [],
          performance: options.performance || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to record learning event: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Record learning event error:', error);
      throw error;
    }
  }

  /**
   * Get learning history
   */
  async getLearningHistory(userId, options = {}) {
    try {
      const params = new URLSearchParams({
        user_id: userId,
        limit: options.limit || 50
      });

      if (options.eventType) {
        params.append('event_type', options.eventType);
      }

      if (options.startDate) {
        params.append('start_date', options.startDate);
      }

      if (options.endDate) {
        params.append('end_date', options.endDate);
      }

      const response = await fetch(`${this.baseUrl}/learning-history?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get learning history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning history error:', error);
      throw error;
    }
  }

  // ==================== USER PREFERENCES ====================

  /**
   * Learn from user interaction
   */
  async learnFromInteraction(userId, interactionData) {
    try {
      const response = await fetch(`${this.baseUrl}/learn`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          interaction_data: interactionData
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to learn from interaction: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Learn from interaction error:', error);
      throw error;
    }
  }

  /**
   * Get learned user preferences
   */
  async getUserPreferences(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/preferences/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user preferences: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user preferences error:', error);
      throw error;
    }
  }

  // ==================== MEMORY STATISTICS ====================

  /**
   * Get memory statistics for a user
   */
  async getStats(userId) {
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
   * Get memory system status
   */
  async getSystemStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get system status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get system status error:', error);
      throw error;
    }
  }

  // ==================== MEMORY MANAGEMENT ====================

  /**
   * Consolidate memories (move short-term to long-term)
   */
  async consolidate(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/consolidate/${userId}`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to consolidate memories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Consolidate memories error:', error);
      throw error;
    }
  }

  /**
   * Forget old or irrelevant memories
   */
  async forget(userId, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/forget/${userId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          older_than_days: options.olderThanDays || 90,
          min_importance: options.minImportance || 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to forget memories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Forget memories error:', error);
      throw error;
    }
  }

  /**
   * Clear all memories for a user (GDPR compliance)
   */
  async clearAll(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/clear/${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to clear memories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear memories error:', error);
      throw error;
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Store conversation memory
   */
  async storeConversation(userId, userMessage, aiResponse, topics = [], sessionId = null) {
    return this.store(userId, `User: ${userMessage}\nAI: ${aiResponse}`, 'conversation', {
      tags: topics,
      metadata: { user_message: userMessage, ai_response: aiResponse },
      sessionId
    });
  }

  /**
   * Store flashcard review memory
   */
  async storeFlashcardReview(userId, cardId, correct, concept, sessionId = null) {
    return this.store(userId, `Reviewed flashcard: ${concept}`, 'flashcard', {
      tags: [concept],
      metadata: { card_id: cardId, correct, concept },
      importance: correct ? 0.3 : 0.7, // Wrong answers are more important to remember
      sessionId
    });
  }

  /**
   * Store quiz result memory
   */
  async storeQuizResult(userId, quizId, score, topics = [], sessionId = null) {
    return this.store(userId, `Completed quiz with score: ${score}`, 'quiz', {
      tags: topics,
      metadata: { quiz_id: quizId, score },
      importance: score < 0.6 ? 0.8 : 0.5, // Low scores are more important
      sessionId
    });
  }

  /**
   * Store note creation memory
   */
  async storeNoteCreation(userId, noteId, title, topics = [], sessionId = null) {
    return this.store(userId, `Created note: ${title}`, 'note', {
      tags: topics,
      metadata: { note_id: noteId, title },
      importance: 0.4,
      sessionId
    });
  }

  /**
   * Get recent memories
   */
  async getRecent(userId, limit = 20) {
    return this.recall(userId, '', { limit, minRelevance: 0 });
  }

  /**
   * Search memories by topic
   */
  async searchByTopic(userId, topic, limit = 10) {
    return this.recall(userId, topic, { limit });
  }

  /**
   * Get memories by type
   */
  async getByType(userId, memoryType, limit = 20) {
    return this.recall(userId, '', { memoryTypes: [memoryType], limit, minRelevance: 0 });
  }

  /**
   * Get conversation memories
   */
  async getConversations(userId, limit = 20) {
    return this.getByType(userId, 'conversation', limit);
  }

  /**
   * Get flashcard memories
   */
  async getFlashcards(userId, limit = 20) {
    return this.getByType(userId, 'flashcard', limit);
  }

  /**
   * Get quiz memories
   */
  async getQuizzes(userId, limit = 20) {
    return this.getByType(userId, 'quiz', limit);
  }

  /**
   * Get note memories
   */
  async getNotes(userId, limit = 20) {
    return this.getByType(userId, 'note', limit);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await this.getSystemStatus();
      return {
        healthy: status.status === 'healthy',
        memoryCount: status.total_memories || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Memory health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const memoryService = new MemoryService();
export default memoryService;
export { MemoryService };
