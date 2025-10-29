import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Target, Trophy, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import './QuizBattleSession.css';

const QuizBattleSession = () => {
  const navigate = useNavigate();
  const { battleId } = useParams();
  const token = localStorage.getItem('token');
  
  const [battle, setBattle] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadBattle();
  }, [battleId]);

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

  const loadBattle = async () => {
    try {
      const response = await fetch(`http://localhost:8001/quiz_battle/${battleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBattle(data.battle);
        setTimeRemaining(data.battle.time_limit_seconds);
        
        // Check if questions already exist
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setLoading(false);
        } else {
          // Generate questions
          await generateQuestions(data.battle);
        }
      }
    } catch (error) {
      console.error('Error loading battle:', error);
      alert('Failed to load battle');
      navigate('/quiz-battles');
    }
  };

  const generateQuestions = async (battleData) => {
    setGeneratingQuestions(true);
    try {
      const response = await fetch('http://localhost:8001/generate_battle_questions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle_id: battleId,
          subject: battleData.subject,
          difficulty: battleData.difficulty,
          question_count: battleData.question_count
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions);
      } else {
        throw new Error('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions. Please try again.');
      navigate('/quiz-battles');
    } finally {
      setGeneratingQuestions(false);
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(answerIndex);
  };

  const handleNextQuestion = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correct_answer;
    
    const newAnsweredQuestions = [
      ...answeredQuestions,
      {
        question_id: currentQuestion.id,
        selected_answer: selectedAnswer,
        is_correct: isCorrect,
        time_taken: battle.time_limit_seconds - timeRemaining
      }
    ];
    
    setAnsweredQuestions(newAnsweredQuestions);
    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
    } else {
      submitBattle(score + (isCorrect ? 1 : 0), newAnsweredQuestions);
    }
  };

  const handleTimeUp = () => {
    submitBattle(score, answeredQuestions);
  };

  const submitBattle = async (finalScore, answers) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch('http://localhost:8001/complete_quiz_battle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle_id: parseInt(battleId),
          score: finalScore,
          answers: answers
        })
      });

      if (response.ok) {
        setShowResult(true);
      }
    } catch (error) {
      console.error('Error submitting battle:', error);
      alert('Failed to submit results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || generatingQuestions) {
    return (
      <div className="battle-session-loading">
        <Loader size={48} className="spinner" />
        <h2>{generatingQuestions ? 'Generating Questions...' : 'Loading Battle...'}</h2>
        <p>{generatingQuestions ? 'AI is creating custom questions for your battle' : 'Please wait'}</p>
      </div>
    );
  }

  if (showResult) {
    return (
      <div className="battle-result-page">
        <div className="result-container">
          <div className="result-header">
            <Trophy size={64} className="result-icon" />
            <h1>Battle Complete!</h1>
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
          </div>

          <div className="result-message">
            <p>Waiting for opponent to complete...</p>
            <p className="result-hint">You'll be notified when results are final</p>
          </div>

          <button 
            className="result-button"
            onClick={() => navigate('/quiz-battles')}
          >
            Back to Quiz Battles
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
            <span>{battle?.subject}</span>
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
              <span className={`difficulty-badge ${battle?.difficulty}`}>
                {battle?.difficulty}
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

          {selectedAnswer !== null && (
            <div className={`answer-feedback ${selectedAnswer === currentQuestion.correct_answer ? 'correct' : 'incorrect'}`}>
              <div className="feedback-icon">
                {selectedAnswer === currentQuestion.correct_answer ? (
                  <CheckCircle size={24} />
                ) : (
                  <XCircle size={24} />
                )}
              </div>
              <div className="feedback-text">
                <strong>
                  {selectedAnswer === currentQuestion.correct_answer ? 'Correct!' : 'Incorrect'}
                </strong>
                <p>{currentQuestion.explanation}</p>
              </div>
            </div>
          )}

          <div className="question-actions">
            {selectedAnswer !== null && (
              <button 
                className="next-question-btn"
                onClick={handleNextQuestion}
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Battle'}
              </button>
            )}
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

export default QuizBattleSession;