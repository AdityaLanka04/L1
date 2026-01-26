import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import './StudyInsights.css';
import { API_URL } from '../config';
import logo from '../assets/logo.svg';

const StudyInsights = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('overall');

  const userName = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
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
  }, [timeRange]);

  const loadComprehensiveInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/study_insights/comprehensive?user_id=${userName}&time_range=${timeRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || `Error: ${response.status}`);
      }
    } catch (err) {
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
      <div className="si-page">
        <div className="si-loading">
          <span className="si-loading-text">ANALYZING YOUR STUDY DATA</span>
          <div className="si-spinner">
            <div className="si-spinner-cube"></div>
            <div className="si-spinner-cube"></div>
            <div className="si-spinner-cube"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="si-page">
        <div className="si-error">
          <p>Unable to load insights</p>
          {error && <p className="si-error-detail">{error}</p>}
          <button className="si-btn" onClick={loadComprehensiveInsights}>Retry</button>
          <button className="si-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const hasData = insights.activity_breakdown && 
    (insights.activity_breakdown.ai_chats > 0 || 
     insights.activity_breakdown.quizzes_completed > 0 ||
     insights.activity_breakdown.flashcards_reviewed > 0);

  return (
    <div className="si-page">
      <header className="si-header">
        <div className="si-header-left">
          <h1 className="si-logo" onClick={() => navigate('/dashboard')}>
            <div className="si-logo-img" />
            cerbyl
          </h1>
          <div className="si-header-divider"></div>
          <span className="si-subtitle">STUDY INSIGHTS</span>
        </div>
        <nav className="si-header-right">
          <div className="si-time-toggle">
            <button 
              className={`si-toggle-btn ${timeRange === 'session' ? 'active' : ''}`}
              onClick={() => setTimeRange('session')}
            >
              THIS SESSION
            </button>
            <button 
              className={`si-toggle-btn ${timeRange === 'overall' ? 'active' : ''}`}
              onClick={() => setTimeRange('overall')}
            >
              OVERALL
            </button>
          </div>
          <button className="si-nav-btn si-nav-btn-ghost" onClick={() => navigate('/search-hub')}>
            <Search size={14} />
            <span>Search Hub</span>
          </button>
          <button className="si-nav-btn si-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <main className="si-main">
        <div className="si-bento-grid">
          {/* AI Summary */}
          <div className="si-bento si-summary">
            <h2 className="si-bento-title">AI SUMMARY</h2>
            <p className="si-summary-text">{insights.ai_summary}</p>
          </div>

          {/* Time Stats */}
          <div className="si-bento si-time-stats">
            <h2 className="si-bento-title">STUDY TIME</h2>
            <div className="si-stats-grid">
              <div className="si-stat">
                <div className="si-stat-value">{insights.time_stats?.weekly_study_minutes || 0}</div>
                <div className="si-stat-label">Minutes This Week</div>
              </div>
              <div className="si-stat">
                <div className="si-stat-value">{insights.time_stats?.day_streak || 0}</div>
                <div className="si-stat-label">Day Streak</div>
              </div>
              <div className="si-stat">
                <div className="si-stat-value">{insights.time_stats?.total_points || 0}</div>
                <div className="si-stat-label">Total Points</div>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="si-bento si-activity">
            <h2 className="si-bento-title">WEEKLY ACTIVITY</h2>
            <div className="si-activity-list">
              <div className="si-activity-row">
                <span className="si-activity-label">AI Chats</span>
                <span className="si-activity-value">{insights.activity_breakdown?.ai_chats || 0}</span>
              </div>
              <div className="si-activity-row">
                <span className="si-activity-label">Quizzes Completed</span>
                <span className="si-activity-value">{insights.activity_breakdown?.quizzes_completed || 0}</span>
              </div>
              <div className="si-activity-row">
                <span className="si-activity-label">Flashcards Reviewed</span>
                <span className="si-activity-value">{insights.activity_breakdown?.flashcards_reviewed || 0}</span>
              </div>
              <div className="si-activity-row">
                <span className="si-activity-label">Questions Answered</span>
                <span className="si-activity-value">{insights.activity_breakdown?.questions_answered || 0}</span>
              </div>
              <div className="si-activity-row">
                <span className="si-activity-label">Notes Created</span>
                <span className="si-activity-value">{insights.activity_breakdown?.notes_created || 0}</span>
              </div>
            </div>
          </div>

          {/* Quiz Performance */}
          <div className="si-bento si-quiz">
            <h2 className="si-bento-title">QUIZ PERFORMANCE</h2>
            {insights.quizzes?.total_quizzes > 0 ? (
              <>
                <div className="si-quiz-summary">
                  <div className="si-quiz-main">
                    <div className="si-quiz-score">{insights.quizzes.average_score}%</div>
                    <div className="si-quiz-label">Average Score</div>
                  </div>
                  <div className="si-quiz-side">
                    <div className="si-quiz-count">{insights.quizzes.total_quizzes}</div>
                    <div className="si-quiz-label">Quizzes Taken</div>
                  </div>
                </div>
                <div className="si-diff-grid">
                  <div className="si-diff">
                    <span className="si-diff-label">Easy</span>
                    <span className="si-diff-score">{insights.quizzes.by_difficulty?.easy?.average || 0}%</span>
                  </div>
                  <div className="si-diff">
                    <span className="si-diff-label">Medium</span>
                    <span className="si-diff-score">{insights.quizzes.by_difficulty?.intermediate?.average || 0}%</span>
                  </div>
                  <div className="si-diff">
                    <span className="si-diff-label">Hard</span>
                    <span className="si-diff-score">{insights.quizzes.by_difficulty?.hard?.average || 0}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="si-empty">
                <p className="si-empty-text">No quizzes completed yet</p>
                <button className="si-btn-small" onClick={() => navigate('/quiz-hub')}>Take a Quiz</button>
              </div>
            )}
          </div>

          {/* Flashcard Mastery */}
          <div className="si-bento si-flashcards">
            <h2 className="si-bento-title">FLASHCARD MASTERY</h2>
            {insights.flashcards?.total > 0 ? (
              <>
                <div className="si-fc-stats">
                  <div className="si-fc-stat">
                    <div className="si-fc-value">{insights.flashcards.total}</div>
                    <div className="si-fc-label">Total Cards</div>
                  </div>
                  <div className="si-fc-stat">
                    <div className="si-fc-value">{insights.flashcards.mastered}</div>
                    <div className="si-fc-label">Mastered</div>
                  </div>
                  <div className="si-fc-stat">
                    <div className="si-fc-value">{insights.flashcards.mastery_rate}%</div>
                    <div className="si-fc-label">Mastery Rate</div>
                  </div>
                </div>
                {insights.flashcards.struggling && insights.flashcards.struggling.length > 0 && (
                  <div className="si-struggling">
                    <div className="si-struggling-title">Needs Practice:</div>
                    {insights.flashcards.struggling.slice(0, 3).map((card, idx) => (
                      <div key={idx} className="si-struggling-card">
                        <div className="si-card-question">{card.question}</div>
                        <div className="si-card-accuracy">{card.accuracy}% accuracy</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="si-empty">
                <p className="si-empty-text">No flashcards created yet</p>
                <button className="si-btn-small" onClick={() => navigate('/flashcards')}>Create Flashcards</button>
              </div>
            )}
          </div>

          {/* Weak Areas */}
          <div className="si-bento si-weak">
            <h2 className="si-bento-title">WEAK AREAS TO IMPROVE</h2>
            {insights.weak_areas && insights.weak_areas.length > 0 ? (
              <div className="si-weak-list">
                {insights.weak_areas.slice(0, 5).map((area, idx) => (
                  <div key={idx} className="si-weak-row">
                    <div className="si-weak-info">
                      <div className="si-weak-topic">{area.topic}</div>
                      {area.subtopic && <div className="si-weak-subtopic">{area.subtopic}</div>}
                    </div>
                    <div className="si-weak-stats">
                      <div className="si-weak-accuracy" style={{
                        color: area.accuracy < 50 ? '#ef4444' : area.accuracy < 70 ? '#f59e0b' : '#10b981'
                      }}>
                        {area.accuracy}%
                      </div>
                      <div className="si-weak-priority">Priority: {area.priority}/10</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="si-empty">
                <p className="si-empty-text">No weak areas identified yet</p>
                <p className="si-empty-hint">Complete quizzes to track your progress</p>
              </div>
            )}
          </div>

          {/* Recent Quizzes */}
          {insights.quizzes?.recent_quizzes && insights.quizzes.recent_quizzes.length > 0 && (
            <div className="si-bento si-recent-quizzes">
              <h2 className="si-bento-title">RECENT QUIZ RESULTS</h2>
              <div className="si-quiz-list">
                {insights.quizzes.recent_quizzes.slice(0, 5).map((quiz, idx) => (
                  <div key={idx} className="si-quiz-row">
                    <div className="si-quiz-info">
                      <div className="si-quiz-title">{quiz.title}</div>
                      <div className="si-quiz-meta">{quiz.difficulty} • {quiz.question_count} questions</div>
                    </div>
                    <div className="si-quiz-badge" style={{
                      backgroundColor: quiz.score >= 80 ? '#10b981' : quiz.score >= 60 ? '#f59e0b' : '#ef4444'
                    }}>
                      {quiz.score}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question Bank */}
          <div className="si-bento si-qb">
            <h2 className="si-bento-title">QUESTION BANK</h2>
            {insights.question_bank?.total_questions > 0 ? (
              <div className="si-qb-stats">
                <div className="si-qb-stat">
                  <div className="si-qb-value">{insights.question_bank.total_questions}</div>
                  <div className="si-qb-label">Total Questions</div>
                </div>
                <div className="si-qb-stat">
                  <div className="si-qb-value">{insights.question_bank.completed_questions}</div>
                  <div className="si-qb-label">Completed</div>
                </div>
                <div className="si-qb-stat">
                  <div className="si-qb-value">{insights.question_bank.average_accuracy}%</div>
                  <div className="si-qb-label">Accuracy</div>
                </div>
              </div>
            ) : (
              <div className="si-empty">
                <p className="si-empty-text">No question sets yet</p>
                <button className="si-btn-small" onClick={() => navigate('/question-bank')}>Create Questions</button>
              </div>
            )}
          </div>

          {/* Topics Studied */}
          {insights.session_data?.specific_topics && insights.session_data.specific_topics.length > 0 && (
            <div className="si-bento si-topics">
              <h2 className="si-bento-title">TOPICS STUDIED</h2>
              <div className="si-topics-list">
                {insights.session_data.specific_topics.slice(0, 6).map((topic, idx) => (
                  <div key={idx} className="si-topic-row" onClick={() => navigate('/ai-chat', {
                    state: { initialMessage: `Help me practice ${topic.name}` }
                  })}>
                    <span className="si-topic-name">{topic.name}</span>
                    <span className="si-topic-count">{topic.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Notes */}
          {insights.notes?.recent_notes && insights.notes.recent_notes.length > 0 && (
            <div className="si-bento si-notes">
              <h2 className="si-bento-title">RECENT NOTES</h2>
              <div className="si-notes-list">
                {insights.notes.recent_notes.map((note) => (
                  <div key={note.id} className="si-note-row" onClick={() => navigate(`/notes-redesign?note_id=${note.id}`)}>
                    <span className="si-note-title">{note.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!hasData && (
            <div className="si-bento si-empty-state">
              <h2 className="si-bento-title">GET STARTED</h2>
              <p className="si-empty-text">Start studying to see your comprehensive insights here.</p>
              <button className="si-btn-large" onClick={() => navigate('/ai-chat')}>START STUDYING</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudyInsights;
