import { API_URL, getAuthToken } from '../config/api';

class PodcastAgentService {
  constructor() {
    this.baseUrl = `${API_URL}/media/podcast`;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    };
  }

  async request(path, payload = {}, method = 'POST') {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.getHeaders(),
      body: method === 'GET' ? undefined : JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `Podcast request failed: ${response.status}`);
    }

    return data;
  }

  async getVoiceModes() {
    return this.request('/voice-modes', {}, 'GET');
  }

  async getVoicePersonas() {
    return this.request('/voice-personas', {}, 'GET');
  }

  async getLanguages() {
    return this.request('/languages', {}, 'GET');
  }

  async getDifficulties() {
    return this.request('/difficulties', {}, 'GET');
  }

  async getSavedSessions(userId, limit = 20) {
    const query = `?user_id=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}`;
    return this.request(`/sessions${query}`, {}, 'GET');
  }

  async startSession(payload) {
    return this.request('/start', payload);
  }

  async resumeSession(payload) {
    return this.request('/resume', payload);
  }

  async nextSegment(payload) {
    return this.request('/next', payload);
  }

  async jumpToChapter(payload) {
    return this.request('/jump', payload);
  }

  async askQuestion(payload) {
    return this.request('/ask', payload);
  }

  async addBookmark(payload) {
    return this.request('/bookmark', payload);
  }

  async getBookmarks(payload) {
    return this.request('/bookmarks', payload);
  }

  async replayBookmark(payload) {
    return this.request('/replay', payload);
  }

  async startMcqDrill(payload) {
    return this.request('/mcq/start', payload);
  }

  async answerMcq(payload) {
    return this.request('/mcq/answer', payload);
  }

  async exportSession(payload) {
    return this.request('/export', payload);
  }

  async setVoiceMode(payload) {
    return this.request('/voice-mode', payload);
  }

  async updateSettings(payload) {
    return this.request('/settings', payload);
  }

  async stopSession(payload) {
    return this.request('/stop', payload);
  }

  async getState(payload) {
    return this.request('/state', payload);
  }
}

const podcastAgentService = new PodcastAgentService();
export default podcastAgentService;
