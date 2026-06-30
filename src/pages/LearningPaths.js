import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Loader,
  Plus,
  Play,
  Route,
  Search,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import learningPathService from '../services/learningPathService';
import './LearningPaths.css';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'progress', label: 'Progress' },
  { key: 'time', label: 'Shortest' },
  { key: 'az', label: 'A–Z' },
];

const DIFFICULTY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

const SUGGESTED_TOPICS = [
  'System design for AI products',
  'React performance architecture',
  'Advanced calculus for ML',
  'Data structures in Python',
];

const LearningPaths = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState('library');

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const [topicPrompt, setTopicPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [length, setLength] = useState('medium');
  const [goals, setGoals] = useState('');

  useEffect(() => { loadPaths(); }, []);

  useEffect(() => {
    if (location.state?.autoGenerate && location.state?.topic) {
      setTopicPrompt(location.state.topic);
      setDifficulty(location.state.difficulty || 'intermediate');
      setLength(location.state.length || 'medium');
      setView('generator');
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadPaths = async () => {
    try {
      setLoading(true);
      const response = await learningPathService.getPaths();
      setPaths(response.paths || []);
    } catch (error) {
      console.error('Error loading paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const active = paths.filter(p => (p.status || 'active') === 'active');
    const completed = paths.filter(p => p.status === 'completed').length;
    const avgProgress = active.length
      ? Math.round(active.reduce((s, p) => s + (p.progress?.completion_percentage || 0), 0) / active.length)
      : 0;
    const hoursRemaining = Math.max(0, Math.round(
      paths.reduce((s, p) => s + (p.estimated_hours || 0) * (1 - (p.progress?.completion_percentage || 0) / 100), 0)
    ));
    return { total: paths.length, active: active.length, completed, avgProgress, hoursRemaining };
  }, [paths]);

  const filteredPaths = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return paths
      .filter(p => {
        if (statusFilter !== 'all' && (p.status || 'active') !== statusFilter) return false;
        if (!q) return true;
        return [p.title, p.description, p.topic_prompt].filter(Boolean).join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'progress') return (b.progress?.completion_percentage || 0) - (a.progress?.completion_percentage || 0);
        if (sortBy === 'time') return (a.estimated_hours || 0) - (b.estimated_hours || 0);
        if (sortBy === 'az') return (a.title || '').localeCompare(b.title || '');
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      });
  }, [paths, searchTerm, sortBy, statusFilter]);

  const handleCreatePath = async () => {
    const topic = topicPrompt.trim();
    if (!topic) return;
    try {
      setGenerating(true);
      const response = await learningPathService.generatePath(topic, {
        difficulty,
        length,
        goals: goals.split('\n').map(g => g.trim()).filter(Boolean),
      });
      if (response.success) {
        setTopicPrompt('');
        setGoals('');
        navigate(`/learning-paths/${response.path_id}`);
      }
    } catch (error) {
      console.error('Error creating path:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePath = async (pathId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this learning path? This cannot be undone.')) return;
    try {
      await learningPathService.deletePath(pathId);
      setPaths(prev => prev.filter(p => p.id !== pathId));
    } catch (error) {
      console.error('Error deleting path:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreatePath();
  };

  return (
    <div className="lp-shell">
      {/* ── Geo background ── */}
      <svg className="lp-geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="1200" cy="150" r="420" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="1200" cy="150" r="280" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <circle cx="1200" cy="150" r="150" fill="none" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="150" cy="750" r="260" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <circle cx="150" cy="750" r="140" fill="none" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="0" y1="0" x2="1400" y2="900" stroke="currentColor" strokeWidth="0.3"/>
        <line x1="0" y1="900" x2="700" y2="0" stroke="currentColor" strokeWidth="0.25"/>
        <circle cx="1200" cy="150" r="4" fill="currentColor" opacity="0.5"/>
        <circle cx="150" cy="750" r="3" fill="currentColor" opacity="0.4"/>
        <circle cx="700" cy="450" r="2" fill="currentColor" opacity="0.3"/>
      </svg>

      {/* ── Collapsed strip ── */}
      {!sidebarOpen && (
        <div className="lp-strip">
          <button className="lp-strip-btn" title="Expand sidebar" onClick={() => setSidebarOpen(true)}>
            <ChevronRight size={18} />
          </button>
          <button className="lp-strip-btn" title="New path" onClick={() => { setSidebarOpen(true); setView('generator'); }}>
            <Plus size={18} />
          </button>
          <button className={`lp-strip-btn ${view === 'library' ? 'active' : ''}`} title="Library" onClick={() => setView('library')}>
            <Route size={18} />
          </button>
          <div className="lp-strip-spacer" />
          <button className="lp-strip-btn" title="Dashboard" onClick={() => navigate('/dashboard-cerbyl')}>
            <LayoutDashboard size={18} />
          </button>
        </div>
      )}

      {/* ── Expanded sidebar ── */}
      {sidebarOpen && (
        <aside className="lp-sidebar">
          {/* Brand */}
          <div className="lp-side-brand">
            <div className="lp-side-brand-wrap">
              <div className="lp-side-brand-name"><span>LEARNING,</span> PATHS</div>
            </div>
            <button className="lp-side-close" onClick={() => setSidebarOpen(false)}>
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* New Path button */}
          <div className="lp-side-block">
            <button className="lp-new-btn" onClick={() => setView('generator')}>
              <Plus size={15} /> New Path
            </button>
          </div>

          {/* Search */}
          <div className="lp-side-block">
            <div className="lp-side-search">
              <Search size={13} />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search paths…"
                type="search"
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="lp-side-block lp-side-filters">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={`lp-filter-pill ${statusFilter === key ? 'active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
                <span>{key === 'all' ? summary.total : key === 'active' ? summary.active : summary.completed}</span>
              </button>
            ))}
          </div>

          {/* Path list */}
          <nav className="lp-side-nav">
            {loading ? (
              <div className="lp-side-loading"><Loader className="lp-spin" size={16} /></div>
            ) : filteredPaths.length === 0 ? (
              <div className="lp-side-empty">
                <Route size={20} strokeWidth={1.5} />
                <span>{paths.length ? 'No matches' : 'No paths yet'}</span>
              </div>
            ) : filteredPaths.map(path => {
              const pct = Math.round(path.progress?.completion_percentage || 0);
              return (
                <div
                  key={path.id}
                  className="lp-side-item"
                  onClick={() => navigate(`/learning-paths/${path.id}`)}
                >
                  <div className="lp-side-item-body">
                    <span className="lp-side-item-title">{path.title}</span>
                    <div className="lp-side-item-track">
                      <div className="lp-side-item-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button
                    className="lp-side-item-del"
                    onClick={e => handleDeletePath(path.id, e)}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="lp-side-footer">
            <button className="lp-side-footer-btn" onClick={() => navigate('/dashboard-cerbyl')}>
              <LayoutDashboard size={15} /> Dashboard
            </button>
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main className="lp-main">

        {/* Generator view */}
        {view === 'generator' && (
          <div className="lp-gen-view">
            <div className="lp-gen-inner">
              <div className="lp-gen-head">
                <span className="lp-gen-kicker">AI-Powered</span>
                <h1 className="lp-gen-title">New Learning Path</h1>
                <p className="lp-gen-sub">Describe what you want to master — AI builds a structured curriculum for you</p>
              </div>

              <div className="lp-gen-form">
                <div className="lp-gen-field">
                  <label className="lp-gen-label">Topic</label>
                  <textarea
                    className="lp-gen-textarea lp-gen-textarea--lg"
                    value={topicPrompt}
                    onChange={e => setTopicPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. learn backend system design for high-traffic AI apps"
                    rows={3}
                  />
                </div>

                <div className="lp-gen-chips">
                  {SUGGESTED_TOPICS.map(topic => (
                    <button key={topic} className="lp-gen-chip" type="button" onClick={() => setTopicPrompt(topic)}>
                      {topic}
                    </button>
                  ))}
                </div>

                <div className="lp-gen-row">
                  <div className="lp-gen-field">
                    <label className="lp-gen-label">Difficulty</label>
                    <div className="lp-seg">
                      {['beginner', 'intermediate', 'advanced'].map(level => (
                        <button
                          key={level}
                          type="button"
                          className={difficulty === level ? 'active' : ''}
                          onClick={() => setDifficulty(level)}
                        >
                          {DIFFICULTY_LABELS[level]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="lp-gen-field">
                    <label className="lp-gen-label">Length</label>
                    <div className="lp-seg">
                      {['short', 'medium', 'long'].map(item => (
                        <button
                          key={item}
                          type="button"
                          className={length === item ? 'active' : ''}
                          onClick={() => setLength(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lp-gen-field">
                  <label className="lp-gen-label">Goals <span className="lp-gen-optional">optional · one per line</span></label>
                  <textarea
                    className="lp-gen-textarea"
                    value={goals}
                    onChange={e => setGoals(e.target.value)}
                    placeholder="e.g. Build a REST API&#10;Understand authentication flows"
                    rows={3}
                  />
                </div>

                <div className="lp-gen-actions">
                  <button
                    className="lp-gen-btn"
                    onClick={handleCreatePath}
                    disabled={generating || !topicPrompt.trim()}
                  >
                    {generating
                      ? <><Loader className="lp-spin" size={17} /> Generating…</>
                      : <><Sparkles size={17} /> Generate Path</>}
                  </button>
                  <button className="lp-gen-cancel" onClick={() => setView('library')}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Library view */}
        {view === 'library' && (
          <div className="lp-lib-view">
            {/* Header */}
            <div className="lp-lib-header">
              <div>
                <span className="lp-lib-kicker">Your Collection</span>
                <h1 className="lp-lib-title">Learning Paths</h1>
              </div>
              <div className="lp-lib-stats">
                <div className="lp-lib-stat">
                  <strong>{summary.total}</strong>
                  <span>Total</span>
                </div>
                <div className="lp-lib-stat">
                  <strong>{summary.avgProgress}%</strong>
                  <span>Avg Progress</span>
                </div>
                <div className="lp-lib-stat">
                  <strong>{summary.hoursRemaining}h</strong>
                  <span>Remaining</span>
                </div>
              </div>
            </div>

            {/* Sort bar */}
            <div className="lp-lib-controls">
              {SORTS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`lp-sort-btn ${sortBy === key ? 'active' : ''}`}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Cards / empty */}
            {loading ? (
              <div className="lp-lib-loading"><Loader className="lp-spin" size={28} /></div>
            ) : filteredPaths.length === 0 ? (
              <div className="lp-lib-empty">
                <div className="lp-empty-ring">
                  <Route size={26} strokeWidth={1.5} />
                </div>
                <span className="lp-empty-kicker">Empty Collection</span>
                <h3 className="lp-empty-title">{paths.length ? 'No Matches Found' : 'No Learning Paths Yet'}</h3>
                <p className="lp-empty-sub">
                  {paths.length
                    ? 'Try adjusting your filters or search term'
                    : 'Create your first AI-powered structured curriculum'}
                </p>
                {!paths.length && (
                  <button className="lp-empty-cta" onClick={() => setView('generator')}>
                    <Plus size={14} /> New Path
                  </button>
                )}
              </div>
            ) : (
              <div className="lp-card-grid">
                {filteredPaths.map(path => {
                  const pct = Math.round(path.progress?.completion_percentage || 0);
                  return (
                    <article
                      key={path.id}
                      className="lp-card"
                      onClick={() => navigate(`/learning-paths/${path.id}`)}
                    >
                      <div className="lp-card-top">
                        <span className={`lp-card-diff lp-card-diff--${path.difficulty || 'intermediate'}`}>
                          {path.difficulty || 'intermediate'}
                        </span>
                        <div className="lp-card-top-right">
                          <span className={`lp-card-status lp-card-status--${path.status || 'active'}`}>
                            {path.status === 'completed' ? <CheckCircle size={11} /> : <Play size={11} />}
                            {path.status || 'active'}
                          </span>
                          <button
                            className="lp-card-del"
                            onClick={e => handleDeletePath(path.id, e)}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <h3 className="lp-card-title">{path.title}</h3>
                      <p className="lp-card-desc">{path.description || path.topic_prompt}</p>

                      <div className="lp-card-meta">
                        <span><Clock size={12} /> {Math.round(path.estimated_hours || 0)}h</span>
                        <span><BookOpen size={12} /> {path.completed_nodes || 0}/{path.total_nodes || 0} nodes</span>
                        <span><Target size={12} /> {path.difficulty || 'intermediate'}</span>
                      </div>

                      <div className="lp-card-footer">
                        <div className="lp-card-bar-wrap">
                          <div className="lp-card-bar">
                            <div className="lp-card-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="lp-card-pct">{pct}%</span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LearningPaths;
