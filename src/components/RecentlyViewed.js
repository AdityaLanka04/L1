import React from 'react';
import { Clock, FileText } from 'lucide-react';
import './RecentlyViewed.css';

const RecentlyViewed = ({ items, onSelect, onClose, darkMode = false }) => {
  if (!items || items.length === 0) {
    return (
      <div className="recently-viewed-empty">
        <Clock size={32} />
        <p>No recently viewed pages</p>
      </div>
    );
  }

  const formatTime = (timestamp) => {
    const now = new Date();
    const viewed = new Date(timestamp);
    const diffMs = now - viewed;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return viewed.toLocaleDateString();
  };

  return (
    <div className="recently-viewed">
      <div className="recently-viewed-header">
        <Clock size={18} />
        <span>Recently Viewed</span>
      </div>
      
      <div className="recently-viewed-list">
        {items.map((item) => (
          <button
            key={item.id}
            className="recently-viewed-item"
            onClick={() => {
              onSelect(item.id);
              if (onClose) onClose();
            }}
          >
            <div className="item-icon">
              <FileText size={16} />
            </div>
            <div className="item-content">
              <div className="item-title">{item.title || 'Untitled'}</div>
              <div className="item-time">{formatTime(item.viewedAt)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentlyViewed;
