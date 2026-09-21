import useNotificationDismiss from '../hooks/useNotificationDismiss';
import { useNotifications } from '../contexts/NotificationContext';
import { notificationTime, notificationMessage } from '../utils/notificationPresentation';
import { useEffect, useState } from 'react';
import { Bell, Calendar, Award, Flame, TrendingUp, X, Zap, BookOpen, UserPlus, Users, Share2, Swords, MessageSquare, FileText, Target, Clock, Trophy, ChevronRight } from 'lucide-react';
import './SlideNotification.css';

let lastNotificationSoundAt = 0;

const playNotificationSound = () => {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  if (now - lastNotificationSoundAt < 700) return;
  lastNotificationSoundAt = now;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42);
    gain.connect(audioContext.destination);

    [880, 1175].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + index * 0.1);
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.1);
      oscillator.stop(audioContext.currentTime + 0.34 + index * 0.08);
    });

    setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 700);
  } catch (error) {
    lastNotificationSoundAt = 0;
  }
};

const SlideNotification = ({ notification, onClose, onMarkRead, style = {} }) => {
  const [visible, setVisible] = useState(false);

  const { openNotification } = useNotifications();
  const dismissEvents = useNotificationDismiss(onClose);
  useEffect(() => {
    setVisible(true);
    playNotificationSound();
  }, []);
  if (!notification) return null;
  const handleClose = () => onClose();
  const handleClick = () => { openNotification(notification); onClose(); };

  const getIcon = () => {
    switch (notification.notification_type) {
      case 'reminder':
      case 'calendar_event':
      case 'inactivity':
        return <Calendar size={20} />;
      case 'level_up':
        return <TrendingUp size={20} />;
      case 'streak_milestone':
      case 'streak_broken':
        return <Flame size={20} />;
      case 'achievement':
        return <Award size={20} />;
      case 'ai_chat_milestone':
        return <MessageSquare size={20} />;
      case 'notes_milestone':
        return <FileText size={20} />;
      case 'flashcards_milestone':
        return <BookOpen size={20} />;
      case 'questions_milestone':
        return <Target size={20} />;
      case 'quiz_milestone':
      case 'quiz_completed':
        return <Trophy size={20} />;
      case 'study_time_milestone':
        return <Clock size={20} />;
      case 'quiz_result':
      case 'quiz_excellent':
      case 'flashcard_excellent':
        return <Award size={20} />;
      case 'quiz_poor_performance':
      case 'flashcard_review':
      case 'flashcard_reviewed':
        return <BookOpen size={20} />;
      case 'flashcard_mastered':
        return <Award size={20} />;
      case 'proactive_ai':
        return <Zap size={20} />;
      case 'friend_request':
        return <UserPlus size={20} />;
      case 'friend_accepted':
      case 'friend_rejected':
      case 'friend_removed':
        return <Users size={20} />;
      case 'share_received':
      case 'content_shared':
        return <Share2 size={20} />;
      case 'battle_challenge':
      case 'battle_result':
      case 'battle_accepted':
      case 'battle_declined':
      case 'battle_started':
      case 'battle_won':
      case 'battle_lost':
      case 'battle_tied':
        return <Swords size={20} />;
      case 'challenge_completed':
      case 'challenge_joined':
        return <Trophy size={20} />;
      case 'study_insights':
      case 'welcome_insights':
        return <TrendingUp size={20} />;
      case 'welcome':
        return <Bell size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getIconColor = () => 'var(--accent)';

  const getTypeLabel = () => {
    if (notification.notification_type?.startsWith('class_')) return 'Classroom update';
    if (notification.notification_type === 'milestone') return 'Mastery milestone';
    if (notification.notification_type === 'login_return') return 'Welcome back';
    switch (notification.notification_type) {
      case 'reminder':
        return 'Reminder';
      case 'calendar_event':
        return 'Calendar Event';
      case 'inactivity':
        return 'Welcome Back';
      case 'level_up':
        return 'Level Up!';
      case 'streak_milestone':
        return 'Streak Milestone';
      case 'streak_broken':
        return 'Streak Alert';
      case 'achievement':
        return 'Achievement';
      case 'ai_chat_milestone':
        return 'AI Chat Milestone';
      case 'notes_milestone':
        return 'Notes Milestone';
      case 'flashcards_milestone':
        return 'Flashcards Milestone';
      case 'questions_milestone':
        return 'Practice Milestone';
      case 'quiz_milestone':
        return 'Quiz Milestone';
      case 'quiz_completed':
        return 'Quiz Completed';
      case 'study_time_milestone':
        return 'Study Time';
      case 'quiz_result':
      case 'quiz_excellent':
        return 'Quiz Result';
      case 'quiz_poor_performance':
        return 'Study Suggestion';
      case 'flashcard_excellent':
        return 'Flashcard Session';
      case 'flashcard_review':
      case 'flashcard_reviewed':
        return 'Study Suggestion';
      case 'flashcard_mastered':
        return 'Flashcard Mastery';
      case 'proactive_ai':
        return 'AI Tutor';
      case 'friend_request':
        return 'Friend Request';
      case 'friend_accepted':
        return 'Friend Accepted';
      case 'friend_rejected':
        return 'Friend Request';
      case 'friend_removed':
        return 'Friend Update';
      case 'share_received':
      case 'content_shared':
        return 'Shared Content';
      case 'battle_challenge':
        return 'Battle Challenge';
      case 'battle_result':
      case 'battle_accepted':
      case 'battle_declined':
      case 'battle_started':
      case 'battle_won':
      case 'battle_lost':
      case 'battle_tied':
        return 'Battle Update';
      case 'challenge_completed':
        return 'Challenge Completed';
      case 'challenge_joined':
        return 'Challenge Joined';
      case 'study_insights':
      case 'welcome_insights':
        return 'Study Insights';
      case 'welcome':
        return 'Notification';
      default:
        return 'Notification';
    }
  };

  const actionLabel = notification.notification_type === 'welcome'
    ? 'Acknowledge'
    : 'View details';

  return (
    <div className={`slide-notif ${visible ? 'show' : ''}`} style={style} {...dismissEvents}>
      <div className="slide-notif-card">
        <button
          className="slide-notif-hitarea"
          type="button"
          onClick={handleClick}
          aria-label={`${getTypeLabel()}: ${notification.title}. ${actionLabel}`}
        />
        <div className="slide-notif-header">
          <div className="slide-notif-icon" style={{ color: getIconColor() }}>
            {getIcon()}
          </div>
          <div className="slide-notif-title">
            <span className="slide-notif-type">{getTypeLabel()}</span>
            <span className="slide-notif-time">{notificationTime(notification.created_at)}</span>
          </div>
          <button 
            className="slide-notif-close" 
            onClick={(e) => { e.stopPropagation(); handleClose(false); }}
            aria-label="Dismiss notification"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="slide-notif-body">
          <h4 className="slide-notif-heading">{notification.title}</h4>
          <p className="slide-notif-message">{notificationMessage(notification)}</p>
        </div>
        <div className="slide-notif-footer">
          <span className="slide-notif-action">{actionLabel}</span>
          <ChevronRight className="slide-notif-action-icon" size={16} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};

export default SlideNotification;
