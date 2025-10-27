import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Play, FileText, MessageSquare, Loader, CheckCircle, XCircle } from 'lucide-react';
import './QuestionBank.css';

const QuestionBank = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id') || localStorage.getItem('username');

  // State
  const [questionSets, setQuestionSets] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);

  // Generation form state
  const [selectedChats, setSelectedChats] = useState([]);
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 3, medium: 5, hard: 2 });

  useEffect(() => {
    fetchQuestionSets();
    fetchChatSessions();
    fetchUploadedSlides();
  }, []);

  const fetchQuestionSets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_question_sets?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuestionSets(data.question_sets || []);
      }
    } catch (error) {
      console.error('Error fetching question sets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatSessions = async () => {
    try {
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
    }
  };

  const fetchUploadedSlides = async () => {
    try {
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error fetching slides:', error);
    }
  };

  const handleGenerateQuestions = async () => {
    if (selectedChats.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one source (chat or slide)');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          chat_session_ids: selectedChats,
          slide_ids: selectedSlides,
          question_count: questionCount,
          difficulty_mix: difficultyMix
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowGenerateModal(false);
        setSelectedChats([]);
        setSelectedSlides([]);
        await fetchQuestionSets();
        alert(`Successfully generated ${data.question_count} questions!`);
      } else {
        alert('Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const startPractice = async (questionSetId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_question_set/${questionSetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedQuestionSet(data);
        setCurrentQuestion(0);
        setUserAnswers({});
        setShowResults(false);
        setShowPracticeModal(true);
      }
    } catch (error) {
      console.error('Error starting practice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const submitAnswers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/submit_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          question_set_id: selectedQuestionSet.id,
          answers: userAnswers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestionSet = async (questionSetId) => {
    if (!window.confirm('Delete this question set?')) return;

    try {
      const response = await fetch(`http://localhost:8001/delete_question_set/${questionSetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchQuestionSets();
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
    }
  };

  return (
    <div className="qb-page">
      {/* Header */}
      <header className="qb-header">
        <div className="qb-header-left">
          <button className="qb-back-btn" onClick={() => navigate('/learning-review')}>
            <ArrowLeft size={20} />
            <span>BACK</span>
          </button>
          <div className="qb-header-title-group">
            <h1 className="qb-logo">brainwave</h1>
            <span className="qb-subtitle">QUESTION BANK</span>
          </div>
        </div>
        <div className="qb-header-right">
          <button className="qb-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
          <button className="qb-nav-btn logout" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {/* Main Content */}
      <div className="qb-content">
        {/* Header Section */}
        <div className="qb-section-header">
          <div className="qb-header-content">
            <div>
              <h2 className="qb-section-title">Question Bank</h2>
              <p className="qb-section-subtitle">Generate practice questions from your chats and slides</p>
            </div>
            <button className="qb-generate-btn" onClick={() => setShowGenerateModal(true)}>
              <Plus size={20} />
              <span>Generate Questions</span>
            </button>
          </div>
        </div>

        {/* Question Sets Grid */}
        <div className="qb-main">
          {loading && questionSets.length === 0 ? (
            <div className="qb-loading">
              <Loader size={40} className="qb-spinner" />
              <p>Loading question sets...</p>
            </div>
          ) : questionSets.length === 0 ? (
            <div className="qb-empty">
              <p>No question sets yet. Generate your first set to get started!</p>
            </div>
          ) : (
            <div className="qb-grid">
              {questionSets.map(set => (
                <div key={set.id} className="qb-card">
                  <div className="qb-card-header">
                    <div className="qb-card-icon">
                      <FileText size={24} />
                    </div>
                    <button 
                      className="qb-delete-btn"
                      onClick={() => deleteQuestionSet(set.id)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="qb-card-content">
                    <h3 className="qb-card-title">{set.title}</h3>
                    <p className="qb-card-description">{set.description}</p>
                    
                    <div className="qb-card-stats">
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Questions:</span>
                        <span className="qb-stat-value">{set.question_count}</span>
                      </div>
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Best Score:</span>
                        <span className="qb-stat-value">{set.best_score}%</span>
                      </div>
                      <div className="qb-stat-item">
                        <span className="qb-stat-label">Attempts:</span>
                        <span className="qb-stat-value">{set.attempt_count}</span>
                      </div>
                    </div>

                    <div className="qb-difficulty-bars">
                      <div className="qb-difficulty-bar easy" style={{ width: `${(set.easy_count / set.question_count) * 100}%` }}>
                        {set.easy_count > 0 && <span>{set.easy_count}</span>}
                      </div>
                      <div className="qb-difficulty-bar medium" style={{ width: `${(set.medium_count / set.question_count) * 100}%` }}>
                        {set.medium_count > 0 && <span>{set.medium_count}</span>}
                      </div>
                      <div className="qb-difficulty-bar hard" style={{ width: `${(set.hard_count / set.question_count) * 100}%` }}>
                        {set.hard_count > 0 && <span>{set.hard_count}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="qb-card-footer">
                    <button 
                      className="qb-practice-btn"
                      onClick={() => startPractice(set.id)}
                    >
                      <Play size={16} />
                      <span>Start Practice</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Generate Questions Modal */}
      {showGenerateModal && (
        <div className="qb-modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="qb-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>Generate Questions</h3>
              <button className="qb-modal-close" onClick={() => setShowGenerateModal(false)}>×</button>
            </div>

            <div className="qb-modal-content">
              {/* Chat Sessions */}
              <div className="qb-source-section">
                <h4 className="qb-source-title">
                  <MessageSquare size={18} />
                  <span>Select Chat Sessions</span>
                </h4>
                <div className="qb-source-list">
                  {chatSessions.slice(0, 10).map(chat => (
                    <label key={chat.id} className="qb-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedChats.includes(chat.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedChats([...selectedChats, chat.id]);
                          } else {
                            setSelectedChats(selectedChats.filter(id => id !== chat.id));
                          }
                        }}
                      />
                      <span>{chat.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Slides */}
              <div className="qb-source-section">
                <h4 className="qb-source-title">
                  <FileText size={18} />
                  <span>Select Slides</span>
                </h4>
                <div className="qb-source-list">
                  {uploadedSlides.slice(0, 10).map(slide => (
                    <label key={slide.id} className="qb-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedSlides.includes(slide.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedSlides([...selectedSlides, slide.id]);
                          } else {
                            setSelectedSlides(selectedSlides.filter(id => id !== slide.id));
                          }
                        }}
                      />
                      <span>{slide.filename}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Question Count */}
              <div className="qb-form-group">
                <label>Number of Questions: {questionCount}</label>
                <input
                  type="range"
                  min="5"
                  max="30"
                  value={questionCount}
                  onChange={e => setQuestionCount(parseInt(e.target.value))}
                  className="qb-slider"
                />
              </div>

              {/* Difficulty Mix */}
              <div className="qb-form-group">
                <label>Difficulty Distribution:</label>
                <div className="qb-difficulty-inputs">
                  <div className="qb-difficulty-input">
                    <label>Easy:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.easy}
                      onChange={e => setDifficultyMix({ ...difficultyMix, easy: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Medium:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.medium}
                      onChange={e => setDifficultyMix({ ...difficultyMix, medium: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="qb-difficulty-input">
                    <label>Hard:</label>
                    <input
                      type="number"
                      min="0"
                      max={questionCount}
                      value={difficultyMix.hard}
                      onChange={e => setDifficultyMix({ ...difficultyMix, hard: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="qb-modal-footer">
              <button className="qb-btn-cancel" onClick={() => setShowGenerateModal(false)}>Cancel</button>
              <button className="qb-btn-generate" onClick={handleGenerateQuestions} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Practice Modal */}
      {showPracticeModal && selectedQuestionSet && (
        <div className="qb-modal-overlay" onClick={() => setShowPracticeModal(false)}>
          <div className="qb-modal qb-practice-modal" onClick={e => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>{selectedQuestionSet.title}</h3>
              <button className="qb-modal-close" onClick={() => setShowPracticeModal(false)}>×</button>
            </div>

            <div className="qb-modal-content">
              {!showResults ? (
                <>
                  <div className="qb-progress">
                    <span>Question {currentQuestion + 1} of {selectedQuestionSet.questions.length}</span>
                    <div className="qb-progress-bar">
                      <div 
                        className="qb-progress-fill" 
                        style={{ width: `${((currentQuestion + 1) / selectedQuestionSet.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {selectedQuestionSet.questions.map((q, idx) => (
                    <div 
                      key={q.id} 
                      className={`qb-question-container ${idx === currentQuestion ? 'active' : ''}`}
                      style={{ display: idx === currentQuestion ? 'block' : 'none' }}
                    >
                      <div className="qb-question-header">
                        <span className={`qb-difficulty-badge ${q.difficulty}`}>{q.difficulty}</span>
                        <span className="qb-topic-badge">{q.topic}</span>
                      </div>

                      <p className="qb-question-text">{q.question_text}</p>

                      {q.question_type === 'multiple_choice' && (
                        <div className="qb-options">
                          {q.options.map((option, optIdx) => (
                            <label key={optIdx} className="qb-option">
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={option}
                                checked={userAnswers[q.id] === option}
                                onChange={() => handleAnswerChange(q.id, option)}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'true_false' && (
                        <div className="qb-options">
                          <label className="qb-option">
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value="true"
                              checked={userAnswers[q.id] === 'true'}
                              onChange={() => handleAnswerChange(q.id, 'true')}
                            />
                            <span>True</span>
                          </label>
                          <label className="qb-option">
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value="false"
                              checked={userAnswers[q.id] === 'false'}
                              onChange={() => handleAnswerChange(q.id, 'false')}
                            />
                            <span>False</span>
                          </label>
                        </div>
                      )}

                      {q.question_type === 'short_answer' && (
                        <textarea
                          className="qb-textarea"
                          value={userAnswers[q.id] || ''}
                          onChange={e => handleAnswerChange(q.id, e.target.value)}
                          placeholder="Type your answer here..."
                          rows={4}
                        />
                      )}
                    </div>
                  ))}

                  <div className="qb-navigation-btns">
                    <button 
                      className="qb-nav-prev"
                      onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                      disabled={currentQuestion === 0}
                    >
                      Previous
                    </button>
                    {currentQuestion < selectedQuestionSet.questions.length - 1 ? (
                      <button 
                        className="qb-nav-next"
                        onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      >
                        Next
                      </button>
                    ) : (
                      <button 
                        className="qb-submit-btn"
                        onClick={submitAnswers}
                        disabled={loading}
                      >
                        {loading ? 'Submitting...' : 'Submit Answers'}
                      </button>
                    )}
                  </div>
                </>
              ) : results && (
                <div className="qb-results">
                  <div className="qb-results-header">
                    <div className="qb-score-circle">
                      <span className="qb-score-value">{results.score}%</span>
                      <span className="qb-score-label">Score</span>
                    </div>
                    <div className="qb-results-stats">
                      <div className="qb-result-stat correct">
                        <CheckCircle size={24} />
                        <span>{results.correct_count} Correct</span>
                      </div>
                      <div className="qb-result-stat incorrect">
                        <XCircle size={24} />
                        <span>{results.total_questions - results.correct_count} Incorrect</span>
                      </div>
                    </div>
                  </div>

                  <div className="qb-results-details">
                    <h4>Review Your Answers</h4>
                    {results.details.map((detail, idx) => (
                      <div key={idx} className={`qb-result-item ${detail.is_correct ? 'correct' : 'incorrect'}`}>
                        <div className="qb-result-indicator">
                          {detail.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        </div>
                        <div className="qb-result-content">
                          <p className="qb-result-answer">
                            <strong>Your answer:</strong> {detail.user_answer || 'No answer'}
                          </p>
                          {!detail.is_correct && (
                            <p className="qb-result-correct">
                              <strong>Correct answer:</strong> {detail.correct_answer}
                            </p>
                          )}
                          {detail.explanation && (
                            <p className="qb-result-explanation">{detail.explanation}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    className="qb-btn-close-results"
                    onClick={() => {
                      setShowPracticeModal(false);
                      setShowResults(false);
                      fetchQuestionSets();
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;