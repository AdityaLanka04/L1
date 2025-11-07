import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Target, Trophy, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import './QuizBattleSession.css';
import { API_URL } from '../config';
import useSharedWebSocket from '../hooks/useSharedWebSocket';

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
  const [opponentAnswers, setOpponentAnswers] = useState([]);
  const [opponentNotification, setOpponentNotification] = useState(null);
  const [opponentCompleted, setOpponentCompleted] = useState(false);
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [detailedBattleData, setDetailedBattleData] = useState(null);

  // WebSocket for live notifications (shared connection)
  const { isConnected } = useSharedWebSocket(token, (message) => {
    // Log ALL messages with full details
    console.log('📨 [QuizBattleSession] Received message:', message.type, 'Full message:', JSON.stringify(message));
    
    // Don't skip - process all messages
    if (message.type === 'connected') {
      console.log('✅ [QuizBattleSession] Connected to WebSocket');
      return;
    }
    
    if (message.type === 'pong') {
      return; // Skip pong silently
    }
    
    console.log('🔍 [QuizBattleSession] Processing message type:', message.type);
    console.log('🔍 [QuizBattleSession] Current battle ID:', battleId, 'Message battle ID:', message.battle_id, 'Match:', message.battle_id === parseInt(battleId));
    
    if (message.type === 'battle_answer_submitted') {
      console.log('📥 [QuizBattleSession] *** ANSWER NOTIFICATION RECEIVED ***');
      console.log('� [Q[uizBattleSession] Battle ID from message:', message.battle_id);
      console.log('📥 [QuizBattleSession] Current battle ID:', battleId);
      console.log('📥 [QuizBattleSession] Parsed battle ID:', parseInt(battleId));
      console.log('📥 [QuizBattleSession] Match result:', message.battle_id === parseInt(battleId));
      
      if (message.battle_id === parseInt(battleId)) {
        console.log('🎯 [QuizBattleSession] *** MATCH! SHOWING NOTIFICATION ***');
        const notificationData = {
          questionIndex: message.question_index,
          isCorrect: message.is_correct
        };
        console.log('📝 [QuizBattleSession] Notification data:', notificationData);
        
        // Show opponent's answer notification
        setOpponentNotification(notificationData);
        console.log('✅ [QuizBattleSession] State updated, notification should appear!');
        
        // Hide notification after 2 seconds
        setTimeout(() => {
          console.log('⏰ [QuizBattleSession] Hiding notification');
          setOpponentNotification(null);
        }, 2000);
      } else {
        console.log('⚠️ [QuizBattleSession] Battle ID mismatch, ignoring notification');
        console.log('⚠️ [QuizBattleSession] Expected:', parseInt(battleId), 'Got:', message.battle_id);
      }
    } else if (message.type === 'battle_opponent_completed' && message.battle_id === parseInt(battleId)) {
      console.log('✅ Opponent completed the battle');
      setOpponentCompleted(true);
      // Immediately try to fetch results
      console.log('🔄 Attempting to fetch results after opponent completion...');
      setTimeout(() => fetchDetailedResults(), 500);
    } else if (message.type === 'battle_completed' && message.battle_id === parseInt(battleId)) {
      console.log('🏁 Both users completed, fetching detailed results');
      // Both completed, fetch detailed results
      setOpponentCompleted(true);
      setTimeout(() => fetchDetailedResults(), 500);
    }
  });

  useEffect(() => {
    loadBattle();
  }, [battleId]);

  // Poll for detailed results when opponent completes
  useEffect(() => {
    if (opponentCompleted && showResult && !showDetailedResults) {
      console.log('🔄 Opponent completed, fetching detailed results...');
      fetchDetailedResults();
    }
  }, [opponentCompleted, showResult, showDetailedResults]);

  // Poll for results when waiting
  useEffect(() => {
    if (showResult && !showDetailedResults && !opponentCompleted) {
      console.log('⏳ Polling for opponent completion...');
      const pollInterval = setInterval(() => {
        console.log('🔄 Checking if opponent completed...');
        fetchDetailedResults();
      }, 3000); // Poll every 3 seconds

      return () => {
        console.log('🛑 Stopping poll interval');
        clearInterval(pollInterval);
      };
    }
  }, [showResult, showDetailedResults, opponentCompleted]);

  // Debug: Log when notification state changes
  useEffect(() => {
    if (opponentNotification) {
      console.log('🔔 Notification state updated:', opponentNotification);
      console.log('🎨 Notification should be visible now!');
    } else {
      console.log('🔕 Notification state cleared');
    }
  }, [opponentNotification]);

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
      const response = await fetch(`${API_URL}/quiz_battle/${battleId}`, {
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
      const response = await fetch(`${API_URL}/generate_battle_questions`, {
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

  const submitAnswerNotification = async (questionIndex, isCorrect) => {
    try {
      console.log(`📤 Submitting answer notification: Q${questionIndex}, Correct: ${isCorrect}`);
      const response = await fetch(`${API_URL}/submit_battle_answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle_id: parseInt(battleId),
          question_index: questionIndex,
          is_correct: isCorrect
        })
      });
      
      if (response.ok) {
        console.log('✅ Answer notification sent successfully');
      } else {
        console.error('❌ Failed to send answer notification:', response.status);
      }
    } catch (error) {
      console.error('❌ Error submitting answer notification:', error);
    }
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

    // Send live notification to opponent
    submitAnswerNotification(currentQuestionIndex, isCorrect);

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
      const response = await fetch(`${API_URL}/complete_quiz_battle`, {
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
        const data = await response.json();
        setShowResult(true);
        
        // If both completed, fetch detailed results
        if (data.both_completed) {
          fetchDetailedResults();
        }
      }
    } catch (error) {
      console.error('Error submitting battle:', error);
      alert('Failed to submit results');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchDetailedResults = async () => {
    try {
      console.log('🔄 Fetching detailed results for battle:', battleId);
      const response = await fetch(`${API_URL}/quiz_battle/${battleId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Battle data received:', data);
        console.log('✅ Your completed:', data.battle.your_completed);
        console.log('✅ Opponent completed:', data.battle.opponent_completed);
        console.log('📦 Has your_answers:', !!data.battle.your_answers);
        console.log('📦 Has opponent_answers:', !!data.battle.opponent_answers);
        
        if (data.battle.opponent_completed && data.battle.your_completed) {
          console.log('🎉 Both completed! Showing detailed results');
          setDetailedBattleData(data);
          setShowDetailedResults(true);
          setOpponentCompleted(true); // Ensure this is set
        } else {
          console.log('⏳ Still waiting...');
          console.log('   - Your completed:', data.battle.your_completed);
          console.log('   - Opponent completed:', data.battle.opponent_completed);
        }
      } else {
        console.error('❌ Failed to fetch battle data:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching detailed results:', error);
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
    if (showDetailedResults && detailedBattleData) {
      // Show detailed comparison
      const { battle: battleData, questions: battleQuestions } = detailedBattleData;
      const yourAnswers = battleData.your_answers || [];
      const opponentAnswers = battleData.opponent_answers || [];
      const youWon = battleData.your_score > battleData.opponent_score;
      const isDraw = battleData.your_score === battleData.opponent_score;

      return (
        <div className="battle-result-page detailed">
          <div className="result-container detailed">
            <div className="result-header">
              <Trophy size={64} className={`result-icon ${youWon ? 'winner' : isDraw ? 'draw' : 'loser'}`} />
              <h1>{youWon ? ' Victory!' : isDraw ? ' Draw!' : ' Good Try!'}</h1>
            </div>

            <div className="result-comparison">
              <div className="player-result you">
                <h3>You</h3>
                <div className="player-score">{battleData.your_score}</div>
                <div className="player-accuracy">{Math.round((battleData.your_score / battleQuestions.length) * 100)}%</div>
              </div>
              <div className="vs-divider">VS</div>
              <div className="player-result opponent">
                <h3>{battleData.opponent.first_name || battleData.opponent.username}</h3>
                <div className="player-score">{battleData.opponent_score}</div>
                <div className="player-accuracy">{Math.round((battleData.opponent_score / battleQuestions.length) * 100)}%</div>
              </div>
            </div>

            <div className="question-by-question">
              <h3>Question by Question Breakdown</h3>
              <div className="questions-comparison-list">
                {battleQuestions.map((question, index) => {
                  const yourAnswer = yourAnswers[index];
                  const opponentAnswer = opponentAnswers[index];
                  const yourCorrect = yourAnswer?.is_correct;
                  const opponentCorrect = opponentAnswer?.is_correct;

                  return (
                    <div key={index} className="question-comparison-item">
                      <div className="question-number">Q{index + 1}</div>
                      <div className="question-text-small">{question.question}</div>
                      <div className="answer-indicators">
                        <div className={`answer-indicator you ${yourCorrect ? 'correct' : 'incorrect'}`}>
                          {yourCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                          <span>You</span>
                        </div>
                        <div className={`answer-indicator opponent ${opponentCorrect ? 'correct' : 'incorrect'}`}>
                          {opponentCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                          <span>Opponent</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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

    // Waiting for opponent
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
            {opponentCompleted ? (
              <>
                <Loader size={32} className="spinner" />
                <p>Loading final results...</p>
              </>
            ) : (
              <>
                <p>Waiting for opponent to complete...</p>
                <p className="result-hint">You'll see detailed results when they finish</p>
              </>
            )}
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
      {/* Live opponent notification */}
      {opponentNotification && (
        <div className={`opponent-notification ${opponentNotification.isCorrect ? 'correct' : 'incorrect'}`}>
          <div className="notification-content">
            {opponentNotification.isCorrect ? (
              <>
                <CheckCircle size={20} />
                <span>Opponent got Q{opponentNotification.questionIndex + 1} correct!</span>
              </>
            ) : (
              <>
                <XCircle size={20} />
                <span>Opponent got Q{opponentNotification.questionIndex + 1} wrong</span>
              </>
            )}
          </div>
        </div>
      )}

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