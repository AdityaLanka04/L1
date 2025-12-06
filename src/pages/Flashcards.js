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
  const [studyMode, setStudyMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [studySessionStats, setStudySessionStats] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [showStudyResults, setShowStudyResults] = useState(false);
  const [shuffledCards, setShuffledCards] = useState([]);
  const [studySettings, setStudySettings] = useState({ shuffle: false, showProgress: true });
  const [currentStreak, setCurrentStreak] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedSetForStudy, setSelectedSetForStudy] = useState(null);
  const navigate = useNavigate();
  
  const [cardCount, setCardCount] = useState(10);
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [depthLevel, setDepthLevel] = useState('standard');
  const [focusAreas, setFocusAreas] = useState([]);
  const [focusInput, setFocusInput] = useState('');

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getDisplayName = () => {
    if (userProfile?.name) return userProfile.name.split(' ')[0];
    if (userName) return userName.charAt(0).toUpperCase() + userName.slice(1);
    return 'Student';
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
      const response = await fetch(`${API_URL}/get_flashcard_history?user_id=${userName}&limit=50`, {
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

  useEffect(() => {
    const savedStreak = localStorage.getItem('flashcardStreak');
    const lastStudyDate = localStorage.getItem('lastFlashcardStudy');
    const today = new Date().toDateString();
    
    if (savedStreak && lastStudyDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastStudyDate === today || lastStudyDate === yesterday.toDateString()) {
        setCurrentStreak(parseInt(savedStreak) || 0);
      } else {
        setCurrentStreak(0);
        localStorage.setItem('flashcardStreak', '0');
      }
    }
  }, []);

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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate flashcards: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.flashcards || data.flashcards.length === 0) {
        showPopup('No Cards Generated', 'Unable to generate flashcards. Try reducing the number of cards or providing more detailed content.');
        setGenerating(false);
        return;
      }
      
      if (data.flashcards.length < cardCount) {
        showPopup('Partial Generation', `Generated ${data.flashcards.length} cards instead of ${cardCount}. Not enough content available.`);
      }
      
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

  const loadFlashcardSet = async (setId, startStudy = false) => {
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
        if (startStudy) {
          setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
          setShowStudyResults(false);
          if (studySettings.shuffle) {
            const shuffled = [...data.flashcards].sort(() => Math.random() - 0.5);
            setShuffledCards(shuffled);
          } else {
            setShuffledCards(data.flashcards);
          }
          setStudyMode(true);
          updateStreak();
        } else {
          setActivePanel('generator');
          showPopup('Set Loaded', `Loaded "${data.set_title}" with ${data.flashcards.length} cards`);
        }
      }
    } catch (error) {
      console.error('Error loading flashcard set:', error);
      showPopup('Error', 'Failed to load flashcard set');
    }
  };

  const updateStreak = () => {
    const today = new Date().toDateString();
    const lastStudy = localStorage.getItem('lastFlashcardStudy');
    
    if (lastStudy !== today) {
      const newStreak = currentStreak + 1;
      setCurrentStreak(newStreak);
      localStorage.setItem('flashcardStreak', newStreak.toString());
      localStorage.setItem('lastFlashcardStudy', today);
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

  const handleStudyResponse = (response) => {
    setStudySessionStats(prev => ({
      ...prev,
      [response]: prev[response] + 1
    }));
    
    if (currentCard < (studySettings.shuffle ? shuffledCards : flashcards).length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    } else {
      setShowStudyResults(true);
    }
  };

  const exitStudyMode = () => {
    setStudyMode(false);
    setShowStudyResults(false);
    setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
    setCurrentCard(0);
    setIsFlipped(false);
  };

  const restartStudy = () => {
    setCurrentCard(0);
    setIsFlipped(false);
    setShowStudyResults(false);
    setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
    if (studySettings.shuffle) {
      const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
      setShuffledCards(shuffled);
    }
  };

  const getFilteredAndSortedSets = () => {
    let filtered = flashcardHistory;
    
    if (searchQuery) {
      filtered = filtered.filter(set => 
        set.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    switch (sortBy) {
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'cards':
        filtered = [...filtered].sort((a, b) => b.card_count - a.card_count);
        break;
      case 'accuracy':
        filtered = [...filtered].sort((a, b) => b.accuracy_percentage - a.accuracy_percentage);
        break;
      case 'recent':
      default:
        break;
    }
    
    return filtered;
  };

  const getMasteryLevel = (accuracy) => {
    if (accuracy >= 90) return { level: 'Master', color: '#10B981', icon: '🏆' };
    if (accuracy >= 70) return { level: 'Proficient', color: '#3B82F6', icon: '⭐' };
    if (accuracy >= 50) return { level: 'Learning', color: '#F59E0B', icon: '📚' };
    return { level: 'Beginner', color: '#EF4444', icon: '🌱' };
  };

  const currentStudyCards = studySettings.shuffle ? shuffledCards : flashcards;

  return (
    <div className={`flashcards-page ${studyMode ? 'study-mode-active' : ''}`}>
      {studyMode && flashcards.length > 0 ? (
        <div className="study-mode-container">
          {showStudyResults ? (
            <div className="study-results-screen">
              <div className="results-card">
                <div className="results-header">
                  <div className="results-icon">🎉</div>
                  <h2>Session Complete!</h2>
                  <p className="results-subtitle">{currentSetInfo?.setTitle || 'Study Session'}</p>
                </div>
                
                <div className="results-stats">
                  <div className="result-stat correct">
                    <div className="stat-icon">✓</div>
                    <div className="stat-number">{studySessionStats.correct}</div>
                    <div className="stat-label">Correct</div>
                  </div>
                  <div className="result-stat incorrect">
                    <div className="stat-icon">✗</div>
                    <div className="stat-number">{studySessionStats.incorrect}</div>
                    <div className="stat-label">Needs Review</div>
                  </div>
                  <div className="result-stat skipped">
                    <div className="stat-icon">→</div>
                    <div className="stat-number">{studySessionStats.skipped}</div>
                    <div className="stat-label">Skipped</div>
                  </div>
                </div>

                <div className="results-accuracy">
                  <div className="accuracy-circle">
                    <svg viewBox="0 0 100 100">
                      <circle className="accuracy-bg" cx="50" cy="50" r="45" />
                      <circle 
                        className="accuracy-fill" 
                        cx="50" cy="50" r="45"
                        style={{
                          strokeDasharray: `${(studySessionStats.correct / (studySessionStats.correct + studySessionStats.incorrect + studySessionStats.skipped || 1)) * 283} 283`
                        }}
                      />
                    </svg>
                    <div className="accuracy-text">
                      <span className="accuracy-number">
                        {Math.round((studySessionStats.correct / (studySessionStats.correct + studySessionStats.incorrect + studySessionStats.skipped || 1)) * 100)}%
                      </span>
                      <span className="accuracy-label">Accuracy</span>
                    </div>
                  </div>
                </div>

                <div className="results-actions">
                  <button className="results-btn restart" onClick={restartStudy}>
                    <span className="btn-icon">↺</span>
                    Study Again
                  </button>
                  <button className="results-btn exit" onClick={exitStudyMode}>
                    <span className="btn-icon">←</span>
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="study-header">
                <button className="exit-study-btn" onClick={exitStudyMode}>
                  <span className="exit-icon">←</span>
                  Exit
                </button>
                <div className="study-title-area">
                  <h2 className="study-set-title">{currentSetInfo?.setTitle || 'Study Session'}</h2>
                  <div className="study-progress-info">
                    Card {currentCard + 1} of {currentStudyCards.length}
                  </div>
                </div>
                <div className="study-settings-quick">
                  <button 
                    className={`shuffle-toggle ${studySettings.shuffle ? 'active' : ''}`}
                    onClick={() => setStudySettings(prev => ({ ...prev, shuffle: !prev.shuffle }))}
                    title="Shuffle Cards"
                  >
                    🔀
                  </button>
                </div>
              </div>

              <div className="study-progress-bar">
                <div 
                  className="study-progress-fill" 
                  style={{ width: `${((currentCard + 1) / currentStudyCards.length) * 100}%` }}
                />
              </div>

              <div className="study-card-area">
                <button 
                  className="study-nav-arrow prev"
                  onClick={handlePrevious}
                  disabled={currentCard === 0}
                >
                  ‹
                </button>

                <div className="study-flashcard-wrapper">
                  <div 
                    className={`study-flashcard ${isFlipped ? 'flipped' : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div className="study-flashcard-inner">
                      <div className="study-flashcard-front">
                        <div className="card-type-badge">Question</div>
                        <div className="study-card-content">
                          {currentStudyCards[currentCard]?.question}
                        </div>
                        <div className="tap-hint">
                          <span className="tap-icon">👆</span>
                          Tap to reveal answer
                        </div>
                      </div>
                      <div className="study-flashcard-back">
                        <div className="card-type-badge answer">Answer</div>
                        <div className="study-card-content">
                          {currentStudyCards[currentCard]?.answer}
                        </div>
                        <div className="tap-hint">
                          <span className="tap-icon">👆</span>
                          Tap to see question
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  className="study-nav-arrow next"
                  onClick={handleNext}
                  disabled={currentCard === currentStudyCards.length - 1}
                >
                  ›
                </button>
              </div>

              <div className="study-response-buttons">
                <button 
                  className="response-btn incorrect"
                  onClick={() => handleStudyResponse('incorrect')}
                >
                  <span className="response-icon">✗</span>
                  <span className="response-text">Needs Review</span>
                </button>
                <button 
                  className="response-btn skip"
                  onClick={() => handleStudyResponse('skipped')}
                >
                  <span className="response-icon">→</span>
                  <span className="response-text">Skip</span>
                </button>
                <button 
                  className="response-btn correct"
                  onClick={() => handleStudyResponse('correct')}
                >
                  <span className="response-icon">✓</span>
                  <span className="response-text">Got It!</span>
                </button>
              </div>

              <div className="keyboard-shortcuts-hint">
                <span>Keyboard: <kbd>Space</kbd> flip • <kbd>←</kbd><kbd>→</kbd> navigate • <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> rate</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="dashboard-layout">
          <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-header">
              <div className="logo-area" onClick={() => navigate('/dashboard')}>
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {!sidebarCollapsed && <span className="logo-text">cerbyl</span>}
              </div>
              <button 
                className="collapse-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? '›' : '‹'}
              </button>
            </div>

            <div className="sidebar-user">
              <div className="user-avatar">
                {userProfile?.profilePicture ? (
                  <img src={userProfile.profilePicture} alt="Profile" />
                ) : (
                  <span className="avatar-initial">{getDisplayName().charAt(0)}</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <div className="user-info">
                  <span className="user-greeting">{getGreeting()},</span>
                  <span className="user-name">{getDisplayName()}!</span>
                </div>
              )}
            </div>

            <div className="sidebar-stats">
              <div className="quick-stat">
                <div className="stat-icon-small">🔥</div>
                {!sidebarCollapsed && (
                  <div className="stat-details">
                    <span className="stat-value-small">{currentStreak}</span>
                    <span className="stat-label-small">Day Streak</span>
                  </div>
                )}
              </div>
              <div className="quick-stat">
                <div className="stat-icon-small">📚</div>
                {!sidebarCollapsed && (
                  <div className="stat-details">
                    <span className="stat-value-small">{flashcardStats?.total_sets || 0}</span>
                    <span className="stat-label-small">Total Sets</span>
                  </div>
                )}
              </div>
              <div className="quick-stat">
                <div className="stat-icon-small">🎯</div>
                {!sidebarCollapsed && (
                  <div className="stat-details">
                    <span className="stat-value-small">{flashcardStats?.total_cards || 0}</span>
                    <span className="stat-label-small">Total Cards</span>
                  </div>
                )}
              </div>
            </div>

            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activePanel === 'cards' ? 'active' : ''}`}
                onClick={() => setActivePanel('cards')}
              >
                <span className="nav-icon">📖</span>
                {!sidebarCollapsed && <span className="nav-text">My Flashcards</span>}
              </button>
              <button 
                className={`nav-item ${activePanel === 'generator' ? 'active' : ''}`}
                onClick={() => setActivePanel('generator')}
              >
                <span className="nav-icon">✨</span>
                {!sidebarCollapsed && <span className="nav-text">Generator</span>}
              </button>
              <button 
                className={`nav-item ${activePanel === 'statistics' ? 'active' : ''}`}
                onClick={() => setActivePanel('statistics')}
              >
                <span className="nav-icon">📊</span>
                {!sidebarCollapsed && <span className="nav-text">Statistics</span>}
              </button>
            </nav>

            <div className="sidebar-footer">
              <button className="nav-item" onClick={() => navigate('/dashboard')}>
                <span className="nav-icon">🏠</span>
                {!sidebarCollapsed && <span className="nav-text">Dashboard</span>}
              </button>
              <button className="nav-item" onClick={() => navigate('/chat')}>
                <span className="nav-icon">💬</span>
                {!sidebarCollapsed && <span className="nav-text">AI Chat</span>}
              </button>
              <button className="nav-item logout" onClick={() => {
                localStorage.clear();
                navigate('/login');
              }}>
                <span className="nav-icon">🚪</span>
                {!sidebarCollapsed && <span className="nav-text">Logout</span>}
              </button>
            </div>
          </aside>

          <main className="main-content">
            {activePanel === 'cards' && (
              <div className="my-cards-panel">
                <div className="panel-header">
                  <div className="header-left">
                    <h1 className="panel-title">My Flashcards</h1>
                    <p className="panel-subtitle">
                      {flashcardHistory.length} {flashcardHistory.length === 1 ? 'set' : 'sets'} • {flashcardStats?.total_cards || 0} cards total
                    </p>
                  </div>
                  <div className="header-actions">
                    <div className="search-box">
                      <span className="search-icon">🔍</span>
                      <input 
                        type="text"
                        placeholder="Search sets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <select 
                      className="sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="recent">Most Recent</option>
                      <option value="alphabetical">A-Z</option>
                      <option value="cards">Most Cards</option>
                      <option value="accuracy">Highest Accuracy</option>
                    </select>
                    <button 
                      className="refresh-btn"
                      onClick={() => {
                        loadFlashcardHistory();
                        loadFlashcardStats();
                      }}
                      disabled={loadingHistory}
                    >
                      {loadingHistory ? '↻' : '↻'} Refresh
                    </button>
                    <button 
                      className="create-new-btn"
                      onClick={() => setActivePanel('generator')}
                    >
                      + Create New
                    </button>
                  </div>
                </div>

                <div className="cards-content">
                  {loadingHistory ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <p>Loading your flashcards...</p>
                    </div>
                  ) : flashcardHistory.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📚</div>
                      <h3>No Flashcard Sets Yet</h3>
                      <p>Create your first set to start learning!</p>
                      <button 
                        className="get-started-btn"
                        onClick={() => setActivePanel('generator')}
                      >
                        <span>✨</span> Create Your First Set
                      </button>
                    </div>
                  ) : (
                    <div className="flashcard-sets-grid">
                      {getFilteredAndSortedSets().map((set) => {
                        const mastery = getMasteryLevel(set.accuracy_percentage || 0);
                        return (
                          <div key={set.id} className="flashcard-set-card">
                            <div className="set-card-header">
                              <div className="set-icon" style={{ background: `linear-gradient(135deg, ${mastery.color}22, ${mastery.color}44)` }}>
                                {mastery.icon}
                              </div>
                              <div className="set-menu">
                                <button className="menu-btn" onClick={(e) => {
                                  e.stopPropagation();
                                  startRenaming(set.id, set.title);
                                }}>✏️</button>
                                <button className="menu-btn delete" onClick={(e) => {
                                  e.stopPropagation();
                                  deleteFlashcardSet(set.id);
                                }}>🗑️</button>
                              </div>
                            </div>
                            
                            <div className="set-card-body">
                              {editingSetId === set.id ? (
                                <input
                                  type="text"
                                  className="rename-input"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => handleRenameKeyPress(e, set.id)}
                                  onBlur={() => handleRenameSubmit(set.id)}
                                  autoFocus
                                />
                              ) : (
                                <h3 className="set-title">{set.title}</h3>
                              )}
                              <div className="set-meta">
                                <span className="meta-item">
                                  <span className="meta-icon">📄</span>
                                  {set.card_count} cards
                                </span>
                                <span className="meta-item">
                                  <span className="meta-icon">📅</span>
                                  {formatDate(set.created_at)}
                                </span>
                              </div>
                            </div>

                            <div className="set-card-stats">
                              <div className="progress-bar-container">
                                <div 
                                  className="progress-bar-fill"
                                  style={{ 
                                    width: `${set.accuracy_percentage || 0}%`,
                                    background: mastery.color 
                                  }}
                                />
                              </div>
                              <div className="stats-row">
                                <span className="mastery-badge" style={{ color: mastery.color }}>
                                  {mastery.level}
                                </span>
                                <span className="accuracy-text">{set.accuracy_percentage || 0}% mastery</span>
                              </div>
                            </div>

                            <div className="set-card-actions">
                              <button 
                                className="action-btn preview"
                                onClick={() => loadFlashcardSet(set.id, false)}
                              >
                                Preview
                              </button>
                              <button 
                                className="action-btn study"
                                onClick={() => loadFlashcardSet(set.id, true)}
                              >
                                <span>▶</span> Study
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePanel === 'generator' && (
              <div className="generator-panel">
                <div className="panel-header">
                  <div className="header-left">
                    <h1 className="panel-title">Generate Flashcards</h1>
                    <p className="panel-subtitle">Create AI-powered flashcards from topics or your chat history</p>
                  </div>
                </div>

                <div className="generator-content">
                  <div className="generation-mode-selector">
                    <button 
                      className={`mode-option ${generationMode === 'topic' ? 'active' : ''}`}
                      onClick={() => setGenerationMode('topic')}
                    >
                      <span className="mode-icon">📝</span>
                      <span className="mode-label">By Topic</span>
                      <span className="mode-desc">Enter any topic to generate cards</span>
                    </button>
                    <button 
                      className={`mode-option ${generationMode === 'chat_history' ? 'active' : ''}`}
                      onClick={() => setGenerationMode('chat_history')}
                    >
                      <span className="mode-icon">💬</span>
                      <span className="mode-label">From Chat History</span>
                      <span className="mode-desc">Convert your AI conversations to cards</span>
                    </button>
                  </div>

                  {generationMode === 'topic' ? (
                    <div className="topic-generator-form">
                      <div className="form-section main-input">
                        <label className="form-label">What would you like to learn?</label>
                        <input
                          type="text"
                          className="topic-input-large"
                          placeholder="e.g., Quantum Physics, Spanish Vocabulary, Machine Learning Basics..."
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !generating && generateFlashcards()}
                          disabled={generating}
                        />
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">
                            <span className="label-icon">🔢</span>
                            Number of Cards
                          </label>
                          <div className="number-input-wrapper">
                            <button 
                              className="number-btn"
                              onClick={() => setCardCount(Math.max(1, cardCount - 1))}
                            >−</button>
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={cardCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 15) {
                                  setCardCount(15);
                                  showPopup('Limit Reached', 'Maximum 15 cards allowed per set.');
                                } else if (val < 1) {
                                  setCardCount(1);
                                } else {
                                  setCardCount(val || 1);
                                }
                              }}
                              className="number-input"
                            />
                            <button 
                              className="number-btn"
                              onClick={() => setCardCount(Math.min(15, cardCount + 1))}
                            >+</button>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span className="label-icon">📊</span>
                            Difficulty Level
                          </label>
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
                          <label className="form-label">
                            <span className="label-icon">📏</span>
                            Answer Depth
                          </label>
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

                      <div className="form-section">
                        <label className="form-label">
                          <span className="label-icon">🎯</span>
                          Focus Areas (Optional)
                        </label>
                        <div className="focus-input-group">
                          <input
                            type="text"
                            value={focusInput}
                            onChange={(e) => setFocusInput(e.target.value)}
                            onKeyPress={handleFocusKeyPress}
                            placeholder="Add specific subtopics to focus on..."
                            className="focus-input"
                          />
                          <button type="button" onClick={addFocusArea} className="add-focus-btn">
                            Add
                          </button>
                        </div>
                        {focusAreas.length > 0 && (
                          <div className="focus-tags">
                            {focusAreas.map((area, index) => (
                              <span key={index} className="focus-tag">
                                {area}
                                <button onClick={() => removeFocusArea(index)}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="form-options">
                        <label className="checkbox-option">
                          <input
                            type="checkbox"
                            checked={autoSave}
                            onChange={(e) => setAutoSave(e.target.checked)}
                          />
                          <span className="checkbox-custom"></span>
                          <span className="checkbox-label">Auto-save to my library</span>
                        </label>
                      </div>

                      <button
                        onClick={generateFlashcards}
                        disabled={generating || !topic.trim()}
                        className="generate-btn-large"
                      >
                        {generating ? (
                          <>
                            <span className="loading-dots">
                              <span></span><span></span><span></span>
                            </span>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span className="btn-icon">✨</span>
                            Generate {cardCount} Flashcards
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="chat-history-generator">
                      <div className="chat-sessions-header">
                        <h3>Select Chat Sessions</h3>
                        <div className="session-actions">
                          <button 
                            onClick={selectAllSessions} 
                            className="select-btn"
                            disabled={chatSessions.length === 0}
                          >
                            Select All
                          </button>
                          <button 
                            onClick={clearAllSessions} 
                            className="select-btn"
                            disabled={selectedSessions.length === 0}
                          >
                            Clear All
                          </button>
                        </div>
                      </div>

                      <div className="form-grid compact">
                        <div className="form-group">
                          <label className="form-label">Number of Cards</label>
                          <div className="number-input-wrapper">
                            <button 
                              className="number-btn"
                              onClick={() => setCardCount(Math.max(1, cardCount - 1))}
                            >−</button>
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={cardCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (val > 15) setCardCount(15);
                                else if (val < 1) setCardCount(1);
                                else setCardCount(val || 1);
                              }}
                              className="number-input"
                            />
                            <button 
                              className="number-btn"
                              onClick={() => setCardCount(Math.min(15, cardCount + 1))}
                            >+</button>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Difficulty</label>
                          <select value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)} className="form-select">
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Depth</label>
                          <select value={depthLevel} onChange={(e) => setDepthLevel(e.target.value)} className="form-select">
                            <option value="surface">Surface</option>
                            <option value="standard">Standard</option>
                            <option value="deep">Deep</option>
                            <option value="comprehensive">Comprehensive</option>
                          </select>
                        </div>
                      </div>

                      {chatSessions.length === 0 ? (
                        <div className="no-sessions-state">
                          <div className="empty-icon">💬</div>
                          <h4>No Chat Sessions Found</h4>
                          <p>Start a conversation with the AI to generate flashcards from your discussions.</p>
                          <button onClick={goToChat} className="go-to-chat-btn">
                            Go to AI Chat
                          </button>
                        </div>
                      ) : (
                        <div className="chat-sessions-list">
                          {chatSessions.map((session) => (
                            <div
                              key={session.id}
                              className={`chat-session-item ${selectedSessions.includes(session.id) ? 'selected' : ''}`}
                              onClick={() => handleSessionToggle(session.id)}
                            >
                              <div className="session-checkbox">
                                <input 
                                  type="checkbox" 
                                  checked={selectedSessions.includes(session.id)}
                                  onChange={() => handleSessionToggle(session.id)}
                                />
                              </div>
                              <div className="session-content">
                                <span className="session-title">{session.title}</span>
                                <span className="session-date">{new Date(session.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={generateFlashcards}
                        disabled={generating || selectedSessions.length === 0}
                        className="generate-btn-large"
                      >
                        {generating ? (
                          <>
                            <span className="loading-dots"><span></span><span></span><span></span></span>
                            Generating...
                          </>
                        ) : (
                          <>
                            <span className="btn-icon">✨</span>
                            Generate from {selectedSessions.length} Session{selectedSessions.length !== 1 ? 's' : ''}
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {flashcards.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-header">
                        <h3>
                          <span className="preview-icon">👁️</span>
                          Preview: {currentSetInfo?.setTitle || 'Generated Cards'}
                        </h3>
                        <span className="card-counter">{currentCard + 1} / {flashcards.length}</span>
                      </div>

                      <div className="preview-card-container">
                        <button 
                          className="preview-nav prev"
                          onClick={handlePrevious}
                          disabled={currentCard === 0}
                        >‹</button>
                        
                        <div 
                          className={`preview-card ${isFlipped ? 'flipped' : ''}`}
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <div className="preview-card-inner">
                            <div className="preview-card-front">
                              <div className="card-label">Question</div>
                              <div className="card-text">{flashcards[currentCard]?.question}</div>
                              <div className="flip-hint">Click to flip</div>
                            </div>
                            <div className="preview-card-back">
                              <div className="card-label">Answer</div>
                              <div className="card-text">{flashcards[currentCard]?.answer}</div>
                              <div className="flip-hint">Click to flip back</div>
                            </div>
                          </div>
                        </div>

                        <button 
                          className="preview-nav next"
                          onClick={handleNext}
                          disabled={currentCard === flashcards.length - 1}
                        >›</button>
                      </div>

                      <div className="preview-actions">
                        <button 
                          className="preview-action-btn study"
                          onClick={() => {
                            setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
                            setShowStudyResults(false);
                            setShuffledCards(studySettings.shuffle ? [...flashcards].sort(() => Math.random() - 0.5) : flashcards);
                            setStudyMode(true);
                            updateStreak();
                          }}
                        >
                          <span>▶</span> Start Studying
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePanel === 'statistics' && (
              <div className="statistics-panel">
                <div className="panel-header">
                  <div className="header-left">
                    <h1 className="panel-title">Statistics & Analytics</h1>
                    <p className="panel-subtitle">Track your learning progress and performance</p>
                  </div>
                </div>

                {flashcardStats ? (
                  <div className="statistics-content">
                    <div className="stats-overview">
                      <div className="stat-card primary">
                        <div className="stat-icon-large">📚</div>
                        <div className="stat-info">
                          <span className="stat-value-large">{flashcardStats.total_sets}</span>
                          <span className="stat-label-large">Total Sets</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon-large">🎴</div>
                        <div className="stat-info">
                          <span className="stat-value-large">{flashcardStats.total_cards}</span>
                          <span className="stat-label-large">Total Cards</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon-large">🎯</div>
                        <div className="stat-info">
                          <span className="stat-value-large">{flashcardStats.overall_accuracy}%</span>
                          <span className="stat-label-large">Overall Accuracy</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-icon-large">🔥</div>
                        <div className="stat-info">
                          <span className="stat-value-large">{currentStreak}</span>
                          <span className="stat-label-large">Day Streak</span>
                        </div>
                      </div>
                    </div>

                    <div className="stats-details-section">
                      <div className="detail-card">
                        <h3 className="detail-title">Performance Overview</h3>
                        <div className="performance-chart">
                          <div className="chart-bar-container">
                            <div className="chart-bar">
                              <div 
                                className="chart-fill correct"
                                style={{ height: `${flashcardStats.overall_accuracy || 0}%` }}
                              />
                            </div>
                            <span className="chart-label">Accuracy</span>
                          </div>
                        </div>
                        <div className="mastery-breakdown">
                          {(() => {
                            const mastery = getMasteryLevel(flashcardStats.overall_accuracy || 0);
                            return (
                              <div className="current-mastery">
                                <span className="mastery-icon">{mastery.icon}</span>
                                <span className="mastery-level" style={{ color: mastery.color }}>{mastery.level}</span>
                                <span className="mastery-desc">Current Level</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="detail-card">
                        <h3 className="detail-title">Study Tips</h3>
                        <div className="tips-list">
                          <div className="tip-item">
                            <span className="tip-icon">💡</span>
                            <span>Review cards you marked as "Needs Review" more frequently</span>
                          </div>
                          <div className="tip-item">
                            <span className="tip-icon">⏰</span>
                            <span>Study in short sessions (15-20 min) for better retention</span>
                          </div>
                          <div className="tip-item">
                            <span className="tip-icon">🔄</span>
                            <span>Use shuffle mode to prevent memorizing card order</span>
                          </div>
                          <div className="tip-item">
                            <span className="tip-icon">📅</span>
                            <span>Maintain your streak for consistent learning</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Statistics Yet</h3>
                    <p>Start studying flashcards to see your analytics here!</p>
                    <button 
                      className="get-started-btn"
                      onClick={() => setActivePanel('cards')}
                    >
                      View My Flashcards
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      )}

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