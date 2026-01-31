/**
 * Advanced Conversion Agent Service
 * Frontend service for specialized content conversion endpoints
 * Provides comprehensive conversion between educational formats
 */

import { API_URL, getAuthToken } from '../config';

class ConversionAgentService {
  constructor() {
    // API_URL already includes /api, so just add the agents/convert path
    this.baseUrl = `${API_URL}/agents/convert`;
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
   * Generic convert function for backward compatibility
   * Routes to appropriate conversion method based on sourceType and targetType
   */
  async convert(params) {
    const { 
      sourceType, 
      targetType, 
      destinationType, // Alternative name for targetType
      userId, 
      content, 
      sourceIds,
      options = {} 
    } = params;

    // Use targetType or destinationType (for backward compatibility)
    const target = targetType || destinationType;

    if (!target) {
      throw new Error('targetType or destinationType is required');
    }

    // Merge options with top-level params
    const mergedOptions = {
      ...options,
      cardCount: params.cardCount || options.cardCount,
      questionCount: params.questionCount || options.questionCount,
      difficulty: params.difficulty || options.difficulty,
      noteIds: sourceIds || options.noteIds || [],
      flashcardIds: sourceIds || options.flashcardIds || [],
      questionIds: sourceIds || options.questionIds || [],
      formatStyle: params.formatStyle || options.formatStyle,
      depthLevel: params.depthLevel || options.depthLevel
    };

    // Route to appropriate conversion method
    if (sourceType === 'notes' && target === 'flashcards') {
      return this.convertNotesToFlashcards({
        userId,
        notesContent: content,
        noteIds: mergedOptions.noteIds,
        cardCount: mergedOptions.cardCount || 10,
        difficulty: mergedOptions.difficulty || 'medium',
        includeDefinitions: mergedOptions.includeDefinitions,
        includeExamples: mergedOptions.includeExamples,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'notes' && target === 'questions') {
      return this.convertNotesToQuestions({
        userId,
        notesContent: content,
        noteIds: mergedOptions.noteIds,
        questionCount: mergedOptions.questionCount || 5,
        questionTypes: mergedOptions.questionTypes || ['multiple_choice'],
        difficulty: mergedOptions.difficulty || 'medium',
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'flashcards' && target === 'notes') {
      return this.convertFlashcardsToNotes({
        userId,
        flashcardIds: mergedOptions.flashcardIds,
        noteFormat: mergedOptions.noteFormat || 'structured',
        includeExamples: mergedOptions.includeExamples,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'flashcards' && target === 'questions') {
      return this.convertFlashcardsToQuestions({
        userId,
        flashcardIds: mergedOptions.flashcardIds,
        questionCount: mergedOptions.questionCount || 5,
        questionTypes: mergedOptions.questionTypes || ['multiple_choice'],
        difficulty: mergedOptions.difficulty || 'medium',
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'questions' && target === 'flashcards') {
      return this.convertQuestionsToFlashcards({
        userId,
        questionIds: mergedOptions.questionIds,
        cardCount: mergedOptions.cardCount || 10,
        includeAnswers: mergedOptions.includeAnswers,
        includeExplanations: mergedOptions.includeExplanations,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'questions' && target === 'notes') {
      return this.convertQuestionsToNotes({
        userId,
        questionIds: mergedOptions.questionIds,
        noteFormat: mergedOptions.noteFormat || 'study_guide',
        includeAnswers: mergedOptions.includeAnswers,
        includeExplanations: mergedOptions.includeExplanations,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'chat' && target === 'notes') {
      return this.convertChatToNotes({
        userId,
        chatHistory: content,
        chatId: mergedOptions.chatId,
        noteFormat: mergedOptions.noteFormat || 'summary',
        includeQuestions: mergedOptions.includeQuestions,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'playlist' && target === 'notes') {
      return this.convertPlaylistToNotes({
        userId,
        playlistUrl: content,
        playlistItems: mergedOptions.playlistItems || [],
        noteFormat: mergedOptions.noteFormat || 'structured',
        includeTimestamps: mergedOptions.includeTimestamps,
        sessionId: mergedOptions.sessionId
      });
    }

    if (sourceType === 'playlist' && target === 'flashcards') {
      return this.convertPlaylistToFlashcards({
        userId,
        playlistUrl: content,
        playlistItems: mergedOptions.playlistItems || [],
        cardCount: mergedOptions.cardCount || 10,
        difficulty: mergedOptions.difficulty || 'medium',
        includeDefinitions: mergedOptions.includeDefinitions,
        sessionId: mergedOptions.sessionId
      });
    }

    // Handle export formats
    if (target === 'csv' && sourceType === 'flashcards') {
      return this.exportFlashcardsToCSV({
        userId,
        flashcardIds: mergedOptions.flashcardIds,
        includeMetadata: mergedOptions.includeMetadata,
        delimiter: mergedOptions.delimiter,
        sessionId: mergedOptions.sessionId
      });
    }

    if (target === 'pdf' && sourceType === 'questions') {
      return this.exportQuestionsToPDF({
        userId,
        questionIds: mergedOptions.questionIds,
        includeAnswers: mergedOptions.includeAnswers,
        includeExplanations: mergedOptions.includeExplanations,
        title: mergedOptions.title,
        format: mergedOptions.format,
        sessionId: mergedOptions.sessionId
      });
    }

    throw new Error(`Unsupported conversion: ${sourceType} to ${target}`);
  }

  /**
   * Convert notes to flashcards
   */
  async convertNotesToFlashcards(params) {
    try {
      const response = await fetch(`${this.baseUrl}/notes-to-flashcards`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          notes_content: params.notesContent,
          note_ids: params.noteIds || [],
          card_count: params.cardCount || 10,
          difficulty: params.difficulty || 'medium',
          include_definitions: params.includeDefinitions !== false,
          include_examples: params.includeExamples !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert notes to flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert notes to flashcards error:', error);
      throw error;
    }
  }

  /**
   * Convert notes to questions
   */
  async convertNotesToQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/notes-to-questions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          notes_content: params.notesContent,
          note_ids: params.noteIds || [],
          question_count: params.questionCount || 5,
          question_types: params.questionTypes || ['multiple_choice', 'short_answer'],
          difficulty: params.difficulty || 'medium',
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert notes to questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert notes to questions error:', error);
      throw error;
    }
  }

  /**
   * Convert flashcards to notes
   */
  async convertFlashcardsToNotes(params) {
    try {
      const response = await fetch(`${this.baseUrl}/flashcards-to-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          flashcard_ids: params.flashcardIds || [],
          note_format: params.noteFormat || 'structured', // 'structured', 'summary', 'detailed'
          include_examples: params.includeExamples !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert flashcards to notes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert flashcards to notes error:', error);
      throw error;
    }
  }

  /**
   * Convert flashcards to questions
   */
  async convertFlashcardsToQuestions(params) {
    try {
      const response = await fetch(`${this.baseUrl}/flashcards-to-questions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          flashcard_ids: params.flashcardIds || [],
          question_count: params.questionCount || 5,
          question_types: params.questionTypes || ['multiple_choice'],
          difficulty: params.difficulty || 'medium',
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert flashcards to questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert flashcards to questions error:', error);
      throw error;
    }
  }

  /**
   * Convert questions to flashcards
   */
  async convertQuestionsToFlashcards(params) {
    try {
      const response = await fetch(`${this.baseUrl}/questions-to-flashcards`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds || [],
          card_count: params.cardCount || 10,
          include_answers: params.includeAnswers !== false,
          include_explanations: params.includeExplanations !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert questions to flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert questions to flashcards error:', error);
      throw error;
    }
  }

  /**
   * Convert questions to notes
   */
  async convertQuestionsToNotes(params) {
    try {
      const response = await fetch(`${this.baseUrl}/questions-to-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds || [],
          note_format: params.noteFormat || 'study_guide', // 'study_guide', 'summary', 'detailed'
          include_answers: params.includeAnswers !== false,
          include_explanations: params.includeExplanations !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert questions to notes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert questions to notes error:', error);
      throw error;
    }
  }

  /**
   * Convert media to questions (video, audio, images)
   */
  async convertMediaToQuestions(params) {
    try {
      const formData = new FormData();
      formData.append('user_id', params.userId);
      formData.append('media_type', params.mediaType); // 'video', 'audio', 'image'
      formData.append('question_count', params.questionCount || 5);
      formData.append('question_types', JSON.stringify(params.questionTypes || ['multiple_choice']));
      formData.append('difficulty', params.difficulty || 'medium');
      
      if (params.mediaFile) {
        formData.append('media_file', params.mediaFile);
      }
      if (params.mediaUrl) {
        formData.append('media_url', params.mediaUrl);
      }
      if (params.sessionId) {
        formData.append('session_id', params.sessionId);
      }

      const response = await fetch(`${this.baseUrl}/media-to-questions`, {
        method: 'POST',
        headers: this.getFileHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to convert media to questions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert media to questions error:', error);
      throw error;
    }
  }

  /**
   * Convert playlist to notes (YouTube playlists, etc.)
   */
  async convertPlaylistToNotes(params) {
    try {
      const response = await fetch(`${this.baseUrl}/playlist-to-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          playlist_url: params.playlistUrl,
          playlist_items: params.playlistItems || [],
          note_format: params.noteFormat || 'structured', // 'structured', 'summary', 'detailed'
          include_timestamps: params.includeTimestamps !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert playlist to notes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert playlist to notes error:', error);
      throw error;
    }
  }

  /**
   * Convert playlist to flashcards
   */
  async convertPlaylistToFlashcards(params) {
    try {
      const response = await fetch(`${this.baseUrl}/playlist-to-flashcards`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          playlist_url: params.playlistUrl,
          playlist_items: params.playlistItems || [],
          card_count: params.cardCount || 10,
          difficulty: params.difficulty || 'medium',
          include_definitions: params.includeDefinitions !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert playlist to flashcards: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert playlist to flashcards error:', error);
      throw error;
    }
  }

  /**
   * Convert chat conversation to notes
   */
  async convertChatToNotes(params) {
    try {
      const response = await fetch(`${this.baseUrl}/chat-to-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          chat_history: params.chatHistory,
          chat_id: params.chatId || null,
          note_format: params.noteFormat || 'summary', // 'summary', 'detailed', 'key_points'
          include_questions: params.includeQuestions !== false,
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to convert chat to notes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Convert chat to notes error:', error);
      throw error;
    }
  }

  /**
   * Helper method: Convert chat sessions to notes (backward compatibility)
   * @param {string} userId - User ID
   * @param {Array} sessionIds - Array of chat session IDs
   * @param {Object} options - Conversion options
   */
  async chatToNotes(userId, sessionIds, options = {}) {
    try {
      // Call the backend endpoint directly with session IDs
      const response = await fetch(`${this.baseUrl}/chat-to-notes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          session_ids: sessionIds,
          format_style: options.formatStyle || 'structured',
          session_id: options.sessionId || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to convert chat to notes: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat to notes helper error:', error);
      throw error;
    }
  }

  /**
   * Export flashcards to CSV format
   */
  async exportFlashcardsToCSV(params) {
    try {
      const response = await fetch(`${this.baseUrl}/export-flashcards-csv`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          flashcard_ids: params.flashcardIds || [],
          include_metadata: params.includeMetadata !== false,
          delimiter: params.delimiter || ',',
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to export flashcards to CSV: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Export flashcards to CSV error:', error);
      throw error;
    }
  }

  /**
   * Export questions to PDF format
   */
  async exportQuestionsToPDF(params) {
    try {
      const response = await fetch(`${this.baseUrl}/export-questions-pdf`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: params.userId,
          question_ids: params.questionIds || [],
          include_answers: params.includeAnswers !== false,
          include_explanations: params.includeExplanations !== false,
          title: params.title || 'Question Bank Export',
          format: params.format || 'standard', // 'standard', 'compact', 'detailed'
          session_id: params.sessionId || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to export questions to PDF: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Export questions to PDF error:', error);
      throw error;
    }
  }
}

export default new ConversionAgentService();