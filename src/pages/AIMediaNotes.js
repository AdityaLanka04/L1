import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Youtube, FileText, Save, Copy, Mic, Loader,
  Settings, Brain, Zap, Clock, Globe, ChevronLeft, ChevronRight,
  BookOpen, CheckCircle, AlertCircle, Play, Trash2, Home, LogOut, Menu
} from 'lucide-react';
import './AIMediaNotes.css';
import './AIMediaNotesConvert.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';

const AIMediaNotes = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');
  const fileInputRef = useRef(null);
  const contentRef = useRef(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [progress, setProgress] = useState(0);

  // Settings
  const [noteStyle, setNoteStyle] = useState('detailed');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [subject, setSubject] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generateFlashcards, setGenerateFlashcards] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  // Results
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');
  const [history, setHistory] = useState([]);

  // Icons
  const Icons = {
    media: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
    home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    logout: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    notes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      setYoutubeUrl('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setUploadedFile(file);
      setYoutubeUrl('');
    }
  };

  const processMedia = async () => {
    if (!uploadedFile && !youtubeUrl) {
      alert('Please upload a file or provide a YouTube URL');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('user_id', userName);
      formData.append('note_style', noteStyle);
      formData.append('difficulty', difficulty);
      formData.append('subject', subject || 'general');
      formData.append('custom_instructions', customInstructions || '');
      formData.append('generate_flashcards', generateFlashcards);
      formData.append('generate_quiz', generateQuiz);

      if (uploadedFile) {
        formData.append('file', uploadedFile);
        setProcessingStage('Uploading file...');
        setProgress(10);
      } else if (youtubeUrl) {
        formData.append('youtube_url', youtubeUrl);
        setProcessingStage('Fetching YouTube transcript...');
        setProgress(10);
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 5 : prev);
      }, 500);

      setProcessingStage('Transcribing audio...');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/media/process`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Processing failed');
      }

      setProcessingStage('Generating AI notes...');
      setProgress(95);

      const data = await response.json();
      setProgress(100);
      setResults(data);
      setActiveTab('notes');

    } catch (error) {
            alert(`Failed to process media: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const saveNotes = async () => {
    if (!results) return;

    try {
      const token = localStorage.getItem('token');
      
      const titleResponse = await fetch(`${API_URL}/media/generate-title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript: results.transcript.substring(0, 1000),
          key_concepts: results.analysis?.key_concepts || [],
          summary: results.analysis?.summary || ''
        })
      });

      let smartTitle = results.filename || 'Media Notes';
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        smartTitle = titleData.title;
      }

      const response = await fetch(`${API_URL}/media/save-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: smartTitle,
          content: results.notes.content,
          transcript: results.transcript,
          analysis: results.analysis,
          flashcards: results.flashcards,
          quiz_questions: results.quiz_questions,
          key_moments: results.key_moments
        })
      });

      if (!response.ok) throw new Error('Save failed');

      const data = await response.json();
      alert('Notes saved successfully!');
      fetchHistory();
      navigate(`/notes/editor/${data.note_id}`);

    } catch (error) {
            alert('Failed to save notes');
    }
  };

  const saveFlashcards = async () => {
    if (!results || !results.flashcards || results.flashcards.length === 0) {
      alert('No flashcards to save');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const setResponse = await fetch(`${API_URL}/create_flashcard_set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: `Flashcards: ${results.filename || 'Media Content'}`,
          description: `AI-generated flashcards from ${results.source_type === 'youtube' ? 'YouTube video' : 'uploaded media'}`,
          source_type: 'media',
          source_id: null
        })
      });

      if (!setResponse.ok) throw new Error('Failed to create flashcard set');

      const setData = await setResponse.json();
      const setId = setData.set_id;

      for (const card of results.flashcards) {
        await fetch(`${API_URL}/add_flashcard_to_set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            set_id: setId,
            question: card.question,
            answer: card.answer,
            difficulty: card.difficulty || 'medium',
            category: subject || 'general'
          })
        });
      }

      alert(`Successfully saved ${results.flashcards.length} flashcards!`);
      navigate('/flashcards');

    } catch (error) {
            alert('Failed to save flashcards');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/media/history?user_id=${userName}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
          }
  };

  const loadHistoryItem = async (item) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_note/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const note = await response.json();
        setResults({
          filename: note.title,
          notes: { content: note.content, style: 'detailed' },
          transcript: note.transcript || '',
          analysis: note.analysis || {},
          flashcards: note.flashcards || [],
          quiz_questions: note.quiz_questions || [],
          key_moments: note.key_moments || [],
          source_type: 'history',
          duration: 0,
          language_name: ''
        });
        setActiveTab('notes');
      }
    } catch (error) {
            alert('Failed to load note');
    }
  };

  const deleteHistoryItem = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${item.title}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_note/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchHistory();
        if (results && results.filename === item.title) {
          setResults(null);
        }
      }
    } catch (error) {
            alert('Failed to delete note');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/');
  };

  return (
    <div className="ai-media-notes-page">
      <div className="mn-layout">
        {/* Sidebar */}
        <aside className={`mn-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="mn-sidebar-header">
            <div className="mn-logo" onClick={() => navigate('/dashboard')}>
              <div className="mn-logo-icon">{Icons.media}</div>
              <span className="mn-logo-text">Media Notes</span>
            </div>
            <button 
              className="mn-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <button className="mn-new-upload-btn" onClick={() => {
            setResults(null);
            setUploadedFile(null);
            setYoutubeUrl('');
          }}>
            <Upload size={18} />
            <span>New Upload</span>
          </button>

          <nav className="mn-sidebar-nav">
            <div className="mn-nav-section-title">History</div>
            <div className="mn-history-list">
              {history.length > 0 ? (
                history.slice(0, 10).map((item, idx) => (
                  <div 
                    key={idx} 
                    className="mn-history-item"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <span className="mn-history-icon">{Icons.notes}</span>
                    <div className="mn-history-info">
                      <div className="mn-history-title">{item.title}</div>
                      <div className="mn-history-date">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="mn-history-actions">
                      <button 
                        className="mn-history-btn"
                        onClick={(e) => deleteHistoryItem(e, item)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="mn-empty-state" style={{ padding: '20px' }}>
                  <p>No history yet</p>
                </div>
              )}
            </div>
          </nav>

          <div className="mn-sidebar-footer">
            <button className="mn-nav-item" onClick={() => navigate('/notes')}>
              <span className="mn-nav-icon">{Icons.notes}</span>
              <span className="mn-nav-text">My Notes</span>
            </button>
            <button className="mn-nav-item" onClick={() => navigate('/dashboard')}>
              <span className="mn-nav-icon">{Icons.home}</span>
              <span className="mn-nav-text">Dashboard</span>
            </button>
            <button className="mn-nav-item" onClick={handleLogout}>
              <span className="mn-nav-icon">{Icons.logout}</span>
              <span className="mn-nav-text">Logout</span>
            </button>
          </div>
        </aside>

        {/* Show Sidebar Button - appears when sidebar is collapsed */}
        {sidebarCollapsed && (
          <button 
            className="mn-show-sidebar-btn" 
            onClick={() => setSidebarCollapsed(false)}
            title="Show Sidebar"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Main Content */}
        <main className="mn-main">
          <header className="mn-header">
            <div className="mn-header-left">
              <h1 className="mn-header-title">AI Media Notes</h1>
              <p className="mn-header-subtitle">Transform audio & video into smart study notes</p>
            </div>
            <div className="mn-header-actions">
              <button 
                className="mn-btn mn-btn-secondary"
                onClick={() => {
                  setResults(null);
                  setUploadedFile(null);
                  setYoutubeUrl('');
                }}
              >
                <Upload size={16} />
                New Upload
              </button>
            </div>
          </header>

          <div className="mn-content" ref={contentRef}>
            {!results ? (
              <div className="mn-upload-section">
                <h2 className="mn-upload-title">Transform Media into Smart Notes</h2>
                <p className="mn-upload-subtitle">
                  Upload audio or video files, or paste a YouTube URL to generate AI-powered study notes
                </p>

                <div
                  className={`mn-upload-area ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <Upload size={48} />
                  <p>Drag & drop or click to upload</p>
                  <span>Audio & Video files supported (Max 10MB)</span>
                </div>

                {uploadedFile && (
                  <div className="mn-uploaded-file">
                    <FileText size={20} />
                    <span>{uploadedFile.name}</span>
                    <button onClick={() => setUploadedFile(null)}>×</button>
                  </div>
                )}

                <div className="mn-divider">
                  <span>or</span>
                </div>

                <div className="mn-youtube-input">
                  <Youtube size={20} />
                  <input
                    type="text"
                    placeholder="Paste YouTube URL..."
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setUploadedFile(null);
                    }}
                  />
                </div>

                {/* Settings Panel */}
                <div className="mn-settings-panel">
                  <div className="mn-settings-header" onClick={() => setShowSettings(!showSettings)}>
                    <h3><Settings size={16} /> AI Settings</h3>
                    <span className="mn-settings-toggle">{showSettings ? '−' : '+'}</span>
                  </div>

                  {showSettings && (
                    <div className="mn-settings-content">
                      <div className="mn-settings-grid">
                        <div className="mn-form-group">
                          <label>Note Style</label>
                          <select value={noteStyle} onChange={(e) => setNoteStyle(e.target.value)}>
                            <option value="detailed">Detailed Notes</option>
                            <option value="summary">Summary</option>
                            <option value="bullet_points">Bullet Points</option>
                            <option value="mind_map">Mind Map</option>
                            <option value="cornell">Cornell Notes</option>
                            <option value="outline">Outline</option>
                            <option value="qa">Q&A Format</option>
                          </select>
                        </div>

                        <div className="mn-form-group">
                          <label>Difficulty Level</label>
                          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                      </div>

                      <div className="mn-form-group">
                        <label>Subject/Topic (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g., Biology, History..."
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </div>

                      <div className="mn-form-group">
                        <label>Custom Instructions (Optional)</label>
                        <textarea
                          placeholder="Any specific requirements for the notes..."
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="mn-checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={generateFlashcards}
                            onChange={(e) => setGenerateFlashcards(e.target.checked)}
                          />
                          Generate Flashcards
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={generateQuiz}
                            onChange={(e) => setGenerateQuiz(e.target.checked)}
                          />
                          Generate Quiz
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={processMedia}
                  disabled={isProcessing || (!uploadedFile && !youtubeUrl)}
                  className="mn-process-btn"
                >
                  {isProcessing ? (
                    <>
                      <Loader size={18} className="mn-spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Brain size={18} />
                      Generate AI Notes
                    </>
                  )}
                </button>

                {isProcessing && (
                  <div className="mn-progress">
                    <div className="mn-progress-bar">
                      <div className="mn-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mn-progress-text">{processingStage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mn-results">
                <div className="mn-results-header">
                  <div className="mn-results-header-top">
                    <h2>{results.filename}</h2>
                    <button 
                      onClick={() => {
                        setResults(null);
                        setUploadedFile(null);
                        setYoutubeUrl('');
                      }}
                      className="mn-btn mn-btn-secondary"
                    >
                      <Upload size={16} />
                      New Note
                    </button>
                  </div>
                  <div className="mn-results-meta">
                    {results.language_name && (
                      <span className="mn-meta-badge">
                        <Globe size={14} />
                        {results.language_name}
                      </span>
                    )}
                    {results.duration > 0 && (
                      <span className="mn-meta-badge">
                        <Clock size={14} />
                        {formatTime(results.duration)}
                      </span>
                    )}
                    {results.analysis?.difficulty_level && (
                      <span className="mn-meta-badge">
                        <Zap size={14} />
                        {results.analysis.difficulty_level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="mn-tabs">
                  <button
                    className={`mn-tab ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                  >
                    <BookOpen size={16} />
                    Notes
                  </button>
                  <button
                    className={`mn-tab ${activeTab === 'analysis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analysis')}
                  >
                    <Brain size={16} />
                    Analysis
                  </button>
                  <button
                    className={`mn-tab ${activeTab === 'flashcards' ? 'active' : ''}`}
                    onClick={() => setActiveTab('flashcards')}
                  >
                    <Zap size={16} />
                    Flashcards {results.flashcards?.length > 0 && `(${results.flashcards.length})`}
                  </button>
                  <button
                    className={`mn-tab ${activeTab === 'quiz' ? 'active' : ''}`}
                    onClick={() => setActiveTab('quiz')}
                  >
                    <CheckCircle size={16} />
                    Quiz {results.quiz_questions?.length > 0 && `(${results.quiz_questions.length})`}
                  </button>
                  {results.key_moments?.length > 0 && (
                    <button
                      className={`mn-tab ${activeTab === 'moments' ? 'active' : ''}`}
                      onClick={() => setActiveTab('moments')}
                    >
                      <Play size={16} />
                      Key Moments ({results.key_moments.length})
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                <div className="mn-tab-content">
                  {activeTab === 'notes' && results.notes && (
                    <div>
                      <div className="mn-content-actions">
                        <button onClick={() => copyToClipboard(results.notes.content)} className="mn-btn mn-btn-secondary">
                          <Copy size={16} />
                          Copy
                        </button>
                        <button onClick={saveNotes} className="mn-btn mn-btn-primary">
                          <Save size={16} />
                          Save to Notes
                        </button>
                        <button onClick={() => setShowImportExport(true)} className="convert-btn">
                          <Zap size={16} />
                          <span>Convert</span>
                        </button>
                      </div>
                      <div className="mn-notes-panel">
                        <div
                          className="mn-notes-output"
                          dangerouslySetInnerHTML={{ __html: results.notes.content }}
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'analysis' && (
                    <div className="mn-notes-panel">
                      {!results.analysis || Object.keys(results.analysis).length === 0 ? (
                        <div className="mn-empty-state">
                          <AlertCircle size={48} />
                          <p>No analysis data available</p>
                        </div>
                      ) : (
                        <>
                          {results.analysis?.summary && (
                            <div className="mn-analysis-section">
                              <h3>Summary</h3>
                              <p>{results.analysis.summary}</p>
                            </div>
                          )}

                          {results.analysis?.key_concepts?.length > 0 && (
                            <div className="mn-analysis-section">
                              <h3>Key Concepts</h3>
                              <div className="mn-concept-tags">
                                {results.analysis.key_concepts.map((concept, idx) => (
                                  <span key={idx} className="mn-concept-tag">{concept}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {results.analysis?.topics?.length > 0 && (
                            <div className="mn-analysis-section">
                              <h3>Topics Covered</h3>
                              <div className="mn-topic-list">
                                {results.analysis.topics.map((topic, idx) => (
                                  <div key={idx} className="mn-topic-item">
                                    <CheckCircle size={16} />
                                    {topic}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {results.analysis?.estimated_study_time && (
                            <div className="mn-analysis-section">
                              <h3>Estimated Study Time</h3>
                              <div className="mn-study-time">
                                <Clock size={20} />
                                {results.analysis.estimated_study_time} minutes
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'flashcards' && (
                    <>
                      {!results.flashcards || results.flashcards.length === 0 ? (
                        <div className="mn-empty-state">
                          <AlertCircle size={48} />
                          <p>No flashcards generated</p>
                          <p className="mn-empty-hint">Enable "Generate Flashcards" in settings before processing</p>
                        </div>
                      ) : (
                        <>
                          <div className="mn-content-actions">
                            <button onClick={saveFlashcards} className="mn-btn mn-btn-primary">
                              <Save size={16} />
                              Save to Flashcards
                            </button>
                            <button onClick={() => copyToClipboard(JSON.stringify(results.flashcards, null, 2))} className="mn-btn mn-btn-secondary">
                              <Copy size={16} />
                              Copy JSON
                            </button>
                          </div>
                          <div className="mn-flashcards-grid">
                            {results.flashcards.map((card, idx) => (
                              <div key={idx} className="mn-flashcard">
                                <div className="mn-flashcard-front">
                                  <span className="mn-card-label">Q{idx + 1}</span>
                                  <p>{card.question}</p>
                                </div>
                                <div className="mn-flashcard-back">
                                  <span className="mn-card-label">Answer</span>
                                  <p>{card.answer}</p>
                                  {card.difficulty && (
                                    <span className={`mn-difficulty-badge ${card.difficulty}`}>
                                      {card.difficulty}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeTab === 'quiz' && (
                    <>
                      {!results.quiz_questions || results.quiz_questions.length === 0 ? (
                        <div className="mn-empty-state">
                          <AlertCircle size={48} />
                          <p>No quiz questions generated</p>
                          <p className="mn-empty-hint">Enable "Generate Quiz" in settings before processing</p>
                        </div>
                      ) : (
                        <div className="mn-quiz-list">
                          {results.quiz_questions.map((q, idx) => (
                            <div key={idx} className="mn-quiz-question">
                              <h4>Question {idx + 1}</h4>
                              <p className="mn-question-text">{q.question}</p>
                              <div className="mn-quiz-options">
                                {q.options.map((option, optIdx) => (
                                  <div
                                    key={optIdx}
                                    className={`mn-quiz-option ${optIdx === q.correct_answer ? 'correct' : ''}`}
                                  >
                                    <span className="mn-option-letter">{String.fromCharCode(65 + optIdx)}</span>
                                    {option}
                                  </div>
                                ))}
                              </div>
                              {q.explanation && (
                                <div className="mn-explanation">
                                  <strong>Explanation:</strong> {q.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'moments' && results.key_moments && (
                    <div className="mn-moments-list">
                      {results.key_moments.map((moment, idx) => (
                        <div key={idx} className="mn-moment-item">
                          <div className="mn-moment-time">
                            <Play size={14} />
                            {formatTime(moment.timestamp)}
                          </div>
                          <div className="mn-moment-content">
                            <p className="mn-moment-text">{moment.text}</p>
                            <div className="mn-importance-bar">
                              <div
                                className="mn-importance-fill"
                                style={{ width: `${(moment.importance / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="media"
        onSuccess={() => alert("Successfully converted media!")}
      />
    </div>
  );
};

export default AIMediaNotes;
