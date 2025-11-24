import React from 'react';
import { Link2, FileText, ArrowRight } from 'lucide-react';
import './BacklinksPanel.css';

const BacklinksPanel = ({ backlinks, onNoteClick }) => {
  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <Link2 size={16} />
        <h4>Backlinks</h4>
        <span className="backlinks-count">{backlinks.length}</span>
      </div>

      <div className="backlinks-list">
        {backlinks.length === 0 && (
          <div className="backlinks-empty">
            <Link2 size={32} />
            <p>No backlinks</p>
            <span>Other notes that link here will appear here</span>
          </div>
        )}

        {backlinks.map(note => (
          <div
            key={note.id}
            className="backlink-item"
            onClick={() => onNoteClick(note)}
          >
            <FileText size={16} className="backlink-icon" />
            <div className="backlink-content">
              <div className="backlink-title">{note.title}</div>
              <div className="backlink-date">
                {new Date(note.updated_at).toLocaleDateString()}
              </div>
            </div>
            <ArrowRight size={14} className="backlink-arrow" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BacklinksPanel;
