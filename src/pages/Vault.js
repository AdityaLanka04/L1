import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, FileText, Search, Library, Lock, Users,
  Trash2, Upload, Layers, GraduationCap, ChevronRight
} from 'lucide-react';
import contextService from '../services/contextService';
import './Vault.css';

const TABS = [
  { id: 'mine',       label: 'Your Library', icon: Lock },
  { id: 'curriculum', label: 'Curriculum',   icon: GraduationCap },
];

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const subjectLabel = (s) => (s || 'Uncategorized').replace(/_/g, ' ');

const Vault = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState('mine');
  const [query, setQuery] = useState('');
  const [userDocs, setUserDocs] = useState([]);
  const [hsDocs, setHsDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contextService.listDocuments();
      setUserDocs(Array.isArray(data.user_docs) ? data.user_docs : []);
      setHsDocs(Array.isArray(data.hs_docs) ? data.hs_docs : []);
    } catch (e) {
      setUserDocs([]);
      setHsDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setDeleting(docId);
    try {
      await contextService.deleteDocument(docId);
      setUserDocs(prev => prev.filter(d => d.doc_id !== docId));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const stats = useMemo(() => {
    const userChunks = userDocs.reduce((a, d) => a + (d.chunk_count || 0), 0);
    const hsChunks = hsDocs.reduce((a, d) => a + (d.chunk_count || 0), 0);
    const subjects = new Set([
      ...userDocs.map(d => d.subject).filter(Boolean),
      ...hsDocs.map(d => d.subject).filter(Boolean),
    ]);
    return {
      books: hsDocs.length,
      mine:  userDocs.length,
      chunks: userChunks + hsChunks,
      subjects: subjects.size,
    };
  }, [userDocs, hsDocs]);

  const docsForTab = tab === 'mine' ? userDocs : hsDocs;

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docsForTab;
    return docsForTab.filter(d => {
      const haystack = [
        d.filename, d.subject, d.grade_level, d.source_name,
        ...(d.topic_tags || []), ...(d.key_concepts || []),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [docsForTab, query]);

  const shelves = useMemo(() => {
    const groups = new Map();
    filteredDocs.forEach(d => {
      const key = d.subject || 'uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subject, docs]) => ({ subject, docs }));
  }, [filteredDocs]);

  return (
    <div className="vlt-root">
      <div className="vlt-bg-fx">
        <div className="vlt-bg-glow" />
        <div className="vlt-bg-grid" />
        <div className="vlt-bg-diag" />
        <div className="vlt-bg-shape vlt-bg-shape-circle-1" />
        <div className="vlt-bg-shape vlt-bg-shape-circle-2" />
        <div className="vlt-bg-shape vlt-bg-shape-circle-3" />
        <div className="vlt-bg-shape vlt-bg-shape-square-1" />
        <div className="vlt-bg-shape vlt-bg-shape-square-2" />
        <div className="vlt-bg-shape vlt-bg-shape-line-1" />
        <div className="vlt-bg-shape vlt-bg-shape-line-2" />
        <div className="vlt-bg-vignette" />
      </div>

      <header className="vlt-topbar">
        <button className="vlt-back" onClick={() => navigate('/dashboard-cerbyl')} aria-label="Back">
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>
        <div className="vlt-tagline">your <span>vault</span></div>
        <button className="vlt-upload" onClick={() => navigate('/context')}>
          <Upload size={14} /> Manage
        </button>
      </header>

      <main className="vlt-main">
        {/* Hero */}
        <section className="vlt-hero">
          <div className="vlt-hero-text">
            <div className="vlt-eyebrow">RESOURCE LIBRARY</div>
            <h1 className="vlt-title">Vault<span className="vlt-period">.</span></h1>
            <p className="vlt-sub">
              Every book, every chunk, every reference — organized like a library.
            </p>
          </div>
          <div className="vlt-stat-row">
            <div className="vlt-stat">
              <div className="vlt-stat-num">{String(stats.books).padStart(2, '0')}</div>
              <div className="vlt-stat-lbl">BOOKS</div>
            </div>
            <div className="vlt-stat">
              <div className="vlt-stat-num">{String(stats.mine).padStart(2, '0')}</div>
              <div className="vlt-stat-lbl">YOUR DOCS</div>
            </div>
            <div className="vlt-stat">
              <div className="vlt-stat-num">{stats.chunks}</div>
              <div className="vlt-stat-lbl">CHUNKS</div>
            </div>
            <div className="vlt-stat">
              <div className="vlt-stat-num">{stats.subjects}</div>
              <div className="vlt-stat-lbl">SUBJECTS</div>
            </div>
          </div>
        </section>

        {/* Tabs + search */}
        <section className="vlt-controls">
          <div className="vlt-tabs">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`vlt-tab ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={14} />
                  {t.label}
                  <span className="vlt-tab-count">
                    {t.id === 'mine' ? userDocs.length : hsDocs.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="vlt-search">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search books, subjects, concepts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Library content */}
        <section className="vlt-shelves">
          {loading ? (
            <div className="vlt-empty">Loading library…</div>
          ) : filteredDocs.length === 0 ? (
            <div className="vlt-empty">
              <Library size={32} />
              <h3>{tab === 'mine' ? 'Your library is empty' : 'No curriculum books here yet'}</h3>
              <p>
                {tab === 'mine'
                  ? 'Upload a PDF or document to start building your vault.'
                  : 'Curriculum books will appear here when added.'}
              </p>
              {tab === 'mine' && (
                <button className="vlt-cta" onClick={() => navigate('/context')}>
                  <Upload size={14} /> Upload a document
                </button>
              )}
            </div>
          ) : (
            shelves.map(shelf => (
              <div className="vlt-shelf" key={shelf.subject}>
                <div className="vlt-shelf-head">
                  <div className="vlt-shelf-rule" />
                  <div className="vlt-shelf-title">
                    <BookOpen size={13} />
                    <span>{subjectLabel(shelf.subject)}</span>
                    <span className="vlt-shelf-count">{shelf.docs.length}</span>
                  </div>
                  <div className="vlt-shelf-rule" />
                </div>

                <div className="vlt-grid">
                  {shelf.docs.map(d => {
                    const isCurriculum = tab === 'curriculum';
                    return (
                      <article
                        key={d.doc_id}
                        className={`vlt-book ${activeDoc === d.doc_id ? 'active' : ''}`}
                        onClick={() => setActiveDoc(activeDoc === d.doc_id ? null : d.doc_id)}
                      >
                        <div className="vlt-book-body">
                          <div className="vlt-book-tag">
                            {isCurriculum
                              ? <><Users size={10} /> CURRICULUM</>
                              : <><Lock size={10} /> PRIVATE</>}
                          </div>
                          <h3 className="vlt-book-title" title={d.filename}>
                            {d.filename || 'Untitled'}
                          </h3>
                          {d.ai_summary && (
                            <p className="vlt-book-desc">{d.ai_summary}</p>
                          )}

                          <div className="vlt-book-meta">
                            <div className="vlt-meta-stat">
                              <Layers size={11} />
                              <span>{d.chunk_count || 0} chunks</span>
                            </div>
                            {d.page_count != null && (
                              <div className="vlt-meta-stat">
                                <FileText size={11} />
                                <span>{d.page_count} pages</span>
                              </div>
                            )}
                            {d.grade_level && (
                              <div className="vlt-meta-stat">Yr {d.grade_level}</div>
                            )}
                            {d.file_size != null && (
                              <div className="vlt-meta-stat">{formatSize(d.file_size)}</div>
                            )}
                          </div>

                          {Array.isArray(d.topic_tags) && d.topic_tags.length > 0 && (
                            <div className="vlt-book-tags">
                              {d.topic_tags.slice(0, 5).map((t, i) => (
                                <span key={i} className="vlt-pill">{t}</span>
                              ))}
                            </div>
                          )}

                          {Array.isArray(d.key_concepts) && d.key_concepts.length > 0 && activeDoc === d.doc_id && (
                            <div className="vlt-book-concepts">
                              <div className="vlt-concept-label">Key concepts</div>
                              <div className="vlt-concept-list">
                                {d.key_concepts.slice(0, 8).map((c, i) => (
                                  <span key={i} className="vlt-concept">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="vlt-book-actions">
                            <button
                              className="vlt-book-open"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/search-hub?ask=${encodeURIComponent(d.filename)}`);
                              }}
                            >
                              Open <ChevronRight size={12} />
                            </button>
                            {!isCurriculum && (
                              <button
                                className="vlt-book-del"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(d.doc_id, d.filename);
                                }}
                                disabled={deleting === d.doc_id}
                                aria-label="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
};

export default Vault;
