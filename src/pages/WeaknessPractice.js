import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Brain, Target, TrendingUp, Award, Clock, CheckCircle,
  XCircle, Zap, ArrowRight, RotateCcw, Home, ChevronRight
} from 'lucide-react';
import './WeaknessPractice.css';
import { API_URL } from '../config';

const WeaknessPractice = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    questionsAnswered: 0,
    accuracy: 0,
    currentStreak: 0,
    correctCount: 0
  });
  const [sessionSummary, setSummary] = useState(null);
  const [timeStarted, setTimeStarted] = useState(null);
  
  // Get data from navigation state
  const topic = location.state?.topic || 'General Practice';
  const difficulty = location.state?.difficulty || 'intermediate';
  const generatedQuestions = location.state?.questions || [];
  const fromGenerator = location.state?.fromGenerator || false;

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    // If questions were passed from generator, start immediately
    if (fromGenerator && generatedQuestions.length > 0) {
      setSessionActive(true);
      setTimeStarted(Date.now());
      setCurrentQuestion(generatedQuestions[0]);
      setCurrentQuestionIndex(0);
    }
  }, []);

  const startSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/weakness-practice/start-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: parseInt(userName),
          topic: topic,
          difficulty: difficulty,
          question_count: 10
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setSessionId(data.session_id);
        setSessionActive(true);
        setTimeStarted(Date.now());
        await loadNextQuestion(data.session_id);
      }
    } catch (error) {
      console.error('Error starting session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNextQuestion = async (sid) => {
    try {
      const response = await fetch(
        `${API_URL}/api/weakness-practice/next-question?session_id=${sid || sessionId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setCurrentQuestion(data.question);
        setSessionStats({
          questionsAnswered: data.question_number - 1,
          accuracy: data.accuracy,
          currentStreak: data.current_streak
        });
        setUserAnswer('');
        setShowFeedback(false);
      } else if (data.status === 'complete') {
        await endSession();
      }
    } catch (error) {
      console.error('Error loading question:', error);
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) return;
    
    const timeTaken = Math.floor((Date.now() - timeStarted) / 1000);
    
    // For generated questions, handle locally
    if (fromGenerator && generatedQuestions.length > 0) {
      const isCorrect = checkAnswer(userAnswer, currentQuestion.correct_answer);
      
      setFeedback({
        is_correct: isCorrect,
        correct_answer: currentQuestion.correct_answer,
        explanation: currentQuestion.explanation || 'No explanation available',
        feedback: isCorrect ? 'Correct! Well done!' : 'Not quite right. Review the explanation below.'
      });
      setShowFeedback(true);
      
      // Update stats
      const newQuestionsAnswered = sessionStats.questionsAnswered + 1;
      const newCorrectCount = sessionStats.correctCount + (isCorrect ? 1 : 0);
      const newAccuracy = (newCorrectCount / newQuestionsAnswered) * 100;
      const newStreak = isCorrect ? sessionStats.currentStreak + 1 : 0;
      
      setSessionStats({
        questionsAnswered: newQuestionsAnswered,
        correctCount: newCorrectCount,
        accuracy: newAccuracy,
        currentStreak: newStreak
      });
      
      return;
    }
    
    // Original API-based flow
    try {
      const response = await fetch(`${API_URL}/weakness-practice/submit-answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          question_id: currentQuestion.question,
          user_answer: userAnswer,
          time_taken: timeTaken
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setFeedback(data);
        setShowFeedback(true);
        setSessionStats({
          questionsAnswered: data.questions_answered,
          accuracy: data.accuracy,
          currentStreak: data.current_streak
        });
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
    }
  };

  const checkAnswer = (userAns, correctAns) => {
    const userClean = String(userAns).trim().toLowerCase();
    const correctClean = String(correctAns).trim().toLowerCase();
    
    // Direct match
    if (userClean === correctClean) return true;
    
    // For multiple choice (A, B, C, D)
    if (userClean === correctClean.charAt(0)) return true;
    
    // For true/false
    if ((userClean === 'true' || userClean === 't') && (correctClean === 'true' || correctClean === 't')) return true;
    if ((userClean === 'false' || userClean === 'f') && (correctClean === 'false' || correctClean === 'f')) return true;
    
    return false;
  };

  const handleNext = () => {
    setTimeStarted(Date.now());
    
    // For generated questions
    if (fromGenerator && generatedQuestions.length > 0) {
      const nextIndex = currentQuestionIndex + 1;
      
      if (nextIndex < generatedQuestions.length) {
        setCurrentQuestionIndex(nextIndex);
        setCurrentQuestion(generatedQuestions[nextIndex]);
        setUserAnswer('');
        setShowFeedback(false);
      } else {
        // End of questions
        endGeneratedSession();
      }
      return;
    }
    
    // Original API-based flow
    loadNextQuestion();
  };

  const endGeneratedSession = () => {
    setSummary({
      topic: topic,
      statistics: {
        total_questions: generatedQuestions.length,
        correct_answers: sessionStats.correctCount,
        accuracy: sessionStats.accuracy.toFixed(1),
        max_streak: sessionStats.currentStreak
      },
      performance_level: sessionStats.accuracy >= 80 ? 'Excellent' : sessionStats.accuracy >= 60 ? 'Good' : 'Needs Practice',
      recommendations: [
        sessionStats.accuracy < 70 ? `Review ${topic} concepts` : `Great work on ${topic}!`,
        'Keep practicing to improve your skills'
      ]
    });
    setSessionActive(false);
  };

  const endSession = async () => {
    try {
      const response = await fetch(`${API_URL}/api/weakness-practice/end-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ session_id: sessionId })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setSummary(data);
        setSessionActive(false);
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  if (!sessionActive && !sessionSummary) {
    return (
      <div className="weakness-practice-container">
        <header className="practice-header">
          <h1 className="practice-logo" onClick={() => navigate('/dashboard')}>
            <div className="practice-logo-img" />
            cerbyl
          </h1>
          <button className="practice-nav-btn" onClick={() => navigate('/weaknesses')}>
            <Home size={16} />
            <span>Back to Weaknesses</span>
          </button>
        </header>

        <div className="practice-start-screen">
          <div className="start-card">
            <div className="start-icon">
              <Brain size={64} />
            </div>
            <h2>Practice: {topic}</h2>
            <p className="start-description">
              Improve your understanding with personalized questions tailored to your weaknesses
            </p>
            
            <div className="start-details">
              <div className="detail-item">
                <Target size={20} />
                <span>10 Questions</span>
              </div>
              <div className="detail-item">
                <TrendingUp size={20} />
                <span>Difficulty: {difficulty}</span>
              </div>
              <div className="detail-item">
                <Zap size={20} />
                <span>Adaptive Learning</span>
              </div>
            </div>

            <button 
              className="start-practice-btn" 
              onClick={startSession}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Play size={20} />
                  <span>Start Practice</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionSummary) {
    return (
      <div className="weakness-practice-container">
        {/* Header - Matching Weaknesses Page Style */}
        <header className="practice-header">
          <div className="practice-header-left">
            <h1 className="practice-logo" onClick={() => navigate('/dashboard')}>
              <div className="practice-logo-img" />
              cerbyl
            </h1>
            <div className="practice-header-divider"></div>
            <span className="practice-subtitle">PRACTICE COMPLETE</span>
          </div>
          <nav className="practice-header-right">
            <button className="practice-nav-btn practice-nav-btn-ghost" onClick={() => navigate('/weaknesses')}>
              <span>Back to Weaknesses</span>
              <ChevronRight size={14} />
            </button>
          </nav>
        </header>

        <div className="practice-summary-screen">
          <div className="summary-card">
            <div className="summary-icon">
              <Award size={64} />
            </div>
            <h2>Practice Complete!</h2>
            <p className="summary-topic">{sessionSummary.topic}</p>
            
            <div className="summary-stats-grid">
              <div className="summary-stat">
                <div className="stat-value">{sessionSummary.statistics.total_questions}</div>
                <div className="stat-label">Questions</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value">{sessionSummary.statistics.correct_answers}</div>
                <div className="stat-label">Correct</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value">{sessionSummary.statistics.accuracy}%</div>
                <div className="stat-label">Accuracy</div>
              </div>
              <div className="summary-stat">
                <div className="stat-value">{sessionSummary.statistics.max_streak}</div>
                <div className="stat-label">Max Streak</div>
              </div>
            </div>

            <div className="performance-level">
              <span className="level-label">Performance:</span>
              <span className="level-value">{sessionSummary.performance_level}</span>
            </div>

            {sessionSummary.recommendations && sessionSummary.recommendations.length > 0 && (
              <div className="summary-recommendations">
                <h3>Recommendations</h3>
                <ul>
                  {sessionSummary.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="summary-actions">
              <button className="summary-btn primary" onClick={() => {
                setSummary(null);
                startSession();
              }}>
                <RotateCcw size={18} />
                <span>Practice Again</span>
              </button>
              <button className="summary-btn secondary" onClick={() => navigate('/weaknesses')}>
                <Home size={18} />
                <span>Back to Weaknesses</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="weakness-practice-container">
      {/* Header - Matching Weaknesses Page Style */}
      <header className="practice-header">
        <div className="practice-header-left">
          <h1 className="practice-logo" onClick={() => navigate('/dashboard')}>
            <div className="practice-logo-img" />
            cerbyl
          </h1>
          <div className="practice-header-divider"></div>
          <span className="practice-subtitle">{topic.toUpperCase()}</span>
        </div>
        <div className="practice-stats-bar">
          <div className="stat-item">
            <span className="stat-label">Progress:</span>
            <span className="stat-value">{sessionStats.questionsAnswered}/10</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Accuracy:</span>
            <span className="stat-value">{sessionStats.accuracy.toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Streak:</span>
            <span className="stat-value">🔥 {sessionStats.currentStreak}</span>
          </div>
        </div>
      </header>

      <div className="practice-main">
        {currentQuestion && (
          <div className="question-container">
            <div className="question-header">
              <span className="question-topic">{topic}</span>
              <span className="question-difficulty">{currentQuestion.difficulty}</span>
            </div>

            <div className="question-content">
              <h3 className="question-text">{currentQuestion.question_text}</h3>

              {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options && (
                <div className="options-grid">
                  {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option, idx) => (
                    <button
                      key={idx}
                      className={`option-btn ${userAnswer === option ? 'selected' : ''} ${
                        showFeedback ? (option === feedback.correct_answer ? 'correct' : userAnswer === option ? 'incorrect' : '') : ''
                      }`}
                      onClick={() => !showFeedback && setUserAnswer(option)}
                      disabled={showFeedback}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.question_type === 'short_answer' && (
                <textarea
                  className="answer-input"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  disabled={showFeedback}
                  rows={4}
                />
              )}

              {currentQuestion.question_type === 'true_false' && (
                <div className="true-false-btns">
                  <button
                    className={`tf-btn ${userAnswer === 'true' ? 'selected' : ''} ${
                      showFeedback ? ('true' === feedback.correct_answer ? 'correct' : userAnswer === 'true' ? 'incorrect' : '') : ''
                    }`}
                    onClick={() => !showFeedback && setUserAnswer('true')}
                    disabled={showFeedback}
                  >
                    True
                  </button>
                  <button
                    className={`tf-btn ${userAnswer === 'false' ? 'selected' : ''} ${
                      showFeedback ? ('false' === feedback.correct_answer ? 'correct' : userAnswer === 'false' ? 'incorrect' : '') : ''
                    }`}
                    onClick={() => !showFeedback && setUserAnswer('false')}
                    disabled={showFeedback}
                  >
                    False
                  </button>
                </div>
              )}
            </div>

            {showFeedback && feedback && (
              <div className={`feedback-panel ${feedback.is_correct ? 'correct' : 'incorrect'}`}>
                <div className="feedback-header">
                  {feedback.is_correct ? (
                    <>
                      <CheckCircle size={24} />
                      <span>Correct!</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={24} />
                      <span>Not Quite</span>
                    </>
                  )}
                </div>
                <div className="feedback-message">{feedback.feedback}</div>
                <div className="feedback-explanation">
                  <strong>Explanation:</strong>
                  <p>{feedback.explanation}</p>
                </div>
                {!feedback.is_correct && (
                  <div className="correct-answer-display">
                    <strong>Correct Answer:</strong> {feedback.correct_answer}
                  </div>
                )}
              </div>
            )}

            <div className="question-actions">
              {!showFeedback ? (
                <button 
                  className="submit-answer-btn"
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim()}
                >
                  <CheckCircle size={18} />
                  <span>Submit Answer</span>
                </button>
              ) : (
                <button className="next-question-btn" onClick={handleNext}>
                  <span>Next Question</span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeaknessPractice;
