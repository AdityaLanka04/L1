
import React, { useState, useEffect } from 'react';
import { BookOpen, FileText } from 'lucide-react';
import './ContextSelector.css';

const ContextSelector = ({ hsMode, docCount = 0, onOpen }) => {
  const [docLabel, setDocLabel] = useState(null);

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem('ctx_selected_doc_ids') || '[]');
      if (!ids.length) { setDocLabel(null); return; }
      const username = localStorage.getItem('username') || localStorage.getItem('email') || 'anonymous';
      const map = JSON.parse(localStorage.getItem(`ctx_doc_names_${username}`) || '{}');
      const names = ids.map(id => map[String(id)]).filter(Boolean);
      if (names.length === 1) {
        const stripped = names[0].replace(/\.[^.]+$/, '');
        setDocLabel(stripped.length > 20 ? stripped.slice(0, 20) + '…' : stripped);
      } else if (names.length > 1) {
        setDocLabel(`${ids.length} docs`);
      } else {
        setDocLabel(null);
      }
    } catch {
      setDocLabel(null);
    }
  }, [docCount]);

  const hasDoc = !hsMode && docLabel;

  return (
    <button
      className={`context-selector-btn ${hsMode ? 'hs-active' : ''} ${hasDoc ? 'has-doc' : ''}`}
      onClick={onOpen}
      aria-label="Open context panel"
    >
      {hasDoc ? <FileText size={14} /> : <BookOpen size={14} />}
      <span className="cs-label">
        {hsMode ? 'HS Mode' : hasDoc ? docLabel : 'Context'}
      </span>
      {hsMode && <span className="cs-hs-dot" />}
      {!hsMode && !docLabel && docCount > 0 && (
        <span className="cs-doc-badge">{docCount}</span>
      )}
    </button>
  );
};

export default ContextSelector;
