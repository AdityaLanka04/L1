import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Target, Brain, MessageSquare,
  CheckCircle, Activity, Zap, RefreshCw, Cpu, Menu
} from 'lucide-react';
import './Weaknesses.css';
import { API_URL } from '../config';
import WeaknessTracker from '../components/WeaknessTracker/WeaknessTracker';
import RLInsights from '../components/RLInsights/RLInsights';

const Weaknesses = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');

  const [activeView, setActiveView] = useState('weak-areas');
  const [loading, setLoading] = useState(true);
  const [weakAreasData, setWeakAreasData] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadWeakAreas();
  }, []);

  const loadWeakAreas = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/study_insights/strengths_weaknesses?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWeakAreasData(data);
      }
    } catch (error) {
      console.error('Error loading weak areas:', error); // silenced
    } finally {
      setLoading(false);
    }
  };

  const handleTopicClick = (topic) => {
    navigate(`/weakness-tips/${encodeURIComponent(topic)}`);
  };

  const getFilteredAreas = () => {
    if (!weakAreasData?.weak_areas) return [];
    if (filterCategory === 'all') {
      return [
        ...(weakAreasData.weak_areas.critical || []),
        ...(weakAreasData.weak_areas.needs_practice || []),
        ...(weakAreasData.weak_areas.improving || [])
      ];
    }
    return weakAreasData.weak_areas[filterCategory] || [];
  };

  const criticalCount = weakAreasData?.summary?.critical_count || 0;
  const needsPracticeCount = weakAreasData?.summary?.needs_practice_count || 0;
  const improvingCount = weakAreasData?.summary?.improving_count || 0;
  const totalCount = criticalCount + needsPracticeCount + improvingCount;

  if (loading) {
    return (
      <div className="wk-container">
        <div className="wk-loading">
          <div className="wk-loading-dots">
            <span /><span /><span />
          </div>
          <p>ANALYZING YOUR PERFORMANCE</p>
        </div>
      </div>
    );
  }

  const filteredAreas = getFilteredAreas();

  return (
    <div className="wk-container">
      <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="600" cy="40" r="5" fill="currentColor"/>
        <circle cx="600" cy="760" r="5" fill="currentColor"/>
        <circle cx="240" cy="400" r="5" fill="currentColor"/>
        <circle cx="960" cy="400" r="5" fill="currentColor"/>
        <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
        <rect x="24" y="24" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="44" y="44" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="60" cy="60" r="3" fill="currentColor"/>
        <rect x="1104" y="704" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <rect x="1124" y="724" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
        <circle cx="1140" cy="740" r="3" fill="currentColor"/>
        <circle cx="120" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="160" r="1.5" fill="currentColor"/>
        <circle cx="200" cy="200" r="2" fill="currentColor"/>
        <circle cx="160" cy="240" r="1.5" fill="currentColor"/>
        <circle cx="1080" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="640" r="1.5" fill="currentColor"/>
        <circle cx="1000" cy="600" r="2" fill="currentColor"/>
        <circle cx="1040" cy="560" r="1.5" fill="currentColor"/>
      </svg>
      <header className="wk-header">
        <div className="wk-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="wk-logo" onClick={() => navigate('/search-hub')}>
            <div className="wk-logo-img" />
            cerbyl
          </h1>
          <div className="wk-header-divider" />
          <span className="wk-subtitle">INTELLIGENCE</span>
        </div>
        <nav className="wk-header-right">
          {activeView === 'weak-areas' && (
            <button className="wk-nav-btn wk-nav-btn-accent" onClick={loadWeakAreas}>
              <RefreshCw size={15} />
              Refresh
            </button>
          )}
          <button className="wk-nav-btn wk-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="wk-layout">
        <aside className="wk-sidebar">
          <nav className="wk-sidebar-nav">
            <button
              className={`wk-sidebar-item ${activeView === 'weak-areas' ? 'active' : ''}`}
              onClick={() => setActiveView('weak-areas')}
            >
              <Activity size={16} />
              <span>Weak Areas</span>
              {totalCount > 0 && <span className="wk-count">{totalCount}</span>}
            </button>
            <button
              className={`wk-sidebar-item ${activeView === 'intelligence' ? 'active' : ''}`}
              onClick={() => setActiveView('intelligence')}
            >
              <Cpu size={16} />
              <span>Intelligence</span>
            </button>
            <button
              className={`wk-sidebar-item ${activeView === 'how-i-learn' ? 'active' : ''}`}
              onClick={() => setActiveView('how-i-learn')}
            >
              <Brain size={16} />
              <span>How I Learn</span>
            </button>
          </nav>

          {activeView === 'weak-areas' && totalCount > 0 && (
            <div className="wk-sidebar-stats">
              {criticalCount > 0 && (
                <div className="wk-stat-pill wk-stat-critical">
                  <span className="wk-stat-num">{criticalCount}</span>
                  <span className="wk-stat-lbl">Critical</span>
                </div>
              )}
              {needsPracticeCount > 0 && (
                <div className="wk-stat-pill wk-stat-practice">
                  <span className="wk-stat-num">{needsPracticeCount}</span>
                  <span className="wk-stat-lbl">Practice</span>
                </div>
              )}
              {improvingCount > 0 && (
                <div className="wk-stat-pill wk-stat-improving">
                  <span className="wk-stat-num">{improvingCount}</span>
                  <span className="wk-stat-lbl">Improving</span>
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="wk-main">
          {activeView === 'weak-areas' && (
            <>
              <div className="wk-view-header">
                <span className="wk-view-kicker">Performance Analysis</span>
                <h2 className="wk-view-title">Weak Areas</h2>
                <p className="wk-view-sub">
                  {totalCount > 0
                    ? `${totalCount} area${totalCount !== 1 ? 's' : ''} identified across your activity`
                    : 'No weak areas detected'}
                </p>
              </div>

              {totalCount > 0 && (
                <div className="wk-filter-row">
                  {[
                    { key: 'all', label: 'All Areas', count: null },
                    { key: 'critical', label: 'Critical', count: criticalCount },
                    { key: 'needs_practice', label: 'Needs Practice', count: needsPracticeCount },
                    { key: 'improving', label: 'Improving', count: improvingCount },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      className={`wk-filter-pill ${filterCategory === key ? 'active' : ''} wk-filter-${key}`}
                      onClick={() => setFilterCategory(key)}
                    >
                      {label}
                      {count !== null && <span className="wk-filter-count">{count}</span>}
                    </button>
                  ))}
                </div>
              )}

              {filteredAreas.length === 0 ? (
                <div className="wk-empty">
                  <CheckCircle size={56} />
                  <h3>No weak areas detected</h3>
                  <p>You're performing well across all tracked topics. Keep learning to build your profile.</p>
                  <button className="wk-cta-btn" onClick={() => navigate('/ai-chat')}>
                    <Zap size={16} />
                    Start Learning
                  </button>
                </div>
              ) : (
                <div className="wk-bento-grid">
                  {filteredAreas.map((area, idx) => (
                    <WeaknessCard
                      key={idx}
                      area={area}
                      onClick={() => handleTopicClick(area.topic)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === 'intelligence' && (
            <>
              <div className="wk-view-header">
                <span className="wk-view-kicker">AI-Powered Insights</span>
                <h2 className="wk-view-title">Intelligence</h2>
                <p className="wk-view-sub">Deep analysis of your learning patterns and concept mastery</p>
              </div>
              <div className="wk-component-wrapper">
                <WeaknessTracker userId={userName} token={token} onNavigate={navigate} />
              </div>
            </>
          )}

          {activeView === 'how-i-learn' && (
            <>
              <div className="wk-view-header">
                <span className="wk-view-kicker">Adaptive Strategy</span>
                <h2 className="wk-view-title">How I Learn</h2>
                <p className="wk-view-sub">Your personalized teaching strategy profile, powered by reinforcement learning</p>
              </div>
              <div className="wk-component-wrapper">
                <RLInsights userName={userName} token={token} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Weaknesses;

// ==================== WEAKNESS CARD ====================

const WeaknessCard = ({ area, onClick }) => {
  const cat = area.category;
  const accuracy = area.accuracy ?? 0;

  const catColor = {
    critical: '#ef4444',
    needs_practice: '#f59e0b',
    improving: '#10b981',
  }[cat] || '#6b7280';

  const catLabel = {
    critical: 'Critical',
    needs_practice: 'Needs Practice',
    improving: 'Improving',
  }[cat] || cat;

  const hasMetrics = area.sources?.includes('quiz') || area.sources?.includes('flashcard');
  const correct = (area.total_attempts || 0) - (area.total_wrong || 0);

  return (
    <div className={`wk-card wk-card--${cat}`} onClick={onClick}>
      <div className="wk-card-header">
        <div className="wk-card-badges">
          {area.sources?.includes('quiz') && <span className="wk-badge wk-badge--quiz">Quiz</span>}
          {area.sources?.includes('flashcard') && <span className="wk-badge wk-badge--card">Cards</span>}
          {area.sources?.includes('chat') && <span className="wk-badge wk-badge--chat">Chat</span>}
        </div>
        <span className="wk-card-cat" style={{ color: catColor }}>{catLabel}</span>
      </div>

      <h3 className="wk-card-topic">{area.topic || 'Unknown Topic'}</h3>

      {area.chat_analysis?.is_doubtful && (
        <p className="wk-card-hint">
          <MessageSquare size={11} />
          Asked {area.chat_analysis.mentions} time{area.chat_analysis.mentions !== 1 ? 's' : ''} in chat
        </p>
      )}

      {area.flashcard_performance?.is_weak && (area.flashcard_performance?.struggling_cards?.length > 0) && (
        <p className="wk-card-hint">
          <Brain size={11} />
          {area.flashcard_performance.struggling_cards.length} struggling card{area.flashcard_performance.struggling_cards.length !== 1 ? 's' : ''}
        </p>
      )}

      {hasMetrics && (
        <>
          <div className="wk-card-bar-wrap">
            <div className="wk-card-bar-track">
              <div
                className="wk-card-bar-fill"
                style={{ width: `${accuracy}%`, background: catColor }}
              />
            </div>
            <span className="wk-card-pct" style={{ color: catColor }}>{accuracy}%</span>
          </div>

          <div className="wk-card-metrics">
            <div className="wk-metric">
              <span className="wk-metric-val" style={{ color: '#10b981' }}>{correct}</span>
              <span className="wk-metric-lbl">Correct</span>
            </div>
            <div className="wk-metric">
              <span className="wk-metric-val" style={{ color: '#ef4444' }}>{area.total_wrong || 0}</span>
              <span className="wk-metric-lbl">Wrong</span>
            </div>
            <div className="wk-metric">
              <span className="wk-metric-val">{area.total_attempts || 0}</span>
              <span className="wk-metric-lbl">Total</span>
            </div>
          </div>
        </>
      )}

      <button
        className="wk-card-btn"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Target size={13} />
        Analyze
      </button>
    </div>
  );
};
