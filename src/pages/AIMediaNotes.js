import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Youtube, FileText, Save, Copy, RefreshCw, Mic, Loader,
  ArrowLeft, Settings, Sparkles, Brain, Zap, Clock, Globe,
  BookOpen, CheckCircle, AlertCircle, Play, Pause, Volume2, Trash2
} from 'lucide-react';
import './AIMediaNotes.css';
import { API_URL } from '../config';
import ImportExportModal from '../components/ImportExportModal';

const AIMediaNotes = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('username');
  const fileInputRef = useRef(null);
  const messagesContainerRef = useRef(null);

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

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + 5;
          return prev;
        });
      }, 500);

      setProcessingStage('Transcribing audio...');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/media/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
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
      console.log('Received data from backend:', data);
      console.log('Analysis data:', data.analysis);
      console.log('Flashcards count:', data.flashcards?.length || 0);
      console.log('Quiz questions count:', data.quiz_questions?.length || 0);
      setProgress(100);
      setResults(data);
      setActiveTab('notes');

    } catch (error) {
      console.error('Processing error:', error);
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
      
      // Generate AI title
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
      fetchHistory(); // Refresh history
      navigate(`/notes/editor/${data.note_id}`);

    } catch (error) {
      console.error('Save error:', error);
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
      
      // Create flashcard set using correct endpoint
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

      // Add flashcards to the set
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
      console.error('Save flashcards error:', error);
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

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to top when tab changes
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/media/history?user_id=${userName}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Media history fetched:', data.history);
        setHistory(data.history || []);
      } else {
        console.error('Failed to fetch history:', response.status);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const loadHistoryItem = async (item) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_note/${item.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const note = await response.json();
        
        // Reconstruct results object from saved note
        setResults({
          filename: note.title,
          notes: {
            content: note.content,
            style: 'detailed'
          },
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
      } else {
        throw new Error('Failed to load note');
      }
    } catch (error) {
      console.error('Error loading history item:', error);
      alert('Failed to load note');
    }
  };

  const deleteHistoryItem = async (e, item) => {
    e.stopPropagation(); // Prevent loading the note when clicking delete
    
    if (!window.confirm(`Delete "${item.title}"?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/delete_note/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchHistory(); // Refresh history
        if (results && results.filename === item.title) {
          setResults(null); // Clear results if currently viewing deleted note
        }
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  return (
    <div className="ai-media-notes-page">
      {/* Header spanning full width - matching AIChat */}
      <div className="global-chat-header">
        <button 
          className="sidebar-toggle" 
          onClick={() => navigate('/notes')}
          title="Back to Notes"
        >
          <ArrowLeft size={20} />
        </button>
        
        <h1 className="chat-title" onClick={() => navigate('/dashboard')}>
          ai media notes
        </h1>

        <div className="header-right">
          <button className="header-btn" onClick={() => navigate('/dashboard')}>
            DASHBOARD
          </button>
          <button className="header-btn" onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            navigate('/');
          }}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* Content area with sidebar and main content */}
      <div className="chat-content-area">
        {/* Left Sidebar - History */}
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title-bar">
              <span className="sidebar-title">RECENT HISTORY</span>
            </div>
          </div>
          
          <div className="chat-sessions">
            {history.length > 0 ? (
              <>
                {history.slice(0, 10).map((item, idx) => (
                  <div 
                    key={idx} 
                    className="chat-session-item"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="chat-session-content">
                      <div className="session-title">{item.title}</div>
                      <div className="session-date">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="chat-session-actions">
                      <button 
                        className="delete-chat-btn"
                        onClick={(e) => deleteHistoryItem(e, item)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="no-chats">
                <p>No history yet</p>
                <span>Your processed media will appear here</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Upload & Results */}
        <div className="chat-main">
          {!results ? (
            <div className="messages-container">
              <div className="welcome-screen">
                <div className="welcome-content">
                  <h2 className="upload-main-title">Transform Media into Smart Notes</h2>
                  <p className="upload-subtitle">Upload audio or video files, or paste a YouTube URL to generate AI-powered study notes</p>
                  
                  <div className="upload-section-center">
                    <div
                      className={`upload-area ${isDragging ? 'dragging' : ''}`}
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
                      <Upload size={64} />
                      <p>Drag & drop or click to upload</p>
                      <span>Audio & Video files supported (Max 10MB)</span>
                    </div>

                    {uploadedFile && (
                      <div className="uploaded-file">
                        <FileText size={20} />
                        <span>{uploadedFile.name}</span>
                        <button onClick={() => setUploadedFile(null)}>×</button>
                      </div>
                    )}

                    <div className="divider">
                      <span>or</span>
                    </div>

                    <div className="youtube-input">
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
                    <div className="settings-panel-center">
                      <div className="section-header" onClick={() => setShowSettings(!showSettings)}>
                        <h3><Settings size={16} /> AI Settings</h3>
                        <span className="toggle-icon">{showSettings ? '−' : '+'}</span>
                      </div>

                      {showSettings && (
                        <div className="settings-content">
                          <div className="settings-grid">
                            <div className="setting-group">
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

                            <div className="setting-group">
                              <label>Difficulty Level</label>
                              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                              </select>
                            </div>
                          </div>

                          <div className="setting-group">
                            <label>Subject/Topic (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g., Biology, History..."
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                            />
                          </div>

                          <div className="setting-group">
                            <label>Custom Instructions (Optional)</label>
                            <textarea
                              placeholder="Any specific requirements for the notes..."
                              value={customInstructions}
                              onChange={(e) => setCustomInstructions(e.target.value)}
                              rows={3}
                            />
                          </div>

                          <div className="checkbox-group">
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
                      className="process-btn-center"
                    >
                      {isProcessing ? (
                        <>
                          <Loader size={18} className="spinner" />
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
                      <div className="processing-status">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="processing-stage">{processingStage}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-container" ref={messagesContainerRef}>
              <div className="messages-list">
                <div className="results-header-sticky">
                  <div className="results-header">
                    <div className="results-header-top">
                      <h2>{results.filename}</h2>
                      <button 
                        onClick={() => {
                          setResults(null);
                          setUploadedFile(null);
                          setYoutubeUrl('');
                          setActiveTab('notes');
                        }}
                        className="action-btn"
                        title="Create new note from media"
                      >
                        <Upload size={16} />
                        New Note
                      </button>
                    </div>
                    <div className="results-meta">
                      {results.language_name && (
                        <span className="meta-badge">
                          <Globe size={14} />
                          {results.language_name}
                        </span>
                      )}
                      {results.duration > 0 && (
                        <span className="meta-badge">
                          <Clock size={14} />
                          {formatTime(results.duration)}
                        </span>
                      )}
                      {results.analysis?.difficulty_level && (
                        <span className="meta-badge">
                          <Zap size={14} />
                          {results.analysis.difficulty_level}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="results-tabs">
              <button
                className={activeTab === 'notes' ? 'active' : ''}
                onClick={() => setActiveTab('notes')}
              >
                <BookOpen size={16} />
                Notes
              </button>
              <button
                className={activeTab === 'analysis' ? 'active' : ''}
                onClick={() => setActiveTab('analysis')}
              >
                <Brain size={16} />
                Analysis
              </button>
              <button
                className={activeTab === 'flashcards' ? 'active' : ''}
                onClick={() => setActiveTab('flashcards')}
              >
                <Sparkles size={16} />
                Flashcards {results.flashcards?.length > 0 && `(${results.flashcards.length})`}
              </button>
              <button
                className={activeTab === 'quiz' ? 'active' : ''}
                onClick={() => setActiveTab('quiz')}
              >
                <CheckCircle size={16} />
                Quiz {results.quiz_questions?.length > 0 && `(${results.quiz_questions.length})`}
              </button>
              {results.key_moments?.length > 0 && (
                <button
                  className={activeTab === 'moments' ? 'active' : ''}
                  onClick={() => setActiveTab('moments')}
                >
                  <Play size={16} />
                  Key Moments ({results.key_moments.length})
                </button>
              )}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="tab-content">
              {activeTab === 'notes' && results.notes && (
                <div className="notes-content">
                  <div className="content-actions">
                    <button onClick={() => copyToClipboard(results.notes.content)} className="action-btn">
                      <Copy size={16} />
                      Copy
                    </button>
                    <button onClick={saveNotes} className="action-btn primary">
                      <Save size={16} />
                      Save to Notes
                    </button>
                    <button onClick={() => setShowImportExport(true)} className="action-btn">
                      <Zap size={16} />
                      Convert
                    </button>
                  </div>
                  <div
                    className="notes-output"
                    dangerouslySetInnerHTML={{ __html: results.notes.content }}
                  />
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="analysis-content">
                  {!results.analysis || Object.keys(results.analysis).length === 0 ? (
                    <div className="empty-state">
                      <AlertCircle size={48} />
                      <p>No analysis data available</p>
                    </div>
                  ) : (
                    <>
                      {results.analysis?.summary && (
                        <div className="analysis-section">
                          <h3>Summary</h3>
                          <p>{results.analysis.summary}</p>
                        </div>
                      )}

                      {results.analysis?.key_concepts && results.analysis.key_concepts.length > 0 && (
                        <div className="analysis-section">
                          <h3>Key Concepts</h3>
                          <div className="concept-tags">
                            {results.analysis.key_concepts.map((concept, idx) => (
                              <span key={idx} className="concept-tag">{concept}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {results.analysis?.topics && results.analysis.topics.length > 0 && (
                        <div className="analysis-section">
                          <h3>Topics Covered</h3>
                          <div className="topic-list">
                            {results.analysis.topics.map((topic, idx) => (
                              <div key={idx} className="topic-item">
                                <CheckCircle size={16} />
                                {topic}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {results.analysis?.estimated_study_time && (
                        <div className="analysis-section">
                          <h3>Estimated Study Time</h3>
                          <p className="study-time">
                            <Clock size={20} />
                            {results.analysis.estimated_study_time} minutes
                          </p>
                        </div>
                      )}

                      {results.analysis?.questions && results.analysis.questions.length > 0 && (
                        <div className="analysis-section">
                          <h3>Study Questions</h3>
                          <ol className="study-questions">
                            {results.analysis.questions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'flashcards' && (
                <>
                  {!results.flashcards || results.flashcards.length === 0 ? (
                    <div className="empty-state">
                      <AlertCircle size={48} />
                      <p>No flashcards generated</p>
                      <p className="empty-hint">Enable "Generate Flashcards" in settings before processing</p>
                    </div>
                  ) : (
                    <>
                      <div className="content-actions">
                        <button onClick={saveFlashcards} className="action-btn primary">
                          <Save size={16} />
                          Save to Flashcards
                        </button>
                        <button onClick={() => copyToClipboard(JSON.stringify(results.flashcards, null, 2))} className="action-btn">
                          <Copy size={16} />
                          Copy JSON
                        </button>
                      </div>
                      <div className="flashcards-content">
                        {results.flashcards.map((card, idx) => (
                          <div key={idx} className="flashcard">
                            <div className="flashcard-front">
                              <span className="card-label">Q{idx + 1}</span>
                              <p>{card.question}</p>
                            </div>
                            <div className="flashcard-back">
                              <span className="card-label">Answer</span>
                              <p>{card.answer}</p>
                              {card.difficulty && (
                                <span className={`difficulty-badge ${card.difficulty}`}>
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
                    <div className="empty-state">
                      <AlertCircle size={48} />
                      <p>No quiz questions generated</p>
                      <p className="empty-hint">Enable "Generate Quiz" in settings before processing</p>
                    </div>
                  ) : (
                    <div className="quiz-content">
                      {results.quiz_questions.map((q, idx) => (
                        <div key={idx} className="quiz-question">
                          <h4>Question {idx + 1}</h4>
                          <p className="question-text">{q.question}</p>
                          <div className="quiz-options">
                            {q.options.map((option, optIdx) => (
                              <div
                                key={optIdx}
                                className={`quiz-option ${optIdx === q.correct_answer ? 'correct' : ''}`}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + optIdx)}</span>
                                {option}
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <div className="explanation">
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
                <div className="moments-content">
                  {results.key_moments.map((moment, idx) => (
                    <div key={idx} className="moment-item">
                      <div className="moment-time">
                        <Play size={16} />
                        {formatTime(moment.timestamp)}
                      </div>
                      <p className="moment-text">{moment.text}</p>
                      <div className="importance-bar">
                        <div
                          className="importance-fill"
                          style={{ width: `${(moment.importance / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="media"
        onSuccess={(result) => {
          alert("Successfully converted media!");
        }}
      />
    </div>
  );
};

export default AIMediaNotes;
