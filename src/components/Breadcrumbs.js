import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import './Breadcrumbs.css';

const Breadcrumbs = ({ path, onNavigate }) => {
  // path is an array of { id, title } objects
  if (!path || path.length === 0) return null;

  return (
    <div className="breadcrumbs">
      <button 
        className="breadcrumb-item breadcrumb-home"
        onClick={() => onNavigate(null)}
        title="Home"
      >
        <Home size={16} />
      </button>
      
      {path.map((item, index) => (
        <React.Fragment key={item.id}>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <button
            className={`breadcrumb-item ${index === path.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={item.title}
          >
            {item.title}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumbs;
