import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Award, Flame, TrendingUp, X, Zap, BookOpen, UserPlus, Users, Share2, Swords } from 'lucide-react';
import './SlideNotification.css';

const SlideNotification = ({ notification, onClose, onMarkRead, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Validate notification
    if (!notification || !notification.id || (!notification.title && !notification.message)) {
      console.log('📬 Invalid notification, closing:', notification);
      setIsValid(false);
      if (onClose) {
        setTimeout(() => onClose(), 0);
      }
      return;
    }

    // Show notification immediately (no delay)
    setVisible(true);

    // Auto-dismiss after 12 seconds
    const dismissTimer = setTimeout(() => {
      handleClose();
    }, 12000);

    return () => {
      clearTimeout(dismissTimer);
    };
  }, [notification]);

  // Don't render if invalid
  if (!isValid || !notification || !notification.id) {
    return null;
  }

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      if (onMarkRead && notification.id) {
        onMarkRead(notification.id);
      }
      onClose();
    }, 300);
  };

  const handleClick = () => {
    // Navigate based on notification type
    switch (notification.notification_type) {
      case 'reminder':
      case 'calendar_event':
        navigate('/activity-timeline');
        break;
      case 'level_up':
      case 'streak_milestone':
      case 'streak_broken':
      case 'achievement':
        navigate('/profile');
        break;
      case 'quiz_result':
      case 'quiz_excellent':
      case 'quiz_poor_performance':
        navigate('/quiz-hub');
        break;
      case 'flashcard_excellent':
      case 'flashcard_review':
        navigate('/flashcards');
        break;
      case 'proactive_ai':
        navigate('/ai-chat');
        break;
      case 'friend_request':
      case 'friend_accepted':
      case 'friend_rejected':
        navigate('/friends');
        break;
      case 'share_received':
      case 'content_shared':
        navigate('/social');
        break;
      case 'battle_challenge':
      case 'battle_result':
        navigate('/quiz-battle');
        break;
      case 'study_insights':
      case 'welcome_insights':
        navigate('/study-insights');
        break;
      case 'welcome':
        // For welcome notifications without insights, stay on dashboard
        break;
      default:
        navigate('/dashboard');
    }
    handleClose();
  };

  const getIcon = () => {
    switch (notification.notification_type) {
      case 'reminder':
      case 'calendar_event':
        return <Calendar size={20} />;
      case 'level_up':
        return <TrendingUp size={20} />;
      case 'streak_milestone':
      case 'streak_broken':
        return <Flame size={20} />;
      case 'achievement':
        return <Award size={20} />;
      case 'quiz_result':
      case 'quiz_excellent':
      case 'flashcard_excellent':
        return <Award size={20} />;
      case 'quiz_poor_performance':
      case 'flashcard_review':
        return <BookOpen size={20} />;
      case 'proactive_ai':
        return <Zap size={20} />;
      case 'friend_request':
        return <UserPlus size={20} />;
      case 'friend_accepted':
      case 'friend_rejected':
        return <Users size={20} />;
      case 'share_received':
      case 'content_shared':
        return <Share2 size={20} />;
      case 'battle_challenge':
      case 'battle_result':
        return <Swords size={20} />;
      case 'study_insights':
      case 'welcome_insights':
        return <TrendingUp size={20} />;
      case 'welcome':
        return <Bell size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getIconColor = () => {
    switch (notification.notification_type) {
      case 'reminder':
      case 'calendar_event':
        return '#3b82f6';
      case 'level_up':
        return '#10b981';
      case 'streak_milestone':
        return '#f59e0b';
      case 'streak_broken':
        return '#ef4444';
      case 'achievement':
        return '#8b5cf6';
      case 'quiz_excellent':
      case 'flashcard_excellent':
        return '#10b981';
      case 'quiz_poor_performance':
      case 'flashcard_review':
        return '#f59e0b';
      case 'proactive_ai':
        return '#06b6d4';
      case 'friend_request':
        return '#3b82f6';
      case 'friend_accepted':
        return '#10b981';
      case 'friend_rejected':
        return '#ef4444';
      case 'share_received':
      case 'content_shared':
        return '#8b5cf6';
      case 'battle_challenge':
      case 'battle_result':
        return '#f59e0b';
      case 'study_insights':
      case 'welcome_insights':
        return '#8b5cf6';
      case 'welcome':
        return 'var(--accent)';
      default:
        return 'var(--accent)';
    }
  };

  const getTypeLabel = () => {
    switch (notification.notification_type) {
      case 'reminder':
        return 'Reminder';
      case 'calendar_event':
        return 'Calendar Event';
      case 'level_up':
        return 'Level Up!';
      case 'streak_milestone':
        return 'Streak Milestone';
      case 'streak_broken':
        return 'Streak Alert';
      case 'achievement':
        return 'Achievement';
      case 'quiz_result':
      case 'quiz_excellent':
        return 'Quiz Result';
      case 'quiz_poor_performance':
        return 'Study Suggestion';
      case 'flashcard_excellent':
        return 'Flashcard Session';
      case 'flashcard_review':
        return 'Study Suggestion';
      case 'proactive_ai':
        return 'AI Tutor';
      case 'friend_request':
        return 'Friend Request';
      case 'friend_accepted':
        return 'Friend Accepted';
      case 'friend_rejected':
        return 'Friend Request';
      case 'share_received':
      case 'content_shared':
        return 'Shared Content';
      case 'battle_challenge':
        return 'Battle Challenge';
      case 'battle_result':
        return 'Battle Result';
      case 'study_insights':
      case 'welcome_insights':
        return 'Study Insights';
      case 'welcome':
        return 'Notification';
      default:
        return 'Notification';
    }
  };

  return (
    <div className={`slide-notif ${visible ? 'show' : ''}`} style={style}>
      <div className="slide-notif-card" onClick={handleClick}>
        <div className="slide-notif-header">
          <div 
            className="slide-notif-icon"
            style={{ background: getIconColor() }}
          >
            {getIcon()}
          </div>
          <div className="slide-notif-title">
            <span className="slide-notif-type">{getTypeLabel()}</span>
            <span className="slide-notif-time">Just now</span>
          </div>
          <button 
            className="slide-notif-close" 
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="slide-notif-body">
          <h4 className="slide-notif-heading">{notification.title}</h4>
          <p className="slide-notif-message">{notification.message}</p>
        </div>
        <div className="slide-notif-footer">
          <span className="slide-notif-action">Click to view</span>
        </div>
      </div>
    </div>
  );
};

export default SlideNotification;
