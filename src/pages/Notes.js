import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Notes.css';
import CustomPopup from './CustomPopup'; // Add this import

const Notes = () => {
  const [userName, setUserName] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showChatImport, setShowChatImport] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [importMode, setImportMode] = useState('summary'); // 'summary', 'exam_prep', or 'full'
  const [importing, setImporting] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef(null);
  const navigate = useNavigate();

  // Custom popup state
  const [popup, setPopup] = useState({
    isOpen: false,
    message: '',
    title: ''
  });

  // Popup helper functions
  const showPopup = (title, message) => {
    setPopup({
      isOpen: true,
      title,
      message
    });
  };

  const closePopup = () => {
    setPopup({
      isOpen: false,
      message: '',
      title: ''
    });
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    const profile = localStorage.getItem('userProfile');

    if (!token) {
      navigate('/login');
      return;
    }

    if (username) {
      setUserName(username);
    }

    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (error) {
        console.error('Error parsing user profile:', error);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (userName) {
      loadNotes();
      loadChatSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  const loadNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_notes?user_id=${userName}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userNotes = await response.json();
        setNotes(userNotes);
        
        if (userNotes.length > 0 && !selectedNote) {
          selectNote(userNotes[0]);
        }
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadChatSessions = async () => {
    if (!userName) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/get_chat_sessions?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const createNewNote = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/create_note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: 'New Note',
          content: ''
        })
      });

      if (response.ok) {
        const newNote = await response.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
      }
    } catch (error) {
      console.error('Error creating new note:', error);
      showPopup('Creation Failed', 'Failed to create new note. Please try again.');
    }
  };

  const convertChatToNote = async () => {
    if (selectedSessions.length === 0) {
      showPopup('No Sessions Selected', 'Please select at least one chat session to convert to notes.');
      return;
    }

    setImporting(true);
    try {
      const token = localStorage.getItem('token');
      
      // Load chat history for selected sessions
      const allMessages = [];
      for (const sessionId of selectedSessions) {
        const response = await fetch(`http://localhost:8001/get_chat_history/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const session = chatSessions.find(s => s.id === sessionId);
          allMessages.push({
            sessionTitle: session?.title || 'Chat Session',
            messages: data.messages
          });
        }
      }

      // Generate note content based on import mode
      let noteContent = '';
      let noteTitle = '';

      if (importMode === 'summary' || importMode === 'exam_prep' || importMode === 'full') {
        // Use AI-generated content for all modes
        const conversationData = allMessages.map(session => 
          session.messages.map(msg => `Q: ${msg.user_message}\nA: ${msg.ai_response}`).join('\n\n')
        ).join('\n\n--- New Session ---\n\n');

        const summaryResponse = await fetch('http://localhost:8001/generate_note_summary/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: (() => {
            const formData = new FormData();
            formData.append('user_id', userName);
            formData.append('conversation_data', conversationData);
            formData.append('session_titles', JSON.stringify(allMessages.map(s => s.sessionTitle)));
            formData.append('import_mode', importMode);
            return formData;
          })()
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          noteTitle = summaryData.title;
          noteContent = summaryData.content;
        } else {
          // Fallback based on mode
          if (importMode === 'summary') {
            noteTitle = `Study Notes - ${selectedSessions.length} Chat Session(s)`;
            noteContent = generateSimpleNoteContent(allMessages);
          } else if (importMode === 'exam_prep') {
            noteTitle = `Exam Prep Guide - ${selectedSessions.length} Chat Session(s)`;
            noteContent = generateExamPrepContent(allMessages);
          } else {
            noteTitle = `Chat Transcript - ${selectedSessions.length} Session(s)`;
            noteContent = generateFullNoteContent(allMessages);
          }
        }
      }

      // Create the note
      const response = await fetch('http://localhost:8001/create_note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: noteTitle,
          content: noteContent
        })
      });

      if (response.ok) {
        const newNote = await response.json();
        setNotes(prev => [newNote, ...prev]);
        selectNote(newNote);
        setShowChatImport(false);
        setSelectedSessions([]);
        showPopup('Conversion Successful', `Chat conversation converted to "${noteTitle}" successfully! Your new note is ready for editing.`);
      }
    } catch (error) {
      console.error('Error converting chat to note:', error);
      showPopup('Conversion Failed', 'Failed to convert chat to note. Please check your connection and try again.');
    }
    setImporting(false);
  };

  // Enhanced content generators with better formatting
  const generateSimpleNoteContent = (allMessages) => {
    let content = `# Study Notes from Chat Sessions\n\n`;
    content += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
    content += `**Sessions Included:** ${allMessages.length}\n\n`;
    content += `---\n\n`;
    
    allMessages.forEach((session, index) => {
      content += `## ${session.sessionTitle}\n\n`;
      
      session.messages.forEach((msg, msgIndex) => {
        content += `### Question ${msgIndex + 1}\n\n`;
        content += `**Q:** ${msg.user_message}\n\n`;
        content += `**A:** ${msg.ai_response}\n\n`;
        content += `---\n\n`;
      });
    });
    
    return content;
  };

  const generateExamPrepContent = (allMessages) => {
    let content = `# Exam Preparation Guide\n\n`;
    content += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
    content += `**Source:** ${allMessages.length} chat session(s)\n\n`;
    content += `---\n\n`;
    
    content += `## Executive Summary\n\n`;
    content += `This comprehensive exam preparation guide covers key concepts from your AI chat sessions. Each section is organized for optimal study efficiency.\n\n`;
    
    content += `### How to Use This Guide\n\n`;
    content += `1. **First Pass:** Read through all key concepts\n`;
    content += `2. **Second Pass:** Focus on areas marked as challenging\n`;
    content += `3. **Final Review:** Use the quick reference checklist\n\n`;
    content += `---\n\n`;
    
    content += `## Key Topics and Concepts\n\n`;
    allMessages.forEach((session, index) => {
      content += `### Topic ${index + 1}: ${session.sessionTitle}\n\n`;
      
      session.messages.forEach((msg, msgIndex) => {
        content += `#### Concept ${msgIndex + 1}\n\n`;
        content += `**Question:** ${msg.user_message}\n\n`;
        content += `**Key Points:**\n\n`;
        // Extract first 150 words as key points
        const keyPoints = msg.ai_response.split(' ').slice(0, 150).join(' ');
        content += `${keyPoints}...\n\n`;
        content += `**Study Focus:** Review this concept thoroughly\n\n`;
        content += `---\n\n`;
      });
    });
    
    content += `## Study Strategy\n\n`;
    content += `### Recommended Study Schedule\n\n`;
    content += `- **Week 1:** Read through all concepts (2-3 hours)\n`;
    content += `- **Week 2:** Deep dive into challenging topics (3-4 hours)\n`;
    content += `- **Week 3:** Practice and review (2-3 hours)\n`;
    content += `- **Final Week:** Quick review and checklist (1-2 hours)\n\n`;
    
    content += `### Active Learning Techniques\n\n`;
    content += `- Create flashcards for key definitions\n`;
    content += `- Explain concepts in your own words\n`;
    content += `- Practice with example problems\n`;
    content += `- Test yourself regularly\n\n`;
    
    content += `## Quick Review Checklist\n\n`;
    allMessages.forEach((session, index) => {
      content += `- [ ] ${session.sessionTitle} concepts mastered\n`;
    });
    content += `- [ ] All key definitions memorized\n`;
    content += `- [ ] Practice problems completed\n`;
    content += `- [ ] Weak areas reinforced\n\n`;
    
    return content;
  };

  const generateFullNoteContent = (allMessages) => {
    let content = `# Complete Chat Transcript\n\n`;
    content += `**Exported:** ${new Date().toLocaleString()}\n\n`;
    content += `**Sessions Included:** ${allMessages.length}\n\n`;
    content += `---\n\n`;
    
    allMessages.forEach((session, index) => {
      content += `# Session ${index + 1}: ${session.sessionTitle}\n\n`;
      
      session.messages.forEach((msg, msgIndex) => {
        content += `## Exchange ${msgIndex + 1}\n\n`;
        content += `**You:** ${msg.user_message}\n\n`;
        content += `**AI Tutor:** ${msg.ai_response}\n\n`;
        content += `*Timestamp: ${new Date(msg.timestamp).toLocaleString()}*\n\n`;
        content += `---\n\n`;
      });
    });
    
    return content;
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  const saveNote = async () => {
    if (!selectedNote) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8001/update_note', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          note_id: selectedNote.id,
          title: noteTitle,
          content: noteContent
        })
      });

      if (response.ok) {
        setNotes(prev => prev.map(note => 
          note.id === selectedNote.id 
            ? { ...note, title: noteTitle, content: noteContent, updated_at: new Date().toISOString() }
            : note
        ));
        setSelectedNote(prev => ({ ...prev, title: noteTitle, content: noteContent }));
        showPopup('Note Saved', `"${noteTitle}" has been saved successfully.`);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      showPopup('Save Failed', 'Failed to save note. Please check your connection and try again.');
    }
    setSaving(false);
  };

  const deleteNote = async (noteId) => {

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8001/delete_note/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setNotes(prev => prev.filter(note => note.id !== noteId));
        if (selectedNote?.id === noteId) {
          const remainingNotes = notes.filter(note => note.id !== noteId);
          if (remainingNotes.length > 0) {
            selectNote(remainingNotes[0]);
          } else {
            setSelectedNote(null);
            setNoteTitle('');
            setNoteContent('');
          }
        }
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      showPopup('Delete Failed', 'Failed to delete note. Please try again.');
    }
  };

  // Formatting functions
  const insertMarkdown = (syntax, placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = noteContent.substring(start, end);
    
    let newText = '';
    
    switch (syntax) {
      case 'bold':
        newText = `**${selectedText || placeholder || 'bold text'}**`;
        break;
      case 'italic':
        newText = `*${selectedText || placeholder || 'italic text'}*`;
        break;
      case 'underline':
        newText = `<u>${selectedText || placeholder || 'underlined text'}</u>`;
        break;
      case 'highlight':
        newText = `<mark>${selectedText || placeholder || 'highlighted text'}</mark>`;
        break;
      case 'h1':
        newText = `# ${selectedText || placeholder || 'Heading 1'}`;
        break;
      case 'h2':
        newText = `## ${selectedText || placeholder || 'Heading 2'}`;
        break;
      case 'h3':
        newText = `### ${selectedText || placeholder || 'Heading 3'}`;
        break;
      case 'bullet':
        newText = `- ${selectedText || placeholder || 'List item'}`;
        break;
      case 'number':
        newText = `1. ${selectedText || placeholder || 'Numbered item'}`;
        break;
      case 'quote':
        newText = `> ${selectedText || placeholder || 'Quote text'}`;
        break;
      case 'code':
        newText = `\`${selectedText || placeholder || 'code'}\``;
        break;
      case 'codeblock':
        newText = `\`\`\`\n${selectedText || placeholder || 'code block'}\n\`\`\``;
        break;
      default:
        return;
    }

    const newContent = noteContent.substring(0, start) + newText + noteContent.substring(end);
    setNoteContent(newContent);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  // Render markdown for preview
  const renderMarkdown = (text) => {
    return text
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      .replace(/<mark>(.*?)<\/mark>/g, '<mark>$1</mark>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
      .replace(/\n/g, '<br>');
  };

  const handleSessionToggle = (sessionId) => {
    setSelectedSessions(prev => 
      prev.includes(sessionId) 
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const selectAllSessions = () => {
    setSelectedSessions(chatSessions.map(session => session.id));
  };

  const clearAllSessions = () => {
    setSelectedSessions([]);
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = () => {
    if (userProfile?.googleUser && window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const goToChat = () => {
    navigate('/ai-chat');
  };

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="notes-page">
      {/* Sidebar */}
      <div className={`notes-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-title">My Notes</h3>
          <div className="sidebar-actions">
            <button className="new-note-btn" onClick={createNewNote}>
              New Note
            </button>
            <button 
              className="import-chat-btn" 
              onClick={() => setShowChatImport(true)}
              title="Convert chat to notes"
            >
              From Chat
            </button>
          </div>
        </div>
        
        <div className="search-section">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="notes-list">
          {filteredNotes.length === 0 ? (
            <div className="no-notes">
              <p>No notes found</p>
              {searchTerm && <p>Try a different search term</p>}
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`note-item ${selectedNote?.id === note.id ? 'active' : ''}`}
                onClick={() => selectNote(note)}
              >
                <div className="note-title">{note.title}</div>
                <div className="note-preview">
                  {note.content.replace(/[#*`]/g, '').substring(0, 80)}...
                </div>
                <div className="note-date">
                  {new Date(note.updated_at).toLocaleDateString()}
                </div>
                <button 
                  className="delete-note-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Notes Area */}
      <div className="notes-main">
        {/* Header */}
        <header className="notes-header">
          <div className="header-left">
            <button 
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>
            <button className="back-btn" onClick={goToDashboard}>
              Dashboard
            </button>
            <button className="chat-btn" onClick={goToChat}>
              AI Chat
            </button>
            <h1 
              className="notes-title clickable-logo" 
              onClick={handleLogoClick}
              title="Go to Dashboard"
              style={{ cursor: 'pointer' }}
            >
              brainwave notes
            </h1>
          </div>
          
          <div className="header-right">
            <button 
              className="save-btn"
              onClick={saveNote}
              disabled={saving || !selectedNote}
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
            <div className="user-info">
              {userProfile?.picture && (
                <img 
                  src={userProfile.picture} 
                  alt="Profile" 
                  className="profile-picture"
                />
              )}
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="editor-container">
          {selectedNote ? (
            <>
              <div className="title-section">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="note-title-input"
                  placeholder="Note title..."
                />
              </div>

              {/* Formatting Toolbar */}
              <div className="formatting-toolbar">
                <div className="toolbar-section">
                  <button
                    className="format-btn"
                    onClick={() => setShowFormatting(!showFormatting)}
                    title="Toggle formatting tools"
                  >
                    Format
                  </button>
                  <button
                    className={`preview-btn ${previewMode ? 'active' : ''}`}
                    onClick={() => setPreviewMode(!previewMode)}
                    title="Toggle preview"
                  >
                    {previewMode ? 'Edit' : 'Preview'}
                  </button>
                </div>

                {showFormatting && (
                  <div className="formatting-options">
                    <div className="format-group">
                      <span className="group-label">Text:</span>
                      <button onClick={() => insertMarkdown('bold')} title="Bold">B</button>
                      <button onClick={() => insertMarkdown('italic')} title="Italic">I</button>
                      <button onClick={() => insertMarkdown('underline')} title="Underline">U</button>
                      <button onClick={() => insertMarkdown('highlight')} title="Highlight">H</button>
                    </div>
                    
                    <div className="format-group">
                      <span className="group-label">Headers:</span>
                      <button onClick={() => insertMarkdown('h1')} title="Heading 1">H1</button>
                      <button onClick={() => insertMarkdown('h2')} title="Heading 2">H2</button>
                      <button onClick={() => insertMarkdown('h3')} title="Heading 3">H3</button>
                    </div>
                    
                    <div className="format-group">
                      <span className="group-label">Lists:</span>
                      <button onClick={() => insertMarkdown('bullet')} title="Bullet List">•</button>
                      <button onClick={() => insertMarkdown('number')} title="Numbered List">1.</button>
                    </div>
                    
                    <div className="format-group">
                      <span className="group-label">Other:</span>
                      <button onClick={() => insertMarkdown('quote')} title="Quote">"</button>
                      <button onClick={() => insertMarkdown('code')} title="Inline Code">&lt;&gt;</button>
                      <button onClick={() => insertMarkdown('codeblock')} title="Code Block">{ }</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="content-section">
                {previewMode ? (
                  <div 
                    className="note-preview-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }}
                  />
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="note-content-input"
                    placeholder="Start writing your notes here... Use the formatting tools above to structure your content."
                  />
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"></div>
              <h2>No Note Selected</h2>
              <p>Select a note from the sidebar, create a new one, or convert your AI chat conversations into organized study notes.</p>
              <div className="empty-actions">
                <button className="create-first-note-btn" onClick={createNewNote}>
                  Create New Note
                </button>
                <button className="import-chat-empty-btn" onClick={() => setShowChatImport(true)}>
                  Convert Chat to Notes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Import Modal */}
      {showChatImport && (
        <div className="modal-overlay" onClick={() => setShowChatImport(false)}>
          <div className="chat-import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Convert Chat to Notes</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowChatImport(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-content">
              <div className="import-mode-section">
                <h3>Choose Import Style:</h3>
                <div className="import-mode-options">
                  <label className={`mode-option ${importMode === 'summary' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="summary"
                      checked={importMode === 'summary'}
                      onChange={(e) => setImportMode(e.target.value)}
                    />
                    <div className="mode-content">
                      <strong>Study Notes</strong>
                      <p>Create organized study notes with key concepts and explanations</p>
                    </div>
                  </label>

                  <label className={`mode-option ${importMode === 'exam_prep' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="exam_prep"
                      checked={importMode === 'exam_prep'}
                      onChange={(e) => setImportMode(e.target.value)}
                    />
                    <div className="mode-content">
                      <strong>Exam Preparation Guide</strong>
                      <p>Comprehensive study guide optimized for exam preparation with detailed sections, practice scenarios, and review checklists</p>
                    </div>
                  </label>

                  <label className={`mode-option ${importMode === 'full' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      value="full"
                      checked={importMode === 'full'}
                      onChange={(e) => setImportMode(e.target.value)}
                    />
                    <div className="mode-content">
                      <strong>Full Transcript</strong>
                      <p>Complete conversation record with timestamps</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="session-selection-section">
                <div className="session-header">
                  <h3>Select Chat Sessions:</h3>
                  <div className="selection-controls">
                    <button onClick={selectAllSessions} className="select-all-btn">
                      Select All
                    </button>
                    <button onClick={clearAllSessions} className="clear-all-btn">
                      Clear All
                    </button>
                  </div>
                </div>

                {chatSessions.length === 0 ? (
                  <div className="no-chats">
                    <p>No chat sessions available.</p>
                    <button onClick={goToChat} className="go-chat-btn">
                      Start a Conversation
                    </button>
                  </div>
                ) : (
                  <div className="chat-sessions-grid">
                    {chatSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`chat-session-card ${selectedSessions.includes(session.id) ? 'selected' : ''}`}
                        onClick={() => handleSessionToggle(session.id)}
                      >
                        <div className="session-checkbox">
                          <input 
                            type="checkbox" 
                            checked={selectedSessions.includes(session.id)}
                            onChange={() => handleSessionToggle(session.id)}
                          />
                        </div>
                        <div className="session-info">
                          <div className="session-title">{session.title}</div>
                          <div className="session-date">
                            {new Date(session.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowChatImport(false)}
                >
                  Cancel
                </button>
                <button 
                  className="convert-btn"
                  onClick={convertChatToNote}
                  disabled={importing || selectedSessions.length === 0}
                >
                  {importing ? 'Converting...' : `Convert ${selectedSessions.length} Session(s) to Note`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Popup */}
      <CustomPopup
        isOpen={popup.isOpen}
        onClose={closePopup}
        title={popup.title}
        message={popup.message}
      />
    </div>
  );
};

export default Notes;