import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AIChat.css';

const AIChat = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  
  const [showFeedbackFor, setShowFeedbackFor] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [improvementSuggestion, setImprovementSuggestion] = useState('');
  
  // Delete functionality states
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);
  
  // File upload states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [processedFiles, setProcessedFiles] = useState([]);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // File handling functions
  const handleFileSelect = (files) => {
    const validFiles = Array.from(files).filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.name.toLowerCase().endsWith('.pdf');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
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
    setShowFilePreview(true);
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
    if (selectedFiles.length === 1) {
      setShowFilePreview(false);
    }
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setShowFilePreview(false);
    setProcessedFiles([]);
  };

  const processFiles = async () => {
    if (selectedFiles.length === 0) return [];

    setFileProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch('http://localhost:8001/upload_and_process_files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setProcessedFiles(data.processed_files || []);
        return data.processed_files || [];
      } else {
        console.error('File processing failed');
        return [];
      }
    } catch (error) {
      console.error('Error processing files:', error);
      return [];
    } finally {
      setFileProcessing(false);
    }
  };

  // Enhanced send message with file support
  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || loading || !userName) return;

    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = await createNewChat();
      if (!currentChatId) {
        alert('Error: Failed to create new chat. Please try again.');
        return;
      }
    }

    // Create user message
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

      // Add files if any
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      // Use the enhanced endpoint that handles files
      const endpoint = selectedFiles.length > 0 ? 
        'http://localhost:8001/ask_with_files/' : 
        'http://localhost:8001/ask/';

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

      // Clear files after successful send
      clearAllFiles();

      try {
        const saveResponse = await fetch('http://localhost:8001/save_chat_message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            chat_id: parseInt(currentChatId),
            user_message: messageText || `Uploaded ${selectedFiles.length} file(s)`,
            ai_response: data.answer
          })
        });

        if (saveResponse.ok) {
          loadChatSessions();
        }
      } catch (saveError) {
        console.error('Error saving message:', saveError);
      }

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

  const loadChatSessions = async () => {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const sessions = data.sessions || [];
        setChatSessions(sessions);
        
        if (sessions.length > 0 && !activeChatId) {
          setActiveChatId(sessions[0].id);
          loadChatMessages(sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadChatMessages = async (sessionId) => {
  if (!sessionId) return;
  
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8001/get_chat_messages?chat_id=${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const messagesArray = await response.json();
      setMessages(messagesArray);
    } else {
      setMessages([]);
    }
  } catch (error) {
    console.error('Error loading chat messages:', error);
    setMessages([]);
  }
};

  const createNewChat = async () => {
    if (!userName) return null;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/create_chat_session', {
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
        setActiveChatId(sessionData.id);
        setMessages([]);
        return sessionData.id;
      } else {
        console.error('Failed to create new chat session');
        return null;
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  const handleNewChat = () => {
    const currentActiveChat = chatSessions.find(chat => chat.id === activeChatId);
    
    if (messages.length === 0 && currentActiveChat) {
      return;
    }
    
    const hasEmptyChat = chatSessions.some(chat => {
      return chat.title === 'New Chat' && chat.id !== activeChatId;
    });
    
    if (hasEmptyChat) {
      const emptyChat = chatSessions.find(chat => chat.title === 'New Chat' && chat.id !== activeChatId);
      if (emptyChat) {
        selectChat(emptyChat.id);
        return;
      }
    }
    
    createNewChat();
  };

  const selectChat = (chatId) => {
    setActiveChatId(chatId);
    loadChatMessages(chatId);
    // Clear any selected files when switching chats
    clearAllFiles();
  };

  const handleDeleteChat = (chatId, chatTitle) => {
    setChatToDelete({ id: chatId, title: chatTitle });
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_chat_session/${chatToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setChatSessions(prev => prev.filter(chat => chat.id !== chatToDelete.id));
        
        if (activeChatId === chatToDelete.id) {
          const remainingChats = chatSessions.filter(chat => chat.id !== chatToDelete.id);
          if (remainingChats.length > 0) {
            setActiveChatId(remainingChats[0].id);
            loadChatMessages(remainingChats[0].id);
          } else {
            setActiveChatId(null);
            setMessages([]);
          }
        }
        
        setShowDeleteConfirmation(false);
        setChatToDelete(null);
      } else {
        console.error('Failed to delete chat session');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const rateResponse = async (messageId, rating) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('message_id', messageId.replace('ai_', ''));
      formData.append('rating', rating.toString());

      const response = await fetch('http://localhost:8001/rate_response', {
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
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('message_id', messageId.replace('ai_', ''));
      formData.append('rating', 
        messages.find(m => m.id === messageId)?.userRating || 1
      );
      formData.append('feedback_text', feedbackText);
      formData.append('improvement_suggestion', improvementSuggestion);

      const response = await fetch('http://localhost:8001/rate_response', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        setShowFeedbackFor(null);
        setFeedbackText('');
        setImprovementSuggestion('');
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, feedbackSubmitted: true } : msg
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
        const welcomeMessages = [
          `Hello ${displayName}! I can now analyze PDFs and images. Upload files to get started!`,
          `Hi ${displayName}! I've been enhanced to process documents and images for better learning.`,
          `Welcome back, ${displayName}! Share your study materials and I'll help you understand them better.`,
          `Good to see you, ${displayName}! Upload PDFs, images, or just ask questions - I'm here to help!`,
        ];
        const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
        setWelcomeMessage(welcomeMessages[randomIndex]);
      } catch (error) {
        console.error('Error parsing user profile:', error);
        setWelcomeMessage('Hello! I\'m your AI tutor, and I can now analyze PDFs and images to help you learn better!');
      }
    } else {
      setWelcomeMessage('Hello! I\'m your AI tutor with document analysis capabilities. Upload PDFs or images to get started!');
    }
  }, [navigate]);

  useEffect(() => {
    if (userName) {
      loadChatSessions();
    }
  }, [userName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="ai-chat-page">
      <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">Chat History</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New Chat
          </button>
        </div>
        
        <div className="chat-sessions">
          {chatSessions.length === 0 ? (
            <div className="no-chats">
              <p>No chats yet. Start a conversation!</p>
            </div>
          ) : (
            chatSessions.map((session) => (
              <div
                key={session.id}
                className={`chat-session-item ${activeChatId === session.id ? 'active' : ''}`}
              >
                <div 
                  className="chat-session-content"
                  onClick={() => selectChat(session.id)}
                >
                  <div className="session-title">{session.title}</div>
                  <div className="session-date">
                    {new Date(session.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="delete-chat-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(session.id, session.title);
                  }}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        <header className="chat-header">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <h1 
              className="chat-title clickable-logo" 
              onClick={handleLogoClick}
              title="Go to Dashboard"
              style={{ cursor: 'pointer' }}
            >
              brainwave
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
            <button className="logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        </header>

        <div className="messages-container">
  {messages.length === 0 ? (
    <div className="welcome-message">
      <div className="welcome-icon"></div>
      <h2>Welcome to your Enhanced AI Tutor!</h2>
      <p>{welcomeMessage}</p>
      <div className="feature-highlights">
        <div className="feature-item">
          <span className="feature-icon">PDF</span>
          <span>Upload PDFs</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">IMG</span>
          <span>Analyze Images</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">CHAT</span>
          <span>Ask Questions</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="messages-list">
      {messages.map((message) => (
        <div key={message.id} className={`message ${message.type}`}>
          <div className="message-content">
            {message.content}
                    
                    {/* Display file attachments for user messages */}
                    {message.files && message.files.length > 0 && (
                      <div className="message-files">
                        {message.files.map((file, index) => (
                          <div key={index} className="message-file-item">
                            <span className="file-icon">{getFileIcon(file.name, file.type)}</span>
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">({formatFileSize(file.size)})</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Display AI file processing results */}
                    {message.type === 'ai' && message.fileSummaries && message.fileSummaries.length > 0 && (
                      <div className="ai-file-analysis">
                        <div className="file-analysis-header">
                          Document Analysis Results ({message.filesProcessed} file(s) processed)
                        </div>
                        {message.fileSummaries.map((file, index) => (
                          <div key={index} className="file-analysis-item">
                            <div className="file-analysis-name">
                              {getFileIcon(file.file_name, file.file_type)} {file.file_name}
                            </div>
                            {file.page_count && (
                              <div className="file-analysis-detail">Pages: {file.page_count}</div>
                            )}
                            {file.extracted_text && (
                              <div className="file-analysis-preview">
                                Text extracted: {file.extracted_text.length > 100 ? 
                                  file.extracted_text.substring(0, 100) + '...' : 
                                  file.extracted_text}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="message-footer">
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            
            {message.type === 'ai' && message.aiConfidence !== undefined && (
              <div className={`ai-confidence-indicator ${getConfidenceClass(message.aiConfidence)}`}>
                AI Confidence: {Math.round(message.aiConfidence * 100)}%
              </div>
            )}
                    
                    {message.hasFileContext && (
                      <div className="file-context-indicator">
                        Used document context
                      </div>
                    )}
                  </div>

                  {message.type === 'ai' && !message.userRating && !message.feedbackSubmitted && (
                    <div className="rating-section">
                      <span className="rating-prompt">
                        {message.shouldRequestFeedback ? 
                          "I'm not very confident about this answer. Please rate to help me improve:" :
                          "Rate this response:"
                        }
                      </span>
                      <div className="rating-buttons">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            className="rating-btn"
                            onClick={() => rateResponse(message.id, rating)}
                            title={`Rate ${rating} stars`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showFeedbackFor === message.id && (
                    <div className="feedback-section visible">
                      <textarea
                        className="feedback-textarea"
                        placeholder="What could I improve about this response? Your feedback helps me learn for everyone..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                      />
                      <textarea
                        className="feedback-textarea"
                        placeholder="Specific suggestion for improvement (optional)..."
                        value={improvementSuggestion}
                        onChange={(e) => setImprovementSuggestion(e.target.value)}
                      />
                      <div className="feedback-actions">
                        <button 
                          className="feedback-cancel"
                          onClick={() => setShowFeedbackFor(null)}
                        >
                          Cancel
                        </button>
                        <button 
                          className="feedback-submit"
                          onClick={() => submitFeedback(message.id)}
                        >
                          Submit Feedback
                        </button>
                      </div>
                    </div>
                  )}

                  {message.userRating && (
                    <div className="user-rating">
                      Your rating: {message.userRating}/5 stars
                      {message.feedbackSubmitted && " - Thank you for your feedback!"}
                    </div>
                  )}

                  {message.misconceptionDetected && (
                    <div className="misconception-indicator">
                      <div style={{ 
                        fontSize: '11px', 
                        color: 'rgba(255, 193, 7, 0.8)',
                        fontStyle: 'italic' 
                      }}>
                        Corrected a common misconception
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="message ai">
                  <div className="message-content typing">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    {fileProcessing && (
                      <div className="processing-files">
                        Processing uploaded files...
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* File Preview Section */}
        {showFilePreview && selectedFiles.length > 0 && (
          <div className="file-preview-section">
            <div className="file-preview-header">
              <span>{selectedFiles.length} file(s) selected</span>
              <button className="clear-files-btn" onClick={clearAllFiles}>
                Clear All
              </button>
            </div>
            <div className="file-preview-list">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-preview-item">
                  <span className="file-preview-icon">{getFileIcon(file.name, file.type)}</span>
                  <div className="file-preview-info">
                    <div className="file-preview-name">{file.name}</div>
                    <div className="file-preview-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button 
                    className="file-remove-btn" 
                    onClick={() => removeFile(index)}
                    title="Remove file"
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
            {dragActive && (
              <div className="drag-overlay">
                <div className="drag-message">
                  <div className="drag-icon">UPLOAD</div>
                  <div>Drop your PDFs or images here</div>
                </div>
              </div>
            )}
            
            <div className="input-controls">
              <button
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload files"
                disabled={loading}
              >
                ATTACH
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              
              <textarea
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about physics, chemistry, history, geography, or upload PDFs/images for analysis..."
                className="message-input"
                disabled={loading}
                rows="1"
              />
              
              <button
                onClick={sendMessage}
                disabled={loading || (!inputMessage.trim() && selectedFiles.length === 0)}
                className="send-btn"
              >
                {loading ? 'SENDING' : 'SEND'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirmation && (
        <div className="confirmation-overlay">
          <div className="confirmation-modal">
            <h3>Delete Chat</h3>
            <p>Are you sure you want to delete "{chatToDelete?.title}"?</p>
            <div className="confirmation-actions">
              <button
                className="confirm-delete-btn"
                onClick={confirmDeleteChat}
              >
                DELETE
              </button>
              <button
                className="cancel-delete-btn"
                onClick={() => setShowDeleteConfirmation(false)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChat;