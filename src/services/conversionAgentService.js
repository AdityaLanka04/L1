/**
 * Advanced Conversion Agent Service
 * Frontend service for specialized content conversion endpoints
 * Provides comprehensive conversion between educational formats
 */

import { API_URL, getAuthToken } from '../config';

class ConversionAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/api/agents/convert`;
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