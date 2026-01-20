/**
 * Note Agent Service
 * Frontend service for interacting with the Note Agent API
 * Provides AI-powered note generation, improvement, and analysis
 */

import { API_URL, getAuthToken } from '../config';

class NoteAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/notes`;
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
   * Generic invoke method for the note agent
   */
  async invoke(action, params) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          action: action,
          content: params.content || null,
          topic: params.topic || null,
          tone: params.tone || 'professional',
          depth: params.depth || 'standard',
          context: params.context || null,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Note agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Note agent invoke error:', error);
      throw error;
    }
  }

  /**
   * Generate new note content on a topic
   */
  async generate(userId, topic, options = {}) {
    return this.invoke('generate', {
      userId,
      topic,
      tone: options.tone || 'professional',
      depth: options.depth || 'standard',
      context: options.context,
      sessionId: options.sessionId
    });
  }

  /**
   * Improve existing note content
   */
  async improve(userId, content, options = {}) {
    return this.invoke('improve', {
      userId,
      content,
      tone: options.tone || 'professional',
      sessionId: options.sessionId
    });
  }

  /**
   * Expand note content with more details
   */
  async expand(userId, content, options = {}) {
    return this.invoke('expand', {
      userId,
      content,
      depth: options.depth || 'detailed',
      context: options.context,
      sessionId: options.sessionId
    });
  }

  /**
   * Simplify note content
   */
  async simplify(userId, content, options = {}) {
    return this.invoke('simplify', {
      userId,
      content,
      depth: options.depth || 'basic',
      sessionId: options.sessionId
    });
  }

  /**
   * Summarize note content
   */
  async summarize(userId, content, options = {}) {
    return this.invoke('summarize', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Continue writing from existing content
   */
  async continue(userId, content, options = {}) {
    return this.invoke('continue', {
      userId,
      content,
      tone: options.tone || 'professional',
      sessionId: options.sessionId
    });
  }

  /**
   * Explain concepts in the note
   */
  async explain(userId, content, options = {}) {
    return this.invoke('explain', {
      userId,
      content,
      depth: options.depth || 'standard',
      sessionId: options.sessionId
    });
  }

  /**
   * Extract key points from content
   */
  async keyPoints(userId, content, options = {}) {
    return this.invoke('key_points', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Check grammar and spelling
   */
  async grammar(userId, content, options = {}) {
    return this.invoke('grammar', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Change tone of the content
   */
  async changeTone(userId, content, tone, options = {}) {
    return this.invoke('tone_change', {
      userId,
      content,
      tone,
      sessionId: options.sessionId
    });
  }

  /**
   * Generate outline from topic or content
   */
  async outline(userId, topicOrContent, options = {}) {
    return this.invoke('outline', {
      userId,
      topic: options.isTopic ? topicOrContent : null,
      content: options.isTopic ? null : topicOrContent,
      sessionId: options.sessionId
    });
  }

  /**
   * Organize and structure content
   */
  async organize(userId, content, options = {}) {
    return this.invoke('organize', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Analyze note content
   */
  async analyze(userId, content, options = {}) {
    return this.invoke('analyze', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Get suggestions for improving content
   */
  async suggest(userId, content, options = {}) {
    return this.invoke('suggest', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Explain code snippets in notes
   */
  async explainCode(userId, content, options = {}) {
    return this.invoke('code_explain', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Get available tones
   */
  async getTones() {
    try {
      const response = await fetch(`${this.baseUrl}/tones`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get tones: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get tones error:', error);
      // Return default tones if API fails
      return {
        tones: [
          { name: 'professional', description: 'Formal and business-like' },
          { name: 'casual', description: 'Relaxed and conversational' },
          { name: 'academic', description: 'Scholarly and precise' },
          { name: 'creative', description: 'Imaginative and expressive' },
          { name: 'technical', description: 'Detailed and specific' }
        ]
      };
    }
  }

  /**
   * Get available depth levels
   */
  async getDepthLevels() {
    try {
      const response = await fetch(`${this.baseUrl}/depths`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get depth levels: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get depth levels error:', error);
      // Return default depths if API fails
      return {
        depths: [
          { name: 'basic', description: 'Simple overview' },
          { name: 'standard', description: 'Balanced detail' },
          { name: 'detailed', description: 'Comprehensive coverage' },
          { name: 'expert', description: 'Advanced and thorough' }
        ]
      };
    }
  }
}

const noteAgentService = new NoteAgentService();
export default noteAgentService;
export { NoteAgentService };
