import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Sparkles, Loader, AlertCircle, History, TrendingUp } from 'lucide-react';
import '../styles/quizSurface.css';
import SocialHubChrome from '../components/SocialHubChrome';
import quizAgentService from '../services/quizAgentService';
import { API_URL } from '../config';

const SoloQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username');

  const [activeTab, setActiveTab] = useState('generator');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  ));
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [questionTypes] = useState(['multiple_choice']);
  const [useAdaptive, setUseAdaptive] = useState(false);
  const [quizMode, setQuizMode] = useState('standard');
  const [timingMode, setTimingMode] = useState('timed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/solo_quiz_history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setCompletedQuizzes(data.history || []);
        setStatistics(data.statistics || null);
      } catch {
        // silenced: the tabs show their empty state
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getDifficultyMix = () => {
    switch (difficulty) {
      case 'easy': return { easy: 6, medium: 3, hard: 1 };
      case 'medium': return { easy: 3, medium: 5, hard: 2 };
      case 'hard': return { easy: 1, medium: 4, hard: 5 };
      default: return { easy: 3, medium: 5, hard: 2 };
    }
  };


  useEffect(() => {
    const autoStartData = location.state;
    if (autoStartData?.autoStart && autoStartData.topics?.length > 0) {
      setSubject(autoStartData.topics[0]);
      setDifficulty(autoStartData.difficulty || 'medium');
      setQuestionCount(autoStartData.questionCount || 10);
      setTimeout(() => {
        handleStartQuiz(null, autoStartData.topics[0], autoStartData.difficulty || 'medium', autoStartData.questionCount || 10);
      }, 500);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleStartQuiz = async (e, autoTopic = null, autoDifficulty = null, autoCount = null) => {
    if (e) e.preventDefault();
    const topicToUse = autoTopic || subject;
    const difficultyToUse = autoDifficulty || difficulty;
    const countToUse = autoCount || questionCount;

    if (!topicToUse) {
      setError('Please enter a subject to begin your quiz');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const useHsContext = localStorage.getItem('hs_mode_enabled') === 'true';
      let response;
      if (useAdaptive) {
        response = await quizAgentService.generateAdaptiveQuiz({
          userId: username,
          topic: topicToUse,
          questionCount: countToUse,
          use_hs_context: useHsContext
        });
      } else {
        response = await quizAgentService.generateQuiz({
          userId: username,
          topic: topicToUse,
          questionCount: countToUse,
          difficultyMix: getDifficultyMix(),
          questionTypes,
          use_hs_context: useHsContext
        });
      }

      if (response.success && response.questions?.length > 0) {
        sessionStorage.setItem('quizData', JSON.stringify({
          questions: response.questions,
          topic: topicToUse,
          difficulty: difficultyToUse,
          adaptiveConfig: response.adaptive_config,
          quizMode,
          timingMode,
          quiz_id: response.quiz_id,
          uid: response.uid
        }));
        navigate(`/solo-quiz/session/${response.uid || response.quiz_id}`);
      } else {
        setError('Unable to generate questions. Please try a different topic.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const answerFlows = [
    { id: 'standard', name: 'Standard', desc: 'Move freely between questions.' },
    { id: 'sequential', name: 'Sequential', desc: 'One at a time; results at the end.' },
    { id: 'sequential-instant', name: 'Instant feedback', desc: 'See if you were right after each answer.' },
  ];
  const timings = [
    { id: 'timed', name: 'Timed', desc: '1 minute per question.' },
    { id: 'stopwatch', name: 'Stopwatch', desc: 'Track how fast you finish.' },
    { id: 'none', name: 'No timer', desc: 'Take your time.' },
  ];
  const scoreTone = (score) => (score >= 80 ? 'is-good' : score >= 60 ? 'is-accent' : 'is-bad');

  return (
    <div className="sq-page with-social-chrome">
      <SocialHubChrome
        brandKicker="Solo Quiz"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        sidebarLead={(
          <button className="qz-side-primary" type="button" onClick={() => setActiveTab('generator')}>
            <Sparkles size={15} />
            <span>New quiz</span>
          </button>
        )}
        collapsedLeadItems={[{ icon: Sparkles, label: 'New quiz', active: activeTab === 'generator', onClick: () => setActiveTab('generator') }]}
        sideSections={[
          {
            label: 'Your quizzes',
            items: [
              { icon: History, label: 'Completed', active: activeTab === 'completed', onClick: () => setActiveTab('completed'), count: completedQuizzes.length },
              { icon: TrendingUp, label: 'Statistics', active: activeTab === 'statistics', onClick: () => setActiveTab('statistics') },
            ],
          },
        ]}
      >
        <main className={`qz-main${activeTab === 'generator' ? ' qz-centered' : ''}`}>
          {activeTab === 'generator' && (
            <>
              <header className="qz-hero">
                <div>
                  <h1 className="plain-page-title">Solo Quiz</h1>
                  <p>Practice any topic at your own pace.</p>
                </div>
              </header>

              <form onSubmit={handleStartQuiz} className="qz-panel qz-form">
                <label className="qz-field">
                  <span className="qz-label">Topic</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Machine Learning, World War II, Calculus"
                    required
                  />
                </label>

                <div className="qz-row">
                  <label className="qz-field">
                    <span className="qz-label">Difficulty</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                  <label className="qz-field">
                    <span className="qz-label">Questions (5–20)</span>
                    <input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.min(20, Math.max(5, parseInt(e.target.value) || 5)))}
                      min="5"
                      max="20"
                    />
                  </label>
                </div>

                <div className="qz-field">
                  <span className="qz-label">Answer flow</span>
                  <div className="qz-choices" role="group" aria-label="Answer flow">
                    {answerFlows.map(flow => (
                      <button
                        key={flow.id}
                        type="button"
                        className={`qz-choice ${quizMode === flow.id ? 'active' : ''}`}
                        aria-pressed={quizMode === flow.id}
                        onClick={() => setQuizMode(flow.id)}
                      >
                        <strong>{flow.name}</strong>
                        <small>{flow.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="qz-field">
                  <span className="qz-label">Timing</span>
                  <div className="qz-choices" role="group" aria-label="Timing">
                    {timings.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={`qz-choice ${timingMode === option.id ? 'active' : ''}`}
                        aria-pressed={timingMode === option.id}
                        onClick={() => setTimingMode(option.id)}
                      >
                        <strong>{option.name}</strong>
                        <small>{option.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="qz-check">
                  <input type="checkbox" checked={useAdaptive} onChange={(e) => setUseAdaptive(e.target.checked)} />
                  <span>
                    Adaptive difficulty
                    <small>Questions adjust to your past performance.</small>
                  </span>
                </label>

                {error && (
                  <div className="qz-error" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
                  </div>
                )}

                <div>
                  <button type="submit" className="qz-primary" disabled={loading}>
                    {loading ? <Loader size={16} className="qz-spin" /> : <Play size={16} />}
                    <span>{loading ? 'Building your quiz…' : 'Start quiz'}</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'completed' && (
            <>
              <header className="qz-hero">
                <div>
                  <h1 className="plain-page-title">Completed</h1>
                  <p>Every solo quiz you have finished.</p>
                </div>
              </header>
              {historyLoading ? (
                <div className="qz-panel qz-empty"><Loader size={22} className="qz-spin" /><p>Loading your quizzes…</p></div>
              ) : completedQuizzes.length === 0 ? (
                <div className="qz-panel qz-empty">
                  <strong>No completed quizzes yet</strong>
                  <p>Finish a quiz and it will show up here.</p>
                </div>
              ) : (
                <div className="qz-list">
                  {completedQuizzes.map((quiz) => (
                    <article key={quiz.id} className="qz-panel qz-item">
                      <div className="qz-item-main">
                        <h3 className="qz-item-title">{quiz.subject || 'Untitled quiz'}</h3>
                        <div className="qz-meta">
                          <span>{quiz.question_count} questions</span>
                          {quiz.difficulty && <span className="qz-cap">{quiz.difficulty}</span>}
                          {quiz.completed_at && <span>{new Date(quiz.completed_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="qz-item-side">
                        <span className={`qz-tag ${scoreTone(quiz.score || 0)}`}>{Math.round(quiz.score || 0)}%</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'statistics' && (
            <>
              <header className="qz-hero">
                <div>
                  <h1 className="plain-page-title">Statistics</h1>
                  <p>How your solo quizzes are going.</p>
                </div>
              </header>
              {historyLoading ? (
                <div className="qz-panel qz-empty"><Loader size={22} className="qz-spin" /><p>Loading your statistics…</p></div>
              ) : statistics && statistics.total_quizzes > 0 ? (
                <div className="qz-stats">
                  <div className="qz-panel qz-stat"><span>Quizzes</span><strong>{statistics.total_quizzes}</strong></div>
                  <div className="qz-panel qz-stat"><span>Average score</span><strong>{statistics.average_score}%</strong></div>
                  <div className="qz-panel qz-stat"><span>Best score</span><strong>{statistics.best_score}%</strong></div>
                  <div className="qz-panel qz-stat"><span>Questions</span><strong>{statistics.total_questions}</strong></div>
                </div>
              ) : (
                <div className="qz-panel qz-empty">
                  <strong>No statistics yet</strong>
                  <p>Complete a quiz to see your scores here.</p>
                </div>
              )}
            </>
          )}
        </main>
      </SocialHubChrome>
    </div>
  );
};

export default SoloQuiz;
