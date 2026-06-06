import { useEffect, useState } from 'react';
import './ToastNotification.css';
import { Bell, CheckCircle, AlertCircle, Award, TrendingUp, Zap, X } from 'lucide-react';

const ToastNotification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    
    setTimeout(() => setIsVisible(true), 100);

    
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (notification.notification_type) {
      case 'quiz_excellent':
        return <CheckCircle size={18} />;
      case 'quiz_poor_performance':
        return <AlertCircle size={18} />;
      case 'milestone':
      case 'achievement':
        return <Award size={18} />;
      case 'level_up':
        return <TrendingUp size={18} />;
      case 'streak_milestone':
        return <Zap size={18} />;
      case 'battle_won':
        return <Award size={18} />;
      default:
        return <Bell size={18} />;
    }
  };

  return (
    <div className={`toast-notification ${isVisible ? 'visible' : ''} ${isExiting ? 'exiting' : ''}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-content">
        <h4 className="toast-title">{notification.title}</h4>
        <p className="toast-message">{notification.message}</p>
      </div>
      <button className="toast-close" onClick={handleClose} aria-label="Dismiss notification" type="button">
        <X size={15} />
      </button>
    </div>
  );
};

export default ToastNotification;
