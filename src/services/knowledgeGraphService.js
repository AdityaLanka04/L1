/**
 * Knowledge Graph Service
 * Frontend service for interacting with the Knowledge Graph API
 * Provides concept relationships, mastery tracking, and learning paths
 */

import { API_URL, getAuthToken } from '../config';

class KnowledgeGraphService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/knowledge-graph`;
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

  // ==================== SYSTEM STATUS ====================

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

  // ==================== USER INITIALIZATION ====================

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

  // ==================== CONCEPT INTERACTIONS ====================

  /**
   * Record a concept interaction (study, review, etc.)
   */
  async recordConceptInteraction(userId, concept, interactionType, performance = null) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/concept-interaction`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          concept,
          interaction_type: interactionType, // 'study', 'review', 'quiz', 'flashcard'
          performance: performance // 0.0 - 1.0 or null
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

  // ==================== USER MASTERY ====================

  /**
   * Get all concept mastery data for a user
   */
  async getUserMastery(userId, limit = 50) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/mastery?limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user mastery: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user mastery error:', error);
      throw error;
    }
  }

  /**
   * Get user's weak concepts
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
   * Get user's strong concepts
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

  // ==================== LEARNING PATHS ====================

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
   * Find concepts user should learn based on current knowledge
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

  // ==================== ANALYTICS ====================

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
        throw new Error(`Failed to get learning analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning analytics error:', error);
      throw error;
    }
  }

  // ==================== CONCEPT MANAGEMENT ====================

  /**
   * Add a new concept to the knowledge graph
   */
  async addConcept(concept, domain = null, description = null, prerequisites = []) {
    try {
      const response = await fetch(`${this.baseUrl}/concept`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          concept,
          domain,
          description,
          prerequisites
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
   * Get related concepts
   */
  async getRelatedConcepts(concept, relationshipType = null, limit = 10) {
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (relationshipType) {
        params.append('relationship_type', relationshipType);
      }

      const response = await fetch(
        `${this.baseUrl}/concept/${encodeURIComponent(concept)}/related?${params}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get related concepts: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get related concepts error:', error);
      throw error;
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Record a flashcard review
   */
  async recordFlashcardReview(userId, concept, correct) {
    return this.recordConceptInteraction(
      userId,
      concept,
      'flashcard',
      correct ? 1.0 : 0.0
    );
  }

  /**
   * Record a quiz result
   */
  async recordQuizResult(userId, concept, score) {
    return this.recordConceptInteraction(
      userId,
      concept,
      'quiz',
      score
    );
  }

  /**
   * Record studying a concept
   */
  async recordStudy(userId, concept) {
    return this.recordConceptInteraction(
      userId,
      concept,
      'study',
      null
    );
  }

  /**
   * Get comprehensive user learning data
   */
  async getUserLearningData(userId) {
    try {
      const [mastery, weakConcepts, strongConcepts, domainMastery, gaps, recommendations, analytics] = 
        await Promise.all([
          this.getUserMastery(userId, 50).catch(() => null),
          this.getWeakConcepts(userId).catch(() => null),
          this.getStrongConcepts(userId).catch(() => null),
          this.getDomainMastery(userId).catch(() => null),
          this.getKnowledgeGaps(userId).catch(() => null),
          this.getRecommendedTopics(userId).catch(() => null),
          this.getLearningAnalytics(userId).catch(() => null)
        ]);

      return {
        mastery,
        weakConcepts,
        strongConcepts,
        domainMastery,
        knowledgeGaps: gaps,
        recommendedTopics: recommendations,
        analytics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get user learning data error:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await this.getStatus();
      return {
        healthy: status.connected === true,
        database: status.database || 'unknown',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('KG health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const knowledgeGraphService = new KnowledgeGraphService();
export default knowledgeGraphService;
export { KnowledgeGraphService };
