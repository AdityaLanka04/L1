/**
 * Slide Explorer Agent Service
 * Frontend service for interacting with the Slide Explorer Agent API
 */

import { API_URL, getAuthToken } from '../config';

class SlideExplorerAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/slide-explorer`;
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = getAuthToken();
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };

    try {
      console.log('📡 Slide Explorer Request:', url);
      const response = await fetch(url, { 
        ...defaultOptions, 
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        }
      });
      
      if (response.status === 401) {
        console.warn('🔒 Token expired');
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Session expired');
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Slide Explorer API Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract structured content from slides
   */
  async extractContent(params) {
    const { userId, slideContent, extractionType = 'full', sessionId } = params;

    return this.request('/extract', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        extraction_type: extractionType,
        session_id: sessionId
      })
    });
  }

  /**
   * Summarize slide content
   */
  async summarizeSlide(params) {
    const { userId, slideContent, sessionId } = params;

    return this.request('/summarize', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        session_id: sessionId
      })
    });
  }

  /**
   * Extract key points from slides
   */
  async extractKeyPoints(params) {
    const { userId, slideContent, sessionId } = params;

    return this.request('/key-points', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        session_id: sessionId
      })
    });
  }

  /**
   * Generate questions from slide content
   */
  async generateQuestions(params) {
    const { userId, slideContent, sessionId } = params;

    return this.request('/questions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        session_id: sessionId
      })
    });
  }

  /**
   * Extract and map concepts from slides
   */
  async extractConcepts(params) {
    const { userId, slideContent, sessionId } = params;

    return this.request('/concepts', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        session_id: sessionId
      })
    });
  }

  /**
   * Deep analysis of slide content
   */
  async analyzeSlide(params) {
    const { userId, slideContent, analysisDepth = 'standard', sessionId } = params;

    return this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        analysis_depth: analysisDepth,
        session_id: sessionId
      })
    });
  }

  /**
   * Link slide content to other learning materials
   */
  async linkContent(params) {
    const { userId, slideContent, sessionId } = params;

    return this.request('/link', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        slide_content: slideContent,
        session_id: sessionId
      })
    });
  }
}

const slideExplorerAgentService = new SlideExplorerAgentService();
export default slideExplorerAgentService;
export { SlideExplorerAgentService };
