import React, { useState, useEffect } from 'react';
import './LearningReview.css';

const LearningReview = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [uploadedSlides, setUploadedSlides] = useState([]);
  const [learningReviews, setLearningReviews] = useState([]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [activeReview, setActiveReview] = useState(null);
  const [activeQuestionSet, setActiveQuestionSet] = useState(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [reviewDetails, setReviewDetails] = useState(null);
  const [questionResults, setQuestionResults] = useState(null);
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const navigate = (path) => {
    window.location.href = path;
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
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (userName) {
      loadChatSessions();
      loadUploadedSlides();
      loadLearningReviews();
      loadGeneratedQuestions();
    }
  }, [userName]);

  const loadChatSessions = async () => {
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
  };

  const loadUploadedSlides = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_uploaded_slides?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUploadedSlides(data.slides || []);
      }
    } catch (error) {
      console.error('Error loading slides:', error);
    }
  };

  const loadLearningReviews = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_learning_reviews?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLearningReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Error loading learning reviews:', error);
    }
  };

  const loadGeneratedQuestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_question_sets?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedQuestions(data.question_sets || []);
      }
    } catch (error) {
      console.error('Error loading question sets:', error);
    }
  };

  const handleSlideUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('user_id', userName);
    
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/upload_slides', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          loadUploadedSlides();
          alert(`Successfully uploaded ${data.uploaded_count} slide(s)`);
        }, 500);
      } else {
        const errorData = await response.json();
        alert(`Error uploading slides: ${errorData.detail}`);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('Error uploading slides:', error);
      alert('Failed to upload slides');
      setIsUploading(false);
    }
  };

  const createLearningReview = async () => {
    if (selectedSessions.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one chat session or slide');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/create_learning_review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          chat_session_ids: selectedSessions.map(s => s.id),
          slide_ids: selectedSlides.map(s => s.id),
          review_title: `Learning Review - ${new Date().toLocaleDateString()}`,
          review_type: 'comprehensive'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveReview(data);
        setActiveTab('active');
        loadLearningReviews();
        setSelectedSessions([]);
        setSelectedSlides([]);
      } else {
        const errorData = await response.json();
        alert(`Error creating review: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error creating learning review:', error);
      alert('Failed to create learning review');
    } finally {
      setLoading(false);
    }
  };

  const generateQuestions = async () => {
    if (selectedSessions.length === 0 && selectedSlides.length === 0) {
      alert('Please select at least one chat session or slide');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/generate_questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          chat_session_ids: selectedSessions.map(s => s.id),
          slide_ids: selectedSlides.map(s => s.id),
          question_count: 10,
          difficulty_mix: {
            easy: 3,
            medium: 5,
            hard: 2
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setActiveQuestionSet(data);
        setActiveTab('questions');
        loadGeneratedQuestions();
        setSelectedSessions([]);
        setSelectedSlides([]);
        setQuestionAnswers({});
      } else {
        const errorData = await response.json();
        alert(`Error generating questions: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const submitQuestionAnswers = async () => {
    if (!activeQuestionSet || Object.keys(questionAnswers).length === 0) {
      alert('Please answer at least one question');
      return;
    }

    // ✅ CRITICAL: Filter out questions that weren't answered AT ALL
    const validAnswers = {};
    let hasAtLeastOneAnswer = false;

    activeQuestionSet.questions.forEach(question => {
      const answer = questionAnswers[question.id];
      
      // Only include if answer exists AND is not empty
      if (answer !== undefined && answer !== null && answer !== '') {
        if (typeof answer === 'string' && answer.trim() !== '') {
          validAnswers[question.id] = answer.trim();
          hasAtLeastOneAnswer = true;
        } else if (typeof answer !== 'string') {
          validAnswers[question.id] = answer;
          hasAtLeastOneAnswer = true;
        }
      }
    });

    if (!hasAtLeastOneAnswer) {
      alert('Please answer at least one question before submitting');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/submit_question_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question_set_id: activeQuestionSet.id || activeQuestionSet.question_set_id,
          answers: validAnswers
        })
      });

      if (response.ok) {
        const data = await response.json();
        setQuestionResults(data);
        loadGeneratedQuestions();
      } else {
        const errorData = await response.json();
        alert(`Error submitting answers: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      alert('Failed to submit answers');
    } finally {
      setLoading(false);
    }
  };

  const submitReviewResponse = async () => {
    if (!reviewResponse.trim() || !activeReview) {
      alert('Please write your response');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/submit_learning_response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          review_id: activeReview.id || activeReview.review_id,
          user_response: reviewResponse,
          attempt_number: (activeReview.current_attempt || 0) + 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReviewDetails(data);
        setReviewResponse('');
        setShowHints(false);
        setHints([]);
        loadLearningReviews();
      } else {
        const errorData = await response.json();
        alert(`Error submitting response: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestionSetWithQuestions = async (questionSetId) => {
  setLoading(true);
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8001/get_question_set_details/${questionSetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      setActiveQuestionSet(data);
      setActiveTab('questions');
      setQuestionAnswers({});
      setQuestionResults(null);
    } else {
      alert('Error loading questions');
    }
  } catch (error) {
    console.error('Error loading question set:', error);
    alert('Failed to load questions');
  } finally {
    setLoading(false);
  }
};

  const getHints = async (missingPoints) => {
    if (!activeReview || !missingPoints || missingPoints.length === 0) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/get_learning_hints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          review_id: activeReview.id || activeReview.review_id,
          missing_points: missingPoints.slice(0, 3)
        })
      });

      if (response.ok) {
        const data = await response.json();
        setHints(data.hints || []);
        setShowHints(true);
      }
    } catch (error) {
      console.error('Error getting hints:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSlide = async (slideId) => {
    if (!window.confirm('Are you sure you want to delete this slide?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_slide/${slideId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadUploadedSlides();
      } else {
        const errorData = await response.json();
        alert(`Error deleting slide: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Failed to delete slide');
    }
  };

  const deleteQuestionSet = async (questionSetId) => {
    if (!window.confirm('Are you sure you want to delete this question set? This cannot be undone.')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_question_set/${questionSetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        loadGeneratedQuestions();
        alert('Question set deleted successfully');
      } else {
        const errorData = await response.json();
        alert(`Error deleting question set: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error deleting question set:', error);
      alert('Failed to delete question set');
    } finally {
      setLoading(false);
    }
  };

  const toggleSessionSelection = (session) => {
    setSelectedSessions(prev => {
      const isSelected = prev.find(s => s.id === session.id);
      if (isSelected) {
        return prev.filter(s => s.id !== session.id);
      } else {
        return [...prev, session];
      }
    });
  };

  const toggleSlideSelection = (slide) => {
    setSelectedSlides(prev => {
      const isSelected = prev.find(s => s.id === slide.id);
      if (isSelected) {
        return prev.filter(s => s.id !== slide.id);
      } else {
        return [...prev, slide];
      }
    });
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

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FF9800';
    return '#F44336';
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#D7B38C';
    }
  };

  return (
    <div className="learning-review-page">
      <header className="learning-header">
        <div className="header-left">
          <h1 
            className="learning-title clickable-logo" 
            onClick={handleLogoClick}
            title="Go to Dashboard"
          >
            brainwave
          </h1>
          <span className="page-subtitle">Learning Review System</span>
        </div>

        <div className="user-info">
          {userProfile?.picture && (
            <img
              src={userProfile.picture}
              alt="Profile"
              className="profile-picture"
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          )}
        </div>
        
        <div className="header-right">
          <button className="nav-btn" onClick={goToChat}>
            AI Chat
          </button>
          <button className="nav-btn" onClick={goToDashboard}>
            Dashboard
          </button>
          
          <button className="logout-btn" onClick={handleLogout}>
            LOGOUT
          </button>
        </div>
      </header>

      <div className="learning-content">
        <div className="tab-navigation">
          <button 
            className={`tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Review
          </button>
          <button 
            className={`tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
            onClick={() => setActiveTab('slides')}
          >
            Manage Slides
          </button>
          <button 
            className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            My Reviews
          </button>
          <button 
            className={`tab-btn ${activeTab === 'question-library' ? 'active' : ''}`}
            onClick={() => setActiveTab('question-library')}
          >
            Question Library
          </button>
          {activeReview && (
            <button 
              className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active Review
            </button>
          )}
          {activeQuestionSet && (
            <button 
              className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              Active Questions
            </button>
          )}
        </div>

        {activeTab === 'create' && (
          <div className="create-review-section">
            <div className="section-header">
              <h2>Create Learning Materials</h2>
              <p>Select chat sessions and slides to create reviews or generate questions</p>
            </div>

            <div className="source-selection-container">
              <div className="source-section">
                <h3>Chat Sessions ({selectedSessions.length} selected)</h3>
                {chatSessions.length === 0 ? (
                  <div className="mini-empty-state">
                    <p>No chat sessions available</p>
                    <button className="cta-btn" onClick={goToChat}>
                      Start Chatting
                    </button>
                  </div>
                ) : (
                  <div className="sessions-grid">
                    {chatSessions.map((session) => {
                      const isSelected = selectedSessions.find(s => s.id === session.id);
                      return (
                        <div
                          key={session.id}
                          className={`session-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSessionSelection(session)}
                        >
                          <div className="session-info">
                            <div className="session-title">{session.title}</div>
                            <div className="session-date">
                              {formatDate(session.created_at)}
                            </div>
                          </div>
                          <div className="selection-indicator">
                            {isSelected ? '✓' : '+'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="source-section">
                <h3>Uploaded Slides ({selectedSlides.length} selected)</h3>
                {uploadedSlides.length === 0 ? (
                  <div className="mini-empty-state">
                    <p>No slides uploaded yet</p>
                    <button className="cta-btn" onClick={() => setActiveTab('slides')}>
                      Upload Slides
                    </button>
                  </div>
                ) : (
                  <div className="sessions-grid">
                    {uploadedSlides.map((slide) => {
                      const isSelected = selectedSlides.find(s => s.id === slide.id);
                      return (
                        <div
                          key={slide.id}
                          className={`session-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleSlideSelection(slide)}
                        >
                          <div className="session-info">
                            <div className="session-title">{slide.filename}</div>
                            <div className="session-date">
                              {formatDate(slide.uploaded_at)}
                            </div>
                            <div className="slide-meta">
                              {slide.page_count} pages
                            </div>
                          </div>
                          <div className="selection-indicator">
                            {isSelected ? '✓' : '+'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {(selectedSessions.length > 0 || selectedSlides.length > 0) && (
              <div className="action-buttons">
                <button 
                  className="create-btn primary"
                  onClick={createLearningReview}
                  disabled={loading}
                >
                  {loading ? 'Creating Review...' : 'Create Learning Review'}
                </button>
                <button 
                  className="create-btn secondary"
                  onClick={generateQuestions}
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate Questions'}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'slides' && (
          <div className="slides-management-section">
            <div className="section-header">
              <h2>Manage Slides</h2>
              <p>Upload and manage your presentation slides</p>
            </div>

            <div className="upload-section">
              <div className="upload-box">
                <input
                  type="file"
                  id="slide-upload"
                  accept=".pdf,.ppt,.pptx"
                  multiple
                  onChange={handleSlideUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="slide-upload" className="upload-label">
                  <div className="upload-icon"></div>
                  <h3>Upload Slides</h3>
                  <p>Supported formats: PDF, PPT, PPTX</p>
                  <button className="cta-btn" onClick={() => document.getElementById('slide-upload').click()}>
                    Choose Files
                  </button>
                </label>
              </div>

              {isUploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <p>Uploading slides...</p>
                </div>
              )}
            </div>

            {uploadedSlides.length > 0 && (
              <div className="slides-library">
                <h3>Your Slides ({uploadedSlides.length})</h3>
                <div className="slides-grid">
                  {uploadedSlides.map((slide) => (
                    <div key={slide.id} className="slide-card">
                      <div className="slide-header">
                        <div className="slide-title">{slide.filename}</div>
                        <button 
                          className="delete-slide-btn"
                          onClick={() => deleteSlide(slide.id)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="slide-info">
                        <div className="slide-meta">
                          <span>{slide.page_count} pages</span>
                          <span>{(slide.file_size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <div className="slide-date">{formatDate(slide.uploaded_at)}</div>
                      </div>
                      {slide.preview_url && (
                        <div className="slide-preview">
                          <img src={slide.preview_url} alt="Slide preview" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-section">
            <div className="section-header">
              <h2>My Learning Reviews</h2>
              <p>Track your learning progress and review history</p>
            </div>

            {learningReviews.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>No Learning Reviews Yet</h3>
                <p>Create your first learning review to test your knowledge retention</p>
                <button className="cta-btn" onClick={() => setActiveTab('create')}>
                  Create Review
                </button>
              </div>
            ) : (
              <div className="reviews-grid">
                {learningReviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-header">
                      <div className="review-title">{review.title}</div>
                      <div className={`review-status ${review.status}`}>
                        {review.status}
                      </div>
                    </div>
                    
                    <div className="review-stats">
                      <div className="stat">
                        <span className="stat-label">Best Score</span>
                        <span 
                          className="stat-value"
                          style={{ color: getScoreColor(review.best_score) }}
                        >
                          {review.best_score}%
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Attempts</span>
                        <span className="stat-value">{review.attempt_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Points</span>
                        <span className="stat-value">{review.total_points}</span>
                      </div>
                    </div>

                    <div className="review-sources">
                      {review.session_titles && review.session_titles.length > 0 && (
                        <div className="source-group">
                          <div className="source-label">Chat Sessions:</div>
                          {review.session_titles.map((title, index) => (
                            <span key={index} className="session-tag">
                              {title}
                            </span>
                          ))}
                        </div>
                      )}
                      {review.slide_filenames && review.slide_filenames.length > 0 && (
                        <div className="source-group">
                          <div className="source-label">Slides:</div>
                          {review.slide_filenames.map((filename, index) => (
                            <span key={index} className="session-tag slide-tag">
                              {filename}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="review-footer">
                      <div className="review-date">
                        Created: {formatDate(review.created_at)}
                      </div>
                      {review.can_continue && (
                        <button 
                          className="continue-btn"
                          onClick={() => {
                            setActiveReview(review);
                            setActiveTab('active');
                          }}
                        >
                          Continue
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'question-library' && (
          <div className="questions-library-section">
            <div className="section-header">
              <h2>Question Library</h2>
              <p>Your generated question sets and practice history</p>
            </div>

            {generatedQuestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>No Question Sets Yet</h3>
                <p>Generate questions from your chat sessions and slides</p>
                <button className="cta-btn" onClick={() => setActiveTab('create')}>
                  Generate Questions
                </button>
              </div>
            ) : (
              <div className="questions-grid">
                {generatedQuestions.map((questionSet) => (
                  <div key={questionSet.id} className="question-set-card">
                    <div className="question-set-header">
                      <div className="question-set-title">{questionSet.title}</div>
                      <div className="question-set-actions">
                        <div className={`question-set-status ${questionSet.status}`}>
                          {questionSet.status}
                        </div>
                        <button 
                          className="delete-question-set-btn"
                          onClick={() => deleteQuestionSet(questionSet.id)}
                          title="Delete question set"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    
                    <div className="question-set-stats">
                      <div className="stat">
                        <span className="stat-label">Questions</span>
                        <span className="stat-value">{questionSet.question_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Best Score</span>
                        <span 
                          className="stat-value"
                          style={{ color: getScoreColor(questionSet.best_score) }}
                        >
                          {questionSet.best_score}%
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Attempts</span>
                        <span className="stat-value">{questionSet.attempt_count}</span>
                      </div>
                    </div>

                    <div className="difficulty-breakdown">
                      <div className="difficulty-item">
                        <span className="difficulty-label" style={{ color: getDifficultyColor('easy') }}>
                          Easy
                        </span>
                        <span className="difficulty-count">{questionSet.easy_count || 0}</span>
                      </div>
                      <div className="difficulty-item">
                        <span className="difficulty-label" style={{ color: getDifficultyColor('medium') }}>
                          Medium
                        </span>
                        <span className="difficulty-count">{questionSet.medium_count || 0}</span>
                      </div>
                      <div className="difficulty-item">
                        <span className="difficulty-label" style={{ color: getDifficultyColor('hard') }}>
                          Hard
                        </span>
                        <span className="difficulty-count">{questionSet.hard_count || 0}</span>
                      </div>
                    </div>

                    <div className="question-set-footer">
                      <div className="question-set-date">
                        Created: {formatDate(questionSet.created_at)}
                      </div>
                      {questionSet.can_practice && (
                        <button 
                          className="continue-btn"
                          onClick={() => loadQuestionSetWithQuestions(questionSet.id)}
                        >
                          Practice
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && activeQuestionSet && (
          <div className="active-questions-section">
            <div className="questions-header">
              <h2>{activeQuestionSet.title}</h2>
              <div className="questions-meta">
                <span>{activeQuestionSet.question_count} Questions</span>
                <span>Mixed Difficulty</span>
              </div>
            </div>

            {!questionResults ? (
              <div className="questions-container">
                {activeQuestionSet.questions && activeQuestionSet.questions.map((question, index) => (
                  <div key={question.id} className="question-item">
                    <div className="question-header">
                      <div className="question-number">Question {index + 1}</div>
                      <div 
                        className="question-difficulty"
                        style={{ color: getDifficultyColor(question.difficulty) }}
                      >
                        {question.difficulty.toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="question-text">{question.question_text}</div>
                    
                    {question.question_type === 'multiple_choice' && (
                      <div className="question-options">
                        {question.options.map((option, optIndex) => (
                          <label key={optIndex} className="option-label">
                            <input
                              type="radio"
                              name={`question-${question.id}`}
                              value={option}
                              checked={questionAnswers[question.id] === option}
                              onChange={(e) => setQuestionAnswers({
                                ...questionAnswers,
                                [question.id]: e.target.value
                              })}
                            />
                            <span className="option-text">{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {question.question_type === 'short_answer' && (
                      <textarea
                        className="answer-textarea"
                        placeholder="Enter your answer..."
                        value={questionAnswers[question.id] || ''}
                        onChange={(e) => setQuestionAnswers({
                          ...questionAnswers,
                          [question.id]: e.target.value
                        })}
                        rows={4}
                      />
                    )}
                    
                    {question.question_type === 'true_false' && (
                      <div className="question-options">
                        <label className="option-label">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value="true"
                            checked={questionAnswers[question.id] === 'true'}
                            onChange={(e) => setQuestionAnswers({
                              ...questionAnswers,
                              [question.id]: e.target.value
                            })}
                          />
                          <span className="option-text">True</span>
                        </label>
                        <label className="option-label">
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value="false"
                            checked={questionAnswers[question.id] === 'false'}
                            onChange={(e) => setQuestionAnswers({
                              ...questionAnswers,
                              [question.id]: e.target.value
                            })}
                          />
                          <span className="option-text">False</span>
                        </label>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="questions-actions">
                  <button 
                    className="submit-btn"
                    onClick={submitQuestionAnswers}
                    disabled={loading || Object.keys(questionAnswers).length === 0}
                  >
                    {loading ? 'Submitting...' : 'Submit Answers'}
                  </button>
                  <div className="answer-progress">
                    Answered: {Object.keys(questionAnswers).filter(key => {
                      const answer = questionAnswers[key];
                      return answer && (typeof answer === 'string' ? answer.trim() !== '' : true);
                    }).length} / {activeQuestionSet.questions?.length || 0}
                  </div>
                </div>
              </div>
            ) : (
              <div className="question-results">
                <div className="results-header">
                  <h3>Results</h3>
                  <div 
                    className="completeness-score"
                    style={{ color: getScoreColor(questionResults.score) }}
                  >
                    {questionResults.score}% Score
                  </div>
                </div>

                <div className="results-summary">
                  <div className="summary-stat">
                    <span className="summary-label">Correct</span>
                    <span className="summary-value correct">{questionResults.correct_count}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Incorrect</span>
                    <span className="summary-value incorrect">{questionResults.incorrect_count}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="summary-label">Total</span>
                    <span className="summary-value">{questionResults.total_questions}</span>
                  </div>
                </div>

                <div className="detailed-results">
                  {questionResults.question_results && questionResults.question_results.map((result, index) => (
                    <div key={result.question_id} className={`result-item ${result.is_correct ? 'correct' : 'incorrect'}`}>
                      <div className="result-header">
                        <div className="result-number">Question {index + 1}</div>
                        <div className={`result-status ${result.is_correct ? 'correct' : 'incorrect'}`}>
                          {result.is_correct ? '✓ Correct' : '✗ Incorrect'}
                        </div>
                      </div>
                      
                      <div className="result-question">{result.question_text}</div>
                      
                      <div className="result-answers">
                        <div className="answer-item">
                          <span className="answer-label">Your Answer:</span>
                          <span className="answer-value">{result.user_answer || 'No answer provided'}</span>
                        </div>
                        {!result.is_correct && (
                          <div className="answer-item">
                            <span className="answer-label">Correct Answer:</span>
                            <span className="answer-value correct">{result.correct_answer}</span>
                          </div>
                        )}
                      </div>
                      
                      {result.explanation && (
                        <div className="result-explanation">
                          <strong>Explanation:</strong> {result.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {questionResults.feedback && (
                  <div className="ai-feedback">
                    <h4>AI Feedback</h4>
                    <p>{questionResults.feedback}</p>
                  </div>
                )}

                <div className="continue-section">
                  <button 
                    className="continue-btn"
                    onClick={() => {
                      setQuestionResults(null);
                      setQuestionAnswers({});
                    }}
                  >
                    Try Again
                  </button>
                  <button 
                    className="continue-btn secondary"
                    onClick={() => setActiveTab('question-library')}
                  >
                    Back to Library
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'active' && activeReview && (
          <div className="active-review-section">
            <div className="review-instructions">
              <h2>{activeReview.title}</h2>
              <div className="instructions-box">
                <h3>Instructions</h3>
                <ul>
                  <li>Write down everything you remember from the selected materials</li>
                  <li>Include key concepts, definitions, and important insights</li>
                  <li>Cover content from both chat sessions and slides if applicable</li>
                  <li>Submit your response to get feedback on missing points</li>
                  <li>Use hints if you need help remembering specific topics</li>
                </ul>
              </div>
              
              <div className="review-sources-info">
                {activeReview.session_titles && activeReview.session_titles.length > 0 && (
                  <div className="source-group">
                    <h4>Chat Sessions Included:</h4>
                    <div className="session-tags">
                      {activeReview.session_titles.map((title, index) => (
                        <span key={index} className="session-tag">
                          {title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {activeReview.slide_filenames && activeReview.slide_filenames.length > 0 && (
                  <div className="source-group">
                    <h4>Slides Included:</h4>
                    <div className="session-tags">
                      {activeReview.slide_filenames.map((filename, index) => (
                        <span key={index} className="session-tag slide-tag">
                          {filename}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="response-section">
              <h3>Your Response</h3>
              <textarea
                value={reviewResponse}
                onChange={(e) => setReviewResponse(e.target.value)}
                placeholder="Write everything you remember from the chat sessions and slides..."
                className="response-textarea"
                rows={15}
              />
              
              <div className="response-actions">
                <button 
                  className="submit-btn"
                  onClick={submitReviewResponse}
                  disabled={loading || !reviewResponse.trim()}
                >
                  {loading ? 'Analyzing...' : 'Submit Response'}
                </button>
              </div>
            </div>

            {reviewDetails && (
              <div className="review-results">
                <div className="results-header">
                  <h3>Review Results</h3>
                  <div 
                    className="completeness-score"
                    style={{ color: getScoreColor(reviewDetails.completeness_percentage) }}
                  >
                    {reviewDetails.completeness_percentage}% Complete
                  </div>
                </div>

                <div className="results-content">
                  <div className="covered-points">
                    <h4>Points You Covered ({reviewDetails.covered_points?.length || 0})</h4>
                    {reviewDetails.covered_points?.map((point, index) => (
                      <div key={index} className="point-item covered">
                        ✓ {point}
                      </div>
                    ))}
                  </div>

                  {reviewDetails.missing_points && reviewDetails.missing_points.length > 0 && (
                    <div className="missing-points">
                      <h4>Missing Points ({reviewDetails.missing_points.length})</h4>
                      {reviewDetails.missing_points.map((point, index) => (
                        <div key={index} className="point-item missing">
                          ○ {point}
                        </div>
                      ))}
                      
                      <button 
                        className="hints-btn"
                        onClick={() => getHints(reviewDetails.missing_points)}
                        disabled={loading}
                      >
                        {loading ? 'Getting Hints...' : 'Get Hints'}
                      </button>
                    </div>
                  )}

                  {reviewDetails.feedback && (
                    <div className="ai-feedback">
                      <h4>AI Feedback</h4>
                      <p>{reviewDetails.feedback}</p>
                      {reviewDetails.next_steps && (
                        <div className="next-steps">
                          <strong>Next Steps:</strong> {reviewDetails.next_steps}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!reviewDetails.is_complete && reviewDetails.can_continue && (
                  <div className="continue-section">
                    <p>You can continue improving your response by writing more details about the missing points.</p>
                    <button 
                      className="continue-btn"
                      onClick={() => {
                        setReviewDetails(null);
                        setShowHints(false);
                      }}
                    >
                      Continue Writing
                    </button>
                  </div>
                )}

                {reviewDetails.is_complete && (
                  <div className="completion-message">
                    <h3>🎉 Review Complete!</h3>
                    <p>You have successfully demonstrated comprehensive understanding of the material.</p>
                  </div>
                )}
              </div>
            )}

            {showHints && hints.length > 0 && (
              <div className="hints-section">
                <div className="hints-header">
                  <h3>💡 Learning Hints</h3>
                  <button 
                    className="close-hints-btn"
                    onClick={() => setShowHints(false)}
                  >
                    ×
                  </button>
                </div>
                
                <div className="hints-content">
                  {hints.map((hint, index) => (
                    <div key={index} className="hint-item">
                      <div className="hint-topic">{hint.missing_point}</div>
                      <div className="hint-text">{hint.hint}</div>
                      {hint.memory_trigger && (
                        <div className="hint-trigger">
                          <strong>Memory Trigger:</strong> {hint.memory_trigger}
                        </div>
                      )}
                      {hint.guiding_question && (
                        <div className="hint-question">
                          <strong>Think About:</strong> {hint.guiding_question}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningReview;