/**
 * Knowledge Graph Service
 * Frontend service for interacting with the Knowledge Graph API
 * Provides concept mastery tracking, learning paths, and knowledge gap detection
 */

import { API_URL, getAuthToken } from '../config';

class KnowledgeGraphService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/knowledge-graph`;
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
   * Get knowledge graph connection status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get KG status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get KG status error:', error);
      throw error;
    }
  }

  /**
   * Initialize a user in the knowledge graph
   */
  async initializeUser(userId, userData = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/initialize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData)
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize user: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Initialize user error:', error);
      throw error;
    }
  }

  /**
   * Record a concept interaction (for tracking mastery)
   */
  async recordConceptInteraction(userId, concept, correct, source = 'flashcard', difficulty = 0.5, responseTimeMs = null) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/concept-interaction`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          concept,
          correct,
          source,
          difficulty,
          response_time_ms: responseTimeMs
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to record interaction: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Record concept interaction error:', error);
      throw error;
    }
  }

  /**
   * Get all concept mastery data for a user
   */
  async getConceptMastery(userId, limit = 50) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/mastery?limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get mastery: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get concept mastery error:', error);
      throw error;
    }
  }

  /**
   * Get concepts where user needs improvement
   */
  async getWeakConcepts(userId, threshold = 0.5, limit = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/weak-concepts?threshold=${threshold}&limit=${limit}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get weak concepts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get weak concepts error:', error);
      throw error;
    }
  }

  /**
   * Get concepts where user excels
   */
  async getStrongConcepts(userId, threshold = 0.7, limit = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/strong-concepts?threshold=${threshold}&limit=${limit}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get strong concepts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get strong concepts error:', error);
      throw error;
    }
  }

  /**
   * Get mastery breakdown by domain/subject
   */
  async getDomainMastery(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/domain-mastery`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get domain mastery: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get domain mastery error:', error);
      throw error;
    }
  }

  /**
   * Get personalized learning path for a topic
   */
  async getLearningPath(userId, topic, maxConcepts = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/learning-path/${encodeURIComponent(topic)}?max_concepts=${maxConcepts}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get learning path: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning path error:', error);
      throw error;
    }
  }

  /**
   * Find knowledge gaps based on current knowledge
   */
  async getKnowledgeGaps(userId, limit = 10) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/knowledge-gaps?limit=${limit}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get knowledge gaps: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get knowledge gaps error:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive learning analytics
   */
  async getLearningAnalytics(userId, days = 30) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/analytics?days=${days}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning analytics error:', error);
      throw error;
    }
  }

  /**
   * Get recommended topics based on learning progress
   */
  async getRecommendedTopics(userId, limit = 5) {
    try {
      const response = await fetch(
        `${this.baseUrl}/user/${userId}/recommended-topics?limit=${limit}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get recommended topics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get recommended topics error:', error);
      throw error;
    }
  }

  /**
   * Add a concept with relationships to the knowledge graph
   */
  async addConcept(concept, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/concept`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          concept,
          domain: options.domain || null,
          description: options.description || null,
          difficulty: options.difficulty || 0.5,
          keywords: options.keywords || null,
          prerequisites: options.prerequisites || null,
          related_concepts: options.relatedConcepts || null,
          topic: options.topic || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add concept: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Add concept error:', error);
      throw error;
    }
  }

  /**
   * Get concepts related to a given concept
   */
  async getRelatedConcepts(concept, userId = null, limit = 10) {
    try {
      let url = `${this.baseUrl}/concept/${encodeURIComponent(concept)}/related?limit=${limit}`;
      if (userId) {
        url += `&user_id=${userId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get related concepts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get related concepts error:', error);
      throw error;
    }
  }
}

const knowledgeGraphService = new KnowledgeGraphService();
export default knowledgeGraphService;
export { KnowledgeGraphService };
