import React from 'react';
import { BookOpen } from 'lucide-react';
import './ContextSelector.css';

const ContextSelector = ({ hsMode, docCount = 0, onOpen }) => (
  <button
    className={`context-selector-btn ${hsMode ? 'hs-active' : ''}`}
    onClick={onOpen}
    aria-label="Open context panel"
  >
    <BookOpen size={14} />
    <span className="cs-label">Context</span>
    {hsMode && <span className="cs-hs-dot" />}
    {!hsMode && docCount > 0 && <span className="cs-doc-badge">{docCount}</span>}
  </button>
);

export default ContextSelector;
