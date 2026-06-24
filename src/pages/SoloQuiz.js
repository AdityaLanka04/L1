import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Brain, Sparkles, Loader, AlertCircle, BarChart3,
  BookOpen, Gauge, Cpu, Database, ArrowRight, History, TrendingUp, Zap, ChevronRight,
  MessageSquare, LayoutDashboard, LogOut
} from 'lucide-react';
import './SoloQuiz.css';
import quizAgentService from '../services/quizAgentService';
import ContextSelector from '../components/ContextSelector';
import ContextPanel from '../components/ContextPanel';
import contextService from '../services/contextService';
import { SidebarShell, SidebarSection, SidebarMenuItem, SidebarStats, SidebarStatBox, SidebarActions, SidebarAction, SidebarStripButton, SidebarStripDivider } from '../components/Sidebar';

const SoloQuiz = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username');

  const [activeTab, setActiveTab] = useState('generator');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [hsMode, setHsMode] = useState(() => localStorage.getItem('hs_mode_enabled') === 'true');
  const [userDocCount, setUserDocCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(10);
  const [questionTypes] = useState(['multiple_choice']);
  const [useAdaptive, setUseAdaptive] = useState(false);
  const [quizMode, setQuizMode] = useState('standard'); 
  const [timingMode, setTimingMode] = useState('timed'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [statistics, setStatistics] = useState(null);

  const getDifficultyMix = () => {
    switch (difficulty) {
      case 'easy': return { easy: 6, medium: 3, hard: 1 };
      case 'medium': return { easy: 3, medium: 5, hard: 2 };
      case 'hard': return { easy: 1, medium: 4, hard: 5 };
      default: return { easy: 3, medium: 5, hard: 2 };
    }
  };

  useEffect(() => {
    contextService.listDocuments()
      .then(d => setUserDocCount(d.user_docs?.length || 0))
      .catch(() => {});
  }, []);

  const handleHsModeToggle = (val) => {
    setHsMode(val);
    localStorage.setItem('hs_mode_enabled', String(val));
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
      let response;
      if (useAdaptive) {
        response = await quizAgentService.generateAdaptiveQuiz({
          userId: username,
          topic: topicToUse,
          questionCount: countToUse
        });
      } else {
        response = await quizAgentService.generateQuiz({
          userId: username,
          topic: topicToUse,
          questionCount: countToUse,
          difficultyMix: getDifficultyMix(),
          questionTypes,
          use_hs_context: hsMode
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
          quiz_id: response.quiz_id
        }));
        navigate('/solo-quiz/session');
      } else {
        setError('Unable to generate questions. Please try a different topic.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sq-page">
      <div className={`sq-body ${sidebarCollapsed ? 'sq-body--collapsed' : ''}`}>
        <SidebarShell
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          brandKicker="SOLO QUIZ"
          ariaLabel="Solo Quiz navigation"
          collapsedContent={(
            <>
              <SidebarStripButton icon={<Sparkles size={18} />} tip="Generator" active={activeTab === 'generator'} onClick={() => { setSidebarCollapsed(false); setActiveTab('generator'); }} />
              <SidebarStripButton icon={<History size={18} />} tip="Completed" active={activeTab === 'completed'} onClick={() => { setSidebarCollapsed(false); setActiveTab('completed'); }} />
              <SidebarStripButton icon={<TrendingUp size={18} />} tip="Statistics" active={activeTab === 'statistics'} onClick={() => { setSidebarCollapsed(false); setActiveTab('statistics'); }} />
              <SidebarStripDivider />
              <SidebarStripButton icon={<BookOpen size={18} />} tip="Quiz Hub" onClick={() => navigate('/quiz-hub')} />
              <SidebarStripButton icon={<MessageSquare size={18} />} tip="AI Chat" onClick={() => navigate('/ai-chat')} />
              <SidebarStripButton icon={<LayoutDashboard size={18} />} tip="Dashboard" onClick={() => navigate('/dashboard-cerbyl')} />
              <SidebarStripButton
                icon={<LogOut size={18} />}
                tip="Logout"
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('username');
                  navigate('/');
                }}
              />
            </>
          )}
        >
          <SidebarSection heading="Quiz Workspace">
            <SidebarMenuItem icon={<Sparkles size={16} />} label="Generator" active={activeTab === 'generator'} onClick={() => setActiveTab('generator')} />
            <SidebarMenuItem icon={<History size={16} />} label="Completed" active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} />
            <SidebarMenuItem icon={<TrendingUp size={16} />} label="Statistics" active={activeTab === 'statistics'} onClick={() => setActiveTab('statistics')} />
          </SidebarSection>

          <SidebarStats>
            <SidebarStatBox value={difficulty} label="Difficulty" />
            <SidebarStatBox value={questionCount} label="Questions" />
            <SidebarStatBox value={timingMode === 'none' ? 'No Timer' : timingMode} label="Timing" />
          </SidebarStats>

          <SidebarActions>
            <SidebarAction icon={<Play size={14} />} label="Start Quiz" onClick={() => setActiveTab('generator')} />
            <SidebarAction icon={<BookOpen size={14} />} label="Quiz Hub" onClick={() => navigate('/quiz-hub')} />
            <SidebarAction icon={<LayoutDashboard size={14} />} label="Dashboard" onClick={() => navigate('/dashboard-cerbyl')} />
            <SidebarAction
              icon={<LogOut size={14} />}
              label="Logout"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                navigate('/');
              }}
            />
          </SidebarActions>
        </SidebarShell>

        <main className="sq-main">
          {activeTab === 'generator' && (
            <div className="sq-content">
              <div className="sq-generator-container">
                <div className="sq-generator-header">
                  <Brain size={48} className="sq-generator-icon" />
                  <h2 className="sq-generator-title">CREATE AI QUIZ</h2>
                  <p className="sq-generator-subtitle">
                    Challenge yourself with intelligent quizzes generated by AI
                  </p>
                </div>

                <form onSubmit={handleStartQuiz} className="sq-generator-form">
                  <div className="sq-form-group">
                    <label>
                      <BookOpen size={16} />
                      SUBJECT / TOPIC
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Machine Learning, World War II, Calculus..."
                      required
                    />
                  </div>

                  <div className="sq-form-row">
                    <div className="sq-form-group">
                      <label>
                        <Gauge size={16} />
                        DIFFICULTY
                      </label>
                      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="sq-form-group">
                      <label>
                        <Database size={16} />
                        QUESTIONS
                      </label>
                      <input
                        type="number"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Math.min(20, Math.max(5, parseInt(e.target.value) || 5)))}
                        min="5"
                        max="20"
                      />
                    </div>
                  </div>

                  <div className="sq-form-group">
                    <label>
                      <Play size={16} />
                      QUIZ MODE
                    </label>
                    <div className="sq-mode-options">
                      <button
                        type="button"
                        className={`sq-mode-btn ${quizMode === 'standard' ? 'active' : ''}`}
                        onClick={() => setQuizMode('standard')}
                      >
                        <div className="sq-mode-header">
                          <span className="sq-mode-name">Standard</span>
                        </div>
                        <p className="sq-mode-desc">Navigate freely between questions. Answer at your own pace.</p>
                      </button>
                      
                      <button
                        type="button"
                        className={`sq-mode-btn ${quizMode === 'sequential' ? 'active' : ''}`}
                        onClick={() => setQuizMode('sequential')}
                      >
                        <div className="sq-mode-header">
                          <span className="sq-mode-name">Sequential</span>
                        </div>
                        <p className="sq-mode-desc">Answer each question to proceed. Results shown at the end.</p>
                      </button>
                      
                      <button
                        type="button"
                        className={`sq-mode-btn ${quizMode === 'sequential-instant' ? 'active' : ''}`}
                        onClick={() => setQuizMode('sequential-instant')}
                      >
                        <div className="sq-mode-header">
                          <span className="sq-mode-name">Instant Feedback</span>
                        </div>
                        <p className="sq-mode-desc">See if your answer is correct immediately after selection.</p>
                      </button>
                    </div>
                  </div>

                  <div className="sq-form-group">
                    <label>
                      <Gauge size={16} />
                      TIMING MODE
                    </label>
                    <div className="sq-timing-options">
                      <button
                        type="button"
                        className={`sq-timing-btn ${timingMode === 'timed' ? 'active' : ''}`}
                        onClick={() => setTimingMode('timed')}
                      >
                        <span className="sq-timing-name">Timed</span>
                        <p className="sq-timing-desc">Countdown timer (1 min/question)</p>
                      </button>
                      
                      <button
                        type="button"
                        className={`sq-timing-btn ${timingMode === 'stopwatch' ? 'active' : ''}`}
                        onClick={() => setTimingMode('stopwatch')}
                      >
                        <span className="sq-timing-name">Stopwatch</span>
                        <p className="sq-timing-desc">Track how fast you complete</p>
                      </button>
                      
                      <button
                        type="button"
                        className={`sq-timing-btn ${timingMode === 'none' ? 'active' : ''}`}
                        onClick={() => setTimingMode('none')}
                      >
                        <span className="sq-timing-name">No Timer</span>
                        <p className="sq-timing-desc">Take your time, no pressure</p>
                      </button>
                    </div>
                  </div>

                  <div className="sq-form-group sq-adaptive-toggle">
                    <label className="sq-toggle-label">
                      <input
                        type="checkbox"
                        checked={useAdaptive}
                        onChange={(e) => setUseAdaptive(e.target.checked)}
                      />
                      <span className="sq-toggle-text">
                        <Cpu size={20} />
                        USE ADAPTIVE MODE
                      </span>
                    </label>
                    <p className="sq-toggle-desc">AI adjusts questions based on your past performance</p>
                  </div>

                  {error && (
                    <div className="sq-error">
                      <AlertCircle size={20} />
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)}>×</button>
                    </div>
                  )}

                  <button type="submit" className="sq-submit-btn" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader size={20} className="spinner" />
                        <span>GENERATING QUIZ...</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '24px', fontWeight: '400', lineHeight: '1' }}>+</span>
                        <span>START QUIZ</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'completed' && (
            <div className="sq-content">
              <div className="sq-completed-list">
                {completedQuizzes.length === 0 ? (
                  <div className="sq-empty-state">
                    <History size={48} />
                    <h3>No Completed Quizzes Yet</h3>
                    <p>Start a new quiz to see your results here</p>
                    <button className="sq-empty-btn" onClick={() => setActiveTab('generator')}>
                      <span style={{ fontSize: '24px', fontWeight: '400', lineHeight: '1' }}>+</span>
                      <span>GENERATE QUIZ</span>
                    </button>
                  </div>
                ) : (
                  completedQuizzes.map((quiz, idx) => (
                    <div key={idx} className="sq-quiz-card">
                      <div className="sq-quiz-card-header">
                        <h3>{quiz.topic}</h3>
                        <span className={`sq-score-badge ${quiz.score >= 80 ? 'excellent' : quiz.score >= 60 ? 'good' : 'needs-work'}`}>
                          {quiz.score}%
                        </span>
                      </div>
                      <div className="sq-quiz-card-meta">
                        <span><BookOpen size={14} /> {quiz.questionCount} questions</span>
                        <span><Gauge size={14} /> {quiz.difficulty}</span>
                        <span>{new Date(quiz.completedAt).toLocaleDateString()}</span>
                      </div>
                      <button className="sq-review-btn">
                        <ArrowRight size={16} />
                        Review Answers
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="sq-content">
              <div className="sq-section-header">
                <TrendingUp size={32} />
                <div>
                  <h2 className="sq-section-title">Quiz Statistics</h2>
                  <p className="sq-section-desc">Track your progress and performance over time</p>
                </div>
              </div>
              
              <div className="sq-stats-grid">
                <div className="sq-stat-card">
                  <div className="sq-stat-icon">
                    <Play size={24} />
                  </div>
                  <div className="sq-stat-content">
                    <h3 className="sq-stat-value">{statistics?.totalQuizzes || 0}</h3>
                    <p className="sq-stat-label">Total Quizzes</p>
                  </div>
                </div>
                
                <div className="sq-stat-card">
                  <div className="sq-stat-icon">
                    <BarChart3 size={24} />
                  </div>
                  <div className="sq-stat-content">
                    <h3 className="sq-stat-value">{statistics?.averageScore || 0}%</h3>
                    <p className="sq-stat-label">Average Score</p>
                  </div>
                </div>
                
                <div className="sq-stat-card">
                  <div className="sq-stat-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="sq-stat-content">
                    <h3 className="sq-stat-value">{statistics?.bestScore || 0}%</h3>
                    <p className="sq-stat-label">Best Score</p>
                  </div>
                </div>
                
                <div className="sq-stat-card">
                  <div className="sq-stat-icon">
                    <Database size={24} />
                  </div>
                  <div className="sq-stat-content">
                    <h3 className="sq-stat-value">{statistics?.totalQuestions || 0}</h3>
                    <p className="sq-stat-label">Questions Answered</p>
                  </div>
                </div>
              </div>

              {!statistics && (
                <div className="sq-empty-state">
                  <BarChart3 size={48} />
                  <h3>No Statistics Available</h3>
                  <p>Complete some quizzes to see your statistics</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ContextPanel
        isOpen={contextPanelOpen}
        onClose={() => setContextPanelOpen(false)}
        hsMode={hsMode}
        onHsModeToggle={handleHsModeToggle}
        onDocUploaded={() => setUserDocCount(p => p + 1)}
      />

      <div style={{position:'fixed',top:'10px',right:'12px',zIndex:8000,display:'flex',alignItems:'center',gap:'8px'}}>
        <ContextSelector hsMode={hsMode} docCount={userDocCount} onOpen={() => setContextPanelOpen(true)} />
      </div>
    </div>
  );
};

export default SoloQuiz;
