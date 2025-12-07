import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, BookOpen, Users, Clock, Star, TrendingUp,
  Globe, Lock, Home, Heart, Library, MoreHorizontal, Filter, X
} from 'lucide-react';
import './PlaylistsPage.css';
import { API_URL } from '../config';

const PlaylistsPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [view, setView] = useState('discover');
  const [playlists, setPlaylists] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [loading, setLoading] = useState(false);

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
      console.error('Error fetching playlists:', error);
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
      console.error('Error creating playlist:', error);
    }
  };

  const handlePlaylistClick = (playlistId) => {
    navigate(`/playlists/${playlistId}`);
  };

  const clearFilters = () => {
    setFilterCategory('');
    setFilterDifficulty('');
  };

  const hasActiveFilters = filterCategory || filterDifficulty;

  return (
    <div className="playlists-container">
      {/* Top Navigation Bar */}
      <div className="playlists-topbar">
        <div className="topbar-left">
          <button className="nav-back-btn" onClick={() => navigate('/social')}>
            <Home size={18} />
            <span>Back to Social</span>
          </button>
          <div className="topbar-divider"></div>
          <h1 className="page-title">learning playlists</h1>
        </div>

        <div className="topbar-right">
          <div className="search-input">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {view === 'my-playlists' && (
            <button className="create-btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              <span>New</span>
            </button>
          )}
        </div>
      </div>

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
            <div className="sidebar-heading-row">
              <h3 className="sidebar-heading">Filters</h3>
              {hasActiveFilters && (
                <button className="clear-btn" onClick={clearFilters}>
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
            
            <div className="filter-item">
              <label>Category</label>
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>Difficulty</label>
              <select 
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
              >
                <option value="">All Levels</option>
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
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
          <div className="content-header">
            <div className="view-info">
              <h2 className="view-title">
                {view === 'discover' && 'Discover Playlists'}
                {view === 'following' && 'Following'}
                {view === 'my-playlists' && 'My Playlists'}
              </h2>
              <p className="view-subtitle">
                {view === 'discover' && 'Explore curated learning paths from the community'}
                {view === 'following' && 'Playlists you\'re following'}
                {view === 'my-playlists' && 'Your created playlists'}
              </p>
            </div>
          </div>

          <div className="content-body">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading playlists...</p>
              </div>
            ) : playlists.length === 0 ? (
              <div className="empty-container">
                <BookOpen size={56} />
                <h3>No playlists found</h3>
                <p>
                  {view === 'my-playlists' 
                    ? 'Create your first playlist to get started'
                    : 'Try adjusting your filters or search'}
                </p>
                {view === 'my-playlists' && (
                  <button className="empty-action-btn" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    Create Playlist
                  </button>
                )}
              </div>
            ) : (
              <div className="playlists-grid">
                {playlists.map(playlist => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onClick={() => handlePlaylistClick(playlist.id)}
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
    </div>
  );
};

export default PlaylistsPage;

// ==================== PLAYLIST CARD ====================

const PlaylistCard = ({ playlist, onClick }) => {
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
        
        <div className="card-tags">
          <span className="tag category-tag">{playlist.category}</span>
          <span className="tag difficulty-tag">{playlist.difficulty_level}</span>
        </div>

        <div className="card-stats">
          <div className="stat">
            <BookOpen size={14} />
            <span>{playlist.items?.length || 0}</span>
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
    cover_color: coverColors[0],
    tags: [],
    items: []
  });

  const [tagInput, setTagInput] = useState('');

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Playlist</h2>
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

          <div className="form-row">
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
              <label>Difficulty</label>
              <select
                value={formData.difficulty_level}
                onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value }))}
              >
                {difficulties.map(diff => (
                  <option key={diff} value={diff}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Cover Color</label>
            <div className="color-grid">
              {coverColors.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${formData.cover_color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, cover_color: color }))}
                />
              ))}
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
