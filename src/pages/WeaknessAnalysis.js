import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronRight, Brain, Lightbulb, BookOpen, Play, Target,
  TrendingUp, CheckCircle, XCircle, ArrowRight, Home
} from 'lucide-react';
import './WeaknessAnalysis.css';
import { API_URL } from '../config';

const WeaknessAnalysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('username');
  
  const topic = location.state?.topic || 'General';
  
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [practiceMode, setPracticeMode] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      // Load suggestions
      const suggestionsRes = await fetch(
        `${API_URL}/study_insights/topic_suggestions?user_id=${userName}&topic=${encodeURIComponent(topic)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data);
      }

      // Load similar questions
      const questionsRes = await fetch(
        `${API_URL}/study_insights/similar_questions?user_id=${userName}&topic=${encodeURIComponent(topic)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (questionsRes.ok) {
        const data = await questionsRes.json();
        setQuestions(data.similar_questions || []);
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPractice = () => {
    setPracticeMode(true);
    setCurrentQuestionIndex(0);
    setStats({ correct: 0, total: 0 });
  };

  const submitAnswer = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = userAnswer.toLowerCase().trim() === currentQuestion.correct_answer.toLowerCase().trim();
    
    setFeedback({
      is_correct: isCorrect,
      correct_answer: currentQuestion.correct_answer,
      explanation: `The correct answer is ${currentQuestion.correct_answer}.`
    });
    setShowFeedback(true);
    setStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setUserAnswer('');
      setShowFeedback(false);
      setFeedback(null);
    } else {
      setPracticeMode(false);
    }
  };

  if (loading) {
    return (
      <div className="analysis-container">
        <div className="analysis-loading">
          <div className="loading-spinner"></div>
          <p>ANALYZING {topic.toUpperCase()}...</p>
        </div>
      </div>
    );
  }

  if (practiceMode && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    
    return (
      <div className="analysis-container">
        <header className="analysis-header">
          <div className="analysis-header-left">
            <h1 className="analysis-logo" onClick={() => navigate('/dashboard')}>
              <div className="analysis-logo-img" />
              cerbyl
            </h1>
            <div className="analysis-header-divider"></div>
            <span className="analysis-subtitle">PRACTICE MODE</span>
          </div>
          <div className="analysis-stats-bar">
            <div className="stat-item">
              <span className="stat-label">Progress:</span>
              <span className="stat-value">{currentQuestionIndex + 1}/{questions.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Score:</span>
              <span className="stat-value">{stats.correct}/{stats.total}</span>
            </div>
          </div>
        </header>

        <div className="analysis-practice-main">
          <div className="practice-question-card">
            <div className="question-header">
              <span className="question-topic">{topic}</span>
              <span className="question-number">Question {currentQuestionIndex + 1}</span>
            </div>

            <h3 className="question-text">{currentQuestion.question_text}</h3>

            <textarea
              className="answer-input"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer here..."
              disabled={showFeedback}
              rows={4}
            />

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
                <div className="feedback-explanation">
                  <strong>Correct Answer:</strong> {feedback.correct_answer}
                </div>
              </div>
            )}

            <div className="question-actions">
              {!showFeedback ? (
                <button 
                  className="submit-btn"
                  onClick={submitAnswer}
                  disabled={!userAnswer.trim()}
                >
                  <CheckCircle size={18} />
                  <span>Submit Answer</span>
                </button>
              ) : (
                <button className="next-btn" onClick={nextQuestion}>
                  <span>{currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish'}</span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-container">
      <header className="analysis-header">
        <div className="analysis-header-left">
          <h1 className="analysis-logo" onClick={() => navigate('/dashboard')}>
            <div className="analysis-logo-img" />
            cerbyl
          </h1>
          <div className="analysis-header-divider"></div>
          <span className="analysis-subtitle">{topic.toUpperCase()} ANALYSIS</span>
        </div>
        <nav className="analysis-header-right">
          <button className="analysis-nav-btn" onClick={() => navigate('/weaknesses')}>
            <span>Back to Weaknesses</span>
            <ChevronRight size={14} />
          </button>
        </nav>
      </header>

      <div className="analysis-body">
        {/* Left Side - Tips & Suggestions */}
        <div className="analysis-left">
          <div className="analysis-section">
            <div className="section-header">
              <Lightbulb size={20} />
              <h2>Personalized Suggestions</h2>
            </div>
            
            {suggestions?.suggestions?.length > 0 ? (
              <div className="suggestions-list">
                {suggestions.suggestions.map((suggestion, idx) => (
                  <div key={idx} className={`suggestion-card ${suggestion.priority}`}>
                    <div className="suggestion-header">
                      <span className="suggestion-title">{suggestion.title}</span>
                      <span className={`suggestion-priority ${suggestion.priority}`}>
                        {suggestion.priority}
                      </span>
                    </div>
                    <p className="suggestion-description">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No suggestions available yet</p>
              </div>
            )}
          </div>

          <div className="analysis-section">
            <div className="section-header">
              <BookOpen size={20} />
              <h2>Study Tips</h2>
            </div>
            
            {suggestions?.study_tips?.length > 0 ? (
              <ul className="tips-list">
                {suggestions.study_tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <p>No study tips available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Practice Questions */}
        <div className="analysis-right">
          <div className="analysis-section">
            <div className="section-header">
              <Target size={20} />
              <h2>Practice Questions</h2>
              <span className="question-count">{questions.length} available</span>
            </div>

            {questions.length > 0 ? (
              <>
                <div className="questions-preview">
                  {questions.slice(0, 3).map((question, idx) => (
                    <div key={idx} className="question-preview-card">
                      <div className="preview-number">Q{idx + 1}</div>
                      <p className="preview-text">{question.question_text}</p>
                      {question.difficulty && (
                        <span className={`preview-difficulty ${question.difficulty}`}>
                          {question.difficulty}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <button className="start-practice-btn" onClick={startPractice}>
                  <Play size={20} />
                  <span>Start Practice Session</span>
                </button>
              </>
            ) : (
              <div className="empty-state">
                <Target size={48} />
                <p>No practice questions available</p>
                <button className="generate-btn" onClick={() => navigate('/weakness-practice', { state: { topic, difficulty: 'intermediate' }})}>
                  <Brain size={18} />
                  <span>Generate AI Questions</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeaknessAnalysis;
