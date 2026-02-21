import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, BookOpen, Users, Clock,
  Globe, Lock, Heart, Library, Filter, X, Zap, ChevronRight,
  Menu, FileText, Share2, Check, Sparkles
} from 'lucide-react';
import './PlaylistsPage.css';
import './PlaylistsConvert.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';
import PlaylistShareModal from '../components/PlaylistShareModal';

const PlaylistsPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [view, setView] = useState('discover');
  const [playlists, setPlaylists] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showDifficultyDropdown, setShowDifficultyDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [sharePlaylist, setSharePlaylist] = useState(null);
  const [aiLoading, setAiLoading] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [sortBy, setSortBy] = useState('recent');

  const categories = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
    'History', 'Literature', 'Languages', 'Business', 'Art', 'Music'
  ];

  const difficulties = ['beginner', 'intermediate', 'advanced'];

  const coverColors = [
    '#4A90E2', '#50C878', '#FF6B6B', '#9B59B6', '#F39C12',
    '#E74C3C', '#1ABC9C', '#3498DB', '#E91E63', '#00BCD4'
  ];

  useEffect(() => {
    fetchPlaylists();
  }, [view, filterCategory, filterDifficulty, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if ((showCategoryDropdown || showDifficultyDropdown) && !event.target.closest('.custom-dropdown')) {
        setShowCategoryDropdown(false);
        setShowDifficultyDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCategoryDropdown, showDifficultyDropdown]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/playlists?`;
      
      if (view === 'my-playlists') {
        url += 'my_playlists=true&';
      } else if (view === 'following') {
        url += 'following=true&';
      }
      
      if (filterCategory) url += `category=${filterCategory}&`;
      if (filterDifficulty) url += `difficulty=${filterDifficulty}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.playlists || []);
      }
    } catch (error) {
          } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (playlistData) => {
    try {
      const response = await fetch(`${API_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(playlistData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        fetchPlaylists();
      }
    } catch (error) {
          }
  };

  const handlePlaylistClick = (playlistId) => {
    navigate(`/playlists/${playlistId}`);
  };

  const handleFollowToggle = async (playlistId, currentlyFollowing) => {
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/follow`, {
        method: currentlyFollowing ? 'DELETE' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setPlaylists(prev => prev.map(playlist => {
          if (playlist.id !== playlistId) return playlist;
          const followerCount = playlist.follower_count || 0;
          return {
            ...playlist,
            is_following: !currentlyFollowing,
            follower_count: currentlyFollowing ? Math.max(0, followerCount - 1) : followerCount + 1
          };
        }));
      }
    } catch (error) {
          }
  };

  const handleAiConvert = async (playlist, action) => {
    if (!playlist) return;
    setAiResult(null);
    const key = `${playlist.id}-${action}`;
    setAiLoading(prev => ({ ...prev, [key]: true }));

    try {
      const endpoint = action === 'notes'
        ? `${API_URL}/import_export/playlist_to_notes`
        : `${API_URL}/import_export/playlist_to_flashcards`;

      const payload = action === 'notes'
        ? { playlist_id: playlist.id }
        : { playlist_id: playlist.id, card_count: 15 };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.detail || 'AI conversion failed');
      }

      setAiResult({
        status: 'success',
        type: action,
        playlistTitle: playlist.title,
        noteId: data.note_id,
        setId: data.set_id
      });
    } catch (error) {
      setAiResult({
        status: 'error',
        message: error.message || 'AI conversion failed'
      });
    } finally {
      setAiLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterDifficulty('');
    setSearchQuery('');
  };

  const hasActiveFilters = filterCategory || filterDifficulty || searchQuery;

  useEffect(() => {
    if (!aiResult) return;
    const timer = setTimeout(() => setAiResult(null), 6000);
    return () => clearTimeout(timer);
  }, [aiResult]);

  const sortedPlaylists = useMemo(() => {
    const items = [...playlists];
    switch (sortBy) {
      case 'popular':
        return items.sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0));
      case 'items':
        return items.sort((a, b) => (b.item_count || 0) - (a.item_count || 0));
      case 'hours':
        return items.sort((a, b) => (b.estimated_hours || 0) - (a.estimated_hours || 0));
      default:
        return items.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });
    }
  }, [playlists, sortBy]);

  return (
    <div className="playlists-container playlists-page">
      {/* Top Navigation Bar */}
      <header className="hub-header">
        <div className="hub-header-left">
          <button className="nav-menu-btn" onClick={() => window.openGlobalNav && window.openGlobalNav()} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <h1 className="hub-logo" onClick={() => navigate('/search-hub')}>
            <div className="hub-logo-img" />
            cerbyl
          </h1>
          <div className="hub-header-divider"></div>
          <p className="hub-header-subtitle">LEARNING PLAYLISTS</p>
        </div>
        <div className="hub-header-right">
          <button 
            className="hub-nav-btn create-playlist-btn" 
            onClick={() => setShowCreateModal(true)}
            title="Create new playlist"
          >
            <Plus size={16} />
            <span>Create Playlist</span>
          </button>
          <button className="hub-nav-btn hub-nav-btn-ghost" onClick={() => navigate('/dashboard')}>
            <span>Dashboard</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="playlists-body">
        {/* Left Sidebar */}
        <aside className="playlists-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-heading">Browse</h3>
            <nav className="sidebar-menu">
              <button 
                className={`menu-item ${view === 'discover' ? 'active' : ''}`}
                onClick={() => setView('discover')}
              >
                <Globe size={18} />
                <span>Discover</span>
                {view === 'discover' && <div className="active-indicator"></div>}
              </button>
              
              <button 
                className={`menu-item ${view === 'following' ? 'active' : ''}`}
                onClick={() => setView('following')}
              >
                <Heart size={18} />
                <span>Following</span>
                {view === 'following' && <div className="active-indicator"></div>}
              </button>
              
              <button 
                className={`menu-item ${view === 'my-playlists' ? 'active' : ''}`}
                onClick={() => setView('my-playlists')}
              >
                <Library size={18} />
                <span>My Playlists</span>
                {view === 'my-playlists' && <div className="active-indicator"></div>}
              </button>
            </nav>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <div className="filter-item">
              <div className="filter-header">
                <label>Category</label>
                {hasActiveFilters && (
                  <button className="clear-btn-inline" onClick={clearFilters}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="custom-dropdown">
                <button 
                  className="dropdown-trigger"
                  onClick={() => {
                    setShowDifficultyDropdown(false);
                    setShowCategoryDropdown(!showCategoryDropdown);
                  }}
                >
                  <span>{filterCategory || 'All Categories'}</span>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                    <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                {showCategoryDropdown && (
                  <div className="dropdown-menu" style={{ display: 'block', position: 'absolute' }}>
                    <div 
                      className={`dropdown-item ${!filterCategory ? 'active' : ''}`}
                      onClick={() => {
                        setFilterCategory('');
                        setShowCategoryDropdown(false);
                      }}
                    >
                      All Categories
                    </div>
                    {categories.map(cat => (
                      <div
                        key={cat}
                        className={`dropdown-item ${filterCategory === cat ? 'active' : ''}`}
                        onClick={() => {
                          setFilterCategory(cat);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-item">
              <div className="filter-header">
                <label>Difficulty</label>
              </div>
              <div className="custom-dropdown">
                <button 
                  className="dropdown-trigger"
                  onClick={() => {
                    setShowCategoryDropdown(false);
                    setShowDifficultyDropdown(!showDifficultyDropdown);
                  }}
                >
                  <span>{filterDifficulty || 'All Levels'}</span>
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                    <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
                {showDifficultyDropdown && (
                  <div className="dropdown-menu" style={{ display: 'block', position: 'absolute' }}>
                    <div 
                      className={`dropdown-item ${!filterDifficulty ? 'active' : ''}`}
                      onClick={() => {
                        setFilterDifficulty('');
                        setShowDifficultyDropdown(false);
                      }}
                    >
                      All Levels
                    </div>
                    {difficulties.map(level => (
                      <div
                        key={level}
                        className={`dropdown-item ${filterDifficulty === level ? 'active' : ''}`}
                        onClick={() => {
                          setFilterDifficulty(level);
                          setShowDifficultyDropdown(false);
                        }}
                      >
                        {level}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sidebar-stats">
            <div className="stat-box">
              <div className="stat-value">{playlists.length}</div>
              <div className="stat-label">Total Playlists</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="playlists-main">
          <div className="content-body">
            <div className="playlists-toolbar">
              <div className="playlists-toolbar-left">
                <div className="playlists-search-field">
                  <Search size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search playlists, topics, creators..."
                  />
                  {searchQuery && (
                    <button className="playlists-clear-search-btn" onClick={() => setSearchQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="playlists-toolbar-count">
                  <span>{sortedPlaylists.length} playlists</span>
                  {hasActiveFilters && <span className="playlists-toolbar-filtered">Filtered</span>}
                </div>
              </div>
              <div className="playlists-toolbar-right">
                <div className="playlists-sort-select">
                  <Filter size={14} />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="recent">Newest</option>
                    <option value="popular">Most Followed</option>
                    <option value="items">Most Items</option>
                    <option value="hours">Most Hours</option>
                  </select>
                </div>
                <button className="playlists-ai-hub-btn" onClick={() => setShowImportExport(true)}>
                  <Sparkles size={14} />
                  <span>AI Convert</span>
                </button>
              </div>
            </div>

            {aiResult && (
              <div className={`playlists-ai-result-toast ${aiResult.status}`}>
                <div className="playlists-ai-result-text">
                  {aiResult.status === 'success' ? (
                    aiResult.message ? (
                      <span>{aiResult.message}</span>
                    ) : (
                      <>
                        <span>AI {aiResult.type === 'notes' ? 'notes' : 'flashcards'} ready for</span>
                        <strong>{aiResult.playlistTitle}</strong>
                      </>
                    )
                  ) : (
                    <span>{aiResult.message}</span>
                  )}
                </div>
                {aiResult.status === 'success' && aiResult.type === 'notes' && aiResult.noteId && (
                  <button className="playlists-ai-result-action" onClick={() => navigate(`/notes/editor/${aiResult.noteId}`)}>
                    Open Notes
                  </button>
                )}
                {aiResult.status === 'success' && aiResult.type === 'flashcards' && (
                  <button className="playlists-ai-result-action" onClick={() => navigate('/flashcards')}>
                    Open Flashcards
                  </button>
                )}
                <button className="playlists-ai-result-close" onClick={() => setAiResult(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            {loading ? (
              <div className="loading-container">
                <div className="fc-spinner">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p>LOADING PLAYLISTS...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="empty-container">
                <BookOpen size={56} />
                <h3>NO PLAYLISTS FOUND</h3>
                <p>
                  {view === 'my-playlists' 
                    ? 'CREATE YOUR FIRST PLAYLIST TO GET STARTED'
                    : 'TRY ADJUSTING YOUR FILTERS OR SEARCH'}
                </p>
              </div>
            ) : (
              <div className="playlists-grid">
                {sortedPlaylists.map(playlist => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={() => handlePlaylistClick(playlist.id)}
                    onShare={() => setSharePlaylist(playlist)}
                    onGenerateNotes={() => handleAiConvert(playlist, 'notes')}
                    onGenerateFlashcards={() => handleAiConvert(playlist, 'flashcards')}
                    onToggleFollow={() => handleFollowToggle(playlist.id, playlist.is_following)}
                    aiLoading={aiLoading}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showCreateModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePlaylist}
          categories={categories}
          difficulties={difficulties}
          coverColors={coverColors}
        />
      )}
      
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="playlist"
        onSuccess={(result) => {
          if (result?.shouldNavigate) {
            const items = result.items || [];
            if (result.destinationType === 'notes') {
              if (result.note_id) {
                navigate(`/notes/editor/${result.note_id}`);
              } else if (items.length === 1 && items[0]?.note_id) {
                navigate(`/notes/editor/${items[0].note_id}`);
              } else {
                navigate('/notes');
              }
            } else if (result.destinationType === 'flashcards') {
              if (result.set_id) {
                navigate(`/flashcards?set_id=${result.set_id}&mode=preview`);
              } else if (items.length === 1 && items[0]?.set_id) {
                navigate(`/flashcards?set_id=${items[0].set_id}&mode=preview`);
              } else {
                navigate('/flashcards');
              }
            }
          } else {
            setAiResult({
              status: 'success',
              message: 'AI conversion completed. Check your notes or flashcards.'
            });
          }
        }}
      />

      {sharePlaylist && (
        <PlaylistShareModal
          isOpen={!!sharePlaylist}
          playlist={sharePlaylist}
          onClose={() => setSharePlaylist(null)}
        />
      )}
    </div>
  );
};

export default PlaylistsPage;

// ==================== PLAYLIST CARD ====================

const PlaylistCard = ({
  playlist,
  onClick,
  onShare,
  onGenerateNotes,
  onGenerateFlashcards,
  onToggleFollow,
  aiLoading
}) => {
  const itemCount = playlist.item_count || playlist.items?.length || 0;
  const hasItems = itemCount > 0;
  const notesLoading = aiLoading?.[`${playlist.id}-notes`];
  const flashcardsLoading = aiLoading?.[`${playlist.id}-flashcards`];

  return (
    <div className="playlist-card" onClick={onClick}>
      <div 
        className="card-cover" 
        style={{ 
          background: `linear-gradient(135deg, ${playlist.cover_color}22 0%, ${playlist.cover_color}55 100%)`
        }}
      >
        <div className="cover-overlay">
          <BookOpen size={32} strokeWidth={1.5} />
        </div>
        {!playlist.is_public && (
          <div className="privacy-badge">
            <Lock size={12} />
          </div>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title">{playlist.title}</h3>
        <p className="card-description">{playlist.description}</p>
        
        {(playlist.category || playlist.difficulty_level) && (
          <div className="card-tags">
            {playlist.category && (
              <span className="tag category-tag">{playlist.category}</span>
            )}
            {playlist.difficulty_level && (
              <span className="tag difficulty-tag">{playlist.difficulty_level}</span>
            )}
          </div>
        )}

        <div className="card-stats">
          <div className="stat">
            <BookOpen size={14} />
            <span>{itemCount}</span>
          </div>
          <div className="stat">
            <Users size={14} />
            <span>{playlist.follower_count || 0}</span>
          </div>
          {playlist.estimated_hours > 0 && (
            <div className="stat">
              <Clock size={14} />
              <span>{playlist.estimated_hours}h</span>
            </div>
          )}
        </div>

        {playlist.user_progress && (
          <div className="playlists-card-progress">
            <div className="playlists-progress-meta">
              <span>Progress</span>
              <strong>{Math.round(playlist.user_progress.progress_percentage || 0)}%</strong>
            </div>
            <div className="playlists-card-progress-track">
              <div 
                className="playlists-card-progress-fill" 
                style={{ width: `${playlist.user_progress.progress_percentage || 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="playlists-card-actions">
          <div className="playlists-card-actions-left">
            <button
              className="playlists-card-action-btn ai"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateNotes();
              }}
              disabled={notesLoading || !hasItems}
              title={hasItems ? 'Generate AI notes' : 'Add items to enable AI'}
            >
              {notesLoading ? <span className="lp-btn-spinner" /> : <FileText size={14} />}
              <span>{notesLoading ? 'Generating' : 'AI Notes'}</span>
            </button>
            <button
              className="playlists-card-action-btn ai"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateFlashcards();
              }}
              disabled={flashcardsLoading || !hasItems}
              title={hasItems ? 'Generate AI flashcards' : 'Add items to enable AI'}
            >
              {flashcardsLoading ? <span className="lp-btn-spinner" /> : <Zap size={14} />}
              <span>{flashcardsLoading ? 'Generating' : 'Flashcards'}</span>
            </button>
          </div>
          <div className="playlists-card-actions-right">
            {!playlist.is_owner && (
              <button
                className={`playlists-icon-action-btn ${playlist.is_following ? 'following' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFollow();
                }}
                title={playlist.is_following ? 'Unfollow' : 'Follow'}
              >
                {playlist.is_following ? <Check size={14} /> : <Heart size={14} />}
              </button>
            )}
            <button
              className="playlists-icon-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              title="Share playlist"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>

        <div className="card-footer">
          <div className="creator">
            {playlist.creator.picture_url ? (
              <img src={playlist.creator.picture_url} alt="" />
            ) : (
              <div className="creator-avatar">
                {(playlist.creator.first_name?.[0] || playlist.creator.username[0]).toUpperCase()}
              </div>
            )}
            <span className="creator-name">
              {playlist.creator.first_name || playlist.creator.username}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== CREATE MODAL ====================

const CreatePlaylistModal = ({ onClose, onCreate, categories, difficulties, coverColors }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    difficulty_level: 'intermediate',
    estimated_hours: '',
    is_public: true,
    is_collaborative: false,
    cover_color: '#D7B38C',
    tags: [],
    items: []
  });

  const [tagInput, setTagInput] = useState('');
  const [isPickingColor, setIsPickingColor] = useState(false);
  const [hue, setHue] = useState(30);
  const [saturation, setSaturation] = useState(50);
  const [brightness, setBrightness] = useState(70);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  // Convert HSL to Hex
  const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  // Update color when sliders change
  const updateColor = (newHue, newSat, newBright) => {
    const hexColor = hslToHex(newHue, newSat, newBright);
    setFormData(prev => ({ ...prev, cover_color: hexColor }));
  };

  const handleHueChange = (e) => {
    const newHue = parseInt(e.target.value);
    setHue(newHue);
    updateColor(newHue, saturation, brightness);
  };

  const handleSaturationChange = (e) => {
    const newSat = parseInt(e.target.value);
    setSaturation(newSat);
    updateColor(hue, newSat, brightness);
  };

  const handleBrightnessChange = (e) => {
    const newBright = parseInt(e.target.value);
    setBrightness(newBright);
    updateColor(hue, saturation, newBright);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Playlist</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter playlist title"
              required
            />
          </div>

          <div className="form-field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What's this playlist about?"
              rows={3}
            />
          </div>

          <div className="form-field">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">Select category</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Cover Color</label>
            <div className="color-picker-container">
              <div 
                className="color-preview" 
                style={{ backgroundColor: formData.cover_color }}
                onClick={() => setIsPickingColor(!isPickingColor)}
              >
                <span className="color-hex">{formData.cover_color}</span>
              </div>
              {isPickingColor && (
                <div className="gradient-picker-sliders">
                  <div className="slider-group">
                    <label className="slider-label">HUE</label>
                    <div className="slider-container hue-slider">
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hue}
                        onChange={handleHueChange}
                        className="color-slider"
                      />
                      <div className="slider-track hue-track"></div>
                    </div>
                  </div>
                  <div className="slider-group">
                    <label className="slider-label">SATURATION</label>
                    <div className="slider-container sat-slider">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={saturation}
                        onChange={handleSaturationChange}
                        className="color-slider"
                      />
                      <div 
                        className="slider-track sat-track"
                        style={{ 
                          background: `linear-gradient(to right, 
                            hsl(${hue}, 0%, ${brightness}%), 
                            hsl(${hue}, 100%, ${brightness}%))`
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="slider-group">
                    <label className="slider-label">BRIGHTNESS</label>
                    <div className="slider-container bright-slider">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={brightness}
                        onChange={handleBrightnessChange}
                        className="color-slider"
                      />
                      <div 
                        className="slider-track bright-track"
                        style={{ 
                          background: `linear-gradient(to right, 
                            hsl(${hue}, ${saturation}%, 0%), 
                            hsl(${hue}, ${saturation}%, 50%), 
                            hsl(${hue}, ${saturation}%, 100%))`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-field">
            <label>Tags</label>
            <div className="tag-input-row">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tags..."
              />
              <button type="button" onClick={addTag} className="add-btn">
                <Plus size={16} />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="tags-display">
                {formData.tags.map(tag => (
                  <span key={tag} className="tag-item">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
              />
              <span>Make playlist public</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_collaborative}
                onChange={(e) => setFormData(prev => ({ ...prev, is_collaborative: e.target.checked }))}
              />
              <span>Allow collaborators</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Playlist
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
