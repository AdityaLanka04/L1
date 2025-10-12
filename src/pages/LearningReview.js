import React, { useState, useEffect } from 'react';
import './LearningReview.css';

const LearningReview = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [learningReviews, setLearningReviews] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [activeReview, setActiveReview] = useState(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('create'); // create, reviews, active
  const [reviewDetails, setReviewDetails] = useState(null);
  const [hints, setHints] = useState([]);
  const [showHints, setShowHints] = useState(false);

  // Navigation functions - you'll need to adapt these to your routing system
  const navigate = (path) => {
    // Replace with your navigation logic
    window.location.href = path;
  };

  // Load initial data
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
      loadLearningReviews();
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

  const createLearningReview = async () => {
    if (selectedSessions.length === 0) {
      alert('Please select at least one chat session');
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
          review_id: activeReview.review_id,
          user_response: reviewResponse,
          attempt_number: (activeReview.current_attempt || 0) + 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReviewDetails(data);
        setReviewResponse('');
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
          review_id: activeReview.review_id,
          missing_points: missingPoints.slice(0, 3) // Limit to 3 hints
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
            className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            My Reviews
          </button>
          {activeReview && (
            <button 
              className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active Review
            </button>
          )}
        </div>

        {activeTab === 'create' && (
          <div className="create-review-section">
            <div className="section-header">
              <h2>Create Learning Review</h2>
              <p>Select chat sessions to create a comprehensive learning review</p>
            </div>

            {chatSessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">CHAT</div>
                <h3>No Chat Sessions Found</h3>
                <p>Start chatting with the AI to create learning materials</p>
                <button className="cta-btn" onClick={goToChat}>
                  Start Chatting
                </button>
              </div>
            ) : (
              <div className="session-selection">
                <div className="selection-header">
                  <h3>Select Chat Sessions ({selectedSessions.length} selected)</h3>
                  {selectedSessions.length > 0 && (
                    <button 
                      className="create-btn"
                      onClick={createLearningReview}
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : 'Create Review'}
                    </button>
                  )}
                </div>

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
                <div className="empty-icon">REVIEW</div>
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

                    <div className="review-sessions">
                      <div className="sessions-label">Sessions:</div>
                      {review.session_titles.map((title, index) => (
                        <span key={index} className="session-tag">
                          {title}
                        </span>
                      ))}
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

        {activeTab === 'active' && activeReview && (
          <div className="active-review-section">
            <div className="review-instructions">
              <h2>{activeReview.title}</h2>
              <div className="instructions-box">
                <h3>Instructions</h3>
                <ul>
                  <li>Write down everything you remember from the selected chat sessions</li>
                  <li>Include key concepts, definitions, and important insights</li>
                  <li>Don't worry about perfect organization - focus on content</li>
                  <li>Submit your response to get feedback on missing points</li>
                  <li>Use hints if you need help remembering specific topics</li>
                </ul>
              </div>
              
              {activeReview.session_titles && (
                <div className="review-sessions-info">
                  <h4>Sessions Included:</h4>
                  <div className="session-tags">
                    {activeReview.session_titles.map((title, index) => (
                      <span key={index} className="session-tag">
                        {title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="response-section">
              <h3>Your Response</h3>
              <textarea
                value={reviewResponse}
                onChange={(e) => setReviewResponse(e.target.value)}
                placeholder="Write everything you remember from the chat sessions..."
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
                    <h4>✓ Points You Covered ({reviewDetails.covered_points?.length || 0})</h4>
                    {reviewDetails.covered_points?.map((point, index) => (
                      <div key={index} className="point-item covered">
                        {point}
                      </div>
                    ))}
                  </div>

                  {reviewDetails.missing_points && reviewDetails.missing_points.length > 0 && (
                    <div className="missing-points">
                      <h4>⚠ Missing Points ({reviewDetails.missing_points.length})</h4>
                      {reviewDetails.missing_points.map((point, index) => (
                        <div key={index} className="point-item missing">
                          {point}
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
                    <p>You've successfully demonstrated comprehensive understanding of the material.</p>
                  </div>
                )}
              </div>
            )}

            {showHints && hints.length > 0 && (
              <div className="hints-section">
                <div className="hints-header">
                  <h3>Learning Hints</h3>
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