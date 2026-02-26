import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Target, TrendingUp, Medal, Crown, Award, Menu, Users } from 'lucide-react';
import './Leaderboards.css';
import { API_URL } from '../config';
const Leaderboards = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  
  
  const [category, setCategory] = useState('global');
  const [metric, setMetric] = useState('total_hours');
  const [period, setPeriod] = useState('all_time');

  useEffect(() => {
    fetchLeaderboard();
  }, [category, metric, period]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/leaderboard?category=${category}&metric=${metric}&period=${period}&limit=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard);
        setCurrentUserRank(data.current_user_rank);
      }
    } catch (error) {
    // silenced
  } finally {
      setLoading(false);
    }
  };

  const getMetricDisplay = (score, metricType) => {
    switch (metricType) {
      case 'total_hours':
        return `${score}h`;
      case 'accuracy':
        return `${score}%`;
      case 'streak':
        return `${score} days`;
      case 'lessons':
        return `${score} lessons`;
      default:
        return score;
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown size={20} className="rank-icon gold" />;
    if (rank === 2) return <Medal size={20} className="rank-icon silver" />;
    if (rank === 3) return <Medal size={20} className="rank-icon bronze" />;
    return null;
  };

  const getMetricIcon = (metricType) => {
    switch (metricType) {
      case 'total_hours':
        return <Clock size={16} />;
      case 'accuracy':
        return <Target size={16} />;
      case 'streak':
        return <TrendingUp size={16} />;
      case 'lessons':
        return <Award size={16} />;
      default:
        return <Trophy size={16} />;
    }
  };

  return (
    <div className="leaderboard-page">
      <header className="gm-header">
        <div className="gm-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="gm-logo" onClick={() => navigate('/search-hub')}>
            <div className="gm-logo-img" />
            cerbyl
          </h1>
          <div className="gm-header-divider"></div>
          <span className="gm-subtitle">LEADERBOARDS</span>
        </div>
        <nav className="gm-header-right">
          <button className="gm-nav-btn gm-nav-btn-ghost" onClick={() => navigate('/social')}>
            <Users size={16} />
            Social
          </button>
          <button className="gm-nav-btn gm-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </nav>
      </header>

      <div className="leaderboard-container">
        <div className="leaderboard-welcome">
          <h2 className="leaderboard-title">Leaderboards</h2>
          <p className="leaderboard-description">Compete with friends and track your rankings</p>
        </div>

        <div className="filter-section">
          <div className="filter-group">
            <label>Category</label>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${category === 'global' ? 'active' : ''}`}
                onClick={() => setCategory('global')}
              >
                Global
              </button>
              <button 
                className={`filter-btn ${category === 'friends' ? 'active' : ''}`}
                onClick={() => setCategory('friends')}
              >
                Friends Only
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>Metric</label>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${metric === 'total_hours' ? 'active' : ''}`}
                onClick={() => setMetric('total_hours')}
              >
                Study Time
              </button>
              <button 
                className={`filter-btn ${metric === 'accuracy' ? 'active' : ''}`}
                onClick={() => setMetric('accuracy')}
              >
                Accuracy
              </button>
              <button 
                className={`filter-btn ${metric === 'streak' ? 'active' : ''}`}
                onClick={() => setMetric('streak')}
              >
                Streak
              </button>
              <button 
                className={`filter-btn ${metric === 'lessons' ? 'active' : ''}`}
                onClick={() => setMetric('lessons')}
              >
                Lessons
              </button>
            </div>
          </div>
        </div>

        {currentUserRank && (
          <div className="current-user-rank">
            <div className="rank-badge">Your Rank: #{currentUserRank.rank}</div>
            <div className="rank-score">
              {getMetricIcon(metric)}
              <span>{getMetricDisplay(currentUserRank.score, metric)}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-text">Loading leaderboard...</div>
        ) : leaderboard.length === 0 ? (
          <div className="empty-leaderboard">
            <Trophy size={48} />
            <p>No leaderboard data available</p>
            <p className="empty-hint">Start learning to appear on the leaderboard!</p>
          </div>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((entry) => (
              <div 
                key={entry.user_id}
                className={`leaderboard-entry ${entry.is_current_user ? 'current-user' : ''} ${entry.rank <= 3 ? 'top-three' : ''}`}
              >
                <div className="entry-rank">
                  {getRankIcon(entry.rank) || <span className="rank-number">#{entry.rank}</span>}
                </div>

                <div className="entry-user">
                  <div className="entry-avatar">
                    {entry.picture_url ? (
                      <img src={entry.picture_url} alt={entry.username} />
                    ) : (
                      <div className="entry-avatar-placeholder">
                        {(entry.first_name?.[0] || entry.username[0]).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="entry-user-info">
                    <span className="entry-name">
                      {entry.first_name && entry.last_name
                        ? `${entry.first_name} ${entry.last_name}`
                        : entry.username}
                    </span>
                    {entry.is_current_user && (
                      <span className="you-badge">You</span>
                    )}
                  </div>
                </div>

                <div className="entry-score">
                  {getMetricIcon(metric)}
                  <span>{getMetricDisplay(entry.score, metric)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboards;