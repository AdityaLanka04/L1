import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, FileText, Trash2, ExternalLink, Sparkles, Lock, Users, CheckSquare, Square, Filter } from 'lucide-react';
import contextService from '../services/contextService';
import './ContextPanel.css';

const SELECTED_KEY = 'ctx_selected_doc_ids';

const loadSelected = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SELECTED_KEY) || '[]')); }
  catch { return new Set(); }
};

const saveSelected = (set) => {
  localStorage.setItem(SELECTED_KEY, JSON.stringify([...set]));
};

const ContextPanel = ({ isOpen, onClose, hsMode, onHsModeToggle, onDocUploaded }) => {
  const navigate = useNavigate();

  const [docs, setDocs]         = useState([]);
  const [hsDocs, setHsDocs]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [selectedIds, setSelectedIds] = useState(loadSelected);

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

  const toggleDoc = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveSelected(next);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    saveSelected(new Set());
  };

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setDeleting(docId);
    try {
      await contextService.deleteDocument(docId);
      setDocs(prev => prev.filter(d => (d.doc_id || d.id) !== docId));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(docId);
        saveSelected(next);
        return next;
      });
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

  const selCount = selectedIds.size;
  const allDocIds = [...docs.map(d => d.doc_id || d.id), ...hsDocs.map(d => d.doc_id || d.id)];

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

          {/* Context filter status banner */}
          {selCount > 0 && (
            <div className="cp-filter-banner">
              <Filter size={13} />
              <span>Using <strong>{selCount}</strong> selected {selCount === 1 ? 'source' : 'sources'} only</span>
              <button className="cp-clear-sel" onClick={clearSelection}>Clear</button>
            </div>
          )}

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
              <div className="cp-section-title">
                Curriculum Documents
                <span className="cp-sel-hint">Tap to select</span>
              </div>
              <div className="cp-doc-list">
                {hsDocs.map(doc => {
                  const id   = doc.doc_id || doc.id;
                  const name = doc.filename || 'Untitled';
                  const sel  = selectedIds.has(id);
                  return (
                    <div
                      key={id}
                      className={`cp-doc-item cp-doc-item--selectable ${sel ? 'cp-doc-item--selected' : ''}`}
                      onClick={() => toggleDoc(id)}
                      role="checkbox"
                      aria-checked={sel}
                    >
                      <span className="cp-doc-check">
                        {sel ? <CheckSquare size={15} /> : <Square size={15} />}
                      </span>
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
            <div className="cp-section-title">
              Your Documents
              {docs.length > 0 && <span className="cp-sel-hint">Tap to select</span>}
            </div>
            {loading ? (
              <p className="cp-empty-msg">Loading…</p>
            ) : docs.length === 0 ? (
              <p className="cp-empty-msg">No documents. Add them in the Context Hub.</p>
            ) : (
              <div className="cp-doc-list">
                {docs.map(doc => {
                  const id   = doc.doc_id || doc.id;
                  const name = doc.filename || doc.title || 'Untitled';
                  const sel  = selectedIds.has(id);
                  return (
                    <div
                      key={id}
                      className={`cp-doc-item cp-doc-item--selectable ${sel ? 'cp-doc-item--selected' : ''}`}
                      onClick={() => toggleDoc(id)}
                      role="checkbox"
                      aria-checked={sel}
                    >
                      <span className="cp-doc-check">
                        {sel ? <CheckSquare size={15} /> : <Square size={15} />}
                      </span>
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
                        onClick={(e) => { e.stopPropagation(); handleDelete(id, name); }}
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

          {/* Selection instructions */}
          <div className="cp-section cp-sel-instructions">
            <p>
              <strong>Select specific books/docs</strong> above to restrict AI context to only those sources.
              When nothing is selected, all available context is used.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="cp-footer">
          <button className="cp-hub-btn" onClick={goToHub}>
            <ExternalLink size={14} />
            Open Vault
          </button>
        </div>

      </div>
    </>
  );
};

export default ContextPanel;
