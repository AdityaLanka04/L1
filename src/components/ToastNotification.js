import React, { useEffect, useState } from 'react';
import './ToastNotification.css';
import { Bell, CheckCircle, AlertCircle, Award, TrendingUp, Zap } from 'lucide-react';

const ToastNotification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-dismiss after 5 seconds
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
        return <CheckCircle size={24} color="#10B981" />;
      case 'quiz_poor_performance':
        return <AlertCircle size={24} color="#F59E0B" />;
      case 'milestone':
      case 'achievement':
        return <Award size={24} color="#D7B38C" />;
      case 'level_up':
        return <TrendingUp size={24} color="#D7B38C" />;
      case 'streak_milestone':
        return <Zap size={24} color="#10B981" />;
      case 'battle_won':
        return <Award size={24} color="#10B981" />;
      default:
        return <Bell size={24} color="#D7B38C" />;
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
      <button className="toast-close" onClick={handleClose}>
        ×
      </button>
    </div>
  );
};

export default ToastNotification;
