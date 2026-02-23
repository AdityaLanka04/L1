import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, Trash2, BookOpen, ChevronDown, ChevronRight, FileText, Globe } from 'lucide-react';
import contextService from '../services/contextService';
import './ContextPanel.css';

const SUBJECTS = [
  'Biology', 'Chemistry', 'Physics', 'Earth Science',
  'Algebra I', 'Algebra II', 'Geometry', 'Pre-Calculus', 'Calculus', 'Statistics',
  'US History', 'World History', 'AP History', 'Government', 'Economics',
  'English Language', 'English Literature',
  'Psychology', 'Sociology', 'Other',
];

const GRADE_LEVELS = [
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'AP', 'Honors', 'Other',
];

const ContextPanel = ({ isOpen, onClose, hsMode, onHsModeToggle, onDocUploaded }) => {
  const [userDocs, setUserDocs]           = useState([]);
  const [hsSubjects, setHsSubjects]       = useState([]);
  const [hsModeAvailable, setHsModeAvail] = useState(false);
  const [subjectsOpen, setSubjectsOpen]   = useState(false);
  const [loading, setLoading]             = useState(false);

  const [selectedFile, setSelectedFile]   = useState(null);
  const [subject, setSubject]             = useState('');
  const [gradeLevel, setGradeLevel]       = useState('');
  const [scope, setScope]                 = useState('private');
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [deleting, setDeleting]           = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contextService.listDocuments();
      setUserDocs(data.user_docs || []);
      setHsSubjects(data.hs_summary?.subjects || []);
      setHsModeAvail(data.hs_mode_available || false);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const handleUpload = async () => {
    if (!selectedFile) { setUploadError('Please select a file.'); return; }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const result = await contextService.uploadDocument(selectedFile, subject, gradeLevel, scope);
      setUploadSuccess(`Indexed "${result.filename}" — ${result.chunk_count} chunks ready.`);
      setSelectedFile(null);
      setSubject('');
      setGradeLevel('');
      setScope('private');
      loadData();
      if (onDocUploaded) onDocUploaded();
    } catch (err) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setDeleting(docId);
    try {
      await contextService.deleteDocument(docId);
      setUserDocs(prev => prev.filter(d => d.doc_id !== docId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {isOpen && <div className="context-panel-overlay" onClick={onClose} />}

      <div className={`context-panel ${isOpen ? 'open' : ''}`}>

        {/* ── Header ── */}
        <div className="cp-header">
          <div className="cp-header-left">
            <BookOpen size={16} />
            <span>HS Mode &amp; Context</span>
          </div>
          <button className="cp-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="cp-body">

          {/* ── HS Mode Toggle ── */}
          <div className="cp-section">
            <div className="cp-hs-toggle-row">
              <div className="cp-hs-toggle-label">
                <BookOpen size={16} />
                <div>
                  <div className="cp-toggle-title">HS Mode</div>
                  <div className="cp-toggle-sub">
                    {hsModeAvailable
                      ? 'US High School curriculum context active'
                      : 'Upload documents to enable curriculum context'}
                  </div>
                </div>
              </div>
              <button
                className={`cp-toggle-btn ${hsMode ? 'on' : 'off'}`}
                onClick={() => onHsModeToggle && onHsModeToggle(!hsMode)}
                aria-label="Toggle HS Mode"
              >
                <span className="cp-toggle-thumb" />
              </button>
            </div>
          </div>

          {/* ── HS Curriculum Subjects ── */}
          {hsMode && (
            <div className="cp-section">
              <button
                className="cp-section-header"
                onClick={() => setSubjectsOpen(p => !p)}
              >
                <span>HS Curriculum</span>
                <span className="cp-subject-count">{hsSubjects.length} subject{hsSubjects.length !== 1 ? 's' : ''}</span>
                {subjectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {subjectsOpen && (
                <div className="cp-subjects-list">
                  {hsSubjects.length === 0 ? (
                    <p className="cp-empty-msg">
                      No shared curriculum yet. Upload a document with "Contribute to HS" scope to add to it.
                    </p>
                  ) : (
                    hsSubjects.map((s, i) => (
                      <div key={i} className="cp-subject-pill">
                        <span>{s.subject}</span>
                        {s.grade_level && <span className="cp-grade-badge">{s.grade_level}</span>}
                        <span className="cp-doc-count">{s.doc_count}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── My Documents ── */}
          <div className="cp-section">
            <div className="cp-section-title">My Documents</div>
            {loading ? (
              <p className="cp-empty-msg">Loading...</p>
            ) : userDocs.length === 0 ? (
              <p className="cp-empty-msg">No documents uploaded yet. Add one below to personalise your context.</p>
            ) : (
              <div className="cp-doc-list">
                {userDocs.map(doc => (
                  <div key={doc.doc_id} className={`cp-doc-item ${doc.status}`}>
                    <FileText size={14} className="cp-doc-icon" />
                    <div className="cp-doc-info">
                      <div className="cp-doc-name" title={doc.filename}>{doc.filename}</div>
                      <div className="cp-doc-meta">
                        {doc.subject    && <span className="cp-tag">{doc.subject}</span>}
                        {doc.grade_level && <span className="cp-tag">{doc.grade_level}</span>}
                        {doc.scope === 'hs_shared' && (
                          <span className="cp-tag shared"><Globe size={9} /> HS</span>
                        )}
                        <span className={`cp-status-dot ${doc.status}`} title={doc.status} />
                      </div>
                    </div>
                    <button
                      className="cp-delete-btn"
                      onClick={() => handleDelete(doc.doc_id, doc.filename)}
                      disabled={deleting === doc.doc_id}
                      aria-label="Delete document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Add Document ── */}
          <div className="cp-section cp-upload-section">
            <div className="cp-section-title">
              <Upload size={13} />
              Add Document
            </div>

            <p className="cp-upload-hint">
              Supported: .pdf, .txt, .md (max 10 MB).<br />
              Free HS textbooks:{' '}
              <a href="https://openstax.org/subjects" target="_blank" rel="noopener noreferrer">OpenStax</a>,{' '}
              <a href="https://www.ck12.org" target="_blank" rel="noopener noreferrer">CK-12</a>,{' '}
              <a href="https://libretexts.org" target="_blank" rel="noopener noreferrer">LibreTexts</a>.
            </p>

            <label className="cp-file-label">
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setSelectedFile(f); setUploadError(null); setUploadSuccess(null); }
                }}
                className="cp-file-input"
              />
              <span className="cp-file-btn">
                <FileText size={14} />
                {selectedFile ? selectedFile.name : 'Choose file...'}
              </span>
            </label>

            <select className="cp-select" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">Subject (optional)</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select className="cp-select" value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}>
              <option value="">Grade Level (optional)</option>
              {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <div className="cp-scope-row">
              <label className="cp-radio-label">
                <input type="radio" name="scope" value="private"
                  checked={scope === 'private'} onChange={() => setScope('private')} />
                Private (only for me)
              </label>
              <label className="cp-radio-label">
                <input type="radio" name="scope" value="hs_shared"
                  checked={scope === 'hs_shared'} onChange={() => setScope('hs_shared')} />
                Contribute to HS
              </label>
            </div>

            {uploadError   && <div className="cp-msg error">{uploadError}</div>}
            {uploadSuccess && <div className="cp-msg success">{uploadSuccess}</div>}

            <button
              className="cp-upload-btn"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading...' : 'Upload & Index'}
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default ContextPanel;
