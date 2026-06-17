import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Upload, Youtube, FileText, Save, Copy, Mic, Loader,
  Settings, Brain, Zap, Clock, Globe, ChevronLeft, ChevronRight,
  BookOpen, CheckCircle, AlertCircle, Play, Trash2, Home
} from 'lucide-react';
import './AIMediaNotes.css';
import './AIMediaNotesConvert.css';
import { API_URL } from '../config';
import { queueLegacyAIEndpoint, queueLegacyAIFileEndpoint, USE_AI_JOB_QUEUE } from '../services/aiJobService';
import { sanitizeHtml } from '../utils/sanitize';
import ImportExportModal from '../components/ImportExportModal';
import PodcastStudio from '../components/media/PodcastStudio';

const asText = (value) => (value === null || value === undefined ? '' : String(value));
const MEDIA_FILE_ACCEPT = 'audio/*,video/*,.m4a,audio/mp4,audio/x-m4a';

const formatDate = (value) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '';
};

const AIMediaNotes = () => {
  const navigate = useNavigate();
  const { noteId } = useParams();
  const location = useLocation();
  const isLibraryView = location.pathname.endsWith('/my-notes');
  const userName = localStorage.getItem('username');
  const fileInputRef = useRef(null);
  const contentRef = useRef(null);

  
  const [uploadedFile, setUploadedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [progress, setProgress] = useState(0);

  
  const [noteStyle, setNoteStyle] = useState('detailed');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [subject, setSubject] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generateFlashcards, setGenerateFlashcards] = useState(true);
  const [generateQuiz, setGenerateQuiz] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);

  
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');
  const [podcastSettingsOpen, setPodcastSettingsOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth > 768
  ));
  const [activeNoteId, setActiveNoteId] = useState(null);

  useEffect(() => {
    if (activeTab !== 'podcast') {
      setPodcastSettingsOpen(false);
    }
  }, [activeTab]);

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
    setActiveNoteId(null); 
    let progressInterval = null;

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

      progressInterval = setInterval(() => {
        setProgress(prev => prev < 90 ? prev + 5 : prev);
      }, 500);

      setProcessingStage('Transcribing audio...');
      
      const token = localStorage.getItem('token');
      let data;
      if (USE_AI_JOB_QUEUE) {
        const formBody = Object.fromEntries(formData.entries());
        const queuedFiles = uploadedFile ? [{ fieldName: 'file', file: uploadedFile }] : [];
        data = await queueLegacyAIFileEndpoint('/api/media/process', formBody, queuedFiles, { timeoutMs: 300000 });
      } else {
        const response = await fetch(`${API_URL}/media/process`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (!response.ok) {
          let errorMessage = 'Processing failed';
          try {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } catch {
            errorMessage = await response.text() || errorMessage;
          }
          throw new Error(errorMessage);
        }
        data = await response.json();
      }

      clearInterval(progressInterval);
      progressInterval = null;

      setProcessingStage('Generating AI notes...');
      setProgress(95);

      setProgress(100);
      setResults(data);
      setActiveTab('notes');

    } catch (error) {
      
      let errorMessage = error.message;
      if (errorMessage.includes('quota') || errorMessage.includes('credits') || errorMessage.includes('429') || errorMessage.includes('V1')) {
        errorMessage = '⏱️ AI service rate limit reached. Please wait 1-2 minutes and try again.\n\nFree tier limits:\n• Groq: 30 requests/minute\n• Gemini: 15 requests/minute';
      } else if (errorMessage.includes('rate limit')) {
        errorMessage = '⏱️ Too many requests. Please wait 1 minute and try again.';
      }
      alert(`Failed to process media: ${errorMessage}`);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setIsProcessing(false);
      setProcessingStage('');
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const saveNotes = async () => {
    if (!results?.notes?.content) {
      alert('No notes to save');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const titlePayload = {
        transcript: asText(results.transcript).substring(0, 1000),
        key_concepts: results.analysis?.key_concepts || [],
        summary: results.analysis?.summary || ''
      };
      const titleResponse = USE_AI_JOB_QUEUE
        ? await queueLegacyAIEndpoint('/api/media/generate-title', { jsonBody: titlePayload })
        : await fetch(`${API_URL}/media/generate-title`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(titlePayload)
          });

      let titleData = {};
      if (USE_AI_JOB_QUEUE) {
        titleData = titleResponse || {};
      } else if (titleResponse.ok) {
        titleData = await titleResponse.json();
      }

      let smartTitle = results.filename || 'Media Notes';
      if (titleData?.title) {
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
          transcript: asText(results.transcript),
          analysis: results.analysis,
          flashcards: results.flashcards,
          quiz_questions: results.quiz_questions,
          key_moments: results.key_moments
        })
      });

      if (!response.ok) throw new Error('Save failed');

      const data = await response.json();
      alert('Notes saved successfully!');
      setActiveNoteId(data.note_id);
      await fetchHistory();
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
      
      
      const titleResponse = USE_AI_JOB_QUEUE
        ? await queueLegacyAIEndpoint('/api/media/generate-title', {
            jsonBody: {
              transcript: results.transcript?.substring(0, 1000) || '',
              key_concepts: results.analysis?.key_concepts || [],
              summary: results.analysis?.summary || ''
            }
          })
        : await fetch(`${API_URL}/media/generate-title`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              transcript: results.transcript?.substring(0, 1000) || '',
              key_concepts: results.analysis?.key_concepts || [],
              summary: results.analysis?.summary || ''
            })
          });

      let smartTitle = results.filename || 'Media Flashcards';
      if (USE_AI_JOB_QUEUE && titleResponse?.title) {
        smartTitle = `${titleResponse.title} - Flashcards`;
      } else if (!USE_AI_JOB_QUEUE && titleResponse.ok) {
        const titleData = await titleResponse.json();
        smartTitle = `${titleData.title} - Flashcards`;
      }
      
      
      const setResponse = await fetch(`${API_URL}/flashcards/sets/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userName,
          title: smartTitle,
          description: `Flashcards from ${results.source_type === 'youtube' ? 'YouTube video' : 'uploaded media'}`
        })
      });

      if (!setResponse.ok) {
        const errorData = await setResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create flashcard set');
      }

      const setData = await setResponse.json();
      const setId = setData.set_id;

      
      for (const card of results.flashcards) {
        const cardResponse = await fetch(`${API_URL}/flashcards/cards/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            set_id: setId,
            question: card.question,
            answer: card.answer,
            difficulty: card.difficulty || 'medium'
          })
        });

        if (!cardResponse.ok) {
          console.error('Failed to add flashcard:', card.question);
        }
      }

      alert(`✅ Successfully saved ${results.flashcards.length} flashcards!`);
      navigate('/flashcards');

    } catch (error) {
      console.error('Save flashcards error:', error);
      alert(`Failed to save flashcards: ${error.message}`);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(asText(text));
      alert('Copied to clipboard!');
    } catch (error) {
      alert('Failed to copy');
    }
  };

  const formatTime = (seconds) => {
    const totalSeconds = Number(seconds);
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (noteId) {
      loadHistoryItem({ id: parseInt(noteId) });
    }
  }, [noteId]);

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
      } else {
        throw new Error(`Failed to load history: ${response.status}`);
      }
    } catch (error) {
      console.error('Media history load error:', error);
  }
  };

  const loadHistoryItem = async (item) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/get_note/${item.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to load note: ${response.status}`);
      }

      const note = await response.json();
      
      
      const safeParseJSON = (jsonString, fallback = null) => {
        if (!jsonString) return fallback;
        if (typeof jsonString === 'object') return jsonString; 
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error('JSON parse error:', e, 'for:', jsonString);
          return fallback;
        }
      };
      
      const analysis = safeParseJSON(note.analysis, {});
      const flashcards = safeParseJSON(note.flashcards, []);
      const quiz_questions = safeParseJSON(note.quiz_questions, []);
      const key_moments = safeParseJSON(note.key_moments, []);
      
      
      setResults({
        filename: note.title || 'Untitled Note',
        notes: { content: note.content || '', style: 'detailed' },
        transcript: note.transcript || '',
        analysis: analysis,
        flashcards: flashcards,
        quiz_questions: quiz_questions,
        key_moments: key_moments,
        source_type: 'history',
        duration: 0,
        language_name: ''
      });
      setActiveNoteId(item.id);
      setActiveTab('notes');
      navigate(`/notes/ai-media/${item.id}`, { replace: true });
    } catch (error) {
      console.error('Load error:', error);
      alert(`Failed to load note: ${error.message}`);
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
        if (activeNoteId === item.id) {
          setResults(null);
          setActiveNoteId(null);
        }
      } else {
        throw new Error(`Failed to delete note: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete note');
    }
  };

  const startNewUpload = () => {
    setResults(null);
    setUploadedFile(null);
    setYoutubeUrl('');
    setActiveNoteId(null);
    setActiveTab('notes');
  };

  const currentMediaTitle = isLibraryView ? 'My Media Notes' : (results?.filename || (activeNoteId ? history.find(item => item.id === activeNoteId)?.title : null) || 'AI Media Notes');
  const flashcardCount = Array.isArray(results?.flashcards) ? results.flashcards.length : 0;
  const quizCount = Array.isArray(results?.quiz_questions) ? results.quiz_questions.length : 0;
  const momentCount = Array.isArray(results?.key_moments) ? results.key_moments.length : 0;

  return (
    <div className="ai-media-notes-page">
      <svg className="geo-bg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="600" cy="400" r="360" fill="none" stroke="currentColor" strokeWidth="1"/>
        <circle cx="600" cy="400" r="260" fill="none" stroke="currentColor" strokeWidth="0.8"/>
        <circle cx="600" cy="400" r="168" fill="none" stroke="currentColor" strokeWidth="0.7"/>
        <circle cx="600" cy="400" r="90" fill="none" stroke="currentColor" strokeWidth="0.6"/>
        <line x1="600" y1="0" x2="600" y2="800" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="400" x2="1200" y2="400" stroke="currentColor" strokeWidth="0.5"/>
        <line x1="0" y1="800" x2="500" y2="0" stroke="currentColor" strokeWidth="0.4"/>
        <line x1="1200" y1="0" x2="700" y2="800" stroke="currentColor" strokeWidth="0.4"/>
        <circle cx="600" cy="40" r="5" fill="currentColor"/>
        <circle cx="600" cy="760" r="5" fill="currentColor"/>
        <circle cx="240" cy="400" r="5" fill="currentColor"/>
        <circle cx="960" cy="400" r="5" fill="currentColor"/>
        <circle cx="345" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="654" r="3.5" fill="currentColor"/>
        <circle cx="855" cy="146" r="3.5" fill="currentColor"/>
        <circle cx="345" cy="654" r="3.5" fill="currentColor"/>
      </svg>
      <div className="amn-qb-topbar">
        <div className="amn-qb-tagline">Learning Unified</div>
      </div>

      <div className="mn-layout amn-qb-body">
        <div className={`amn-qb-shell ${sidebarOpen ? '' : 'amn-qb-shell--collapsed'}`}>
          <aside className={`amn-qb-sidebar ${sidebarOpen ? '' : 'amn-qb-sidebar--collapsed'}`} aria-label="Media notes navigation">
            {!sidebarOpen ? (
              <div className="amn-qb-collapsed-strip">
                <button className="amn-qb-strip-btn" data-tip="Open sidebar" onClick={() => setSidebarOpen(true)} type="button">
                  <ChevronRight size={18} />
                </button>
                <button className="amn-qb-strip-btn" data-tip="New Upload" onClick={startNewUpload} type="button">
                  <Upload size={18} />
                </button>

                <div className="amn-qb-strip-divider"></div>

                <button
                  className={`amn-qb-strip-btn ${!isLibraryView && activeTab === 'notes' ? 'active' : ''}`}
                  data-tip="Notes"
                  onClick={() => setActiveTab('notes')}
                  disabled={!results}
                  type="button"
                >
                  <BookOpen size={18} />
                </button>
                <button
                  className={`amn-qb-strip-btn ${!isLibraryView && activeTab === 'podcast' ? 'active' : ''}`}
                  data-tip="Podcast"
                  onClick={() => setActiveTab('podcast')}
                  disabled={!results}
                  type="button"
                >
                  <Mic size={18} />
                </button>
                <button
                  className={`amn-qb-strip-btn ${!isLibraryView && activeTab === 'flashcards' ? 'active' : ''}`}
                  data-tip="Flashcards"
                  onClick={() => setActiveTab('flashcards')}
                  disabled={!results}
                  type="button"
                >
                  <FileText size={18} />
                </button>
                <button
                  className={`amn-qb-strip-btn ${!isLibraryView && activeTab === 'quiz' ? 'active' : ''}`}
                  data-tip="Quiz"
                  onClick={() => setActiveTab('quiz')}
                  disabled={!results}
                  type="button"
                >
                  <CheckCircle size={18} />
                </button>

                <div className="amn-qb-strip-divider"></div>

                <button className={`amn-qb-strip-btn ${isLibraryView ? 'active' : ''}`} data-tip="My Notes" onClick={() => navigate('/notes/ai-media/my-notes')} type="button">
                  <FileText size={18} />
                </button>

                <div className="amn-qb-strip-spacer"></div>

                <button className="amn-qb-strip-btn" data-tip="Dashboard" onClick={() => navigate('/dashboard-cerbyl')} type="button">
                  <Home size={18} />
                </button>
              </div>
            ) : (
            <>
              <div className="amn-qb-side-brand">
                <div className="amn-qb-brand-wrap">
                  <div className="amn-qb-brand">cerbyl</div>
                  <div className="amn-qb-brand-kicker">Media</div>
                  <div className="amn-qb-current-title">{currentMediaTitle}</div>
                </div>
                <button
                  className="amn-qb-side-close-btn"
                  onClick={() => setSidebarOpen(false)}
                  title="Close sidebar"
                  aria-label="Close media notes sidebar"
                  type="button"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <button className="amn-qb-new-btn" onClick={startNewUpload} type="button">
                <Upload size={16} />
                <span>New Upload</span>
              </button>

              <div className="amn-qb-side-block">
                <div className="amn-qb-side-label">Generated Output</div>
                <nav className="amn-qb-view-nav" aria-label="Generated output tabs">
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'notes' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('notes')} disabled={!results} type="button">
                    <BookOpen size={16} />
                    <span>Notes</span>
                  </button>
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'podcast' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('podcast')} disabled={!results} type="button">
                    <Mic size={16} />
                    <span>Podcast</span>
                  </button>
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'analysis' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('analysis')} disabled={!results} type="button">
                    <Zap size={16} />
                    <span>Analysis</span>
                  </button>
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'flashcards' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('flashcards')} disabled={!results} type="button">
                    <FileText size={16} />
                    <span>Flashcards</span>
                    <span className="amn-qb-nav-count">{flashcardCount}</span>
                  </button>
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'quiz' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('quiz')} disabled={!results} type="button">
                    <CheckCircle size={16} />
                    <span>Quiz</span>
                    <span className="amn-qb-nav-count">{quizCount}</span>
                  </button>
                  <button className={`amn-qb-view-link ${!isLibraryView && activeTab === 'moments' ? 'amn-qb-view-link--active' : ''}`} onClick={() => setActiveTab('moments')} disabled={!results || !momentCount} type="button">
                    <Play size={16} />
                    <span>Moments</span>
                    <span className="amn-qb-nav-count">{momentCount}</span>
                  </button>
                </nav>
              </div>

              <div className="amn-qb-side-block">
                <div className="amn-qb-side-label">Library</div>
                <nav className="amn-qb-view-nav" aria-label="Media library">
                  <button className={`amn-qb-view-link ${isLibraryView ? 'amn-qb-view-link--active' : ''}`} onClick={() => navigate('/notes/ai-media/my-notes')} type="button">
                    <span>My Notes</span>
                  </button>
                </nav>
              </div>

              <div className="amn-qb-side-block amn-qb-side-block--grow">
                <div className="amn-qb-side-label">History</div>
                <div className="amn-qb-history-list">
                  {history.length > 0 ? (
                    history.slice(0, 10).map((item, idx) => (
                      <div
                        key={idx}
                        className={`amn-qb-history-item ${activeNoteId === item.id ? 'amn-qb-history-item--active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => loadHistoryItem(item)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') loadHistoryItem(item);
                        }}
                      >
                        <FileText size={16} />
                        <span className="amn-qb-history-info">
                          <span className="amn-qb-history-title">{item.title}</span>
                          <span className="amn-qb-history-date">{formatDate(item.created_at)}</span>
                        </span>
                        <button
                          type="button"
                          className="amn-qb-history-delete"
                          title="Delete"
                          onClick={(e) => deleteHistoryItem(e, item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="amn-qb-empty-line">No history yet</div>
                  )}
                </div>
              </div>

              <div className="amn-qb-side-actions">
                <button className="amn-qb-action-btn" onClick={() => navigate('/dashboard-cerbyl')} type="button">
                  <Home size={14} />
                  <span>Dashboard</span>
                </button>
              </div>
            </>
            )}
          </aside>

          <main className="amn-qb-main">
          <div className="mn-content" ref={contentRef}>
            {isLibraryView ? (
              <div className="mn-upload-section">
                <div className="view-heading mn-view-heading">
                  <span className="view-kicker">Your Library</span>
                  <h2 className="view-title">My Media Notes</h2>
                  <p className="view-sub">Every note generated from your audio, video &amp; YouTube uploads</p>
                </div>

                {history.length > 0 ? (
                  <div className="amn-library-grid">
                    {history.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="amn-library-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/notes/ai-media/${item.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') navigate(`/notes/ai-media/${item.id}`);
                        }}
                      >
                        <div className="amn-library-card-icon"><FileText size={18} /></div>
                        <h3 className="amn-library-card-title">{item.title}</h3>
                        {item.preview && <p className="amn-library-card-preview">{item.preview}</p>}
                        <div className="amn-library-card-footer">
                          <span className="amn-library-card-date">{formatDate(item.created_at)}</span>
                          <button
                            type="button"
                            className="amn-library-card-delete"
                            title="Delete"
                            onClick={(e) => deleteHistoryItem(e, item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mn-empty-state">
                    <AlertCircle size={48} />
                    <p>No media notes yet</p>
                    <p className="mn-empty-hint">Generate notes from audio, video, or YouTube to see them here</p>
                  </div>
                )}
              </div>
            ) : !results ? (
              <div className="mn-upload-section">
                <div className="view-heading mn-view-heading">
                  <span className="view-kicker">AI-Powered</span>
                  <h2 className="view-title">AI Media Notes</h2>
                  <p className="view-sub">Transform audio, video &amp; YouTube into smart study notes</p>
                </div>

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
                    accept={MEDIA_FILE_ACCEPT}
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
                  <h2 className="mn-results-title">{results.filename}</h2>
                  <div className="mn-results-meta">
                    {results.language_name && (
                      <span className="mn-meta-badge">
                        <Globe size={13} />
                        {results.language_name}
                      </span>
                    )}
                    {results.duration > 0 && (
                      <span className="mn-meta-badge">
                        <Clock size={13} />
                        {formatTime(results.duration)}
                      </span>
                    )}
                    {results.analysis?.difficulty_level && (
                      <span className="mn-meta-badge">
                        <Zap size={13} />
                        {results.analysis.difficulty_level}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mn-tabs-bar">
                  <div className="mn-tabs">
                    <button
                      className={`mn-tab ${activeTab === 'notes' ? 'active' : ''}`}
                      onClick={() => setActiveTab('notes')}
                    >
                      <BookOpen size={15} />
                      <span>NOTES</span>
                    </button>
                    <button
                      className={`mn-tab ${activeTab === 'podcast' ? 'active' : ''}`}
                      onClick={() => setActiveTab('podcast')}
                    >
                      <Mic size={15} />
                      <span>PODCAST</span>
                    </button>
                  </div>
                  {activeTab === 'notes' && results.notes && (
                    <div className="mn-tabs-actions">
                      <button onClick={() => copyToClipboard(results.notes.content)} className="mn-tab-action-btn">
                        <Copy size={14} />
                        <span>Copy</span>
                      </button>
                      <button onClick={saveNotes} className="mn-tab-action-btn mn-tab-action-primary">
                        <Save size={14} />
                        <span>Save to Notes</span>
                      </button>
                      <button onClick={() => setShowImportExport(true)} className="mn-tab-action-btn">
                        <Zap size={14} />
                        <span>Convert</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mn-tab-content">
                  {activeTab === 'notes' && results.notes && (
                    <div>
                      <div className="mn-notes-panel">
                        <div
                          className="mn-notes-output"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(results.notes.content || '') }}
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
                                <div className="mn-flashcard-question">
                                  <p>{card.question}</p>
                                </div>
                                <div className="mn-flashcard-answer">
                                  <p>{card.answer}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {activeTab === 'podcast' && (
                    <PodcastStudio
                      results={results}
                      userName={userName}
                      onExit={() => setActiveTab('notes')}
                      onSettingsDrawerChange={setPodcastSettingsOpen}
                    />
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
                                {(Array.isArray(q.options) ? q.options : []).map((option, optIdx) => (
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
      </div>
      
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        mode="import"
        sourceType="media"
        onSuccess={(result) => {
          if (result?.shouldNavigate) {
            if (result.destinationType === 'flashcards') {
              if (result.set_id) {
                navigate(`/flashcards?set_id=${result.set_id}&mode=preview`);
              } else {
                navigate('/flashcards');
              }
            } else if (result.destinationType === 'questions') {
              if (result.set_id) {
                navigate(`/question-bank?set_id=${result.set_id}`);
              } else {
                navigate('/question-bank');
              }
            } else if (result.destinationType === 'podcast') {
              const noteIds = Array.isArray(result.note_ids) ? result.note_ids.join(',') : '';
              const route = noteIds ? `/notes/podcast?note_ids=${encodeURIComponent(noteIds)}` : '/notes/podcast';
              navigate(route, { state: { podcastPayload: result } });
            } else if (result.destinationType === 'notes') {
              if (result.note_id) {
                navigate(`/notes/editor/${result.note_id}`);
              } else {
                navigate('/notes/my-notes');
              }
            }
          } else {
            alert("Successfully converted media!");
          }
        }}
      />
    </div>
  );
};

export default AIMediaNotes;
