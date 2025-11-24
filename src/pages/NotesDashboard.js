import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Star, Folder, Clock, FileText,
  Grid, List as ListIcon, Calendar, Tag, ArrowLeft,
  MoreVertical, Trash2, Edit, Eye
} from 'lucide-react';
import './NotesDashboard.css';
import { API_URL } from '../config';

const NotesDashboard = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid, list, calendar
  const [filterBy, setFilterBy] = useState('all'); // all, favorites, recent
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const userName = localStorage.getItem('username');

  useEffect(() => {
    loadNotes();
    loadFolders();
  }, []);

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_notes?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.filter(n => !n.is_deleted));
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_folders?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const getFilteredNotes = () => {
    let filtered = notes.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterBy === 'favorites') {
      filtered = filtered.filter(n => n.is_favorite);
    } else if (filterBy === 'recent') {
      filtered = filtered.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      ).slice(0, 10);
    }

    if (selectedFolder) {
      filtered = filtered.filter(n => n.folder_id === selectedFolder);
    }

    return filtered;
  };

  const extractPreview = (content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    return text.substring(0, 150) + (text.length > 150 ? '...' : '');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getFolderName = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : null;
  };

  const filteredNotes = getFilteredNotes();

  return (
    <div className="notes-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="header-title">
            <h1>My Notes</h1>
            <span className="notes-count">{filteredNotes.length} notes</span>
          </div>
        </div>

        <div className="header-actions">
          <button 
            onClick={() => navigate('/notes')} 
            className="create-note-btn"
          >
            <Plus size={18} />
            New Note
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="dashboard-controls">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterBy === 'all' ? 'active' : ''}`}
            onClick={() => setFilterBy('all')}
          >
            <FileText size={16} />
            All
          </button>
          <button
            className={`filter-btn ${filterBy === 'favorites' ? 'active' : ''}`}
            onClick={() => setFilterBy('favorites')}
          >
            <Star size={16} />
            Favorites
          </button>
          <button
            className={`filter-btn ${filterBy === 'recent' ? 'active' : ''}`}
            onClick={() => setFilterBy('recent')}
          >
            <Clock size={16} />
            Recent
          </button>
        </div>

        <div className="view-toggles">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            <Grid size={18} />
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <ListIcon size={18} />
          </button>
        </div>
      </div>

      {/* Folders */}
      {folders.length > 0 && (
        <div className="folders-bar">
          <button
            className={`folder-chip ${!selectedFolder ? 'active' : ''}`}
            onClick={() => setSelectedFolder(null)}
          >
            <FileText size={14} />
            All Notes
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              className={`folder-chip ${selectedFolder === folder.id ? 'active' : ''}`}
              onClick={() => setSelectedFolder(folder.id)}
              style={{ borderColor: folder.color }}
            >
              <Folder size={14} />
              {folder.name}
              <span className="folder-count">
                {notes.filter(n => n.folder_id === folder.id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Notes Grid/List */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading notes...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="empty-state">
          <FileText size={64} />
          <h2>No notes found</h2>
          <p>Create your first note to get started</p>
          <button onClick={() => navigate('/notes')} className="create-first-note">
            <Plus size={18} />
            Create Note
          </button>
        </div>
      ) : (
        <div className={`notes-${viewMode}`}>
          {filteredNotes.map(note => (
            <div
              key={note.id}
              className="note-card"
              onClick={() => navigate(`/notes/${note.id}`)}
            >
              {note.is_favorite && (
                <div className="favorite-badge">
                  <Star size={14} fill="currentColor" />
                </div>
              )}

              <div className="note-card-header">
                <h3 className="note-card-title">{note.title || 'Untitled'}</h3>
                <button
                  className="note-card-menu"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="note-card-preview">
                {extractPreview(note.content)}
              </div>

              <div className="note-card-stats">
                <div className="stat-item">
                  <FileText size={14} />
                  <span>{note.content ? Math.ceil(note.content.length / 500) : 0} blocks</span>
                </div>
                <div className="stat-item">
                  <Eye size={14} />
                  <span>{note.view_count || 0} views</span>
                </div>
                <div className="stat-item">
                  <Edit size={14} />
                  <span>{note.edit_count || 0} edits</span>
                </div>
              </div>

              <div className="note-card-footer">
                <div className="note-card-meta">
                  {getFolderName(note.folder_id) && (
                    <span className="note-folder">
                      <Folder size={12} />
                      {getFolderName(note.folder_id)}
                    </span>
                  )}
                  <span className="note-date">
                    <Clock size={12} />
                    {formatDate(note.updated_at)}
                  </span>
                </div>
                {note.tags && note.tags.length > 0 && (
                  <div className="note-tags">
                    {note.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="note-tag">
                        <Tag size={10} />
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="note-tag-more">+{note.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesDashboard;
