/**
 * contextService.js — API client for Cerbyl HS Mode document management.
 *
 * Manages the user's personal document library and interaction with the
 * shared HS curriculum knowledge base via the context_store ChromaDB backend.
 *
 * All methods use Bearer token from localStorage.
 */

import { API_URL } from '../config/api';

class ContextService {
  _headers(isFormData = false) {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return headers;
  }

  /**
   * Upload a document (PDF, TXT, or MD) for RAG indexing.
   *
   * @param {File}   file       - File object from <input type="file">
   * @param {string} subject    - e.g. "Biology", "Algebra II"
   * @param {string} gradeLevel - e.g. "Grade 10", "AP"
   * @param {string} scope      - "private" | "hs_shared"
   * @returns {Promise<{success, doc_id, filename, chunk_count, scope, message}>}
   */
  async uploadDocument(file, subject = '', gradeLevel = '', scope = 'private') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject);
    formData.append('grade_level', gradeLevel);
    formData.append('scope', scope);

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

  /**
   * List user's uploaded documents and HS curriculum summary.
   *
   * @returns {Promise<{
   *   user_docs: Array<{doc_id, filename, subject, grade_level, scope, chunk_count, status, created_at}>,
   *   hs_summary: {total_subjects: number, subjects: Array},
   *   hs_mode_available: boolean
   * }>}
   */
  async listDocuments() {
    const response = await fetch(`${API_URL}/context/documents`, {
      headers: this._headers(),
    });
    if (!response.ok) throw new Error(`List failed (${response.status})`);
    return response.json();
  }

  /**
   * Delete a document by doc_id.
   * Users can delete their own docs; admins can remove HS shared docs.
   *
   * @param {string} docId
   * @returns {Promise<{success: true, doc_id: string}>}
   */
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

  /**
   * Test RAG retrieval — useful for verifying a document was indexed.
   *
   * @param {string}  query
   * @param {boolean} useHs  - include shared HS curriculum in results
   * @param {number}  topK   - number of chunks to return
   * @returns {Promise<{query: string, results: Array, chunk_count: number}>}
   */
  async searchContext(query, useHs = true, topK = 5) {
    const params = new URLSearchParams({
      query,
      use_hs: useHs,
      top_k: topK,
    });
    const response = await fetch(`${API_URL}/context/search?${params}`, {
      headers: this._headers(),
    });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    return response.json();
  }

  /**
   * List available subjects in the shared HS curriculum collection.
   *
   * @returns {Promise<{subjects: Array<{subject, grade_level, doc_count}>, total: number}>}
   */
  async getHsSubjects() {
    const response = await fetch(`${API_URL}/context/hs/subjects`, {
      headers: this._headers(),
    });
    if (!response.ok) throw new Error(`HS subjects failed (${response.status})`);
    return response.json();
  }
}

const contextService = new ContextService();
export default contextService;
