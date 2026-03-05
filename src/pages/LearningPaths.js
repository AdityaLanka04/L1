import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Loader, BookOpen, Target, Clock, Award,
  CheckCircle, Play, Trash2,
  Sparkles, Route, Map, Circle, Search,
  SlidersHorizontal, ArrowUpDown, Menu, ChevronRight
} from 'lucide-react';
import learningPathService from '../services/learningPathService';
import './LearningPaths.css';

const LearningPaths = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    
    
    if (location.state?.autoGenerate && location.state?.topic) {
      setTopicPrompt(location.state.topic);
      setDifficulty(location.state.difficulty || 'intermediate');
      setLength(location.state.length || 'medium');
      setShowCreateModal(true);
      
      
      setTimeout(() => {
        handleCreatePath();
      }, 500);
      
      
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
    const total = paths.length;
    const active = paths.filter(p => (p.status || 'active') === 'active').length;
    const completed = paths.filter(p => p.status === 'completed').length;
    const avgProgress = active
      ? Math.round(
          paths
            .filter(p => (p.status || 'active') === 'active')
            .reduce((sum, p) => sum + (p.progress?.completion_percentage || 0), 0) / active
        )
      : 0;
    const hoursRemaining = paths.reduce((sum, p) => {
      const pct = p.progress?.completion_percentage || 0;
      const totalHours = p.estimated_hours || 0;
      return sum + totalHours * (1 - pct / 100);
    }, 0);

    return {
      total,
      active,
      completed,
      avgProgress,
      hoursRemaining: Math.max(0, Math.round(hoursRemaining))
    };
  }, [paths]);

  const filteredPaths = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = paths.filter((path) => {
      const status = path.status || 'active';
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) return true;
      const haystack = [
        path.title,
        path.description,
        path.topic_prompt
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'progress') {
        return (b.progress?.completion_percentage || 0) - (a.progress?.completion_percentage || 0);
      }
      if (sortBy === 'time') {
        return (a.estimated_hours || 0) - (b.estimated_hours || 0);
      }
      if (sortBy === 'az') {
        return (a.title || '').localeCompare(b.title || '');
      }
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });

    return sorted;
  }, [paths, statusFilter, searchTerm, sortBy]);

  const handleCreatePath = async () => {
    if (!topicPrompt.trim()) {
      alert('Please enter a topic');
      return;
    }

    try {
      setGenerating(true);
      const goalsArray = goals.split('\n').filter(g => g.trim()).map(g => g.trim());
      
      const response = await learningPathService.generatePath(topicPrompt, {
        difficulty,
        length,
        goals: goalsArray
      });

      if (response.success) {
        setShowCreateModal(false);
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

  const handleDeletePath = async (pathId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Delete this learning path? This cannot be undone.')) {
      return;
    }

    try {
      await learningPathService.deletePath(pathId);
      await loadPaths();
    } catch (error) {
      console.error('Error deleting path:', error);
      alert('Failed to delete path');
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'beginner': return '#4ade80';
      case 'intermediate': return '#fbbf24';
      case 'advanced': return '#f87171';
      default: return '#94a3b8';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle size={20} color="#4ade80" />;
      case 'active': return <Play size={20} color="#3b82f6" />;
      default: return <Circle size={20} color="#94a3b8" />;
    }
  };

  if (loading) {
    return (
      <div className="lp-container">
        <div className="lp-loading">
          <Loader className="lp-spinner" size={40} />
          <p>Loading learning paths...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-container">
      <header className="lp-header">
        <div className="lp-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <div className="lp-header-logo" onClick={() => navigate('/search-hub')}>
            <div className="lp-header-logo-img" />
            cerbyl
          </div>
          <div className="lp-header-divider"></div>
          <p className="lp-header-subtitle">LEARNING PATHS</p>
        </div>
        <div className="lp-header-right">
          <button className="lp-back-btn" onClick={() => navigate('/dashboard')}>
            Dashboard
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="lp-layout-body">
        <aside className="lp-sidebar">
          <div className="lp-sidebar-section">
            <h3 className="lp-sidebar-heading">Browse</h3>
            <nav className="lp-sidebar-menu">
              <button
                className={`lp-nav-item ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                <Route size={18} />
                <span>All Paths</span>
              </button>
              <button
                className={`lp-nav-item ${statusFilter === 'active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('active')}
              >
                <Play size={18} />
                <span>Active</span>
              </button>
              <button
                className={`lp-nav-item ${statusFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('completed')}
              >
                <CheckCircle size={18} />
                <span>Completed</span>
              </button>
            </nav>
          </div>
          
          <div className="lp-sidebar-divider"></div>
          
          <div className="lp-sidebar-stats">
            <div className="lp-stat-box">
              <div className="lp-stat-value">{summary.total}</div>
              <div className="lp-stat-label">Total Paths</div>
            </div>
          </div>
        </aside>

        <main className="lp-main">
          <section className="lp-toolbar">
            <div className="lp-toolbar-left">
              <button className="lp-toolbar-create" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} />
                Create
              </button>
              <div className="lp-toolbar-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search paths, topics, or goals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="lp-toolbar-controls">
              <div className="lp-toolbar-filter">
                <SlidersHorizontal size={16} />
                <span>Filter</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="lp-toolbar-sort">
                <ArrowUpDown size={16} />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="recent">Most Recent</option>
                  <option value="progress">Progress</option>
                  <option value="time">Time Remaining</option>
                  <option value="az">A → Z</option>
                </select>
              </div>
            </div>
          </section>

          <div className="lp-content">
            {filteredPaths.length === 0 ? (
              <div className="lp-empty-state">
                <div className="lp-empty-icon">
                  <Map size={64} />
                </div>
                <h2>{paths.length === 0 ? 'No Learning Paths Yet' : 'No Matches Found'}</h2>
                <p>
                  {paths.length === 0
                    ? 'Create your first learning path to start your structured learning journey.'
                    : 'Try adjusting your search or filters to find the right path.'}
                </p>
                <button className="lp-empty-create-btn" onClick={() => setShowCreateModal(true)}>
                  <Sparkles size={20} />
                  Generate Learning Path
                </button>
              </div>
            ) : (
              <div className="lp-paths-grid">
                {filteredPaths.map(path => {
                  const progressPct = Math.round(path.progress?.completion_percentage || 0);
                  const status = path.status || 'active';
                  return (
                    <div
                      key={path.id}
                      className="lp-path-card"
                      onClick={() => navigate(`/learning-paths/${path.id}`)}
                    >
                      <div className="lp-path-header">
                        <div className="lp-path-status">
                          {getStatusIcon(status)}
                        </div>
                        <button
                          className="lp-path-menu"
                          onClick={(e) => handleDeletePath(path.id, e)}
                          title="Delete path"
                          aria-label="Delete learning path"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="lp-path-content">
                        <h3>{path.title}</h3>
                        <p className="lp-path-description">{path.description}</p>

                        <div className="lp-path-meta">
                          <div className="lp-path-meta-item">
                            <Target size={16} />
                            <span
                              className="lp-difficulty-badge"
                              style={{ backgroundColor: getDifficultyColor(path.difficulty) }}
                            >
                              {path.difficulty}
                            </span>
                          </div>
                          <div className="lp-path-meta-item">
                            <Clock size={16} />
                            <span>{Math.round(path.estimated_hours || 0)}h</span>
                          </div>
                          <div className="lp-path-meta-item">
                            <BookOpen size={16} />
                            <span>{path.total_nodes} nodes</span>
                          </div>
                        </div>

                        <div className="lp-path-progress">
                          <div className="lp-progress-bar">
                            <div
                              className="lp-progress-fill"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="lp-progress-text">
                            <span>{path.completed_nodes} / {path.total_nodes} completed</span>
                            <span className="lp-progress-xp">
                              <Award size={14} />
                              {path.progress.total_xp_earned} XP
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreateModal && (
        <div className="lp-modal-overlay" onClick={() => !generating && setShowCreateModal(false)}>
          <div className="lp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lp-modal-header">
              <h2>
                <Sparkles size={24} />
                Generate Learning Path
              </h2>
              <button
                className="lp-modal-close"
                onClick={() => setShowCreateModal(false)}
                disabled={generating}
              >
                ×
              </button>
            </div>

            <div className="lp-modal-content">
              <div className="lp-form-group">
                <label>What do you want to learn?</label>
                <input
                  type="text"
                  placeholder="e.g., Data Structures in Python, Machine Learning Basics, Spanish Grammar..."
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value)}
                  disabled={generating}
                  autoFocus
                />
              </div>

              <div className="lp-form-row">
                <div className="lp-form-group">
                  <label>Difficulty Level</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    disabled={generating}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div className="lp-form-group">
                  <label>Path Length</label>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    disabled={generating}
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
              </div>

              <div className="lp-form-group">
                <label>Learning Goals (optional)</label>
                <textarea
                  placeholder="Enter your learning goals, one per line..."
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  disabled={generating}
                  rows={4}
                />
              </div>
            </div>

            <div className="lp-modal-footer">
              <button
                className="lp-btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={generating}
              >
                Cancel
              </button>
              <button
                className="lp-btn-primary"
                onClick={handleCreatePath}
                disabled={generating || !topicPrompt.trim()}
              >
                {generating ? (
                  <>
                    <Loader className="lp-spinner" size={16} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Path
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningPaths;
