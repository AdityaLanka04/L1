import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Target, Trophy, CheckCircle, XCircle, Loader, Lightbulb, RefreshCw, AlertCircle } from 'lucide-react';
import './QuizBattleSession.css';
import quizAgentService from '../services/quizAgentService';

const SoloQuizSession = () => {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  
  const [questions, setQuestions] = useState([]);
  const [quizData, setQuizData] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [startTime, setStartTime] = useState(null);

  // Load quiz from sessionStorage
  useEffect(() => {
    const storedData = sessionStorage.getItem('quizData');
    if (storedData) {
      const data = JSON.parse(storedData);
      setQuizData(data);
      setQuestions(data.questions || []);
      setTimeRemaining((data.questions?.length || 10) * 60); // 1 min per question
      setStartTime(Date.now());
      setLoading(false);
    } else {
      navigate('/solo-quiz');
    }
  }, [navigate]);

  // Timer
  useEffect(() => {
    if (timeRemaining > 0 && !showResult && !loading) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && questions.length > 0 && !showResult) {
      handleSubmitQuiz();
    }
  }, [timeRemaining, showResult, loading, questions.length]);

  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer !== null) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    const questionId = String(currentQuestion.id ?? currentQuestionIndex);
    
    // Store answer based on question type
    let answerValue;
    if (currentQuestion.question_type === 'multiple_choice') {
      answerValue = String.fromCharCode(65 + answerIndex); // A, B, C, D
    } else if (currentQuestion.question_type === 'true_false') {
      answerValue = answerIndex === 0 ? 'true' : 'false';
    } else {
      answerValue = String(answerIndex);
    }
    
    setSelectedAnswer(answerIndex);
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answerValue
    }));

    // Check if correct for immediate feedback
    const correctAnswer = String(currentQuestion.correct_answer || '').toLowerCase();
    const isCorrect = answerValue.toLowerCase() === correctAnswer || 
                      answerValue.toLowerCase() === correctAnswer.charAt(0);
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    // Auto-advance after delay
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
      } else {
        handleSubmitQuiz();
      }
    }, 1500);
  };

  const handleSubmitQuiz = async () => {
    setGrading(true);
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      // Grade the quiz using the agent
      const gradeResponse = await quizAgentService.gradeQuiz({
        userId: username,
        questions,
        answers: userAnswers,
        timeTakenSeconds: timeTaken
      });

      setResults(gradeResponse);

      // Analyze performance
      if (gradeResponse.results) {
        const analyzeResponse = await quizAgentService.analyzePerformance({
          userId: username,
          results: gradeResponse.results,
          timeTakenSeconds: timeTaken
        });
        setAnalysis(analyzeResponse.analysis);
      }

      setShowResult(true);
    } catch (error) {
      console.error('Error grading quiz:', error);
      // Fallback to local grading
      setResults({
        total_questions: questions.length,
        correct_answers: score,
        percentage: Math.round((score / questions.length) * 100),
        results: questions.map((q, idx) => ({
          question_text: q.question_text,
          user_answer: userAnswers[String(q.id ?? idx)] || '',
          correct_answer: q.correct_answer,
          is_correct: (userAnswers[String(q.id ?? idx)] || '').toLowerCase() === String(q.correct_answer || '').toLowerCase().charAt(0),
          explanation: q.explanation
        }))
      });
      setShowResult(true);
    } finally {
      setGrading(false);
      sessionStorage.removeItem('quizData');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    navigate('/solo-quiz');
  };

  if (loading) {
    return (
      <div className="battle-session-loading">
        <Loader size={48} className="spinner" />
        <h2>Loading Quiz...</h2>
      </div>
    );
  }

  if (grading) {
    return (
      <div className="battle-session-loading">
        <Loader size={48} className="spinner" />
        <h2>Grading Your Answers...</h2>
        <p>AI is analyzing your performance</p>
      </div>
    );
  }

  if (showResult) {
    const percentage = results?.percentage || Math.round((score / questions.length) * 100);
    const correctCount = results?.correct_answers || score;

    return (
      <div className="battle-result-page detailed">
        <div className="result-container detailed">
          <div className="result-header">
            <Trophy size={64} className="result-icon winner" />
            <h1>Quiz Complete!</h1>
          </div>

          <div className="result-stats">
            <div className="result-stat">
              <span className="stat-label">Your Score</span>
              <span className="stat-value">{correctCount}/{questions.length}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{percentage}%</span>
            </div>
            {analysis?.avg_time_per_question && (
              <div className="result-stat">
                <span className="stat-label">Avg Time/Question</span>
                <span className="stat-value">{Math.round(analysis.avg_time_per_question)}s</span>
              </div>
            )}
          </div>

          {/* Weak/Strong Areas */}
          {analysis && (
            <div className="performance-insights">
              {analysis.weak_topics?.length > 0 && (
                <div className="insight-section weak">
                  <h3><AlertCircle size={18} /> Areas to Improve</h3>
                  <div className="topic-tags">
                    {analysis.weak_topics.map((topic, idx) => (
                      <span key={idx} className="topic-tag weak">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.strong_topics?.length > 0 && (
                <div className="insight-section strong">
                  <h3><CheckCircle size={18} /> Strong Areas</h3>
                  <div className="topic-tags">
                    {analysis.strong_topics.map((topic, idx) => (
                      <span key={idx} className="topic-tag strong">{topic}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question Review */}
          <div className="question-by-question">
            <h3>Review Your Answers</h3>
            <div className="questions-comparison-list">
              {(results?.results || []).map((result, index) => {
                const question = questions[index];
                const isCorrect = result.is_correct;
                let options = question?.options || [];
                if (typeof options === 'string') {
                  try { options = JSON.parse(options); } catch { options = []; }
                }

                return (
                  <div key={index} className={`question-comparison-item expanded ${isCorrect ? 'correct' : 'incorrect'}`}>
                    <div className="question-comparison-header">
                      <div className="question-number">Q{index + 1}</div>
                      <div className="question-text-full">{result.question_text || question?.question_text}</div>
                      <span className={`status-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                        {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>
                    
                    {options.length > 0 && (
                      <div className="answer-options-review">
                        {options.map((option, optIndex) => {
                          const optionLetter = String.fromCharCode(65 + optIndex);
                          const correctAnswer = String(result.correct_answer || '').toUpperCase();
                          const userAnswer = String(result.user_answer || '').toUpperCase();
                          const isCorrectOption = optionLetter === correctAnswer || correctAnswer.startsWith(optionLetter);
                          const isUserSelected = optionLetter === userAnswer || userAnswer.startsWith(optionLetter);
                          const optionText = typeof option === 'string' ? option.replace(/^[A-D]\)\s*/, '') : option;
                          
                          return (
                            <div 
                              key={optIndex} 
                              className={`answer-option-review ${isCorrectOption ? 'correct-answer' : ''} ${isUserSelected ? 'selected' : ''}`}
                            >
                              <div className="option-content">
                                <span className="option-letter">{optionLetter}</span>
                                <span className="option-text">{optionText}</span>
                                {isCorrectOption && <CheckCircle size={16} className="correct-icon" />}
                              </div>
                              {isUserSelected && (
                                <span className={`user-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                                  Your Answer {isCorrect ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!isCorrect && (result.explanation || question?.explanation) && (
                      <div className="question-explanation">
                        <Lightbulb size={16} />
                        <span>{result.explanation || question?.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="result-actions">
            <button className="result-button primary" onClick={handleRetry}>
              <RefreshCw size={18} />
              Try Another Quiz
            </button>
            <button className="result-button secondary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  
  let options = currentQuestion?.options || [];
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { options = []; }
  }
  if (currentQuestion?.question_type === 'true_false' && options.length === 0) {
    options = ['True', 'False'];
  }

  return (
    <div className="battle-session-page">
      <div className="session-header">
        <div className="session-info">
          <div className="info-item">
            <Target size={16} />
            <span>{quizData?.topic || 'Quiz'}</span>
          </div>
          <div className="info-item">
            <span className="question-counter">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
          </div>
        </div>
        
        <div className="session-timer">
          <Clock size={20} />
          <span className={timeRemaining < 60 ? 'time-warning' : ''}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="battle-session-container">
        <div className="question-card">
          <div className="question-header">
            <div className="question-meta">
              <span className="question-type-badge">
                {currentQuestion?.question_type?.replace('_', ' ')}
              </span>
              <span className={`difficulty-badge ${currentQuestion?.difficulty}`}>
                {currentQuestion?.difficulty}
              </span>
            </div>
            <h2 className="question-text">{currentQuestion?.question_text}</h2>
            {currentQuestion?.topic && (
              <p className="question-topic">Topic: {currentQuestion.topic}</p>
            )}
          </div>

          <div className="answers-grid">
            {options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const optionText = typeof option === 'string' ? option.replace(/^[A-D]\)\s*/, '') : option;
              
              // Show correct/incorrect after selection
              let showCorrect = false;
              let showIncorrect = false;
              if (selectedAnswer !== null) {
                const correctAnswer = String(currentQuestion?.correct_answer || '').toLowerCase();
                const selectedLetter = String.fromCharCode(65 + index).toLowerCase();
                showCorrect = selectedLetter === correctAnswer || correctAnswer.startsWith(selectedLetter);
                showIncorrect = isSelected && !showCorrect;
              }

              return (
                <button
                  key={index}
                  className={`answer-option ${isSelected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${showIncorrect ? 'incorrect' : ''}`}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{optionText}</span>
                  {showCorrect && <CheckCircle size={20} className="option-icon" />}
                  {showIncorrect && <XCircle size={20} className="option-icon" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="battle-sidebar">
          <div className="score-display">
            <Trophy size={24} />
            <div className="score-info">
              <span className="score-label">Current Score</span>
              <span className="score-value">{score}/{questions.length}</span>
            </div>
          </div>

          <div className="questions-overview">
            <h3>Progress</h3>
            <div className="question-dots">
              {questions.map((_, index) => (
                <div
                  key={index}
                  className={`question-dot ${
                    index < currentQuestionIndex ? 'answered' : 
                    index === currentQuestionIndex ? 'current' : 
                    'upcoming'
                  }`}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoloQuizSession;
