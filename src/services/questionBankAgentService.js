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

  // ==================== AI ENHANCEMENT FEATURES ====================

  /**
   * Enhance a user prompt for better question generation
   */
  async enhancePrompt(prompt, contentSummary = '') {
    const response = await fetch(`${API_URL}/qb/enhance_prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        prompt,
        content_summary: contentSummary
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to enhance prompt');
    }

    return await response.json();
  }

  /**
   * Extract topics from document content
   */
  async extractTopics(userId, documentId = null, content = '') {
    const response = await fetch(`${API_URL}/qb/extract_topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        document_id: documentId,
        content
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to extract topics');
    }

    return await response.json();
  }

  /**
   * Score question quality
   */
  async scoreQuestions(questions) {
    const response = await fetch(`${API_URL}/qb/score_questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ questions })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to score questions');
    }

    return await response.json();
  }

  /**
   * Tag questions with Bloom's Taxonomy levels
   */
  async tagBloomTaxonomy(questions) {
    const response = await fetch(`${API_URL}/qb/tag_bloom_taxonomy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ questions })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to tag questions');
    }

    return await response.json();
  }

  /**
   * Check for duplicate questions
   */
  async checkDuplicates(userId, question, questionSetId = null) {
    const response = await fetch(`${API_URL}/qb/check_duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        question,
        question_set_id: questionSetId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to check duplicates');
    }

    return await response.json();
  }

  /**
   * Analyze user's weak areas
   */
  async analyzeWeaknesses(userId) {
    const response = await fetch(`${API_URL}/qb/analyze_weaknesses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ user_id: userId })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to analyze weaknesses');
    }

    return await response.json();
  }

  /**
   * Generate adaptive questions targeting weak areas
   * Uses the new Agent-based endpoint that integrates with Master Agent
   */
  async generateAdaptive(userId, documentIds, questionCount = 10) {
    // Try the new agent endpoint first
    try {
      return await this.request('/adaptive', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          content: '', // Will be fetched from sources
          source_type: 'custom',
          question_count: questionCount,
        })
      });
    } catch (e) {
      // Fallback to legacy endpoint
      const response = await fetch(`${API_URL}/qb/generate_adaptive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          user_id: userId,
          document_ids: documentIds,
          question_count: questionCount
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to generate adaptive questions');
      }

      return await response.json();
    }
  }

  /**
   * Generate questions using the new agentic pipeline
   * This uses the enhanced agent with:
   * - Content analysis
   * - Question blueprint creation
   * - Master Agent integration for user context
   */
  async generateWithAgent(params) {
    const { 
      userId, 
      content, 
      title, 
      questionCount, 
      questionTypes,
      difficultyMix, 
      topics,
      customPrompt,
      sourceType = 'custom',
      sourceId = null,
      sources = []
    } = params;

    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        action: 'generate',
        source_type: sourceType,
        source_id: sourceId,
        sources: sources,
        content: content || '',
        title: title || 'Generated Questions',
        question_count: questionCount || 10,
        question_types: questionTypes || ['multiple_choice'],
        difficulty_mix: difficultyMix || { easy: 30, medium: 50, hard: 20 },
        topics: topics || [],
        custom_prompt: customPrompt || ''
      })
    });
  }

  /**
   * Enhance question explanations
   */
  async enhanceExplanations(questions) {
    const response = await fetch(`${API_URL}/qb/enhance_explanations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ questions })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to enhance explanations');
    }

    return await response.json();
  }

  /**
   * Regenerate a single question with feedback
   */
  async regenerateQuestion(userId, question, feedback, documentId = null) {
    const response = await fetch(`${API_URL}/qb/regenerate_question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        question,
        feedback,
        document_id: documentId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to regenerate question');
    }

    return await response.json();
  }

  /**
   * Preview generate questions (not saved)
   */
  async previewGenerate(params) {
    const { 
      userId, sourceIds, questionCount, difficultyMix, 
      questionTypes, topics, customPrompt 
    } = params;

    const response = await fetch(`${API_URL}/qb/preview_generate`, {
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
        question_types: questionTypes || ['multiple_choice', 'true_false', 'short_answer'],
        topics,
        custom_prompt: customPrompt
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to preview generate');
    }

    return await response.json();
  }

  /**
   * Save previewed questions after review
   */
  async savePreviewedQuestions(userId, questions, title, description = '', sourceType = 'preview') {
    const response = await fetch(`${API_URL}/qb/save_previewed_questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        questions,
        title,
        description,
        source_type: sourceType
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to save questions');
    }

    return await response.json();
  }

  /**
   * Batch delete multiple question sets
   */
  async batchDelete(userId, setIds) {
    const response = await fetch(`${API_URL}/qb/batch_delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        set_ids: setIds
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to delete question sets');
    }

    return await response.json();
  }

  /**
   * Merge multiple question sets into one
   */
  async mergeSets(userId, setIds, title, deleteOriginals = false) {
    const response = await fetch(`${API_URL}/qb/merge_sets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        set_ids: setIds,
        title,
        delete_originals: deleteOriginals
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to merge question sets');
    }

    return await response.json();
  }

  // ==================== WEAK AREAS TRACKING ====================

  /**
   * Get user's weak areas sorted by priority
   */
  async getWeakAreas(userId) {
    const response = await fetch(`${API_URL}/qb/weak_areas?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to get weak areas');
    }

    return await response.json();
  }

  /**
   * Get wrong answer history for review
   */
  async getWrongAnswers(userId, topic = null, limit = 50) {
    let url = `${API_URL}/qb/wrong_answers?user_id=${encodeURIComponent(userId)}&limit=${limit}`;
    if (topic) {
      url += `&topic=${encodeURIComponent(topic)}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to get wrong answers');
    }

    return await response.json();
  }

  /**
   * Mark a wrong answer as reviewed
   */
  async markWrongAnswerReviewed(wrongAnswerId, understood = true) {
    const response = await fetch(`${API_URL}/qb/mark_reviewed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        wrong_answer_id: wrongAnswerId,
        understood
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to mark as reviewed');
    }

    return await response.json();
  }

  /**
   * Generate practice questions focused on weak areas
   */
  async generatePractice(userId, topic = null, questionCount = 10, includeReview = true) {
    const response = await fetch(`${API_URL}/qb/generate_practice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        user_id: userId,
        topic,
        question_count: questionCount,
        include_review: includeReview
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to generate practice questions');
    }

    return await response.json();
  }

  /**
   * Get AI-powered practice recommendations
   */
  async getPracticeRecommendations(userId) {
    const response = await fetch(`${API_URL}/qb/practice_recommendations?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to get recommendations');
    }

    return await response.json();
  }

  /**
   * Reset a weak area (mark as mastered or delete)
   */
  async resetWeakArea(weakAreaId, action = 'mastered') {
    const response = await fetch(`${API_URL}/qb/reset_weak_area`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({
        weak_area_id: weakAreaId,
        action
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Failed to reset weak area');
    }

    return await response.json();
  }
}

const questionBankAgentService = new QuestionBankAgentService();
export default questionBankAgentService;
export { QuestionBankAgentService };
