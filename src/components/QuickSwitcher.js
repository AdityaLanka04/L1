import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Clock, Star, Folder, X } from 'lucide-react';
import './QuickSwitcher.css';

const QuickSwitcher = ({ isOpen, onClose, notes, folders, onSelectNote, recentNotes = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter and sort notes
  const filteredNotes = notes.filter(note => {
    const query = searchQuery.toLowerCase();
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  }).slice(0, 10);

  // Combine recent notes with filtered results
  const displayNotes = searchQuery ? filteredNotes : recentNotes.slice(0, 5);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < displayNotes.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev > 0 ? prev - 1 : displayNotes.length - 1
      );
    } else if (e.key === 'Enter' && displayNotes[selectedIndex]) {
      e.preventDefault();
      handleSelect(displayNotes[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (note) => {
    onSelectNote(note);
    onClose();
  };

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const getFolderName = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : null;
  };

  const getSnippet = (content, query) => {
    if (!query) return '';
    const text = content.replace(/<[^>]+>/g, '').substring(0, 200);
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text.substring(0, 100) + '...';
    
    const start = Math.max(0, index - 40);
    const end = Math.min(text.length, index + query.length + 60);
    return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
  };

  if (!isOpen) return null;

  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div className="quick-switcher" onClick={(e) => e.stopPropagation()}>
        <div className="quick-switcher-header">
          <Search size={20} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search notes or type to filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="quick-switcher-input"
          />
          <button onClick={onClose} className="quick-switcher-close">
            <X size={18} />
          </button>
        </div>

        <div className="quick-switcher-results" ref={listRef}>
          {displayNotes.length === 0 && searchQuery && (
            <div className="quick-switcher-empty">
              <FileText size={48} />
              <p>No notes found</p>
              <span>Try a different search term</span>
            </div>
          )}

          {displayNotes.length === 0 && !searchQuery && (
            <div className="quick-switcher-empty">
              <Clock size={48} />
              <p>No recent notes</p>
              <span>Create a note to get started</span>
            </div>
          )}

          {displayNotes.map((note, index) => {
            const folderName = getFolderName(note.folder_id);
            const isFavorite = note.is_favorite;
            
            return (
              <div
                key={note.id}
                className={`quick-switcher-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelect(note)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="quick-switcher-item-icon">
                  <FileText size={18} />
                </div>
                <div className="quick-switcher-item-content">
                  <div className="quick-switcher-item-title">
                    {isFavorite && <Star size={14} className="favorite-icon" />}
                    {note.title}
                  </div>
                  {searchQuery && (
                    <div className="quick-switcher-item-snippet">
                      {getSnippet(note.content, searchQuery)}
                    </div>
                  )}
                  <div className="quick-switcher-item-meta">
                    {folderName && (
                      <span className="meta-folder">
                        <Folder size={12} />
                        {folderName}
                      </span>
                    )}
                    <span className="meta-date">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="quick-switcher-item-shortcut">
                  {index === selectedIndex && '↵'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="quick-switcher-footer">
          <div className="quick-switcher-hint">
            <kbd>↑</kbd><kbd>↓</kbd> Navigate
            <kbd>↵</kbd> Select
            <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickSwitcher;
