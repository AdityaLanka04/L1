import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CustomPopup from './CustomPopup';
import './Flashcards.css';
import './FlashcardsConvert.css';
import { API_URL } from '../config';
import gamificationService from '../services/gamificationService';
import ImportExportModal from '../components/ImportExportModal';

const Flashcards = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [activePanel, setActivePanel] = useState('cards');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Flashcard data
  const [flashcards, setFlashcards] = useState([]);
  const [flashcardHistory, setFlashcardHistory] = useState([]);
  const [flashcardStats, setFlashcardStats] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentSetInfo, setCurrentSetInfo] = useState(null);
  
  // Card navigation
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mcqOptions, setMcqOptions] = useState([]);
  
  // Generation
  const [generating, setGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState('topic');
  const [topic, setTopic] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [depthLevel, setDepthLevel] = useState('standard');
  const [autoSave, setAutoSave] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  
  // Chat sessions
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  
  // Study mode
  const [studyMode, setStudyMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [studySessionStats, setStudySessionStats] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [showStudyResults, setShowStudyResults] = useState(false);
  const [shuffledCards, setShuffledCards] = useState([]);
  const [studySettings, setStudySettings] = useState({ shuffle: false });
  const [currentStreak, setCurrentStreak] = useState(0);
  
  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [editingSetId, setEditingSetId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);
  
  // Needs Review state
  const [reviewCards, setReviewCards] = useState({ total_cards: 0, sets: [] });
  const [loadingReviewCards, setLoadingReviewCards] = useState(false);
  
  // Flashcard Agent Integration States
  const [agentSessionActive, setAgentSessionActive] = useState(false);
  const [agentSessionId, setAgentSessionId] = useState(null);
  const [cardMetrics, setCardMetrics] = useState({});
  const [weaknessAnalysis, setWeaknessAnalysis] = useState([]);
  const [studyRecommendations, setStudyRecommendations] = useState([]);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [showAgentInsights, setShowAgentInsights] = useState(false);
  
  const [popup, setPopup] = useState({ isOpen: false, message: '', title: '' });

  const showPopup = (title, message) => setPopup({ isOpen: true, title, message });
  const closePopup = () => setPopup({ isOpen: false, message: '', title: '' });

  // Icons
  const Icons = {
    fire: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 1.5-4.5 2-7 1.5 1.5 2.5 2 4 0z"/></svg>,
    book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    cards: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>,
    sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/></svg>,
    chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
    bolt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
    edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    file: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    play: <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    shuffle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    arrowRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    arrowLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
    refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    celebration: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/></svg>,
  };

  // Data loading functions
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
        setFlashcardHistory(Array.isArray(data.flashcard_history) ? data.flashcard_history : []);
      } else {
        setFlashcardHistory([]);
      }
    } catch (error) {
            setFlashcardHistory([]);
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
          }
  }, [userName]);

  const loadReviewCards = useCallback(async () => {
    if (!userName) return;
    setLoadingReviewCards(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_flashcards_for_review?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Ensure data has the expected structure
        setReviewCards({
          total_cards: data.total_cards || 0,
          sets: Array.isArray(data.sets) ? data.sets : []
        });
      }
    } catch (error) {
            setReviewCards({ total_cards: 0, sets: [] });
    }
    setLoadingReviewCards(false);
  }, [userName]);

  const markCardForReview = async (flashcardId, marked = true) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('flashcard_id', flashcardId);
      formData.append('marked', marked.toString());
      
      const response = await fetch(`${API_URL}/mark_flashcard_for_review`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (response.ok) {
        // Refresh review cards list
        loadReviewCards();
        return true;
      }
      return false;
    } catch (error) {
            return false;
    }
  };

  // Flashcard Agent Integration Functions
  const startAgentSession = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Use the new agent API endpoint
      const response = await fetch(`${API_URL}/agents/flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          action: 'recommend',
          session_id: `review_${Date.now()}`
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAgentSessionActive(true);
        setAgentSessionId(`session_${Date.now()}`);
        setSessionStartTime(Date.now());
                
        // Store recommendations
        if (result.recommendations) {
          setStudyRecommendations(result.recommendations);
        }
        
        return result;
      }
    } catch (error) {
          }
  };

  const reviewCardWithAgent = async (cardId, quality, responseTime) => {
    try {
      const token = localStorage.getItem('token');
      
      // Use the new agent review endpoint
      const response = await fetch(`${API_URL}/agents/flashcards/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          review_results: [{
            card_id: cardId,
            quality: quality === 5 ? 'easy' : quality === 1 ? 'again' : 'good',
            correct: quality >= 3,
            response_time_ms: responseTime * 1000
          }]
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const data = result.data || result;
        
        // Update card metrics
        setCardMetrics(prev => ({
          ...prev,
          [cardId]: {
            retention: data.session_stats?.accuracy || 0,
            confidence: quality / 5,
            streak: data.session_stats?.correct || 0
          }
        }));
        
        return data;
      }
    } catch (error) {
          }
  };

  // Simple mastery update function
  const updateCardMastery = async (cardId, wasCorrect) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/flashcards/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          card_id: cardId.toString(),
          was_correct: wasCorrect
        })
      });
      
      const result = await response.json();
      if (result.success) {
              }
      return result;
    } catch (error) {
          }
  };

  const endAgentSession = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Get analysis from the agent
      const response = await fetch(`${API_URL}/agents/flashcards/analyze?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAgentSessionActive(false);
        setShowAgentInsights(true);
        
        const sessionDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 60000) : 0;
        
        // Show session summary
        showPopup('Session Complete!', 
          `Duration: ${sessionDuration} min\n` +
          `${result.response || 'Great study session!'}`
        );
        
        return result;
      }
    } catch (error) {
            setAgentSessionActive(false);
    }
  };

  const getFlashcardReport = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Use the new agent analyze endpoint
      const response = await fetch(`${API_URL}/agents/flashcards/analyze?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.analysis || result;
      }
    } catch (error) {
          }
  };

  // Get study recommendations from agent
  const getAgentRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/agents/flashcards/recommendations?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (result.success && result.recommendations) {
        setStudyRecommendations(result.recommendations);
        return result.recommendations;
      }
    } catch (error) {
          }
  };

  // Get concept explanation from agent
  const explainConcept = async (concept) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/agents/flashcards/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          concept: concept
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        return result.explanation;
      }
    } catch (error) {
          }
  };

  // Effects
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
              }
    }
  }, [navigate]);

  // Load flashcard set by share code
  const loadFlashcardSetByCode = useCallback(async (shareCode, mode = 'preview') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/flashcards/by-code/${shareCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFlashcards(data.flashcards);
        setCurrentCard(0);
        setIsFlipped(false);
        setCurrentSetInfo({
          saved: true,
          setId: data.set.id,
          shareCode: data.set.share_code,
          setTitle: data.set.title,
          cardCount: data.flashcards.length
        });
        
        if (mode === 'preview') {
          const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
          setShuffledCards(cards);
          setPreviewMode(true);
        } else if (mode === 'study') {
          const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
          setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
          setShowStudyResults(false);
          setShuffledCards(cards);
          generateMCQOptions(cards, 0);
          setStudyMode(true);
          updateStreak();
        }
      }
    } catch (error) {
            showPopup('Error', 'Failed to load flashcard set');
    }
  }, [studySettings.shuffle]);

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadFlashcardHistory();
      loadFlashcardStats();
      loadReviewCards();
      
      // Check for URL parameters to load a specific set
      const params = new URLSearchParams(location.search);
      const shareCode = params.get('code');
      const mode = params.get('mode') || 'preview';
      const setId = params.get('set_id');
      
      if (shareCode) {
                loadFlashcardSetByCode(shareCode, mode);
        setActivePanel('cards');
      } else if (setId) {
                loadFlashcardSet(parseInt(setId), mode);
        setActivePanel('cards');
      }
    }
  }, [userName, location.search, loadChatSessions, loadFlashcardHistory, loadFlashcardStats, loadReviewCards, loadFlashcardSetByCode]);

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


  // Helper functions
  const getDisplayName = () => {
    if (userProfile?.name) return userProfile.name.split(' ')[0];
    if (userName) return userName.charAt(0).toUpperCase() + userName.slice(1);
    return 'Student';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getMasteryLevel = (accuracy) => {
    if (accuracy >= 90) return { level: 'Master', color: '#22c55e' };
    if (accuracy >= 70) return { level: 'Proficient', color: '#3b82f6' };
    if (accuracy >= 50) return { level: 'Learning', color: '#f59e0b' };
    return { level: 'Beginner', color: '#ef4444' };
  };

  const getFilteredAndSortedSets = () => {
    let filtered = flashcardHistory || [];
    if (searchQuery) {
      filtered = filtered.filter(set => 
        set.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    switch (sortBy) {
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'cards':
        filtered = [...filtered].sort((a, b) => (b.card_count || 0) - (a.card_count || 0));
        break;
      case 'accuracy':
        filtered = [...filtered].sort((a, b) => (b.accuracy_percentage || 0) - (a.accuracy_percentage || 0));
        break;
      default:
        break;
    }
    return filtered;
  };

  // Flashcard operations
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
            return [];
    }
  };

  const generateChatSummaryTitle = async (chatHistory, flashcardsData = null) => {
    try {
      let textToAnalyze = '';
      if (flashcardsData && flashcardsData.length > 0) {
        textToAnalyze = flashcardsData.map(card => `${card.question} ${card.answer}`).join(' ').slice(0, 1500);
      } else if (chatHistory && chatHistory.length > 0) {
        textToAnalyze = chatHistory
          .filter(msg => (msg.user_message || msg.content) && (msg.ai_response || ''))
          .map(msg => `${msg.user_message || msg.content} ${msg.ai_response || ''}`)
          .join(' ').slice(0, 1500);
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
      return 'Study Session Cards';
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
      
      // Try the new agent endpoint first for BOTH modes
      try {
        const formData = new FormData();
        formData.append('user_id', userName);
        formData.append('action', 'generate');
        formData.append('card_count', cardCount.toString());
        formData.append('difficulty', difficultyLevel);
        formData.append('depth_level', depthLevel);
        formData.append('is_public', isPublic.toString());
        
        if (generationMode === 'topic') {
          // Topic-based generation
          formData.append('topic', topic);
        } else {
          // Chat history-based generation
          const chatHistory = await loadChatHistoryData();
          
          // Convert chat history to content string for the agent
          const chatContent = chatHistory
            .map(msg => `Q: ${msg.user_message || msg.content}\nA: ${msg.ai_response || ''}`)
            .join('\n\n');
          
          formData.append('content', chatContent);
          
          // Generate a title from the chat
          const summaryTitle = await generateChatSummaryTitle(chatHistory);
          formData.append('topic', summaryTitle); // Use as topic hint
        }
        
        const agentResponse = await fetch(`${API_URL}/flashcard_agent/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (agentResponse.ok) {
          const data = await agentResponse.json();
          
          // Cards can be at data.cards or data.data.cards
          const cards = data.cards || data.data?.cards;
          
          if (data.success && cards && cards.length > 0) {
            setFlashcards(cards);
            setCurrentCard(0);
            setIsFlipped(false);
            
            const setTitle = data.set_title || data.data?.set_title || (generationMode === 'topic' ? `Flashcards: ${topic}` : 'Chat Study Cards');
            
            setCurrentSetInfo({
              saved: true,
              setId: data.set_id || data.data?.set_id,
              shareCode: data.share_code || data.data?.share_code,
              setTitle: setTitle,
              cardCount: cards.length
            });
            
            loadFlashcardHistory();
            loadFlashcardStats();
            gamificationService.trackFlashcardSet(userName, cards.length);
            
            // Update URL with share code
            const shareCode = data.share_code || data.data?.share_code;
            if (shareCode) {
              window.history.replaceState({}, '', `/flashcards?code=${shareCode}&mode=preview`);
            }
            
            // Auto-open preview mode after generation
            const shuffledCards = studySettings.shuffle ? [...cards].sort(() => Math.random() - 0.5) : cards;
            setShuffledCards(shuffledCards);
            setPreviewMode(true);
            
            setGenerating(false);
            return;
          }
        }
        
        // If agent fails, fall through to legacy endpoint

      } catch (agentError) {

      }
      
      // Legacy endpoint fallback
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('card_count', cardCount.toString());
      formData.append('difficulty_level', difficultyLevel);
      formData.append('depth_level', depthLevel);
      formData.append('save_to_set', autoSave.toString());
      formData.append('is_public', isPublic.toString());

      if (generationMode === 'topic') {
        formData.append('topic', topic);
        formData.append('generation_type', 'topic');
        if (autoSave) formData.append('set_title', `Flashcards: ${topic}`);
      } else {
        const chatHistory = await loadChatHistoryData();
        formData.append('generation_type', 'chat_history');
        formData.append('chat_data', JSON.stringify(chatHistory));
        if (autoSave) {
          const summaryTitle = await generateChatSummaryTitle(chatHistory);
          formData.append('set_title', summaryTitle);
        }
      }

      const response = await fetch(`${API_URL}/generate_flashcards`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to generate flashcards');
      }

      const data = await response.json();
      
      if (!data.flashcards || data.flashcards.length === 0) {
        showPopup('No Cards Generated', 'Unable to generate flashcards. Try a different topic.');
        setGenerating(false);
        return;
      }
      
      setFlashcards(data.flashcards);
      setCurrentCard(0);
      setIsFlipped(false);

      if (data.saved_to_set) {
        setCurrentSetInfo({
          saved: true,
          setId: data.set_id,
          shareCode: data.share_code,
          setTitle: data.set_title,
          cardCount: data.flashcards.length
        });
        loadFlashcardHistory();
        loadFlashcardStats();
        gamificationService.trackFlashcardSet(userName, data.flashcards.length);
        
        // Update URL with share code
        if (data.share_code) {
          window.history.replaceState({}, '', `/flashcards?code=${data.share_code}&mode=preview`);
        }
        
        // Auto-open preview mode after generation
        const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
        setShuffledCards(cards);
        setPreviewMode(true);
      } else {
        setCurrentSetInfo({ saved: false, cardCount: data.flashcards.length });
        
        // Auto-open preview mode after generation
        const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
        setShuffledCards(cards);
        setPreviewMode(true);
      }
    } catch (error) {
            showPopup('Error', 'Failed to generate flashcards. Please try again.');
    }
    setGenerating(false);
  };

  const loadFlashcardSet = async (setId, mode = 'study') => {
    try {
      const token = localStorage.getItem('token');
      // Use the existing endpoint that works
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
          shareCode: data.share_code,
          setTitle: data.set_title || 'Flashcard Set',
          cardCount: data.flashcards.length
        });
        
        // Update URL with share code if available
        if (data.share_code) {
          const newUrl = `/flashcards?code=${data.share_code}&mode=${mode}`;
          window.history.replaceState({}, '', newUrl);
        }
        
        if (mode === 'preview') {
          // Preview mode = Flippable cards in full screen
          const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
          setShuffledCards(cards);
          setPreviewMode(true);
        } else if (mode === 'study') {
          // Study mode = MCQ quiz with mastery tracking
          const cards = studySettings.shuffle ? [...data.flashcards].sort(() => Math.random() - 0.5) : data.flashcards;
          setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
          setShowStudyResults(false);
          setShuffledCards(cards);
          generateMCQOptions(cards, 0);
          setStudyMode(true);
          updateStreak();
        }
      }
    } catch (error) {
            showPopup('Error', 'Failed to load flashcard set');
    }
  };

  const deleteFlashcardSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this flashcard set?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/flashcards/sets/${setId}`, {
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
            showPopup('Error', 'Failed to delete flashcard set');
    }
  };

  const handleRenameSubmit = async (setId) => {
    if (!editingTitle.trim()) {
      setEditingSetId(null);
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
        body: JSON.stringify({ set_id: setId, title: editingTitle.trim(), description: '' })
      });
      if (response.ok) {
        loadFlashcardHistory();
        showPopup('Renamed', 'Flashcard set renamed successfully');
      }
    } catch (error) {
          }
    setEditingSetId(null);
    setEditingTitle('');
  };

  // Study mode functions
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

  const generateMCQOptions = (cards, cardIndex) => {
    if (!cards || !cards[cardIndex]) return;
    
    const currentCardData = cards[cardIndex];
    const correctAnswer = currentCardData.answer;
    
    // Get 3 random wrong answers from other cards
    const otherCards = cards.filter((_, idx) => idx !== cardIndex);
    const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);
    const wrongAnswers = shuffledOthers.slice(0, 3).map(card => card.answer);
    
    // Combine and shuffle all options
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    setMcqOptions(allOptions);
    setSelectedOption(null);
    setShowAnswer(false);
  };

  const handleMCQSelection = (option) => {
    if (showAnswer) return; // Already answered
    
    setSelectedOption(option);
    setShowAnswer(true);
    
    const cards = shuffledCards.length > 0 ? shuffledCards : flashcards;
    const isCorrect = option === cards[currentCard]?.answer;
    
    // Update stats
    setStudySessionStats(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect
    }));
  };

  const handleNextMCQ = () => {
    const cards = shuffledCards.length > 0 ? shuffledCards : flashcards;
    
    // Scroll to top
    const studyContent = document.querySelector('.fc-study-content');
    if (studyContent) {
      studyContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    if (currentCard < cards.length - 1) {
      const nextIndex = currentCard + 1;
      setCurrentCard(nextIndex);
      generateMCQOptions(cards, nextIndex);
      setIsFlipped(false);
    } else {
      setShowStudyResults(true);
    }
  };

  const handleStudyResponse = async (response) => {
    setStudySessionStats(prev => ({ ...prev, [response]: prev[response] + 1 }));
    const cards = studySettings.shuffle ? shuffledCards : flashcards;
    
    // Track with agent if session is active
    if (agentSessionActive && cards[currentCard]) {
      const quality = response === 'correct' ? 5 : response === 'incorrect' ? 1 : 3;
      const responseTime = sessionStartTime ? (Date.now() - sessionStartTime) / 1000 : 5;
      await reviewCardWithAgent(cards[currentCard].id, quality, responseTime);
      setSessionStartTime(Date.now()); // Reset for next card
    }
    
    if (currentCard < cards.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    } else {
      setShowStudyResults(true);
      if (agentSessionActive) {
        await endAgentSession();
      }
    }
  };

  const exitStudyMode = () => {
    if (agentSessionActive) {
      endAgentSession();
    }
    setStudyMode(false);
    setPreviewMode(false);
    setShowStudyResults(false);
    setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
    setCurrentCard(0);
    setIsFlipped(false);
    setSelectedOption(null);
    setShowAnswer(false);
    setMcqOptions([]);
    
    // Clear URL parameters
    window.history.replaceState({}, '', '/flashcards');
  };

  const restartStudy = () => {
    setCurrentCard(0);
    setIsFlipped(false);
    setShowStudyResults(false);
    setStudySessionStats({ correct: 0, incorrect: 0, skipped: 0 });
    const cards = studySettings.shuffle ? [...flashcards].sort(() => Math.random() - 0.5) : flashcards;
    if (studySettings.shuffle) {
      setShuffledCards(cards);
    }
    // Regenerate MCQ options for first card
    generateMCQOptions(cards, 0);
  };

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

  const currentStudyCards = studySettings.shuffle ? shuffledCards : flashcards;


  // Preview Mode UI (Flippable Cards)
  if (previewMode && flashcards.length > 0) {
    const previewCards = shuffledCards.length > 0 ? shuffledCards : flashcards;
    
    const ChevronLeft = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>;
    const ChevronRight = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>;
    
    const handleCardClick = (e) => {
      e.stopPropagation();
      setIsFlipped(prev => !prev);
    };
    
    return (
      <div className="flashcards-page">
        <div className="fc-study-mode">
          <div className="fc-study-header">
            <button className="fc-exit-btn" onClick={exitStudyMode}>
              ◀ Exit
            </button>
            <div className="fc-study-title">
              <h2>{currentSetInfo?.setTitle || 'Preview Mode'}</h2>
              <span className="fc-card-counter">CARD {currentCard + 1} OF {previewCards.length}</span>
            </div>
            <button 
              className={`fc-shuffle-btn ${studySettings.shuffle ? 'active' : ''}`}
              onClick={() => setStudySettings(prev => ({ ...prev, shuffle: !prev.shuffle }))}
            >
              {Icons.shuffle}
            </button>
          </div>

          <div className="fc-study-progress">
            <div 
              className="fc-study-progress-fill" 
              style={{ width: `${((currentCard + 1) / previewCards.length) * 100}%` }}
            />
          </div>

          <div className="fc-study-content">
            <div className="fc-preview-card-container">
              <button 
                className="fc-arrow-btn fc-arrow-left"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCard > 0) {
                    setCurrentCard(currentCard - 1);
                    setIsFlipped(false);
                  }
                }}
                disabled={currentCard === 0}
              >
                ◀
              </button>
              <div 
                className={`fc-study-card ${isFlipped ? 'flipped' : ''}`}
                onClick={handleCardClick}
              >
                <div className="fc-study-card-inner">
                  <div className="fc-study-card-front">
                    <div className="fc-study-badge">Question</div>
                    <div className="fc-study-card-text">{previewCards[currentCard]?.question}</div>
                    <div className="fc-study-hint">Click to flip</div>
                  </div>
                  <div className="fc-study-card-back">
                    <div className="fc-study-badge">Answer</div>
                    <div className="fc-study-card-text">{previewCards[currentCard]?.answer}</div>
                    <div className="fc-study-hint">Click to flip back</div>
                  </div>
                </div>
              </div>
              <button 
                className="fc-arrow-btn fc-arrow-right"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCard < previewCards.length - 1) {
                    setCurrentCard(currentCard + 1);
                    setIsFlipped(false);
                  }
                }}
                disabled={currentCard === previewCards.length - 1}
              >
                ▶
              </button>
            </div>

            <div className="fc-knowledge-btns">
              <button 
                className="fc-knowledge-btn fc-dont-know"
                onClick={async (e) => {
                  e.stopPropagation();
                  handleStudyResponse('incorrect');
                  const card = previewCards[currentCard];
                  if (card?.id) {
                    await updateCardMastery(card.id, false);
                    await markCardForReview(card.id, true);
                  }
                  if (currentCard < previewCards.length - 1) {
                    setCurrentCard(currentCard + 1);
                    setIsFlipped(false);
                  }
                }}
              >
                {Icons.x}
                <span>I don't know this</span>
              </button>
              <button 
                className="fc-knowledge-btn fc-know"
                onClick={async (e) => {
                  e.stopPropagation();
                  handleStudyResponse('correct');
                  const card = previewCards[currentCard];
                  if (card?.id) {
                    await updateCardMastery(card.id, true);
                    if (card?.marked_for_review) {
                      await markCardForReview(card.id, false);
                    }
                  }
                  if (currentCard < previewCards.length - 1) {
                    setCurrentCard(currentCard + 1);
                    setIsFlipped(false);
                  }
                }}
              >
                {Icons.check}
                <span>I know this</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Study Mode UI (MCQ Quiz)
  if (studyMode && flashcards.length > 0) {
    return (
      <div className="flashcards-page">
        <div className="fc-study-mode">
          {showStudyResults ? (
            <div className="fc-results">
              <div className="fc-results-card">
                <div className="fc-results-icon">{Icons.celebration}</div>
                <h2>Session Complete!</h2>
                <p className="fc-results-subtitle">{currentSetInfo?.setTitle || 'Study Session'}</p>
                
                <div className="fc-results-stats">
                  <div className="fc-result-stat correct">
                    <div className="fc-result-stat-icon">{Icons.check}</div>
                    <div className="fc-result-stat-num">{studySessionStats.correct}</div>
                    <div className="fc-result-stat-label">Correct</div>
                  </div>
                  <div className="fc-result-stat incorrect">
                    <div className="fc-result-stat-icon">{Icons.x}</div>
                    <div className="fc-result-stat-num">{studySessionStats.incorrect}</div>
                    <div className="fc-result-stat-label">Needs Review</div>
                  </div>
                  <div className="fc-result-stat skipped">
                    <div className="fc-result-stat-icon">{Icons.arrowRight}</div>
                    <div className="fc-result-stat-num">{studySessionStats.skipped}</div>
                    <div className="fc-result-stat-label">Skipped</div>
                  </div>
                </div>

                <div className="fc-results-actions">
                  <button className="fc-btn fc-btn-secondary" onClick={restartStudy}>
                    {Icons.refresh} Study Again
                  </button>
                  <button className="fc-btn fc-btn-primary" onClick={exitStudyMode}>
                    Back
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="fc-study-header">
                <button className="fc-exit-btn" onClick={exitStudyMode}>
                  ◀ Exit
                </button>
                <div className="fc-study-title">
                  <h2>{currentSetInfo?.setTitle || 'Study Session'}</h2>
                  <span className="fc-card-counter">CARD {currentCard + 1} OF {currentStudyCards.length}</span>
                </div>
                <button 
                  className={`fc-shuffle-btn ${studySettings.shuffle ? 'active' : ''}`}
                  onClick={() => setStudySettings(prev => ({ ...prev, shuffle: !prev.shuffle }))}
                >
                  {Icons.shuffle}
                </button>
              </div>

              <div className="fc-study-progress">
                <div 
                  className="fc-study-progress-fill" 
                  style={{ width: `${((currentCard + 1) / currentStudyCards.length) * 100}%` }}
                />
              </div>

              <div className="fc-study-content">
                <div className="fc-study-mcq-area">
                  <div className="fc-mcq-question-container">
                    <button 
                      className="fc-arrow-btn fc-arrow-left"
                      onClick={() => {
                        if (currentCard > 0) {
                          setCurrentCard(currentCard - 1);
                          generateMCQOptions(currentStudyCards, currentCard - 1);
                          setSelectedOption(null);
                          setShowAnswer(false);
                        }
                      }}
                      disabled={currentCard === 0}
                    >
                      ◀
                    </button>
                    <div className="fc-study-question-card">
                      <div className="fc-study-badge">Question</div>
                      <div className="fc-study-question-text">{currentStudyCards[currentCard]?.question}</div>
                    </div>
                    <button 
                      className="fc-arrow-btn fc-arrow-right"
                      onClick={() => {
                        if (currentCard < currentStudyCards.length - 1) {
                          setCurrentCard(currentCard + 1);
                          generateMCQOptions(currentStudyCards, currentCard + 1);
                          setSelectedOption(null);
                          setShowAnswer(false);
                        }
                      }}
                      disabled={currentCard === currentStudyCards.length - 1}
                    >
                      ▶
                    </button>
                  </div>

                  <div className="fc-mcq-options">
                    {mcqOptions.map((option, index) => {
                      const isCorrect = option === currentStudyCards[currentCard]?.answer;
                      const isSelected = option === selectedOption;
                      let optionClass = 'fc-mcq-option';
                      
                      if (showAnswer) {
                        if (isCorrect) {
                          optionClass += ' correct';
                        } else if (isSelected && !isCorrect) {
                          optionClass += ' incorrect';
                        } else {
                          optionClass += ' disabled';
                        }
                      }
                      
                      return (
                        <button
                          key={index}
                          className={optionClass}
                          onClick={() => handleMCQSelection(option)}
                          disabled={showAnswer}
                        >
                          <span className="fc-mcq-letter">{String.fromCharCode(65 + index)}</span>
                          <span className="fc-mcq-text">{option}</span>
                          {showAnswer && isCorrect && <span className="fc-mcq-icon">{Icons.check}</span>}
                          {showAnswer && isSelected && !isCorrect && <span className="fc-mcq-icon">{Icons.x}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {showAnswer && (
                    <button className="fc-next-question-btn" onClick={handleNextMCQ}>
                      {currentCard < currentStudyCards.length - 1 ? 'Next Question ▶' : 'Finish'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main Dashboard UI
  return (
    <div className="flashcards-page">
      <div className="fc-layout">
        {/* Sidebar */}
        <aside className={`fc-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="fc-sidebar-header">
            <div className="fc-logo" onClick={() => navigate('/dashboard')}>
              <span className="fc-logo-text">cerbyl</span>
            </div>
            <button className="fc-collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              {sidebarCollapsed ? '›' : '‹'}
            </button>
          </div>

          <nav className="fc-sidebar-nav">
            <button className={`fc-nav-item ${activePanel === 'cards' ? 'active' : ''}`} onClick={() => setActivePanel('cards')}>
              <span className="fc-nav-icon">{Icons.cards}</span>
              <span className="fc-nav-text">My Flashcards</span>
            </button>
            <button className={`fc-nav-item ${activePanel === 'review' ? 'active' : ''}`} onClick={() => setActivePanel('review')}>
              <span className="fc-nav-icon">{Icons.refresh}</span>
              <span className="fc-nav-text">Needs Review</span>
              {reviewCards.total_cards > 0 && (
                <span className="fc-nav-badge">{reviewCards.total_cards}</span>
              )}
            </button>
            <button className={`fc-nav-item ${activePanel === 'generator' ? 'active' : ''}`} onClick={() => setActivePanel('generator')}>
              <span className="fc-nav-icon">{Icons.sparkle}</span>
              <span className="fc-nav-text">Generator</span>
            </button>
            <button className={`fc-nav-item ${activePanel === 'statistics' ? 'active' : ''}`} onClick={() => setActivePanel('statistics')}>
              <span className="fc-nav-icon">{Icons.chart}</span>
              <span className="fc-nav-text">Statistics</span>
            </button>
            <button className="fc-nav-item fc-convert-btn" onClick={() => setShowImportExport(true)}>
              <span className="fc-nav-icon">{Icons.bolt}</span>
              <span className="fc-nav-text">Convert</span>
            </button>
          </nav>

          <div className="fc-sidebar-footer">
            <button className="fc-nav-item" onClick={() => navigate('/dashboard')}>
              <span className="fc-nav-icon">{Icons.home}</span>
              <span className="fc-nav-text">Dashboard</span>
            </button>
            <button className="fc-nav-item" onClick={() => navigate('/ai-chat')}>
              <span className="fc-nav-icon">{Icons.chat}</span>
              <span className="fc-nav-text">AI Chat</span>
            </button>
            <button className="fc-nav-item" onClick={() => { localStorage.clear(); navigate('/login'); }}>
              <span className="fc-nav-icon">{Icons.logout}</span>
              <span className="fc-nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="fc-main">
          {/* My Flashcards Panel */}
          {activePanel === 'cards' && (
            <>
              <header className="fc-header">
                {sidebarCollapsed && (
                  <button 
                    className="fc-show-sidebar-btn" 
                    onClick={() => setSidebarCollapsed(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                  </button>
                )}
                <div className="fc-header-left">
                  <h1 className="fc-header-title">My Flashcards</h1>
                  <p className="fc-header-subtitle">View and manage your flashcard sets</p>
                </div>
                <div className="fc-header-actions">
                  <div className="fc-search">
                    <span className="fc-search-icon">{Icons.search}</span>
                    <input 
                      type="text"
                      placeholder="Search sets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select className="fc-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="recent">Most Recent</option>
                    <option value="alphabetical">A-Z</option>
                    <option value="cards">Most Cards</option>
                    <option value="accuracy">Highest Accuracy</option>
                  </select>
                  <button className="fc-btn fc-btn-secondary" onClick={() => { loadFlashcardHistory(); loadFlashcardStats(); }}>
                    {Icons.refresh}
                  </button>
                  <button className="fc-btn fc-btn-primary" onClick={() => setActivePanel('generator')}>
                    + Create New
                  </button>
                </div>
              </header>

              <div className="fc-stats-bar">
                <p className="fc-stats-text">
                  {flashcardHistory.length} {flashcardHistory.length === 1 ? 'set' : 'sets'} • {flashcardStats?.total_cards || 0} cards total
                </p>
              </div>

              <div className="fc-content fc-cards-panel">
                {loadingHistory ? (
                  <div className="fc-loading">
                    <div className="fc-spinner">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p>Loading your flashcards...</p>
                  </div>
                ) : flashcardHistory.length === 0 ? (
                  <div className="fc-empty">
                    <div className="fc-empty-icon">{Icons.book}</div>
                    <h3>No Flashcard Sets Yet</h3>
                    <p>Create your first set to start learning!</p>
                    <button className="fc-btn fc-btn-primary" onClick={() => setActivePanel('generator')}>
                      {Icons.sparkle} Create Your First Set
                    </button>
                  </div>
                ) : (
                  <div className="fc-grid">
                    {getFilteredAndSortedSets().map((set, index) => {
                      const mastery = getMasteryLevel(set.accuracy_percentage || 0);
                      // Generate different colors for each set
                      const colors = [
                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
                        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
                      ];
                      const cardColor = colors[index % colors.length];
                      
                      return (
                        <div key={set.id} className="fc-set-card-new">
                          {/* Colored Thumbnail with Title */}
                          <div className="fc-set-thumbnail" style={{ background: `linear-gradient(135deg, ${cardColor} 0%, ${cardColor}dd 100%)` }}>
                            <div className="fc-set-thumbnail-content">
                              {editingSetId === set.id ? (
                                <input
                                  type="text"
                                  className="fc-input-title-thumb"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(set.id)}
                                  onBlur={() => handleRenameSubmit(set.id)}
                                  autoFocus
                                />
                              ) : (
                                <h2 className="fc-thumbnail-title">{set.title.replace(/^Flashcards:\s*/i, '')}</h2>
                              )}
                            </div>
                            <button 
                              className="fc-delete-btn-thumb" 
                              onClick={() => deleteFlashcardSet(set.id)} 
                              style={{ 
                                background: 'rgba(0, 0, 0, 0.3)',
                                borderColor: 'rgba(0, 0, 0, 0.5)',
                                color: 'white'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.8)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.5)';
                              }}
                            >
                              {Icons.trash}
                            </button>
                          </div>

                          {/* Content Section */}
                          <div className="fc-set-content-new">
                            <div className="fc-set-meta-new">
                              <div className="fc-meta-item-new">
                                <span className="fc-meta-label">Cards:</span>
                                <span className="fc-meta-value">{set.card_count}</span>
                              </div>
                            </div>
                            
                            <div className="fc-mastery-section">
                              <div className="fc-mastery-info">
                                <span className="fc-mastery-label">Mastery:</span>
                                <span className="fc-mastery-value" style={{ color: mastery.color }}>{mastery.level}</span>
                              </div>
                              <div className="fc-set-progress-new">
                                <div className="fc-set-progress-fill-new" style={{ width: `${set.accuracy_percentage || 0}%`, background: mastery.color }} />
                              </div>
                              <span className="fc-mastery-percentage">{set.accuracy_percentage || 0}%</span>
                            </div>
                            
                            <p className="fc-set-date-new">Created: {formatDate(set.created_at)}</p>
                          </div>

                          {/* Actions */}
                          <div className="fc-set-actions-new">
                            <button className="fc-action-btn-new fc-action-preview" onClick={() => loadFlashcardSet(set.id, 'preview')}>
                              {Icons.eye}
                              <span>Preview</span>
                            </button>
                            <button className="fc-action-btn-new fc-action-study" onClick={() => loadFlashcardSet(set.id, 'study')}>
                              {Icons.play}
                              <span>Study</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}


          {/* Generator Panel */}
          {activePanel === 'generator' && (
            <>
              <header className="fc-header">
                <div className="fc-header-left">
                  <h1 className="fc-header-title">Generate Flashcards</h1>
                  <p className="fc-header-subtitle">Create AI-powered flashcards from topics or chat history</p>
                </div>
              </header>

              <div className="fc-content">
                <div className="fc-generator">
                  <div className="fc-mode-selector">
                    <button 
                      className={`fc-mode-btn ${generationMode === 'topic' ? 'active' : ''}`}
                      onClick={() => setGenerationMode('topic')}
                    >
                      <div className="fc-mode-icon">{Icons.edit}</div>
                      <span className="fc-mode-label">By Topic</span>
                      <span className="fc-mode-desc">Enter any topic to generate cards</span>
                    </button>
                    <button 
                      className={`fc-mode-btn ${generationMode === 'chat_history' ? 'active' : ''}`}
                      onClick={() => setGenerationMode('chat_history')}
                    >
                      <div className="fc-mode-icon">{Icons.chat}</div>
                      <span className="fc-mode-label">From Chat History</span>
                      <span className="fc-mode-desc">Convert AI conversations to cards</span>
                    </button>
                  </div>

                  {generationMode === 'topic' ? (
                    <>
                      <div className="fc-form-group">
                        <label className="fc-label">What would you like to learn?</label>
                        <input
                          type="text"
                          className="fc-input"
                          placeholder="e.g., Quantum Physics, Spanish Vocabulary..."
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !generating && generateFlashcards()}
                        />
                      </div>

                      <div className="fc-form-row">
                        <div className="fc-form-group">
                          <label className="fc-label">Number of Cards</label>
                          <div className="fc-number-input">
                            <button className="fc-number-btn" onClick={() => setCardCount(Math.max(1, cardCount - 1))}>−</button>
                            <input type="number" value={cardCount} onChange={(e) => setCardCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))} />
                            <button className="fc-number-btn" onClick={() => setCardCount(Math.min(15, cardCount + 1))}>+</button>
                          </div>
                        </div>
                        <div className="fc-form-group">
                          <label className="fc-label">Difficulty</label>
                          <select className="fc-select" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)} style={{width: '100%'}}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div className="fc-form-group">
                          <label className="fc-label">Depth</label>
                          <select className="fc-select" value={depthLevel} onChange={(e) => setDepthLevel(e.target.value)} style={{width: '100%'}}>
                            <option value="surface">Surface</option>
                            <option value="standard">Standard</option>
                            <option value="deep">Deep</option>
                          </select>
                        </div>
                      </div>

                      <div className="fc-form-group">
                        <label className="fc-label">Visibility</label>
                        <div className="fc-visibility-toggle">
                          <button 
                            className={`fc-visibility-btn ${!isPublic ? 'active' : ''}`}
                            onClick={() => setIsPublic(false)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Private
                          </button>
                          <button 
                            className={`fc-visibility-btn ${isPublic ? 'active' : ''}`}
                            onClick={() => setIsPublic(true)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M2 12h20"/>
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            Public
                          </button>
                        </div>
                        <p className="fc-visibility-hint">
                          {isPublic ? 'Anyone can find and copy this set' : 'Only you can see this set'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="fc-sessions-header">
                        <h3>Select Chat Sessions</h3>
                        <div className="fc-sessions-actions">
                          <button className="fc-btn fc-btn-secondary" onClick={() => setSelectedSessions((chatSessions || []).map(s => s.id))}>Select All</button>
                          <button className="fc-btn fc-btn-secondary" onClick={() => setSelectedSessions([])}>Clear</button>
                        </div>
                      </div>

                      {chatSessions.length === 0 ? (
                        <div className="fc-empty">
                          <div className="fc-empty-icon">{Icons.chat}</div>
                          <h3>No Chat Sessions</h3>
                          <p>Start a conversation with AI to generate flashcards from it.</p>
                          <button className="fc-btn fc-btn-primary" onClick={() => navigate('/ai-chat')}>Go to AI Chat</button>
                        </div>
                      ) : (
                        <div className="fc-sessions-list">
                          {(chatSessions || []).map((session) => (
                            <div
                              key={session.id}
                              className={`fc-session-item ${selectedSessions.includes(session.id) ? 'selected' : ''}`}
                              onClick={() => setSelectedSessions(prev => 
                                prev.includes(session.id) ? prev.filter(id => id !== session.id) : [...prev, session.id]
                              )}
                            >
                              <input 
                                type="checkbox" 
                                className="fc-session-checkbox"
                                checked={selectedSessions.includes(session.id)}
                                onChange={() => {}}
                              />
                              <div className="fc-session-info">
                                <div className="fc-session-title">{session.title}</div>
                                <div className="fc-session-date">{new Date(session.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="fc-form-row">
                        <div className="fc-form-group">
                          <label className="fc-label">Number of Cards</label>
                          <div className="fc-number-input">
                            <button className="fc-number-btn" onClick={() => setCardCount(Math.max(1, cardCount - 1))}>−</button>
                            <input type="number" value={cardCount} onChange={(e) => setCardCount(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))} />
                            <button className="fc-number-btn" onClick={() => setCardCount(Math.min(15, cardCount + 1))}>+</button>
                          </div>
                        </div>
                        <div className="fc-form-group">
                          <label className="fc-label">Difficulty</label>
                          <select className="fc-select" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value)} style={{width: '100%'}}>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div className="fc-form-group">
                          <label className="fc-label">Depth</label>
                          <select className="fc-select" value={depthLevel} onChange={(e) => setDepthLevel(e.target.value)} style={{width: '100%'}}>
                            <option value="surface">Surface</option>
                            <option value="standard">Standard</option>
                            <option value="deep">Deep</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    className="fc-generate-btn"
                    onClick={generateFlashcards}
                    disabled={generating || (generationMode === 'topic' ? !topic.trim() : selectedSessions.length === 0)}
                  >
                    {generating ? 'Generating...' : <>{Icons.sparkle} Generate {cardCount} Flashcards</>}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Needs Review Panel */}
          {activePanel === 'review' && (
            <>
              <header className="fc-header">
                <div className="fc-header-left">
                  <h1 className="fc-header-title">Needs Review</h1>
                  <p className="fc-header-subtitle">Cards you marked as "I don't know this"</p>
                </div>
                <div className="fc-header-actions">
                  <button className="fc-btn fc-btn-secondary" onClick={loadReviewCards}>
                    {Icons.refresh}
                  </button>
                </div>
              </header>

              <div className="fc-content">
                {loadingReviewCards ? (
                  <div className="fc-loading">
                    <div className="fc-spinner">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p>Loading cards for review...</p>
                  </div>
                ) : reviewCards.total_cards === 0 ? (
                  <div className="fc-empty">
                    <div className="fc-empty-icon">{Icons.check}</div>
                    <h3>No Cards Need Review</h3>
                    <p>Great job! You haven't marked any cards as "I don't know this" yet.</p>
                    <button className="fc-btn fc-btn-primary" onClick={() => setActivePanel('cards')}>
                      Study Flashcards
                    </button>
                  </div>
                ) : (
                  <div className="fc-review-section">
                    <div className="fc-review-summary">
                      <span className="fc-review-count">{reviewCards.total_cards} cards</span> need your attention
                    </div>
                    
                    {(reviewCards.sets || []).map((setData) => (
                      <div key={setData.set_id} className="fc-review-set">
                        <div className="fc-review-set-header">
                          <h3>{setData.set_title}</h3>
                          <span className="fc-review-set-count">{(setData.cards || []).length} cards</span>
                        </div>
                        <div className="fc-review-cards-list">
                          {(setData.cards || []).map((card) => (
                            <div key={card.id} className="fc-review-card-item">
                              <div className="fc-review-card-content">
                                <div className="fc-review-card-question">
                                  <span className="fc-review-label">Q:</span>
                                  {card.question}
                                </div>
                                <div className="fc-review-card-answer">
                                  <span className="fc-review-label">A:</span>
                                  {card.answer}
                                </div>
                              </div>
                              <div className="fc-review-card-actions">
                                <button 
                                  className="fc-btn fc-btn-small fc-btn-success"
                                  onClick={async () => {
                                    await markCardForReview(card.id, false);
                                  }}
                                  title="I know this now"
                                >
                                  {Icons.check}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button 
                          className="fc-btn fc-btn-primary fc-review-study-btn"
                          onClick={() => {
                            // Load just the review cards from this set for study
                            const reviewCardsForSet = setData.cards || [];
                            setFlashcards(reviewCardsForSet);
                            setShuffledCards(reviewCardsForSet);
                            setCurrentCard(0);
                            setIsFlipped(false);
                            setCurrentSetInfo({
                              saved: true,
                              setId: setData.set_id,
                              setTitle: `Review: ${setData.set_title}`,
                              cardCount: reviewCardsForSet.length
                            });
                            setPreviewMode(true);
                          }}
                        >
                          {Icons.play} Study These Cards
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Statistics Panel */}
          {activePanel === 'statistics' && (
            <>
              <header className="fc-header">
                <div className="fc-header-left">
                  <h1 className="fc-header-title">Statistics & Analytics</h1>
                  <p className="fc-header-subtitle">Track your learning progress</p>
                </div>
              </header>

              <div className="fc-content">
                {flashcardStats ? (
                  <>
                    <div className="fc-stats-grid">
                      <div className="fc-stat-card">
                        <div className="fc-stat-icon">{Icons.book}</div>
                        <div className="fc-stat-value">{flashcardStats.total_sets}</div>
                        <div className="fc-stat-label">Total Sets</div>
                      </div>
                      <div className="fc-stat-card">
                        <div className="fc-stat-icon">{Icons.cards}</div>
                        <div className="fc-stat-value">{flashcardStats.total_cards}</div>
                        <div className="fc-stat-label">Total Cards</div>
                      </div>
                      <div className="fc-stat-card">
                        <div className="fc-stat-icon">{Icons.target}</div>
                        <div className="fc-stat-value">{flashcardStats.overall_accuracy}%</div>
                        <div className="fc-stat-label">Accuracy</div>
                      </div>
                      <div className="fc-stat-card">
                        <div className="fc-stat-icon">{Icons.fire}</div>
                        <div className="fc-stat-value">{currentStreak}</div>
                        <div className="fc-stat-label">Day Streak</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="fc-empty">
                    <div className="fc-empty-icon">{Icons.chart}</div>
                    <h3>No Statistics Yet</h3>
                    <p>Start studying flashcards to see your analytics here!</p>
                    <button className="fc-btn fc-btn-primary" onClick={() => setActivePanel('cards')}>
                      View My Flashcards
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <CustomPopup
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        message={popup.message}
      />
      
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="flashcards"
        onSuccess={(result) => {
          showPopup("Success", "Successfully converted flashcards!");
          loadFlashcardHistory();
        }}
      />
    </div>
  );
};

export default Flashcards;
