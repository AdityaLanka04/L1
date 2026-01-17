/**
 * RAG Service
 * Frontend service for interacting with the Advanced RAG System API
 * Provides semantic search, content retrieval, and learning context
 */

import { API_URL, getAuthToken } from '../config';

class RAGService {
  constructor() {
    this.baseUrl = `${API_URL}/api/rag`;
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

  // ==================== GLOBAL RAG ENDPOINTS ====================

  /**
   * Main retrieval endpoint - supports all search modes
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<object>} Search results
   */
  async retrieve(query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/retrieve`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: query,
          mode: options.mode || 'agentic', // semantic, keyword, hybrid, graph, agentic
          top_k: options.topK || 10,
          user_id: options.userId || null,
          use_cache: options.useCache !== false,
          context: options.context || {}
        })
      });

      if (!response.ok) {
        throw new Error(`RAG retrieval failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('RAG retrieve error:', error);
      throw error;
    }
  }

  /**
   * Get learning context with graph integration
   * Combines RAG retrieval with knowledge graph context
   */
  async getLearningContext(userId, query) {
    try {
      const response = await fetch(`${this.baseUrl}/learning-context`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query: query
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get learning context: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning context error:', error);
      throw error;
    }
  }

  /**
   * Get formatted context string for LLM prompts
   */
  async getContextString(query, userId = null, maxLength = 2000) {
    try {
      const params = new URLSearchParams({
        query: query,
        max_length: maxLength
      });
      
      if (userId) {
        params.append('user_id', userId);
      }

      const response = await fetch(`${this.baseUrl}/context?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get context string: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get context string error:', error);
      throw error;
    }
  }

  /**
   * Get RAG system statistics
   */
  async getStats() {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get RAG stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get RAG stats error:', error);
      throw error;
    }
  }

  /**
   * Clear the RAG result cache
   */
  async clearCache() {
    try {
      const response = await fetch(`${this.baseUrl}/clear-cache`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to clear cache: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear cache error:', error);
      throw error;
    }
  }

  /**
   * Get available search modes
   */
  async getSearchModes() {
    try {
      const response = await fetch(`${this.baseUrl}/search-modes`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get search modes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get search modes error:', error);
      throw error;
    }
  }

  // ==================== USER-SPECIFIC RAG ENDPOINTS ====================

  /**
   * Search user's personal content
   * Retrieves from user's indexed notes, flashcards, chats, and questions
   */
  async searchUserContent(userId, query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/user/retrieve`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query: query,
          top_k: options.topK || 10,
          content_types: options.contentTypes || null // ['note', 'flashcard', 'chat', 'question_bank']
        })
      });

      if (!response.ok) {
        throw new Error(`User content search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Search user content error:', error);
      throw error;
    }
  }

  /**
   * Get user's RAG statistics
   * Shows indexed items, retrieval count, preferences, etc.
   */
  async getUserStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/stats/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user stats: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Manually trigger content indexing for a user
   * Indexes recent notes, flashcards, chats, and questions
   */
  async indexUserContent(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/auto-index/${userId}`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to index content: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Index user content error:', error);
      throw error;
    }
  }

  /**
   * Submit feedback on retrieved content
   * Helps the system learn user preferences
   */
  async submitFeedback(userId, query, retrievedItems, feedback) {
    try {
      const response = await fetch(`${this.baseUrl}/user/feedback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query: query,
          retrieved_items: retrievedItems,
          relevant_items: feedback.relevantItems || null,
          needed_more_context: feedback.neededMoreContext || false,
          too_much_context: feedback.tooMuchContext || false,
          helpful_content_types: feedback.helpfulContentTypes || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit feedback: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Submit feedback error:', error);
      throw error;
    }
  }

  /**
   * Clear all RAG data for a user (GDPR compliance)
   */
  async clearUserData(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/clear/${userId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to clear user data: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Clear user data error:', error);
      throw error;
    }
  }

  // ==================== AUTO-INDEXER ENDPOINTS ====================

  /**
   * Get auto-indexer status
   */
  async getAutoIndexerStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/auto-indexer/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get auto-indexer status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get auto-indexer status error:', error);
      throw error;
    }
  }

  /**
   * Start the auto-indexer
   */
  async startAutoIndexer() {
    try {
      const response = await fetch(`${this.baseUrl}/auto-indexer/start`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to start auto-indexer: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Start auto-indexer error:', error);
      throw error;
    }
  }

  /**
   * Stop the auto-indexer
   */
  async stopAutoIndexer() {
    try {
      const response = await fetch(`${this.baseUrl}/auto-indexer/stop`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to stop auto-indexer: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Stop auto-indexer error:', error);
      throw error;
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Semantic search (meaning-based)
   */
  async semanticSearch(query, userId = null, topK = 10) {
    return this.retrieve(query, { mode: 'semantic', userId, topK });
  }

  /**
   * Keyword search (exact match)
   */
  async keywordSearch(query, userId = null, topK = 10) {
    return this.retrieve(query, { mode: 'keyword', userId, topK });
  }

  /**
   * Hybrid search (semantic + keyword)
   */
  async hybridSearch(query, userId = null, topK = 10) {
    return this.retrieve(query, { mode: 'hybrid', userId, topK });
  }

  /**
   * Graph search (knowledge graph traversal)
   */
  async graphSearch(query, userId = null, topK = 10) {
    return this.retrieve(query, { mode: 'graph', userId, topK });
  }

  /**
   * Agentic search (AI decides best strategy) - RECOMMENDED
   */
  async agenticSearch(query, userId = null, topK = 10, context = {}) {
    return this.retrieve(query, { mode: 'agentic', userId, topK, context });
  }

  /**
   * Find similar content to a given text
   */
  async findSimilar(content, userId = null, topK = 5) {
    return this.searchUserContent(userId, content, { topK });
  }

  /**
   * Get recommendations based on user's weak areas
   */
  async getRecommendations(userId, topic = null) {
    const context = topic ? { topics_of_interest: [topic] } : {};
    return this.agenticSearch('recommend study materials', userId, 10, context);
  }

  /**
   * Search across specific content types
   */
  async searchByType(userId, query, contentTypes, topK = 10) {
    return this.searchUserContent(userId, query, { topK, contentTypes });
  }

  /**
   * Search only notes
   */
  async searchNotes(userId, query, topK = 10) {
    return this.searchByType(userId, query, ['note'], topK);
  }

  /**
   * Search only flashcards
   */
  async searchFlashcards(userId, query, topK = 10) {
    return this.searchByType(userId, query, ['flashcard'], topK);
  }

  /**
   * Search only chats
   */
  async searchChats(userId, query, topK = 10) {
    return this.searchByType(userId, query, ['chat'], topK);
  }

  /**
   * Search only question banks
   */
  async searchQuestions(userId, query, topK = 10) {
    return this.searchByType(userId, query, ['question_bank'], topK);
  }

  /**
   * Get comprehensive user RAG info
   */
  async getUserRAGInfo(userId) {
    try {
      const [stats, indexerStatus] = await Promise.all([
        this.getUserStats(userId).catch(() => null),
        this.getAutoIndexerStatus().catch(() => null)
      ]);

      return {
        stats,
        indexerStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get user RAG info error:', error);
      throw error;
    }
  }

  /**
   * Health check - verify RAG system is working
   */
  async healthCheck() {
    try {
      const stats = await this.getStats();
      return {
        healthy: stats.status === 'healthy',
        rerankerAvailable: stats.reranker_available,
        graphRagAvailable: stats.graph_rag_available,
        cacheSize: stats.cache_size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('RAG health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const ragService = new RAGService();
export default ragService;
export { RAGService };
