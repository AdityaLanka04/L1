import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProactiveNotification.css';

const ProactiveNotification = ({ message, chatId, onClose }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show notification after brief delay
    setTimeout(() => setVisible(true), 100);

    // Auto-dismiss after 30 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const handleClick = () => {
    if (chatId) {
      navigate(`/ai-chat/${chatId}`);
    } else {
      navigate('/ai-chat');
    }
    handleClose();
  };

  return (
    <div className={`proactive-notif ${visible ? 'show' : ''}`}>
      <div className="proactive-notif-card">
        <div className="proactive-notif-header">
          <div className="proactive-notif-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" fill="none" />
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" fill="none" />
            </svg>
          </div>
          <div className="proactive-notif-title">
            <span className="proactive-notif-name">Cerbyl AI</span>
            <span className="proactive-notif-time">Just now</span>
          </div>
          <button 
            className="proactive-notif-close" 
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
          >
            ×
          </button>
        </div>
        <div className="proactive-notif-body">
          <p>{message}</p>
          <button 
            className="proactive-notif-cta"
            onClick={handleClick}
          >
            Open AI Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProactiveNotification;
