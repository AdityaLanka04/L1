import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, Target, Flame, TrendingUp, Heart, Award, Zap, Star, 
  Menu, Users, Filter, MessageCircle, Send, X, BookOpen, 
  Brain, CheckCircle, Clock, Calendar, Sparkles, TrendingDown,
  Activity as ActivityIcon, RefreshCw
} from 'lucide-react';
import './ActivityFeed.css';
import { API_URL } from '../config';

const ActivityFeed = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [activities, setActivities] = useState([]);
  const [filteredActivities, setFilteredActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [commentingOn, setCommentingOn] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    totalActivities: 0,
    todayActivities: 0,
    totalKudos: 0,
    activeStreaks: 0
  });
  const commentInputRef = useRef(null);

  useEffect(() => {
    fetchActivityFeed();
    
    const interval = setInterval(fetchActivityFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [activities, activeFilter, timeFilter]);

  useEffect(() => {
    if (commentingOn && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [commentingOn]);

  const fetchActivityFeed = async () => {
    try {
      const response = await fetch(`${API_URL}/friend_activity_feed?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities);
        calculateStats(data.activities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (activitiesData) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayCount = activitiesData.filter(a => 
      new Date(a.created_at) >= today
    ).length;
    
    const totalKudos = activitiesData.reduce((sum, a) => sum + (a.kudos_count || 0), 0);
    
    const streakActivities = activitiesData.filter(a => 
      a.activity_type === 'streak'
    ).length;

    setStats({
      totalActivities: activitiesData.length,
      todayActivities: todayCount,
      totalKudos: totalKudos,
      activeStreaks: streakActivities
    });
  };

  const applyFilters = () => {
    let filtered = [...activities];

    
    if (activeFilter !== 'all') {
      filtered = filtered.filter(a => a.activity_type === activeFilter);
    }

    
    const now = new Date();
    if (timeFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(a => new Date(a.created_at) >= today);
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(a => new Date(a.created_at) >= weekAgo);
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(a => new Date(a.created_at) >= monthAgo);
    }

    setFilteredActivities(filtered);
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
        
        setActivities(prev => prev.map(activity => {
          if (activity.id === activityId) {
            const wasGiven = activity.user_gave_kudos;
            return {
              ...activity,
              user_gave_kudos: !wasGiven,
              kudos_count: wasGiven ? activity.kudos_count - 1 : activity.kudos_count + 1
            };
          }
          return activity;
        }));
      }
    } catch (error) {
      console.error('Error giving kudos:', error);
    }
  };

  const handleComment = async (activityId) => {
    if (!commentText.trim()) return;

    try {
      
      
      setCommentText('');
      setCommentingOn(null);
      
      
      alert('Comment feature coming soon!');
    } catch (error) {
      console.error('Error posting comment:', error);
    }
  };

  const getIconComponent = (iconName) => {
    const icons = {
      Trophy, Target, Flame, TrendingUp, Award, Zap, Star, 
      BookOpen, Brain, CheckCircle, Sparkles, ActivityIcon
    };
    return icons[iconName] || Trophy;
  };

  const getActivityColor = (type) => {
    const colors = {
      achievement: '#D7B38C',
      milestone: '#22c55e',
      streak: '#F59E0B',
      quiz_completed: '#8B5CF6',
      quiz_battle_won: '#22c55e',
      note_created: '#3B82F6',
      flashcard_created: '#EC4899',
      study_session: '#10B981',
      learning_path: '#F59E0B'
    };
    return colors[type] || '#D7B38C';
  };

  const getActivityTypeLabel = (type) => {
    const labels = {
      achievement: 'Achievement',
      milestone: 'Milestone',
      streak: 'Streak',
      quiz_completed: 'Quiz',
      quiz_battle_won: 'Battle Victory',
      note_created: 'Note',
      flashcard_created: 'Flashcard',
      study_session: 'Study Session',
      learning_path: 'Learning Path'
    };
    return labels[type] || 'Activity';
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const activityTypes = [
    { value: 'all', label: 'All Activities', icon: ActivityIcon },
    { value: 'achievement', label: 'Achievements', icon: Trophy },
    { value: 'streak', label: 'Streaks', icon: Flame },
    { value: 'quiz_completed', label: 'Quizzes', icon: Brain },
    { value: 'quiz_battle_won', label: 'Battles', icon: Zap },
    { value: 'milestone', label: 'Milestones', icon: Target }
  ];

  const timeFilters = [
    { value: 'all', label: 'All Time', icon: Calendar },
    { value: 'today', label: 'Today', icon: Clock },
    { value: 'week', label: 'This Week', icon: TrendingUp },
    { value: 'month', label: 'This Month', icon: TrendingDown }
  ];

  if (loading) {
    return (
      <div className="activity-feed-page">
        <div className="af-content-section">
          <div className="af-loading-text">Loading activity feed...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-feed-page">
      <header className="af-header">
        <div className="af-header-left">
          <button className="af-nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="af-logo" onClick={() => navigate('/search-hub')}>
            <div className="af-logo-img" />
            cerbyl
          </h1>
          <div className="af-header-divider"></div>
          <span className="af-subtitle">ACTIVITY FEED</span>
        </div>
        <nav className="af-header-right">
          <button className="af-nav-btn af-nav-btn-ghost" onClick={() => navigate('/social')}>
            <Users size={16} />
            Social
          </button>
          <button className="af-nav-btn af-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
        </nav>
      </header>

      <div className="af-content-section">
        <div className="af-section-header">
          <h2 className="af-section-title">Friend Activity</h2>
          <div className="af-header-actions">
            <button 
              className="af-refresh-btn"
              onClick={fetchActivityFeed}
              title="Refresh feed"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              className={`af-filter-toggle-btn ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        <div className="af-stats-grid">
          <div className="af-stat-card">
            <div className="af-stat-icon af-stat-icon--accent">
              <ActivityIcon size={20} />
            </div>
            <div className="af-stat-content">
              <div className="af-stat-value">{stats.totalActivities}</div>
              <div className="af-stat-label">Total Activities</div>
            </div>
          </div>
          <div className="af-stat-card">
            <div className="af-stat-icon af-stat-icon--success">
              <Clock size={20} />
            </div>
            <div className="af-stat-content">
              <div className="af-stat-value">{stats.todayActivities}</div>
              <div className="af-stat-label">Today</div>
            </div>
          </div>
          <div className="af-stat-card">
            <div className="af-stat-icon af-stat-icon--danger">
              <Heart size={20} />
            </div>
            <div className="af-stat-content">
              <div className="af-stat-value">{stats.totalKudos}</div>
              <div className="af-stat-label">Total Kudos</div>
            </div>
          </div>
          <div className="af-stat-card">
            <div className="af-stat-icon af-stat-icon--warning">
              <Flame size={20} />
            </div>
            <div className="af-stat-content">
              <div className="af-stat-value">{stats.activeStreaks}</div>
              <div className="af-stat-label">Active Streaks</div>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="af-filters-panel">
            <div className="af-filter-section">
              <h4 className="af-filter-title">Activity Type</h4>
              <div className="af-filter-chips">
                {activityTypes.map(type => {
                  const IconComp = type.icon;
                  return (
                    <button
                      key={type.value}
                      className={`af-filter-chip ${activeFilter === type.value ? 'active' : ''}`}
                      onClick={() => setActiveFilter(type.value)}
                    >
                      <IconComp size={14} />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="af-filter-section">
              <h4 className="af-filter-title">Time Period</h4>
              <div className="af-filter-chips">
                {timeFilters.map(filter => {
                  const IconComp = filter.icon;
                  return (
                    <button
                      key={filter.value}
                      className={`af-filter-chip ${timeFilter === filter.value ? 'active' : ''}`}
                      onClick={() => setTimeFilter(filter.value)}
                    >
                      <IconComp size={14} />
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {filteredActivities.length === 0 ? (
          <div className="af-empty-feed">
            <Zap size={48} />
            <p>No activities found</p>
            <p className="af-empty-feed-hint">
              {activeFilter !== 'all' || timeFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Add more friends to see their achievements here'}
            </p>
          </div>
        ) : (
          <div className="af-activity-list">
            {filteredActivities.map(activity => {
              const IconComponent = getIconComponent(activity.icon);
              const activityColor = getActivityColor(activity.activity_type);

              return (
                <div key={activity.id} className="af-activity-card">
                  <div className="af-activity-header">
                    <div className="af-activity-user">
                      <div className="af-activity-avatar">
                        {activity.user.picture_url ? (
                          <img src={activity.user.picture_url} alt={activity.user.username} />
                        ) : (
                          <div className="af-activity-avatar-placeholder">
                            {(activity.user.first_name?.[0] || activity.user.username[0]).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="af-activity-user-info">
                        <span className="af-activity-username">
                          {activity.user.first_name && activity.user.last_name
                            ? `${activity.user.first_name} ${activity.user.last_name}`
                            : activity.user.username}
                        </span>
                        <div className="af-activity-meta-row">
                          <span className="af-activity-type-badge" style={{ 
                            background: `${activityColor}20`,
                            color: activityColor,
                            borderColor: `${activityColor}40`
                          }}>
                            {getActivityTypeLabel(activity.activity_type)}
                          </span>
                          <span className="af-activity-time">{formatTimeAgo(activity.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="af-activity-icon" style={{ color: activityColor }}>
                      <IconComponent size={28} strokeWidth={1.5} />
                    </div>
                  </div>

                  <div className="af-activity-content">
                    <h3 className="af-activity-title">{activity.title}</h3>
                    {activity.description && (
                      <p className="af-activity-description">{activity.description}</p>
                    )}

                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="af-activity-metadata">
                        {activity.metadata.winner_score !== undefined && (
                          <span className="af-metadata-tag">
                            <Trophy size={12} />
                            Score: {activity.metadata.winner_score}
                          </span>
                        )}
                        {activity.metadata.subject && (
                          <span className="af-metadata-tag">
                            <BookOpen size={12} />
                            {activity.metadata.subject}
                          </span>
                        )}
                        {activity.metadata.streak_days && (
                          <span className="af-metadata-tag">
                            <Flame size={12} />
                            {activity.metadata.streak_days} days
                          </span>
                        )}
                        {activity.metadata.difficulty && (
                          <span className="af-metadata-tag">
                            <Target size={12} />
                            {activity.metadata.difficulty}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="af-activity-footer">
                    <button
                      className={`af-kudos-button ${activity.user_gave_kudos ? 'active' : ''}`}
                      onClick={() => handleKudos(activity.id)}
                    >
                      <Heart size={16} fill={activity.user_gave_kudos ? 'currentColor' : 'none'} />
                      <span>{activity.kudos_count || 0}</span>
                    </button>

                    <button
                      className={`af-comment-button ${commentingOn === activity.id ? 'active' : ''}`}
                      onClick={() => setCommentingOn(commentingOn === activity.id ? null : activity.id)}
                    >
                      <MessageCircle size={16} />
                      <span>Comment</span>
                    </button>
                  </div>

                  {commentingOn === activity.id && (
                    <div className="af-comment-input-section">
                      <input
                        ref={commentInputRef}
                        type="text"
                        className="af-comment-input"
                        placeholder="Write a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleComment(activity.id);
                          }
                        }}
                      />
                      <button
                        className="af-send-comment-btn"
                        onClick={() => handleComment(activity.id)}
                        disabled={!commentText.trim()}
                      >
                        <Send size={16} />
                      </button>
                      <button
                        className="af-cancel-comment-btn"
                        onClick={() => {
                          setCommentingOn(null);
                          setCommentText('');
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
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