/**
 * Real-time Collaboration Service
 * Frontend service for collaborative learning features
 * Provides real-time study sessions, shared workspaces, and collaborative tools
 */

import { API_URL, getAuthToken } from '../config';

class CollaborationService {
  constructor() {
    this.baseUrl = `${API_URL}/agents/collaboration`;
    this.wsConnection = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
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
   * Create a new collaborative study session
   */
  async createStudySession(sessionConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: sessionConfig.name,
          description: sessionConfig.description,
          topic: sessionConfig.topic,
          max_participants: sessionConfig.maxParticipants || 10,
          session_type: sessionConfig.sessionType || 'study_group',
          privacy: sessionConfig.privacy || 'public',
          scheduled_start: sessionConfig.scheduledStart || null,
          duration_minutes: sessionConfig.durationMinutes || 60,
          features: sessionConfig.features || ['chat', 'whiteboard', 'screen_share'],
          user_id: sessionConfig.userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create study session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create study session error:', error);
      throw error;
    }
  }

  /**
   * Join an existing study session
   */
  async joinStudySession(sessionId, userId, joinData = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          role: joinData.role || 'participant',
          display_name: joinData.displayName || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to join study session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Join study session error:', error);
      throw error;
    }
  }

  /**
   * Get active study sessions
   */
  async getActiveSessions(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.topic) params.append('topic', filters.topic);
      if (filters.sessionType) params.append('session_type', filters.sessionType);
      if (filters.privacy) params.append('privacy', filters.privacy);
      if (filters.userId) params.append('user_id', filters.userId);

      const response = await fetch(`${this.baseUrl}/sessions?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get active sessions: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get active sessions error:', error);
      throw error;
    }
  }

  /**
   * Send collaborative whiteboard update
   */
  async updateWhiteboard(sessionId, userId, whiteboardData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/whiteboard`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          action: whiteboardData.action || 'update',
          content: whiteboardData.content,
          position: whiteboardData.position || null,
          tool: whiteboardData.tool || 'pen',
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update whiteboard: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update whiteboard error:', error);
      throw error;
    }
  }

  /**
   * Share screen or content
   */
  async shareContent(sessionId, userId, shareData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          share_type: shareData.shareType, // 'screen', 'window', 'tab', 'file'
          content_id: shareData.contentId || null,
          metadata: shareData.metadata || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to share content: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Share content error:', error);
      throw error;
    }
  }

  /**
   * Send collaborative chat message
   */
  async sendChatMessage(sessionId, userId, messageData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          message: messageData.message,
          message_type: messageData.messageType || 'text',
          parent_message_id: messageData.parentMessageId || null,
          metadata: messageData.metadata || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send chat message: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Send chat message error:', error);
      throw error;
    }
  }

  /**
   * Start collaborative quiz session
   */
  async startCollaborativeQuiz(sessionId, userId, quizConfig) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/quiz/start`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          quiz_id: quizConfig.quizId,
          question_timing: quizConfig.questionTiming || 'synchronous',
          show_leaderboard: quizConfig.showLeaderboard !== false,
          allow_collaboration: quizConfig.allowCollaboration !== false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start collaborative quiz: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Start collaborative quiz error:', error);
      throw error;
    }
  }

  /**
   * Submit collaborative quiz answer
   */
  async submitQuizAnswer(sessionId, userId, answerData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/quiz/answer`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          question_id: answerData.questionId,
          answer: answerData.answer,
          confidence: answerData.confidence || 0.5,
          time_spent: answerData.timeSpent || 0
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit quiz answer: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Submit quiz answer error:', error);
      throw error;
    }
  }

  /**
   * Create collaborative document
   */
  async createCollaborativeDocument(sessionId, userId, documentData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/documents`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          title: documentData.title,
          content: documentData.content || '',
          document_type: documentData.documentType || 'notes',
          permissions: documentData.permissions || ['read', 'write']
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create collaborative document: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create collaborative document error:', error);
      throw error;
    }
  }

  /**
   * Update collaborative document
   */
  async updateCollaborativeDocument(sessionId, documentId, userId, updateData) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/documents/${documentId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId,
          content: updateData.content,
          changes: updateData.changes || [],
          version: updateData.version || null
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update collaborative document: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update collaborative document error:', error);
      throw error;
    }
  }

  /**
   * Get session participants
   */
  async getSessionParticipants(sessionId) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/participants`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get session participants: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get session participants error:', error);
      throw error;
    }
  }

  /**
   * Leave study session
   */
  async leaveStudySession(sessionId, userId) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/leave`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to leave study session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Leave study session error:', error);
      throw error;
    }
  }

  /**
   * End study session (for creators)
   */
  async endStudySession(sessionId, userId) {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to end study session: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('End study session error:', error);
      throw error;
    }
  }

  /**
   * Get session history and analytics
   */
  async getSessionHistory(userId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.timeRange) params.append('time_range', filters.timeRange);
      if (filters.sessionType) params.append('session_type', filters.sessionType);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await fetch(`${this.baseUrl}/history/${userId}?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get session history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get session history error:', error);
      throw error;
    }
  }

  /**
   * Establish WebSocket connection for real-time updates
   */
  connectWebSocket(sessionId, userId, onMessage, onConnect, onDisconnect) {
    try {
      const wsUrl = `${this.baseUrl.replace('http', 'ws')}/ws/${sessionId}/${userId}`;
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        if (onConnect) onConnect();
      };

      this.wsConnection.onmessage = (event) => {
        if (onMessage) {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        }
      };

      this.wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        if (onDisconnect) onDisconnect();
        this.attemptReconnection(sessionId, userId, onMessage, onConnect, onDisconnect);
      };

      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return this.wsConnection;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      throw error;
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  attemptReconnection(sessionId, userId, onMessage, onConnect, onDisconnect) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      setTimeout(() => {
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connectWebSocket(sessionId, userId, onMessage, onConnect, onDisconnect);
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Send message through WebSocket
   */
  sendWebSocketMessage(message) {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket() {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  /**
   * Get collaboration health check
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Collaboration service health check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Collaboration health check error:', error);
      throw error;
    }
  }
}

export default new CollaborationService();