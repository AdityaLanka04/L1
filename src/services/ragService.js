/**
 * RAG (Retrieval-Augmented Generation) Service
 * Frontend service for interacting with the Advanced RAG System
 * Provides semantic search, context retrieval, and learning context
 */

import { API_URL } from '../config';

const API_BASE_URL = API_URL;

class RAGService {
  /**
   * Search across user's content with advanced RAG
   */
  async search(query, options = {}) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: query,
        user_id: options.userId || null,
        mode: options.mode || 'agentic',
        top_k: options.topK || 10,
        use_cache: options.useCache !== false,
        context: options.context || null
      })
    });

    if (!response.ok) {
      throw new Error(`RAG search failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get formatted context string for a query
   */
  async getContext(query, maxLength = 2000) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(
      `${API_BASE_URL}/agents/rag/context?query=${encodeURIComponent(query)}&max_length=${maxLength}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Get context failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get comprehensive learning context
   */
  async getLearningContext(query) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(
      `${API_BASE_URL}/agents/rag/learning-context?query=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Get learning context failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Index user content for retrieval
   */
  async indexContent(contentType, items) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content_type: contentType,
        items: items
      })
    });

    if (!response.ok) {
      throw new Error(`Index content failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get RAG system statistics
   */
  async getStats() {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Get stats failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Clear RAG result cache
   */
  async clearCache() {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/clear-cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Clear cache failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get available search modes
   */
  async getSearchModes() {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/search-modes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Get search modes failed: ${response.status}`);
    }

    return await response.json();
  }

  // ==================== User-Specific RAG ====================

  /**
   * Index content for a specific user
   */
  async indexUserContent(userId, contentType, items) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/user/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        content_type: contentType,
        items: items
      })
    });

    if (!response.ok) {
      throw new Error(`Index user content failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Retrieve from user's personal RAG
   */
  async retrieveUserContent(userId, query, options = {}) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/user/retrieve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        query: query,
        top_k: options.topK || 10,
        content_types: options.contentTypes || null
      })
    });

    if (!response.ok) {
      throw new Error(`Retrieve user content failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Submit feedback on retrieved content
   */
  async submitFeedback(userId, query, retrievedItems, feedback) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/user/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
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
      throw new Error(`Submit feedback failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Auto-index user's recent activity
   */
  async autoIndexUserActivity(userId) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/user/auto-index/${userId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Auto-index failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get user RAG statistics
   */
  async getUserStats(userId) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/agents/rag/user/stats/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Get user stats failed: ${response.status}`);
    }

    return await response.json();
  }
}

const ragService = new RAGService();
export default ragService;
export { RAGService };
