import { useState, useEffect } from 'react';
import { Trophy, Clock, Target, TrendingUp, Medal, Crown, Award, RefreshCw, Users } from 'lucide-react';
import './Leaderboards.css';
import SocialHubChrome from '../components/SocialHubChrome';
import { API_URL } from '../config';
const Leaderboards = () => {
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
    <div className="leaderboard-page with-social-chrome">
      <SocialHubChrome
        title="Leaderboards"
        tagline="rankings"
        activeKey="leaderboards"
        primaryAction={{
          label: 'Refresh',
          icon: <RefreshCw size={14} />,
          onClick: fetchLeaderboard,
        }}
        sideSections={[
          {
            label: 'Category',
            children: (
              <nav className="shc-view-nav" aria-label="Leaderboard category">
                <button className={`shc-view-link ${category === 'global' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setCategory('global')}>
                  <Trophy size={16} />
                  <span>Global</span>
                </button>
                <button className={`shc-view-link ${category === 'friends' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setCategory('friends')}>
                  <Users size={16} />
                  <span>Friends Only</span>
                </button>
              </nav>
            ),
          },
          {
            label: 'Metric',
            children: (
              <nav className="shc-view-nav" aria-label="Leaderboard metric">
                <button className={`shc-view-link ${metric === 'total_hours' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setMetric('total_hours')}>
                  <Clock size={16} />
                  <span>Study Time</span>
                </button>
                <button className={`shc-view-link ${metric === 'accuracy' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setMetric('accuracy')}>
                  <Target size={16} />
                  <span>Accuracy</span>
                </button>
                <button className={`shc-view-link ${metric === 'streak' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setMetric('streak')}>
                  <TrendingUp size={16} />
                  <span>Streak</span>
                </button>
                <button className={`shc-view-link ${metric === 'lessons' ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setMetric('lessons')}>
                  <Award size={16} />
                  <span>Lessons</span>
                </button>
              </nav>
            ),
          },
          {
            label: 'Period',
            children: (
              <nav className="shc-view-nav" aria-label="Leaderboard period">
                {[
                  ['all_time', 'All Time'],
                  ['month', 'This Month'],
                  ['week', 'This Week'],
                ].map(([value, label]) => (
                  <button key={value} className={`shc-view-link ${period === value ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setPeriod(value)}>
                    <Clock size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            ),
          },
        ]}
        stats={[
          { label: 'Entries', value: leaderboard.length },
          { label: 'Rank', value: currentUserRank ? `#${currentUserRank.rank}` : '—' },
          { label: 'Scope', value: category === 'global' ? 'All' : 'Friends' },
          { label: 'Metric', value: metric === 'total_hours' ? 'Hours' : metric },
        ]}
      >
      <div className="leaderboard-container">
        <div className="leaderboard-welcome">
          <div className="view-heading">
            <span className="view-kicker">Rankings</span>
            <h2 className="view-title">Leaderboards</h2>
            <p className="view-sub">See where you stand among all learners</p>
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
      </SocialHubChrome>
    </div>
  );
};

export default Leaderboards;
