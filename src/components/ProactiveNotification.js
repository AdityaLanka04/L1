import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProactiveNotification.css';

const ProactiveNotification = ({ message, chatId, onClose, urgencyScore }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();

  console.log('🔔 ProactiveNotification COMPONENT RENDERED!', { message, chatId, urgencyScore });
  console.log('🔔 Component props:', { message, chatId, onClose, urgencyScore });

  useEffect(() => {
    console.log('🔔 ProactiveNotification MOUNTED! Setting visible in 100ms...');
    // Slide in animation
    const timer = setTimeout(() => {
      console.log('🔔 Setting isVisible to TRUE now!');
      setIsVisible(true);
      console.log('🔔 Notification should now be visible!');
    }, 100);

    // Play notification sound (optional - can be enabled later)
    // const audio = new Audio('/notification.mp3');
    // audio.volume = 0.3;
    // audio.play().catch(() => {}); // Ignore if autoplay is blocked

    // Auto-dismiss after 20 seconds (unless high urgency)
    const dismissTime = urgencyScore > 0.7 ? 30000 : 20000;
    console.log(`🔔 Will auto-dismiss in ${dismissTime}ms`);
    const dismissTimer = setTimeout(() => {
      console.log('🔔 Auto-dismissing notification');
      handleClose();
    }, dismissTime);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [urgencyScore]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleClick = () => {
    console.log('🔔 Navigating to AI chat with session:', chatId);
    // Navigate to AI chat with the proactive message session
    if (chatId && chatId !== 'test-chat') {
      navigate(`/ai-chat/${chatId}`);
    } else {
      navigate('/ai-chat');
    }
    handleClose();
  };

  return (
    <div className={`proactive-notification ${isVisible ? 'visible' : ''} ${isExiting ? 'exiting' : ''} ${urgencyScore > 0.7 ? 'high-urgency' : ''}`}>
      <div className="proactive-notification-content" onClick={handleClick}>
        <div className="proactive-notification-header">
          <div className="proactive-ai-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" opacity="0.9"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
            </svg>
          </div>
          <div className="proactive-notification-title">
            <span className="proactive-badge">Cerbyl AI</span>
            <span className="proactive-time">Just now</span>
          </div>
          <button className="proactive-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        
        <div className="proactive-notification-body">
          <p className="proactive-message">{message}</p>
          <div className="proactive-cta">
            <span className="proactive-cta-text">Click to Open Chat</span>
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
