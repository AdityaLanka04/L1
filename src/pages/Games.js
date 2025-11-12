import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Games.css';
import { API_URL } from '../config';

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
    flashcards_created: 0
  });
  
  const [recentActivities, setRecentActivities] = useState([]);
  const [pointsToNextLevel, setPointsToNextLevel] = useState(100);

  const bingoTasks = [
    { id: 1, title: 'Chat 50 Times', stat: 'ai_chats', target: 50, points: 50 },
    { id: 2, title: 'Answer 20 Questions', stat: 'questions_answered', target: 20, points: 100 },
    { id: 3, title: 'Create 5 Notes', stat: 'notes_created', target: 5, points: 50 },
    { id: 4, title: 'Study 5 Hours', stat: 'study_hours', target: 5, points: 200 },
    { id: 5, title: 'Complete 3 Quizzes', stat: 'quizzes_completed', target: 3, points: 150 },
    { id: 6, title: 'Create 10 Flashcards', stat: 'flashcards_created', target: 10, points: 100 },
    { id: 7, title: '7 Day Streak', stat: 'streak', target: 7, points: 300 },
    { id: 8, title: 'Win 3 Battles', stat: 'battles_won', target: 3, points: 150 },
    { id: 9, title: 'Study 10 Hours', stat: 'study_hours', target: 10, points: 400 },
    { id: 10, title: 'Chat 100 Times', stat: 'ai_chats', target: 100, points: 100 },
    { id: 11, title: 'Create 10 Notes', stat: 'notes_created', target: 10, points: 100 },
    { id: 12, title: 'Answer 50 Questions', stat: 'questions_answered', target: 50, points: 200 },
    { id: 13, title: 'Complete 5 Quizzes', stat: 'quizzes_completed', target: 5, points: 250 },
    { id: 14, title: 'Win 5 Battles', stat: 'battles_won', target: 5, points: 250 },
    { id: 15, title: 'Study 20 Hours', stat: 'study_hours', target: 20, points: 800 },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadAllData = async (username) => {
    try {
      // Load all data
      await Promise.all([
        loadGamificationStats(username),
        loadBingoStats(username),
        loadWeeklyProgress(username),
        loadRecentActivities(username)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Backend now calculates points correctly - no need to recalculate on frontend

  const loadGamificationStats = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_gamification_stats?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGamificationStats(data);
        
        // Use xp_to_next_level from backend if available, otherwise calculate
        if (data.xp_to_next_level !== undefined) {
          setPointsToNextLevel(data.xp_to_next_level);
        } else {
          const expForNextLevel = calculateExpForLevel(data.level + 1);
          setPointsToNextLevel(expForNextLevel - data.experience);
        }
      }
    } catch (error) {
      console.error('Error loading gamification stats:', error);
    }
  };

  const loadBingoStats = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_weekly_bingo_stats?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Bingo Stats Response:', data);
        console.log('📊 Stats Object:', data.stats);
        
        // Make sure we have the stats object
        if (data.stats) {
          setBingoStats(data.stats);
          console.log('✅ Bingo stats set:', data.stats);
        } else {
          console.error('❌ No stats in response');
        }
      } else {
        console.error('❌ Bingo stats request failed:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading bingo stats:', error);
    }
  };

  const loadWeeklyProgress = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_weekly_activity_progress?user_id=${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📈 Weekly Progress Response:', data);
        setWeeklyProgress(data);
      }
    } catch (error) {
      console.error('Error loading weekly progress:', error);
    }
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
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const calculateExpForLevel = (level) => {
    // New level thresholds: 0, 100, 282, 500, 800, 1200, 1700, 2300, 3000...
    const thresholds = [0, 100, 282, 500, 800, 1200, 1700, 2300, 3000];
    if (level < thresholds.length) {
      return thresholds[level];
    } else {
      return 3000 + ((level - 8) * 1000);
    }
  };

  const isTaskCompleted = (task) => {
    const statValue = bingoStats[task.stat] || 0;
    console.log(`Task ${task.title}: stat=${task.stat}, value=${statValue}, target=${task.target}`);
    return statValue >= task.target;
  };

  const getProgress = (task) => {
    const statValue = bingoStats[task.stat] || 0;
    return Math.min((statValue / task.target) * 100, 100);
  };

  const completedCount = bingoTasks.filter(isTaskCompleted).length;
  const totalTasks = bingoTasks.length;

  const levelProgress = gamificationStats.experience > 0 
    ? ((gamificationStats.experience % calculateExpForLevel(gamificationStats.level)) / calculateExpForLevel(gamificationStats.level + 1)) * 100
    : 0;

  const studyHoursCompleted = Math.floor(weeklyProgress.study_minutes / 60);

  if (loading) {
    return (
      <div className="games-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="games-page">
      <div className="games-header">
        <div className="header-content">
          <div className="header-left">
            <h1>games & challenges</h1>
            <p>track your learning progress</p>
          </div>
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            dashboard
          </button>
        </div>
      </div>

      <div className="games-container">
        <div className="stats-cards">
          <div className="stat-card-main">
            <span className="stat-label">level</span>
            <span className="stat-value">{gamificationStats.level}</span>
            <div className="level-bar">
              <div 
                className="level-bar-fill" 
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <span className="stat-hint">{pointsToNextLevel} xp to next level</span>
          </div>
          
          <div className="stat-card-main">
            <span className="stat-label">total points</span>
            <span className="stat-value">{gamificationStats.total_points.toLocaleString()}</span>
            <span className="stat-hint">all time</span>
          </div>
          
          <div className="stat-card-main">
            <span className="stat-label">this week</span>
            <span className="stat-value">{gamificationStats.weekly_points}</span>
            <span className="stat-hint">weekly points</span>
          </div>
        </div>

        <div className="section-card activity-overview">
          <div className="section-header">
            <h2>this week's activity</h2>
          </div>
          <div className="activity-stats-grid">
            <div className="activity-stat-box">
              <span className="activity-stat-label">ai chats</span>
              <span className="activity-stat-value">{weeklyProgress.ai_chats}</span>
              <span className="activity-stat-points">+{weeklyProgress.ai_chats * 1} pts</span>
            </div>
            <div className="activity-stat-box">
              <span className="activity-stat-label">notes created</span>
              <span className="activity-stat-value">{weeklyProgress.notes_created}</span>
              <span className="activity-stat-points">+{weeklyProgress.notes_created * 10} pts</span>
            </div>
            <div className="activity-stat-box">
              <span className="activity-stat-label">questions answered</span>
              <span className="activity-stat-value">{weeklyProgress.questions_answered}</span>
              <span className="activity-stat-points">+{weeklyProgress.questions_answered * 2} pts</span>
            </div>
            <div className="activity-stat-box">
              <span className="activity-stat-label">quizzes completed</span>
              <span className="activity-stat-value">{weeklyProgress.quizzes_completed}</span>
              <span className="activity-stat-points">+{weeklyProgress.quizzes_completed * 50} pts</span>
            </div>
            <div className="activity-stat-box">
              <span className="activity-stat-label">flashcard sets</span>
              <span className="activity-stat-value">{weeklyProgress.flashcards_created}</span>
              <span className="activity-stat-points">+{weeklyProgress.flashcards_created * 10} pts</span>
            </div>
            <div className="activity-stat-box">
              <span className="activity-stat-label">study time</span>
              <span className="activity-stat-value">{studyHoursCompleted}h {weeklyProgress.study_minutes % 60}m</span>
              <span className="activity-stat-points">+{studyHoursCompleted * 10} pts</span>
            </div>
          </div>
        </div>

        <div className="content-grid">

          <div className="section-card bingo-card">
            <div className="section-header">
              <h2>weekly challenges</h2>
              <span className="completion-badge">{completedCount}/{totalTasks}</span>
            </div>
            <div className="bingo-board">
              {bingoTasks.map((task) => {
                const completed = isTaskCompleted(task);
                const progress = getProgress(task);
                const statValue = bingoStats[task.stat] || 0;

                return (
                  <div
                    key={task.id}
                    className={`bingo-cell ${completed ? 'completed' : ''}`}
                  >
                    <div className="cell-header">
                      <span className="cell-points">+{task.points}</span>
                      {completed && (
                        <div className="check-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="cell-title">{task.title}</div>
                    <div className="cell-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="progress-text">
                        {statValue}/{task.target}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="section-card recent-card">
            <div className="section-header">
              <h2>recent activity</h2>
            </div>
            <div className="activity-list">
              {recentActivities.length === 0 ? (
                <div className="no-activity">
                  <p>No recent activity</p>
                  <span>Start learning to earn points!</span>
                </div>
              ) : (
                recentActivities.map((activity, index) => (
                  <div key={index} className="recent-item">
                    <div className="recent-content">
                      <span className="recent-desc">{activity.description}</span>
                      <span className="recent-time">{activity.time_ago}</span>
                    </div>
                    <span className="recent-points">+{activity.points}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-card points-card">
            <div className="section-header">
              <h2>point system</h2>
            </div>
            <div className="points-list">
              <div className="points-item">
                <span>ai chat message</span>
                <span>+1</span>
              </div>
              <div className="points-item">
                <span>battle loss</span>
                <span>+1</span>
              </div>
              <div className="points-item">
                <span>answer question</span>
                <span>+2</span>
              </div>
              <div className="points-item">
                <span>battle draw</span>
                <span>+2</span>
              </div>
              <div className="points-item">
                <span>battle win</span>
                <span>+3</span>
              </div>
              <div className="points-item">
                <span>create note</span>
                <span>+10</span>
              </div>
              <div className="points-item">
                <span>flashcard set</span>
                <span>+10</span>
              </div>
              <div className="points-item">
                <span>study 1 hour</span>
                <span>+10</span>
              </div>
              <div className="points-item">
                <span>complete quiz</span>
                <span>+50</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Games;
