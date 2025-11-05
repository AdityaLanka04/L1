import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Users, Clock, Target, Trophy, X, Check } from 'lucide-react';
import './QuizBattle.css';
import { API_URL } from '../config';
import useWebSocket from './useWebSocket';
import BattleNotification from './BattleNotification.js';

const QuizBattle = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [battles, setBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [pendingBattle, setPendingBattle] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  
  // Create battle form
  const [selectedFriend, setSelectedFriend] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionCount, setQuestionCount] = useState(10);

  // WebSocket connection for real-time notifications
  const { isConnected } = useWebSocket(token, (message) => {
    console.log('Received WebSocket message:', message);
    
    if (message.type === 'battle_challenge') {
      // Show notification popup for new battle challenge
      setPendingBattle(message.battle);
      setShowNotification(true);
      
      // Optional: Also show a browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Quiz Battle Challenge!', {
          body: `${message.battle.challenger.username} challenged you to a ${message.battle.subject} quiz!`,
          icon: message.battle.challenger.picture_url || '/default-avatar.png'
        });
      }
      
      // Also refresh the battles list
      fetchBattles();
    } else if (message.type === 'battle_accepted') {
      // Close notification if it's open
      setShowNotification(false);
      
      // Refresh battles list when someone accepts
      fetchBattles();
      
      // Redirect both challenger and accepter to the battle session
      if (message.battle_id) {
        // Show a notification that battle was accepted
        const opponentName = message.opponent_name || 'Your opponent';
        alert(`${opponentName} accepted the challenge! Starting quiz session...`);
        
        // Redirect to the battle session
        navigate(`/quiz-battle/${message.battle_id}`);
      }
    } else if (message.type === 'battle_declined') {
      // Close notification if it's open
      setShowNotification(false);
      
      // Refresh battles list when someone declines
      fetchBattles();
      
      const opponentName = message.opponent_name || 'Your opponent';
      alert(`${opponentName} declined your battle challenge`);
    }
  });

  useEffect(() => {
    fetchBattles();
    fetchFriends();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [statusFilter]);

  const fetchBattles = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/quiz_battles?status=${statusFilter}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setBattles(data.battles);
      }
    } catch (error) {
      console.error('Error fetching battles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await fetch(`${API_URL}/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handleCreateBattle = async (e) => {
    e.preventDefault();
    if (!selectedFriend || !subject) {
      alert('Please select a friend and enter a subject');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/create_quiz_battle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          opponent_id: parseInt(selectedFriend),
          subject,
          difficulty,
          question_count: questionCount,
          time_limit_seconds: 300
        })
      });

      if (response.ok) {
        setShowCreateModal(false);
        setSelectedFriend('');
        setSubject('');
        fetchBattles();
        alert('Battle challenge sent!');
      }
    } catch (error) {
      console.error('Error creating battle:', error);
    }
  };

  const handleAcceptBattle = async () => {
    if (!pendingBattle) return;

    try {
      const response = await fetch(`${API_URL}/accept_quiz_battle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle_id: pendingBattle.id
        })
      });

      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        // Immediately redirect to the battle
        navigate(`/quiz-battle/${pendingBattle.id}`);
      }
    } catch (error) {
      console.error('Error accepting battle:', error);
      alert('Failed to accept battle');
    }
  };

  const handleDeclineBattle = async () => {
    if (!pendingBattle) return;

    try {
      const response = await fetch(`${API_URL}/decline_quiz_battle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          battle_id: pendingBattle.id
        })
      });

      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        fetchBattles();
      }
    } catch (error) {
      console.error('Error declining battle:', error);
      alert('Failed to decline battle');
    }
  };

  const getBattleStatusColor = (status) => {
    const colors = {
      pending: 'var(--warning)',
      active: 'var(--accent)',
      completed: 'var(--success)',
      expired: 'var(--danger)'
    };
    return colors[status] || 'var(--text-secondary)';
  };

  const getBattleWinner = (battle) => {
    if (battle.status !== 'completed') return null;
    if (battle.your_score > battle.opponent_score) return 'You Won!';
    if (battle.your_score < battle.opponent_score) return 'Opponent Won';
    return 'Draw';
  };

  return (
    <div className="quiz-battle-page">
      <header className="battle-header">
        <div className="battle-header-left">
          <h1 className="battle-logo">cerbyl</h1>
          <span className="battle-subtitle">QUIZ BATTLES</span>
          {isConnected && <span className="ws-status">●</span>}
        </div>
        <div className="battle-header-right">
          <button className="battle-nav-btn" onClick={() => navigate('/social')}>Back to Social</button>
          <button className="battle-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </header>

      <div className="battle-container">
        <div className="battle-welcome">
          <div className="battle-welcome-left">
            <h2 className="battle-title">Quiz Battles</h2>
            <p className="battle-description">Challenge your friends to 1v1 quiz battles</p>
          </div>
          <button className="create-battle-btn" onClick={() => setShowCreateModal(true)}>
            <Swords size={16} />
            <span>Create Battle</span>
          </button>
        </div>

        <div className="battle-filters">
          <button 
            className={`filter-tab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending
          </button>
          <button 
            className={`filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed
          </button>
          <button 
            className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All
          </button>
        </div>

        {loading ? (
          <div className="loading-text">Loading battles...</div>
        ) : battles.length === 0 ? (
          <div className="empty-battles">
            <Swords size={48} />
            <p>No battles found</p>
            <p className="empty-hint">Challenge a friend to start battling!</p>
          </div>
        ) : (
          <div className="battle-list">
            {battles.map((battle) => {
              const winner = getBattleWinner(battle);
              return (
                <div key={battle.id} className="battle-card">
                  <div className="battle-card-header">
                    <div className="battle-status" style={{ color: getBattleStatusColor(battle.status) }}>
                      {battle.status.toUpperCase()}
                    </div>
                    {winner && (
                      <div className={`battle-result ${winner === 'You Won!' ? 'win' : winner === 'Draw' ? 'draw' : 'loss'}`}>
                        {winner}
                      </div>
                    )}
                  </div>

                  <div className="battle-opponent">
                    <div className="opponent-avatar">
                      {battle.opponent.picture_url ? (
                        <img src={battle.opponent.picture_url} alt={battle.opponent.username} />
                      ) : (
                        <div className="opponent-avatar-placeholder">
                          {(battle.opponent.first_name?.[0] || battle.opponent.username[0]).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="opponent-info">
                      <span className="opponent-name">
                        VS {battle.opponent.first_name && battle.opponent.last_name
                          ? `${battle.opponent.first_name} ${battle.opponent.last_name}`
                          : battle.opponent.username}
                      </span>
                      <span className="battle-subject">{battle.subject}</span>
                    </div>
                  </div>

                  <div className="battle-details">
                    <div className="detail-item">
                      <Target size={14} />
                      <span>{battle.difficulty}</span>
                    </div>
                    <div className="detail-item">
                      <Users size={14} />
                      <span>{battle.question_count} questions</span>
                    </div>
                    <div className="detail-item">
                      <Clock size={14} />
                      <span>{Math.floor(battle.time_limit_seconds / 60)} min</span>
                    </div>
                  </div>

                  <div className="battle-scores">
                    <div className="score-box you">
                      <span className="score-label">Your Score</span>
                      <span className="score-value">{battle.your_score}</span>
                      {battle.your_completed && <Check size={16} className="completed-icon" />}
                    </div>
                    <div className="vs-divider">VS</div>
                    <div className="score-box opponent">
                      <span className="score-label">Opponent</span>
                      <span className="score-value">{battle.opponent_score}</span>
                      {battle.opponent_completed && <Check size={16} className="completed-icon" />}
                    </div>
                  </div>

                  {battle.status === 'pending' && !battle.is_challenger && (
                    <button 
                      className="start-battle-btn"
                      onClick={() => navigate(`/quiz-battle/${battle.id}`)}
                    >
                      Accept Challenge
                    </button>
                  )}
                  {battle.status === 'active' && !battle.your_completed && (
                    <button 
                      className="start-battle-btn"
                      onClick={() => navigate(`/quiz-battle/${battle.id}`)}
                    >
                      Continue Battle
                    </button>
                  )}
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
              <h3>Create Quiz Battle</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBattle} className="battle-form">
              <div className="form-group">
                <label>Choose Opponent</label>
                <select
                  value={selectedFriend}
                  onChange={(e) => setSelectedFriend(e.target.value)}
                  required
                >
                  <option value="">Select a friend...</option>
                  {friends.map(friend => (
                    <option key={friend.id} value={friend.id}>
                      {friend.first_name && friend.last_name
                        ? `${friend.first_name} ${friend.last_name}`
                        : friend.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Physics..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Number of Questions</label>
                <input
                  type="number"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  min="5"
                  max="20"
                  required
                />
              </div>

              <button type="submit" className="submit-battle-btn">
                <Swords size={16} />
                <span>Challenge Friend</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {showNotification && pendingBattle && (
        <BattleNotification
          battle={pendingBattle}
          onAccept={handleAcceptBattle}
          onDecline={handleDeclineBattle}
          onClose={() => setShowNotification(false)}
        />
      )}
    </div>
  );
};

export default QuizBattle;