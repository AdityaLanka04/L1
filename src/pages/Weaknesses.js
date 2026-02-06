import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Target, Brain, MessageSquare, 
  TrendingUp, AlertTriangle, CheckCircle, 
  Activity, Zap, RefreshCw
, Menu} from 'lucide-react';
import './Weaknesses.css';
import { API_URL } from '../config';

const Weaknesses = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
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
      console.error('Error loading weak areas:', error);
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

  if (loading) {
    return (
      <div className="weaknesses-page">
        <div className="weaknesses-loading">
          <div className="loading-spinner-weak"></div>
          <p>ANALYZING YOUR PERFORMANCE...</p>
        </div>
      </div>
    );
  }

  const filteredAreas = getFilteredAreas();
  const criticalCount = weakAreasData?.summary?.critical_count || 0;
  const needsPracticeCount = weakAreasData?.summary?.needs_practice_count || 0;
  const improvingCount = weakAreasData?.summary?.improving_count || 0;

  return (
    <div className="weaknesses-container">
      {/* Header */}
      <header className="weaknesses-header">
        <div className="weaknesses-header-left">
          <button className="nav-menu-btn" onClick={() => navigate('/dashboard')} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="weaknesses-logo" onClick={() => navigate('/search-hub')}>
            <div className="weaknesses-logo-img" />
            cerbyl
          </h1>
          <div className="weaknesses-header-divider"></div>
          <span className="weaknesses-subtitle">WEAK AREAS ANALYSIS</span>
        </div>
        <nav className="weaknesses-header-right">
          <button className="weaknesses-nav-btn weaknesses-nav-btn-accent" onClick={loadWeakAreas}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button className="weaknesses-nav-btn weaknesses-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="weaknesses-body">
        {/* Sidebar */}
        <aside className="weaknesses-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-heading">FILTER BY SEVERITY</h3>
            <nav className="sidebar-menu">
              <button 
                className={`menu-item ${filterCategory === 'all' ? 'active' : ''}`}
                onClick={() => setFilterCategory('all')}
              >
                <Activity size={18} />
                <span>All Areas</span>
                {filterCategory === 'all' && <div className="active-indicator"></div>}
              </button>
              
              <button 
                className={`menu-item ${filterCategory === 'critical' ? 'active' : ''}`}
                onClick={() => setFilterCategory('critical')}
              >
                <AlertTriangle size={18} />
                <span>Critical</span>
                {filterCategory === 'critical' && <div className="active-indicator"></div>}
              </button>
              
              <button 
                className={`menu-item ${filterCategory === 'needs_practice' ? 'active' : ''}`}
                onClick={() => setFilterCategory('needs_practice')}
              >
                <Target size={18} />
                <span>Needs Practice</span>
                {filterCategory === 'needs_practice' && <div className="active-indicator"></div>}
              </button>
              
              <button 
                className={`menu-item ${filterCategory === 'improving' ? 'active' : ''}`}
                onClick={() => setFilterCategory('improving')}
              >
                <TrendingUp size={18} />
                <span>Improving</span>
                {filterCategory === 'improving' && <div className="active-indicator"></div>}
              </button>
            </nav>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-stats">
            <div className="stat-box critical-stat">
              <div className="stat-value">{criticalCount}</div>
              <div className="stat-label">CRITICAL</div>
            </div>
            <div className="stat-box needs-practice-stat">
              <div className="stat-value">{needsPracticeCount}</div>
              <div className="stat-label">NEEDS PRACTICE</div>
            </div>
            <div className="stat-box improving-stat">
              <div className="stat-value">{improvingCount}</div>
              <div className="stat-label">IMPROVING</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="weaknesses-main">
          {filteredAreas.length === 0 ? (
            <div className="empty-container">
              <CheckCircle size={64} />
              <h3>NO WEAK AREAS DETECTED!</h3>
              <p>You're doing great! Keep up the excellent work.</p>
              <button className="empty-btn" onClick={() => navigate('/ai-chat')}>
                <Zap size={18} />
                <span>START LEARNING</span>
              </button>
            </div>
          ) : (
            <div className="weaknesses-grid">
              {filteredAreas.map((area, idx) => (
                <WeaknessCard
                  key={idx}
                  area={area}
                  index={idx}
                  onClick={() => handleTopicClick(area.topic)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Weaknesses;

// ==================== WEAKNESS CARD ====================

const WeaknessCard = ({ area, onClick }) => {
  const getCategoryColor = (category) => {
    switch(category) {
      case 'critical': return '#ef4444';
      case 'needs_practice': return '#f59e0b';
      case 'improving': return '#10b981';
      default: return '#6b7280';
    }
  };

  const categoryColor = getCategoryColor(area.category);
  const hasQuizOrFlashcard = area.sources?.includes('quiz') || area.sources?.includes('flashcard');

  return (
    <div className={`weakness-card ${area.category}`}>
      <div 
        className="card-cover" 
        style={{ 
          background: `linear-gradient(135deg, ${categoryColor}22 0%, ${categoryColor}55 100%)`
        }}
      >
        <h3 className="card-cover-title">{area.topic || 'Unknown Topic'}</h3>
        <div className="card-sources-top">
          {area.sources?.includes('quiz') && <span className="source-badge quiz">QUIZ</span>}
          {area.sources?.includes('flashcard') && <span className="source-badge flashcard">FLASHCARD</span>}
          {area.sources?.includes('chat') && <span className="source-badge chat">CHAT</span>}
        </div>
      </div>

      <div className="card-content">
        {area.chat_analysis?.is_doubtful && (
          <div className="card-subtitle doubtful">
            <MessageSquare size={12} />
            <span>Asked {area.chat_analysis.mentions} times</span>
          </div>
        )}

        {area.flashcard_performance?.is_weak && area.flashcard_performance?.struggling_cards?.length > 0 && (
          <div className="card-subtitle struggling">
            <Brain size={12} />
            <span>{area.flashcard_performance.struggling_cards.length} struggling cards</span>
          </div>
        )}
        
        {hasQuizOrFlashcard && (
          <>
            <div className="card-accuracy">
              <span className="accuracy-label">ACCURACY</span>
              <span className="accuracy-value" style={{ color: categoryColor }}>{area.accuracy}%</span>
            </div>
            
            <div className="card-accuracy">
              <span className="accuracy-label">CORRECT</span>
              <span className="accuracy-value">{area.total_attempts - area.total_wrong}</span>
            </div>
            
            <div className="card-accuracy">
              <span className="accuracy-label">WRONG</span>
              <span className="accuracy-value">{area.total_wrong}</span>
            </div>
          </>
        )}

        <div className="card-actions">
          <button className="analyze-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <Target size={16} />
            <span>ANALYZE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
