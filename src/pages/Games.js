import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import GeometricGrid from '../components/GeometricGrid';
import '../pages/ProfilePage.css';
import './Games.css';
import { API_URL } from '../config';

const POINT_RULES = [
  ['AI chat message', 1],
  ['Answer a question', 2],
  ['Battle loss', 2],
  ['Battle draw', 5],
  ['Flashcard set', 10],
  ['Battle win', 10],
  ['Complete a quiz', 15],
  ['Create a note', 20],
  ['Quiz score 80%+', 30],
  ['Solo quiz (max)', 40],
  ['Study for 1 hour', 50],
];

const PageBackground = () => (
  <div className="pf-bg-fx" aria-hidden="true">
    <div className="pf-bg-wash" />
    <div className="pf-bg-orb pf-bg-orb-1" />
    <div className="pf-bg-orb pf-bg-orb-2" />
    <GeometricGrid className="pf-bg-geo" linesClassName="pf-bg-geo-lines" numsClassName="pf-bg-geo-nums" />
    <div className="pf-bg-grain" />
    <div className="pf-bg-vignette" />
  </div>
);

const Games = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  const [gamificationStats, setGamificationStats] = useState({
    total_points: 0,
    level: 1,
    experience: 0,
    rank: null,
    weekly_points: 0,
    weekly_study_minutes: 0
  });
  
  const [bingoStats, setBingoStats] = useState({});
  const [weeklyProgress, setWeeklyProgress] = useState({
    study_minutes: 0,
    ai_chats: 0,
    notes_created: 0,
    questions_answered: 0,
    quizzes_completed: 0,
    flashcards_created: 0,
    solo_quizzes: 0,
    flashcards_reviewed: 0,
    flashcards_mastered: 0
  });
  
  const [recentActivities, setRecentActivities] = useState([]);
  const [pointsToNextLevel, setPointsToNextLevel] = useState(100);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [dailyChallengeProgress, setDailyChallengeProgress] = useState(0);

  const bingoTasks = [
    { id: 1, title: 'Chat 50 Times', stat: 'ai_chats', target: 50, points: 50 },
    { id: 2, title: 'Answer 20 Questions', stat: 'questions_answered', target: 20, points: 100 },
    { id: 3, title: 'Create 5 Notes', stat: 'notes_created', target: 5, points: 50 },
    { id: 4, title: 'Study 5 Hours', stat: 'study_hours', target: 5, points: 200 },
    { id: 5, title: 'Complete 3 Quizzes', stat: 'quizzes_completed', target: 3, points: 150 },
    { id: 6, title: 'Create 10 Flashcards', stat: 'flashcards_created', target: 10, points: 100 },
    { id: 7, title: '7 Day Streak', stat: 'streak', target: 7, points: 300 },
    { id: 8, title: 'Win 3 Battles', stat: 'battles_won', target: 3, points: 150 },
    { id: 9, title: 'Solo Quiz Master', stat: 'solo_quizzes', target: 5, points: 200 },
    { id: 10, title: 'Chat 100 Times', stat: 'ai_chats', target: 100, points: 100 },
    { id: 11, title: 'Create 10 Notes', stat: 'notes_created', target: 10, points: 100 },
    { id: 12, title: 'Answer 50 Questions', stat: 'questions_answered', target: 50, points: 200 },
    { id: 13, title: 'Complete 5 Quizzes', stat: 'quizzes_completed', target: 5, points: 250 },
    { id: 14, title: 'Win 5 Battles', stat: 'battles_won', target: 5, points: 250 },
    { id: 15, title: 'Review 50 Cards', stat: 'flashcards_reviewed', target: 50, points: 150 },
    { id: 16, title: 'Master Level', stat: 'level', target: 5, points: 1000 }
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      loadAllData(username);
    }
    
  }, [navigate]);

  const loadAllData = async (username) => {
    try {
      
      await Promise.all([
        loadGamificationStats(username),
        loadBingoStats(username),
        loadWeeklyProgress(username),
        loadRecentActivities(username),
        loadDailyChallenge(username)
      ]);
    } catch (error) { /* silenced */ } finally {
      setLoading(false);
    }
  };
  
  

  const loadGamificationStats = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_gamification_stats?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGamificationStats(data);
        
        
        if (data.xp_to_next_level !== undefined) {
          setPointsToNextLevel(data.xp_to_next_level);
        } else {
          const expForNextLevel = calculateExpForLevel(data.level + 1);
          setPointsToNextLevel(expForNextLevel - data.experience);
        }
      }
    } catch (error) { /* silenced */ }
  };

  const loadBingoStats = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_weekly_bingo_stats?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
                        
        
        if (data.stats) {
          setBingoStats(data.stats);
                  } else {
                  }
      } else {
              }
    } catch (error) { /* silenced */ }
  };

  const loadWeeklyProgress = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_weekly_activity_progress?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
                setWeeklyProgress(data);
      }
    } catch (error) { /* silenced */ }
  };

  const loadRecentActivities = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_recent_point_activities?user_id=${username}&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentActivities(data.activities || []);
      }
    } catch (error) { /* silenced */ }
  };

  const loadDailyChallenge = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_daily_challenge?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDailyChallenge(data.challenge);
        setDailyChallengeProgress(data.progress || 0);
      }
    } catch (error) {
            
      generateFallbackChallenge();
    }
  };

  const generateFallbackChallenge = () => {
    const challenges = [
      { id: 1, title: 'Knowledge Sprint', description: 'Answer 15 questions correctly', target: 15, type: 'questions_answered', reward: 100, icon: 'target' },
      { id: 2, title: 'Chat Master', description: 'Have 25 AI conversations', target: 25, type: 'ai_chats', reward: 75, icon: 'chat' },
      { id: 3, title: 'Note Taker', description: 'Create 5 new notes', target: 5, type: 'notes_created', reward: 150, icon: 'note' },
      { id: 4, title: 'Study Marathon', description: 'Study for 2 hours', target: 120, type: 'study_minutes', reward: 200, icon: 'clock' },
      { id: 5, title: 'Quiz Champion', description: 'Complete 3 quizzes with 80%+', target: 3, type: 'quizzes_completed', reward: 175, icon: 'trophy' },
      { id: 6, title: 'Flashcard Creator', description: 'Create 20 flashcards', target: 20, type: 'flashcards_created', reward: 125, icon: 'cards' },
      { id: 7, title: 'Perfect Score', description: 'Get 100% on any quiz', target: 1, type: 'perfect_quizzes', reward: 250, icon: 'star' }
    ];
    
    const today = new Date().getDate();
    const challengeIndex = today % challenges.length;
    const selectedChallenge = challenges[challengeIndex];
    
    setDailyChallenge(selectedChallenge);
    const currentProgress = weeklyProgress[selectedChallenge.type] || 0;
    setDailyChallengeProgress(currentProgress);
  };

  const calculateExpForLevel = (level) => {
    
    const thresholds = [0, 100, 282, 500, 800, 1200, 1700, 2300, 3000];
    if (level < thresholds.length) {
      return thresholds[level];
    } else {
      return 3000 + ((level - 8) * 1000);
    }
  };

  const isTaskCompleted = (task) => {
    
    const statValue = weeklyProgress[task.stat] || 0;
    
    if (task.stat === 'study_hours') {
      const hours = Math.floor(weeklyProgress.study_minutes / 60);
      return hours >= task.target;
    }
    return statValue >= task.target;
  };

  const getProgress = (task) => {
    
    let statValue = weeklyProgress[task.stat] || 0;
    
    if (task.stat === 'study_hours') {
      statValue = Math.floor(weeklyProgress.study_minutes / 60);
    }
    return Math.min((statValue / task.target) * 100, 100);
  };

  const completedCount = bingoTasks.filter(isTaskCompleted).length;
  const totalTasks = bingoTasks.length;

  const levelProgress = gamificationStats.experience > 0 
    ? ((gamificationStats.experience % calculateExpForLevel(gamificationStats.level)) / calculateExpForLevel(gamificationStats.level + 1)) * 100
    : 0;

  const getDailyChallengeProgress = () => {
    if (!dailyChallenge) return 0;
    const current = weeklyProgress[dailyChallenge.type] || 0;
    return Math.min((current / dailyChallenge.target) * 100, 100);
  };

  const isDailyChallengeComplete = () => {
    if (!dailyChallenge) return false;
    const current = weeklyProgress[dailyChallenge.type] || 0;
    return current >= dailyChallenge.target;
  };

  const statValueFor = (task) => (
    task.stat === 'study_hours' ? Math.floor((weeklyProgress.study_minutes || 0) / 60) : (weeklyProgress[task.stat] || 0)
  );

  if (loading) {
    return (
      <div className="pf-page gm-page">
        <PageBackground />
        <div className="gm-loading" role="status">
          <div className="gm-loading-cubes" aria-hidden="true"><span /><span /><span /></div>
          <p>Loading your stats…</p>
        </div>
      </div>
    );
  }

  const challengeDone = isDailyChallengeComplete();

  return (
    <div className="pf-page gm-page">
      <PageBackground />

      <Link className="pf-back" to="/dashboard-cerbyl"><ChevronLeft size={16} aria-hidden="true" />Dashboard</Link>

      <div className="pnw-main">
        <div className="pnw-canvas">
          <section className="pnw-identity gm-identity">
            <div className="pnw-identity-copy">
              <h1>Learning Games<span>.</span></h1>
              <p className="pnw-handle">Earn points for everything you study and climb the leaderboard.</p>
              <div className="pnw-identity-actions">
                <button type="button" className="pnw-primary-action" onClick={() => navigate('/leaderboards')}>
                  Leaderboard <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button type="button" className="pnw-secondary-action" onClick={() => navigate('/challenges')}>
                  Challenges
                </button>
                <button type="button" className="pnw-secondary-action" onClick={() => loadAllData(localStorage.getItem('username'))}>
                  <RefreshCw size={14} aria-hidden="true" /> Refresh
                </button>
              </div>
            </div>
          </section>

          <section className="pnw-status-band" aria-label="Points summary">
            <div><span>Level</span><strong>{String(gamificationStats.level).padStart(2, '0')}</strong></div>
            <div><span>Total points</span><strong>{(gamificationStats.total_points || 0).toLocaleString()}</strong></div>
            <div><span>This week</span><strong>{(gamificationStats.weekly_points || 0).toLocaleString()}</strong></div>
            <div><span>Next level</span><strong>{Math.max(0, pointsToNextLevel)} XP</strong></div>
          </section>

          {dailyChallenge && (
            <section className="pnw-panel gm-mission">
              <div className="pnw-section-heading">
                <div>
                  <span>Today's mission</span>
                  <h2>{dailyChallenge.title}</h2>
                </div>
                <small>{challengeDone ? 'Completed' : `+${dailyChallenge.reward} points`}</small>
              </div>
              <p className="gm-text">{dailyChallenge.description}</p>
              <div className="gm-progress">
                <div className="gm-bar"><i style={{ width: `${getDailyChallengeProgress()}%` }} /></div>
                <span>{weeklyProgress[dailyChallenge.type] || 0} / {dailyChallenge.target}</span>
              </div>
            </section>
          )}

          <section className="pnw-panel">
            <div className="pnw-section-heading">
              <div>
                <span>This week</span>
                <h2>Weekly Challenges</h2>
              </div>
              <small>{completedCount} of {totalTasks} done</small>
            </div>
            <div className="gm-task-grid">
              {bingoTasks.map((task) => {
                const completed = isTaskCompleted(task);
                return (
                  <div key={task.id} className={`gm-task${completed ? ' is-done' : ''}`}>
                    <div className="gm-task-head">
                      <strong>{task.title}</strong>
                      <span>+{task.points}</span>
                    </div>
                    <div className="gm-progress">
                      <div className="gm-bar"><i style={{ width: `${getProgress(task)}%` }} /></div>
                      <span>{Math.min(statValueFor(task), task.target)} / {task.target}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="pnw-work-grid">
            <section className="pnw-panel">
              <div className="pnw-section-heading">
                <div>
                  <span>Your history</span>
                  <h2>Recent Activity</h2>
                </div>
              </div>
              {recentActivities.length === 0 ? (
                <p className="gm-text">No points earned yet. Start studying to earn your first points.</p>
              ) : (
                <ul className="gm-list">
                  {recentActivities.map((activity, index) => (
                    <li key={index}>
                      <div>
                        <strong>{activity.description}</strong>
                        <small>{activity.time_ago}</small>
                      </div>
                      <span>+{activity.points}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pnw-panel">
              <div className="pnw-section-heading">
                <div>
                  <span>How it works</span>
                  <h2>Point System</h2>
                </div>
              </div>
              <ul className="gm-list">
                {POINT_RULES.map(([label, points]) => (
                  <li key={label}><div><strong>{label}</strong></div><span>+{points}</span></li>
                ))}
              </ul>
              <p className="gm-note">Solo quiz points scale with difficulty, number of questions and score.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Games;
