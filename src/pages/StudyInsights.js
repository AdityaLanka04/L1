import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './StudyInsights.css';
import { API_URL } from '../config';

const StudyInsights = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('overall'); // 'session' or 'overall'

  const userName = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Check if study insights is enabled
    const profile = localStorage.getItem('userProfile');
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        if (parsed.showStudyInsights === false) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch (e) {}
    }
    
    loadComprehensiveInsights();
  }, [timeRange]); // Reload when timeRange changes

  const loadComprehensiveInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching insights from:', `${API_URL}/study_insights/comprehensive?user_id=${userName}&time_range=${timeRange}`);
      
      const response = await fetch(`${API_URL}/study_insights/comprehensive?user_id=${userName}&time_range=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Insights data:', data);
        setInsights(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        setError(errorData.detail || `Error: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading insights:', err);
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = () => {
    const profile = localStorage.getItem('userProfile');
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        if (parsed.firstName) return parsed.firstName;
        if (parsed.first_name) return parsed.first_name;
      } catch (e) {}
    }
    if (userName && userName.includes('@')) {
      return userName.split('@')[0];
    }
    return userName || 'there';
  };

  if (loading) {
    return (
      <div className="study-insights-page">
        <div className="insights-loading">
          <span className="loading-text">ANALYZING YOUR STUDY DATA</span>
          <div className="insights-spinner">
            <div className="spinner-cube"></div>
            <div className="spinner-cube"></div>
            <div className="spinner-cube"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="study-insights-page">
        <div className="insights-error">
          <p>Unable to load insights</p>
          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '10px' }}>{error}</p>}
          <button onClick={loadComprehensiveInsights} style={{ marginRight: '10px' }}>Retry</button>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const hasData = insights.activity_breakdown && 
    (insights.activity_breakdown.ai_chats > 0 || 
     insights.activity_breakdown.quizzes_completed > 0 ||
     insights.activity_breakdown.flashcards_reviewed > 0);

  return (
    <div className="study-insights-page">
      <header className="insights-header">
        <div className="header-content">
          <span className="header-username">{getDisplayName()}</span>
          <h1 className="header-title">comprehensive insights</h1>
          <div className="header-right">
            <div className="time-range-toggle">
              <button 
                className={`toggle-btn ${timeRange === 'session' ? 'active' : ''}`}
                onClick={() => setTimeRange('session')}
              >
                THIS SESSION
              </button>
              <button 
                className={`toggle-btn ${timeRange === 'overall' ? 'active' : ''}`}
                onClick={() => setTimeRange('overall')}
              >
                OVERALL
              </button>
            </div>
            <button className="header-btn secondary" onClick={() => navigate('/search-hub')}>
              SEARCH HUB
            </button>
            <button className="header-btn primary" onClick={() => navigate('/dashboard')}>
              DASHBOARD
            </button>
          </div>
        </div>
      </header>

      <main className="insights-main">
        <div className="bento-grid">
          {/* AI Summary - Full width */}
          <div className="bento-item bento-summary">
            <h2 className="bento-title">AI SUMMARY</h2>
            <p className="summary-text">{insights.ai_summary}</p>
          </div>

          {/* Time & Activity Stats */}
          <div className="bento-item bento-time-stats">
            <h2 className="bento-title">STUDY TIME</h2>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{insights.time_stats?.weekly_study_minutes || 0}</div>
                <div className="stat-label">Minutes This Week</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{insights.time_stats?.day_streak || 0}</div>
                <div className="stat-label">Day Streak</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{insights.time_stats?.total_points || 0}</div>
                <div className="stat-label">Total Points</div>
              </div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="bento-item bento-activity">
            <h2 className="bento-title">WEEKLY ACTIVITY</h2>
            <div className="activity-list">
              <div className="activity-row">
                <span className="activity-label">AI Chats</span>
                <span className="activity-value">{insights.activity_breakdown?.ai_chats || 0}</span>
              </div>
              <div className="activity-row">
                <span className="activity-label">Quizzes Completed</span>
                <span className="activity-value">{insights.activity_breakdown?.quizzes_completed || 0}</span>
              </div>
              <div className="activity-row">
                <span className="activity-label">Flashcards Reviewed</span>
                <span className="activity-value">{insights.activity_breakdown?.flashcards_reviewed || 0}</span>
              </div>
              <div className="activity-row">
                <span className="activity-label">Questions Answered</span>
                <span className="activity-value">{insights.activity_breakdown?.questions_answered || 0}</span>
              </div>
              <div className="activity-row">
                <span className="activity-label">Notes Created</span>
                <span className="activity-value">{insights.activity_breakdown?.notes_created || 0}</span>
              </div>
            </div>
          </div>

          {/* Quiz Performance */}
          <div className="bento-item bento-quiz-performance">
            <h2 className="bento-title">QUIZ PERFORMANCE</h2>
            {insights.quizzes?.total_quizzes > 0 ? (
              <>
                <div className="quiz-summary">
                  <div className="quiz-stat-large">
                    <div className="quiz-score">{insights.quizzes.average_score}%</div>
                    <div className="quiz-label">Average Score</div>
                  </div>
                  <div className="quiz-stat-small">
                    <div className="quiz-count">{insights.quizzes.total_quizzes}</div>
                    <div className="quiz-label">Quizzes Taken</div>
                  </div>
                </div>
                <div className="difficulty-breakdown">
                  <div className="diff-item">
                    <span className="diff-label">Easy</span>
                    <span className="diff-score">{insights.quizzes.by_difficulty?.easy?.average || 0}%</span>
                  </div>
                  <div className="diff-item">
                    <span className="diff-label">Medium</span>
                    <span className="diff-score">{insights.quizzes.by_difficulty?.intermediate?.average || 0}%</span>
                  </div>
                  <div className="diff-item">
                    <span className="diff-label">Hard</span>
                    <span className="diff-score">{insights.quizzes.by_difficulty?.hard?.average || 0}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No quizzes completed yet</p>
                <button className="start-btn-small" onClick={() => navigate('/quiz-hub')}>
                  Take a Quiz
                </button>
              </div>
            )}
          </div>

          {/* Flashcard Performance */}
          <div className="bento-item bento-flashcard-performance">
            <h2 className="bento-title">FLASHCARD MASTERY</h2>
            {insights.flashcards?.total > 0 ? (
              <>
                <div className="flashcard-stats">
                  <div className="fc-stat">
                    <div className="fc-value">{insights.flashcards.total}</div>
                    <div className="fc-label">Total Cards</div>
                  </div>
                  <div className="fc-stat">
                    <div className="fc-value">{insights.flashcards.mastered}</div>
                    <div className="fc-label">Mastered</div>
                  </div>
                  <div className="fc-stat">
                    <div className="fc-value">{insights.flashcards.mastery_rate}%</div>
                    <div className="fc-label">Mastery Rate</div>
                  </div>
                </div>
                {insights.flashcards.struggling && insights.flashcards.struggling.length > 0 && (
                  <div className="struggling-cards">
                    <div className="struggling-title">Needs Practice:</div>
                    {insights.flashcards.struggling.slice(0, 3).map((card, idx) => (
                      <div key={idx} className="struggling-card">
                        <div className="card-question">{card.question}</div>
                        <div className="card-accuracy">{card.accuracy}% accuracy</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No flashcards created yet</p>
                <button className="start-btn-small" onClick={() => navigate('/flashcards')}>
                  Create Flashcards
                </button>
              </div>
            )}
          </div>

          {/* Weak Areas */}
          <div className="bento-item bento-weak-areas">
            <h2 className="bento-title">WEAK AREAS TO IMPROVE</h2>
            {insights.weak_areas && insights.weak_areas.length > 0 ? (
              <div className="weak-areas-list">
                {insights.weak_areas.slice(0, 5).map((area, idx) => (
                  <div key={idx} className="weak-area-row">
                    <div className="weak-area-info">
                      <div className="weak-area-topic">{area.topic}</div>
                      {area.subtopic && <div className="weak-area-subtopic">{area.subtopic}</div>}
                    </div>
                    <div className="weak-area-stats">
                      <div className="weak-area-accuracy" style={{
                        color: area.accuracy < 50 ? '#ef4444' : area.accuracy < 70 ? '#f59e0b' : '#10b981'
                      }}>
                        {area.accuracy}%
                      </div>
                      <div className="weak-area-priority">
                        Priority: {area.priority}/10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No weak areas identified yet</p>
                <p className="empty-hint">Complete quizzes to track your progress</p>
              </div>
            )}
          </div>

          {/* Recent Quizzes */}
          {insights.quizzes?.recent_quizzes && insights.quizzes.recent_quizzes.length > 0 && (
            <div className="bento-item bento-recent-quizzes">
              <h2 className="bento-title">RECENT QUIZ RESULTS</h2>
              <div className="recent-quizzes-list">
                {insights.quizzes.recent_quizzes.slice(0, 5).map((quiz, idx) => (
                  <div key={idx} className="recent-quiz-row">
                    <div className="quiz-info">
                      <div className="quiz-title">{quiz.title}</div>
                      <div className="quiz-meta">
                        {quiz.difficulty} • {quiz.question_count} questions
                      </div>
                    </div>
                    <div className="quiz-score-badge" style={{
                      backgroundColor: quiz.score >= 80 ? '#10b981' : quiz.score >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {quiz.score}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Bank Stats */}
          <div className="bento-item bento-question-bank">
            <h2 className="bento-title">QUESTION BANK</h2>
            {insights.question_bank?.total_questions > 0 ? (
              <div className="qb-stats">
                <div className="qb-stat">
                  <div className="qb-value">{insights.question_bank.total_questions}</div>
                  <div className="qb-label">Total Questions</div>
                </div>
                <div className="qb-stat">
                  <div className="qb-value">{insights.question_bank.completed_questions}</div>
                  <div className="qb-label">Completed</div>
                </div>
                <div className="qb-stat">
                  <div className="qb-value">{insights.question_bank.average_accuracy}%</div>
                  <div className="qb-label">Accuracy</div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p className="empty-text">No question sets yet</p>
                <button className="start-btn-small" onClick={() => navigate('/question-bank')}>
                  Create Questions
                </button>
              </div>
            )}
          </div>

          {/* Topics Studied */}
          {insights.session_data?.specific_topics && insights.session_data.specific_topics.length > 0 && (
            <div className="bento-item bento-topics">
              <h2 className="bento-title">TOPICS STUDIED</h2>
              <div className="topics-list">
                {insights.session_data.specific_topics.slice(0, 6).map((topic, idx) => (
                  <div key={idx} className="topic-row" onClick={() => navigate('/ai-chat', {
                    state: { initialMessage: `Help me practice ${topic.name}` }
                  })}>
                    <span className="topic-name">{topic.name}</span>
                    <span className="topic-count">{topic.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Notes */}
          {insights.notes?.recent_notes && insights.notes.recent_notes.length > 0 && (
            <div className="bento-item bento-recent-notes">
              <h2 className="bento-title">RECENT NOTES</h2>
              <div className="notes-list">
                {insights.notes.recent_notes.map((note) => (
                  <div key={note.id} className="note-row" onClick={() => navigate(`/notes-redesign?note_id=${note.id}`)}>
                    <span className="note-title">{note.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no data */}
          {!hasData && (
            <div className="bento-item bento-empty">
              <h2 className="bento-title">GET STARTED</h2>
              <p className="empty-text">
                Start studying to see your comprehensive insights here.
              </p>
              <button className="start-btn" onClick={() => navigate('/ai-chat')}>
                START STUDYING
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudyInsights;
