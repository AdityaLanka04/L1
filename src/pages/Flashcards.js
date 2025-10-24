import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Flashcards.css';
import CustomPopup from './CustomPopup'; 

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
  const [activePanel, setActivePanel] = useState('cards'); // 'cards', 'generator', or 'statistics'
  const [flashcardHistory, setFlashcardHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [flashcardStats, setFlashcardStats] = useState(null);
  const [currentSetInfo, setCurrentSetInfo] = useState(null); // Track if current flashcards are saved
  const [autoSave, setAutoSave] = useState(true); // Option to auto-save generated flashcards
  const [editingSetId, setEditingSetId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const navigate = useNavigate();

  // Custom popup state
  const [popup, setPopup] = useState({
    isOpen: false,
    message: '',
    title: ''
  });

  // Popup helper functions
  const showPopup = (title, message) => {
    setPopup({
      isOpen: true,
      title,
      message
    });
  };

  const closePopup = () => {
    setPopup({
      isOpen: false,
      message: '',
      title: ''
    });
  };

  // Function to generate 4-word summary from chat content
  const generateChatSummaryTitle = async (chatHistory, flashcardsData = null) => {
  try {
    let textToAnalyze = '';
    
    // Use flashcard content if available (most relevant)
    if (flashcardsData && flashcardsData.length > 0) {
      textToAnalyze = flashcardsData
        .map(card => `${card.question} ${card.answer}`)
        .join(' ')
        .slice(0, 1500);
      console.log('Using flashcard content for AI title generation');
    } 
    // Use chat history
    else if (chatHistory && chatHistory.length > 0) {
      textToAnalyze = chatHistory
        .filter(msg => (msg.user_message || msg.content) && (msg.ai_response || ''))
        .map(msg => `${msg.user_message || msg.content} ${msg.ai_response || ''}`)
        .join(' ')
        .slice(0, 1500);
      console.log('Using chat history for AI title generation');
    }
    
    if (!textToAnalyze.trim()) {
      console.log('No content available for title generation');
      return 'Study Session Cards';
    }
    
    // Call the AI endpoint
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('chat_data', textToAnalyze);
    formData.append('max_words', '4');
    formData.append('format', 'title');
    
    console.log('Calling AI endpoint for title generation...');
    
    const response = await fetch('http://localhost:8001/generate_chat_summary', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (response.ok) {
      const data = await response.json();
      console.log('AI generated title:', data.summary);
      return data.summary || 'AI Study Session';
    } else {
      console.error('AI title generation failed:', response.status);
      return 'Study Session Cards';
    }
    
  } catch (error) {
    console.error('Error in AI title generation:', error);
    return 'Study Session Cards';
  }
};

  const loadChatSessions = useCallback(async () => {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
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
      const response = await fetch(`http://localhost:8001/get_flashcard_history?user_id=${userName}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Flashcard history loaded:', data); // Debug log
        setFlashcardHistory(data.flashcard_history || []);
      } else {
        console.error('Failed to load flashcard history:', response.status);
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
      const response = await fetch(`http://localhost:8001/get_flashcard_statistics?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFlashcardStats(data);
      } else {
        console.error('Failed to load flashcard statistics:', response.status);
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

    if (username) {
      setUserName(username);
    }

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
        const response = await fetch(`http://localhost:8001/get_chat_history/${sessionId}`, {
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
      showPopup('No Sessions Selected', 'Please select at least one chat session to generate flashcards from your conversation history.');
      return;
    }
    
    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      
      // Use the advanced endpoint with save functionality
      formData.append('difficulty_level', 'medium');
      formData.append('card_count', '10');
      formData.append('save_to_set', autoSave ? 'true' : 'false');

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
          // Generate 4-word summary title instead of using date
          const summaryTitle = await generateChatSummaryTitle(chatHistory);
          formData.append('set_title', summaryTitle);
        }
      }

      // Try the advanced endpoint first, fallback to basic if needed
      let response = await fetch('http://localhost:8001/generate_flashcards_advanced/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      // Fallback to basic endpoint if advanced is not available
      if (!response.ok && response.status === 404) {
        console.log('Advanced endpoint not available, using basic endpoint');
        const basicFormData = new FormData();
        basicFormData.append('user_id', userName);
        
        if (generationMode === 'topic') {
          basicFormData.append('topic', topic);
          basicFormData.append('generation_type', 'topic');
        } else {
          const chatHistory = await loadChatHistoryData();
          basicFormData.append('generation_type', 'chat_history');
          basicFormData.append('chat_data', JSON.stringify(chatHistory));
        }

        response = await fetch('http://localhost:8001/generate_flashcards/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: basicFormData
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to generate flashcards: ${response.status}`);
      }

      const data = await response.json();
      console.log('Generated flashcards:', data); // Debug log
      
      setFlashcards(data.flashcards);
      setCurrentCard(0);
      setIsFlipped(false);

      // Track if the set was saved
      if (data.saved_to_set) {
        setCurrentSetInfo({
          saved: true,
          setId: data.set_id,
          setTitle: data.set_title,
          cardCount: data.cards_saved || data.flashcards.length
        });
        
        // Refresh history if cards were saved
        loadFlashcardHistory();
        loadFlashcardStats();
        
        showPopup('Flashcards Generated Successfully!', `Created "${data.set_title}" with ${data.flashcards.length} cards. Your flashcards have been saved to your collection.`);
      } else {
        setCurrentSetInfo({
          saved: false,
          flashcards: data.flashcards
        });
      }

    } catch (error) {
      console.error('Error generating flashcards:', error);
      showPopup('Generation Failed', 'Failed to generate flashcards. Please check your internet connection and try again.');
    }
    setGenerating(false);
  };

  const saveCurrentFlashcards = async () => {
    if (!flashcards.length || currentSetInfo?.saved) return;

    try {
      const token = localStorage.getItem('token');
      
      // Generate appropriate title
      let setTitle;
      let setDescription;
      
      if (generationMode === 'topic') {
        setTitle = `Flashcards: ${topic}`;
        setDescription = `Generated from topic: ${topic}`;
      } else {
        // Generate 4-word summary for chat history
        const chatHistory = await loadChatHistoryData();
        setTitle = await generateChatSummaryTitle(chatHistory);
        setDescription = `Generated from ${selectedSessions.length} chat session(s)`;
      }

      // Create a new flashcard set
      const setData = {
        user_id: userName,
        title: setTitle,
        description: setDescription,
        source_type: generationMode
      };

      const createSetResponse = await fetch('http://localhost:8001/create_flashcard_set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(setData)
      });

      if (!createSetResponse.ok) {
        throw new Error('Failed to create flashcard set');
      }

      const setResult = await createSetResponse.json();
      const setId = setResult.id;

      // Add all flashcards to the set
      let savedCount = 0;
      for (const card of flashcards) {
        const cardData = {
          set_id: setId,
          question: card.question,
          answer: card.answer,
          difficulty: card.difficulty || 'medium',
          category: card.category || 'general'
        };

        const addCardResponse = await fetch('http://localhost:8001/add_flashcard_to_set', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cardData)
        });

        if (addCardResponse.ok) {
          savedCount++;
        }
      }

      setCurrentSetInfo({
        saved: true,
        setId: setId,
        setTitle: setData.title,
        cardCount: savedCount
      });

      // Refresh history
      loadFlashcardHistory();
      loadFlashcardStats();

      showPopup('Flashcards Saved!', `Created "${setData.title}" with ${savedCount} cards. Your flashcards have been added to your collection.`);

    } catch (error) {
      console.error('Error saving flashcards:', error);
      showPopup('Save Failed', 'Failed to save flashcards. Please try again.');
    }
  };

  const loadFlashcardSet = async (setId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_flashcards_in_set?set_id=${setId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedCards = data.flashcards.map(card => ({
          question: card.question,
          answer: card.answer,
          difficulty: card.difficulty,
          category: card.category
        }));
        
        setFlashcards(formattedCards);
        setCurrentCard(0);
        setIsFlipped(false);
        setCurrentSetInfo({
          saved: true,
          setId: setId,
          setTitle: data.set_title,
          cardCount: formattedCards.length
        });
        setActivePanel('generator'); // Switch back to generator tab to show cards
      }
    } catch (error) {
      console.error('Error loading flashcard set:', error);
      showPopup('Load Failed', 'Failed to load flashcard set. Please try again.');
    }
  };

  const deleteFlashcardSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this flashcard set? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_flashcard_set/${setId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        // Refresh the history
        loadFlashcardHistory();
        loadFlashcardStats();
        showPopup('Set Deleted', 'Flashcard set deleted successfully!');
      } else {
        throw new Error('Failed to delete flashcard set');
      }
    } catch (error) {
      console.error('Error deleting flashcard set:', error);
      showPopup('Delete Failed', 'Failed to delete flashcard set. Please try again.');
    }
  };

  const renameFlashcardSet = async (setId, newTitle) => {
    if (!newTitle.trim()) {
      showPopup('Invalid Title', 'Please enter a valid title for your flashcard set.');
      return false;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/update_flashcard_set', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          set_id: setId,
          title: newTitle.trim(),
          description: flashcardHistory.find(set => set.id === setId)?.description || ''
        })
      });
      
      if (response.ok) {
        // Update current set info if this is the active set
        if (currentSetInfo?.setId === setId) {
          setCurrentSetInfo({
            ...currentSetInfo,
            setTitle: newTitle.trim()
          });
        }
        
        // Refresh the history
        loadFlashcardHistory();
        setEditingSetId(null);
        setEditingTitle('');
        return true;
      } else {
        throw new Error('Failed to rename flashcard set');
      }
    } catch (error) {
      console.error('Error renaming flashcard set:', error);
      showPopup('Rename Failed', 'Failed to rename flashcard set. Please try again.');
      return false;
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

  const handleRenameSubmit = (setId) => {
    renameFlashcardSet(setId, editingTitle);
  };

  const handleRenameKeyPress = (e, setId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(setId);
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  const nextCard = () => {
    if (currentCard < flashcards.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
  };

  const flipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleSessionToggle = (sessionId) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const selectAllSessions = () => {
    setSelectedSessions(chatSessions.map(session => session.id));
  };

  const clearAllSessions = () => {
    setSelectedSessions([]);
  };

  const handleLogout = () => {
    if (userProfile?.googleUser && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const goToChat = () => {
    navigate('/ai-chat');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="flashcards-page">
      <header className="flashcards-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="flashcards-title clickable-logo" onClick={goToDashboard}>
              brainwave flashcards
            </h1>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              {userProfile?.picture && (
                <img 
                  src={userProfile.picture} 
                  alt="Profile" 
                  className="profile-picture"
                />
              )}
            </div>
            <button className="back-btn" onClick={goToDashboard}>
              Dashboard
            </button>
            <button className="chat-btn" onClick={goToChat}>
              AI Chat
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="flashcards-container">
        {/* Sidebar Navigation */}
        <aside className="flashcards-sidebar">
          <nav className="sidebar-nav">
            <button 
              className={`sidebar-item ${activePanel === 'cards' ? 'active' : ''}`}
              onClick={() => setActivePanel('cards')}
            >
              <span className="sidebar-icon">▢</span>
              <span className="sidebar-label">My Cards</span>
            </button>
            <button 
              className={`sidebar-item ${activePanel === 'generator' ? 'active' : ''}`}
              onClick={() => setActivePanel('generator')}
            >
              <span className="sidebar-icon">▶</span>
              <span className="sidebar-label">Generator</span>
            </button>
            <button 
              className={`sidebar-item ${activePanel === 'statistics' ? 'active' : ''}`}
              onClick={() => setActivePanel('statistics')}
            >
              <span className="sidebar-icon">▤</span>
              <span className="sidebar-label">Statistics</span>
            </button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flashcards-main">
        {/* Generator Panel */}
        {activePanel === 'generator' && (
          <>
            <div className="generator-section">
              <h2 className="section-title">Generate Flashcards</h2>
              
              {/* Auto-save option */}
              <div className="generation-options">
                <label className="auto-save-option">
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                  />
                  Automatically save generated flashcards to my collection
                </label>
              </div>
              
              {/* Generation Mode Selector */}
              <div className="mode-selector">
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
              </div>

              {/* Topic Mode */}
              {generationMode === 'topic' && (
                <div className="input-section">
                  <input
                    type="text"
                    placeholder="Enter a topic (e.g., 'Physics - Newton's Laws', 'Chemistry - Periodic Table')"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !generating && generateFlashcards()}
                    className="topic-input"
                    disabled={generating}
                  />
                  <button
                    onClick={generateFlashcards}
                    disabled={generating || !topic.trim()}
                    className="generate-btn"
                  >
                    {generating ? "Generating..." : "Generate Flashcards"}
                  </button>
                </div>
              )}

              {/* Chat History Mode */}
              {generationMode === 'chat_history' && (
                <div className="chat-history-section">
                  <div className="chat-history-header">
                    <h3>Select Chat Sessions to Generate Flashcards From:</h3>
                    <div className="selection-controls">
                      <button 
                        onClick={selectAllSessions}
                        className="select-all-btn"
                        disabled={chatSessions.length === 0}
                      >
                        Select All
                      </button>
                      <button 
                        onClick={clearAllSessions}
                        className="clear-all-btn"
                        disabled={selectedSessions.length === 0}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
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
                            <div className="session-date">
                              {new Date(session.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="chat-generate-section">
                    <div className="selection-summary">
                      {selectedSessions.length > 0 && (
                        <p>{selectedSessions.length} session(s) selected</p>
                      )}
                    </div>
                    <button
                      onClick={generateFlashcards}
                      disabled={generating || selectedSessions.length === 0}
                      className="generate-btn"
                    >
                      {generating ? "Generating..." : `Generate Flashcards from ${selectedSessions.length} Session(s)`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tips Section */}
            <div className="tips-section">
              <h3>Study Tips</h3>
              <div className="tips-grid">
                <div className="tip-card">
                  <h4>Spaced Repetition</h4>
                  <p>Review flashcards at increasing intervals to reinforce long-term memory retention and optimize learning efficiency.</p>
                </div>
                <div className="tip-card">
                  <h4>Active Recall</h4>
                  <p>Test yourself by retrieving information from memory before checking the answer. This strengthens neural pathways and improves recall.</p>
                </div>
                <div className="tip-card">
                  <h4>Consistent Practice</h4>
                  <p>Study regularly in shorter sessions rather than cramming. Daily 15-20 minute sessions are more effective than occasional long sessions.</p>
                </div>
              </div>
            </div>

            {flashcards.length > 0 && (
              <div className="flashcards-section">
                <div className="flashcard-header">
                  <div className="flashcard-title-section">
                    {currentSetInfo && currentSetInfo.saved && editingSetId === currentSetInfo.setId ? (
                      <div className="rename-input-container">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyPress(e, currentSetInfo.setId)}
                          onBlur={() => handleRenameSubmit(currentSetInfo.setId)}
                          className="rename-input"
                          autoFocus
                        />
                        <div className="rename-controls">
                          <button 
                            onClick={() => handleRenameSubmit(currentSetInfo.setId)}
                            className="rename-save-btn"
                          >
                            ✓
                          </button>
                          <button 
                            onClick={cancelRenaming}
                            className="rename-cancel-btn"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flashcard-title-display">
                        <h3 className="flashcard-title">
                          {currentSetInfo?.setTitle || (generationMode === 'topic' 
                            ? `Flashcards for: ${topic}` 
                            : `Flashcards from Your Chat History (${selectedSessions.length} sessions)`
                          )}
                        </h3>
                        {currentSetInfo && currentSetInfo.saved && (
                          <button
                            onClick={() => startRenaming(currentSetInfo.setId, currentSetInfo.setTitle)}
                            className="rename-btn"
                            title="Rename flashcard set"
                          >
                            rename
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="card-counter">
                    {currentCard + 1} / {flashcards.length}
                  </div>
                </div>

                {/* Save status indicator */}
                {currentSetInfo && (
                  <div className={`save-status ${currentSetInfo.saved ? 'saved' : 'unsaved'}`}>
                    {currentSetInfo.saved ? (
                      <span> Saved as "{currentSetInfo.setTitle}" ({currentSetInfo.cardCount} cards)</span>
                    ) : (
                      <span>Not saved yet - Click "Save Set" to add to your collection</span>
                    )}
                  </div>
                )}

                <div className="flashcard-container">
                  <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
                    {/* Left navigation zone */}
                    <div 
                      className="nav-zone nav-zone-left" 
                      onClick={(e) => {
                        e.stopPropagation();
                        prevCard();
                      }}
                      style={{ display: currentCard === 0 ? 'none' : 'block' }}
                    >
                      <div className="nav-arrow nav-arrow-left">←</div>
                    </div>
                    
                    {/* Right navigation zone */}
                    <div 
                      className="nav-zone nav-zone-right" 
                      onClick={(e) => {
                        e.stopPropagation();
                        nextCard();
                      }}
                      style={{ display: currentCard === flashcards.length - 1 ? 'none' : 'block' }}
                    >
                      <div className="nav-arrow nav-arrow-right">→</div>
                    </div>
                    
                    {/* Main flashcard content */}
                    <div className="flashcard-content" onClick={flipCard}>
                      <div className="flashcard-front">
                        <div className="card-label">Question</div>
                        <div className="card-content">
                          {flashcards[currentCard]?.question}
                        </div>
                        <div className="flip-hint">Click to reveal answer</div>
                      </div>
                      <div className="flashcard-back">
                        <div className="card-label">Answer</div>
                        <div className="card-content">
                          {flashcards[currentCard]?.answer}
                        </div>
                        <div className="flip-hint">Click to see question</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flashcard-controls">
                  <button 
                    onClick={prevCard} 
                    disabled={currentCard === 0}
                    className="control-btn prev-btn"
                  >
                    ← Previous
                  </button>
                  
                  <button 
                    onClick={flipCard}
                    className="control-btn flip-btn"
                  >
                    {isFlipped ? 'Show Question' : 'Show Answer'}
                  </button>
                  
                  <button 
                    onClick={nextCard} 
                    disabled={currentCard === flashcards.length - 1}
                    className="control-btn next-btn"
                  >
                    Next →
                  </button>
                </div>

                <div className="flashcard-actions">
                  {/* Save button - only show if not saved yet */}
                  {currentSetInfo && !currentSetInfo.saved && (
                    <button 
                      onClick={saveCurrentFlashcards}
                      className="save-set-btn"
                    >
                      Save Set
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      setFlashcards([]);
                      setCurrentCard(0);
                      setIsFlipped(false);
                      setCurrentSetInfo(null);
                      if (generationMode === 'chat_history') {
                        setSelectedSessions([]);
                      } else {
                        setTopic('');
                      }
                    }}
                    className="new-set-btn"
                  >
                    Generate New Set
                  </button>
                  
                  <button 
                    onClick={() => {
                      const flashcardText = flashcards.map((card, index) => 
                        `${index + 1}. Q: ${card.question}\n   A: ${card.answer}\n`
                      ).join('\n');
                      navigator.clipboard.writeText(flashcardText);
                      showPopup('Copied!', 'All flashcards have been copied to your clipboard.');
                    }}
                    className="copy-btn"
                  >
                    Copy All
                  </button>
                </div>
              </div>
            )}


          </>
        )}

        {/* My Cards Panel */}
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



            {/* Flashcard Sets History */}
            <div className="history-content">
              {loadingHistory ? (
                <div className="loading-state">
                  <p>Loading your flashcard history...</p>
                </div>
              ) : flashcardHistory.length === 0 ? (
                <div className="empty-state">
                  <h3>No Flashcard Sets Yet</h3>
                  <p>Create your first flashcard set using the Generator tab!</p>
                  <button 
                    onClick={() => setActivePanel('generator')}
                    className="get-started-btn"
                  >
                    Get Started
                  </button>
                </div>
              ) : (
                <div className="history-grid">
                  {flashcardHistory.map((set) => (
                    <div key={set.id} className="history-card">
                      <div className="history-card-header">
                        <div className="set-title-container">
                          {editingSetId === set.id ? (
                            <div className="rename-input-container">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => handleRenameKeyPress(e, set.id)}
                                onBlur={() => handleRenameSubmit(set.id)}
                                className="rename-input"
                                autoFocus
                              />
                              <div className="rename-controls">
                                <button 
                                  onClick={() => handleRenameSubmit(set.id)}
                                  className="rename-save-btn"
                                >
                                  ✓
                                </button>
                                <button 
                                  onClick={cancelRenaming}
                                  className="rename-cancel-btn"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="set-title-display">
                              <div className="set-title">{set.title}</div>
                              <button
                                onClick={() => startRenaming(set.id, set.title)}
                                className="rename-btn-small"
                                title="Rename flashcard set"
                              >
                                ✎
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="set-date">{formatDate(set.created_at)}</div>
                      </div>
                      
                      <div className="set-description">
                        {set.description || 'No description available'}
                      </div>
                      
                      <div className="set-stats">
                        <div className="stat-item">
                          <span className="stat-value">{set.card_count}</span>
                          <span className="stat-text">cards</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-value">{set.accuracy_percentage}%</span>
                          <span className="stat-text">accuracy</span>
                        </div>
                        {set.avg_study_time_minutes > 0 && (
                          <div className="stat-item">
                            <span className="stat-value">{formatDuration(set.avg_study_time_minutes)}</span>
                            <span className="stat-text">avg time</span>
                          </div>
                        )}
                      </div>

                      {set.last_studied && (
                        <div className="last-studied">
                          Last studied: {formatDate(set.last_studied)}
                        </div>
                      )}

                      <div className="set-actions">
                        <button 
                          onClick={() => loadFlashcardSet(set.id)}
                          className="study-btn"
                        >
                          Study Set
                        </button>
                        <button 
                          onClick={() => deleteFlashcardSet(set.id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>

                      {set.source_type && (
                        <div className="source-badge">
                          {set.source_type === 'topic' ? 'Topic' : 
                           set.source_type === 'chat_history' ? 'Chat' : 
                           set.source_type === 'notes' ? 'Notes' : 'Manual'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistics Panel */}
        {activePanel === 'statistics' && (
          <div className="statistics-section">
            <h2 className="section-title">Statistics & Analytics</h2>
            
            {flashcardStats ? (
              <>
                {/* Main Stats Grid */}
                <div className="stats-main-grid">
                  <div className="stat-card-large">
                    <div className="stat-value">{flashcardStats.total_sets}</div>
                    <div className="stat-label">Total Sets Created</div>
                  </div>
                  <div className="stat-card-large">
                    <div className="stat-value">{flashcardStats.total_cards}</div>
                    <div className="stat-label">Total Cards</div>
                  </div>
                  <div className="stat-card-large">
                    <div className="stat-value">{flashcardStats.total_study_time_minutes ? formatDuration(flashcardStats.total_study_time_minutes) : '0 min'}</div>
                    <div className="stat-label">Time Spent</div>
                  </div>
                  <div className="stat-card-large">
                    <div className="stat-value">{flashcardStats.overall_accuracy}%</div>
                    <div className="stat-label">Accuracy</div>
                  </div>
                  <div className="stat-card-large">
                    <div className="stat-value">{flashcardStats.total_study_sessions}</div>
                    <div className="stat-label">Study Sessions</div>
                  </div>
                </div>

                {/* Detailed Stats */}
                <div className="stats-details">
                  <h3 className="stats-subtitle">Performance Insights</h3>
                  <div className="stats-info-grid">
                    <div className="info-item">
                      <span className="info-label">Average Cards per Set:</span>
                      <span className="info-value">{flashcardStats.total_sets > 0 ? Math.round(flashcardStats.total_cards / flashcardStats.total_sets) : 0}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Average Time per Session:</span>
                      <span className="info-value">{flashcardStats.total_study_sessions > 0 ? formatDuration(Math.round(flashcardStats.total_study_time_minutes / flashcardStats.total_study_sessions)) : '0min'}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No statistics yet. Create and study some flashcards to see your analytics!</p>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* Custom Popup */}
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