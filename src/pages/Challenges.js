import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Clock, Users, TrendingUp, Zap, Trophy, Plus, X } from 'lucide-react';
import './Challenges.css';
import { API_URL } from '../config';

const Challenges = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create challenge form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState('speed');
  const [subject, setSubject] = useState('');
  const [targetMetric, setTargetMetric] = useState('questions_answered');
  const [targetValue, setTargetValue] = useState(10);
  const [timeLimit, setTimeLimit] = useState(60);

  useEffect(() => {
    fetchChallenges();
  }, [filterType]);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/challenges?filter_type=${filterType}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setChallenges(data.challenges);
      }
    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!title || !targetMetric) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/create_challenge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          description,
          challenge_type: challengeType,
          subject: subject || null,
          target_metric: targetMetric,
          target_value: parseFloat(targetValue),
          time_limit_minutes: parseInt(timeLimit)
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchChallenges();
      }
    } catch (error) {
          }
  };

  const handleJoinChallenge = async (challengeId) => {
    try {
      const response = await fetch(`${API_URL}/join_challenge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ challenge_id: challengeId })
      });

      if (response.ok) {
        fetchChallenges();
      }
    } catch (error) {
          }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setChallengeType('speed');
    setSubject('');
    setTargetMetric('questions_answered');
    setTargetValue(10);
    setTimeLimit(60);
  };

  const getChallengeIcon = (type) => {
    const icons = {
      speed: Zap,
      accuracy: Target,
      topic_mastery: Trophy,
      streak: TrendingUp
    };
    return icons[type] || Target;
  };

  const getChallengeTypeColor = (type) => {
    const colors = {
      speed: 'var(--warning)',
      accuracy: 'var(--accent)',
      topic_mastery: 'var(--success)',
      streak: 'var(--accent)'
    };
    return colors[type] || 'var(--accent)';
  };

  const formatTimeRemaining = (endsAt) => {
    if (!endsAt) return 'No time limit';
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end - now;
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  };

  return (
    <div className="challenges-page">
      <header className="challenges-header">
        <div className="challenges-header-left">
          <h1 className="challenges-logo">
            <img src="/logo.svg" alt="" style={{ height: '24px', marginRight: '8px', filter: 'brightness(0) saturate(100%) invert(77%) sepia(48%) saturate(456%) hue-rotate(359deg) brightness(95%) contrast(89%)' }} />
            cerbyl
          </h1>
          <span className="challenges-subtitle">CHALLENGES</span>
        </div>
        <div className="challenges-header-right">
          <button className="challenges-nav-btn" onClick={() => navigate('/social')}>Back to Social</button>
          <button className="challenges-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </header>

      <div className="challenges-container">
        <div className="challenges-welcome">
          <div className="challenges-welcome-left">
            <h2 className="challenges-title">Challenges</h2>
            <p className="challenges-description">Join time-limited challenges and compete with friends</p>
          </div>
          <button className="create-challenge-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            <span>Create Challenge</span>
          </button>
        </div>

        <div className="challenges-filters">
          <button 
            className={`filter-tab ${filterType === 'active' ? 'active' : ''}`}
            onClick={() => setFilterType('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filterType === 'completed' ? 'active' : ''}`}
            onClick={() => setFilterType('completed')}
          >
            Completed
          </button>
          <button 
            className={`filter-tab ${filterType === 'my_challenges' ? 'active' : ''}`}
            onClick={() => setFilterType('my_challenges')}
          >
            My Challenges
          </button>
          <button 
            className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
        </div>

        {loading ? (
          <div className="loading-text">Loading challenges...</div>
        ) : challenges.length === 0 ? (
          <div className="empty-challenges">
            <Target size={48} />
            <p>No challenges found</p>
            <p className="empty-hint">Create a challenge to get started!</p>
          </div>
        ) : (
          <div className="challenges-grid">
            {challenges.map((challenge) => {
              const IconComponent = getChallengeIcon(challenge.challenge_type);
              const typeColor = getChallengeTypeColor(challenge.challenge_type);
              
              return (
                <div key={challenge.id} className="challenge-card">
                  <div className="challenge-header">
                    <div className="challenge-icon" style={{ color: typeColor }}>
                      <IconComponent size={32} />
                    </div>
                    <div className="challenge-status">
                      {challenge.status.toUpperCase()}
                    </div>
                  </div>

                  <div className="challenge-content">
                    <h3 className="challenge-title">{challenge.title}</h3>
                    {challenge.description && (
                      <p className="challenge-description">{challenge.description}</p>
                    )}

                    <div className="challenge-details">
                      <div className="detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value">{challenge.challenge_type.replace('_', ' ')}</span>
                      </div>
                      {challenge.subject && (
                        <div className="detail-row">
                          <span className="detail-label">Subject:</span>
                          <span className="detail-value">{challenge.subject}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Goal:</span>
                        <span className="detail-value">
                          {challenge.target_value} {challenge.target_metric.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Time:</span>
                        <span className="detail-value">{formatTimeRemaining(challenge.ends_at)}</span>
                      </div>
                    </div>

                    <div className="challenge-stats">
                      <div className="stat">
                        <Users size={14} />
                        <span>{challenge.participant_count} participants</span>
                      </div>
                      {challenge.is_participating && (
                        <div className="stat progress">
                          <TrendingUp size={14} />
                          <span>{Math.round(challenge.user_progress)}% complete</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="challenge-footer">
                    {challenge.user_completed ? (
                      <div className="completed-badge">
                        <Trophy size={16} />
                        <span>Completed</span>
                      </div>
                    ) : challenge.is_participating ? (
                      <button 
                        className="challenge-btn continue"
                        onClick={() => navigate(`/challenge/${challenge.id}`)}
                      >
                        Continue Challenge
                      </button>
                    ) : challenge.status === 'active' ? (
                      <button 
                        className="challenge-btn join"
                        onClick={() => handleJoinChallenge(challenge.id)}
                      >
                        Join Challenge
                      </button>
                    ) : (
                      <button className="challenge-btn disabled" disabled>
                        Challenge Ended
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Challenge</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="challenge-form">
              <div className="form-group">
                <label>Challenge Title*</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 100 Questions in an Hour"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your challenge..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Challenge Type*</label>
                <select value={challengeType} onChange={(e) => setChallengeType(e.target.value)}>
                  <option value="speed">Speed Challenge</option>
                  <option value="accuracy">Accuracy Challenge</option>
                  <option value="topic_mastery">Topic Mastery</option>
                  <option value="streak">Streak Challenge</option>
                </select>
              </div>

              <div className="form-group">
                <label>Subject (Optional)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics"
                />
              </div>

              <div className="form-group">
                <label>Target Metric*</label>
                <select value={targetMetric} onChange={(e) => setTargetMetric(e.target.value)}>
                  <option value="questions_answered">Questions Answered</option>
                  <option value="accuracy_percentage">Accuracy Percentage</option>
                  <option value="study_hours">Study Hours</option>
                  <option value="streak_days">Streak Days</option>
                </select>
              </div>

              <div className="form-group">
                <label>Target Value*</label>
                <input
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>Time Limit (minutes)*</label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  min="5"
                  required
                />
              </div>

              <button type="submit" className="submit-challenge-btn">
                <Plus size={16} />
                <span>Create Challenge</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Challenges;