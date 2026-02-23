import React from 'react';
import { BookOpen } from 'lucide-react';
import './ContextSelector.css';

/**
 * ContextSelector — compact header button that opens the ContextPanel.
 *
 * Props:
 *   hsMode   {boolean}  — shows green active state when true
 *   docCount {number}   — shows gray count badge when > 0 and !hsMode
 *   onOpen   {function} — called when the button is clicked
 */
const ContextSelector = ({ hsMode, docCount = 0, onOpen }) => (
  <button
    className={`context-selector-btn ${hsMode ? 'hs-active' : ''}`}
    onClick={onOpen}
    title={hsMode ? 'HS Mode active — click to manage' : 'Context & HS Mode'}
    aria-label="Open context panel"
  >
    <BookOpen size={14} />
    <span className="cs-label">Context</span>
    {hsMode && <span className="cs-hs-dot" />}
    {!hsMode && docCount > 0 && <span className="cs-doc-badge">{docCount}</span>}
  </button>
);

export default ContextSelector;
