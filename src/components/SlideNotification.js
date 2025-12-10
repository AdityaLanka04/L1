import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Award, Flame, TrendingUp, X, Zap, BookOpen } from 'lucide-react';
import './SlideNotification.css';

const SlideNotification = ({ notification, onClose, onMarkRead, style = {} }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show notification after brief delay
    setTimeout(() => setVisible(true), 100);

    // Auto-dismiss after 15 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

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
