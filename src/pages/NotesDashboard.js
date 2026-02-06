import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, FileText, Layout, Settings,
  ArrowLeft
, Menu} from 'lucide-react';
import './NotesDashboard.css';
import DatabaseViews from '../components/DatabaseViews';
import AdvancedSearch from '../components/AdvancedSearch';
import Templates from '../components/Templates';
import { API_URL } from '../config';

const FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const NotesDashboard = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    setUserName(username);
    loadNotes(username);
    loadFolders(username);
    
    // Load saved font preference
    const savedFont = localStorage.getItem('preferredFont');
    if (savedFont) setSelectedFont(savedFont);
  }, [navigate]);

  const loadNotes = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_notes?user_id=${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.filter(n => !n.is_deleted));
      }
    } catch (error) {
          }
  };

  const loadFolders = async (username) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/get_folders?user_id=${username}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch (error) {
          }
  };

  const handleSelectNote = (note) => {
    navigate(`/notes/editor/${note.id}`);
  };

  const handleCreateNote = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/create_note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'Untitled Note',
          content: '',
        }),
      });
      
      if (res.ok) {
        const newNote = await res.json();
        navigate(`/notes/editor/${newNote.id}`);
      }
    } catch (error) {
          }
  };

  const handleTemplateSelect = async (template) => {
    try {
      const token = localStorage.getItem('token');
      
      // Convert blocks to HTML if blocks are provided
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
        }),
      });
      
      if (res.ok) {
        const newNote = await res.json();
        navigate(`/notes/editor/${newNote.id}`);
      }
    } catch (error) {
          }
  };

  // Helper function to convert blocks to HTML
  const blocksToHtml = (blocks) => {
    if (!blocks || blocks.length === 0) return '';
    
    return blocks.map(block => {
      const content = block.content || '';
      
      switch (block.type) {
        case 'heading1':
          return `<h1>${content}</h1>`;
        case 'heading2':
          return `<h2>${content}</h2>`;
        case 'heading3':
          return `<h3>${content}</h3>`;
        case 'bulletList':
          return `<ul><li>${content}</li></ul>`;
        case 'numberedList':
          return `<ol><li>${content}</li></ol>`;
        case 'quote':
          return `<blockquote>${content}</blockquote>`;
        case 'code':
          return `<pre><code>${content}</code></pre>`;
        case 'divider':
          return '<hr/>';
        case 'todo':
          return `<div><input type="checkbox" ${block.properties?.checked ? 'checked' : ''}/> ${content}</div>`;
        case 'callout':
        case 'info':
        case 'warning':
        case 'success':
        case 'tip':
          return `<div class="callout ${block.type}">${content}</div>`;
        default:
          return `<p>${content}</p>`;
      }
    }).join('\n');
  };



  const handleFontChange = (font) => {
    setSelectedFont(font);
    localStorage.setItem('preferredFont', font);
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="notes-dashboard" style={{ fontFamily: selectedFont }}>
      <div className="dashboard-header">
        <div className="dashboard-title">
          <button
            className="dashboard-btn"
            onClick={() => navigate('/notes')}
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1>Notes Dashboard</h1>
        </div>
        <div className="dashboard-actions">
          <button
            className="dashboard-btn"
            onClick={() => setShowTemplates(true)}
          >
            <Layout size={18} />
            Templates
          </button>
          <button
            className="dashboard-btn primary"
            onClick={handleCreateNote}
          >
            <Plus size={18} />
            New Note
          </button>
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-search">
            <Search size={18} className="toolbar-search-icon" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="toolbar-filter-btn"
            onClick={() => setShowAdvancedSearch(true)}
          >
            <Filter size={16} />
            Advanced Search
          </button>
        </div>
        <div className="toolbar-right">
          <select
            className="font-selector"
            value={selectedFont}
            onChange={(e) => handleFontChange(e.target.value)}
          >
            {FONTS.map(font => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Total Notes</span>
          <span className="stat-value">{notes.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Folders</span>
          <span className="stat-value">{folders.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">This Week</span>
          <span className="stat-value">
            {notes.filter(n => {
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return new Date(n.updated_at) > weekAgo;
            }).length}
          </span>
        </div>
      </div>

      <div className="dashboard-content">
        {filteredNotes.length > 0 ? (
          <DatabaseViews
            notes={filteredNotes}
            folders={folders}
            onSelectNote={handleSelectNote}
          />
        ) : (
          <div className="empty-dashboard">
            <FileText size={64} />
            <h2>No Notes Yet</h2>
            <p>Create your first note or use a template to get started</p>
            <button className="dashboard-btn primary" onClick={handleCreateNote}>
              <Plus size={18} />
              Create First Note
            </button>
          </div>
        )}
      </div>

      {showAdvancedSearch && (
        <>
          <div className="ai-overlay" style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999
          }} onClick={() => setShowAdvancedSearch(false)} />
          <AdvancedSearch
            notes={notes}
            folders={folders}
            onSelectNote={handleSelectNote}
            onClose={() => setShowAdvancedSearch(false)}
          />
        </>
      )}

      {showTemplates && (
        <>
          <div className="ai-overlay" style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999
          }} onClick={() => setShowTemplates(false)} />
          <Templates
            onSelectTemplate={handleTemplateSelect}
            onClose={() => setShowTemplates(false)}
            userName={userName}
          />
        </>
      )}
    </div>
  );
};

export default NotesDashboard;
