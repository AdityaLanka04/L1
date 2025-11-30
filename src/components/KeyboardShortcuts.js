import React, { useState, useEffect } from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import './KeyboardShortcuts.css';

const KeyboardShortcuts = ({ isOpen, onClose }) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';
  const shiftKey = isMac ? '⇧' : 'Shift';

  const shortcuts = [
    {
      category: 'General',
      items: [
        { keys: [modKey, 'S'], description: 'Save note' },
        { keys: [modKey, 'P'], description: 'Print note' },
        { keys: [modKey, 'K'], description: 'Quick search' },
        { keys: [modKey, 'N'], description: 'New note' },
        { keys: [modKey, 'D'], description: 'Duplicate note' },
        { keys: [modKey, 'E'], description: 'Export note' },
        { keys: [modKey, 'F'], description: 'Find in note' },
        { keys: [modKey, 'H'], description: 'Find and replace' },
        { keys: [modKey, '/'], description: 'Show shortcuts' },
        { keys: ['Esc'], description: 'Close dialogs' },
      ]
    },
    {
      category: 'Navigation',
      items: [
        { keys: [modKey, '←'], description: 'Previous note' },
        { keys: [modKey, '→'], description: 'Next note' },
        { keys: [modKey, '↑'], description: 'Scroll to top' },
        { keys: [modKey, '↓'], description: 'Scroll to bottom' },
        { keys: [modKey, 'B'], description: 'Toggle sidebar' },
        { keys: [modKey, '\\'], description: 'Toggle focus mode' },
        { keys: [altKey, '1'], description: 'Go to Dashboard' },
        { keys: [altKey, '2'], description: 'Go to AI Chat' },
        { keys: [altKey, '3'], description: 'Go to Notes' },
      ]
    },
    {
      category: 'Text Formatting',
      items: [
        { keys: [modKey, 'B'], description: 'Bold' },
        { keys: [modKey, 'I'], description: 'Italic' },
        { keys: [modKey, 'U'], description: 'Underline' },
        { keys: [modKey, shiftKey, 'X'], description: 'Strikethrough' },
        { keys: [modKey, 'L'], description: 'Insert link' },
        { keys: [modKey, shiftKey, 'C'], description: 'Code block' },
        { keys: [modKey, shiftKey, 'K'], description: 'Inline code' },
        { keys: [modKey, shiftKey, 'Q'], description: 'Quote' },
        { keys: [modKey, shiftKey, '7'], description: 'Ordered list' },
        { keys: [modKey, shiftKey, '8'], description: 'Bullet list' },
        { keys: [modKey, shiftKey, '9'], description: 'Checklist' },
      ]
    },
    {
      category: 'Headings',
      items: [
        { keys: [modKey, altKey, '1'], description: 'Heading 1' },
        { keys: [modKey, altKey, '2'], description: 'Heading 2' },
        { keys: [modKey, altKey, '3'], description: 'Heading 3' },
        { keys: [modKey, altKey, '0'], description: 'Normal text' },
      ]
    },
    {
      category: 'View & Display',
      items: [
        { keys: [modKey, shiftKey, 'F'], description: 'Fullscreen mode' },
        { keys: [modKey, shiftKey, 'P'], description: 'Preview mode' },
        { keys: [modKey, shiftKey, 'E'], description: 'Edit mode' },
        { keys: [modKey, shiftKey, 'D'], description: 'Toggle dark editor' },
        { keys: [modKey, shiftKey, 'L'], description: 'Toggle light editor' },
        { keys: [modKey, '='], description: 'Zoom in' },
        { keys: [modKey, '-'], description: 'Zoom out' },
        { keys: [modKey, '0'], description: 'Reset zoom' },
      ]
    },
    {
      category: 'Organization',
      items: [
        { keys: [modKey, shiftKey, 'T'], description: 'Add tag' },
        { keys: [modKey, shiftKey, 'F'], description: 'Toggle favorite' },
        { keys: [modKey, shiftKey, 'M'], description: 'Move to folder' },
        { keys: [modKey, shiftKey, 'A'], description: 'Archive note' },
        { keys: [modKey, shiftKey, 'Delete'], description: 'Delete note' },
      ]
    },
    {
      category: 'Advanced',
      items: [
        { keys: [modKey, 'Z'], description: 'Undo' },
        { keys: [modKey, shiftKey, 'Z'], description: 'Redo' },
        { keys: [modKey, 'A'], description: 'Select all' },
        { keys: [modKey, 'C'], description: 'Copy' },
        { keys: [modKey, 'X'], description: 'Cut' },
        { keys: [modKey, 'V'], description: 'Paste' },
        { keys: [modKey, shiftKey, 'V'], description: 'Paste plain text' },
        { keys: ['Tab'], description: 'Indent' },
        { keys: [shiftKey, 'Tab'], description: 'Outdent' },
      ]
    }
  ];

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <div className="shortcuts-title-section">
            <Keyboard size={24} className="shortcuts-icon" />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button className="shortcuts-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="shortcuts-content">
          {shortcuts.map((section, idx) => (
            <div key={idx} className="shortcuts-section">
              <h3 className="shortcuts-category">{section.category}</h3>
              <div className="shortcuts-list">
                {section.items.map((shortcut, itemIdx) => (
                  <div key={itemIdx} className="shortcut-item">
                    <span className="shortcut-description">{shortcut.description}</span>
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          <kbd className="shortcut-key">{key}</kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="key-separator">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <p>Press <kbd className="shortcut-key">{modKey}</kbd> + <kbd className="shortcut-key">/</kbd> to toggle this panel</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
