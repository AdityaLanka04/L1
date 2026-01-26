import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, Target, Brain, MessageSquare, BookOpen, 
  TrendingUp, AlertTriangle, CheckCircle, Lightbulb, 
  Activity, Zap, X, ArrowRight, Play, RefreshCw
} from 'lucide-react';
import './Weaknesses.css';
import { API_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const Weaknesses = () => {
  const navigate = useNavigate();
  const { selectedTheme } = useTheme();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(true);
  const [weakAreasData, setWeakAreasData] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicSuggestions, setTopicSuggestions] = useState(null);
  const [similarQuestions, setSimilarQuestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  const tokens = selectedTheme?.tokens || {};
  const accent = tokens['--accent'] || '#D7B38C';

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

  const loadTopicSuggestions = async (topic) => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch(`${API_URL}/study_insights/topic_suggestions?user_id=${userName}&topic=${encodeURIComponent(topic)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTopicSuggestions(data);
      }
    } catch (error) {
      console.error('Error loading topic suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadSimilarQuestions = async (topic) => {
    setLoadingQuestions(true);
    try {
      const response = await fetch(`${API_URL}/study_insights/similar_questions?user_id=${userName}&topic=${encodeURIComponent(topic)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSimilarQuestions(data);
      }
    } catch (error) {
      console.error('Error loading similar questions:', error);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
    loadTopicSuggestions(topic);
    loadSimilarQuestions(topic);
  };

  const closeTopicModal = () => {
    setSelectedTopic(null);
    setTopicSuggestions(null);
    setSimilarQuestions(null);
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
          <h1 className="weaknesses-logo" onClick={() => navigate('/dashboard')}>
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
                  onClick={() => handleTopicClick(area.topic)}
                  onPractice={() => navigate('/ai-chat', { state: { initialMessage: `Help me practice ${area.topic}` }})}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Topic Detail Modal */}
      {selectedTopic && (
        <TopicDetailModal
          topic={selectedTopic}
          suggestions={topicSuggestions}
          questions={similarQuestions}
          loadingSuggestions={loadingSuggestions}
          loadingQuestions={loadingQuestions}
          onClose={closeTopicModal}
          onPracticeAll={() => {
            closeTopicModal();
            navigate('/question-bank', { state: { topic: selectedTopic }});
          }}
        />
      )}
    </div>
  );
};

export default Weaknesses;

// ==================== WEAKNESS CARD ====================

const WeaknessCard = ({ area, onClick, onPractice }) => {
  const getCategoryColor = (category) => {
    switch(category) {
      case 'critical': return '#ef4444';
      case 'needs_practice': return '#f59e0b';
      case 'improving': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getCategoryLabel = (category) => {
    switch(category) {
      case 'critical': return 'CRITICAL';
      case 'needs_practice': return 'NEEDS PRACTICE';
      case 'improving': return 'IMPROVING';
      default: return 'WEAK';
    }
  };

  const categoryColor = getCategoryColor(area.category);
  const hasQuizOrFlashcard = area.sources?.includes('quiz') || area.sources?.includes('flashcard');

  return (
    <div className={`weakness-card ${area.category}`} onClick={onClick}>
      <div 
        className="card-cover" 
        style={{ 
          background: `linear-gradient(135deg, ${categoryColor}22 0%, ${categoryColor}55 100%)`
        }}
      >
        <div className="cover-overlay">
          <Target size={32} strokeWidth={1.5} />
        </div>
        {/* Source tags in top corner */}
        <div className="card-sources-top">
          {area.sources?.includes('quiz') && <span className="source-badge quiz">QUIZ</span>}
          {area.sources?.includes('flashcard') && <span className="source-badge flashcard">FLASHCARD</span>}
          {area.sources?.includes('chat') && <span className="source-badge chat">CHAT</span>}
        </div>
      </div>

      <div className="card-content">
        <h3 className="card-title">{area.topic}</h3>
        
        {/* Subtitle indicators below title */}
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
        
        {/* Only show accuracy for quiz/flashcard */}
        {hasQuizOrFlashcard && (
          <div className="card-accuracy">
            <span className="accuracy-label">ACCURACY</span>
            <span className="accuracy-value" style={{ color: categoryColor }}>{area.accuracy}%</span>
          </div>
        )}

        {/* Only show stats for quiz/flashcard */}
        {hasQuizOrFlashcard && (
          <div className="card-stats">
            <div className="stat">
              <span className="stat-label">Total</span>
              <span className="stat-value">{area.total_attempts}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Wrong</span>
              <span className="stat-value">{area.total_wrong}</span>
            </div>
          </div>
        )}

        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          <button className="practice-btn" onClick={onPractice}>
            <Play size={16} />
            <span>PRACTICE</span>
          </button>
          <button className="tips-btn" onClick={onClick}>
            <Lightbulb size={16} />
            <span>TIPS</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== TOPIC DETAIL MODAL ====================

const TopicDetailModal = ({ 
  topic, 
  suggestions, 
  questions, 
  loadingSuggestions, 
  loadingQuestions, 
  onClose, 
  onPracticeAll 
}) => {
  return (
    <div className="topic-modal-overlay" onClick={onClose}>
      <div className="topic-modal" onClick={(e) => e.stopPropagation()}>
        <div className="topic-modal-header">
          <h2>{topic}</h2>
          <button className="topic-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="topic-modal-content">
          {/* Suggestions Section */}
          {loadingSuggestions ? (
            <div className="topic-modal-loading">
              <div className="loading-spinner-weak"></div>
              <p>GENERATING SUGGESTIONS...</p>
            </div>
          ) : suggestions?.suggestions?.length > 0 && (
            <div className="topic-modal-section">
              <h3><Lightbulb size={18} /> PERSONALIZED SUGGESTIONS</h3>
              <div className="suggestions-list">
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div key={idx} className={`suggestion-card ${suggestion.priority}`}>
                    <div className="suggestion-header">
                      <span className="suggestion-title">{suggestion.title}</span>
                      <span className={`suggestion-priority ${suggestion.priority}`}>{suggestion.priority}</span>
                    </div>
                    <p className="suggestion-description">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Study Tips */}
          {suggestions?.study_tips?.length > 0 && (
            <div className="topic-modal-section">
              <h3><BookOpen size={18} /> STUDY TIPS</h3>
              <ul className="tips-list">
                {suggestions.study_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Similar Questions */}
          {loadingQuestions ? (
            <div className="topic-modal-loading">
              <div className="loading-spinner-weak"></div>
              <p>FINDING SIMILAR QUESTIONS...</p>
            </div>
          ) : questions?.similar_questions?.length > 0 && (
            <div className="topic-modal-section">
              <h3><Activity size={18} /> SIMILAR QUESTIONS ({questions.total_found})</h3>
              <div className="questions-list">
                {questions.similar_questions.slice(0, 5).map((question, idx) => (
                  <div key={idx} className="question-card">
                    <div className="question-header">
                      <span className="question-number">Q{idx + 1}</span>
                      <span className={`question-difficulty ${question.difficulty}`}>{question.difficulty}</span>
                      {question.is_new && <span className="question-new-badge">NEW</span>}
                    </div>
                    <p className="question-text">{question.question_text}</p>
                    {!question.is_new && question.user_answer && (
                      <div className="question-history">
                        <span className="question-your-answer">Your answer: {question.user_answer}</span>
                        <span className="question-correct-answer">Correct: {question.correct_answer}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="practice-all-btn" onClick={onPracticeAll}>
                <ArrowRight size={18} />
                <span>PRACTICE ALL QUESTIONS</span>
              </button>
            </div>
          )}
          
          {/* Empty state */}
          {!loadingSuggestions && !loadingQuestions && 
           !suggestions?.suggestions?.length && 
           !questions?.similar_questions?.length && (
            <div className="topic-modal-empty">
              <Brain size={48} />
              <p>No additional data available for this topic yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
