

import { API_URL, getAuthToken } from '../config';

class MasterAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/master`;
  }

  
  getHeaders() {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  
  async invoke(userId, action = 'get_full_context', sessionId = null) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          action: action,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Master agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Master agent invoke error:', error);
      throw error;
    }
  }

  
  async getUserProfile(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/profile/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user profile: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  
  async getWeakTopics(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/weak-topics/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get weak topics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get weak topics error:', error);
      throw error;
    }
  }

  
  async getStrongTopics(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/strong-topics/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get strong topics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get strong topics error:', error);
      throw error;
    }
  }

  
  async getLearningInsights(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/insights/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get learning insights: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get learning insights error:', error);
      throw error;
    }
  }

  
  async getRecommendations(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/recommendations/${userId}`, {
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

  
  async getDashboard(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get dashboard: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get dashboard error:', error);
      throw error;
    }
  }

  
  async getComprehensiveLearningData(userId) {
    try {
      const [profile, weakTopics, strongTopics, insights, recommendations] = await Promise.all([
        this.getUserProfile(userId).catch(() => null),
        this.getWeakTopics(userId).catch(() => null),
        this.getStrongTopics(userId).catch(() => null),
        this.getLearningInsights(userId).catch(() => null),
        this.getRecommendations(userId).catch(() => null)
      ]);

      return {
        profile,
        weakTopics,
        strongTopics,
        insights,
        recommendations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get comprehensive learning data error:', error);
      throw error;
    }
  }
}

const masterAgentService = new MasterAgentService();
export default masterAgentService;
export { MasterAgentService };
