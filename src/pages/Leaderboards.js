import { useState, useEffect } from 'react';
import { Trophy, Clock, Target, TrendingUp, Award, Users } from 'lucide-react';
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
    } catch (error) { /* silenced */ } finally {
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

  const getAvatarInitial = (entry) => (
    (entry.first_name?.[0] || entry.username?.[0] || '?').toUpperCase()
  );

  return (
    <div className="leaderboard-page with-social-chrome">
      <SocialHubChrome
        sideSections={[
          {
            label: 'Category',
            items: [
              { icon: Trophy, label: 'Global',       onClick: () => setCategory('global'),   active: category === 'global' },
              { icon: Users,  label: 'Friends Only', onClick: () => setCategory('friends'),  active: category === 'friends' },
            ],
          },
          {
            label: 'Metric',
            items: [
              { icon: Clock,      label: 'Study Time', onClick: () => setMetric('total_hours'), active: metric === 'total_hours' },
              { icon: Target,     label: 'Accuracy',   onClick: () => setMetric('accuracy'),    active: metric === 'accuracy' },
              { icon: TrendingUp, label: 'Streak',     onClick: () => setMetric('streak'),      active: metric === 'streak' },
              { icon: Award,      label: 'Lessons',    onClick: () => setMetric('lessons'),     active: metric === 'lessons' },
            ],
          },
          {
            label: 'Period',
            items: [
              { icon: Clock, label: 'All Time',   onClick: () => setPeriod('all_time'), active: period === 'all_time' },
              { icon: Clock, label: 'This Month', onClick: () => setPeriod('month'),    active: period === 'month' },
              { icon: Clock, label: 'This Week',  onClick: () => setPeriod('week'),     active: period === 'week' },
            ],
          },
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
            {leaderboard.map((entry) => {
              const profilePicture = entry.picture_url || entry.picture || entry.photoURL || entry.photo_url || entry.profile_picture;
              return (
                <div
                  key={entry.user_id}
                  className={`leaderboard-entry ${entry.is_current_user ? 'current-user' : ''} ${entry.rank <= 3 ? 'top-three' : ''}`}
                >
                  <div className="entry-rank">
                    <span className="rank-number">#{entry.rank}</span>
                  </div>

                  <div className="entry-user">
                    <div className="entry-avatar">
                      {profilePicture && (
                        <img
                          src={profilePicture}
                          alt={entry.username}
                          referrerPolicy="no-referrer"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      )}
                      <div className="entry-avatar-placeholder">
                        {getAvatarInitial(entry)}
                      </div>
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
              );
            })}
          </div>
        )}
      </div>
      </SocialHubChrome>
    </div>
  );
};

export default Leaderboards;
