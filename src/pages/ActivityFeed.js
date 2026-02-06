import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Target, Flame, TrendingUp, Heart, Award, Zap, Star, ChevronRight , Menu} from 'lucide-react';
import './ActivityFeed.css';
import { API_URL } from '../config';

const ActivityFeed = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityFeed();
    // Poll for new activities every 30 seconds
    const interval = setInterval(fetchActivityFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchActivityFeed = async () => {
    try {
      const response = await fetch(`${API_URL}/friend_activity_feed?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities);
      }
    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  const handleKudos = async (activityId) => {
    try {
      const response = await fetch(`${API_URL}/give_kudos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activity_id: activityId, reaction_type: '👏' })
      });

      if (response.ok) {
        fetchActivityFeed();
      }
    } catch (error) {
          }
  };

  const getIconComponent = (iconName) => {
    const icons = {
      Trophy, Target, Flame, TrendingUp, Award, Zap, Star
    };
    return icons[iconName] || Trophy;
  };

  const getActivityColor = (type) => {
    const colors = {
      achievement: 'var(--accent)',
      milestone: 'var(--success)',
      streak: 'var(--warning)',
      quiz_completed: 'var(--accent)',
      quiz_battle_won: 'var(--success)'
    };
    return colors[type] || 'var(--accent)';
  };

  if (loading) {
    return (
      <div className="feed-page">
        <div className="feed-container">
          <div className="loading-text">Loading activity feed...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-page">
      <header className="hub-header">
        <div className="hub-header-left">
          <button className="nav-menu-btn" onClick={() => navigate('/dashboard')} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="hub-logo" onClick={() => navigate('/search-hub')}>
            <img src="/logo.svg" alt="" style={{ height: '24px', marginRight: '8px', filter: 'brightness(0) saturate(100%) invert(77%) sepia(48%) saturate(456%) hue-rotate(359deg) brightness(95%) contrast(89%)' }} />
            cerbyl
          </h1>
          <div className="hub-header-divider"></div>
          <p className="hub-header-subtitle">ACTIVITY FEED</p>
        </div>
        <div className="hub-header-right">
          <button className="hub-nav-btn hub-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      <div className="feed-container">
        <div className="feed-welcome">
          <h2 className="feed-title">Friend Activity</h2>
          <p className="feed-subtitle">See what your friends are achieving</p>
        </div>

        {activities.length === 0 ? (
          <div className="empty-feed">
            <Zap size={48} />
            <p>No recent activity from friends</p>
            <p className="empty-feed-hint">Add more friends to see their achievements here</p>
          </div>
        ) : (
          <div className="activity-list">
            {activities.map(activity => {
              const IconComponent = getIconComponent(activity.icon);
              const activityColor = getActivityColor(activity.activity_type);

              return (
                <div key={activity.id} className="activity-card">
                  <div className="activity-header">
                    <div className="activity-user">
                      <div className="activity-avatar">
                        {activity.user.picture_url ? (
                          <img src={activity.user.picture_url} alt={activity.user.username} />
                        ) : (
                          <div className="activity-avatar-placeholder">
                            {(activity.user.first_name?.[0] || activity.user.username[0]).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="activity-user-info">
                        <span className="activity-username">
                          {activity.user.first_name && activity.user.last_name
                            ? `${activity.user.first_name} ${activity.user.last_name}`
                            : activity.user.username}
                        </span>
                        <span className="activity-time">
                          {new Date(activity.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="activity-icon" style={{ color: activityColor }}>
                      <IconComponent size={24} />
                    </div>
                  </div>

                  <div className="activity-content">
                    <h3 className="activity-title">{activity.title}</h3>
                    {activity.description && (
                      <p className="activity-description">{activity.description}</p>
                    )}

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="activity-metadata">
                        {activity.metadata.winner_score !== undefined && (
                          <span className="metadata-tag">Score: {activity.metadata.winner_score}</span>
                        )}
                        {activity.metadata.subject && (
                          <span className="metadata-tag">{activity.metadata.subject}</span>
                        )}
                        {activity.metadata.streak_days && (
                          <span className="metadata-tag">{activity.metadata.streak_days} days</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="activity-footer">
                    <button
                      className={`kudos-button ${activity.user_gave_kudos ? 'active' : ''}`}
                      onClick={() => handleKudos(activity.id)}
                    >
                      <Heart size={16} fill={activity.user_gave_kudos ? 'currentColor' : 'none'} />
                      <span>{activity.kudos_count}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;