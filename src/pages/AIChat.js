import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import './AIChat.css';
import { API_URL } from '../config';
import gamificationService from '../services/gamificationService';

const AIChat = ({ sharedMode = false }) => {
  const { chatId } = useParams();
  const navigate = useNavigate();
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
          color: '#D7B38C'
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
  const fileInputRef = useRef(null);
  const isLoadingRef = useRef(false);

  const [showFolderCreation, setShowFolderCreation] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showMoveMenu, setShowMoveMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        setMessages(messagesArray);
        setTimeout(scrollToBottom, 100);
      } else {
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
          id: newChat.session_id,
          title: newChat.title,
          created_at: newChat.created_at,
          updated_at: newChat.created_at
        };
        
        setChatSessions(prev => [sessionData, ...prev]);
        return sessionData.id;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  const handleNewChat = async () => {
    const newChatId = await createNewChat();
    if (newChatId) {
      isLoadingRef.current = false;
      navigate(`/ai-chat/${newChatId}`);
    }
  };

  const selectChat = (chatSessionId) => {
    isLoadingRef.current = false;
    navigate(`/ai-chat/${chatSessionId}`);
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || loading || !userName) return;

    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = await createNewChat();
      if (!currentChatId) {
        alert('Error: Failed to create new chat. Please try again.');
        return;
      }
      isLoadingRef.current = false;
      navigate(`/ai-chat/${currentChatId}`);
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
        `${API_URL}/ask/`;

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
      
      // Track gamification activity
      gamificationService.trackAIChat(userName);

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

    // If no code blocks found, return plain text
    if (parts.length === 0) {
      return content;
    }

    return parts.map((part, index) => {
      if (part.type === 'text') {
        return <span key={index} dangerouslySetInnerHTML={{ __html: part.content }} />;
      } else {
        return (
          <div key={index} className="code-block-container">
            <div className="code-block-header">
              <span className="code-language">{part.language}</span>
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

  useEffect(() => {
    const numericChatId = chatId ? parseInt(chatId) : null;
    
    if (numericChatId && !isNaN(numericChatId)) {
      if (activeChatId !== numericChatId) {
        setActiveChatId(numericChatId);
        setMessages([]);
        
        if (!isLoadingRef.current) {
          isLoadingRef.current = true;
          loadChatMessages(numericChatId);
        }
      }
    } else {
      setActiveChatId(null);
      setMessages([]);
      isLoadingRef.current = false;
    }
  }, [chatId]);

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

  return (
    <div className="ai-chat-page">
      {sidebarOpen && (
        <div className="chat-sidebar open">
          <div className="sidebar-header">
            <div className="sidebar-title-bar">
              <div className="sidebar-title">CONVERSATIONS</div>
              <button 
                className="new-chat-btn" 
                onClick={handleNewChat}
                disabled={loading}
                title="Create new chat"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 1v10M1 6h10"/>
                </svg>
                NEW CHAT
              </button>
            </div>
          </div>

          <div className="folders-section">
            <div className="folders-header">
              <h3>Folders</h3>
              <button onClick={() => setShowFolderCreation(true)} className="btn-add-folder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  <line x1="12" y1="11" x2="12" y2="17"/>
                  <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
              </button>
            </div>
            
            {showFolderCreation && (
              <div className="folder-input-group">
                <input
                  type="text"
                  className="folder-input"
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
                <button className="folder-submit" onClick={handleFolderCreation}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
                <button 
                  className="folder-cancel" 
                  onClick={() => {
                    setShowFolderCreation(false);
                    setFolderName('');
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}
            
            <div className="folders-list">
              {folders.map((folder) => (
                <div key={folder.id} className="folder-item-wrapper">
                  <div
                    className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
                    style={{ borderLeft: `3px solid ${folder.color}` }}
                    onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                  >
                    <span>{folder.name}</span>
                    <span className="folder-count">{chatSessions.filter(s => s.folder_id === folder.id).length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="chats-section">
            <div className="chats-header">
              <h3>CHATS</h3>
              {selectedFolder && (
                <button 
                  className="clear-filter-btn"
                  onClick={() => setSelectedFolder(null)}
                  title="Show all chats"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="chat-sessions">
              {chatSessions.length === 0 ? (
                <div className="no-chats">
                  <p>No conversations yet</p>
                  <span>Start a new chat to begin</span>
                </div>
              ) : (
                chatSessions
                  .filter(session => selectedFolder ? session.folder_id === selectedFolder : true)
                  .map(session => (
                <div
                  key={session.id}
                  className={`chat-session-item ${activeChatId === session.id ? 'active' : ''}`}
                  onClick={() => selectChat(session.id)}
                >
                  <div className="chat-session-content">
                    <div className="session-title">{session.title}</div>
                    <div className="session-date">
                      {new Date(session.updated_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </div>
                  </div>
                  <div className="chat-session-actions">
                    <button
                      className="move-to-folder-btn"
                      onClick={(e) => handleContextMenu(e, session.id)}
                      title="Move to folder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                    <button
                      className="delete-chat-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(session.id, session.title);
                      }}
                      title="Delete chat"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`chat-main ${!sidebarOpen ? 'fullscreen' : ''}`}>
        <div className="chat-header">
          <div className="header-left">
            <button 
              className="sidebar-toggle" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h14M3 13h14"/>
              </svg>
            </button>
            
            <h1 className="chat-title" onClick={handleLogoClick}>
              Cerbyl
            </h1>
          </div>

          {sidebarOpen && (
            <div className="header-right">
              {userProfile?.profilePicture && (
                <img 
                  src={userProfile.profilePicture} 
                  alt="Profile" 
                  className="profile-picture" 
                />
              )}
              <button className="header-btn" onClick={goToDashboard}>
                DASHBOARD
              </button>
              <button className="header-btn" onClick={handleLogout}>
                LOGOUT
              </button>
            </div>
          )}
        </div>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2 className="welcome-title">{greeting}</h2>
                <p className="welcome-subtitle">
                  I'm your personal AI tutor. Ask me anything about any subject, and I'll help you learn with detailed explanations and examples.
                </p>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-bubble">
                    <div className="message-content">
                      {renderMessageContent(message.content)}
                    </div>
                    
                    {message.files && message.files.length > 0 && (
                      <div className="message-files">
                        {message.files.map((file, index) => (
                          <div key={index} className="message-file-tag">
                            <span className="file-icon">{getFileIcon(file.name, file.type)}</span>
                            <span className="file-name">{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {message.type === 'ai' && message.fileSummaries && message.fileSummaries.length > 0 && (
                      <div className="file-analysis">
                        <div className="file-analysis-header">
                          {message.filesProcessed} FILE(S) ANALYZED
                        </div>
                        {message.fileSummaries.map((file, index) => (
                          <div key={index} className="file-analysis-item">
                            <div className="file-analysis-name">
                              {getFileIcon(file.file_name, file.file_type)} {file.file_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="message-meta">
                    <span className="message-time">
                      {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true
                      }).toUpperCase()}
                    </span>
                    
                    {message.type === 'ai' && message.aiConfidence !== undefined && (
                      <span className={`confidence-badge ${getConfidenceClass(message.aiConfidence)}`}>
                        {Math.round(message.aiConfidence * 100)}%
                      </span>
                    )}
                  </div>

                  {message.type === 'ai' && !message.userRating && !message.feedbackSubmitted && (
                    <div className="rating-section">
                      <span className="rating-label">RATE THIS RESPONSE</span>
                      <div className="rating-buttons">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            className="rating-btn"
                            onClick={() => rateResponse(message.id, rating)}
                            title={`${rating} star${rating > 1 ? 's' : ''}`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showFeedbackFor === message.id && (
                    <div className="feedback-form">
                      <textarea
                        className="feedback-input"
                        placeholder="What could be improved?"
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                      />
                      <div className="feedback-actions">
                        <button 
                          className="btn-secondary"
                          onClick={() => setShowFeedbackFor(null)}
                        >
                          CANCEL
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => submitFeedback(message.id)}
                        >
                          SUBMIT
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {loading && (
                <div className="message ai">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="file-preview-bar">
            <div className="file-preview-header">
              <span className="file-count">{selectedFiles.length} FILE(S) SELECTED</span>
              <button className="clear-files" onClick={clearAllFiles}>
                CLEAR ALL
              </button>
            </div>
            <div className="file-preview-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-preview-item">
                  <span className="file-icon">{getFileIcon(file.name, file.type)}</span>
                  <span className="file-name">{file.name}</span>
                  <button 
                    className="remove-file" 
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="input-container">
          <div 
            className={`input-wrapper ${dragActive ? 'drag-active' : ''}`}
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
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Attach files"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 3v12M3 9h12"/>
              </svg>
            </button>
            
            <textarea
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message or drag files here..."
              className="message-input"
              disabled={loading}
              rows="1"
            />
            
            <button
              onClick={sendMessage}
              disabled={loading || (!inputMessage.trim() && selectedFiles.length === 0)}
              className="send-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 8l14-6-6 14-2-8z"/>
              </svg>
            </button>
              </div>
            </div>
          </div>
      
      {showDeleteConfirmation && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">DELETE CONVERSATION</h3>
            </div>
            <div className="modal-body">
              <p className="modal-text">
                Are you sure you want to delete "<strong>{chatToDelete?.title}</strong>"? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                CANCEL
              </button>
              <button
                className="btn-danger"
                onClick={confirmDeleteChat}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setShowMoveMenu(null)} />
          <div 
            className="context-menu" 
            style={{ 
              top: `${menuPosition.y}px`, 
              left: `${menuPosition.x}px` 
            }}
          >
            <div className="context-menu-header">Move to Folder</div>
            {folders.map(folder => (
              <div
                key={folder.id}
                className="context-menu-item"
                onClick={() => handleMoveToFolder(showMoveMenu, folder.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {folder.name}
              </div>
            ))}
            <div className="context-menu-divider" />
            <div
              className="context-menu-item"
              onClick={() => handleMoveToFolder(showMoveMenu, null)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Remove from Folder
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChat;