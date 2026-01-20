/**
 * Conversion Agent Service
 * Frontend service for interacting with the Conversion Agent API
 * Provides content conversion between formats (PDF, media, URL, etc.)
 */

import { API_URL, getAuthToken } from '../config';

class ConversionAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/conversion`;
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
   * Get headers for file upload
   */
  getFileHeaders() {
    const token = getAuthToken();
    return {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type for FormData - browser will set it with boundary
    };
  }

  /**
   * Generic invoke method for the conversion agent
   */
  async invoke(action, params) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          action: action,
          source_type: params.sourceType,
          source_data: params.sourceData,
          target_format: params.targetFormat || 'text',
          options: params.options || {},
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Conversion agent request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Conversion agent invoke error:', error);
      throw error;
    }
  }

  // ==================== PDF CONVERSION ====================

  /**
   * Convert PDF to text/notes
   */
  async convertPDF(userId, file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);
      formData.append('target_format', options.targetFormat || 'notes');
      
      if (options.sessionId) {
        formData.append('session_id', options.sessionId);
      }

      const response = await fetch(`${this.baseUrl}/pdf`, {
        method: 'POST',
        headers: this.getFileHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error(`PDF conversion failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert PDF error:', error);
      throw error;
    }
  }

  /**
   * Convert PDF to flashcards
   */
  async pdfToFlashcards(userId, file, options = {}) {
    return this.convertPDF(userId, file, { 
      ...options, 
      targetFormat: 'flashcards' 
    });
  }

  /**
   * Convert PDF to quiz
   */
  async pdfToQuiz(userId, file, options = {}) {
    return this.convertPDF(userId, file, { 
      ...options, 
      targetFormat: 'quiz' 
    });
  }

  /**
   * Convert PDF to summary
   */
  async pdfToSummary(userId, file, options = {}) {
    return this.convertPDF(userId, file, { 
      ...options, 
      targetFormat: 'summary' 
    });
  }

  // ==================== MEDIA CONVERSION ====================

  /**
   * Convert video/audio to text
   */
  async convertMedia(userId, file, options = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', userId);
      formData.append('target_format', options.targetFormat || 'transcript');
      
      if (options.sessionId) {
        formData.append('session_id', options.sessionId);
      }

      const response = await fetch(`${this.baseUrl}/media`, {
        method: 'POST',
        headers: this.getFileHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Media conversion failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert media error:', error);
      throw error;
    }
  }

  /**
   * Convert YouTube video to notes
   */
  async youtubeToNotes(userId, videoUrl, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/youtube`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          video_url: videoUrl,
          target_format: options.targetFormat || 'notes',
          session_id: options.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`YouTube conversion failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('YouTube to notes error:', error);
      throw error;
    }
  }

  /**
   * Convert YouTube video to flashcards
   */
  async youtubeToFlashcards(userId, videoUrl, options = {}) {
    return this.youtubeToNotes(userId, videoUrl, { 
      ...options, 
      targetFormat: 'flashcards' 
    });
  }

  /**
   * Convert YouTube video to quiz
   */
  async youtubeToQuiz(userId, videoUrl, options = {}) {
    return this.youtubeToNotes(userId, videoUrl, { 
      ...options, 
      targetFormat: 'quiz' 
    });
  }

  // ==================== URL/WEB CONVERSION ====================

  /**
   * Convert web page to notes
   */
  async urlToNotes(userId, url, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/url`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          url: url,
          target_format: options.targetFormat || 'notes',
          session_id: options.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`URL conversion failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('URL to notes error:', error);
      throw error;
    }
  }

  /**
   * Convert web page to flashcards
   */
  async urlToFlashcards(userId, url, options = {}) {
    return this.urlToNotes(userId, url, { 
      ...options, 
      targetFormat: 'flashcards' 
    });
  }

  /**
   * Convert web page to summary
   */
  async urlToSummary(userId, url, options = {}) {
    return this.urlToNotes(userId, url, { 
      ...options, 
      targetFormat: 'summary' 
    });
  }

  // ==================== TEXT CONVERSION ====================

  /**
   * Convert plain text to structured notes
   */
  async textToNotes(userId, text, options = {}) {
    return this.invoke('text_to_notes', {
      userId,
      sourceType: 'text',
      sourceData: text,
      targetFormat: 'notes',
      options,
      sessionId: options.sessionId
    });
  }

  /**
   * Convert text to flashcards
   */
  async textToFlashcards(userId, text, options = {}) {
    return this.invoke('text_to_flashcards', {
      userId,
      sourceType: 'text',
      sourceData: text,
      targetFormat: 'flashcards',
      options: {
        ...options,
        card_count: options.cardCount || 10,
        difficulty: options.difficulty || 'medium'
      },
      sessionId: options.sessionId
    });
  }

  /**
   * Convert text to quiz
   */
  async textToQuiz(userId, text, options = {}) {
    return this.invoke('text_to_quiz', {
      userId,
      sourceType: 'text',
      sourceData: text,
      targetFormat: 'quiz',
      options: {
        ...options,
        question_count: options.questionCount || 10,
        difficulty: options.difficulty || 'medium'
      },
      sessionId: options.sessionId
    });
  }

  // ==================== EXPORT CONVERSION ====================

  /**
   * Export notes to PDF
   */
  async exportToPDF(userId, content, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/export/pdf`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content: content,
          title: options.title || 'Export',
          format_options: options.formatOptions || {}
        })
      });

      if (!response.ok) {
        throw new Error(`PDF export failed: ${response.status}`);
      }

      // Return blob for download
      const blob = await response.blob();
      return {
        success: true,
        blob: blob,
        filename: options.filename || 'export.pdf'
      };
    } catch (error) {
      console.error('Export to PDF error:', error);
      throw error;
    }
  }

  /**
   * Export notes to CSV
   */
  async exportToCSV(userId, content, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/export/csv`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content: content,
          columns: options.columns || null
        })
      });

      if (!response.ok) {
        throw new Error(`CSV export failed: ${response.status}`);
      }

      const blob = await response.blob();
      return {
        success: true,
        blob: blob,
        filename: options.filename || 'export.csv'
      };
    } catch (error) {
      console.error('Export to CSV error:', error);
      throw error;
    }
  }

  /**
   * Export flashcards to Anki format
   */
  async exportToAnki(userId, flashcards, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/export/anki`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          flashcards: flashcards,
          deck_name: options.deckName || 'Brainwave Export'
        })
      });

      if (!response.ok) {
        throw new Error(`Anki export failed: ${response.status}`);
      }

      const blob = await response.blob();
      return {
        success: true,
        blob: blob,
        filename: options.filename || 'flashcards.apkg'
      };
    } catch (error) {
      console.error('Export to Anki error:', error);
      throw error;
    }
  }

  // ==================== BATCH CONVERSION ====================

  /**
   * Convert multiple files at once
   */
  async batchConvert(userId, files, targetFormat, options = {}) {
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('target_format', targetFormat);
      
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });

      if (options.sessionId) {
        formData.append('session_id', options.sessionId);
      }

      const response = await fetch(`${this.baseUrl}/batch`, {
        method: 'POST',
        headers: this.getFileHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Batch conversion failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Batch convert error:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get supported file types
   */
  async getSupportedTypes() {
    try {
      const response = await fetch(`${this.baseUrl}/supported-types`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get supported types: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get supported types error:', error);
      // Return defaults if API fails
      return {
        input: ['pdf', 'mp3', 'mp4', 'wav', 'txt', 'url', 'youtube'],
        output: ['notes', 'flashcards', 'quiz', 'summary', 'transcript']
      };
    }
  }

  /**
   * Get conversion status
   */
  async getStatus(conversionId) {
    try {
      const response = await fetch(`${this.baseUrl}/status/${conversionId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get conversion status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get conversion status error:', error);
      throw error;
    }
  }

  /**
   * Generic convert method used by ImportExportModal
   * Converts content between different formats
   */
  async convert({ userId, sourceType, sourceIds, destinationType, cardCount, questionCount, difficulty, formatStyle, depthLevel }) {
    try {
      const response = await fetch(`${this.baseUrl}/convert`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          action: 'convert',
          action_params: {
            source_type: sourceType,
            source_ids: sourceIds,
            destination_type: destinationType,
            card_count: cardCount || 10,
            question_count: questionCount || 10,
            difficulty: difficulty || 'medium',
            format_style: formatStyle || 'structured',
            depth_level: depthLevel || 'standard'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Conversion failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Return standardized response
      return {
        success: data.success !== false,
        result: data.response_data || data.result || data,
        response: data.response || data.final_response || 'Conversion completed'
      };
    } catch (error) {
      console.error('Convert error:', error);
      throw error;
    }
  }

  /**
   * Download helper for text/CSV content
   */
  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * Download helper for blob responses
   */
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

const conversionAgentService = new ConversionAgentService();
export default conversionAgentService;
export { ConversionAgentService };
