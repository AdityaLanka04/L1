/**
 * Memory Management Service
 * Frontend service for interacting with the Memory API
 * Provides user memory context, summaries, and statistics
 */

import { API_URL, getAuthToken } from '../config';

class MemoryService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/memory`;
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
   * Get user memory context
   */
  async getUserContext(userId, limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/context/${userId}?limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user context: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user context error:', error);
      throw error;
    }
  }

  /**
   * Get user memory summary
   */
  async getUserSummary(userId, days = 30) {
    try {
      const response = await fetch(`${this.baseUrl}/summary/${userId}?days=${days}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user summary: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user summary error:', error);
      throw error;
    }
  }

  /**
   * Get user memory statistics
   */
  async getUserStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/stats/${userId}`, {
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
   * Store something to remember
   */
  async remember(userId, content, type = 'note', metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/remember`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content,
          type,
          metadata,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to remember: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Remember error:', error);
      throw error;
    }
  }

  /**
   * Search user memories
   */
  async searchMemories(userId, query, limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          query,
          limit
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to search memories: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Search memories error:', error);
      throw error;
    }
  }

  /**
   * Update memory importance
   */
  async updateMemoryImportance(memoryId, importance) {
    try {
      const response = await fetch(`${this.baseUrl}/importance/${memoryId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ importance })
      });

      if (!response.ok) {
        throw new Error(`Failed to update importance: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update importance error:', error);
      throw error;
    }
  }

  /**
   * Get memory insights
   */
  async getMemoryInsights(userId, days = 7) {
    try {
      const response = await fetch(`${this.baseUrl}/insights/${userId}?days=${days}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get insights: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get insights error:', error);
      throw error;
    }
  }

  /**
   * Consolidate user memories
   */
  async consolidateMemories(userId, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/consolidate/${userId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`Failed to consolidate: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Consolidate error:', error);
      throw error;
    }
  }

  /**
   * Get memory timeline
   */
  async getMemoryTimeline(userId, startDate = null, endDate = null) {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(`${this.baseUrl}/timeline/${userId}?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get timeline: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get timeline error:', error);
      throw error;
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId) {
    try {
      const response = await fetch(`${this.baseUrl}/memory/${memoryId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Delete memory error:', error);
      throw error;
    }
  }

  /**
   * Get memory patterns
   */
  async getMemoryPatterns(userId, patternType = 'study') {
    try {
      const response = await fetch(`${this.baseUrl}/patterns/${userId}?type=${patternType}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get patterns: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get patterns error:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        healthy: data.status === 'healthy',
        database: data.database || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Memory service health check failed:', error);
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