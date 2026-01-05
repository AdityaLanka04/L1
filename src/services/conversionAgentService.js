/**
 * Conversion Agent Service
 * Provides API calls to the agentic conversion system
 * Handles all content conversions between different formats
 */

import { API_URL } from '../config';

class ConversionAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/convert`;
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
   * Generic convert method
   */
  async convert(params) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          source_type: params.sourceType,
          source_ids: params.sourceIds,
          destination_type: params.destinationType,
          card_count: params.cardCount || 10,
          question_count: params.questionCount || 10,
          difficulty: params.difficulty || 'medium',
          format_style: params.formatStyle || 'structured',
          depth_level: params.depthLevel || 'standard',
          session_id: params.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Conversion request failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success,
        action: data.action,
        response: data.response,
        sourceType: data.source_type,
        destinationType: data.destination_type,
        result: data.result,
        executionTime: data.execution_time_ms,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('Conversion error:', error);
      throw error;
    }
  }


  /**
   * Convert notes to flashcards
   */
  async notesToFlashcards(userId, noteIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'notes',
      sourceIds: noteIds,
      destinationType: 'flashcards',
      cardCount: options.cardCount || 10,
      difficulty: options.difficulty || 'medium',
      depthLevel: options.depthLevel || 'standard',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert notes to questions
   */
  async notesToQuestions(userId, noteIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'notes',
      sourceIds: noteIds,
      destinationType: 'questions',
      questionCount: options.questionCount || 10,
      difficulty: options.difficulty || 'medium',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert flashcards to notes
   */
  async flashcardsToNotes(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'flashcards',
      sourceIds: setIds,
      destinationType: 'notes',
      formatStyle: options.formatStyle || 'structured',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert flashcards to questions
   */
  async flashcardsToQuestions(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'flashcards',
      sourceIds: setIds,
      destinationType: 'questions',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert questions to flashcards
   */
  async questionsToFlashcards(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'questions',
      sourceIds: setIds,
      destinationType: 'flashcards',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert questions to notes
   */
  async questionsToNotes(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'questions',
      sourceIds: setIds,
      destinationType: 'notes',
      formatStyle: options.formatStyle || 'structured',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert media transcripts to questions
   */
  async mediaToQuestions(userId, mediaIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'media',
      sourceIds: mediaIds,
      destinationType: 'questions',
      questionCount: options.questionCount || 10,
      sessionId: options.sessionId
    });
  }

  /**
   * Convert playlist to notes
   */
  async playlistToNotes(userId, playlistId, options = {}) {
    return this.convert({
      userId,
      sourceType: 'playlist',
      sourceIds: [playlistId],
      destinationType: 'notes',
      formatStyle: options.formatStyle || 'structured',
      depthLevel: options.depthLevel || 'standard',
      sessionId: options.sessionId
    });
  }

  /**
   * Convert playlist to flashcards
   */
  async playlistToFlashcards(userId, playlistId, options = {}) {
    return this.convert({
      userId,
      sourceType: 'playlist',
      sourceIds: [playlistId],
      destinationType: 'flashcards',
      cardCount: options.cardCount || 15,
      sessionId: options.sessionId
    });
  }

  /**
   * Convert chat sessions to notes
   */
  async chatToNotes(userId, sessionIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'chat',
      sourceIds: sessionIds,
      destinationType: 'notes',
      formatStyle: options.formatStyle || 'structured',
      sessionId: options.sessionId
    });
  }

  /**
   * Export flashcards to CSV
   */
  async exportFlashcardsCSV(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'flashcards',
      sourceIds: setIds,
      destinationType: 'csv',
      sessionId: options.sessionId
    });
  }

  /**
   * Export questions to PDF
   */
  async exportQuestionsPDF(userId, setIds, options = {}) {
    return this.convert({
      userId,
      sourceType: 'questions',
      sourceIds: setIds,
      destinationType: 'pdf',
      sessionId: options.sessionId
    });
  }

  /**
   * Get available conversion options
   */
  async getConversionOptions() {
    try {
      const response = await fetch(`${this.baseUrl}/options`, {
        headers: this.getHeaders()
      });
      if (!response.ok) throw new Error('Failed to get conversion options');
      return await response.json();
    } catch (error) {
      console.error('Error getting conversion options:', error);
      return { conversions: [], options: {} };
    }
  }

  /**
   * Download file from conversion result
   */
  downloadFile(content, filename) {
    const blob = new Blob([content], { 
      type: filename.endsWith('.csv') ? 'text/csv' : 'text/html' 
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

// Export singleton instance
const conversionAgentService = new ConversionAgentService();
export default conversionAgentService;

// Also export the class for testing
export { ConversionAgentService };
