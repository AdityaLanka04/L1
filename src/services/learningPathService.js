/**
 * Learning Path Service
 * Frontend service for interacting with Learning Paths API
 */

import { API_URL, getAuthToken } from '../config';

class LearningPathService {
  constructor() {
    this.baseUrl = `${API_URL}/learning-paths`;
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
   * Generate a new learning path
   */
  async generatePath(topicPrompt, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          topicPrompt,
          difficulty: options.difficulty || 'intermediate',
          length: options.length || 'medium',
          goals: options.goals || []
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate learning path');
      }

      return await response.json();
    } catch (error) {
      console.error('Generate path error:', error);
      throw error;
    }
  }

  /**
   * Get all learning paths for current user
   */
  async getPaths() {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch learning paths');
      }

      return await response.json();
    } catch (error) {
      console.error('Get paths error:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific path
   */
  async getPath(pathId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch learning path');
      }

      return await response.json();
    } catch (error) {
      console.error('Get path error:', error);
      throw error;
    }
  }

  /**
   * Get all nodes for a path
   */
  async getPathNodes(pathId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch path nodes');
      }

      return await response.json();
    } catch (error) {
      console.error('Get path nodes error:', error);
      throw error;
    }
  }

  /**
   * Start a node
   */
  async startNode(pathId, nodeId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes/${nodeId}/start`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start node');
      }

      return await response.json();
    } catch (error) {
      console.error('Start node error:', error);
      throw error;
    }
  }

  /**
   * Complete a node
   */
  async completeNode(pathId, nodeId, evidence = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes/${nodeId}/complete`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ evidence })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to complete node');
      }

      return await response.json();
    } catch (error) {
      console.error('Complete node error:', error);
      throw error;
    }
  }

  /**
   * Evaluate node completion requirements
   */
  async evaluateNode(pathId, nodeId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes/${nodeId}/evaluate`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to evaluate node');
      }

      return await response.json();
    } catch (error) {
      console.error('Evaluate node error:', error);
      throw error;
    }
  }

  /**
   * Update progress for a specific activity
   */
  async updateNodeProgress(pathId, nodeId, activityType, completed, metadata = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes/${nodeId}/progress`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          activity_type: activityType,
          completed,
          metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update progress');
      }

      return await response.json();
    } catch (error) {
      console.error('Update progress error:', error);
      throw error;
    }
  }

  /**
   * Get overall path progress
   */
  async getPathProgress(pathId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/progress`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch path progress');
      }

      return await response.json();
    } catch (error) {
      console.error('Get path progress error:', error);
      throw error;
    }
  }

  /**
   * Delete (archive) a learning path
   */
  async deletePath(pathId) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete learning path');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete path error:', error);
      throw error;
    }
  }

  /**
   * Generate content for a node activity (notes, flashcards, quiz, chat)
   */
  async generateNodeContent(pathId, nodeId, activityType, count = null) {
    try {
      const response = await fetch(`${this.baseUrl}/${pathId}/nodes/${nodeId}/generate-content`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          activity_type: activityType,
          count
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate content');
      }

      return await response.json();
    } catch (error) {
      console.error('Generate content error:', error);
      throw error;
    }
  }
}

export default new LearningPathService();
