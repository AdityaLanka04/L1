/**
 * Chat Agent Service
 * Frontend service for interacting with the AI Chat Agent API
 * Provides intelligent tutoring with emotional intelligence and adaptive responses
 */

import { API_URL, getAuthToken } from '../config';

class ChatAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/chat`;
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
   * Send a message to the chat agent
   */
  async chat(userId, message, options = {}) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          message: message,
          session_id: options.sessionId || null,
          chat_mode: options.chatMode || null,
          response_style: options.responseStyle || null,
          context: options.context || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Chat agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat agent error:', error);
      throw error;
    }
  }

  /**
   * Get available chat modes
   */
  async getChatModes() {
    try {
      const response = await fetch(`${this.baseUrl}/modes`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get chat modes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get chat modes error:', error);
      throw error;
    }
  }

  /**
   * Get available response styles
   */
  async getResponseStyles() {
    try {
      const response = await fetch(`${this.baseUrl}/styles`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get response styles: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get response styles error:', error);
      throw error;
    }
  }

  /**
   * Analyze a message without generating a response
   */
  async analyzeMessage(message, context = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: message,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze message: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analyze message error:', error);
      throw error;
    }
  }

  /**
   * Chat with specific mode (convenience methods)
   */
  async tutoring(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'tutoring', sessionId });
  }

  async socratic(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'socratic', sessionId });
  }

  async explanation(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'explanation', sessionId });
  }

  async practice(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'practice', sessionId });
  }

  async review(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'review', sessionId });
  }

  async brainstorm(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'brainstorm', sessionId });
  }

  async debugging(userId, message, sessionId = null) {
    return this.chat(userId, message, { chatMode: 'debugging', sessionId });
  }
}

const chatAgentService = new ChatAgentService();
export default chatAgentService;
export { ChatAgentService };
