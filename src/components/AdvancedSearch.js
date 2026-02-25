import React, { useState, useEffect } from 'react';
import { X, Search, Clock, Calendar, Folder, Info } from 'lucide-react';
import './AdvancedSearch.css';

const AdvancedSearch = ({ notes, folders, onSelectNote, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    setSearchHistory(history);
  }, []);

  const saveToHistory = (query) => {
    if (!query.trim()) return;
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    const newHistory = [query, ...history.filter(h => h !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    setSearchHistory(newHistory);
  };

  const clearHistory = () => {
    localStorage.removeItem('searchHistory');
    setSearchHistory([]);
  };

  const performSearch = () => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    saveToHistory(searchQuery);

    let filtered = [...notes];

    
    if (selectedFolder !== 'all') {
      if (selectedFolder === 'none') {
        filtered = filtered.filter(n => !n.folder_id);
      } else {
        filtered = filtered.filter(n => n.folder_id === parseInt(selectedFolder));
      }
    }

    
    if (dateFrom) {
      filtered = filtered.filter(n => new Date(n.updated_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(n => new Date(n.updated_at) <= new Date(dateTo));
    }

    
    const searchPattern = useRegex 
      ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
      : null;

    filtered = filtered.filter(note => {
      
      let titleMatch = false;
      if (useRegex) {
        titleMatch = searchPattern.test(note.title);
      } else {
        titleMatch = caseSensitive 
          ? note.title.includes(searchQuery)
          : note.title.toLowerCase().includes(searchQuery.toLowerCase());
      }

      
      const content = note.content.replace(/<[^>]+>/g, '');
      let contentMatch = false;
      if (useRegex) {
        contentMatch = searchPattern.test(content);
      } else {
        contentMatch = caseSensitive
          ? content.includes(searchQuery)
          : content.toLowerCase().includes(searchQuery.toLowerCase());
      }

      return titleMatch || contentMatch;
    });

    setResults(filtered);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) performSearch();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedFolder, dateFrom, dateTo, caseSensitive, useRegex]);

  const getPreview = (content, query) => {
    const text = content.replace(/<[^>]+>/g, '');
    if (!query) return text.substring(0, 150) + '...';
    
    const index = caseSensitive 
      ? text.indexOf(query)
      : text.toLowerCase().indexOf(query.toLowerCase());
    
    if (index === -1) return text.substring(0, 150) + '...';
    
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + query.length + 90);
    return (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
  };

  return (
    <div className="advanced-search-modal">
        <div className="advanced-search-header">
          <h2>Search All Notes</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="search-info-banner">
          <Info size={16} />
          <span>Search across all your notes by title and content</span>
        </div>

        <div className="advanced-search-content">
          <div className="search-input-group">
            <label>Search Query</label>
            <input
              type="text"
              className="search-main-input"
              placeholder="Type to search across all notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="search-filters">
            <div className="filter-group">
              <label>
                <Folder size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Filter by Folder
              </label>
              <select
                className="filter-select"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
              >
                <option value="all">All Folders</option>
                <option value="none">Unfiled Notes</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Last Modified From
              </label>
              <input
                type="date"
                className="filter-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Last Modified To
              </label>
              <input
                type="date"
                className="filter-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="search-options">
            <label className="search-option">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
              />
              Case sensitive
            </label>
            <label className="search-option">
              <input
                type="checkbox"
                checked={useRegex}
                onChange={(e) => setUseRegex(e.target.checked)}
              />
              Use regex (advanced)
            </label>
          </div>

          {searchQuery && (
            <div className="search-results-section">
              <div className="search-results-header">
                <h3>Results</h3>
                <span className="results-count">{results.length} note{results.length !== 1 ? 's' : ''} found</span>
              </div>

              {results.length > 0 ? (
                <div className="search-results-list">
                  {results.map(note => (
                    <div
                      key={note.id}
                      className="search-result-item"
                      onClick={() => {
                        onSelectNote(note);
                        onClose();
                      }}
                    >
                      <div className="result-title">{note.title}</div>
                      <div className="result-preview">
                        {getPreview(note.content, searchQuery)}
                      </div>
                      <div className="result-meta">
                        <span>
                          <Calendar size={10} style={{ display: 'inline', marginRight: '4px' }} />
                          {new Date(note.updated_at).toLocaleDateString()}
                        </span>
                        {note.folder_id && (
                          <span>
                            <Folder size={10} style={{ display: 'inline', marginRight: '4px' }} />
                            {folders.find(f => f.id === note.folder_id)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <Search size={48} />
                  <p>No notes found matching "{searchQuery}"</p>
                  <small>Try different keywords or adjust filters</small>
                </div>
              )}
            </div>
          )}

          {searchHistory.length > 0 && !searchQuery && (
            <div className="search-history">
              <h4>Recent Searches</h4>
              <div className="history-items">
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    className="history-item"
                    onClick={() => setSearchQuery(item)}
                  >
                    <Clock size={12} />
                    {item}
                  </button>
                ))}
                <button className="history-clear-btn" onClick={clearHistory}>
                  Clear history
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="advanced-search-footer">
          <div className="search-shortcuts">
            <div className="shortcut-item">
              <span className="shortcut-key">Enter</span>
              <span>Search</span>
            </div>
            <div className="shortcut-item">
              <span className="shortcut-key">Esc</span>
              <span>Close</span>
            </div>
          </div>
          <div className="search-actions">
            <button className="search-btn search-btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
  );
};

export default AdvancedSearch;
