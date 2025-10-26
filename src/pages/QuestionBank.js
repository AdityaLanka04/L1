import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, BookOpen, MessageSquare, FileText } from 'lucide-react';
import './QuestionBank.css';

const QuestionBank = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [userName, setUserName] = useState('');

  // Main tabs
  const [activeTab, setActiveTab] = useState('saved');
  const [generateMode, setGenerateMode] = useState(null); // 'topic', 'chat', 'slides'
  
  // Loading & UI
  const [loading, setLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Saved questions
  const [savedQuestions, setSavedQuestions] = useState([]);

  // Topic-based generation
  const [topicInput, setTopicInput] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  // Chat sessions
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatQuestions, setChatQuestions] = useState([]);

  // Slides
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [slideQuestions, setSlideQuestions] = useState([]);

  useEffect(() => {
    fetchUserProfile();
    loadSavedQuestions();
    loadChatSessions();
    loadUploadedSlides();
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('http://localhost:8001/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserName(data.first_name || 'User');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const loadSavedQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/get_saved_questions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSavedQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Error loading saved questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChatSessions = async () => {
    try {
      setSourceLoading(true);
      const response = await fetch('http://localhost:8001/get_ai_chat_sessions', {
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
  };

  const loadUploadedSlides = async () => {
    try {
      setSourceLoading(true);
      const response = await fetch('http://localhost:8001/get_uploaded_slides', {
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
  };

  const generateTopicQuestions = async () => {
    if (!topicInput.trim()) {
      alert('Please enter a topic');
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
          source_type: 'topic',
          topic: topicInput
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions(data.questions || []);
      } else {
        const errorData = await response.json();
        alert(`Failed to generate questions: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const generateChatQuestions = async (chatId) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source_type: 'chat',
          chat_id: chatId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChatQuestions(data.questions || []);
      } else {
        const errorData = await response.json();
        alert(`Failed to generate questions: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating chat questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  const generateSlideQuestions = async (slideId) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          source_type: 'slides',
          slide_id: slideId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSlideQuestions(data.questions || []);
      } else {
        const errorData = await response.json();
        alert(`Failed to generate questions: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error generating slide questions:', error);
      alert('Error generating questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qb-page">
      <header className="qb-header">
        <div className="qb-header-left">
          <button className="qb-back-btn" onClick={() => navigate('/learning-review-hub')}>
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

      {/* MAIN TABS */}
      <div className="qb-tabs">
        <button 
          className={`qb-tab ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => { setActiveTab('saved'); setGenerateMode(null); }}
        >
          SAVED QUESTIONS
        </button>
        <button 
          className={`qb-tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          GENERATE
        </button>
      </div>

      <div className="qb-content">
        {/* SAVED QUESTIONS TAB */}
        {activeTab === 'saved' && (
          <div className="qb-panel">
            <div className="qb-section-header">
              <h2 className="qb-section-title">Saved Questions</h2>
              <p className="qb-section-subtitle">View all your previously generated questions</p>
            </div>

            {loading ? (
              <div className="qb-loading">
                <Loader size={40} className="qb-spinner" />
                <p>Loading saved questions...</p>
              </div>
            ) : savedQuestions.length === 0 ? (
              <div className="qb-empty">
                <p>No saved questions yet. Generate some questions to get started!</p>
              </div>
            ) : (
              <div className="qb-questions-container">
                <div className="qb-questions-grid">
                  {savedQuestions.map((q, idx) => (
                    <div key={idx} className="qb-question-card">
                      <p className="qb-question-text">{q.question}</p>
                      {q.options && (
                        <div className="qb-options">
                          {q.options.map((opt, i) => (
                            <div key={i} className="qb-option">{opt}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GENERATE TAB */}
        {activeTab === 'generate' && (
          <div className="qb-panel">
            <div className="qb-section-header">
              <h2 className="qb-section-title">Generate Questions</h2>
              <p className="qb-section-subtitle">Create new practice questions from various sources</p>
            </div>

            {/* GENERATE MODE SELECTOR */}
            {!generateMode ? (
              <div className="qb-mode-selector">
                <button 
                  className="qb-mode-btn"
                  onClick={() => setGenerateMode('topic')}
                >
                  <BookOpen size={24} />
                  <span>On Your Own</span>
                  <p>Create questions from any topic</p>
                </button>
                <button 
                  className="qb-mode-btn"
                  onClick={() => setGenerateMode('chat')}
                >
                  <MessageSquare size={24} />
                  <span>From Chats</span>
                  <p>Generate from AI chat history</p>
                </button>
                <button 
                  className="qb-mode-btn"
                  onClick={() => setGenerateMode('slides')}
                >
                  <FileText size={24} />
                  <span>From Slides</span>
                  <p>Create from uploaded slides</p>
                </button>
              </div>
            ) : (
              <div className="qb-back-to-modes">
                <button onClick={() => setGenerateMode(null)} className="qb-back-mode-btn">
                  ← Back to Options
                </button>
              </div>
            )}

            {/* TOPIC MODE */}
            {generateMode === 'topic' && (
              <div className="qb-generate-section">
                <div className="qb-form-group">
                  <label className="qb-label">Enter Topic</label>
                  <input
                    type="text"
                    className="qb-input"
                    placeholder="e.g., Photosynthesis, Calculus, World War II..."
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    disabled={loading}
                  />
                  <button 
                    className="qb-button qb-button-primary"
                    onClick={generateTopicQuestions}
                    disabled={loading || !topicInput.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader size={16} className="qb-spinner" />
                        Generating...
                      </>
                    ) : (
                      'Generate Questions'
                    )}
                  </button>
                </div>

                {generatedQuestions.length > 0 && (
                  <div className="qb-questions-container">
                    <h3 className="qb-list-title">Generated Questions ({generatedQuestions.length})</h3>
                    <div className="qb-questions-grid">
                      {generatedQuestions.map((q, idx) => (
                        <div key={idx} className="qb-question-card">
                          <p className="qb-question-text">{q.question}</p>
                          {q.options && (
                            <div className="qb-options">
                              {q.options.map((opt, i) => (
                                <div key={i} className="qb-option">{opt}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHAT MODE */}
            {generateMode === 'chat' && (
              <div className="qb-generate-section">
                {sourceLoading ? (
                  <div className="qb-loading">
                    <Loader size={40} className="qb-spinner" />
                    <p>Loading chat sessions...</p>
                  </div>
                ) : chatSessions.length === 0 ? (
                  <div className="qb-empty">
                    <p>No chat sessions found. Start a chat to create questions.</p>
                  </div>
                ) : (
                  <>
                    <div className="qb-selection-grid">
                      {chatSessions.map(chat => (
                        <div 
                          key={chat.id}
                          className={`qb-selection-card ${selectedChat?.id === chat.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedChat(chat);
                            generateChatQuestions(chat.id);
                          }}
                        >
                          <div className="qb-selection-icon">
                            <MessageSquare size={24} />
                          </div>
                          <p className="qb-selection-title">{chat.title || 'Untitled Chat'}</p>
                          <p className="qb-selection-meta">{chat.message_count || 0} messages</p>
                        </div>
                      ))}
                    </div>

                    {chatQuestions.length > 0 && (
                      <div className="qb-questions-container">
                        <h3 className="qb-list-title">Generated Questions from Chat ({chatQuestions.length})</h3>
                        <div className="qb-questions-grid">
                          {chatQuestions.map((q, idx) => (
                            <div key={idx} className="qb-question-card">
                              <p className="qb-question-text">{q.question}</p>
                              {q.options && (
                                <div className="qb-options">
                                  {q.options.map((opt, i) => (
                                    <div key={i} className="qb-option">{opt}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SLIDES MODE */}
            {generateMode === 'slides' && (
              <div className="qb-generate-section">
                {sourceLoading ? (
                  <div className="qb-loading">
                    <Loader size={40} className="qb-spinner" />
                    <p>Loading slides...</p>
                  </div>
                ) : uploadedSlides.length === 0 ? (
                  <div className="qb-empty">
                    <p>No slides uploaded yet. Upload slides to create questions.</p>
                  </div>
                ) : (
                  <>
                    <div className="qb-selection-grid">
                      {uploadedSlides.map(slide => (
                        <div 
                          key={slide.id}
                          className={`qb-selection-card ${selectedSlide?.id === slide.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedSlide(slide);
                            generateSlideQuestions(slide.id);
                          }}
                        >
                          <div className="qb-selection-icon">
                            <FileText size={24} />
                          </div>
                          <p className="qb-selection-title">{slide.filename || 'Untitled Slides'}</p>
                          <p className="qb-selection-meta">{slide.slide_count || 0} slides</p>
                        </div>
                      ))}
                    </div>

                    {slideQuestions.length > 0 && (
                      <div className="qb-questions-container">
                        <h3 className="qb-list-title">Generated Questions from Slides ({slideQuestions.length})</h3>
                        <div className="qb-questions-grid">
                          {slideQuestions.map((q, idx) => (
                            <div key={idx} className="qb-question-card">
                              <p className="qb-question-text">{q.question}</p>
                              {q.options && (
                                <div className="qb-options">
                                  {q.options.map((opt, i) => (
                                    <div key={i} className="qb-option">{opt}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionBank;