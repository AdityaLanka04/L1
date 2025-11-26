import React, { useState, useEffect } from 'react';
import { X, Search, Clock, FileText, Calendar, Tag, Folder } from 'lucide-react';
import './AdvancedSearch.css';

const AdvancedSearch = ({ notes, folders, onSelectNote, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectedBlockType, setSelectedBlockType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchInTitle, setSearchInTitle] = useState(true);
  const [searchInContent, setSearchInContent] = useState(true);
  const [results, setResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    // Load search history from localStorage
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

    // Filter by folder
    if (selectedFolder !== 'all') {
      if (selectedFolder === 'none') {
        filtered = filtered.filter(n => !n.folder_id);
      } else {
        filtered = filtered.filter(n => n.folder_id === parseInt(selectedFolder));
      }
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(n => new Date(n.updated_at) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(n => new Date(n.updated_at) <= new Date(dateTo));
    }

    // Search in title and content
    const searchPattern = useRegex 
      ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
      : null;

    filtered = filtered.filter(note => {
      let matches = false;

      if (searchInTitle) {
        if (useRegex) {
          matches = matches || searchPattern.test(note.title);
        } else {
          const titleMatch = caseSensitive 
            ? note.title.includes(searchQuery)
            : note.title.toLowerCase().includes(searchQuery.toLowerCase());
          matches = matches || titleMatch;
        }
      }

      if (searchInContent) {
        const content = note.content.replace(/<[^>]+>/g, '');
        if (useRegex) {
          matches = matches || searchPattern.test(content);
        } else {
          const contentMatch = caseSensitive
            ? content.includes(searchQuery)
            : content.toLowerCase().includes(searchQuery.toLowerCase());
          matches = matches || contentMatch;
        }
      }

      return matches;
    });

    // Filter by block type (if content contains specific HTML tags)
    if (selectedBlockType !== 'all') {
      filtered = filtered.filter(note => {
        switch (selectedBlockType) {
          case 'heading':
            return /<h[1-6]>/i.test(note.content);
          case 'code':
            return /<code>|<pre>/i.test(note.content);
          case 'list':
            return /<ul>|<ol>/i.test(note.content);
          case 'image':
            return /<img/i.test(note.content);
          case 'link':
            return /<a /i.test(note.content);
          default:
            return true;
        }
      });
    }

    setResults(filtered);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery) performSearch();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedFolder, selectedBlockType, dateFrom, dateTo, caseSensitive, useRegex, searchInTitle, searchInContent]);

  const highlightMatch = (text, query) => {
    if (!query || useRegex) return text;
    const regex = new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const getPreview = (content, query) => {
    const text = content.replace(/<[^>]+>/g, '');
    if (!query) return text.substring(0, 100) + '...';
    
    const index = caseSensitive 
      ? text.indexOf(query)
      : text.toLowerCase().indexOf(query.toLowerCase());
    
    if (index === -1) return text.substring(0, 100) + '...';
    
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 50);
    return '...' + text.substring(start, end) + '...';
  };

  return (
    <div className="advanced-search-modal">
        <div className="advanced-search-header">
          <h2>Advanced Search</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="advanced-search-content">
          <div className="search-input-group">
            <label>Search Query</label>
            <input
              type="text"
              className="search-main-input"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="search-filters">
            <div className="filter-group">
              <label>Folder</label>
              <select
                className="filter-select"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
              >
                <option value="all">All Folders</option>
                <option value="none">No Folder</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Block Type</label>
              <select
                className="filter-select"
                value={selectedBlockType}
                onChange={(e) => setSelectedBlockType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="heading">Headings</option>
                <option value="code">Code Blocks</option>
                <option value="list">Lists</option>
                <option value="image">Images</option>
                <option value="link">Links</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Date From</label>
              <input
                type="date"
                className="filter-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Date To</label>
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
                checked={searchInTitle}
                onChange={(e) => setSearchInTitle(e.target.checked)}
              />
              Search in titles
            </label>
            <label className="search-option">
              <input
                type="checkbox"
                checked={searchInContent}
                onChange={(e) => setSearchInContent(e.target.checked)}
              />
              Search in content
            </label>
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
              Use regex
            </label>
          </div>

          {searchQuery && (
            <div className="search-results-section">
              <div className="search-results-header">
                <h3>Results</h3>
                <span className="results-count">{results.length} found</span>
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
                  <p>No results found</p>
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
