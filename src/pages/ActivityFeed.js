import { useState, useEffect, useRef } from 'react';
import {
  Trophy, Target, Flame, TrendingUp, Heart, Award, Zap, Star,
  MessageCircle, Send, X, BookOpen,
  Brain, CheckCircle, Clock, Calendar, Sparkles, TrendingDown,
  Activity as ActivityIcon, RefreshCw
} from 'lucide-react';
import './ActivityFeed.css';
import SocialHubChrome from '../components/SocialHubChrome';
import { API_URL } from '../config';
import { formatCompactRelativeTime } from '../utils/dateUtils';

const ACTIVITY_COLORS = {
  achievement: '#D7B38C',
  milestone: '#22c55e',
  streak: '#F59E0B',
  quiz_completed: '#8B5CF6',
  quiz_battle_won: '#22c55e',
  note_created: '#3B82F6',
  flashcard_created: '#EC4899',
  study_session: '#10B981',
  learning_path: '#F59E0B',
};

const ACTIVITY_LABELS = {
  achievement: 'Achievement',
  milestone: 'Milestone',
  streak: 'Streak',
  quiz_completed: 'Quiz',
  quiz_battle_won: 'Battle Victory',
  note_created: 'Note',
  flashcard_created: 'Flashcard',
  study_session: 'Study Session',
  learning_path: 'Learning Path',
};

const ACTIVITY_TYPES = [
  { value: 'all', label: 'All Activities', icon: ActivityIcon },
  { value: 'achievement', label: 'Achievements', icon: Trophy },
  { value: 'streak', label: 'Streaks', icon: Flame },
  { value: 'quiz_completed', label: 'Quizzes', icon: Brain },
  { value: 'quiz_battle_won', label: 'Battles', icon: Zap },
  { value: 'milestone', label: 'Milestones', icon: Target },
];

const TIME_FILTERS = [
  { value: 'all', label: 'All Time', icon: Calendar },
  { value: 'today', label: 'Today', icon: Clock },
  { value: 'week', label: 'This Week', icon: TrendingUp },
  { value: 'month', label: 'This Month', icon: TrendingDown },
];

const GEO_SVG = (
  <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
    <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
    <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
    <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
    <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
    <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
    <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
    <circle cx="600" cy="40" r="5" fill="currentColor"/>
    <circle cx="600" cy="760" r="5" fill="currentColor"/>
    <circle cx="240" cy="400" r="5" fill="currentColor"/>
    <circle cx="960" cy="400" r="5" fill="currentColor"/>
    <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
    <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
    <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
    <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
  </svg>
);

const ActivityFeed = () => {
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
    const token = localStorage.getItem('token');
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
    const token = localStorage.getItem('token');
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

  const handleComment = (activityId) => {
    if (!commentText.trim()) return;
    setCommentText('');
    setCommentingOn(null);
    alert('Comment feature coming soon!');
  };

  const getIconComponent = (iconName) => {
    const icons = {
      Trophy, Target, Flame, TrendingUp, Award, Zap, Star,
      BookOpen, Brain, CheckCircle, Sparkles, ActivityIcon
    };
    return icons[iconName] || Trophy;
  };

  const activityChromeProps = {
    title: 'Activity Feed',
    tagline: 'friend activity',
    activeKey: 'activity',
    primaryAction: {
      label: 'Refresh Feed',
      icon: <RefreshCw size={14} />,
      onClick: fetchActivityFeed,
    },
    sideSections: [
      {
        label: 'Activity Type',
        children: (
          <nav className="shc-view-nav" aria-label="Activity type filters">
            {ACTIVITY_TYPES.map(type => {
              const IconComp = type.icon;
              return (
                <button key={type.value} className={`shc-view-link ${activeFilter === type.value ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setActiveFilter(type.value)}>
                  <IconComp size={16} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </nav>
        ),
      },
      {
        label: 'Time Period',
        children: (
          <nav className="shc-view-nav" aria-label="Time period filters">
            {TIME_FILTERS.map(filter => {
              const IconComp = filter.icon;
              return (
                <button key={filter.value} className={`shc-view-link ${timeFilter === filter.value ? 'shc-view-link--active' : ''}`} type="button" onClick={() => setTimeFilter(filter.value)}>
                  <IconComp size={16} />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </nav>
        ),
      },
    ],
    stats: [
      { label: 'Total', value: stats.totalActivities },
      { label: 'Today', value: stats.todayActivities },
      { label: 'Kudos', value: stats.totalKudos },
      { label: 'Streaks', value: stats.activeStreaks },
    ],
  };

  if (loading) {
    return (
      <div className="activity-feed-page with-social-chrome">
        {GEO_SVG}
        <SocialHubChrome {...activityChromeProps}>
          <main className="af-main">
            <div className="af-content">
              <div className="af-loading-text">Loading activity feed...</div>
            </div>
          </main>
        </SocialHubChrome>
      </div>
    );
  }

  return (
    <div className="activity-feed-page with-social-chrome">
      {GEO_SVG}

      <SocialHubChrome {...activityChromeProps}>
        <main className="af-main">
          <div className="af-content">
            <div className="af-content-header">
              <div className="view-heading">
                <span className="view-kicker">Social</span>
                <h2 className="view-title">Friend Activity</h2>
                <p className="view-sub">{filteredActivities.length} activit{filteredActivities.length !== 1 ? 'ies' : 'y'}</p>
              </div>
              <button className="af-refresh-btn" onClick={fetchActivityFeed} title="Refresh feed">
                <RefreshCw size={16} />
              </button>
            </div>

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
              const activityColor = ACTIVITY_COLORS[activity.activity_type] || '#D7B38C';

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
                            {ACTIVITY_LABELS[activity.activity_type] || 'Activity'}
                          </span>
                          <span className="af-activity-time">{formatCompactRelativeTime(activity.created_at)}</span>
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
        </main>
      </SocialHubChrome>
    </div>
  );
};

export default ActivityFeed;
