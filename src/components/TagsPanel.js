import React from 'react';
import { Tag, X } from 'lucide-react';
import './TagsPanel.css';

const TagsPanel = ({ tags, selectedTag, onTagSelect, onClose }) => {
  const tagCounts = tags.reduce((acc, tag) => {
    acc[tag.name] = (acc[tag.name] || 0) + 1;
    return acc;
  }, {});

  const uniqueTags = Object.keys(tagCounts).sort();

  return (
    <div className="tags-panel">
      <div className="tags-panel-header">
        <div className="tags-panel-title">
          <Tag size={18} />
          <h3>Tags</h3>
          <span className="tags-count">{uniqueTags.length}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="tags-panel-close">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="tags-list">
        {uniqueTags.length === 0 && (
          <div className="tags-empty">
            <Tag size={32} />
            <p>No tags yet</p>
            <span>Add #tags to your notes</span>
          </div>
        )}

        {uniqueTags.map(tag => (
          <div
            key={tag}
            className={`tag-item ${selectedTag === tag ? 'active' : ''}`}
            onClick={() => onTagSelect(tag)}
          >
            <span className="tag-name">#{tag}</span>
            <span className="tag-count">{tagCounts[tag]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagsPanel;
