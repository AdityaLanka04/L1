/**
 * Advanced Analytics Service
 * Frontend service for comprehensive learning analytics and insights
 * Provides detailed analytics, progress tracking, and performance metrics
 */

import { API_URL, getAuthToken } from '../config';

class AnalyticsService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/analytics`;
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
   * Get comprehensive user learning analytics
   */
  async getUserAnalytics(userId, timeRange = '30d') {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}?time_range=${timeRange}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get user analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get user analytics error:', error);
      throw error;
    }
  }

  /**
   * Get learning performance metrics
   */
  async getPerformanceMetrics(userId, metricType = 'all') {
    try {
      const response = await fetch(`${this.baseUrl}/performance/${userId}?type=${metricType}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get performance metrics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get performance metrics error:', error);
      throw error;
    }
  }

  /**
   * Get study session analytics
   */
  async getStudySessionAnalytics(userId, sessionId = null) {
    try {
      const url = sessionId 
        ? `${this.baseUrl}/sessions/${userId}/${sessionId}`
        : `${this.baseUrl}/sessions/${userId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get study session analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get study session analytics error:', error);
      throw error;
    }
  }

  /**
   * Get content engagement analytics
   */
  async getContentAnalytics(userId, contentType = 'all') {
    try {
      const response = await fetch(`${this.baseUrl}/content/${userId}?type=${contentType}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get content analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get content analytics error:', error);
      throw error;
    }
  }

  /**
   * Get learning progress trends
   */
  async getProgressTrends(userId, timeRange = '90d', granularity = 'daily') {
    try {
      const response = await fetch(
        `${this.baseUrl}/trends/${userId}?time_range=${timeRange}&granularity=${granularity}`,
        {
          method: 'GET',
          headers: this.getHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get progress trends: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get progress trends error:', error);
      throw error;
    }
  }

  /**
   * Get topic mastery analytics
   */
  async getTopicMastery(userId, topic = null) {
    try {
      const url = topic 
        ? `${this.baseUrl}/mastery/${userId}/${encodeURIComponent(topic)}`
        : `${this.baseUrl}/mastery/${userId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get topic mastery: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get topic mastery error:', error);
      throw error;
    }
  }

  /**
   * Get learning efficiency insights
   */
  async getEfficiencyInsights(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/efficiency/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get efficiency insights: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get efficiency insights error:', error);
      throw error;
    }
  }

  /**
   * Generate custom analytics report
   */
  async generateReport(userId, reportConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/reports/${userId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          report_type: reportConfig.type || 'comprehensive',
          time_range: reportConfig.timeRange || '30d',
          metrics: reportConfig.metrics || ['all'],
          format: reportConfig.format || 'json',
          include_recommendations: reportConfig.includeRecommendations !== false,
          session_id: reportConfig.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate report: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate report error:', error);
      throw error;
    }
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${userId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get predictive analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get predictive analytics error:', error);
      throw error;
    }
  }

  /**
   * Get comparative analytics (class/group)
   */
  async getComparativeAnalytics(userId, groupId = null) {
    try {
      const url = groupId 
        ? `${this.baseUrl}/compare/${userId}?group_id=${groupId}`
        : `${this.baseUrl}/compare/${userId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get comparative analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get comparative analytics error:', error);
      throw error;
    }
  }

  /**
   * Get real-time analytics dashboard data
   */
  async getDashboardData(userId, dashboardType = 'personal') {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/${userId}?type=${dashboardType}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get dashboard data: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get dashboard data error:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(userId, exportConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/export/${userId}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          format: exportConfig.format || 'csv',
          data_types: exportConfig.dataTypes || ['all'],
          time_range: exportConfig.timeRange || '30d',
          include_metadata: exportConfig.includeMetadata !== false,
          anonymized: exportConfig.anonymized || false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to export analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Export analytics error:', error);
      throw error;
    }
  }

  /**
   * Get analytics health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Analytics service health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analytics health check error:', error);
      throw error;
    }
  }
}

export default new AnalyticsService();