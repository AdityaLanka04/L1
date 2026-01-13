import React, { useState, useEffect } from 'react';
import { Folder, Loader, RefreshCw, X } from 'lucide-react';
import './SmartFolders.css';
import { API_URL } from '../config';

const SmartFolders = ({ notes = [], onFolderSelect, onClose }) => {
  const [smartFolders, setSmartFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState(null);

  useEffect(() => {
    if (notes.length > 0) {
      autoGroupNotes();
    } else {
      setLoading(false);
    }
  }, [notes]);

  const autoGroupNotes = async () => {
    setLoading(true);
    
    try {
      // Try AI-based grouping first
      const grouped = await groupNotesWithAI(notes);
      setSmartFolders(grouped);
    } catch (error) {
      console.error('AI grouping failed, using fallback:', error);
      // Fallback to keyword-based grouping
      const grouped = groupNotesByKeywords(notes);
      setSmartFolders(grouped);
    }
    
    setLoading(false);
  };

  const groupNotesWithAI = async (notesToGroup) => {
    const token = localStorage.getItem('token');
    const userName = localStorage.getItem('username');
    
    // Prepare note summaries for AI
    const noteSummaries = notesToGroup.map(note => ({
      id: note.id,
      title: note.title || 'Untitled',
      preview: (note.content || '').replace(/<[^>]+>/g, '').substring(0, 200)
    }));

    const response = await fetch(`${API_URL}/ai_group_notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userName,
        notes: noteSummaries
      })
    });

    if (!response.ok) {
      throw new Error('AI grouping failed');
    }

    const data = await response.json();
    
    // Map AI groups back to full note objects
    return data.groups.map(group => ({
      name: group.name,
      notes: group.note_ids.map(id => notesToGroup.find(n => n.id === id)).filter(Boolean)
    })).filter(g => g.notes.length > 0);
  };

  const groupNotesByKeywords = (notesToGroup) => {
    const groups = {};
    const uncategorized = [];

    // Common topic keywords
    const topicPatterns = {
      'Study Notes': ['study', 'learn', 'exam', 'test', 'quiz', 'chapter', 'lecture', 'class', 'course'],
      'Work': ['meeting', 'project', 'deadline', 'client', 'report', 'task', 'work', 'office', 'team'],
      'Personal': ['diary', 'journal', 'personal', 'life', 'family', 'friend', 'birthday', 'vacation'],
      'Ideas': ['idea', 'brainstorm', 'concept', 'thought', 'plan', 'goal', 'dream', 'future'],
      'Research': ['research', 'analysis', 'data', 'study', 'paper', 'article', 'source', 'reference'],
      'Technical': ['code', 'programming', 'software', 'api', 'database', 'server', 'bug', 'feature'],
      'Finance': ['budget', 'money', 'expense', 'income', 'investment', 'savings', 'cost', 'price'],
      'Health': ['health', 'exercise', 'diet', 'workout', 'medical', 'doctor', 'fitness', 'wellness']
    };

    notesToGroup.forEach(note => {
      const content = `${note.title || ''} ${(note.content || '').replace(/<[^>]+>/g, '')}`.toLowerCase();
      let matched = false;

      for (const [category, keywords] of Object.entries(topicPatterns)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          if (!groups[category]) {
            groups[category] = [];
          }
          groups[category].push(note);
          matched = true;
          break;
        }
      }

      if (!matched) {
        uncategorized.push(note);
      }
    });

    // Convert to array format
    const result = Object.entries(groups)
      .map(([name, notes]) => ({ name, notes }))
      .filter(g => g.notes.length > 0)
      .sort((a, b) => b.notes.length - a.notes.length);

    // Add uncategorized if any
    if (uncategorized.length > 0) {
      result.push({ name: 'Other', notes: uncategorized });
    }

    return result;
  };

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder.name);
    if (onFolderSelect) {
      onFolderSelect(folder.notes, folder.name);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="smart-folders-panel">
        <div className="sf-loading">
          <Loader className="sf-spinner" size={24} />
          <p>Analyzing and grouping your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="smart-folders-panel">
      <div className="sf-header">
        <h3>Smart Folders</h3>
        <div className="sf-header-actions">
          <button className="sf-refresh-btn" onClick={autoGroupNotes} title="Re-analyze">
            <RefreshCw size={16} />
          </button>
          <button className="sf-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="sf-content">
        {smartFolders.length === 0 ? (
          <div className="sf-empty">
            <Folder size={32} />
            <p>No notes to organize</p>
          </div>
        ) : (
          <div className="sf-folders-list">
            {smartFolders.map((folder, idx) => (
              <div 
                key={idx}
                className={`sf-folder-item ${selectedFolder === folder.name ? 'selected' : ''}`}
                onClick={() => handleFolderClick(folder)}
              >
                <div className="sf-folder-icon">
                  <Folder size={18} />
                </div>
                <div className="sf-folder-info">
                  <span className="sf-folder-name">{folder.name}</span>
                  <span className="sf-folder-count">{folder.notes.length} notes</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show notes in selected folder */}
        {selectedFolder && (
          <div className="sf-notes-preview">
            <h4>{selectedFolder}</h4>
            <div className="sf-notes-list">
              {smartFolders.find(f => f.name === selectedFolder)?.notes.map(note => (
                <div key={note.id} className="sf-note-item">
                  <span className="sf-note-title">{note.title || 'Untitled'}</span>
                  <span className="sf-note-date">{formatDate(note.updated_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartFolders;
