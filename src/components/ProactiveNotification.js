import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, MessageCircle, X } from 'lucide-react';
import './ProactiveNotification.css';

const ProactiveNotification = ({ message, chatId, onClose }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    
    setTimeout(() => setVisible(true), 100);
    
    
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
            <Bot size={18} />
          </div>
          <div className="proactive-notif-title">
            <span className="proactive-notif-name">Cerbyl AI</span>
            <span className="proactive-notif-time">Just now</span>
          </div>
          <button 
            className="proactive-notif-close" 
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            aria-label="Dismiss AI notification"
            type="button"
          >
            <X size={15} />
          </button>
        </div>
        <div className="proactive-notif-body">
          <p>{message}</p>
          <button 
            className="proactive-notif-cta"
            onClick={handleClick}
            type="button"
          >
            <MessageCircle size={15} />
            Open AI Chat
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProactiveNotification;
