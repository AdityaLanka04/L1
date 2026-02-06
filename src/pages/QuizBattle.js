import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Swords, Users, Clock, X, Check, Zap, Trophy, Shield, 
  Flame, Crown, Sparkles, ChevronRight, BookOpen, Database,
  Gauge, ArrowRight, AlertCircle
, Menu} from 'lucide-react';
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
  const [error, setError] = useState(null);

  const { isConnected } = useSharedWebSocket(token, (message) => {
    if (message.type === 'battle_answer_submitted' || message.type === 'battle_opponent_completed') {
      return;
    }
    
    if (message.type === 'battle_challenge') {
      setPendingBattle(message.battle);
      setShowNotification(true);
      fetchBattles();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Battle Challenge!', {
          body: `${message.battle.challenger?.first_name || 'Someone'} challenged you to a quiz battle!`,
          icon: '/battle-icon.png'
        });
      }
    } else if (message.type === 'battle_accepted') {
      setShowNotification(false);
      fetchBattles();
      if (message.battle_id) {
        setTimeout(() => navigate(`/quiz-battle/${message.battle_id}`), 500);
      }
    } else if (message.type === 'battle_started') {
      if (message.battle_id) {
        navigate(`/quiz-battle/${message.battle_id}`);
      }
    } else if (message.type === 'battle_declined') {
      setShowNotification(false);
      fetchBattles();
    }
  });

  useEffect(() => {
    fetchBattles();
    fetchFriends();
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    const pollInterval = setInterval(() => {
      if (!isConnected) {
        fetchBattles();
      }
    }, 10000);
    
    return () => clearInterval(pollInterval);
  }, [statusFilter, isConnected]);

  const fetchBattles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/quiz_battles?status=${statusFilter}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (response.ok) {
        const data = await response.json();
        setBattles(data.battles || []);
      } else {
        throw new Error('Failed to fetch battles');
      }
    } catch (error) {
      console.error('Error fetching battles:', error);
      setError('Unable to load battles. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/friends`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (response.ok) { 
        const data = await response.json(); 
        setFriends(data.friends || []); 
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  }, [token]);

  const handleCreateBattle = async (e) => {
    e.preventDefault();
    if (!selectedFriend || !subject) { 
      setError('Please select a friend and enter a subject');
      return; 
    }
    
    setError(null);
    
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
        setDifficulty('intermediate');
        setQuestionCount(10);
        fetchBattles();
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Battle Challenge Sent!', {
            body: 'Your opponent has been notified.',
            icon: '/battle-icon.png'
          });
        }
      } else {
        throw new Error('Failed to create battle');
      }
    } catch (error) {
      console.error('Error creating battle:', error);
      setError('Unable to create battle. Please try again.');
    }
  };

  const handleAcceptBattle = async (battleId = null) => {
    const id = battleId || pendingBattle?.id;
    if (!id) return;
    
    try {
      const response = await fetch(`${API_URL}/accept_quiz_battle`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ battle_id: id })
      });
      
      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        setTimeout(() => navigate(`/quiz-battle/${id}`), 300);
      } else {
        throw new Error('Failed to accept battle');
      }
    } catch (error) {
      console.error('Error accepting battle:', error);
      setError('Unable to accept battle. Please try again.');
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
        body: JSON.stringify({ battle_id: pendingBattle.id })
      });
      
      if (response.ok) {
        setShowNotification(false);
        setPendingBattle(null);
        fetchBattles();
      } else {
        throw new Error('Failed to decline battle');
      }
    } catch (error) {
      console.error('Error declining battle:', error);
    }
  };

  const getBattleStatusColor = useCallback((status) => {
    const colors = { 
      pending: 'var(--qb-warning)', 
      active: 'var(--qb-accent)', 
      completed: 'var(--qb-success)', 
      expired: 'var(--qb-danger)' 
    };
    return colors[status] || 'var(--qb-text-secondary)';
  }, []);

  const getBattleWinner = useCallback((battle) => {
    if (battle.status !== 'completed') return null;
    if (battle.your_score > battle.opponent_score) return 'win';
    if (battle.your_score < battle.opponent_score) return 'loss';
    return 'draw';
  }, []);

  const renderAvatar = useCallback((user) => {
    const profilePicture = user.picture_url || user.picture || user.profile_picture;
    const displayName = user.username || user.email || 'U';
    const initial = (user.first_name?.[0] || displayName.charAt(0)).toUpperCase();
    
    if (profilePicture) {
      return (
        <div className="qb-opponent-avatar">
          <img 
            src={profilePicture} 
            alt={displayName} 
            referrerPolicy="no-referrer" 
            onError={(e) => { 
              e.target.style.display = 'none'; 
            }} 
          />
        </div>
      );
    }
    
    return <div className="qb-opponent-avatar">{initial}</div>;
  }, []);

  const filters = useMemo(() => ['pending', 'active', 'completed', 'all'], []);

  return (
    <div className="qb-page">
      <header className="qb-header">
        <div className="qb-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="qb-logo" onClick={() => navigate('/search-hub')}>
            <div className="qb-logo-img" />
            cerbyl
          </h1>
          <div className="qb-header-divider"></div>
          <span className="qb-subtitle">QUIZ BATTLES</span>
        </div>
        <div className="qb-header-right">
          <button className="qb-nav-btn" onClick={() => navigate('/social')}>
            <Users size={16} />
            Social
          </button>
          <button className="qb-nav-btn" onClick={() => navigate('/dashboard')}>
                  Dashboard
          </button>
        </div>
      </header>

      <div className="qb-content">
        <div className="qb-container">
          <section className="qb-welcome-section">
            <div className="qb-welcome-left">
              <p className="qb-welcome-desc">
                CHALLENGE YOUR FRIENDS TO EPIC 1V1 KNOWLEDGE DUELS. TEST YOUR SKILLS, 
                CLIMB THE LEADERBOARD, AND PROVE YOUR MASTERY ACROSS ANY SUBJECT.
              </p>
            </div>
            <button className="qb-create-btn" onClick={() => setShowCreateModal(true)}>
              CREATE BATTLE
            </button>
          </section>

          <div 
            className="qb-filters"
            style={{ '--filter-index': filters.indexOf(statusFilter) }}
          >
            {filters.map((filter, index) => (
              <button 
                key={filter} 
                className={`qb-filter-tab ${statusFilter === filter ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter)}
              >
                <span>{filter.charAt(0).toUpperCase() + filter.slice(1)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="qb-loading">
              <div className="qb-spinner"></div>
              <p className="qb-loading-text">Loading battles...</p>
            </div>
          ) : error ? (
            <div className="qb-error-state">
              <AlertCircle size={48} className="qb-error-icon" />
              <p className="qb-error-text">{error}</p>
              <button className="qb-retry-btn" onClick={fetchBattles}>
                <ChevronRight size={18} />
                Retry
              </button>
            </div>
          ) : battles.length === 0 ? (
            <div className="qb-empty">
              <Swords size={72} className="qb-empty-icon" />
              <h3 className="qb-empty-title">No Battles Found</h3>
              <p className="qb-empty-desc">
                Challenge a friend to start your first battle and show off your knowledge!
              </p>
            </div>
          ) : (
            <div className="qb-battle-grid">
              {battles.map((battle) => {
                const winner = getBattleWinner(battle);
                const statusColor = getBattleStatusColor(battle.status);
                
                return (
                  <div key={battle.id} className="qb-battle-card">
                    <div className="qb-battle-header">
                      <div 
                        className="qb-battle-status" 
                        style={{ color: statusColor }}
                      >
                        {battle.status.toUpperCase()}
                      </div>
                      {winner && (
                        <div className={`qb-battle-result ${winner}`}>
                          {winner === 'win' ? (
                            <>
                              <Crown size={16} />
                              Victory!
                            </>
                          ) : winner === 'draw' ? (
                            <>
                              <Shield size={16} />
                              Draw
                            </>
                          ) : (
                            <>
                              <X size={16} />
                              Defeat
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="qb-opponent-section">
                      <div className="qb-opponent-header">
                        {renderAvatar(battle.opponent)}
                        <div className="qb-opponent-info">
                          <h4 className="qb-opponent-name">
                            VS {battle.opponent.first_name || battle.opponent.username}
                          </h4>
                          <div className="qb-battle-subject">
                            <Sparkles size={16} />
                            {battle.subject}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="qb-details-grid">
                      <div className="qb-detail-card">
                        <Gauge size={18} className="qb-detail-icon" />
                        <div className="qb-detail-label">Difficulty</div>
                        <div className="qb-detail-value">{battle.difficulty}</div>
                      </div>
                      <div className="qb-detail-card">
                        <Database size={18} className="qb-detail-icon" />
                        <div className="qb-detail-label">Questions</div>
                        <div className="qb-detail-value">{battle.question_count}</div>
                      </div>
                      <div className="qb-detail-card">
                        <Clock size={18} className="qb-detail-icon" />
                        <div className="qb-detail-label">Time</div>
                        <div className="qb-detail-value">{Math.floor(battle.time_limit_seconds / 60)} min</div>
                      </div>
                    </div>

                    <div className="qb-scores-container">
                      <div className="qb-scores-grid">
                        <div className="qb-score-box">
                          <span className="qb-score-label">Your Score</span>
                          <span className="qb-score-value">{battle.your_score || 0}</span>
                          {battle.your_completed && (
                            <Check size={20} className="qb-completed-icon" />
                          )}
                        </div>
                        <div className="qb-vs-divider">VS</div>
                        <div className="qb-score-box">
                          <span className="qb-score-label">Opponent</span>
                          <span className="qb-score-value">{battle.opponent_score || 0}</span>
                          {battle.opponent_completed && (
                            <Check size={20} className="qb-completed-icon" />
                          )}
                        </div>
                      </div>
                    </div>

                    {battle.status === 'pending' && !battle.is_challenger && (
                      <button 
                        className="qb-action-btn" 
                        onClick={() => handleAcceptBattle(battle.id)}
                      >
                        <Zap size={18} />
                        Accept Challenge
                        <ArrowRight size={16} />
                      </button>
                    )}
                    {battle.status === 'active' && !battle.your_completed && (
                      <button 
                        className="qb-action-btn" 
                        onClick={() => navigate(`/quiz-battle/${battle.id}`)}
                      >
                        <Flame size={18} />
                        Continue Battle
                        <ArrowRight size={16} />
                      </button>
                    )}
                    {battle.status === 'completed' && (
                      <button 
                        className="qb-action-btn" 
                        onClick={() => navigate(`/quiz-battle/${battle.id}/results`)}
                        style={{ 
                          background: winner === 'win' 
                            ? 'var(--qb-gradient-victory)' 
                            : winner === 'loss' 
                            ? 'var(--qb-gradient-defeat)' 
                            : 'var(--qb-gradient-draw)' 
                        }}
                      >
                        <Trophy size={18} />
                        View Results
                        <ChevronRight size={16} />
                      </button>
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
              <h3 className="qb-modal-title">
                <Swords size={28} />
                Create Quiz Battle
              </h3>
              <button className="qb-modal-close" onClick={() => setShowCreateModal(false)}>
                <X size={22} />
              </button>
            </div>
            
            <form onSubmit={handleCreateBattle} className="qb-form">
              <div className="qb-form-group">
                <label className="qb-form-label">
                  <Users size={14} className="qb-form-label-icon" />
                  Choose Opponent
                </label>
                <select 
                  className="qb-form-select"
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
              
              <div className="qb-form-group">
                <label className="qb-form-label">
                  <BookOpen size={14} className="qb-form-label-icon" />
                  Subject
                </label>
                <input 
                  type="text"
                  className="qb-form-input"
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g., Mathematics, Physics, History..." 
                  required 
                />
              </div>
              
              <div className="qb-form-group">
                <label className="qb-form-label">
                  <Gauge size={14} className="qb-form-label-icon" />
                  Difficulty
                </label>
                <select 
                  className="qb-form-select"
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              
              <div className="qb-form-group">
                <label className="qb-form-label">
                  <Database size={14} className="qb-form-label-icon" />
                  Number of Questions
                </label>
                <input 
                  type="number"
                  className="qb-form-input"
                  value={questionCount} 
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))} 
                  min="5" 
                  max="20" 
                  required 
                />
              </div>
              
              <button type="submit" className="qb-submit-btn">
                <Swords size={20} />
                <span>Challenge Friend</span>
                <ArrowRight size={18} />
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

      <div className="qb-battle-particles">
        <div className="qb-particle"></div>
        <div className="qb-particle"></div>
        <div className="qb-particle"></div>
        <div className="qb-gradient-orb"></div>
        <div className="qb-gradient-orb"></div>
      </div>
    </div>
  );
};

export default QuizBattle;