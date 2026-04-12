

import { API_URL } from '../config/api';

class ContextService {
  _headers(isFormData = false) {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  }

  
  async uploadDocument(file, subject = '', gradeLevel = '', scope = 'private', options = {}) {
    const {
      sourceUrl = '',
      sourceName = '',
      license = '',
    } = options || {};
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject);
    formData.append('grade_level', gradeLevel);
    formData.append('scope', scope);
    formData.append('source_url', sourceUrl);
    formData.append('source_name', sourceName);
    formData.append('license', license);

    const response = await fetch(`${API_URL}/context/upload`, {
      method: 'POST',
      headers: this._headers(true),
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed (${response.status})`);
    }
    return response.json();
  }

  
  async listDocuments() {
    const response = await fetch(`${API_URL}/context/documents`, {
      headers: this._headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`List failed (${response.status})`);
    return response.json();
  }

  
  async deleteDocument(docId) {
    const response = await fetch(`${API_URL}/context/documents/${docId}`, {
      method: 'DELETE',
      headers: this._headers(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Delete failed (${response.status})`);
    }
    return response.json();
  }

  
  async searchContext(query, useHs = true, topK = 5) {
    const params = new URLSearchParams({
      query,
      use_hs: useHs,
      top_k: topK,
    });
    const response = await fetch(`${API_URL}/context/search?${params}`, {
      headers: this._headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    return response.json();
  }

  
  async getHsSubjects() {
    const response = await fetch(`${API_URL}/context/hs/subjects`, {
      headers: this._headers(),
    });
    if (!response.ok) throw new Error(`HS subjects failed (${response.status})`);
    return response.json();
  }

  
  async importFromUrl(payload) {
    const response = await fetch(`${API_URL}/context/import_url`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `URL import failed (${response.status})`);
    }
    return response.json();
  }

  async askKnowledgeBase(question, { useHs = true, topK = 6 } = {}) {
    const response = await fetch(`${API_URL}/context/ask`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({ question, use_hs: useHs, top_k: topK }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Ask failed (${response.status})`);
    }
    return response.json();
  }

  async listCommunityDocuments({ curriculum = '', grade = '', subject = '' } = {}) {
    const params = new URLSearchParams();
    if (curriculum) params.set('curriculum', curriculum);
    if (grade) params.set('grade', String(grade));
    if (subject) params.set('subject', subject);
    const response = await fetch(`${API_URL}/context/community?${params}`, {
      headers: this._headers(),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Community list failed (${response.status})`);
    return response.json();
  }
}

const contextService = new ContextService();
export default contextService;
