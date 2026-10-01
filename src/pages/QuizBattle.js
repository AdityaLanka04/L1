import { notificationsEnabled } from '../utils/notificationPresentation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Swords, Clock, Trophy, Flame, ChevronRight, Database, AlertCircle, LoaderCircle
} from 'lucide-react';
import '../styles/quizSurface.css';
import './QuizBattle.css';
import SocialHubChrome from '../components/SocialHubChrome';
import { API_URL } from '../config';
import useSharedWebSocket from '../hooks/useSharedWebSocket';
import BattleNotification from './BattleNotification.js';
import { formatBattleMode, getBattleTimeLimit } from '../utils/battleRules';

const QuizBattle = () => {
  const navigate = useNavigate();
  const notificationLocation = useLocation();
  const token = localStorage.getItem('token');

  const [battles, setBattles] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('battles');
  const [statusFilter, setStatusFilter] = useState('active');
  const [battleQueue, setBattleQueue] = useState([]);
  const pendingBattle = battleQueue[0] || null;
  const [battleBusy, setBattleBusy] = useState(false);
  const battleActionRef = useRef(false);
  const setPendingBattle = battle => setBattleQueue(prev => battle ? [...prev.filter(item => item.id !== battle.id), battle] : prev.slice(1));
  const [showNotification, setShowNotification] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionCount, setQuestionCount] = useState(10);
  const [gameMode, setGameMode] = useState('classic');
  const [classicTimeLimit, setClassicTimeLimit] = useState(300);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const { isConnected } = useSharedWebSocket(token, (message) => {
    if (message.type === 'battle_answer_submitted' || message.type === 'battle_opponent_completed') {
      return;
    }

    if (message.type === 'battle_challenge') {
      if (!notificationsEnabled()) { fetchBattles(); return; }
      setPendingBattle(message.battle);
      setShowNotification(true);
      fetchBattles();

      if (notificationsEnabled() && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('New Battle Challenge!', {
          body: `${message.battle.challenger?.first_name || 'Someone'} challenged you to a quiz battle!`,
          icon: '/favicon.ico'
        });
      }
    } else if (message.type === 'battle_accepted') {
      setBattleQueue(prev => prev.filter(battle => battle.id !== message.battle_id));
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
      setBattleQueue(prev => prev.filter(battle => battle.id !== message.battle_id));
      setShowNotification(false);
      fetchBattles();
    }
  });

  useEffect(() => {
    fetchBattles();
    fetchFriends();


    const pollInterval = setInterval(() => {
      if (!isConnected) fetchBattles();
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

  useEffect(() => {
    const id = Number(new URLSearchParams(notificationLocation.search).get('battle'));
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/quiz_battle/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('This battle is no longer available.');
        const payload = await response.json();
        const data = payload.battle;
        if (cancelled) return;
        if (!data) throw new Error('This battle is no longer available.');
        if (data.status === 'pending' && !data.is_challenger) setPendingBattle({ ...data, challenger: data.opponent, explicit: true });
        else if (['active', 'completed'].includes(data.status)) navigate(`/quiz-battle/${id}`, { replace: true });
        else setError('This challenge is no longer awaiting your response.');
      } catch (error) { if (!cancelled) setError(error.message); }
    })();
    return () => { cancelled = true; };
  }, [notificationLocation.search, token, navigate]);

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
    setCreating(true);

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
          time_limit_seconds: getBattleTimeLimit(gameMode, questionCount, classicTimeLimit),
          game_mode: gameMode
        })
      });

      if (response.ok) {
        setActiveView('battles');
        setSelectedFriend('');
        setSubject('');
        setDifficulty('intermediate');
        setQuestionCount(10);
        setGameMode('classic');
        setClassicTimeLimit(300);
        fetchBattles();

        if (notificationsEnabled() && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Battle Challenge Sent!', {
            body: 'Your opponent has been notified.',
            icon: '/favicon.ico'
          });
        }
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || 'The challenge could not be created. Check the settings and try again.');
      }
    } catch (error) {
      console.error('Error creating battle:', error);
      setError(error.message || 'Unable to create battle. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleAcceptBattle = async (battleId = null) => {
    const id = battleId || pendingBattle?.id;
    if (!id || battleActionRef.current) return;
    battleActionRef.current = true; setBattleBusy(true); setError(null);
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
    } finally { battleActionRef.current = false; setBattleBusy(false); }
  };

  const handleDeclineBattle = async () => {
    if (!pendingBattle || battleActionRef.current) return;
    battleActionRef.current = true; setBattleBusy(true); setError(null);
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
      setError('Unable to decline battle. Please try again.');
    } finally { battleActionRef.current = false; setBattleBusy(false); }
  };

  const getBattleWinner = useCallback((battle) => {
    if (battle.status !== 'completed') return null;
    if (battle.your_result) return battle.your_result;
    if (battle.your_score > battle.opponent_score) return 'win';
    if (battle.your_score < battle.opponent_score) return 'loss';
    return 'draw';
  }, []);

  const filters = useMemo(() => ['pending', 'active', 'completed', 'all'], []);
  const filterLabel = (filter) => `${filter.charAt(0).toUpperCase()}${filter.slice(1)}`;

  const selectBattleView = (filter) => {
    setActiveView('battles');
    setStatusFilter(filter);
  };

  const sideSections = [{
    label: 'Battles',
    items: filters.map((filter) => ({
      label: `${filterLabel(filter)} battles`,
      icon: filter === 'pending' ? Clock : filter === 'active' ? Flame : filter === 'completed' ? Trophy : Database,
      active: activeView === 'battles' && statusFilter === filter,
      onClick: () => selectBattleView(filter),
    })),
  }];

  const opponentName = (user) => user?.first_name || user?.username || 'Opponent';
  const resultTag = { win: ['Victory', 'is-good'], loss: ['Defeat', 'is-bad'], draw: ['Draw', 'is-accent'] };

  const gameModes = [
    { id: 'classic', name: 'Classic', desc: 'Highest score wins.' },
    { id: 'speed', name: 'Speed', desc: 'Score first; faster finish breaks a tie.' },
    { id: 'blitz', name: 'Blitz', desc: '15 seconds per question.' },
    { id: 'sudden_death', name: 'Sudden Death', desc: 'One wrong answer ends your run.' },
  ];
  const timeLimits = [
    { val: 120, label: '2 min' },
    { val: 300, label: '5 min' },
    { val: 600, label: '10 min' },
    { val: 900, label: '15 min' },
  ];

  return (
    <div className="qb-page with-social-chrome">
      <SocialHubChrome
        brandKicker="Quiz Battles"
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        sidebarLead={(
          <button className="qz-side-primary" type="button" onClick={() => setActiveView('create')}>
            <Swords size={15} />
            <span>Create battle</span>
          </button>
        )}
        sideSections={sideSections}
        collapsedLeadItems={[{
          label: 'Create battle', icon: Swords, active: activeView === 'create', onClick: () => setActiveView('create'),
        }]}
      >
        <main className={`qz-main${activeView === 'create' ? ' qz-centered' : ''}`}>
          {activeView === 'create' ? (
            <>
              <header className="qz-hero">
                <div>
                  <h1 className="plain-page-title">Create Battle</h1>
                  <p>Challenge a friend to a live 1v1 quiz.</p>
                </div>
              </header>

              <form onSubmit={handleCreateBattle} className="qz-panel qz-form">
                <div className="qz-row">
                  <label className="qz-field">
                    <span className="qz-label">Opponent</span>
                    <select value={selectedFriend} onChange={(e) => setSelectedFriend(e.target.value)} required>
                      <option value="">{friends.length ? 'Select a friend…' : 'Add friends in Social Hub first'}</option>
                      {friends.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.first_name && f.last_name ? `${f.first_name} ${f.last_name}` : f.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="qz-field">
                    <span className="qz-label">Topic</span>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g., Calculus, World History"
                      maxLength="100"
                      required
                    />
                  </label>
                </div>

                <div className="qz-row">
                  <label className="qz-field">
                    <span className="qz-label">Difficulty</span>
                    <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </label>
                  <label className="qz-field">
                    <span className="qz-label">Questions (5–20)</span>
                    <input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.min(20, Math.max(5, parseInt(e.target.value) || 5)))}
                      min="5"
                      max="20"
                      required
                    />
                  </label>
                </div>

                <div className="qz-field">
                  <span className="qz-label">Game mode</span>
                  <div className="qz-choices" style={{ '--qz-cols': 4 }} role="group" aria-label="Game mode">
                    {gameModes.map(mode => (
                      <button
                        key={mode.id}
                        type="button"
                        className={`qz-choice ${gameMode === mode.id ? 'active' : ''}`}
                        aria-pressed={gameMode === mode.id}
                        onClick={() => setGameMode(mode.id)}
                      >
                        <strong>{mode.name}</strong>
                        <small>{mode.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {gameMode === 'classic' && (
                  <div className="qz-field">
                    <span className="qz-label">Time limit</span>
                    <div className="qz-choices" style={{ '--qz-cols': 4 }} role="group" aria-label="Classic time limit">
                      {timeLimits.map(({ val, label }) => (
                        <button
                          key={val}
                          type="button"
                          className={`qz-choice ${classicTimeLimit === val ? 'active' : ''}`}
                          aria-pressed={classicTimeLimit === val}
                          onClick={() => setClassicTimeLimit(val)}
                        >
                          <strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="qz-error" role="alert">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="qb-form-actions">
                  <button type="submit" className="qz-primary" disabled={creating}>
                    {creating ? <LoaderCircle size={16} className="qz-spin" /> : <Swords size={16} />}
                    <span>{creating ? 'Sending challenge…' : 'Send challenge'}</span>
                  </button>
                  <button type="button" className="qz-secondary" onClick={() => setActiveView('battles')}>Cancel</button>
                </div>
              </form>
            </>
          ) : (
            <>
              <header className="qz-hero">
                <div>
                  <h1 className="plain-page-title">Quiz Battles</h1>
                  <p>{filterLabel(statusFilter)} battles</p>
                </div>
              </header>

              <div className="qb-mobile-filters" aria-label="Filter battles">
                {filters.map(filter => (
                  <button
                    key={filter}
                    type="button"
                    className={statusFilter === filter ? 'active' : ''}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {filterLabel(filter)}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="qz-panel qz-empty"><LoaderCircle size={22} className="qz-spin" /><p>Loading battles…</p></div>
              ) : error ? (
                <div className="qz-panel qz-empty">
                  <strong>Could not load battles</strong>
                  <p>{error}</p>
                  <button className="qz-secondary" type="button" onClick={fetchBattles}>Retry</button>
                </div>
              ) : battles.length === 0 ? (
                <div className="qz-panel qz-empty">
                  <strong>No {statusFilter === 'all' ? '' : `${statusFilter} `}battles</strong>
                  <p>Use Create battle to challenge a friend.</p>
                </div>
              ) : (
                <div className="qz-list">
                  {battles.map((battle) => {
                    const winner = getBattleWinner(battle);
                    const [statusLabel, statusTone] = winner ? resultTag[winner] : [battle.status, battle.status === 'active' ? 'is-accent' : ''];
                    const showScores = battle.status === 'active' || battle.status === 'completed';
                    return (
                      <article key={battle.id} className="qz-panel qz-item">
                        <div className="qz-item-main">
                          <h3 className="qz-item-title">{battle.subject} · vs {opponentName(battle.opponent)}</h3>
                          <div className="qz-meta">
                            <span className="qz-cap">{battle.difficulty}</span>
                            <span>{battle.question_count} questions</span>
                            <span>{battle.game_mode === 'blitz' ? '15 sec / question' : `${Math.floor(battle.time_limit_seconds / 60)} min`}</span>
                            <span>{formatBattleMode(battle.game_mode)}</span>
                          </div>
                        </div>
                        <div className="qz-item-side">
                          {showScores && (
                            <span className="qz-score">{battle.your_score || 0} – {battle.opponent_score || 0}</span>
                          )}
                          <span className={`qz-tag ${statusTone}`}>{statusLabel}</span>
                          {battle.status === 'pending' && !battle.is_challenger && (
                            <button className="qz-primary" type="button" onClick={() => handleAcceptBattle(battle.id)}>Accept</button>
                          )}
                          {battle.status === 'active' && !battle.your_completed && (
                            <button className="qz-primary" type="button" onClick={() => navigate(`/quiz-battle/${battle.id}`)}>
                              Continue <ChevronRight size={15} />
                            </button>
                          )}
                          {battle.status === 'completed' && (
                            <button className="qz-secondary" type="button" onClick={() => navigate(`/quiz-battle/${battle.id}`)}>
                              Results <ChevronRight size={15} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </SocialHubChrome>

      {pendingBattle && (notificationsEnabled() || pendingBattle.explicit) && (
        <BattleNotification
          battle={pendingBattle}
          onAccept={handleAcceptBattle}
          onDecline={handleDeclineBattle}
          busy={battleBusy}
          error={error}
          onClose={() => setPendingBattle(null)}
        />
      )}

    </div>
  );
};

export default QuizBattle;
