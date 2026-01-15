/**
 * Question Bank Agent Service
 * Frontend service for interacting with the Question Bank Agent API
 */

import { API_URL, getAuthToken } from '../config';

class QuestionBankAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/question-bank`;
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
      console.log('📡 Question Bank Request:', url);
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
        console.error('📋 Full error response:', error);
        
        // Handle validation errors
        if (error.detail && Array.isArray(error.detail)) {
          const validationErrors = error.detail.map(e => `${e.loc?.join('.')} - ${e.msg}`).join('; ');
          console.error('📋 Validation errors:', validationErrors);
          throw new Error(`Validation error: ${validationErrors}`);
        }
        
        const errorMsg = error.detail || error.message || JSON.stringify(error) || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`❌ Question Bank API Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate questions from PDF document
   */
  async generateFromPDF(params) {
    const { userId, sourceId, questionCount, difficultyMix, sessionId } = params;

    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        action: 'generate',
        source_type: 'pdf',
        source_id: sourceId,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        session_id: sessionId
      })
    });
  }

  /**
   * Generate questions from multiple PDF documents (NotebookLM style)
   */
  async generateFromMultiplePDFs(params) {
    const { userId, sourceIds, questionCount, difficultyMix, title, questionTypes, topics } = params;

    const response = await fetch(`${API_URL}/qb/generate_from_multiple_pdfs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        source_ids: sourceIds,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        title: title,
        question_types: questionTypes || ['multiple_choice', 'true_false', 'short_answer'],
        topics: topics
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to generate questions');
    }

    return await response.json();
  }

  /**
   * Smart question generation with custom prompts and reference documents
   * Use cases:
   * - "Generate questions like these sample questions from my textbook"
   * - "Create easy questions focusing on chapter 3 topics"
   * - "Make questions similar to last year's exam from this study material"
   */
  async smartGenerate(params) {
    const { 
      userId, 
      sourceIds, 
      questionCount, 
      difficultyMix, 
      title, 
      questionTypes, 
      topics,
      customPrompt,
      referenceDocumentId,
      contentDocumentIds
    } = params;

    const response = await fetch(`${API_URL}/qb/smart_generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        source_ids: sourceIds,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        title: title,
        question_types: questionTypes || ['multiple_choice', 'true_false', 'short_answer'],
        topics: topics,
        custom_prompt: customPrompt,
        reference_document_id: referenceDocumentId,
        content_document_ids: contentDocumentIds
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to generate questions');
    }

    return await response.json();
  }

  /**
   * Delete an uploaded PDF document
   */
  async deleteDocument(userId, documentId) {
    const response = await fetch(`${API_URL}/qb/delete_document/${documentId}?user_id=${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to delete document');
    }

    return await response.json();
  }

  /**
   * Generate questions from chat sessions and slides
   */
  async generateFromSources(params) {
    const { userId, sources, questionCount, difficultyMix, sessionId } = params;

    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        action: 'generate',
        source_type: 'multiple',
        sources: sources,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        session_id: sessionId
      })
    });
  }

  /**
   * Generate questions from custom content
   */
  async generateFromCustom(params) {
    const { userId, content, title, questionCount, difficultyMix, sessionId } = params;

    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        action: 'generate',
        source_type: 'custom',
        content: content,
        title: title,
        question_count: questionCount,
        difficulty_mix: difficultyMix,
        session_id: sessionId
      })
    });
  }

  /**
   * Search questions in the question bank
   */
  async searchQuestions(params) {
    const { userId, searchQuery, filters = {}, sessionId } = params;

    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        search_query: searchQuery,
        filters,
        session_id: sessionId
      })
    });
  }

  /**
   * Organize questions into logical groups
   */
  async organizeQuestions(params) {
    const { userId, questions, sessionId } = params;

    return this.request('/organize', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        questions,
        session_id: sessionId
      })
    });
  }

  /**
   * Analyze performance on questions
   */
  async analyzePerformance(params) {
    const { userId, performanceData, sessionId } = params;

    return this.request('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        performance_data: performanceData,
        session_id: sessionId
      })
    });
  }

  /**
   * Get recommendations for question review
   */
  async getRecommendations(params) {
    const { userId, performanceData, sessionId } = params;

    return this.request('/recommend', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        performance_data: performanceData,
        session_id: sessionId
      })
    });
  }

  /**
   * Categorize questions by topic and concept
   */
  async categorizeQuestions(params) {
    const { userId, questions, sessionId } = params;

    return this.request('/categorize', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        questions,
        session_id: sessionId
      })
    });
  }

  /**
   * Assess and validate question difficulty levels
   */
  async assessDifficulty(params) {
    const { userId, questions, sessionId } = params;

    return this.request('/assess', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        questions,
        session_id: sessionId
      })
    });
  }
}

const questionBankAgentService = new QuestionBankAgentService();
export default questionBankAgentService;
export { QuestionBankAgentService };
