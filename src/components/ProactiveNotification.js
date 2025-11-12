import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProactiveNotification.css';

const ProactiveNotification = ({ message, chatId, onClose, urgencyScore }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 100);

    // Auto-dismiss after 10 seconds (unless high urgency)
    const dismissTime = urgencyScore > 0.7 ? 15000 : 10000;
    const timer = setTimeout(() => {
      handleClose();
    }, dismissTime);

    return () => clearTimeout(timer);
  }, [urgencyScore]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleClick = () => {
    // Navigate to AI chat with the proactive message
    navigate(`/ai-chat?session=${chatId}&proactive=true`);
    handleClose();
  };

  return (
    <div className={`proactive-notification ${isVisible ? 'visible' : ''} ${isExiting ? 'exiting' : ''}`}>
      <div className="proactive-notification-content" onClick={handleClick}>
        <div className="proactive-notification-header">
          <div className="proactive-ai-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="url(#gradient)" />
              <path d="M8 10h2M14 10h2M8 14c0 2 1.5 3 4 3s4-1 4-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="24" y2="24">
                  <stop offset="0%" stopColor="#667eea" />
                  <stop offset="100%" stopColor="#764ba2" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="proactive-notification-title">
            <span className="proactive-badge">AI reached out</span>
            <span className="proactive-time">Just now</span>
          </div>
          <button className="proactive-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        
        <div className="proactive-notification-body">
          <p className="proactive-message">{message}</p>
          <div className="proactive-cta">
            <span className="proactive-cta-text">Tap to open chat</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProactiveNotification;
