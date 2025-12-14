import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Users, Clock, Target, X, Check } from 'lucide-react';
import './QuizBattle.css';
import { API_URL } from '../config';
import useSharedWebSocket from '../hooks/useSharedWebSocket';
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
  const [selectedFriend, setSelectedFriend] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionCount, setQuestionCount] = useState(10);

  const { isConnected } = useSharedWebSocket(token, (message) => {
    if (message.type === 'battle_answer_submitted' || message.type === 'battle_opponent_completed') return;
    if (message.type === 'battle_challenge') {
      setPendingBattle(message.battle);
      setShowNotification(true);
      fetchBattles();
    } else if (message.type === 'battle_accepted') {
      setShowNotification(false);
      fetchBattles();
      if (message.battle_id) navigate(`/quiz-battle/${message.battle_id}`);
    } else if (message.type === 'battle_started') {
      if (message.battle_id) navigate(`/quiz-battle/${message.battle_id}`);
    } else if (message.type === 'battle_declined') {
      setShowNotification(false);
      fetchBattles();
    }
  });

  useEffect(() => {
    fetchBattles();
    fetchFriends();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    const pollInterval = setInterval(() => { if (!isConnected) fetchBattles(); }, 10000);
    return () => clearInterval(pollInterval);
  }, [statusFilter, isConnected]);

  const fetchBattles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/quiz_battles?status=${statusFilter}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setBattles(data.battles);
      }
    } catch (error) { console.error('Error fetching battles:', error); }
    finally { setLoading(false); }
  };


  const fetchFriends = async () => {
    try {
      const response = await fetch(`${API_URL}/friends`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setFriends(data.friends); }
    } catch (error) { console.error('Error fetching friends:', error); }
  };

  const handleCreateBattle = async (e) => {
    e.preventDefault();
    if (!selectedFriend || !subject) { alert('Please select a friend and enter a subject'); return; }
    try {
      const response = await fetch(`${API_URL}/create_quiz_battle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponent_id: parseInt(selectedFriend), subject, difficulty, question_count: questionCount, time_limit_seconds: 300 })
      });
      if (response.ok) {
        setShowCreateModal(false);
        setSelectedFriend('');
        setSubject('');
        fetchBattles();
        alert('Battle challenge sent!');
      }
    } catch (error) { console.error('Error creating battle:', error); }
  };

  const handleAcceptBattle = async (battleId = null) => {
    const id = battleId || pendingBattle?.id;
    if (!id) return;
    try {
      const response = await fetch(`${API_URL}/accept_quiz_battle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ battle_id: id })
      });
      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        navigate(`/quiz-battle/${id}`);
      }
    } catch (error) { console.error('Error accepting battle:', error); }
  };

  const handleDeclineBattle = async () => {
    if (!pendingBattle) return;
    try {
      const response = await fetch(`${API_URL}/decline_quiz_battle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ battle_id: pendingBattle.id })
      });
      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        fetchBattles();
      }
    } catch (error) { console.error('Error declining battle:', error); }
  };

  const getBattleStatusColor = (status) => {
    const colors = { pending: 'var(--qb-warning)', active: 'var(--qb-accent)', completed: 'var(--qb-success)', expired: 'var(--qb-danger)' };
    return colors[status] || 'var(--qb-text-secondary)';
  };

  const getBattleWinner = (battle) => {
    if (battle.status !== 'completed') return null;
    if (battle.your_score > battle.opponent_score) return 'win';
    if (battle.your_score < battle.opponent_score) return 'loss';
    return 'draw';
  };

  const renderAvatar = (user) => {
    const profilePicture = user.picture_url || user.picture || user.profile_picture;
    const displayName = user.username || user.email || 'U';
    const initial = (user.first_name?.[0] || displayName.charAt(0)).toUpperCase();
    if (profilePicture) {
      return (
        <div className="qb-opponent-avatar">
          <img src={profilePicture} alt={displayName} referrerPolicy="no-referrer" onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      );
    }
    return <div className="qb-opponent-avatar">{initial}</div>;
  };


  return (
    <div className="qb-page">
      <header className="qb-header">
        <div className="qb-header-left">
          <h1 className="qb-logo">cerbyl</h1>
          <span className="qb-subtitle">QUIZ BATTLES</span>
          {isConnected && <span className="qb-ws-status">●</span>}
        </div>
        <div className="qb-header-right">
          <button className="qb-nav-btn" onClick={() => navigate('/social')}>Back to Social</button>
          <button className="qb-nav-btn" onClick={() => navigate('/dashboard')}>Dashboard</button>
        </div>
      </header>

      <div className="qb-content">
        <div className="qb-container">
          <div className="qb-welcome">
            <div className="qb-welcome-left">
              <h2>Quiz Battles</h2>
              <p>Challenge your friends to 1v1 quiz battles</p>
            </div>
            <button className="qb-create-btn" onClick={() => setShowCreateModal(true)}>
              <Swords size={16} /><span>Create Battle</span>
            </button>
          </div>

          <div className="qb-filters">
            {['pending', 'active', 'completed', 'all'].map(filter => (
              <button key={filter} className={`qb-filter-tab ${statusFilter === filter ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter)}>{filter.charAt(0).toUpperCase() + filter.slice(1)}</button>
            ))}
          </div>

          {loading ? (
            <div className="qb-loading"><div className="qb-spinner"></div><p>Loading battles...</p></div>
          ) : battles.length === 0 ? (
            <div className="qb-empty">
              <Swords size={48} />
              <p>No battles found</p>
              <p className="qb-empty-hint">Challenge a friend to start battling!</p>
            </div>
          ) : (
            <div className="qb-battle-list">
              {battles.map((battle) => {
                const winner = getBattleWinner(battle);
                return (
                  <div key={battle.id} className="qb-battle-card">
                    <div className="qb-battle-header">
                      <div className="qb-battle-status" style={{ color: getBattleStatusColor(battle.status) }}>
                        {battle.status.toUpperCase()}
                      </div>
                      {winner && (
                        <div className={`qb-battle-result ${winner}`}>
                          {winner === 'win' ? 'You Won!' : winner === 'draw' ? 'Draw' : 'Opponent Won'}
                        </div>
                      )}
                    </div>

                    <div className="qb-opponent">
                      {renderAvatar(battle.opponent)}
                      <div className="qb-opponent-info">
                        <span className="qb-opponent-name">VS {battle.opponent.first_name || battle.opponent.username}</span>
                        <span className="qb-battle-subject">{battle.subject}</span>
                      </div>
                    </div>

                    <div className="qb-details">
                      <div className="qb-detail-item"><Target size={14} /><span>{battle.difficulty}</span></div>
                      <div className="qb-detail-item"><Users size={14} /><span>{battle.question_count} questions</span></div>
                      <div className="qb-detail-item"><Clock size={14} /><span>{Math.floor(battle.time_limit_seconds / 60)} min</span></div>
                    </div>

                    <div className="qb-scores">
                      <div className="qb-score-box">
                        <span className="qb-score-label">Your Score</span>
                        <span className="qb-score-value">{battle.your_score}</span>
                        {battle.your_completed && <Check size={16} className="qb-completed-icon" />}
                      </div>
                      <div className="qb-vs-divider">VS</div>
                      <div className="qb-score-box">
                        <span className="qb-score-label">Opponent</span>
                        <span className="qb-score-value">{battle.opponent_score}</span>
                        {battle.opponent_completed && <Check size={16} className="qb-completed-icon" />}
                      </div>
                    </div>

                    {battle.status === 'pending' && !battle.is_challenger && (
                      <button className="qb-action-btn" onClick={() => handleAcceptBattle(battle.id)}>Accept Challenge</button>
                    )}
                    {battle.status === 'active' && !battle.your_completed && (
                      <button className="qb-action-btn" onClick={() => navigate(`/quiz-battle/${battle.id}`)}>Continue Battle</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {showCreateModal && (
        <div className="qb-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="qb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qb-modal-header">
              <h3>Create Quiz Battle</h3>
              <button className="qb-modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateBattle} className="qb-form">
              <div className="qb-form-group">
                <label>Choose Opponent</label>
                <select value={selectedFriend} onChange={(e) => setSelectedFriend(e.target.value)} required>
                  <option value="">Select a friend...</option>
                  {friends.map(friend => (
                    <option key={friend.id} value={friend.id}>
                      {friend.first_name && friend.last_name ? `${friend.first_name} ${friend.last_name}` : friend.username}
                    </option>
                  ))}
                </select>
              </div>
              <div className="qb-form-group">
                <label>Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Mathematics, Physics..." required />
              </div>
              <div className="qb-form-group">
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="qb-form-group">
                <label>Number of Questions</label>
                <input type="number" value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} min="5" max="20" required />
              </div>
              <button type="submit" className="qb-submit-btn"><Swords size={16} /><span>Challenge Friend</span></button>
            </form>
          </div>
        </div>
      )}

      {showNotification && pendingBattle && (
        <BattleNotification battle={pendingBattle} onAccept={handleAcceptBattle} onDecline={handleDeclineBattle} onClose={() => setShowNotification(false)} />
      )}
    </div>
  );
};

export default QuizBattle;
