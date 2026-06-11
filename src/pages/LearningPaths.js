import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle,
  Clock,
  Compass,
  FileSearch,
  LayoutDashboard,
  Loader,
  Map,
  Play,
  Plus,
  Route,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import learningPathService from '../services/learningPathService';
import SocialHubChrome from '../components/SocialHubChrome';
import './LearningPaths.css';

const FILTERS = [
  { key: 'all', label: 'All', icon: Route },
  { key: 'active', label: 'Active', icon: Play },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

const SORTS = [
  { key: 'recent', label: 'Recent' },
  { key: 'progress', label: 'Progress' },
  { key: 'time', label: 'Shortest' },
  { key: 'az', label: 'A-Z' },
];

const DIFFICULTY_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const LearningPaths = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [length, setLength] = useState('medium');
  const [goals, setGoals] = useState('');

  useEffect(() => {
    loadPaths();
  }, []);

  useEffect(() => {
    if (location.state?.autoGenerate && location.state?.topic) {
      setTopicPrompt(location.state.topic);
      setDifficulty(location.state.difficulty || 'intermediate');
      setLength(location.state.length || 'medium');
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
    const activePaths = paths.filter((path) => (path.status || 'active') === 'active');
    const completed = paths.filter((path) => path.status === 'completed').length;
    const totalNodes = paths.reduce((sum, path) => sum + (path.total_nodes || 0), 0);
    const completedNodes = paths.reduce((sum, path) => sum + (path.completed_nodes || 0), 0);
    const avgProgress = activePaths.length
      ? Math.round(activePaths.reduce((sum, path) => sum + (path.progress?.completion_percentage || 0), 0) / activePaths.length)
      : 0;
    const hoursRemaining = paths.reduce((sum, path) => {
      const progress = path.progress?.completion_percentage || 0;
      return sum + (path.estimated_hours || 0) * (1 - progress / 100);
    }, 0);

    return {
      total: paths.length,
      active: activePaths.length,
      completed,
      avgProgress,
      totalNodes,
      completedNodes,
      hoursRemaining: Math.max(0, Math.round(hoursRemaining)),
    };
  }, [paths]);

  const filteredPaths = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = paths.filter((path) => {
      const status = path.status || 'active';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [path.title, path.description, path.topic_prompt]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'progress') {
        return (b.progress?.completion_percentage || 0) - (a.progress?.completion_percentage || 0);
      }
      if (sortBy === 'time') {
        return (a.estimated_hours || 0) - (b.estimated_hours || 0);
      }
      if (sortBy === 'az') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
  }, [paths, searchTerm, sortBy, statusFilter]);

  const featuredPath = filteredPaths[0] || paths[0];
  const suggestedTopics = [
    'System design for AI products',
    'React performance architecture',
    'Advanced calculus for ML',
    'Data structures in Python',
  ];

  const handleCreatePath = async () => {
    const topic = topicPrompt.trim();
    if (!topic) {
      alert('Please enter a topic');
      return;
    }

    try {
      setGenerating(true);
      const response = await learningPathService.generatePath(topic, {
        difficulty,
        length,
        goals: goals.split('\n').map((goal) => goal.trim()).filter(Boolean),
      });

      if (response.success) {
        setTopicPrompt('');
        setGoals('');
        await loadPaths();
        navigate(`/learning-paths/${response.path_id}`);
      }
    } catch (error) {
      console.error('Error creating path:', error);
      alert('Failed to create learning path. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeletePath = async (pathId, event) => {
    event.stopPropagation();
    if (!window.confirm('Delete this learning path? This cannot be undone.')) return;

    try {
      await learningPathService.deletePath(pathId);
      await loadPaths();
    } catch (error) {
      console.error('Error deleting path:', error);
      alert('Failed to delete path');
    }
  };

  const formatDate = (value) => {
    if (!value) return 'Not started';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  };

  const sideSections = [
    {
      label: 'Views',
      items: FILTERS.map(({ key, label, icon: Icon }) => ({
        icon: Icon,
        label,
        active: statusFilter === key,
        count: key === 'all' ? summary.total : key === 'active' ? summary.active : summary.completed,
        onClick: () => setStatusFilter(key),
      })),
    },
    {
      label: 'Sort',
      items: SORTS.map(({ key, label }) => ({
        icon: ArrowUpDown,
        label,
        active: sortBy === key,
        onClick: () => setSortBy(key),
      })),
    },
    {
      label: 'Quick Access',
      items: [
        { icon: Sparkles, label: 'AI Chat', onClick: () => navigate('/ai-chat') },
        { icon: BookOpen, label: 'Flashcards', onClick: () => navigate('/flashcards') },
        { icon: Map, label: 'Knowledge Map', onClick: () => navigate('/knowledge-map') },
      ],
    },
  ];

  const footerItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard-cerbyl' },
  ];

  if (loading) {
    return (
      <div className="lp-page with-social-chrome">
        <div className="lp-loading">
          <Loader className="lp-spin" size={34} />
          <p>Loading learning paths</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-page with-social-chrome">
      <SocialHubChrome
        brandKicker="Learning"
        footerItems={footerItems}
        sideSections={sideSections}
        topbarAction={null}
      >
      <div className="lp-workspace">
        <header className="lp-topbar">
          <div>
            <span className="lp-kicker">Learning Studio</span>
            <h1>Build and run structured paths</h1>
          </div>
          <div className="lp-top-actions">
            <button type="button" onClick={loadPaths}>
              <FileSearch size={16} />
              Refresh
            </button>
            <button className="primary" type="button" onClick={handleCreatePath} disabled={generating || !topicPrompt.trim()}>
              {generating ? <Loader className="lp-spin" size={16} /> : <Plus size={16} />}
              Generate
            </button>
          </div>
        </header>

        <section className="lp-studio-grid">
          <div className="lp-composer">
            <div className="lp-composer-head">
              <div>
                <span className="lp-kicker">New Path</span>
                <h2>Describe the outcome you want</h2>
              </div>
              <Compass size={24} />
            </div>

            <label className="lp-field lp-field-large">
              <span>Topic</span>
              <textarea
                value={topicPrompt}
                onChange={(event) => setTopicPrompt(event.target.value)}
                placeholder="Example: learn backend system design for high-traffic AI apps"
                rows={4}
              />
            </label>

            <div className="lp-segment-row">
              <div className="lp-segment-group" aria-label="Difficulty">
                {['beginner', 'intermediate', 'advanced'].map((level) => (
                  <button
                    key={level}
                    className={difficulty === level ? 'active' : ''}
                    type="button"
                    onClick={() => setDifficulty(level)}
                  >
                    {DIFFICULTY_LABELS[level]}
                  </button>
                ))}
              </div>
              <div className="lp-segment-group compact" aria-label="Length">
                {['short', 'medium', 'long'].map((item) => (
                  <button
                    key={item}
                    className={length === item ? 'active' : ''}
                    type="button"
                    onClick={() => setLength(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <label className="lp-field">
              <span>Goals</span>
              <textarea
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                placeholder="One goal per line"
                rows={3}
              />
            </label>

            <div className="lp-topic-chips" aria-label="Suggested topics">
              {suggestedTopics.map((topic) => (
                <button key={topic} type="button" onClick={() => setTopicPrompt(topic)}>
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div className="lp-dashboard-panel">
            <div className="lp-metric-row">
              <div className="lp-metric">
                <strong>{summary.total}</strong>
                <span>Paths</span>
              </div>
              <div className="lp-metric">
                <strong>{summary.avgProgress}%</strong>
                <span>Avg progress</span>
              </div>
              <div className="lp-metric">
                <strong>{summary.hoursRemaining}</strong>
                <span>Hours left</span>
              </div>
            </div>

            <div className="lp-featured">
              <div className="lp-featured-header">
                <span className="lp-kicker">Continue</span>
                <TrendingUp size={18} />
              </div>
              {featuredPath ? (
                <>
                  <h2>{featuredPath.title}</h2>
                  <p>{featuredPath.description || featuredPath.topic_prompt}</p>
                  <div className="lp-featured-progress">
                    <span>{Math.round(featuredPath.progress?.completion_percentage || 0)}%</span>
                    <div>
                      <i style={{ width: `${featuredPath.progress?.completion_percentage || 0}%` }} />
                    </div>
                  </div>
                  <button type="button" onClick={() => navigate(`/learning-paths/${featuredPath.id}`)}>
                    <Play size={16} />
                    Open path
                  </button>
                </>
              ) : (
                <div className="lp-no-featured">
                  <Zap size={28} />
                  <p>Generate a path to start a focused curriculum.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="lp-library">
          <div className="lp-library-head">
            <div>
              <span className="lp-kicker">Library</span>
              <h2>{filteredPaths.length} learning path{filteredPaths.length === 1 ? '' : 's'}</h2>
            </div>
            <div className="lp-search-box">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search paths"
                type="search"
              />
            </div>
          </div>

          <div className="lp-control-strip">
            <div className="lp-filter-tabs">
              {FILTERS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={statusFilter === key ? 'active' : ''}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                >
                  <Icon size={15} />
                  {label}
                  <span>{key === 'all' ? summary.total : key === 'active' ? summary.active : summary.completed}</span>
                </button>
              ))}
            </div>
            <div className="lp-sort-tabs">
              <ArrowUpDown size={15} />
              {SORTS.map(({ key, label }) => (
                <button
                  key={key}
                  className={sortBy === key ? 'active' : ''}
                  type="button"
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredPaths.length === 0 ? (
            <div className="lp-empty">
              <BookOpen size={40} />
              <h3>{paths.length ? 'No matching paths' : 'No paths yet'}</h3>
              <p>{paths.length ? 'Adjust your filters or search text.' : 'Create your first path from the composer above.'}</p>
            </div>
          ) : (
            <div className="lp-path-list">
              {filteredPaths.map((path, index) => {
                const progress = Math.round(path.progress?.completion_percentage || 0);
                return (
                  <article
                    key={path.id}
                    className="lp-path-row"
                    onClick={() => navigate(`/learning-paths/${path.id}`)}
                  >
                    <div className="lp-path-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="lp-path-main">
                      <div className="lp-path-title-row">
                        <h3>{path.title}</h3>
                        <span className={`lp-status lp-status-${path.status || 'active'}`}>{path.status || 'active'}</span>
                      </div>
                      <p>{path.description || path.topic_prompt}</p>
                      <div className="lp-path-meta">
                        <span><Target size={14} /> {path.difficulty || 'intermediate'}</span>
                        <span><Clock size={14} /> {Math.round(path.estimated_hours || 0)}h</span>
                        <span><BookOpen size={14} /> {path.completed_nodes || 0}/{path.total_nodes || 0} nodes</span>
                        <span>Updated {formatDate(path.updated_at || path.created_at)}</span>
                      </div>
                    </div>
                    <div className="lp-path-progress-cell">
                      <strong>{progress}%</strong>
                      <div className="lp-mini-track"><i style={{ width: `${progress}%` }} /></div>
                    </div>
                    <button
                      className="lp-delete"
                      type="button"
                      title="Delete path"
                      aria-label="Delete learning path"
                      onClick={(event) => handleDeletePath(path.id, event)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      </SocialHubChrome>
    </div>
  );
};

export default LearningPaths;
