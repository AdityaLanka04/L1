import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Target, Trophy, CheckCircle, XCircle, Loader } from 'lucide-react';
import './QuizBattleSession.css'; // Reuse the same CSS
import { API_URL } from '../config';

const SoloQuizSession = () => {
  const navigate = useNavigate();
  const { quizId } = useParams();
  const token = localStorage.getItem('token');
  
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(null);

  useEffect(() => {
    loadQuiz();
  }, [quizId]);

  useEffect(() => {
    if (timeRemaining > 0 && !showResult) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && questions.length > 0) {
      handleTimeUp();
    }
  }, [timeRemaining, showResult]);

  const loadQuiz = async () => {
    try {
      const response = await fetch(`${API_URL}/solo_quiz/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setQuiz(data.quiz);
        setQuestions(data.questions);
        setTimeRemaining(data.quiz.time_limit_seconds);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      alert('Failed to load quiz');
      navigate('/solo-quiz');
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
    
    // Automatically advance after 2 seconds
    setTimeout(() => {
      handleNextQuestion(answerIndex);
    }, 2000);
  };

  const handleNextQuestion = (answerIndex = selectedAnswer) => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correct_answer;
    
    const newAnsweredQuestions = [
      ...answeredQuestions,
      {
        question_id: currentQuestion.id,
        selected_answer: answerIndex,
        is_correct: isCorrect,
        time_taken: quiz.time_limit_seconds - timeRemaining
      }
    ];
    
    setAnsweredQuestions(newAnsweredQuestions);
    
    const newScore = score + (isCorrect ? 1 : 0);
    setScore(newScore);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    } else {
      submitQuiz(newScore, newAnsweredQuestions);
    }
  };

  const handleTimeUp = () => {
    submitQuiz(score, answeredQuestions);
  };

  const submitQuiz = async (finalScore, answers) => {
    try {
      // Calculate percentage score
      const percentageScore = questions.length > 0 
        ? Math.round((finalScore / questions.length) * 100) 
        : 0;
      
      const response = await fetch(`${API_URL}/complete_solo_quiz`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quiz_id: parseInt(quizId),
          score: percentageScore,
          answers: answers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPointsEarned(data);
      }

      setShowResult(true);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="battle-session-loading">
        <Loader size={48} className="spinner" />
        <h2>Loading Quiz...</h2>
      </div>
    );
  }

  if (showResult) {
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
              <span className="stat-value">{score}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Total Questions</span>
              <span className="stat-value">{questions.length}</span>
            </div>
            <div className="result-stat">
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{Math.round((score / questions.length) * 100)}%</span>
            </div>
            {pointsEarned && (
              <div className="result-stat points-earned">
                <span className="stat-label">Points Earned</span>
                <span className="stat-value highlight">+{pointsEarned.points_earned}</span>
              </div>
            )}
          </div>
          
          {pointsEarned?.points_breakdown?.bonus_reasons?.length > 0 && (
            <div className="bonus-badges">
              {pointsEarned.points_breakdown.bonus_reasons.map((reason, idx) => (
                <span key={idx} className="bonus-badge">{reason}</span>
              ))}
            </div>
          )}

          <div className="question-by-question">
            <h3>Review Your Answers</h3>
            <div className="questions-comparison-list">
              {questions.map((question, index) => {
                const userAnswer = answeredQuestions[index];
                const userCorrect = userAnswer?.is_correct;
                const userSelectedIndex = userAnswer?.selected_answer;
                const correctAnswerIndex = question.correct_answer;
                const showExplanation = !userCorrect;

                return (
                  <div key={index} className="question-comparison-item expanded">
                    <div className="question-comparison-header">
                      <div className="question-number">Q{index + 1}</div>
                      <div className="question-text-full">{question.question}</div>
                    </div>
                    
                    <div className="answer-options-review">
                      {question.options.map((option, optIndex) => {
                        const isCorrect = optIndex === correctAnswerIndex;
                        const userSelected = optIndex === userSelectedIndex;
                        
                        return (
                          <div 
                            key={optIndex} 
                            className={`answer-option-review ${isCorrect ? 'correct-answer' : ''} ${userSelected ? 'selected' : ''}`}
                          >
                            <div className="option-content">
                              <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                              <span className="option-text">{option}</span>
                              {isCorrect && <CheckCircle size={16} className="correct-icon" />}
                            </div>
                            <div className="selection-indicators">
                              {userSelected && (
                                <span className={`user-badge you ${userCorrect ? 'correct' : 'incorrect'}`}>
                                  Your Answer {userCorrect ? '✓' : '✗'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {showExplanation && question.explanation && (
                      <div className="question-explanation">
                        <strong>Explanation:</strong> {question.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button 
            className="result-button"
            onClick={() => navigate('/solo-quiz')}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="battle-session-page">
      <div className="session-header">
        <div className="session-info">
          <div className="info-item">
            <Target size={16} />
            <span>{quiz?.subject}</span>
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
            <h2 className="question-text">{currentQuestion.question}</h2>
            <div className="question-difficulty">
              <span className={`difficulty-badge ${quiz?.difficulty}`}>
                {quiz?.difficulty}
              </span>
            </div>
          </div>

          <div className="answers-grid">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === currentQuestion.correct_answer;
              const showCorrect = selectedAnswer !== null && isCorrect;
              const showIncorrect = selectedAnswer !== null && isSelected && !isCorrect;

              return (
                <button
                  key={index}
                  className={`answer-option ${isSelected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${showIncorrect ? 'incorrect' : ''}`}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
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
