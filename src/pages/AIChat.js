import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import gamificationService from '../services/gamificationService';
import './AIChat.css';

const AIChat = ({ sharedMode = false }) => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedTheme } = useTheme();
  const [sharedChatData, setSharedChatData] = useState(null);
  const [isSharedContent, setIsSharedContent] = useState(sharedMode);
  
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [folders, setFolders] = useState([]);
  
  const [showFeedbackFor, setShowFeedbackFor] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [improvementSuggestion, setImprovementSuggestion] = useState('');
  
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  const handleFolderCreation = async () => {
    if (!folderName.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/create_chat_folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          name: folderName.trim(),
          color: 'var(--accent)'
        })
      });

      if (response.ok) {
        const newFolder = await response.json();
        setFolders(prev => [...prev, newFolder]);
        setShowFolderCreation(false);
        setFolderName('');
        loadChatFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleMoveToFolder = async (chatId, folderId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/move_chat_to_folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_id: chatId,
          folder_id: folderId
        })
      });

      if (response.ok) {
        loadChatSessions();
        setShowMoveMenu(null);
      }
    } catch (error) {
      console.error('Error moving chat:', error);
    }
  };

  const handleContextMenu = (e, chatId) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMoveMenu(chatId);
  };
  const [fileProcessing, setFileProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [processedFiles, setProcessedFiles] = useState([]);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isLoadingRef = useRef(false);

  const [showFolderCreation, setShowFolderCreation] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const greetings = [
    "Welcome back! How can I help you today?",
    "Ready to explore new topics together?",
    "Let's dive into learning something new",
    "Your personal AI tutor is here to help",
    "What would you like to learn today?",
    "Hello {name}! I'm excited to help you learn",
    "{name}, ready to unlock new knowledge?",
    "Welcome back, {name}! Let's continue your learning",
    "Hey {name}! What would you like to explore?",
    "{name}, let's make today a learning adventure",
    "Good day, {name}! Ready to expand your horizons?",
    "Hi {name}! Let's tackle your questions together",
    "Welcome, {name}! Your AI learning companion is here",
    "{name}, let's turn curiosity into understanding",
    "Hello {name}! What fascinating topic shall we discuss?"
  ];

  const loadSharedChat = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/shared/chat/${chatId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSharedChatData(data);
        setIsSharedContent(true);
        
        // Set up the chat UI with shared data
        setMessages(data.messages || []);
        // You might want to set a special title or indicator for shared chats
      } else {
        throw new Error('Failed to load shared chat');
      }
    } catch (error) {
      console.error('Error loading shared chat:', error);
      navigate('/social');
    }
  };

  const getRandomGreeting = (name) => {
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    return randomGreeting.replace(/{name}/g, name);
  };

  // Enhanced scroll to bottom from Knowledge Roadmap
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        left: 0,
        behavior: 'smooth'
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Enhanced scroll handling from Knowledge Roadmap
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      
      // Add scrolled class for visual indicator (more precise detection)
      if (scrollTop > 10) {
        messagesContainerRef.current.classList.add('scrolled');
      } else {
        messagesContainerRef.current.classList.remove('scrolled');
      }
      
      // Show scroll to top button when scrolled down significantly
      setShowScrollToTop(scrollTop > 200);
      
      // Show scroll to bottom button when not at bottom
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 30;
      setShowScrollToBottom(!isAtBottom && messages.length > 3);
    }
  };

  // Enhanced scroll to top from Knowledge Roadmap
  const scrollToTop = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      });
      // Force scroll to absolute top after smooth scroll completes
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = 0;
        }
      }, 500);
    }
  };

  const handleFileSelect = (files) => {
    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.name.toLowerCase().endsWith('.pdf');
      const isValidSize = file.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        alert(`${file.name} is not a supported file type. Please upload images or PDF files.`);
        return false;
      }
      if (!isValidSize) {
        alert(`${file.name} is too large. Please upload files smaller than 10MB.`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files) {
      handleFileSelect(e.target.files);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setProcessedFiles([]);
  };

  const loadChatFolders = async () => {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_chat_folders?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const foldersData = await response.json();
        setFolders(foldersData || []);
      }
    } catch (error) {
      console.error('Error loading chat folders:', error);
    }
  };

  const loadChatSessions = async () => {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        setChatSessions(sessions);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadChatMessages = async (sessionId) => {
    if (!sessionId) {
      return;
    }
    
    console.log(`📥 Loading messages for chat session: ${sessionId}`);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_chat_messages?chat_id=${sessionId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const messagesArray = await response.json();
        console.log(`✅ Loaded ${messagesArray.length} messages from database`);
        setMessages(messagesArray);
        setTimeout(scrollToBottom, 100);
      } else {
        console.log(`❌ Failed to load messages: ${response.status}`);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      isLoadingRef.current = false;
    }
  };

  const createNewChat = async () => {
    if (!userName) return null;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/create_chat_session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'New Chat'
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        const sessionData = {
          id: newChat.session_id || newChat.id,
          title: newChat.title,
          created_at: newChat.created_at,
          updated_at: newChat.updated_at || newChat.created_at
        };
        
        setChatSessions(prev => [sessionData, ...prev]);
        return sessionData.id;
      } else {
        console.error('Failed to create chat session:', await response.text());
        return null;
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  const cleanupEmptyNewChats = async () => {
    // Only cleanup chats that are truly empty (no messages)
    // Don't cleanup the active chat or any chat the user might be working on
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      // Only look at chats with title "New Chat" that are NOT the active chat
      const potentialEmptyChats = chatSessions.filter(
        chat => chat.title === 'New Chat' && chat.id !== activeChatId
      );

      for (const chat of potentialEmptyChats) {
        try {
          const response = await fetch(`${API_URL}/get_chat_messages?chat_id=${chat.id}`, {
            method: 'GET',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const msgs = await response.json();
            // Only delete if truly empty (no messages at all)
            if (!msgs || msgs.length === 0) {
              const deleteResponse = await fetch(`${API_URL}/delete_chat_session/${chat.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (deleteResponse.ok) {
                setChatSessions(prev => prev.filter(c => c.id !== chat.id));
              }
            }
          }
        } catch (innerError) {
          // Don't let one failed cleanup stop the others
          console.error(`Error checking chat ${chat.id}:`, innerError);
        }
      }
    } catch (error) {
      console.error('Error cleaning up empty chats:', error);
    }
  };

  const handleNewChat = async () => {
    await cleanupEmptyNewChats();
    const newChatId = await createNewChat();
    if (newChatId) {
      isLoadingRef.current = false;
      navigate(`/ai-chat/${newChatId}`);
    }
  };

  const selectChat = (chatSessionId) => {
    // Don't cleanup when selecting a chat - only cleanup on explicit actions
    isLoadingRef.current = false;
    navigate(`/ai-chat/${chatSessionId}`);
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || loading || !userName) return;

    let currentChatId = activeChatId;
    let isNewChat = false;
    
    if (!currentChatId) {
      currentChatId = await createNewChat();
      if (!currentChatId) {
        alert('Error: Failed to create new chat. Please try again.');
        return;
      }
      isNewChat = true;
      // Set activeChatId immediately to prevent useEffect from clearing messages
      setActiveChatId(currentChatId);
      // Navigate with replace to update URL without triggering full reload
      navigate(`/ai-chat/${currentChatId}`, { replace: true });
    }

    const userMessage = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputMessage || (selectedFiles.length > 0 ? `${selectedFiles.length} file(s) uploaded` : ''),
      timestamp: new Date().toISOString(),
      files: selectedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputMessage;
    setInputMessage('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('question', messageText || 'Please analyze the uploaded files.');
      formData.append('chat_id', currentChatId.toString());

      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const endpoint = selectedFiles.length > 0 ? 
        `${API_URL}/ask_with_files/` : 
        `${API_URL}/ask_simple/`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      console.log(`✅ AI response received. Chat ID: ${data.chat_id || currentChatId}`);
      
      if (!data.answer) {
        throw new Error('No answer received from AI');
      }
      
      const aiMessage = {
        id: `ai_${Date.now()}`,
        type: 'ai',
        content: data.answer,
        timestamp: new Date().toISOString(),
        ...(data.ai_confidence !== null && data.ai_confidence !== undefined && {
          aiConfidence: data.ai_confidence,
          shouldRequestFeedback: data.should_request_feedback || false
        }),
        topics: data.topics_discussed || [],
        misconceptionDetected: data.misconception_detected || false,
        filesProcessed: data.files_processed || 0,
        fileSummaries: data.file_summaries || [],
        hasFileContext: data.has_file_context || false
      };

      setMessages(prev => [...prev, aiMessage]);
      clearAllFiles();
      
      // Check if the backend used a different chat_id (in case of validation issues)
      const actualChatId = data.chat_id;
      if (actualChatId && actualChatId !== currentChatId) {
        console.log(`Chat ID changed from ${currentChatId} to ${actualChatId}`);
        setActiveChatId(actualChatId);
        navigate(`/ai-chat/${actualChatId}`, { replace: true });
        currentChatId = actualChatId;
      }
      
      // Auto-rename chat if it's the first message or title is still "New Chat"
      if (isNewChat || messageText.trim()) {
        const currentChat = chatSessions.find(chat => chat.id === currentChatId);
        if (!currentChat || currentChat.title === 'New Chat') {
          await autoRenameChat(currentChatId, messageText);
        }
      }
      
      // Reload chat sessions to ensure the list is up to date
      await loadChatSessions();
      
      // Points are now awarded by backend when saving message

    } catch (error) {
      console.error('Error in sendMessage:', error);
      const errorMessage = {
        id: `error_${Date.now()}`,
        type: 'ai',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        aiConfidence: 0.3,
        shouldRequestFeedback: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = (chatSessionId, chatTitle) => {
    setChatToDelete({ id: chatSessionId, title: chatTitle });
    setShowDeleteConfirmation(true);
  };

  const autoRenameChat = async (chatId, userMessage) => {
    try {
      const token = localStorage.getItem('token');
      
      // Generate a title from the first message (take first 50 chars or first sentence)
      let title = userMessage.trim();
      
      // Take first sentence or first 50 characters
      const firstSentence = title.match(/^[^.!?]+[.!?]/);
      if (firstSentence) {
        title = firstSentence[0];
      }
      
      // Limit to 50 characters
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      // Update the chat title
      const response = await fetch(`${API_URL}/rename_chat_session`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_id: chatId,
          new_title: title
        })
      });

      if (response.ok) {
        // Update local state
        setChatSessions(prev => prev.map(chat => 
          chat.id === chatId ? { ...chat, title } : chat
        ));
      }
    } catch (error) {
      console.error('Error auto-renaming chat:', error);
    }
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_chat_session/${chatToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setChatSessions(prev => prev.filter(chat => chat.id !== chatToDelete.id));
        
        if (activeChatId === chatToDelete.id) {
          const remainingChats = chatSessions.filter(chat => chat.id !== chatToDelete.id);
          if (remainingChats.length > 0) {
            isLoadingRef.current = false;
            navigate(`/ai-chat/${remainingChats[0].id}`);
          } else {
            isLoadingRef.current = false;
            navigate('/ai-chat');
          }
        }
        
        setShowDeleteConfirmation(false);
        setChatToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const rateResponse = async (messageId, rating) => {
    try {
      const token = localStorage.getItem('token');
      const message = messages.find(m => m.id === messageId);
      
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('rating', rating.toString());
      formData.append('message_content', message?.content || '');

      const response = await fetch(`${API_URL}/submit_advanced_feedback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, userRating: rating } : msg
        ));
        
        if (rating <= 3) {
          setShowFeedbackFor(messageId);
        }
      }
    } catch (error) {
      console.error('Error rating response:', error);
    }
  };

  const submitFeedback = async (messageId) => {
    if (!feedbackText.trim() && !improvementSuggestion.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const message = messages.find(m => m.id === messageId);
      
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('rating', message?.userRating || 1);
      formData.append('feedback_text', feedbackText);
      formData.append('improvement_suggestion', improvementSuggestion);
      formData.append('message_content', message?.content || '');

      const response = await fetch(`${API_URL}/submit_advanced_feedback`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        setShowFeedbackFor(null);
        setFeedbackText('');
        setImprovementSuggestion('');
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { 
            ...msg, 
            feedbackSubmitted: true,
            neuralNetworkUpdated: true 
          } : msg
        ));
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const getConfidenceClass = (confidence) => {
    if (confidence < 0.5) return 'low';
    if (confidence < 0.8) return 'medium';
    return 'high';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
  };

  const handleLogout = async () => {
    await cleanupEmptyNewChats();
    if (userProfile?.googleUser && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  const goToDashboard = async () => {
    await cleanupEmptyNewChats();
    navigate('/dashboard');
  };

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  const copyToClipboard = (text, codeIndex) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCode(codeIndex);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  // Convert text symbols to Unicode symbols
  const convertSymbolsToUnicode = (text) => {
    const symbolMap = {
      // Greek letters
      '*alpha*': 'α', '*Alpha*': 'Α',
      '*beta*': 'β', '*Beta*': 'Β',
      '*gamma*': 'γ', '*Gamma*': 'Γ',
      '*delta*': 'δ', '*Delta*': 'Δ',
      '*epsilon*': 'ε', '*Epsilon*': 'Ε',
      '*zeta*': 'ζ', '*Zeta*': 'Ζ',
      '*eta*': 'η', '*Eta*': 'Η',
      '*theta*': 'θ', '*Theta*': 'Θ',
      '*iota*': 'ι', '*Iota*': 'Ι',
      '*kappa*': 'κ', '*Kappa*': 'Κ',
      '*lambda*': 'λ', '*Lambda*': 'Λ',
      '*mu*': 'μ', '*Mu*': 'Μ',
      '*nu*': 'ν', '*Nu*': 'Ν',
      '*xi*': 'ξ', '*Xi*': 'Ξ',
      '*omicron*': 'ο', '*Omicron*': 'Ο',
      '*pi*': 'π', '*Pi*': 'Π',
      '*rho*': 'ρ', '*Rho*': 'Ρ',
      '*sigma*': 'σ', '*Sigma*': 'Σ',
      '*tau*': 'τ', '*Tau*': 'Τ',
      '*upsilon*': 'υ', '*Upsilon*': 'Υ',
      '*phi*': 'φ', '*Phi*': 'Φ',
      '*chi*': 'χ', '*Chi*': 'Χ',
      '*psi*': 'ψ', '*Psi*': 'Ψ',
      '*omega*': 'ω', '*Omega*': 'Ω',
      
      // Math symbols
      '*infinity*': '∞',
      '*sum*': '∑',
      '*Sum*': '∑',
      '*summation*': '∑',
      '*Summation*': '∑',
      '*product*': '∏',
      '*Product*': '∏',
      '*integral*': '∫',
      '*Integral*': '∫',
      '*partial*': '∂',
      '*nabla*': '∇',
      '*sqrt*': '√',
      '*approx*': '≈',
      '*neq*': '≠',
      '*leq*': '≤',
      '*geq*': '≥',
      '*times*': '×',
      '*divide*': '÷',
      '*plusminus*': '±',
      '*degree*': '°',
      '*therefore*': '∴',
      '*because*': '∵',
      '*forall*': '∀',
      '*exists*': '∃',
      '*in*': '∈',
      '*notin*': '∉',
      '*subset*': '⊂',
      '*supset*': '⊃',
      '*union*': '∪',
      '*intersection*': '∩',
      '*angle*': '∠',
      '*perpendicular*': '⊥',
      '*parallel*': '∥',
      '*arrow*': '→',
      '*leftarrow*': '←',
      '*rightarrow*': '→',
      '*uparrow*': '↑',
      '*downarrow*': '↓',
      
      // Additional statistical symbols
      '*mean*': 'x̄',
      '*variance*': 'σ²',
      '*stddev*': 'σ',
      '*correlation*': 'ρ',
      '*proportion*': 'p̂',
      
      // Set theory
      '*emptyset*': '∅',
      '*element*': '∈',
      '*notelement*': '∉',
      '*contains*': '∋',
      '*notcontains*': '∌',
      
      // Logic symbols
      '*and*': '∧',
      '*or*': '∨',
      '*not*': '¬',
      '*implies*': '⇒',
      '*iff*': '⇔',
      '*equivalent*': '≡',
      
      // Calculus
      '*limit*': 'lim',
      '*derivative*': 'd/dx',
      '*del*': '∂',
      
      // Inequalities
      '*much_less*': '≪',
      '*much_greater*': '≫',
      '*less_equal*': '≤',
      '*greater_equal*': '≥',
      '*not_equal*': '≠',
      
      // Arrows
      '*implies_arrow*': '⇒',
      '*iff_arrow*': '⇔',
      '*maps_to*': '↦',
      '*left_right_arrow*': '↔',
      
      // Fractions and numbers
      '*half*': '½',
      '*third*': '⅓',
      '*quarter*': '¼',
      '*two_thirds*': '⅔',
      '*three_quarters*': '¾',
      
      // Superscripts (common)
      '*squared*': '²',
      '*cubed*': '³',
      
      // Physics symbols
      '*planck*': 'ℏ',
      '*angstrom*': 'Å',
      '*ohm*': 'Ω',
      '*micro*': 'μ',
      
      // Currency
      '*euro*': '€',
      '*pound*': '£',
      '*yen*': '¥',
      '*cent*': '¢',
      
      // Miscellaneous
      '*check*': '✓',
      '*cross*': '✗',
      '*star*': '★',
      '*bullet*': '•',
      '*ellipsis*': '…',
      '*dagger*': '†',
      '*double_dagger*': '‡',
      '*section*': '§',
      '*paragraph*': '¶',
      '*copyright*': '©',
      '*registered*': '®',
      '*trademark*': '™',
      
      // Geometric shapes
      '*circle*': '○',
      '*filled_circle*': '●',
      '*square*': '□',
      '*filled_square*': '■',
      '*triangle*': '△',
      '*filled_triangle*': '▲',
      
      // Chemistry
      '*equilibrium*': '⇌',
      '*reversible*': '⇄',
      
      // Complex numbers
      '*real*': 'ℝ',
      '*complex*': 'ℂ',
      '*natural*': 'ℕ',
      '*integer*': 'ℤ',
      '*rational*': 'ℚ',
      
      // Probability
      '*expected*': 'E',
      '*probability*': 'P',
      '*given*': '|',
      
      // Dots
      '*cdot*': '·',
      '*ldots*': '…',
      '*cdots*': '⋯',
      '*vdots*': '⋮',
      '*ddots*': '⋱',
    };
    
    let result = text;
    for (const [symbol, unicode] of Object.entries(symbolMap)) {
      result = result.replace(new RegExp(symbol.replace(/[*]/g, '\\*'), 'gi'), unicode);
    }
    return result;
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    
    // Wrap large mathematical symbols in special class
    const mathSymbols = ['∑', 'Σ', '∫', '∏', 'Π', '∮', '∯', '∰', '⨌'];
    mathSymbols.forEach(symbol => {
      const regex = new RegExp(symbol, 'g');
      text = text.replace(regex, `<span class="math-symbol">${symbol}</span>`);
    });
    
    // Process line by line to handle headers and lists
    const lines = text.split('\n');
    const processedLines = [];
    let inBulletList = false;
    let inNumberedList = false;
    let inTable = false;
    let tableRows = [];
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Handle table detection
      if (line.includes('|') && !inTable) {
        // Start of table
        inTable = true;
        tableRows = [line];
        continue;
      } else if (inTable && line.includes('|')) {
        // Continue table
        tableRows.push(line);
        continue;
      } else if (inTable && !line.includes('|')) {
        // End of table
        inTable = false;
        processedLines.push(renderTable(tableRows));
        tableRows = [];
        // Process current line normally
      }
      
      // Skip empty lines in tables
      if (inTable) continue;
      
      // Check for headers FIRST
      if (/^#### (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        const content = line.replace(/^#### (.+)$/, '$1');
        processedLines.push(`<h4 class="md-h4">${content}</h4>`);
        continue;
      }
      if (/^### (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        const content = line.replace(/^### (.+)$/, '$1');
        processedLines.push(`<h3 class="md-h3">${content}</h3>`);
        continue;
      }
      if (/^## (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        const content = line.replace(/^## (.+)$/, '$1');
        processedLines.push(`<h2 class="md-h2">${content}</h2>`);
        continue;
      }
      if (/^# (.+)$/.test(line)) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        const content = line.replace(/^# (.+)$/, '$1');
        processedLines.push(`<h1 class="md-h1">${content}</h1>`);
        continue;
      }
      
      // Bold and italic - Enhanced detection
      // Use different classes for bold at start of line (heading-like) vs inline
      if (/^\*\*(.+?)\*\*/.test(line)) {
        // Bold at start of line = main heading bold
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold-heading">$1</strong>');
      } else {
        // Bold elsewhere = side/inline bold
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold-inline">$1</strong>');
      }
      line = line.replace(/__(.+?)__/g, '<strong class="md-bold-inline">$1</strong>');
      line = line.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
      line = line.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');
      
      // Inline code
      line = line.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
      
      // Keywords highlighting (words in ALL CAPS or specific patterns)
      line = line.replace(/\b([A-Z]{2,})\b/g, '<span class="keyword">$1</span>');
      
      // Check for lists
      const isBullet = /^[\*\-•] (.+)$/.test(line);
      const isNumbered = /^\d+\. (.+)$/.test(line);
      
      if (isBullet) {
        if (!inBulletList) {
          processedLines.push('<ul class="md-ul">');
          inBulletList = true;
        }
        const content = line.replace(/^[\*\-•] (.+)$/, '$1');
        processedLines.push(`<li class="md-li">${content}</li>`);
      } else if (isNumbered) {
        if (!inNumberedList) {
          processedLines.push('<ol class="md-ol">');
          inNumberedList = true;
        }
        const content = line.replace(/^\d+\. (.+)$/, '$1');
        processedLines.push(`<li class="md-li-num">${content}</li>`);
      } else {
        if (inBulletList) {
          processedLines.push('</ul>');
          inBulletList = false;
        }
        if (inNumberedList) {
          processedLines.push('</ol>');
          inNumberedList = false;
        }
        
        // Add line (empty lines will be handled in paragraph processing)
        processedLines.push(line);
      }
    }
    
    // Handle any remaining table
    if (inTable && tableRows.length > 0) {
      processedLines.push(renderTable(tableRows));
    }
    
    // Close any open lists
    if (inBulletList) processedLines.push('</ul>');
    if (inNumberedList) processedLines.push('</ol>');
    
    // Process lines into proper paragraphs
    const finalContent = [];
    let currentParagraph = [];
    
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const trimmedLine = line.trim();
      
      // Check if this is a block element (heading, list, table, etc.)
      const isBlockElement = line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || 
                            line.startsWith('</ul>') || line.startsWith('</ol>') || 
                            line.startsWith('<div class="table-block-container">');
      
      // Empty line indicates paragraph break
      const isEmptyLine = trimmedLine === '';
      
      if (isBlockElement) {
        // Finish current paragraph if exists
        if (currentParagraph.length > 0) {
          finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
        }
        
        // Add block element
        finalContent.push(line);
      } else if (isEmptyLine) {
        // Empty line - finish current paragraph if exists
        if (currentParagraph.length > 0) {
          finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
          currentParagraph = [];
        }
      } else {
        // Regular text line - add to current paragraph
        if (trimmedLine) {
          currentParagraph.push(trimmedLine);
        }
      }
    }
    
    // Finish any remaining paragraph
    if (currentParagraph.length > 0) {
      finalContent.push(`<p>${currentParagraph.join(' ')}</p>`);
    }
    
    text = finalContent.join('\n');
    
    // Post-processing: Ensure the first element is properly formatted
    if (text && !text.startsWith('<')) {
      // If content doesn't start with HTML tag, wrap it in a paragraph
      text = `<p>${text}</p>`;
    }
    
    return text;
  };

  // Helper function to render tables in structured blocks
  const renderTable = (tableRows) => {
    if (tableRows.length < 2) return tableRows.join('\n');
    
    // Count columns from header row
    const headerRow = tableRows[0];
    const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
    const columnCount = headers.length;
    
    // Create table block container similar to code blocks
    let tableBlockHtml = '<div class="table-block-container">';
    
    // Add table header with info
    tableBlockHtml += '<div class="table-block-header">';
    tableBlockHtml += '<span class="table-info">TABLE</span>';
    tableBlockHtml += `<span class="table-meta">${tableRows.length - 1} rows × ${columnCount} columns</span>`;
    tableBlockHtml += '</div>';
    
    // Add table content
    tableBlockHtml += '<div class="table-block-content">';
    tableBlockHtml += '<table class="structured-table">';
    
    // Process header row
    if (headers.length > 0) {
      tableBlockHtml += '<thead><tr>';
      headers.forEach(header => {
        tableBlockHtml += `<th>${header}</th>`;
      });
      tableBlockHtml += '</tr></thead>';
    }
    
    // Process data rows (skip separator row if exists)
    tableBlockHtml += '<tbody>';
    let rowCount = 0;
    for (let i = 1; i < tableRows.length; i++) {
      const row = tableRows[i];
      // Skip separator rows (like |---|---|)
      if (row.includes('---')) continue;
      
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length > 0) {
        rowCount++;
        tableBlockHtml += `<tr class="table-row-${rowCount % 2 === 0 ? 'even' : 'odd'}">`;
        cells.forEach((cell, index) => {
          // Add row number for first column if it's numeric data
          const cellContent = cell || '—'; // Use em dash for empty cells
          tableBlockHtml += `<td data-column="${index + 1}">${cellContent}</td>`;
        });
        tableBlockHtml += '</tr>';
      }
    }
    tableBlockHtml += '</tbody></table>';
    tableBlockHtml += '</div>'; // Close table-block-content
    tableBlockHtml += '</div>'; // Close table-block-container
    
    return tableBlockHtml;
  };

  const renderMessageContent = (content) => {
    if (!content) return null;

    // Convert symbols to Unicode first
    content = convertSymbolsToUnicode(content);

    // Convert superscripts and subscripts
    // Match patterns like x^2, a^n, 10^-3, etc.
    content = content.replace(/\^(\d+|[a-zA-Z]|\{[^}]+\})/g, (match, exp) => {
      // Remove curly braces if present
      const cleanExp = exp.replace(/[{}]/g, '');
      return `<sup>${cleanExp}</sup>`;
    });
    
    // Match subscripts like H_2O, x_i, etc.
    content = content.replace(/_(\d+|[a-zA-Z]|\{[^}]+\})/g, (match, sub) => {
      // Remove curly braces if present
      const cleanSub = sub.replace(/[{}]/g, '');
      return `<sub>${cleanSub}</sub>`;
    });

    // Split content by code blocks (```language\ncode\n```)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        language: match[1] || 'plaintext',
        content: match[2].trim()
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    // If no code blocks found, render as markdown
    if (parts.length === 0) {
      const htmlContent = renderMarkdown(content);
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }

    return parts.map((part, index) => {
      if (part.type === 'text') {
        const htmlContent = renderMarkdown(part.content);
        return <div key={index} dangerouslySetInnerHTML={{ __html: htmlContent }} />;
      } else {
        return (
          <div key={index} className="code-block-container" data-language={part.language}>
            <div className="code-block-header">
              <span className="code-language">{part.language.toUpperCase()}</span>
              <button
                className={`code-copy-btn ${copiedCode === index ? 'copied' : ''}`}
                onClick={() => copyToClipboard(part.content, index)}
                title="Copy code"
              >
                {copiedCode === index ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    COPIED
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    COPY
                  </>
                )}
              </button>
            </div>
            <pre className="code-block">
              <code className={`language-${part.language}`}>{part.content}</code>
            </pre>
          </div>
        );
      }
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName, fileType) => {
    if (fileType && fileType.startsWith('image/')) {
      return 'IMG';
    } else if (fileType === 'application/pdf' || (fileName && fileName.toLowerCase().endsWith('.pdf'))) {
      return 'PDF';
    }
    return 'FILE';
  };

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
        const parsedProfile = JSON.parse(profile);
        setUserProfile(parsedProfile);
        const displayName = parsedProfile?.firstName || username;
        setGreeting(getRandomGreeting(displayName));
      } catch (error) {
        console.error('Error parsing user profile:', error);
        setGreeting(getRandomGreeting(username || 'there'));
      }
    } else {
      setGreeting(getRandomGreeting(username || 'there'));
    }
  }, [navigate]);

  useEffect(() => {
    if (userName) {
      loadChatFolders();
      loadChatSessions();
    }
  }, [userName]);

  // Handle initialMessage from SearchHub or other sources
  useEffect(() => {
    const initialMsg = location.state?.initialMessage;
    
    if (initialMsg && userName && !loading) {
      console.log('🚀 Auto-sending initial message:', initialMsg);
      
      // Set the input message so user can see what they asked
      setInputMessage(initialMsg);
      
      // Wait for component to be ready, then send
      const timer = setTimeout(async () => {
        // Create a new chat session first
        const newChatId = await createNewChat();
        
        if (!newChatId) {
          console.error('Failed to create new chat session');
          setLoading(false);
          return;
        }
        
        console.log(`✅ Created new chat session: ${newChatId}`);
        
        // Set active chat and navigate
        setActiveChatId(newChatId);
        navigate(`/ai-chat/${newChatId}`, { replace: true });
        
        // Add user message to UI
        const userMessage = {
          id: `user_${Date.now()}`,
          type: 'user',
          content: initialMsg,
          timestamp: new Date().toISOString()
        };
        
        setMessages([userMessage]);
        setInputMessage('');
        setLoading(true);
        
        // Send to backend
        try {
          const token = localStorage.getItem('token');
          const formData = new FormData();
          formData.append('user_id', userName);
          formData.append('question', initialMsg);
          formData.append('chat_id', newChatId.toString());
          
          const response = await fetch(`${API_URL}/ask_simple/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (!data.answer) {
            throw new Error('No answer received from AI');
          }
          
          // Add AI response to UI
          const aiMessage = {
            id: `ai_${Date.now()}`,
            type: 'ai',
            content: data.answer,
            timestamp: new Date().toISOString(),
            aiConfidence: data.ai_confidence || 0.9,
            shouldRequestFeedback: data.should_request_feedback || false,
            topics: data.topics_discussed || []
          };
          
          setMessages(prev => [...prev, aiMessage]);
          
          // Auto-rename chat based on the question
          await autoRenameChat(newChatId, initialMsg);
          
          // Reload chat sessions to show the new chat
          await loadChatSessions();
          
        } catch (error) {
          console.error('Error sending initial message:', error);
          const errorMessage = {
            id: `error_${Date.now()}`,
            type: 'ai',
            content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setLoading(false);
        }
        
        // Clear the location state
        window.history.replaceState({}, document.title);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [location.state?.initialMessage, userName]);

  useEffect(() => {
    const numericChatId = chatId ? parseInt(chatId) : null;
    
    if (numericChatId && !isNaN(numericChatId)) {
      // Only load messages if this is a different chat than what we have active
      // This prevents clearing messages when we just created a new chat
      if (activeChatId !== numericChatId) {
        setActiveChatId(numericChatId);
        // Only clear and reload if we're switching to a different existing chat
        // Don't clear if messages are already being added (new chat scenario)
        if (!isLoadingRef.current) {
          isLoadingRef.current = true;
          setMessages([]);
          loadChatMessages(numericChatId);
        }
      }
    } else if (chatId === undefined || chatId === null) {
      // Only reset if we're at /ai-chat with no ID (fresh start)
      if (activeChatId !== null) {
        setActiveChatId(null);
        setMessages([]);
      }
      isLoadingRef.current = false;
    }
  }, [chatId, activeChatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedTheme && selectedTheme.tokens) {
      Object.entries(selectedTheme.tokens).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  }, [selectedTheme]);

  // Enhanced scroll event listener setup from Knowledge Roadmap
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      
      // Initial scroll state check
      handleScroll();
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages]); // Re-run when messages change

  // Icons matching Flashcards
  const Icons = {
    chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    folder: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
    trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
    x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    chevronLeft: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
    chevronRight: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
    send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    attach: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
    arrowUp: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>,
    arrowDown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>,
  };

  return (
    <div className="ai-chat-page">
      <div className="ac-layout">
        {/* Sidebar - Matching Flashcards */}
        <aside className={`ac-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
          <div className="ac-sidebar-header">
            <div className="ac-logo" onClick={handleLogoClick}>
              <span className="ac-logo-text">cerbyl</span>
            </div>
            <button 
              className="ac-collapse-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? Icons.chevronLeft : Icons.chevronRight}
            </button>
          </div>

          {/* New Chat Button */}
          <button 
            className="ac-new-chat-btn" 
            onClick={handleNewChat}
            disabled={loading}
          >
            {Icons.plus}
            <span>New Chat</span>
          </button>

          {/* Search Input */}
          <div className="ac-search-container">
            <div className="ac-search-wrapper">
              <svg className="ac-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input 
                type="text" 
                className="ac-search-input" 
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="ac-sidebar-nav">
            {/* Folders Section */}
            <div className="ac-folders-section">
              <div className="ac-folders-header">
                <h4>Folders</h4>
                <button 
                  className="ac-add-folder-btn"
                  onClick={() => setShowFolderCreation(true)}
                >
                  {Icons.plus}
                </button>
              </div>
              
              {showFolderCreation && (
                <div className="ac-folder-input-group">
                  <input
                    type="text"
                    className="ac-folder-input"
                    placeholder="Folder name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFolderCreation();
                      else if (e.key === 'Escape') {
                        setShowFolderCreation(false);
                        setFolderName('');
                      }
                    }}
                    autoFocus
                  />
                  <button className="ac-folder-submit" onClick={handleFolderCreation}>
                    {Icons.check}
                  </button>
                  <button 
                    className="ac-folder-cancel" 
                    onClick={() => {
                      setShowFolderCreation(false);
                      setFolderName('');
                    }}
                  >
                    {Icons.x}
                  </button>
                </div>
              )}
              
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className={`ac-folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
                  onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                >
                  <span className="ac-folder-icon">{Icons.folder}</span>
                  <span className="ac-folder-name">{folder.name}</span>
                  <span className="ac-folder-count">
                    {chatSessions.filter(s => s.folder_id === folder.id).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Chats Section */}
            <div className="ac-nav-section">
              <div className="ac-nav-section-title">
                Chats
                {selectedFolder && (
                  <button 
                    className="ac-add-folder-btn"
                    onClick={() => setSelectedFolder(null)}
                    title="Show all"
                  >
                    {Icons.x}
                  </button>
                )}
              </div>
              <div className="ac-sessions-list">
                {chatSessions.length === 0 ? (
                  <div className="ac-empty">
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  chatSessions
                    .filter(session => selectedFolder ? session.folder_id === selectedFolder : true)
                    .filter(session => 
                      searchQuery.trim() === '' || 
                      session.title.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(session => (
                      <div
                        key={session.id}
                        className={`ac-session-item ${activeChatId === session.id ? 'active' : ''}`}
                        onClick={() => selectChat(session.id)}
                      >
                        <span className="ac-session-icon">{Icons.chat}</span>
                        <div className="ac-session-info">
                          <div className="ac-session-title">{session.title}</div>
                          <div className="ac-session-date">
                            {new Date(session.updated_at).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                        <div className="ac-session-actions">
                          <button
                            className="ac-session-btn"
                            onClick={(e) => handleContextMenu(e, session.id)}
                            title="Move to folder"
                          >
                            {Icons.folder}
                          </button>
                          <button
                            className="ac-session-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChat(session.id, session.title);
                            }}
                            title="Delete"
                          >
                            {Icons.trash}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </nav>

          <div className="ac-sidebar-footer">
            <button className="ac-nav-item ac-nav-item-accent" onClick={goToDashboard}>
              <span className="ac-nav-icon">{Icons.home}</span>
              <span className="ac-nav-text">Dashboard</span>
            </button>
            <button className="ac-nav-item ac-nav-item-accent" onClick={handleLogout}>
              <span className="ac-nav-icon">{Icons.logout}</span>
              <span className="ac-nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ac-main">
          {/* Header */}
          <header className="ac-header">
            {/* Show Sidebar Button - appears when sidebar is collapsed */}
            {!sidebarOpen && (
              <button 
                className="ac-show-sidebar-btn" 
                onClick={() => setSidebarOpen(true)}
                title="Show Sidebar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
            <div className="ac-header-actions">
              {userProfile?.profilePicture && (
                <img 
                  src={userProfile.profilePicture} 
                  alt="Profile" 
                  className="ac-profile-picture" 
                />
              )}
            </div>
          </header>

          {/* Chat Content */}
          <div 
            className="ac-content"
            ref={messagesContainerRef}
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="ac-welcome">
                <h2>{greeting}</h2>
                <p>I'm your personal AI tutor. Ask me anything about any subject, and I'll help you learn with detailed explanations and examples.</p>
              </div>
            ) : (
              <div className="ac-messages">
                {messages.map((message) => (
                  <div key={message.id} className={`ac-message ${message.type}`}>
                    <div className="ac-message-bubble">
                      <div className="ac-message-content">
                        {renderMessageContent(message.content)}
                      </div>
                      
                      {message.files && message.files.length > 0 && (
                        <div className="ac-file-analysis">
                          {message.files.map((file, index) => (
                            <div key={index} className="ac-file-tag">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span>{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {message.type === 'ai' && message.fileSummaries && message.fileSummaries.length > 0 && (
                        <div className="ac-file-analysis">
                          <div className="ac-file-analysis-header">
                            {message.filesProcessed} FILE(S) ANALYZED
                          </div>
                          {message.fileSummaries.map((file, index) => (
                            <div key={index} className="ac-file-analysis-item">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span>{file.file_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="ac-message-meta">
                      <span className="ac-message-time">
                        {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      
                      {message.type === 'ai' && message.aiConfidence !== undefined && (
                        <span className={`ac-confidence ${getConfidenceClass(message.aiConfidence)}`}>
                          {Math.round(message.aiConfidence * 100)}%
                        </span>
                      )}
                    </div>

                    {message.type === 'ai' && !message.userRating && !message.feedbackSubmitted && (
                      <div className="ac-rating">
                        <span className="ac-rating-label">Rate this response</span>
                        <div className="ac-rating-buttons">
                          {[1, 2, 3, 4, 5].map(rating => (
                            <button
                              key={rating}
                              className="ac-rating-btn"
                              onClick={() => rateResponse(message.id, rating)}
                            >
                              {rating}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showFeedbackFor === message.id && (
                      <div className="ac-feedback">
                        <textarea
                          placeholder="What could be improved?"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                        />
                        <div className="ac-feedback-actions">
                          <button 
                            className="ac-btn ac-btn-secondary"
                            onClick={() => setShowFeedbackFor(null)}
                          >
                            Cancel
                          </button>
                          <button 
                            className="ac-btn ac-btn-primary"
                            onClick={() => submitFeedback(message.id)}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {loading && (
                  <div className="ac-message ai">
                    <div className="ac-message-bubble">
                      <div className="ac-pulse-loader">
                        <div className="ac-pulse-square ac-pulse-1"></div>
                        <div className="ac-pulse-square ac-pulse-2"></div>
                        <div className="ac-pulse-square ac-pulse-3"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          {/* Scroll Buttons */}
          {showScrollToTop && (
            <button 
              className="ac-scroll-btn top"
              onClick={scrollToTop}
              title="Scroll to top"
            >
              {Icons.arrowUp}
            </button>
          )}
          
          {showScrollToBottom && (
            <button 
              className="ac-scroll-btn bottom"
              onClick={scrollToBottom}
              title="Scroll to bottom"
            >
              {Icons.arrowDown}
            </button>
          )}

          {/* File Preview */}
          {selectedFiles.length > 0 && (
            <div className="ac-file-preview">
              {selectedFiles.map((file, index) => (
                <div key={index} className="ac-file-tag">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>{file.name}</span>
                  <button 
                    className="ac-file-remove" 
                    onClick={() => removeFile(index)}
                  >
                    {Icons.x}
                  </button>
                </div>
              ))}
              <button 
                className="ac-btn ac-btn-secondary"
                onClick={clearAllFiles}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="ac-input-area">
            <div className="ac-input-container">
              <div 
                className={`ac-input-wrapper ${dragActive ? 'drag-active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                
                <button
                  className="ac-input-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  title="Attach files"
                >
                  {Icons.attach}
                </button>
                
                <textarea
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message or drag files here..."
                  className="ac-textarea"
                  disabled={loading}
                  rows="1"
                />
                
                <button
                  onClick={sendMessage}
                  disabled={loading || (!inputMessage.trim() && selectedFiles.length === 0)}
                  className="ac-send-btn"
                >
                  {Icons.send}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="ac-modal-overlay">
          <div className="ac-modal">
            <h3>Delete Conversation</h3>
            <p>
              Are you sure you want to delete "{chatToDelete?.title}"? This action cannot be undone.
            </p>
            <div className="ac-modal-actions">
              <button
                className="ac-modal-btn cancel"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className="ac-modal-btn delete"
                onClick={confirmDeleteChat}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Menu */}
      {showMoveMenu && (
        <>
          <div className="ac-modal-overlay" onClick={() => setShowMoveMenu(null)} />
          <div 
            className="ac-move-menu" 
            style={{ 
              top: `${menuPosition.y}px`, 
              left: `${menuPosition.x}px` 
            }}
          >
            {folders.map(folder => (
              <button
                key={folder.id}
                className="ac-move-menu-item"
                onClick={() => handleMoveToFolder(showMoveMenu, folder.id)}
              >
                {Icons.folder}
                {folder.name}
              </button>
            ))}
            <button
              className="ac-move-menu-item"
              onClick={() => handleMoveToFolder(showMoveMenu, null)}
            >
              {Icons.x}
              Remove from Folder
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChat;