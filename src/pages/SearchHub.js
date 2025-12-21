import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, Clock, Users, BookOpen, FileText, Layers, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import './SearchHub.css';
import { API_URL } from '../config/api';
import { THEMES } from '../utils/ThemeManager';

const SearchHub = () => {
  const navigate = useNavigate();
  const { selectedTheme, changeTheme } = useTheme();
  const searchInputRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [userName, setUserName] = useState('');
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      setUserName(username);
      loadRecentSearches(username);
    }

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [navigate]);

  const loadRecentSearches = (username) => {
    const saved = localStorage.getItem(`recentSearches_${username}`);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading recent searches:', error);
      }
    }
  };

  const saveRecentSearch = (query) => {
    const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`recentSearches_${userName}`, JSON.stringify(updated));
  };

  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) return;

    setIsSearching(true);
    saveRecentSearch(query);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('query', query);

      const response = await fetch(`${API_URL}/search_content`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
        
        if (data.total_results === 0) {
          await getAiSuggestion(query);
        }
      }
    } catch (error) {
      console.error('Error searching:', error);
      await getAiSuggestion(query);
    } finally {
      setIsSearching(false);
    }
  };

  const getAiSuggestion = async (query) => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('query', query);

      const response = await fetch(`${API_URL}/get_search_suggestion`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestion(data);
      }
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
      setAiSuggestion({
        description: `It looks like you're searching for "${query}". This could be a great topic to explore!`,
        suggestions: []
      });
    }
  };

  const handleCreateContent = (type) => {
    switch (type) {
      case 'flashcards':
        navigate('/flashcards', { state: { topic: searchQuery } });
        break;
      case 'notes':
        navigate('/notes-redesign', { state: { topic: searchQuery } });
        break;
      case 'ai-chat':
        navigate('/ai-chat', { state: { initialMessage: searchQuery } });
        break;
      default:
        break;
    }
  };

  const handleResultClick = (result) => {
    console.log('Clicked result:', result); // Debug log
    switch (result.type) {
      case 'flashcard':
      case 'flashcard_set':
        navigate(`/flashcards?set_id=${result.id}`);
        break;
      case 'note':
        navigate(`/my-notes?note_id=${result.id}`);
        break;
      case 'deck':
        navigate(`/flashcards?set_id=${result.id}`);
        break;
      case 'chat':
        navigate(`/ai-chat?session_id=${result.id}`);
        break;
      case 'question_set':
        navigate(`/questions?set_id=${result.id}`);
        break;
      default:
        console.log('Unknown result type:', result.type);
        break;
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setAiSuggestion(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case 'flashcard':
      case 'deck':
        return <Layers size={20} />;
      case 'note':
        return <FileText size={20} />;
      case 'chat':
        return <Sparkles size={20} />;
      default:
        return <BookOpen size={20} />;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const handleThemeChange = (themeId) => {
    changeTheme(themeId);
    setShowThemeSelector(false);
  };

  return (
    <div className="search-hub-page">
      {/* Header */}
      <header className="search-hub-header">
        <div className="header-content">
          <button 
            className="theme-selector-btn" 
            onClick={() => setShowThemeSelector(!showThemeSelector)}
          >
            Theme
          </button>
          <button className="dashboard-btn" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          {showThemeSelector && (
            <div className="theme-selector-dropdown">
              <div className="theme-section">
                <h4>Dark Themes</h4>
                <div className="theme-grid">
                  {Object.values(THEMES).filter(t => t.mode === 'dark').map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeChange(theme.id)}
                      style={{ backgroundColor: theme.accent }}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="theme-section">
                <h4>Light Themes</h4>
                <div className="theme-grid">
                  {Object.values(THEMES).filter(t => t.mode === 'light').map(theme => (
                    <button
                      key={theme.id}
                      className={`theme-option ${selectedTheme === theme.id ? 'active' : ''}`}
                      onClick={() => handleThemeChange(theme.id)}
                      style={{ backgroundColor: theme.accent }}
                    >
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="search-hub-main">
        {!searchResults ? (
          /* Search Home */
          <div className="search-home">
            <div className="search-home-content">
              {/* Logo */}
              <h1 className="search-logo">
                <span className="logo-c">C</span>
                <span className="logo-e">e</span>
                <span className="logo-r">r</span>
                <span className="logo-b">b</span>
                <span className="logo-y">y</span>
                <span className="logo-l">l</span>
              </h1>
              <p className="search-tagline">Search for anything you created or any other user created and made public</p>

              {/* Search Box */}
              <div className="search-box-container">
                <div className="search-box">
                  <Search className="search-icon" size={24} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="search-input"
                    placeholder="Search for anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="search-query-input"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  {searchQuery && (
                    <button className="clear-btn" onClick={clearSearch}>
                      <X size={20} />
                    </button>
                  )}
                </div>
                <div className="search-actions">
                  <button className="search-btn" onClick={() => handleSearch()} disabled={!searchQuery.trim()}>
                    Cerbyl Search
                  </button>
                </div>
              </div>

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="recent-searches">
                  <div className="section-header">
                    <Clock size={18} />
                    <h3>Recent Searches</h3>
                  </div>
                  <div className="search-chips">
                    {recentSearches.map((query, index) => (
                      <button
                        key={index}
                        className="search-chip"
                        onClick={() => {
                          setSearchQuery(query);
                          handleSearch(query);
                        }}
                      >
                        <span>{query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Search Results */
          <div className="search-results">
            <div className="results-container">
              {/* Search Header */}
              <div className="results-header">
                <button className="back-btn-compact" onClick={clearSearch}>
                  Back
                </button>
                <div className="search-box-compact">
                  <Search className="search-icon" size={20} />
                  <input
                    type="text"
                    className="results-search-input"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    name="results-search-query"
                    data-form-type="other"
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  {searchQuery && (
                    <button className="clear-btn" onClick={clearSearch}>
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {isSearching ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Searching...</p>
                </div>
              ) : searchResults.total_results > 0 ? (
                <>
                  <div className="results-info">
                    <p>Found <strong>{searchResults.total_results}</strong> results for "<strong>{searchQuery}</strong>"</p>
                  </div>

                  {/* Results Grid */}
                  <div className="results-grid">
                    {searchResults.results.map((result, index) => (
                      <div
                        key={index}
                        className="result-card"
                        onClick={() => handleResultClick(result)}
                      >
                        <div className="result-icon">
                          {getResultIcon(result.type)}
                        </div>
                        <div className="result-content">
                          <div className="result-header">
                            <h3>{result.title}</h3>
                            <span className="result-type">{result.type}</span>
                          </div>
                          {result.description && (
                            <p className="result-description">{result.description}</p>
                          )}
                          <div className="result-meta">
                            {result.author && (
                              <span className="result-author">
                                <Users size={14} />
                                {result.author === userName ? 'You' : result.author}
                              </span>
                            )}
                            {result.visibility && (
                              <span className={`result-visibility ${result.visibility}`}>
                                {result.visibility}
                              </span>
                            )}
                            {result.created_at && (
                              <span className="result-date">
                                <Clock size={14} />
                                {formatDate(result.created_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={20} className="result-arrow" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* No Results - AI Suggestion */
                <div className="no-results">
                  <div className="no-results-icon">
                    <Search size={48} />
                  </div>
                  <h2>No results found for "{searchQuery}"</h2>
                  
                  {aiSuggestion && (
                    <div className="ai-suggestion">
                      <div className="ai-suggestion-header">
                        <Sparkles size={24} />
                        <h3>AI Assistant</h3>
                      </div>
                      <p className="ai-description">{aiSuggestion.description}</p>
                      
                      <div className="create-options">
                        <h4>Would you like to create something?</h4>
                        <div className="create-options-grid">
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('flashcards')}
                          >
                            <Layers size={32} />
                            <h5>Create Flashcards</h5>
                            <p>Build a deck to study this topic</p>
                          </button>
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('notes')}
                          >
                            <FileText size={32} />
                            <h5>Take Notes</h5>
                            <p>Start documenting your learning</p>
                          </button>
                          <button
                            className="create-option-card"
                            onClick={() => handleCreateContent('ai-chat')}
                          >
                            <Sparkles size={32} />
                            <h5>Ask AI</h5>
                            <p>Get help from your AI tutor</p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchHub;
