import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomPopup from './CustomPopup'; 
import './Flashcards.css';
import { API_URL } from '../config';
import gamificationService from '../services/gamificationService';

const Flashcards = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [topic, setTopic] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState('topic');
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [activePanel, setActivePanel] = useState('cards');
  const [flashcardHistory, setFlashcardHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [flashcardStats, setFlashcardStats] = useState(null);
  const [currentSetInfo, setCurrentSetInfo] = useState(null);
  const [autoSave, setAutoSave] = useState(true);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const navigate = useNavigate();
  
  // Enhanced flashcard generation parameters
  const [cardCount, setCardCount] = useState(10);
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [depthLevel, setDepthLevel] = useState('standard');
  const [focusAreas, setFocusAreas] = useState([]);
  const [focusInput, setFocusInput] = useState('');

  // Custom popup state
  const [popup, setPopup] = useState({
    isOpen: false,
    message: '',
    title: ''
  });

  const showPopup = (title, message) => {
    setPopup({ isOpen: true, title, message });
  };

  const closePopup = () => {
    setPopup({ isOpen: false, message: '', title: '' });
  };

  const addFocusArea = () => {
    if (focusInput.trim() && !focusAreas.includes(focusInput.trim())) {
      setFocusAreas([...focusAreas, focusInput.trim()]);
      setFocusInput('');
    }
  };

  const removeFocusArea = (index) => {
    setFocusAreas(focusAreas.filter((_, i) => i !== index));
  };

  const handleFocusKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFocusArea();
    }
  };

  const generateChatSummaryTitle = async (chatHistory, flashcardsData = null) => {
    try {
      let textToAnalyze = '';
      
      if (flashcardsData && flashcardsData.length > 0) {
        textToAnalyze = flashcardsData
          .map(card => `${card.question} ${card.answer}`)
          .join(' ')
          .slice(0, 1500);
      } else if (chatHistory && chatHistory.length > 0) {
        textToAnalyze = chatHistory
          .filter(msg => (msg.user_message || msg.content) && (msg.ai_response || ''))
          .map(msg => `${msg.user_message || msg.content} ${msg.ai_response || ''}`)
          .join(' ')
          .slice(0, 1500);
      }
      
      if (!textToAnalyze.trim()) return 'Study Session Cards';
      
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('chat_data', textToAnalyze);
      formData.append('max_words', '4');
      formData.append('format', 'title');
      
      const response = await fetch(`${API_URL}/generate_chat_summary`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        return data.summary || 'AI Study Session';
      }
      return 'Study Session Cards';
    } catch (error) {
      console.error('Error in AI title generation:', error);
      return 'Study Session Cards';
    }
  };

  const loadChatSessions = useCallback(async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  }, [userName]);

  const loadFlashcardHistory = useCallback(async () => {
    if (!userName) return;
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_flashcard_history?user_id=${userName}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFlashcardHistory(data.flashcard_history || []);
      }
    } catch (error) {
      console.error('Error loading flashcard history:', error);
    }
    setLoadingHistory(false);
  }, [userName]);

  const loadFlashcardStats = useCallback(async () => {
    if (!userName) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_flashcard_statistics?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFlashcardStats(data);
      }
    } catch (error) {
      console.error('Error loading flashcard statistics:', error);
    }
  }, [userName]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');

    if (!token) {
      navigate('/login');
      return;
    }
    if (username) setUserName(username);
    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadFlashcardHistory();
      loadFlashcardStats();
    }
  }, [userName, loadChatSessions, loadFlashcardHistory, loadFlashcardStats]);

  const loadChatHistoryData = async () => {
    if (selectedSessions.length === 0) return [];
    try {
      const token = localStorage.getItem('token');
      const allMessages = [];
      for (const sessionId of selectedSessions) {
        const response = await fetch(`${API_URL}/get_chat_history/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          allMessages.push(...data.messages);
        }
      }
      return allMessages;
    } catch (error) {
      console.error('Error loading chat history:', error);
      return [];
    }
  };

  const generateFlashcards = async () => {
    if (generationMode === 'topic' && !topic.trim()) return;
    if (generationMode === 'chat_history' && selectedSessions.length === 0) {
      showPopup('No Sessions Selected', 'Please select at least one chat session.');
      return;
    }
    
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('card_count', cardCount.toString());
      formData.append('difficulty_level', difficultyLevel);
      formData.append('depth_level', depthLevel);
      formData.append('save_to_set', autoSave.toString());

      if (focusAreas.length > 0) {
        formData.append('focus_areas', JSON.stringify(focusAreas));
      }

      if (generationMode === 'topic') {
        formData.append('topic', topic);
        formData.append('generation_type', 'topic');
        if (autoSave) {
          formData.append('set_title', `Flashcards: ${topic}`);
        }
      } else {
        const chatHistory = await loadChatHistoryData();
        formData.append('generation_type', 'chat_history');
        formData.append('chat_data', JSON.stringify(chatHistory));
        if (autoSave) {
          const summaryTitle = await generateChatSummaryTitle(chatHistory);
          formData.append('set_title', summaryTitle);
        }
      }

      let response = await fetch(`${API_URL}/generate_flashcards`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      

      if (!response.ok) throw new Error(`Failed to generate flashcards: ${response.status}`);

      const data = await response.json();
      setFlashcards(data.flashcards);
      setCurrentCard(0);
      setIsFlipped(false);

      if (data.saved_to_set) {
        setCurrentSetInfo({
          saved: true,
          setId: data.set_id,
          setTitle: data.set_title,
          cardCount: data.cards_saved || data.flashcards.length
        });
        loadFlashcardHistory();
        loadFlashcardStats();
        showPopup('Success!', `Created "${data.set_title}" with ${data.flashcards.length} cards.`);
        
        // Track gamification activity
        gamificationService.trackFlashcardSet(userName, data.flashcards.length);
      } else {
        setCurrentSetInfo({ saved: false, cardCount: data.flashcards.length });
        showPopup('Generated!', `Created ${data.flashcards.length} flashcards.`);
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      showPopup('Error', 'Failed to generate flashcards. Please try again.');
    }
    setGenerating(false);
  };

  const handleSessionToggle = (sessionId) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const selectAllSessions = () => setSelectedSessions(chatSessions.map(s => s.id));
  const clearAllSessions = () => setSelectedSessions([]);
  const goToChat = () => navigate('/chat');
  const handleNext = () => {
    if (currentCard < flashcards.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };
  
  const handlePrevious = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const loadFlashcardSet = async (setId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_flashcards_in_set?set_id=${setId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFlashcards(data.flashcards);
        setCurrentCard(0);
        setIsFlipped(false);
        setCurrentSetInfo({
          saved: true,
          setId: setId,
          setTitle: data.set_title,
          cardCount: data.flashcards.length
        });
        setActivePanel('generator');
        showPopup('Set Loaded', `Loaded "${data.set_title}" with ${data.flashcards.length} cards`);
      }
    } catch (error) {
      console.error('Error loading flashcard set:', error);
      showPopup('Error', 'Failed to load flashcard set');
    }
  };

  const deleteFlashcardSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this flashcard set?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_flashcard_set/${setId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        showPopup('Deleted', 'Flashcard set deleted successfully');
        loadFlashcardHistory();
        loadFlashcardStats();
        if (currentSetInfo && currentSetInfo.setId === setId) {
          setFlashcards([]);
          setCurrentSetInfo(null);
        }
      }
    } catch (error) {
      console.error('Error deleting flashcard set:', error);
      showPopup('Error', 'Failed to delete flashcard set');
    }
  };

  const startRenaming = (setId, currentTitle) => {
    setEditingSetId(setId);
    setEditingTitle(currentTitle);
  };

  const cancelRenaming = () => {
    setEditingSetId(null);
    setEditingTitle('');
  };

  const handleRenameSubmit = async (setId) => {
    if (!editingTitle.trim()) {
      cancelRenaming();
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/update_flashcard_set`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          set_id: setId,
          title: editingTitle.trim(),
          description: ''
        })
      });
      if (response.ok) {
        loadFlashcardHistory();
        if (currentSetInfo && currentSetInfo.setId === setId) {
          setCurrentSetInfo({ ...currentSetInfo, setTitle: editingTitle.trim() });
        }
        showPopup('Renamed', 'Flashcard set renamed successfully');
      }
    } catch (error) {
      console.error('Error renaming set:', error);
      showPopup('Error', 'Failed to rename flashcard set');
    }
    cancelRenaming();
  };

  const handleRenameKeyPress = (e, setId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(setId);
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  return (
    <div className="flashcards-page">
      <header className="flashcards-header">
        <div className="header-content">
          

<div className="header-left">
  <h1 className="page-title clickable-logo" onClick={() => navigate('/dashboard')}>
    cerbyl
  </h1>
  <p className="page-subtitle">flashcards</p>
</div>
          <div className="header-right">
            <button onClick={() => navigate('/dashboard')} className="back-btn">Dashboard</button>
          </div>
        </div>
      </header>

      <main className="flashcards-main">
        <div className="content-wrapper">
          <div className="panel-switcher">
            <button 
              className={`panel-btn ${activePanel === 'cards' ? 'active' : ''}`}
              onClick={() => setActivePanel('cards')}
            >
              My Cards
            </button>
            <button 
              className={`panel-btn ${activePanel === 'generator' ? 'active' : ''}`}
              onClick={() => setActivePanel('generator')}
            >
              Generator
            </button>
            <button 
              className={`panel-btn ${activePanel === 'statistics' ? 'active' : ''}`}
              onClick={() => setActivePanel('statistics')}
            >
              Statistics
            </button>
          </div>

          {activePanel === 'generator' && (
            <>
              <div className="generator-section">
                <h2 className="section-title">Generate Flashcards</h2>
                
                <div className="mode-tabs">
                  <button 
                    className={`mode-tab ${generationMode === 'topic' ? 'active' : ''}`}
                    onClick={() => setGenerationMode('topic')}
                  >
                    By Topic
                  </button>
                  <button 
                    className={`mode-tab ${generationMode === 'chat_history' ? 'active' : ''}`}
                    onClick={() => setGenerationMode('chat_history')}
                  >
                    From Chat History
                  </button>
                </div>

                {/* BY TOPIC SECTION */}
                {generationMode === 'topic' && (
                  <div className="generation-form-container">
                    {/* Topic Input */}
                    <div className="form-section">
                      <label className="form-label">Topic</label>
                      <input
                        type="text"
                        placeholder="Enter a topic (e.g., 'Physics - Newton's Laws')"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !generating && generateFlashcards()}
                        className="form-input"
                        disabled={generating}
                      />
                    </div>

                    {/* Configuration Grid - Horizontal Layout */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Number of Cards</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={cardCount}
                          onChange={(e) => setCardCount(parseInt(e.target.value) || 10)}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Difficulty Level</label>
                        <select
                          value={difficultyLevel}
                          onChange={(e) => setDifficultyLevel(e.target.value)}
                          className="form-select"
                        >
                          <option value="easy">Easy - Basic Recall</option>
                          <option value="medium">Medium - Application</option>
                          <option value="hard">Hard - Critical Analysis</option>
                          <option value="mixed">Mixed - All Levels</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Answer Depth</label>
                        <select
                          value={depthLevel}
                          onChange={(e) => setDepthLevel(e.target.value)}
                          className="form-select"
                        >
                          <option value="surface">Surface (1-2 sentences)</option>
                          <option value="standard">Standard (2-4 sentences)</option>
                          <option value="deep">Deep (4-6 sentences)</option>
                          <option value="comprehensive">Comprehensive (6+ sentences)</option>
                        </select>
                      </div>
                    </div>

                    {/* Focus Areas */}
                    <div className="form-section">
                      <label className="form-label">Focus Areas (Optional)</label>
                      <div className="focus-input-row">
                        <input
                          type="text"
                          value={focusInput}
                          onChange={(e) => setFocusInput(e.target.value)}
                          onKeyPress={handleFocusKeyPress}
                          placeholder="e.g., quantum mechanics"
                          className="form-input"
                        />
                        <button type="button" onClick={addFocusArea} className="add-btn">
                          Add
                        </button>
                      </div>
                      {focusAreas.length > 0 && (
                        <div className="focus-tags-container">
                          {focusAreas.map((area, index) => (
                            <div key={index} className="focus-tag">
                              {area}
                              <button
                                type="button"
                                onClick={() => removeFocusArea(index)}
                                className="remove-tag-btn"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={generateFlashcards}
                      disabled={generating || !topic.trim()}
                      className="submit-btn"
                    >
                      {generating ? 'Generating...' : 'Generate Flashcards'}
                    </button>
                  </div>
                )}

                {/* CHAT HISTORY SECTION */}
                {generationMode === 'chat_history' && (
                  <div className="chat-history-section">
                    <div className="chat-history-header">
                      <h3>Select Chat Sessions:</h3>
                      <div className="selection-controls">
                        <button onClick={selectAllSessions} className="select-all-btn" disabled={chatSessions.length === 0}>
                          Select All
                        </button>
                        <button onClick={clearAllSessions} className="clear-all-btn" disabled={selectedSessions.length === 0}>
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Number of Cards</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={cardCount}
                          onChange={(e) => setCardCount(parseInt(e.target.value) || 10)}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Difficulty Level</label>
                        <select
                          value={difficultyLevel}
                          onChange={(e) => setDifficultyLevel(e.target.value)}
                          className="form-select"
                        >
                          <option value="easy">Easy - Basic Recall</option>
                          <option value="medium">Medium - Application</option>
                          <option value="hard">Hard - Critical Analysis</option>
                          <option value="mixed">Mixed - All Levels</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Answer Depth</label>
                        <select
                          value={depthLevel}
                          onChange={(e) => setDepthLevel(e.target.value)}
                          className="form-select"
                        >
                          <option value="surface">Surface (1-2 sentences)</option>
                          <option value="standard">Standard (2-4 sentences)</option>
                          <option value="deep">Deep (4-6 sentences)</option>
                          <option value="comprehensive">Comprehensive (6+ sentences)</option>
                        </select>
                      </div>
                    </div>

                    {/* Focus Areas */}
                    
                    
                    {chatSessions.length === 0 ? (
                      <div className="no-chats">
                        <p>No chat sessions found. Start a conversation in <button onClick={goToChat} className="link-btn">AI Chat</button> first!</p>
                      </div>
                    ) : (
                      <div className="chat-sessions-grid">
                        {chatSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`chat-session-card ${selectedSessions.includes(session.id) ? 'selected' : ''}`}
                            onClick={() => handleSessionToggle(session.id)}
                          >
                            <div className="session-checkbox">
                              <input 
                                type="checkbox" 
                                checked={selectedSessions.includes(session.id)}
                                onChange={() => handleSessionToggle(session.id)}
                              />
                            </div>
                            <div className="session-info">
                              <div className="session-title">{session.title}</div>
                              <div className="session-date">{new Date(session.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="chat-generate-section">
                      <button
                        onClick={generateFlashcards}
                        disabled={generating || selectedSessions.length === 0}
                        className="submit-btn"
                      >
                        {generating ? 'Generating...' : `Generate from ${selectedSessions.length} Session(s)`}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FLASHCARDS DISPLAY SECTION */}
              {flashcards.length > 0 && (
                <div className="flashcards-display-section">
                  <div className="flashcard-header">
                    <h3 className="flashcard-set-title">
                      {currentSetInfo && currentSetInfo.saved ? currentSetInfo.setTitle : 'Preview'}
                    </h3>
                    <div className="card-count">{currentCard + 1} / {flashcards.length}</div>
                  </div>

                  <div className="flashcard-container">
                    <div 
                      className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <div className="flashcard-inner">
                        <div className="flashcard-front">
                          <div className="card-label">Question</div>
                          <div className="card-content">
                            {flashcards[currentCard]?.question}
                          </div>
                          <div className="flip-hint">Click to flip</div>
                        </div>
                        <div className="flashcard-back">
                          <div className="card-label">Answer</div>
                          <div className="card-content">
                            {flashcards[currentCard]?.answer}
                          </div>
                          <div className="flip-hint">Click to flip back</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="navigation-controls">
                    <button 
                      onClick={handlePrevious} 
                      disabled={currentCard === 0} 
                      className="nav-btn"
                    >
                      ← Previous
                    </button>
                    <button 
                      onClick={handleNext} 
                      disabled={currentCard === flashcards.length - 1} 
                      className="nav-btn"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activePanel === 'cards' && (
            <div className="cards-section">
              <div className="history-header">
                <h2 className="section-title">My Flashcard History</h2>
                <button 
                  onClick={() => {
                    loadFlashcardHistory();
                    loadFlashcardStats();
                  }}
                  className="refresh-btn"
                  disabled={loadingHistory}
                >
                  {loadingHistory ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              <div className="history-content">
                {loadingHistory ? (
                  <div className="loading-state"><p>Loading...</p></div>
                ) : flashcardHistory.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Flashcard Sets Yet</h3>
                    <p>Create your first set using the Generator tab!</p>
                    <button onClick={() => setActivePanel('generator')} className="get-started-btn">
                      Get Started
                    </button>
                  </div>
                ) : (
                  <div className="history-grid">
                    {flashcardHistory.map((set) => (
                      <div key={set.id} className="history-card">
                        <div className="history-card-header">
                          <div className="set-title">{set.title}</div>
                          <div className="set-date">{formatDate(set.created_at)}</div>
                        </div>
                        <div className="set-stats">
                          <span>{set.card_count} cards</span>
                          <span>{set.accuracy_percentage}% accuracy</span>
                        </div>
                        <div className="set-actions">
                          <button onClick={() => deleteFlashcardSet(set.id)} className="delete-btn">Delete</button>
                          <button onClick={() => loadFlashcardSet(set.id)} className="study-btn">Study</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activePanel === 'statistics' && (
            <div className="statistics-section">
              <h2 className="section-title">Statistics & Analytics</h2>
              {flashcardStats ? (
                <>
                  <div className="stats-main-grid">
                    <div className="stat-card-large">
                      <div className="stat-value">{flashcardStats.total_sets}</div>
                      <div className="stat-label">Total Sets</div>
                    </div>
                    <div className="stat-card-large">
                      <div className="stat-value">{flashcardStats.total_cards}</div>
                      <div className="stat-label">Total Cards</div>
                    </div>
                    <div className="stat-card-large">
                      <div className="stat-value">{flashcardStats.overall_accuracy}%</div>
                      <div className="stat-label">Accuracy</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <p>No statistics yet. Create and study flashcards to see analytics!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <CustomPopup
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        message={popup.message}
      />
    </div>
  );
};

export default Flashcards;