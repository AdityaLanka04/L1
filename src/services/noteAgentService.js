/**
 * Note Agent Service
 * Provides API calls to the agentic note system
 */

import { API_URL } from '../config';

class NoteAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/notes`;
  }

  /**
   * Get auth headers
   */
  getHeaders() {
    const token = localStorage.getItem('token');
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
          content: params.content,
          topic: params.topic,
          tone: params.tone || 'professional',
          depth: params.depth || 'standard',
          context: params.context,
          session_id: params.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Note agent request failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        content: data.content,
        response: data.response,
        analysis: data.analysis,
        suggestions: data.suggestions,
        concepts: data.concepts,
        wordCount: data.word_count,
        metadata: data.metadata
      };
    } catch (error) {
            throw error;
    }
  }

  /**
   * Generate new content from a topic
   */
  async generate(userId, topic, options = {}) {
    return this.invoke('generate', {
      userId,
      topic,
      tone: options.tone,
      depth: options.depth,
      context: options.context,
      sessionId: options.sessionId
    });
  }

  /**
   * Improve existing text
   */
  async improve(userId, content, options = {}) {
    return this.invoke('improve', {
      userId,
      content,
      tone: options.tone,
      sessionId: options.sessionId
    });
  }

  /**
   * Expand text with more details
   */
  async expand(userId, content, options = {}) {
    return this.invoke('expand', {
      userId,
      content,
      tone: options.tone,
      depth: options.depth,
      sessionId: options.sessionId
    });
  }

  /**
   * Simplify complex text
   */
  async simplify(userId, content, options = {}) {
    return this.invoke('simplify', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Summarize content
   */
  async summarize(userId, content, options = {}) {
    return this.invoke('summarize', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Continue writing from where text ends
   */
  async continue(userId, content, options = {}) {
    return this.invoke('continue', {
      userId,
      content,
      tone: options.tone,
      sessionId: options.sessionId
    });
  }

  /**
   * Explain a concept
   */
  async explain(userId, topic, options = {}) {
    return this.invoke('explain', {
      userId,
      topic,
      tone: options.tone,
      depth: options.depth,
      context: options.context,
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
   * Fix grammar and spelling
   */
  async grammar(userId, content, options = {}) {
    return this.invoke('grammar', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Change the writing tone
   */
  async toneChange(userId, content, tone, options = {}) {
    return this.invoke('tone_change', {
      userId,
      content,
      tone,
      sessionId: options.sessionId
    });
  }

  /**
   * Create an outline for a topic
   */
  async outline(userId, topic, options = {}) {
    return this.invoke('outline', {
      userId,
      topic,
      depth: options.depth,
      context: options.context,
      sessionId: options.sessionId
    });
  }

  /**
   * Organize and restructure content
   */
  async organize(userId, content, options = {}) {
    return this.invoke('organize', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Analyze content for insights
   */
  async analyze(userId, content, options = {}) {
    return this.invoke('analyze', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Get improvement suggestions
   */
  async suggest(userId, content, options = {}) {
    return this.invoke('suggest', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Explain code snippets
   */
  async codeExplain(userId, content, options = {}) {
    return this.invoke('code_explain', {
      userId,
      content,
      sessionId: options.sessionId
    });
  }

  /**
   * Get available actions
   */
  async getActions() {
    try {
      const response = await fetch(`${this.baseUrl}/actions`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to get actions');
      return await response.json();
    } catch (error) {
            return { actions: [] };
    }
  }

  /**
   * Get available tones
   */
  async getTones() {
    try {
      const response = await fetch(`${this.baseUrl}/tones`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to get tones');
      return await response.json();
    } catch (error) {
            return { tones: [] };
    }
  }

  /**
   * Get available depth levels
   */
  async getDepths() {
    try {
      const response = await fetch(`${this.baseUrl}/depths`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to get depths');
      return await response.json();
    } catch (error) {
            return { depths: [] };
    }
  }
}

// Export singleton instance
const noteAgentService = new NoteAgentService();
export default noteAgentService;

// Also export the class for testing
export { NoteAgentService };
