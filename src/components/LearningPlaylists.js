import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Play, BookOpen, ExternalLink, MessageSquare, 
  FileText, Users, Copy, Check, Star, Clock, TrendingUp, Edit3, 
  Trash2, Share2, Lock, Globe, MoreVertical, ChevronDown, ChevronUp,
  Award, Target, Zap
} from 'lucide-react';
import './LearningPlaylists.css';
import { API_URL } from '../config';

const LearningPlaylists = ({ currentUserId, token }) => {
  const navigate = useNavigate();
  const [view, setView] = useState('discover'); // discover, my-playlists, following
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



  const fetchPlaylistDetails = async (playlistId) => {
    // Navigate to dedicated playlist detail page
    console.log('Navigating to playlist:', playlistId);
    navigate(`/social/playlists/${playlistId}`);
  };



  return (
    <div className="learning-playlists-container">
      <div className="playlists-header">
        <div className="header-top">
          <div className="header-title-section">
            <BookOpen className="header-icon" size={32} />
            <div>
              <h2 className="playlists-title">Learning Playlists</h2>
              <p className="playlists-subtitle">Curated learning paths shared by the community</p>
            </div>
          </div>
          
          {view === 'my-playlists' && (
            <button className="create-playlist-btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={20} />
              <span>Create Playlist</span>
            </button>
          )}
        </div>

        <div className="playlists-tabs">
          <button 
            className={`playlist-tab ${view === 'discover' ? 'active' : ''}`}
            onClick={() => setView('discover')}
          >
            <Globe size={18} />
            <span>Discover</span>
          </button>
          <button 
            className={`playlist-tab ${view === 'following' ? 'active' : ''}`}
            onClick={() => setView('following')}
          >
            <Star size={18} />
            <span>Following</span>
          </button>
          <button 
            className={`playlist-tab ${view === 'my-playlists' ? 'active' : ''}`}
            onClick={() => setView('my-playlists')}
          >
            <Users size={18} />
            <span>My Playlists</span>
          </button>
        </div>

        <div className="playlists-controls">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select 
            className="filter-select"
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

      {loading ? (
        <div className="playlists-loading">Loading playlists...</div>
      ) : (
        <div className="playlists-grid">
          {view === 'my-playlists' && (
            <div className="create-playlist-card" onClick={() => setShowCreateModal(true)}>
              <div className="create-playlist-card-icon">
                <Plus size={48} />
              </div>
              <h3 className="create-playlist-card-title">Create New Playlist</h3>
              <p className="create-playlist-card-description">
                Build a curated learning path and share it with others
              </p>
            </div>
          )}
          
          {playlists.length === 0 && view !== 'my-playlists' ? (
            <div className="empty-playlists">
              <BookOpen size={64} />
              <h3>No playlists found</h3>
              <p>Try adjusting your filters</p>
            </div>
          ) : (
            playlists.map(playlist => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onClick={() => fetchPlaylistDetails(playlist.id)}
              />
            ))
          )}
        </div>
      )}

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

export default LearningPlaylists;


// ==================== PLAYLIST CARD ====================

const PlaylistCard = ({ playlist, onClick }) => {
  return (
    <div className="playlist-card" style={{ borderTop: `4px solid ${playlist.cover_color}` }} onClick={onClick}>
      <div className="playlist-card-header">
        <div className="playlist-card-title-section">
          <h3 className="playlist-card-title">{playlist.title}</h3>
          <div className="playlist-card-meta">
            <span className="playlist-category">{playlist.category}</span>
            <span className="playlist-difficulty">{playlist.difficulty_level}</span>
            {!playlist.is_public && <Lock size={14} />}
          </div>
        </div>
      </div>

      <p className="playlist-card-description">{playlist.description}</p>

      <div className="playlist-card-stats">
        <div className="stat-item">
          <BookOpen size={14} />
          <span>{playlist.items?.length || 0} items</span>
        </div>
        {playlist.estimated_hours && (
          <div className="stat-item">
            <Clock size={14} />
            <span>{playlist.estimated_hours}h</span>
          </div>
        )}
        <div className="stat-item">
          <Users size={14} />
          <span>{playlist.follower_count || 0} followers</span>
        </div>
      </div>

      <div className="playlist-card-footer">
        <div className="playlist-creator">
          {playlist.creator.picture_url ? (
            <img src={playlist.creator.picture_url} alt={playlist.creator.username} />
          ) : (
            <div className="creator-avatar-placeholder">
              {(playlist.creator.first_name?.[0] || playlist.creator.username[0]).toUpperCase()}
            </div>
          )}
          <span>{playlist.creator.first_name || playlist.creator.username}</span>
        </div>
      </div>

      {playlist.tags && playlist.tags.length > 0 && (
        <div className="playlist-tags">
          {playlist.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="playlist-tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== CREATE PLAYLIST MODAL ====================

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Learning Playlist</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="create-playlist-form">
          <div className="form-group">
            <label>Playlist Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Complete Python Programming Path"
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what learners will gain from this playlist..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
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

            <div className="form-group">
              <label>Difficulty Level</label>
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

            <div className="form-group">
              <label>Estimated Hours</label>
              <input
                type="number"
                value={formData.estimated_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: parseFloat(e.target.value) }))}
                placeholder="10"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Cover Color</label>
            <div className="color-picker">
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

          <div className="form-group">
            <label>Tags</label>
            <div className="tag-input-container">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tags..."
              />
              <button type="button" onClick={addTag} className="add-tag-btn">
                <Plus size={16} />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="tags-list">
                {formData.tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
              />
              <span>Make this playlist public</span>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_collaborative}
                onChange={(e) => setFormData(prev => ({ ...prev, is_collaborative: e.target.checked }))}
              />
              <span>Allow collaborators to edit</span>
            </label>
          </div>

          <div className="modal-actions">
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
