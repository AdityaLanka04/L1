import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader } from 'lucide-react';
import './QuestionBank.css';

const QuestionBank = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');

  const [activeTab, setActiveTab] = useState('generate');
  
  const [loading, setLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [savedQuestionsByDifficulty, setSavedQuestionsByDifficulty] = useState({
    easy: [],
    medium: [],
    hard: []
  });

  const [generationMode, setGenerationMode] = useState(null);
  const [topicInput, setTopicInput] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [difficultyMix, setDifficultyMix] = useState({ easy: 3, medium: 5, hard: 2 });
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  const [chatSessions, setChatSessions] = useState([]);
  const [selectedChatIds, setSelectedChatIds] = useState([]);

  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [selectedSlideIds, setSelectedSlideIds] = useState([]);

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  useEffect(() => {
    if (userName) {
      if (activeTab === 'generate') {
        loadChatSessions();
        loadUploadedSlides();
      } else {
        loadSavedQuestions();
      }
    }
  }, [activeTab, userName]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.username || data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const loadSavedQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/get_generated_questions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const questions = data.questions || [];
        
        const grouped = {
          easy: questions.filter(q => q.difficulty === 'easy'),
          medium: questions.filter(q => q.difficulty === 'medium'),
          hard: questions.filter(q => q.difficulty === 'hard')
        };
        setSavedQuestionsByDifficulty(grouped);
      }
    } catch (error) {
      console.error('Error loading saved questions:', error);
    } finally {
      setLoading(false);
    }
  }, [userName, token]);

  const loadChatSessions = useCallback(async () => {
    try {
      setSourceLoading(true);
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setSourceLoading(false);
    }
  }, [userName, token]);

  const loadUploadedSlides = useCallback(async () => {
    try {
      setSourceLoading(true);
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error loading slides:', error);
    } finally {
      setSourceLoading(false);
    }
  }, [userName, token]);

  const generateQuestions = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      
      if (!generationMode) {
        setErrorMessage('Please select a generation mode');
        setLoading(false);
        return;
      }

      if (generationMode === 'topic' && !topicInput.trim()) {
        setErrorMessage('Please enter a topic');
        setLoading(false);
        return;
      }

      if (generationMode === 'chat' && selectedChatIds.length === 0) {
        setErrorMessage('Please select at least one chat session');
        setLoading(false);
        return;
      }

      if (generationMode === 'slides' && selectedSlideIds.length === 0) {
        setErrorMessage('Please select at least one slide');
        setLoading(false);
        return;
      }

      const payload = {
        user_id: userName,
        question_count: questionCount,
        difficulty_mix: difficultyMix
      };

      if (generationMode === 'topic') {
        payload.topic = topicInput;
      } else if (generationMode === 'chat') {
        payload.chat_session_ids = selectedChatIds;
      } else if (generationMode === 'slides') {
        payload.slide_ids = selectedSlideIds;
      }

      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions(data.questions || []);
        
        setGenerationMode(null);
        setTopicInput('');
        setSelectedChatIds([]);
        setSelectedSlideIds([]);
        setTimeout(() => loadSavedQuestions(), 1000);
      } else {
        const errorData = await response.json();
        setErrorMessage(`Failed to generate questions: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setErrorMessage('Failed to generate questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChatToggle = (chatId) => {
    setSelectedChatIds(prev =>
      prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSlideToggle = (slideId) => {
    setSelectedSlideIds(prev =>
      prev.includes(slideId) ? prev.filter(id => id !== slideId) : [...prev, slideId]
    );
  };

  const selectAllChats = () => setSelectedChatIds(chatSessions.map(s => s.id));
  const clearAllChats = () => setSelectedChatIds([]);
  const selectAllSlides = () => setSelectedSlideIds(uploadedSlides.map(s => s.id));
  const clearAllSlides = () => setSelectedSlideIds([]);

  const renderDifficultySection = (difficulty, questions) => {
    if (questions.length === 0) return null;
    
    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    const colorClass = `difficulty-${difficulty}`;
    
    return (
      <div key={difficulty} className="difficulty-section">
        <h3 className={`difficulty-title ${colorClass}`}>
          {difficultyLabel} Questions ({questions.length})
        </h3>
        <div className="questions-grid">
          {questions.map((q, idx) => (
            <div key={idx} className="question-card">
              <div className={`difficulty-badge ${colorClass}`}>{difficulty.toUpperCase()}</div>
              <p className="question-text">{q.question}</p>
              {q.options && (
                <div className="options-list">
                  {q.options.map((opt, i) => (
                    <div key={i} className="option-item">{opt}</div>
                  ))}
                </div>
              )}
              {q.answer && (
                <div className="answer-section">
                  <strong>Answer:</strong> {q.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="questions-page">
      <header className="questions-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate('/learning-review')}>
              <ArrowLeft size={18} />
              Back
            </button>
            <h1 className="questions-title clickable-logo" onClick={() => navigate('/dashboard')}>brainwave</h1>
          </div>
          <div className="header-right">
            <button className="header-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
            <button className="header-btn logout-btn" onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
          </div>
        </div>
      </header>

      <nav className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generator
        </button>
        <button 
          className={`tab-btn ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => { setActiveTab('saved'); setGenerationMode(null); }}
        >
          Saved Questions
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'generate' && (
          <div className="generator-section">
            <div className="section-header">
              <h2 className="section-title">Generate Practice Questions</h2>
              <p className="section-subtitle">Create new questions from various sources</p>
            </div>

            {!generationMode && (
              <div className="mode-selector">
                <button 
                  className="mode-card"
                  onClick={() => setGenerationMode('topic')}
                >
                  <div className="mode-icon">TOPIC</div>
                  <h3>Your Own Topic</h3>
                  <p>Create questions from any topic</p>
                </button>
                <button 
                  className="mode-card"
                  onClick={() => setGenerationMode('chat')}
                  disabled={sourceLoading || chatSessions.length === 0}
                >
                  <div className="mode-icon">CHAT</div>
                  <h3>From Chat Sessions</h3>
                  <p>{chatSessions.length} sessions available</p>
                </button>
                <button 
                  className="mode-card"
                  onClick={() => setGenerationMode('slides')}
                  disabled={sourceLoading || uploadedSlides.length === 0}
                >
                  <div className="mode-icon">SLIDES</div>
                  <h3>From Slides</h3>
                  <p>{uploadedSlides.length} slides available</p>
                </button>
              </div>
            )}

            {generationMode === 'topic' && (
              <div className="generation-form">
                <button 
                  className="back-mode-btn"
                  onClick={() => setGenerationMode(null)}
                >
                  ← Back to Modes
                </button>

                {errorMessage && (
                  <div className="error-banner">{errorMessage}</div>
                )}

                <div className="form-group">
                  <label className="form-label">Topic</label>
                  <input
                    className="form-input"
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="Enter your topic..."
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Number of Questions</label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="50"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="difficulty-mix">
                  <label className="form-label">Difficulty Mix</label>
                  <div className="mix-inputs">
                    <div className="mix-field">
                      <span>Easy:</span>
                      <input
                        type="number"
                        min="0"
                        value={difficultyMix.easy}
                        onChange={(e) => setDifficultyMix({...difficultyMix, easy: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="mix-field">
                      <span>Medium:</span>
                      <input
                        type="number"
                        min="0"
                        value={difficultyMix.medium}
                        onChange={(e) => setDifficultyMix({...difficultyMix, medium: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="mix-field">
                      <span>Hard:</span>
                      <input
                        type="number"
                        min="0"
                        value={difficultyMix.hard}
                        onChange={(e) => setDifficultyMix({...difficultyMix, hard: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  className="submit-btn"
                  onClick={generateQuestions}
                  disabled={loading}
                >
                  {loading ? 'Generating Questions...' : 'Generate Questions'}
                </button>
              </div>
            )}

            {generationMode === 'chat' && (
              <div className="selection-form">
                <button 
                  className="back-mode-btn"
                  onClick={() => setGenerationMode(null)}
                >
                  ← Back to Modes
                </button>

                <div className="selection-controls">
                  <button onClick={selectAllChats} className="control-btn">Select All</button>
                  <button onClick={clearAllChats} className="control-btn">Clear All</button>
                  <span className="selection-count">{selectedChatIds.length} selected</span>
                </div>

                <div className="selection-list">
                  {sourceLoading ? (
                    <div className="loading-state"><Loader size={24} className="spinner" /></div>
                  ) : chatSessions.length === 0 ? (
                    <p className="empty-message">No chat sessions available</p>
                  ) : (
                    chatSessions.map(session => (
                      <label key={session.id} className="selection-item">
                        <input
                          type="checkbox"
                          checked={selectedChatIds.includes(session.id)}
                          onChange={() => handleChatToggle(session.id)}
                        />
                        <span>{session.title || session.name || `Session ${session.id}`}</span>
                      </label>
                    ))
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Questions per session</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  />
                </div>

                <button 
                  className="submit-btn"
                  onClick={generateQuestions}
                  disabled={loading || selectedChatIds.length === 0}
                >
                  {loading ? 'Generating Questions...' : 'Generate Questions'}
                </button>
              </div>
            )}

            {generationMode === 'slides' && (
              <div className="selection-form">
                <button 
                  className="back-mode-btn"
                  onClick={() => setGenerationMode(null)}
                >
                  ← Back to Modes
                </button>

                <div className="selection-controls">
                  <button onClick={selectAllSlides} className="control-btn">Select All</button>
                  <button onClick={clearAllSlides} className="control-btn">Clear All</button>
                  <span className="selection-count">{selectedSlideIds.length} selected</span>
                </div>

                <div className="selection-list">
                  {sourceLoading ? (
                    <div className="loading-state"><Loader size={24} className="spinner" /></div>
                  ) : uploadedSlides.length === 0 ? (
                    <p className="empty-message">No slides available</p>
                  ) : (
                    uploadedSlides.map(slide => (
                      <label key={slide.id} className="selection-item">
                        <input
                          type="checkbox"
                          checked={selectedSlideIds.includes(slide.id)}
                          onChange={() => handleSlideToggle(slide.id)}
                        />
                        <span>{slide.title || slide.name || `Slide ${slide.id}`}</span>
                      </label>
                    ))
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Questions per slide</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    max="50"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  />
                </div>

                <button 
                  className="submit-btn"
                  onClick={generateQuestions}
                  disabled={loading || selectedSlideIds.length === 0}
                >
                  {loading ? 'Generating Questions...' : 'Generate Questions'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="saved-section">
            <div className="section-header">
              <h2 className="section-title">My Questions</h2>
              <button 
                onClick={loadSavedQuestions}
                className="refresh-btn"
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <Loader size={40} className="spinner" />
                <p>Loading questions...</p>
              </div>
            ) : Object.values(savedQuestionsByDifficulty).every(q => q.length === 0) ? (
              <div className="empty-state">
                <h3>No Questions Yet</h3>
                <p>Generate some questions to get started!</p>
                <button 
                  className="get-started-btn"
                  onClick={() => setActiveTab('generate')}
                >
                  Get Started
                </button>
              </div>
            ) : (
              <div className="difficulties-container">
                {renderDifficultySection('easy', savedQuestionsByDifficulty.easy)}
                {renderDifficultySection('medium', savedQuestionsByDifficulty.medium)}
                {renderDifficultySection('hard', savedQuestionsByDifficulty.hard)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default QuestionBank;