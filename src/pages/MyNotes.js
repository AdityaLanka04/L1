import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Star, Clock, Folder, Trash2, Upload, FolderPlus, 
  Grid, List as ListIcon, Layout, Sparkles, ChevronLeft, ChevronRight,
  Home, LogOut, FileText, Menu
} from 'lucide-react';
import './MyNotes.css';
import './MyNotesSmartFolders.css';
import './MyNotesChatImport.css';
import { API_URL } from '../config';
import Templates from '../components/Templates';
import SmartFolders from '../components/SmartFolders';

const MyNotes = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [trashedNotes, setTrashedNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [noteToMove, setNoteToMove] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSmartFolders, setShowSmartFolders] = useState(false);

  // Icons
  const Icons = {
    notes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  };

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
          }
  };

  const importFromChat = async () => {
    if (selectedSessions.length === 0) return;
    
    setImporting(true);
    try {
      // Use the conversion agent service for chat-to-notes conversion
      const conversionAgentService = (await import('../services/conversionAgentService')).default;
      
      const result = await conversionAgentService.chatToNotes(
        userName,
        selectedSessions,
        { formatStyle: 'structured' }
      );
      
      if (result.success) {
        await loadNotes();
        setShowChatImport(false);
        setSelectedSessions([]);
      } else {
        throw new Error(result.response || 'Conversion failed');
      }
    } catch (error) {
      console.error('Chat to note conversion error:', error);
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
          }
  };

  const handleTemplateSelect = async (template) => {
    try {
      const token = localStorage.getItem('token');
      let content = template.content;
      if (template.blocks && template.blocks.length > 0) {
        content = blocksToHtml(template.blocks);
      }
      
      const res = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          title: template.title,
          content: content,
          folder_id: selectedFolder
        }),
      });
      
      if (res.ok) {
        const newNote = await res.json();
        navigate(`/notes/editor/${newNote.id}`);
      }
    } catch (error) {
          }
  };

  const blocksToHtml = (blocks) => {
    if (!blocks || blocks.length === 0) return '';
    return blocks.map(block => {
      const content = block.content || '';
      switch (block.type) {
        case 'heading1': return `<h1>${content}</h1>`;
        case 'heading2': return `<h2>${content}</h2>`;
        case 'heading3': return `<h3>${content}</h3>`;
        case 'bulletList': return `<ul><li>${content}</li></ul>`;
        case 'numberedList': return `<ol><li>${content}</li></ol>`;
        case 'quote': return `<blockquote>${content}</blockquote>`;
        case 'code': return `<pre><code>${content}</code></pre>`;
        case 'divider': return '<hr/>';
        default: return `<p>${content}</p>`;
      }
    }).join('\n');
  };

  const getFilteredNotes = () => {
    let filtered = showTrash ? trashedNotes : notes;
    filtered = filtered.filter(note =>
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.content.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (showFavorites) filtered = filtered.filter(n => n.is_favorite);
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
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const extractPreview = (content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    return text.substring(0, 100) + (text.length > 100 ? '...' : '');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/');
  };

  const filteredNotes = getFilteredNotes();
  const currentTitle = showTrash ? 'Trash' : showFavorites ? 'Favorites' : 
    selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'All Notes';

  return (
    <div className="my-notes-page-full">
      <div className="nt-layout">
        {/* Sidebar */}
        <aside className={`nt-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="nt-sidebar-header">
            <div className="nt-logo" onClick={() => navigate('/dashboard')}>
              <div className="nt-logo-icon">{Icons.notes}</div>
              <span className="nt-logo-text">My Notes</span>
            </div>
            <button 
              className="nt-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <button className="nt-new-note-btn" onClick={createNewNote}>
            <Plus size={18} />
            <span>New Note</span>
          </button>

          <nav className="nt-sidebar-nav">
            {/* Quick Actions */}
            <div className="nt-nav-section">
              <div className="nt-nav-section-title">Quick Actions</div>
              <button className="nt-nav-item" onClick={() => setShowTemplates(true)}>
                <span className="nt-nav-icon"><Layout size={18} /></span>
                <span className="nt-nav-text">Templates</span>
              </button>
              <button className="nt-nav-item" onClick={() => setShowChatImport(true)}>
                <span className="nt-nav-icon"><Upload size={18} /></span>
                <span className="nt-nav-text">From Chat</span>
              </button>
              <button className="nt-nav-item" onClick={() => setShowSmartFolders(true)}>
                <span className="nt-nav-icon"><Sparkles size={18} /></span>
                <span className="nt-nav-text">Smart Folders</span>
              </button>
              <button className="nt-nav-item" onClick={() => navigate('/notes/ai-media')}>
                <span className="nt-nav-icon"><FileText size={18} /></span>
                <span className="nt-nav-text">Media Notes</span>
              </button>
            </div>

            {/* Filters */}
            <div className="nt-nav-section">
              <div className="nt-nav-section-title">Library</div>
              <button 
                className={`nt-nav-item ${!showFavorites && !showTrash && !selectedFolder ? 'active' : ''}`}
                onClick={() => { setShowFavorites(false); setShowTrash(false); setSelectedFolder(null); }}
              >
                <span className="nt-nav-icon"><Folder size={18} /></span>
                <span className="nt-nav-text">All Notes</span>
                <span className="nt-nav-count">{notes.length}</span>
              </button>
              <button 
                className={`nt-nav-item ${showFavorites ? 'active' : ''}`}
                onClick={() => { setShowFavorites(true); setShowTrash(false); setSelectedFolder(null); }}
              >
                <span className="nt-nav-icon"><Star size={18} /></span>
                <span className="nt-nav-text">Favorites</span>
                <span className="nt-nav-count">{notes.filter(n => n.is_favorite).length}</span>
              </button>
              <button 
                className={`nt-nav-item ${showTrash ? 'active' : ''}`}
                onClick={() => { setShowTrash(true); setShowFavorites(false); setSelectedFolder(null); loadTrash(); }}
              >
                <span className="nt-nav-icon"><Trash2 size={18} /></span>
                <span className="nt-nav-text">Trash</span>
              </button>
            </div>

            {/* Folders */}
            <div className="nt-nav-section">
              <div className="nt-nav-section-title">
                Folders
                <button className="nt-add-folder-btn" onClick={() => setShowFolderModal(true)}>
                  <FolderPlus size={14} />
                </button>
              </div>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  className={`nt-nav-item ${selectedFolder === folder.id ? 'active' : ''}`}
                  onClick={() => { setSelectedFolder(folder.id); setShowFavorites(false); setShowTrash(false); }}
                >
                  <span className="nt-nav-icon"><Folder size={18} /></span>
                  <span className="nt-nav-text">{folder.name}</span>
                  <span className="nt-nav-count">{notes.filter(n => n.folder_id === folder.id).length}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="nt-sidebar-footer">
            <button className="nt-nav-item" onClick={() => navigate('/dashboard')}>
              <span className="nt-nav-icon">{Icons.home}</span>
              <span className="nt-nav-text">Dashboard</span>
            </button>
            <button className="nt-nav-item" onClick={handleLogout}>
              <span className="nt-nav-icon">{Icons.logout}</span>
              <span className="nt-nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* Show Sidebar Button - appears when sidebar is collapsed */}
        {sidebarCollapsed && (
          <button 
            className="nt-show-sidebar-btn" 
            onClick={() => setSidebarCollapsed(false)}
            title="Show Sidebar"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Main Content */}
        <main className="nt-main">
          <header className="nt-header">
            <div className="nt-header-left">
              <h1 className="nt-header-title">{currentTitle}</h1>
              <p className="nt-header-subtitle">{filteredNotes.length} notes</p>
            </div>
            <div className="nt-header-actions">
              <div className="nt-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="nt-view-controls">
                <button
                  className={`nt-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid size={16} />
                </button>
                <button
                  className={`nt-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon size={16} />
                </button>
              </div>
            </div>
          </header>

          <div className="nt-content">
            {loading ? (
              <div className="nt-loading">
                <div className="nt-spinner"></div>
                <p>Loading notes...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="nt-empty-state">
                <div className="nt-empty-icon"><Folder size={40} /></div>
                <h2>No notes here</h2>
                <p>Create your first note to get started</p>
                <button className="nt-btn nt-btn-primary" onClick={createNewNote}>
                  <Plus size={16} /> Create Note
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'nt-notes-grid' : 'nt-notes-list'}>
                {filteredNotes.map(note => (
                  <div key={note.id} className="nt-note-card" onClick={() => navigate(`/notes/editor/${note.id}`)}>
                    {note.is_favorite && (
                      <div className="nt-favorite-badge"><Star size={14} /></div>
                    )}
                    <div className="nt-note-card-header">
                      <h3 className="nt-note-title">{note.title || 'Untitled'}</h3>
                      <div className="nt-note-actions">
                        <button
                          className="nt-note-action-btn"
                          onClick={(e) => { e.stopPropagation(); setNoteToMove(note); setShowMoveModal(true); }}
                          title="Move to folder"
                        >
                          <Folder size={14} />
                        </button>
                        <button
                          className="nt-note-action-btn delete"
                          onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="nt-note-preview">{extractPreview(note.content)}</div>
                    <div className="nt-note-footer">
                      <span className="nt-note-date">
                        <Clock size={12} />
                        {formatDate(note.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="nt-modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Folder</h3>
            <input
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createFolder()}
              autoFocus
            />
            <div className="nt-modal-actions">
              <button className="nt-modal-btn cancel" onClick={() => setShowFolderModal(false)}>Cancel</button>
              <button className="nt-modal-btn primary" onClick={createFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Import from Chat Modal */}
      {showChatImport && (
        <div className="nt-modal-overlay" onClick={() => setShowChatImport(false)}>
          <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import from AI Chat</h3>
            <p className="nt-modal-subtitle">Select chat sessions to convert into notes</p>
            <div className="nt-chat-list">
              {chatSessions.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--nt-text-muted)' }}>
                  No chat sessions found
                </div>
              ) : (
                chatSessions.map(session => (
                  <label key={session.id} className="nt-chat-item">
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
                    <div className="nt-chat-info">
                      <span className="nt-chat-title">{session.title || 'Untitled Chat'}</span>
                      <span className="nt-chat-date">{formatDate(session.created_at)}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="nt-modal-actions">
              <button className="nt-modal-btn cancel" onClick={() => setShowChatImport(false)}>Cancel</button>
              <button 
                className="nt-modal-btn primary" 
                onClick={importFromChat} 
                disabled={importing || selectedSessions.length === 0}
              >
                {importing ? 'Importing...' : `Import (${selectedSessions.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {showMoveModal && noteToMove && (
        <div className="nt-modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="nt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Move to Folder</h3>
            <p className="nt-modal-subtitle">Select a folder for "{noteToMove.title || 'Untitled'}"</p>
            <div className="nt-folder-select-list">
              <button className="nt-folder-select-item" onClick={() => moveNoteToFolder(null)}>
                <Folder size={16} />
                <span>No Folder</span>
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  className="nt-folder-select-item"
                  onClick={() => moveNoteToFolder(folder.id)}
                >
                  <Folder size={16} />
                  <span>{folder.name}</span>
                </button>
              ))}
            </div>
            <div className="nt-modal-actions">
              <button className="nt-modal-btn cancel" onClick={() => setShowMoveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <>
          <div className="nt-modal-overlay" onClick={() => setShowTemplates(false)} />
          <Templates
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
            userName={userName}
          />
        </>
      )}

      {/* Smart Folders Modal */}
      {showSmartFolders && (
        <>
          <div className="nt-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowSmartFolders(false)} />
          <SmartFolders
            notes={notes}
            onFolderSelect={(filteredNotes, folderName) => {
                            setShowSmartFolders(false);
            }}
            onClose={() => setShowSmartFolders(false)}
          />
        </>
      )}
    </div>
  );
};

export default MyNotes;
