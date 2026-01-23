/**
 * Question Bank Operations Service
 * Frontend service for interacting with the Question Bank API
 * Provides question generation, organization, search, and analysis
 */

import { API_URL, getAuthToken } from '../config';

class QuestionBankService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/question-bank`;
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
   * Generate questions using the Enhanced Question Bank Agent
   */
  async generateQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          action: params.action || 'generate',
          source_type: params.sourceType,
          source_id: params.sourceId || null,
          sources: params.sources || null,
          content: params.content || null,
          title: params.title || 'Generated Questions',
          question_count: params.questionCount || 10,
          question_types: params.questionTypes || ['multiple_choice'],
          difficulty_mix: params.difficultyMix || null,
          topics: params.topics || [],
          custom_prompt: params.customPrompt || '',
          reference_document_id: params.referenceDocumentId || null,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate questions error:', error);
      throw error;
    }
  }

  /**
   * Generate adaptive questions based on user weaknesses
   */
  async generateAdaptiveQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/adaptive`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          content: params.content || null,
          source_type: params.sourceType || 'custom',
          source_id: params.sourceId || null,
          question_count: params.questionCount || 10,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate adaptive questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate adaptive questions error:', error);
      throw error;
    }
  }

  /**
   * Search questions by criteria
   */
  async searchQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          query: params.query || '',
          topic: params.topic || null,
          difficulty: params.difficulty || null,
          question_types: params.questionTypes || null,
          tags: params.tags || [],
          limit: params.limit || 20,
          offset: params.offset || 0
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to search questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Search questions error:', error);
      throw error;
    }
  }

  /**
   * Organize questions into categories
   */
  async organizeQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/organize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds,
          organization_method: params.organizationMethod || 'topic', // 'topic', 'difficulty', 'type'
          custom_categories: params.customCategories || []
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to organize questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Organize questions error:', error);
      throw error;
    }
  }

  /**
   * Analyze question performance and patterns
   */
  async analyzeQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds || [],
          analysis_type: params.analysisType || 'comprehensive', // 'difficulty', 'topic', 'performance', 'comprehensive'
          include_user_data: params.includeUserData !== false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Analyze questions error:', error);
      throw error;
    }
  }

  /**
   * Get question recommendations
   */
  async getRecommendations(params) {
    try {
      const response = await fetch(`${this.baseUrl}/recommend`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          topic: params.topic || null,
          difficulty_preference: params.difficultyPreference || 'adaptive',
          question_types: params.questionTypes || null,
          learning_goals: params.learningGoals || [],
          previous_performance: params.previousPerformance || [],
          limit: params.limit || 10
        })
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

  /**
   * Categorize questions automatically
   */
  async categorizeQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/categorize`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds || [],
          categorization_method: params.categorizationMethod || 'auto', // 'auto', 'topic', 'difficulty', 'blooms_taxonomy'
          custom_categories: params.customCategories || []
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to categorize questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Categorize questions error:', error);
      throw error;
    }
  }

  /**
   * Assess user knowledge with diagnostic questions
   */
  async assessKnowledge(params) {
    try {
      const response = await fetch(`${this.baseUrl}/assess`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          topic: params.topic,
          assessment_type: params.assessmentType || 'diagnostic', // 'diagnostic', 'comprehensive', 'quick'
          question_count: params.questionCount || 10,
          time_limit: params.timeLimit || null,
          adaptive: params.adaptive !== false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to assess knowledge: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Assess knowledge error:', error);
      throw error;
    }
  }


}

export default new QuestionBankService();