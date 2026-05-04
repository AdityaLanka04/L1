import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, FileText, Search, Library, Lock, Users, Trash2,
  Upload, Layers, GraduationCap, Plus, X, Check, Clock, MessageCircle,
  Zap, Brain, ChevronRight, Sparkles, RefreshCw, AlertCircle, Loader2,
  BarChart3, Target, Package
} from 'lucide-react';
import contextService from '../services/contextService';
import { API_URL } from '../config/api';
import AbstractFx from '../components/AbstractFx';
import './Vault.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const DECK_SIZE = 8;
const DECK_KEY  = 'ctx_selected_doc_ids';

const TABS = [
  { id: 'deck',       label: 'CONTEXT DECK', icon: Package },
  { id: 'recent',     label: 'RECENT',        icon: Clock },
  { id: 'mydocs',     label: 'YOUR DOCS',     icon: Lock },
  { id: 'curriculum', label: 'CURRICULUM',    icon: GraduationCap },
];

const UK_SUBJECTS = [
  { id: 'maths',            name: 'Mathematics',        cat: 'STEM' },
  { id: 'english_lang',     name: 'English Language',   cat: 'Humanities' },
  { id: 'english_lit',      name: 'English Literature', cat: 'Humanities' },
  { id: 'biology',          name: 'Biology',            cat: 'STEM' },
  { id: 'chemistry',        name: 'Chemistry',          cat: 'STEM' },
  { id: 'physics',          name: 'Physics',            cat: 'STEM' },
  { id: 'combined_science', name: 'Combined Science',   cat: 'STEM' },
  { id: 'history',          name: 'History',            cat: 'Humanities' },
  { id: 'geography',        name: 'Geography',          cat: 'Humanities' },
  { id: 'computer_science', name: 'Computer Science',   cat: 'STEM' },
  { id: 'business',         name: 'Business Studies',   cat: 'Social' },
  { id: 'economics',        name: 'Economics',          cat: 'Social' },
  { id: 'psychology',       name: 'Psychology',         cat: 'Social' },
  { id: 'sociology',        name: 'Sociology',          cat: 'Social' },
  { id: 'rs',               name: 'Religious Studies',  cat: 'Humanities' },
  { id: 'art',              name: 'Art & Design',       cat: 'Arts' },
  { id: 'pe',               name: 'Phys. Education',    cat: 'Arts' },
  { id: 'french',           name: 'French',             cat: 'Languages' },
  { id: 'spanish',          name: 'Spanish',            cat: 'Languages' },
  { id: 'german',           name: 'German',             cat: 'Languages' },
  { id: 'music',            name: 'Music',              cat: 'Arts' },
  { id: 'drama',            name: 'Drama',              cat: 'Arts' },
  { id: 'media',            name: 'Media Studies',      cat: 'Arts' },
  { id: 'dt',               name: 'Design & Technology',cat: 'STEM' },
];

const US_SUBJECTS = [
  { id: 'algebra1',         name: 'Algebra I',            cat: 'Mathematics' },
  { id: 'algebra2',         name: 'Algebra II',           cat: 'Mathematics' },
  { id: 'geometry',         name: 'Geometry',             cat: 'Mathematics' },
  { id: 'precalc',          name: 'Pre-Calculus',         cat: 'Mathematics' },
  { id: 'ap_calc_ab',       name: 'AP Calc AB',           cat: 'Mathematics' },
  { id: 'ap_calc_bc',       name: 'AP Calc BC',           cat: 'Mathematics' },
  { id: 'ap_stats',         name: 'AP Statistics',        cat: 'Mathematics' },
  { id: 'biology',          name: 'Biology',              cat: 'Sciences' },
  { id: 'chemistry',        name: 'Chemistry',            cat: 'Sciences' },
  { id: 'physics',          name: 'Physics',              cat: 'Sciences' },
  { id: 'ap_bio',           name: 'AP Biology',           cat: 'Sciences' },
  { id: 'ap_chem',          name: 'AP Chemistry',         cat: 'Sciences' },
  { id: 'ap_physics_1',     name: 'AP Physics 1',         cat: 'Sciences' },
  { id: 'computer_science', name: 'Computer Science',     cat: 'Sciences' },
  { id: 'ap_cs_a',          name: 'AP CS A (Java)',        cat: 'Sciences' },
  { id: 'us_history',       name: 'US History',           cat: 'Social Studies' },
  { id: 'world_history',    name: 'World History',        cat: 'Social Studies' },
  { id: 'ap_us_history',    name: 'AP US History',        cat: 'Social Studies' },
  { id: 'economics',        name: 'Economics',            cat: 'Social Studies' },
  { id: 'ap_gov',           name: 'AP Government',        cat: 'Social Studies' },
  { id: 'psychology',       name: 'Psychology',           cat: 'Social Studies' },
  { id: 'ap_psych',         name: 'AP Psychology',        cat: 'Social Studies' },
  { id: 'english9',         name: 'English 9',            cat: 'Language Arts' },
  { id: 'english10',        name: 'English 10',           cat: 'Language Arts' },
  { id: 'english11',        name: 'American Literature',  cat: 'Language Arts' },
  { id: 'english12',        name: 'English 12',           cat: 'Language Arts' },
  { id: 'ap_english_lang',  name: 'AP English Language',  cat: 'Language Arts' },
  { id: 'ap_english_lit',   name: 'AP English Lit',       cat: 'Language Arts' },
];

const CAT_COLORS = {
  STEM: '#22c55e', Mathematics: '#22c55e', Sciences: '#06b6d4',
  Humanities: '#3b82f6', 'Social Studies': '#f97316', Social: '#f97316',
  'Language Arts': '#a855f7', Languages: '#a855f7', Arts: '#ec4899',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return ''; }
};

const fmtBytes = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
};

const subjectLabel = (s) => (s || 'General').replace(/_/g, ' ');

const loadDeck = () => {
  try { return JSON.parse(localStorage.getItem(DECK_KEY) || '[]'); }
  catch { return []; }
};

const saveDeck = (ids) => localStorage.setItem(DECK_KEY, JSON.stringify(ids));

// ─── Main Component ───────────────────────────────────────────────────────────

const Vault = () => {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  // Data
  const [userDocs, setUserDocs] = useState([]);
  const [hsDocs,   setHsDocs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(null);

  // Deck
  const [deckIds, setDeckIds] = useState(loadDeck);

  // Recent
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentKey, setRecentKey] = useState(0);

  // Upload
  const [uploading,    setUploading]    = useState(false);
  const [uploadError,  setUploadError]  = useState('');
  const [uploadOk,     setUploadOk]     = useState('');
  const [uploadSubject,setUploadSubject]= useState('');

  // UI
  const [activeTab, setActiveTab] = useState('deck');
  const [docSearch, setDocSearch] = useState('');
  const [currMode, setCurrMode]   = useState('uk');  // 'uk' | 'us'
  const [currSubject, setCurrSubject] = useState(null);

  // ── Load docs ──
  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contextService.listDocuments();
      setUserDocs(Array.isArray(data.user_docs) ? data.user_docs : []);
      setHsDocs(Array.isArray(data.hs_docs) ? data.hs_docs : []);
    } catch { setUserDocs([]); setHsDocs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Load recent ──
  useEffect(() => {
    if (activeTab !== 'recent') return;
    // recentKey dep forces re-fetch on refresh
    const fetch = async () => {
      setRecentLoading(true);
      const token = localStorage.getItem('token');
      const uid   = localStorage.getItem('username');
      const h     = { Authorization: `Bearer ${token}` };
      const items = [];
      try {
        const r = await fetch(`${API_URL}/get_notes?user_id=${uid}`, { headers: h });
        if (r.ok) {
          const d = await r.json();
          const notes = Array.isArray(d) ? d : (d.notes || []);
          notes.slice(0, 8).forEach(n => items.push({
            type: 'note', icon: 'note', id: n.id,
            title: n.title || 'Untitled note',
            date: n.updated_at || n.created_at,
            route: `/notes/editor/${n.id}`,
          }));
        }
      } catch { /* silenced */ }
      try {
        const r = await fetch(`${API_URL}/get_flashcard_history?user_id=${uid}&limit=8`, { headers: h });
        if (r.ok) {
          const d = await r.json();
          (d.flashcard_history || []).slice(0, 6).forEach(s => items.push({
            type: 'flashcards', icon: 'flashcard', id: s.set_id || s.id,
            title: s.title || 'Flashcard set',
            meta: `${s.card_count || 0} cards`,
            date: s.updated_at || s.created_at,
            route: '/flashcards',
          }));
        }
      } catch { /* silenced */ }
      try {
        const r = await fetch(`${API_URL}/get_chat_sessions?user_id=${uid}`, { headers: h });
        if (r.ok) {
          const d = await r.json();
          (d.sessions || []).slice(0, 6).forEach(s => items.push({
            type: 'chat', icon: 'chat', id: s.session_id || s.id,
            title: s.title || 'AI Chat session',
            date: s.updated_at || s.created_at,
            route: `/ai-chat${s.session_id ? `?session_id=${s.session_id}` : ''}`,
          }));
        }
      } catch { /* silenced */ }
      try {
        const r = await fetch(`${API_URL}/get_question_sets?user_id=${uid}`, { headers: h });
        if (r.ok) {
          const d = await r.json();
          (d.question_sets || []).slice(0, 4).forEach(s => items.push({
            type: 'quiz', icon: 'quiz', id: s.id,
            title: s.title || 'Quiz set',
            meta: `${s.question_count || 0} questions`,
            date: s.created_at,
            route: `/question-bank?set_id=${s.id}`,
          }));
        }
      } catch { /* silenced */ }
      items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setRecent(items);
      setRecentLoading(false);
    };
    fetch();
  }, [activeTab, recentKey]);

  // ── Deck helpers ──
  const deckSet = useMemo(() => new Set(deckIds), [deckIds]);

  const addToDeck = (id) => {
    if (deckIds.includes(id)) return;
    if (deckIds.length >= DECK_SIZE) return;
    const next = [...deckIds, id];
    setDeckIds(next);
    saveDeck(next);
  };

  const removeFromDeck = (id) => {
    const next = deckIds.filter(d => d !== id);
    setDeckIds(next);
    saveDeck(next);
  };

  const clearDeck = () => { setDeckIds([]); saveDeck([]); };

  // ── Doc lookup for deck display ──
  const allDocs = useMemo(() => {
    const m = new Map();
    [...userDocs, ...hsDocs].forEach(d => {
      const id = d.doc_id || d.id;
      if (id) m.set(id, d);
    });
    return m;
  }, [userDocs, hsDocs]);

  // ── Upload ──
  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setUploadOk('');
    try {
      await contextService.uploadDocument(file, uploadSubject);
      setUploadOk(`"${file.name}" uploaded successfully.`);
      await loadDocs();
    } catch (e) {
      setUploadError(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    setDeleting(docId);
    try {
      await contextService.deleteDocument(docId);
      setUserDocs(prev => prev.filter(d => (d.doc_id || d.id) !== docId));
      removeFromDeck(docId);
    } catch (e) { alert(e.message || 'Delete failed'); }
    finally { setDeleting(null); }
  };

  // ── Stats ──
  const stats = useMemo(() => ({
    books:   hsDocs.length,
    myDocs:  userDocs.length,
    deck:    deckIds.length,
    chunks:  [...userDocs, ...hsDocs].reduce((a, d) => a + (d.chunk_count || 0), 0),
  }), [userDocs, hsDocs, deckIds]);

  // ── Curriculum data ──
  const currSubjects = currMode === 'uk' ? UK_SUBJECTS : US_SUBJECTS;
  const filteredHsDocs = useMemo(() => {
    if (!currSubject) return hsDocs;
    return hsDocs.filter(d =>
      (d.subject || '').toLowerCase().replace(/ /g, '_') === currSubject ||
      (d.subject || '').toLowerCase().includes(currSubject.replace(/_/g, ' '))
    );
  }, [hsDocs, currSubject]);

  // ── Doc search ──
  const filteredUserDocs = useMemo(() => {
    if (!docSearch.trim()) return userDocs;
    const q = docSearch.toLowerCase();
    return userDocs.filter(d =>
      [d.filename, d.subject, ...(d.topic_tags || [])].join(' ').toLowerCase().includes(q)
    );
  }, [userDocs, docSearch]);

  // ── Icon helpers ──
  const recentIcon = (type) => {
    if (type === 'note')      return <FileText size={16} />;
    if (type === 'flashcard') return <Layers size={16} />;
    if (type === 'chat')      return <MessageCircle size={16} />;
    if (type === 'quiz')      return <Brain size={16} />;
    return <Sparkles size={16} />;
  };

  const recentColor = (type) => {
    if (type === 'note')      return '#3b82f6';
    if (type === 'flashcard') return '#22c55e';
    if (type === 'chat')      return '#a855f7';
    if (type === 'quiz')      return '#f97316';
    return 'var(--accent)';
  };

  // ─────────────────────── RENDER TABS ──────────────────────────────────────

  // ── DECK TAB ──────────────────────────────────────────────────────────────
  const DeckTab = () => (
    <div className="vlt-deck-layout">
      {/* Left: Deck slots */}
      <div className="vlt-deck-panel">
        <div className="vlt-deck-panel-head">
          <div className="vlt-deck-panel-title">
            <Package size={16} />
            <span>Context Deck</span>
          </div>
          <div className="vlt-deck-count">
            <span className={`vlt-deck-count-num ${deckIds.length === DECK_SIZE ? 'full' : ''}`}>
              {deckIds.length}<span className="vlt-deck-count-of">/{DECK_SIZE}</span>
            </span>
            {deckIds.length > 0 && (
              <button className="vlt-deck-clear" onClick={clearDeck}>
                <X size={12} /> Clear deck
              </button>
            )}
          </div>
        </div>

        {deckIds.length === 0 && (
          <p className="vlt-deck-hint">
            Select up to 8 documents from the right panel. When your deck has cards,
            the AI will <strong>only</strong> reference those sources for context.
          </p>
        )}

        <div className="vlt-deck-slots">
          {Array.from({ length: DECK_SIZE }, (_, i) => {
            const id  = deckIds[i];
            const doc = id ? allDocs.get(id) : null;
            const isHs = doc ? !userDocs.some(d => (d.doc_id || d.id) === id) : false;
            return (
              <div
                key={i}
                className={`vlt-slot ${doc ? 'vlt-slot--filled' : 'vlt-slot--empty'}`}
              >
                {doc ? (
                  <>
                    <div className="vlt-slot-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="vlt-slot-icon">
                      {isHs ? <Users size={14} /> : <Lock size={14} />}
                    </div>
                    <div className="vlt-slot-body">
                      <div className="vlt-slot-name" title={doc.filename || doc.title}>
                        {doc.filename || doc.title || 'Untitled'}
                      </div>
                      {doc.subject && (
                        <div className="vlt-slot-subject"
                          style={{ color: CAT_COLORS[doc.subject] || 'var(--accent)' }}>
                          {subjectLabel(doc.subject)}
                        </div>
                      )}
                      {doc.chunk_count > 0 && (
                        <div className="vlt-slot-chunks">{doc.chunk_count} chunks</div>
                      )}
                    </div>
                    <button
                      className="vlt-slot-remove"
                      onClick={() => removeFromDeck(id)}
                      aria-label="Remove from deck"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="vlt-slot-num">{String(i + 1).padStart(2, '0')}</div>
                    <Plus size={16} className="vlt-slot-plus" />
                    <span className="vlt-slot-empty-label">Empty slot</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {deckIds.length > 0 && (
          <div className="vlt-deck-active-banner">
            <Zap size={13} />
            <span>AI will reference only these {deckIds.length} source{deckIds.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Right: All docs to browse & add */}
      <div className="vlt-deck-browser">
        <div className="vlt-deck-browser-head">
          <span>Browse Sources</span>
          <div className="vlt-deck-browser-search">
            <Search size={13} />
            <input
              placeholder="Search…"
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Your docs */}
        {filteredUserDocs.length > 0 && (
          <div className="vlt-browser-section">
            <div className="vlt-browser-section-label">
              <Lock size={11} /> Your Documents
            </div>
            {filteredUserDocs.map(doc => {
              const id  = doc.doc_id || doc.id;
              const sel = deckSet.has(id);
              const full = !sel && deckIds.length >= DECK_SIZE;
              return (
                <button
                  key={id}
                  className={`vlt-browser-item ${sel ? 'vlt-browser-item--sel' : ''} ${full ? 'vlt-browser-item--full' : ''}`}
                  onClick={() => sel ? removeFromDeck(id) : addToDeck(id)}
                  disabled={full}
                >
                  <div className="vlt-browser-check">
                    {sel ? <Check size={13} /> : <Plus size={13} />}
                  </div>
                  <div className="vlt-browser-info">
                    <div className="vlt-browser-name">{doc.filename || 'Untitled'}</div>
                    <div className="vlt-browser-meta">
                      {doc.subject && <span>{subjectLabel(doc.subject)}</span>}
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                      {doc.file_size && <span>{fmtBytes(doc.file_size)}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* HS docs */}
        {hsDocs.length > 0 && (
          <div className="vlt-browser-section">
            <div className="vlt-browser-section-label">
              <Users size={11} /> Curriculum Books
            </div>
            {hsDocs
              .filter(d => !docSearch || (d.filename||'').toLowerCase().includes(docSearch.toLowerCase()))
              .map(doc => {
                const id  = doc.doc_id || doc.id;
                const sel = deckSet.has(id);
                const full = !sel && deckIds.length >= DECK_SIZE;
                return (
                  <button
                    key={id}
                    className={`vlt-browser-item ${sel ? 'vlt-browser-item--sel' : ''} ${full ? 'vlt-browser-item--full' : ''}`}
                    onClick={() => sel ? removeFromDeck(id) : addToDeck(id)}
                    disabled={full}
                  >
                    <div className="vlt-browser-check">
                      {sel ? <Check size={13} /> : <Plus size={13} />}
                    </div>
                    <div className="vlt-browser-info">
                      <div className="vlt-browser-name">{doc.filename || 'Untitled'}</div>
                      <div className="vlt-browser-meta">
                        {doc.subject && <span style={{ color: CAT_COLORS[doc.subject] || 'var(--accent)' }}>{subjectLabel(doc.subject)}</span>}
                        {doc.grade_level && <span>Yr {doc.grade_level}</span>}
                        {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        )}

        {userDocs.length === 0 && hsDocs.length === 0 && !loading && (
          <div className="vlt-browser-empty">
            <Library size={28} />
            <p>No documents yet. Upload your first document in the Your Docs tab.</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── RECENT TAB ────────────────────────────────────────────────────────────
  const RecentTab = () => (
    <div className="vlt-recent">
      <div className="vlt-recent-head">
        <span>Activity Feed</span>
        <button className="vlt-recent-refresh" onClick={() => setRecentKey(k => k + 1)}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {recentLoading ? (
        <div className="vlt-state-center">
          <Loader2 size={24} className="vlt-spin" />
          <p>Loading activity…</p>
        </div>
      ) : recent.length === 0 ? (
        <div className="vlt-state-center">
          <Clock size={32} />
          <p>No recent activity yet.</p>
        </div>
      ) : (
        <div className="vlt-recent-list">
          {recent.map((item, i) => (
            <div
              key={i}
              className="vlt-recent-item"
              onClick={() => navigate(item.route)}
              role="button"
              tabIndex={0}
            >
              <div className="vlt-recent-icon" style={{ background: `${recentColor(item.icon)}18`, color: recentColor(item.icon) }}>
                {recentIcon(item.icon)}
              </div>
              <div className="vlt-recent-body">
                <div className="vlt-recent-title">{item.title}</div>
                <div className="vlt-recent-meta">
                  <span className="vlt-recent-type"
                    style={{ color: recentColor(item.icon) }}>
                    {item.type}
                  </span>
                  {item.meta && <span>{item.meta}</span>}
                  {item.date && <span>{fmtDate(item.date)}</span>}
                </div>
              </div>
              <ChevronRight size={15} className="vlt-recent-arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── MY DOCS TAB ───────────────────────────────────────────────────────────
  const MyDocsTab = () => (
    <div className="vlt-mydocs">
      {/* Upload panel */}
      <div className="vlt-upload-panel">
        <div className="vlt-upload-panel-head">
          <Upload size={15} />
          <span>Upload Document</span>
        </div>
        <div className="vlt-upload-row">
          <input
            className="vlt-upload-subject"
            placeholder="Subject (optional)"
            value={uploadSubject}
            onChange={e => setUploadSubject(e.target.value)}
          />
          <label className={`vlt-upload-btn ${uploading ? 'vlt-upload-btn--busy' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.docx,.md"
              style={{ display: 'none' }}
              onChange={e => handleUpload(e.target.files[0])}
              disabled={uploading}
            />
            {uploading ? <><Loader2 size={14} className="vlt-spin" /> Uploading…</> : <><Upload size={14} /> Choose File</>}
          </label>
        </div>
        {uploadError && <div className="vlt-upload-msg vlt-upload-msg--error"><AlertCircle size={13} />{uploadError}</div>}
        {uploadOk    && <div className="vlt-upload-msg vlt-upload-msg--ok"><Check size={13} />{uploadOk}</div>}
        <p className="vlt-upload-hint">PDF, DOCX, TXT or Markdown · max 50 MB</p>
      </div>

      {/* Search */}
      <div className="vlt-doc-search">
        <Search size={14} />
        <input
          placeholder="Search your documents…"
          value={docSearch}
          onChange={e => setDocSearch(e.target.value)}
        />
        {docSearch && <button className="vlt-doc-search-clear" onClick={() => setDocSearch('')}><X size={13}/></button>}
      </div>

      {/* Doc grid */}
      {loading ? (
        <div className="vlt-state-center"><Loader2 size={24} className="vlt-spin" /><p>Loading…</p></div>
      ) : filteredUserDocs.length === 0 ? (
        <div className="vlt-state-center">
          <Library size={32} />
          <h3>{userDocs.length === 0 ? 'No documents yet' : 'No results'}</h3>
          <p>{userDocs.length === 0 ? 'Upload your first PDF, DOCX, or text file above.' : 'Try a different search.'}</p>
        </div>
      ) : (
        <div className="vlt-doc-grid">
          {filteredUserDocs.map(doc => {
            const id   = doc.doc_id || doc.id;
            const name = doc.filename || doc.title || 'Untitled';
            const sel  = deckSet.has(id);
            return (
              <div key={id} className={`vlt-doc-card ${sel ? 'vlt-doc-card--decked' : ''}`}>
                <div className="vlt-doc-card-top">
                  <div className="vlt-doc-card-num">
                    {sel && <span className="vlt-doc-deck-badge"><Zap size={9} /> IN DECK</span>}
                  </div>
                  <div className="vlt-doc-card-actions">
                    <button
                      className={`vlt-doc-deck-btn ${sel ? 'vlt-doc-deck-btn--remove' : ''}`}
                      onClick={() => sel ? removeFromDeck(id) : addToDeck(id)}
                      disabled={!sel && deckIds.length >= DECK_SIZE}
                      title={sel ? 'Remove from deck' : deckIds.length >= DECK_SIZE ? 'Deck full' : 'Add to deck'}
                    >
                      {sel ? <X size={12} /> : <Plus size={12} />}
                      {sel ? 'Remove' : 'Add to Deck'}
                    </button>
                    <button
                      className="vlt-doc-del-btn"
                      onClick={() => handleDelete(id, name)}
                      disabled={deleting === id}
                      aria-label="Delete"
                    >
                      {deleting === id ? <Loader2 size={12} className="vlt-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>

                <FileText size={22} className="vlt-doc-card-icon" />
                <div className="vlt-doc-card-name" title={name}>{name}</div>

                <div className="vlt-doc-card-meta">
                  {doc.subject && (
                    <span className="vlt-doc-card-tag" style={{ color: CAT_COLORS[doc.subject] || 'var(--accent)' }}>
                      {subjectLabel(doc.subject)}
                    </span>
                  )}
                  {doc.chunk_count > 0 && <span className="vlt-doc-card-tag">{doc.chunk_count} chunks</span>}
                  {doc.file_size && <span className="vlt-doc-card-tag">{fmtBytes(doc.file_size)}</span>}
                </div>

                {doc.ai_summary && (
                  <p className="vlt-doc-card-summary">{doc.ai_summary}</p>
                )}

                {Array.isArray(doc.topic_tags) && doc.topic_tags.length > 0 && (
                  <div className="vlt-doc-card-tags">
                    {doc.topic_tags.slice(0, 4).map((t, i) => (
                      <span key={i} className="vlt-pill">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── CURRICULUM TAB ────────────────────────────────────────────────────────
  const currSubjectCats = useMemo(() => {
    const cats = new Map();
    currSubjects.forEach(s => {
      if (!cats.has(s.cat)) cats.set(s.cat, []);
      cats.get(s.cat).push(s);
    });
    return Array.from(cats.entries());
  }, [currSubjects]);

  const CurriculumTab = () => {
    return (
      <div className="vlt-curriculum">
        {/* Curriculum selector */}
        <div className="vlt-curr-selector">
          {['uk', 'us'].map(c => (
            <button
              key={c}
              className={`vlt-curr-btn ${currMode === c ? 'vlt-curr-btn--active' : ''}`}
              onClick={() => { setCurrMode(c); setCurrSubject(null); }}
            >
              {c === 'uk' ? '🇬🇧 UK High School' : '🇺🇸 US High School'}
            </button>
          ))}
        </div>

        {/* Subject grid */}
        <div className="vlt-curr-grid">
          <button
            className={`vlt-curr-subject ${!currSubject ? 'vlt-curr-subject--active' : ''}`}
            onClick={() => setCurrSubject(null)}
          >
            <span className="vlt-curr-subject-name">All Subjects</span>
            <span className="vlt-curr-subject-count">{hsDocs.length}</span>
          </button>
          {currSubjectCats.map(([, subs]) => subs.map(s => {
            const matchCount = hsDocs.filter(d =>
              (d.subject || '').toLowerCase().replace(/ /g,'_') === s.id ||
              (d.subject || '').toLowerCase().includes(s.name.toLowerCase())
            ).length;
            if (matchCount === 0) return null;
            return (
              <button
                key={s.id}
                className={`vlt-curr-subject ${currSubject === s.id ? 'vlt-curr-subject--active' : ''}`}
                onClick={() => setCurrSubject(currSubject === s.id ? null : s.id)}
                style={currSubject === s.id ? { borderColor: CAT_COLORS[s.cat], color: CAT_COLORS[s.cat] } : {}}
              >
                <span className="vlt-curr-subject-cat" style={{ color: CAT_COLORS[s.cat] || 'var(--accent)' }}>
                  {s.cat}
                </span>
                <span className="vlt-curr-subject-name">{s.name}</span>
                <span className="vlt-curr-subject-count">{matchCount}</span>
              </button>
            );
          }))}
        </div>

        {/* Books for selected subject */}
        <div className="vlt-curr-books">
          {filteredHsDocs.length === 0 ? (
            <div className="vlt-state-center">
              <BookOpen size={28} />
              <p>{currSubject ? 'No books for this subject yet.' : 'No curriculum books available.'}</p>
            </div>
          ) : (
            <div className="vlt-doc-grid">
              {filteredHsDocs.map(doc => {
                const id  = doc.doc_id || doc.id;
                const sel = deckSet.has(id);
                const full = !sel && deckIds.length >= DECK_SIZE;
                return (
                  <div key={id} className={`vlt-doc-card vlt-doc-card--hs ${sel ? 'vlt-doc-card--decked' : ''}`}>
                    <div className="vlt-doc-card-top">
                      <span className="vlt-hs-badge"><Users size={9} /> Curriculum</span>
                      <button
                        className={`vlt-doc-deck-btn ${sel ? 'vlt-doc-deck-btn--remove' : ''}`}
                        onClick={() => sel ? removeFromDeck(id) : addToDeck(id)}
                        disabled={full}
                        title={sel ? 'Remove from deck' : full ? 'Deck full' : 'Add to deck'}
                      >
                        {sel ? <><Check size={12} /> In Deck</> : <><Plus size={12} /> Add</>}
                      </button>
                    </div>
                    <BookOpen size={22} className="vlt-doc-card-icon" />
                    <div className="vlt-doc-card-name" title={doc.filename}>{doc.filename || 'Untitled'}</div>
                    <div className="vlt-doc-card-meta">
                      {doc.subject && (
                        <span className="vlt-doc-card-tag" style={{ color: CAT_COLORS[doc.subject] || 'var(--accent)' }}>
                          {subjectLabel(doc.subject)}
                        </span>
                      )}
                      {doc.grade_level && <span className="vlt-doc-card-tag">Yr {doc.grade_level}</span>}
                      {doc.chunk_count > 0 && <span className="vlt-doc-card-tag">{doc.chunk_count} chunks</span>}
                    </div>
                    {doc.ai_summary && <p className="vlt-doc-card-summary">{doc.ai_summary}</p>}
                    {Array.isArray(doc.topic_tags) && doc.topic_tags.length > 0 && (
                      <div className="vlt-doc-card-tags">
                        {doc.topic_tags.slice(0, 3).map((t, i) => <span key={i} className="vlt-pill">{t}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="vlt-root">
      <AbstractFx variant="circles" />

      <div className="vlt-bg-fx" aria-hidden>
        <div className="vlt-bg-orb vlt-bg-orb-1" />
        <div className="vlt-bg-orb vlt-bg-orb-2" />
        <div className="vlt-bg-dots" />
        <div className="vlt-bg-vignette" />
      </div>

      {/* Topbar */}
      <div className="vlt-topbar">
        <button className="vlt-back-btn" onClick={() => navigate('/dashboard-cerbyl')}>
          <ArrowLeft size={15} /> Dashboard
        </button>
        <div className="vlt-topbar-brand">vault<span className="vlt-period">.</span></div>
        <div className="vlt-topbar-right">
          <button className="vlt-nav-link" onClick={() => navigate('/search-hub')}>Search Hub</button>
          <button className="vlt-nav-link" onClick={() => navigate('/ai-chat')}>AI Chat</button>
        </div>
      </div>

      <main className="vlt-main">
        {/* Hero */}
        <section className="vlt-hero">
          <div className="vlt-hero-left">
            <div className="vlt-eyebrow">KNOWLEDGE VAULT</div>
            <h1 className="vlt-title">Your Context<span className="vlt-period">.</span></h1>
            <p className="vlt-subtitle">Manage your documents, curriculum books, and AI context deck</p>
          </div>
          <div className="vlt-stat-row">
            {[
              { num: String(stats.deck).padStart(2,'0'),   lbl: 'IN DECK',    sub: `of ${DECK_SIZE}`, accent: true },
              { num: String(stats.myDocs).padStart(2,'0'), lbl: 'YOUR DOCS' },
              { num: String(stats.books).padStart(2,'0'),  lbl: 'BOOKS' },
              { num: stats.chunks,                          lbl: 'CHUNKS' },
            ].map(s => (
              <div key={s.lbl} className={`vlt-stat ${s.accent ? 'vlt-stat--accent' : ''}`}>
                <div className="vlt-stat-num">{s.num}</div>
                <div className="vlt-stat-lbl">{s.lbl}</div>
                {s.sub && <div className="vlt-stat-sub">{s.sub}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Tabs */}
        <div className="vlt-tabs">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`vlt-tab ${activeTab === t.id ? 'vlt-tab--active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon size={14} />
                {t.label}
                {t.id === 'deck' && deckIds.length > 0 && (
                  <span className="vlt-tab-badge">{deckIds.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="vlt-tab-content">
          {activeTab === 'deck'       && <DeckTab />}
          {activeTab === 'recent'     && <RecentTab />}
          {activeTab === 'mydocs'     && <MyDocsTab />}
          {activeTab === 'curriculum' && <CurriculumTab />}
        </div>
      </main>
    </div>
  );
};

export default Vault;
