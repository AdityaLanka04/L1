import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Star, Clock, Folder, Trash2, Upload, X, FolderPlus, Grid, List as ListIcon
} from 'lucide-react';
import './MyNotes.css';
import { API_URL } from '../config';

const MyNotes = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');

  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [trashedNotes, setTrashedNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Folder modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Chat import modal
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importing, setImporting] = useState(false);
  
  // Move to folder
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [noteToMove, setNoteToMove] = useState(null);

  useEffect(() => {
    loadNotes();
    loadFolders();
    loadChatSessions();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
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

  const loadChatSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_chat_sessions?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadTrash = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_trash?user_id=${userName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrashedNotes(data.trash || []);
      }
    } catch (error) {
      console.error('Error loading trash:', error);
    }
  };

  const createNewNote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'Untitled Note',
          content: '',
          folder_id: selectedFolder
        })
      });

      if (response.ok) {
        const newNote = await response.json();
        navigate(`/notes/editor/${newNote.id}`);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/create_folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          name: newFolderName,
          color: '#D7B38C'
        })
      });

      if (res.ok) {
        await loadFolders();
        setNewFolderName('');
        setShowFolderModal(false);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const importFromChat = async () => {
    if (selectedSessions.length === 0) return;
    
    setImporting(true);
    try {
      const token = localStorage.getItem('token');
      
      for (const sessionId of selectedSessions) {
        const response = await fetch(`${API_URL}/convert_chat_to_note_content/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userName,
            chat_id: sessionId,
            mode: 'summary'
          })
        });

        if (response.ok) {
          const data = await response.json();
          await fetch(`${API_URL}/create_note`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: userName,
              title: 'Generated Note from Chat',
              content: data.content
            })
          });
        }
      }
      
      await loadNotes();
      setShowChatImport(false);
      setSelectedSessions([]);
    } catch (error) {
      console.error('Error importing from chat:', error);
    } finally {
      setImporting(false);
    }
  };

  const moveNoteToFolder = async (folderId) => {
    if (!noteToMove) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/move_note_to_folder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          note_id: noteToMove.id, 
          folder_id: folderId 
        })
      });

      if (res.ok) {
        await loadNotes();
        setShowMoveModal(false);
        setNoteToMove(null);
      }
    } catch (error) {
      console.error('Error moving note:', error);
    }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Move this note to trash?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/soft_delete_note/${noteId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await loadNotes();
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const getFilteredNotes = () => {
    let filtered = showTrash ? trashedNotes : notes;
    
    filtered = filtered.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (showFavorites) {
      filtered = filtered.filter(n => n.is_favorite);
    }

    if (selectedFolder && !showTrash && !showFavorites) {
      filtered = filtered.filter(n => n.folder_id === selectedFolder);
    }

    return filtered;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const extractPreview = (content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    return text.substring(0, 120) + (text.length > 120 ? '...' : '');
  };

  const filteredNotes = getFilteredNotes();

  return (
    <div className="my-notes-page-full">
      {/* Sidebar */}
      <div className="notes-sidebar">
        <div className="sidebar-header">
          <h2>My Notes</h2>
          <span className="notes-count">{notes.length}</span>
        </div>

        <div className="sidebar-actions">
          <button onClick={createNewNote} className="btn-new-note">
            <Plus size={18} /> New Note
          </button>
          <button onClick={() => setShowChatImport(true)} className="btn-from-chat">
            <Upload size={16} /> From Chat
          </button>
        </div>

        <div className="search-container">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="sidebar-filters">
          <button
            className={`filter-btn ${!showFavorites && !showTrash && !selectedFolder ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(false);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            <Folder size={16} /> All Notes
          </button>
          <button
            className={`filter-btn ${showFavorites ? 'active' : ''}`}
            onClick={() => {
              setShowFavorites(true);
              setShowTrash(false);
              setSelectedFolder(null);
            }}
          >
            <Star size={16} /> Favorites
          </button>
          <button
            className={`filter-btn ${showTrash ? 'active' : ''}`}
            onClick={() => {
              setShowTrash(true);
              setShowFavorites(false);
              setSelectedFolder(null);
              loadTrash();
            }}
          >
            <Trash2 size={16} /> Trash
          </button>
        </div>

        <div className="folders-section">
          <div className="folders-header">
            <h3>folders</h3>
            <button onClick={() => setShowFolderModal(true)} className="btn-add-folder">
              <FolderPlus size={16} />
            </button>
          </div>
          {folders.length > 0 ? (
            <div className="folders-list">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  className={`folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedFolder(folder.id);
                    setShowFavorites(false);
                    setShowTrash(false);
                  }}
                >
                  <Folder size={14} />
                  <span>{folder.name}</span>
                  <span className="folder-count">
                    {notes.filter(n => n.folder_id === folder.id).length}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="no-folders">
              <p>No folders yet</p>
              <button onClick={() => setShowFolderModal(true)} className="create-folder-hint">
                <FolderPlus size={14} /> create your first folder
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="notes-main-content">
        <div className="content-header">
          <div className="header-left">
            <h1>
              {showTrash ? 'Trash' : showFavorites ? 'Favorites' : selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'All Notes'}
            </h1>
            <p>{filteredNotes.length} notes</p>
          </div>
          <div className="header-right">
            <div className="view-controls">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <Grid size={16} />
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <ListIcon size={16} />
              </button>
            </div>
            <button onClick={() => navigate('/notes')} className="back-btn">
              Back to Notes
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="empty-state">
            <Folder size={64} />
            <h2>No notes here</h2>
            <p>Create your first note to get started</p>
            <button onClick={createNewNote} className="create-first-btn">
              <Plus size={18} /> Create Note
            </button>
          </div>
        ) : (
          <div className={`notes-${viewMode}`}>
            {filteredNotes.map(note => (
              <div key={note.id} className="note-card">
                {note.is_favorite && (
                  <div className="favorite-badge">
                    <Star size={14} fill="currentColor" />
                  </div>
                )}
                <div className="note-card-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNoteToMove(note);
                      setShowMoveModal(true);
                    }}
                    className="note-action-btn"
                    title="Move to folder"
                  >
                    <Folder size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    className="note-action-btn delete"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div onClick={() => navigate(`/notes/editor/${note.id}`)}>
                  <h3 className="note-title">{note.title || 'Untitled'}</h3>
                  <div className="note-preview">{extractPreview(note.content)}</div>
                  <div className="note-footer">
                    <span className="note-date">
                      <Clock size={12} />
                      {formatDate(note.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowFolderModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={createFolder} className="create-btn">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Import Modal */}
      {showChatImport && (
        <div className="modal-overlay" onClick={() => setShowChatImport(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h3>import from ai chat</h3>
            <p className="modal-subtitle">Select chat sessions to convert into notes</p>
            <div className="chat-sessions-list">
              {chatSessions.length === 0 ? (
                <div className="empty-chat-list">
                  <p>No chat sessions found</p>
                </div>
              ) : (
                chatSessions.map(session => (
                  <label key={session.id} className="chat-session-item">
                    <input
                      type="checkbox"
                      checked={selectedSessions.includes(session.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSessions([...selectedSessions, session.id]);
                        } else {
                          setSelectedSessions(selectedSessions.filter(id => id !== session.id));
                        }
                      }}
                    />
                    <div className="chat-session-info">
                      <span className="chat-title">{session.title || 'Untitled Chat'}</span>
                      <span className="chat-date">{formatDate(session.created_at)}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowChatImport(false)} className="cancel-btn">cancel</button>
              <button onClick={importFromChat} disabled={importing || selectedSessions.length === 0} className="create-btn">
                {importing ? 'importing...' : `import ${selectedSessions.length > 0 ? `(${selectedSessions.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {showMoveModal && noteToMove && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>move to folder</h3>
            <p className="modal-subtitle">Select a folder for "{noteToMove.title || 'Untitled'}"</p>
            <div className="folder-select-list">
              <button
                onClick={() => moveNoteToFolder(null)}
                className="folder-select-item"
              >
                <Folder size={16} />
                <span>No Folder</span>
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => moveNoteToFolder(folder.id)}
                  className="folder-select-item"
                >
                  <Folder size={16} />
                  <span>{folder.name}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowMoveModal(false)} className="cancel-btn">cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyNotes;
