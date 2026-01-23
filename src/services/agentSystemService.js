/**
 * Agent System Service
 * Frontend service for interacting with the Agent System API
 * Provides orchestration and status information for all agents
 */

import { API_URL, getAuthToken } from '../config';

class AgentSystemService {
  constructor() {
    this.baseUrl = `${API_URL}/agents`;
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
   * Get agent system status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get agent status error:', error);
      throw error;
    }
  }

  /**
   * Invoke the orchestrator with a user request
   */
  async invoke(userId, userInput, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/invoke`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          user_input: userInput,
          session_id: options.sessionId || null,
          attachments: options.attachments || [],
          context: options.context || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Agent invocation failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Agent invoke error:', error);
      throw error;
    }
  }

  /**
   * Classify user intent
   */
  async classifyIntent(userInput, context = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/classify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_input: userInput,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error(`Intent classification failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Classify intent error:', error);
      throw error;
    }
  }

  /**
   * Get list of available intents
   */
  async getIntents() {
    try {
      const response = await fetch(`${this.baseUrl}/intents`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get intents: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get intents error:', error);
      throw error;
    }
  }

  /**
   * Get list of available tools
   */
  async getTools() {
    try {
      const response = await fetch(`${this.baseUrl}/tools`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get tools: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get tools error:', error);
      throw error;
    }
  }

  /**
   * Check if agent system is healthy
   */
  async healthCheck() {
    try {
      const status = await this.getStatus();
      return {
        healthy: status.status === 'healthy',
        agents: status.agents || {},
        capabilities: status.capabilities || []
      };
    } catch (error) {
      console.error('Health check error:', error);
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

const agentSystemService = new AgentSystemService();
export default agentSystemService;
export { AgentSystemService };
