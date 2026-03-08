import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, FileText, Trash2, ExternalLink, Sparkles, Lock, Users } from 'lucide-react';
import contextService from '../services/contextService';
import './ContextPanel.css';

const ContextPanel = ({ isOpen, onClose, hsMode, onHsModeToggle, onDocUploaded }) => {
  const navigate = useNavigate();

  const [docs, setDocs]         = useState([]);
  const [hsDocs, setHsDocs]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(null);

  const activeContext = (() => {
    try { return JSON.parse(localStorage.getItem('active_context') || 'null'); } catch { return null; }
  })();

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contextService.listDocuments();
      const userDocs = Array.isArray(data) ? data : (data.user_docs || data.documents || []);
      setDocs(userDocs);
      setHsDocs(Array.isArray(data.hs_docs) ? data.hs_docs : []);
    } catch { /* silenced */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen) loadDocs();
  }, [isOpen, loadDocs]);

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setDeleting(docId);
    try {
      await contextService.deleteDocument(docId);
      setDocs(prev => prev.filter(d => (d.doc_id || d.id) !== docId));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const goToHub = () => {
    onClose();
    navigate('/context');
  };

  const contextLabel = activeContext
    ? [
        activeContext.curriculum === 'uk' ? 'UK HS' : activeContext.curriculum === 'us' ? 'US HS' : null,
        activeContext.grade ? `Yr ${activeContext.grade}` : null,
        activeContext.subject ? activeContext.subject.replace(/_/g, ' ') : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <>
      {isOpen && <div className="context-panel-overlay" onClick={onClose} />}

      <div className={`context-panel ${isOpen ? 'open' : ''}`}>

        {/* Header */}
        <div className="cp-header">
          <div className="cp-header-left">
            <BookOpen size={16} />
            <span>Context</span>
          </div>
          <button className="cp-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="cp-body">

          {/* HS Mode toggle */}
          <div className="cp-section">
            <div className="cp-hs-toggle-row">
              <div className="cp-hs-toggle-label">
                <Sparkles size={15} />
                <div>
                  <div className="cp-toggle-title">HS Mode</div>
                  <div className="cp-toggle-sub">
                    {hsMode ? 'Curriculum context active' : 'Off — no curriculum context'}
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

          {/* Active context */}
          <div className="cp-section">
            <div className="cp-section-title">Active Context</div>
            {contextLabel ? (
              <div className="cp-active-ctx">
                <div className="cp-active-ctx-dot" />
                <span className="cp-active-ctx-label">{contextLabel}</span>
              </div>
            ) : (
              <p className="cp-empty-msg">No context set. Go to Context Hub to pick a curriculum and subject.</p>
            )}
          </div>

          {/* HS Curriculum documents */}
          {hsDocs.length > 0 && (
            <div className="cp-section">
              <div className="cp-section-title">Curriculum Documents</div>
              <div className="cp-doc-list">
                {hsDocs.map(doc => {
                  const id   = doc.doc_id || doc.id;
                  const name = doc.filename || 'Untitled';
                  return (
                    <div key={id} className="cp-doc-item">
                      <FileText size={14} className="cp-doc-icon" />
                      <div className="cp-doc-info">
                        <div className="cp-doc-name" title={name}>{name}</div>
                        <div className="cp-doc-meta">
                          <span className="cp-tag shared"><Users size={9} />Community</span>
                          {doc.subject && <span className="cp-tag">{doc.subject}</span>}
                          {doc.grade_level && <span className="cp-tag">Gr {doc.grade_level}</span>}
                          {doc.chunk_count > 0 && <span className="cp-tag">{doc.chunk_count} chunks</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* User's private documents */}
          <div className="cp-section">
            <div className="cp-section-title">Your Documents</div>
            {loading ? (
              <p className="cp-empty-msg">Loading…</p>
            ) : docs.length === 0 ? (
              <p className="cp-empty-msg">No documents. Add them in the Context Hub.</p>
            ) : (
              <div className="cp-doc-list">
                {docs.map(doc => {
                  const id   = doc.doc_id || doc.id;
                  const name = doc.filename || doc.title || 'Untitled';
                  return (
                    <div key={id} className="cp-doc-item">
                      <FileText size={14} className="cp-doc-icon" />
                      <div className="cp-doc-info">
                        <div className="cp-doc-name" title={name}>{name}</div>
                        <div className="cp-doc-meta">
                          <span className="cp-tag"><Lock size={9} />Private</span>
                          {doc.subject && <span className="cp-tag">{doc.subject}</span>}
                        </div>
                      </div>
                      <button
                        className="cp-delete-btn"
                        onClick={() => handleDelete(id, name)}
                        disabled={deleting === id}
                        aria-label="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer — go to context hub */}
        <div className="cp-footer">
          <button className="cp-hub-btn" onClick={goToHub}>
            <ExternalLink size={14} />
            Manage in Context Hub
          </button>
        </div>

      </div>
    </>
  );
};

export default ContextPanel;
